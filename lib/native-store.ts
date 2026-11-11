import "server-only";
import { z } from "zod";
import { BdError } from "./bd";
import { nativeCapabilities } from "./backend-capabilities";
import { nativeLabelInputSchema, nativeUpdateInputSchema, type Bead, type CreateInput, type UpdateInput } from "./schema";
import type { BeadsSnapshot } from "./backend-contract";
import type { BeadsStore } from "./store";
import { nativeProcess } from "./native-process";
import { nativeDocument, nativeIssueSchema, nativeSnapshot, readNativeIssue, type NativeIssue } from "./native-read";
import { commitNativeManifest } from "./native-manifest";
import { nativeCredentials } from "./native-credentials";
import { NativeMutation } from "./native-mutation";
import { runNativeEdit } from "./native-edit";

const identitySchema = z.object({ id: z.string().min(1) });
const commentReceiptSchema = z.object({ id: z.string().min(1), author: z.string() });
const doctorReportSchema = z.object({ has_errors: z.boolean() });

/** Fail closed for unsupported native semantics, including compound requests. */
function unsupported(message: string): never {
  throw new BdError(message, "unsupported_operation");
}

/** Validate source/target transitions before issuing any command. */
function validateTransition(issue: NativeIssue, status: string): void {
  if (!nativeCapabilities.statuses.includes(status)) unsupported(`bead-rs does not support status ${status}.`);
  if (issue.status === "closed" && status !== "open" && status !== "closed") {
    unsupported("Reopen the closed issue before changing its status.");
  }
  if (issue.status === "deferred" && status === "in_progress") {
    unsupported("Move the deferred issue to open before starting it.");
  }
}

/** One native store owns its command queue and credentials obtained by its own assignments. */
export async function createNativeStore(repositoryPath: string): Promise<BeadsStore> {
  const process = nativeProcess(repositoryPath);
  const { workspace, capabilities } = await process.qualify();
  const credentials = nativeCredentials(repositoryPath, workspace);
  let preceding: Promise<unknown> = Promise.resolve();

  /** Serialize request operations; a rejected caller must not poison the queue. */
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = preceding.then(operation, operation);
    preceding = result.then(() => undefined, () => undefined);
    return result;
  }

  /** Read an enriched record after a write; a missing result is not successful creation. */
  async function get(id: string): Promise<Bead> {
    const snapshot = await nativeSnapshot(process, id);
    const bead = snapshot.beads[0];
    if (!bead) throw new BdError(`Issue ${id} not found.`, "not_found");
    return bead;
  }

  /** Authorize only unowned, legacy self-assigned, or this store's own fenced tenure. */
  async function guards(issue: NativeIssue, actor: string): Promise<string[]> {
    if (await process.workspace() !== workspace) {
      throw new BdError("The selected workspace changed. Re-register the project before editing.", "claim_conflict");
    }
    const args = ["--if-revision", String(issue.revision)];
    if (!issue.assignee) return args;
    if (issue.assignee !== actor) {
      throw new BdError("Another actor owns this issue. Release it through its current holder before editing.", "claim_conflict");
    }
    const epoch = issue.claim_epoch ?? 0;
    if (epoch > 0) {
      const credential = await credentials.read(issue.id, actor, epoch);
      if (!credential || credential.actor !== actor || credential.epoch !== issue.claim_epoch) {
        throw new BdError("This claim was not acquired by Scotty. Release it with its original credential before editing.", "claim_conflict");
      }
      args.push("--fencing-token", String(credential.epoch));
    }
    return args;
  }

  /** Record the documented epoch readback only after our successful assignment command. */
  async function rememberAssignment(
    id: string, assignee: string | undefined, actor: string, expectedEpoch: number,
  ): Promise<void> {
    if (assignee !== actor) return;
    const issue = await readNativeIssue(process, id);
    if (issue.assignee !== actor || (issue.claim_epoch ?? 0) !== expectedEpoch) {
      throw new BdError("Ownership changed before assignment could be confirmed. Refresh the issue; do not replay the assignment.", "claim_conflict");
    }
    if (issue.claim_epoch !== undefined && issue.claim_epoch > 0) {
      await credentials.record(id, actor, issue.claim_epoch);
    }
  }

  /** Execute one lifecycle transition with current revision and legitimate ownership. */
  async function changeStatus(id: string, status: string, actor: string, reason?: string): Promise<Bead> {
    if (!nativeCapabilities.statuses.includes(status)) unsupported(`bead-rs does not support status ${status}.`);
    if (status === "closed" && !reason?.trim()) {
      throw new BdError("A close reason is required for bead-rs.", "invalid_input");
    }
    const issue = await readNativeIssue(process, id);
    validateTransition(issue, status);
    const guard = await guards(issue, actor);
    const mutation = new NativeMutation("status", id);
    if (status === "closed") {
      await mutation.run(process, ["close", id, "--reason", reason?.trim() ?? "", ...guard], actor);
    } else if (status === "open" && issue.status === "closed") {
      await mutation.run(process, ["reopen", id, ...guard], actor);
    } else if (status === "open" && issue.status === "in_progress") {
      await mutation.run(process, ["release", id, ...guard], actor);
      await mutation.after("credential", () => credentials.forget(id, actor, issue.claim_epoch ?? 0));
    } else {
      const args = ["update", id, "--status", status, ...guard];
      if (status === "in_progress" && !issue.assignee) args.push(`--assignee=${actor}`);
      await mutation.run(process, args, actor);
      if (status === "in_progress" && !issue.assignee) {
        await mutation.after("credential", () => rememberAssignment(id, actor, actor, (issue.claim_epoch ?? 0) + 1));
      }
    }
    return mutation.after("readback", () => get(id));
  }

  /** Apply a supported patch atomically, or reject it before the first write. */
  async function update(id: string, patch: UpdateInput, actor: string): Promise<Bead> {
    for (const field of Object.keys(patch)) {
      if (!capabilities.editableFields.some((allowed) => allowed === field)) {
        unsupported(field === "labels" ? "Native labels must be added or removed individually." : `bead-rs cannot edit ${field} after creation.`);
      }
    }
    nativeUpdateInputSchema.parse(patch);
    const issue = await readNativeIssue(process, id);
    if (patch.status !== undefined) validateTransition(issue, patch.status);
    if (patch.status === "closed") throw new BdError("Use the status action with a close reason.", "invalid_input");
    const specialLifecycle = patch.status === "open" && (issue.status === "closed" || issue.status === "in_progress");
    if (specialLifecycle) {
      if (Object.keys(patch).some((field) => field !== "status")) unsupported("Release or reopen separately from other edits.");
      return changeStatus(id, "open", actor);
    }
    const guard = await guards(issue, actor);
    if (patch.assignee === "" && issue.status !== "open") unsupported("Only an open assignment can be cleared; use release for in-progress work.");
    const mutation = new NativeMutation("update", id);
    let wrote = false;
    const assignee = patch.assignee ?? (patch.status === "in_progress" && !issue.assignee ? actor : undefined);
    if (Object.keys(patch).length > 0 || assignee !== undefined) {
      const args = ["update", id, ...guard];
      if (patch.status !== undefined) args.push("--status", patch.status);
      if (assignee) args.push(`--assignee=${assignee}`);
      else if (assignee === "") args.push("--clear-assignee");
      await runNativeEdit(process, args, patch, actor, mutation);
      wrote = true;
    }
    if (assignee !== undefined) {
      await mutation.after("credential", () => rememberAssignment(id, assignee, actor,
        (issue.claim_epoch ?? 0) + (issue.assignee === assignee ? 0 : 1)));
      if (issue.assignee === actor && assignee !== actor) {
        await mutation.after("credential", () => credentials.forget(id, actor, issue.claim_epoch ?? 0));
      }
    }
    return wrote ? mutation.after("readback", () => get(id)) : get(id);
  }

  /** Native metadata deltas are single commands, not revision-fenced whole-set edits.
   * The native service records their event actor as system, irrespective of BEAD_ACTOR. */
  async function labelDelta(action: "add" | "remove", id: string, label: string, actor: string): Promise<Bead> {
    nativeLabelInputSchema.parse({ label });
    if (await process.workspace() !== workspace) {
      throw new BdError("The selected workspace changed. Re-register the project before editing.", "claim_conflict");
    }
    const mutation = new NativeMutation(`label_${action}`, id);
    await mutation.run(process, ["label", action, id, `--label=${label}`], actor);
    return mutation.after("readback", () => get(id));
  }

  /** Read a whole native snapshot through the same per-store request queue. */
  function listSnapshot(): Promise<BeadsSnapshot & { beads: Bead[] }> {
    return serial(() => nativeSnapshot(process));
  }

  return {
    kind: "bead-rs",
    capabilities,
    listSnapshot,
    async list(): Promise<Bead[]> { return (await listSnapshot()).beads; },
    get(id): Promise<Bead | null> {
      return serial(async () => {
        try { return await get(id); }
        catch (error) {
          if (error instanceof BdError && error.code === "not_found") return null;
          throw error;
        }
      });
    },
    create(input: CreateInput, actor: string): Promise<Bead> {
      return serial(async () => {
        if (input.parent) unsupported("Native bead-rs has no parent-child hierarchy.");
        const mutation = new NativeMutation("create");
        let id: string;
        if (input.backlog) {
          const result = await commitNativeManifest(process, [
            { op: "create", local_id: "created", title: input.title, description: input.description,
              priority: input.priority, issue_type: input.issue_type, labels: input.labels,
              ...(input.assignee ? { assignee: input.assignee } : {}) },
            { op: "update", id: "$created", status: "deferred" },
          ], actor, mutation);
          const created = result.results.find((item) => item.local_id === "created");
          if (!created?.issue_id) throw mutation.failure("receipt", new BdError("Manifest omitted the created issue ID.", "parse_error"));
          id = created.issue_id;
        } else {
          const args = ["create", "--title", input.title, "--description", input.description,
            "--priority", String(input.priority), `--issue-type=${input.issue_type}`, "--json"];
          if (input.assignee) args.push(`--assignee=${input.assignee}`);
          for (const label of input.labels) args.push(`--label=${label}`);
          const document = await mutation.json(process, args, actor);
          id = await mutation.after("receipt", () => {
            mutation.issueId = nativeDocument(identitySchema, document).id;
            return nativeDocument(nativeIssueSchema, document).id;
          });
        }
        mutation.issueId = id;
        if (input.assignee) await mutation.after("credential", () => rememberAssignment(id, input.assignee, actor, 0));
        return mutation.after("readback", () => get(id));
      });
    },
    update(id, patch, actor): Promise<Bead> { return serial(() => update(id, patch, actor)); },
    setStatus(id, status, actor, reason): Promise<Bead> {
      return serial(() => changeStatus(id, status, actor, reason));
    },
    async remove(): Promise<never> { return unsupported("Native bead-rs does not support deletion."); },
    addComment(id, text, actor): Promise<Bead> {
      return serial(async () => {
        const mutation = new NativeMutation("comment", id);
        const document = await mutation.json(process, ["comment", "create", id, `--body=${text}`, `--actor=${actor}`, "--json"], actor);
        const receipt = await mutation.after("receipt", () => {
          mutation.receiptId = nativeDocument(identitySchema, document).id;
          return nativeDocument(commentReceiptSchema, document);
        });
        return mutation.after("readback", async () => {
          const bead = await get(id);
          if (!bead.comments.some((comment) => comment.id === receipt.id && comment.text === text && comment.author === receipt.author)) {
            throw new BdError("The created comment is absent from the current readback.", "parse_error");
          }
          return bead;
        });
      });
    },
    addDep(id, blocker, kind, actor): Promise<Bead> {
      return serial(async () => {
        if (!nativeCapabilities.dependencyTypes.includes(kind)) unsupported(`Unsupported native dependency kind: ${kind}.`);
        const mutation = new NativeMutation("dependency_add", id);
        await mutation.run(process, ["dep", "add", id, blocker, "--kind", kind], actor);
        return mutation.after("readback", () => get(id));
      });
    },
    removeDep(id, blocker, actor, kind): Promise<Bead> {
      return serial(async () => {
        const issue = await readNativeIssue(process, id);
        const edges = issue.dependencies.filter((dependency) => dependency.blocker === blocker);
        const selected = kind ?? (edges.length === 1 ? edges[0].kind : undefined);
        if (!selected || !nativeCapabilities.dependencyTypes.includes(selected)) {
          unsupported("Specify the exact native dependency kind to remove.");
        }
        const mutation = new NativeMutation("dependency_remove", id);
        await mutation.run(process, ["dep", "remove", id, blocker, "--kind", selected], actor);
        return mutation.after("readback", () => get(id));
      });
    },
    async createGate(): Promise<never> { return unsupported("Native bead-rs has no human approval gates."); },
    addLabel(id, label, actor): Promise<Bead> { return serial(() => labelDelta("add", id, label, actor)); },
    removeLabel(id, label, actor): Promise<Bead> { return serial(() => labelDelta("remove", id, label, actor)); },
    async archive(): Promise<never> { return unsupported("Atomic native archive is not supported."); },
    async doctor() {
      const report = nativeDocument(doctorReportSchema, await process.json(["doctor", "--format", "json"]));
      return { kind: "bead-rs", ok: !report.has_errors, version: (await process.run(["--version"])).trim(),
        repoPath: repositoryPath, message: report.has_errors ? "bead-rs reported workspace errors." : "Connected to bead-rs." };
    },
  };
}
