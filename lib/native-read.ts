import { z } from "zod";
import { BdError } from "./bd";
import type { Bead } from "./schema";
import type { BeadsSnapshot } from "./backend-contract";
import { nativeCursorArgs, type NativeProcess } from "./native-process";

/** Public native issue documents. Required fields never receive fabricated defaults. */
export const nativeIssueSchema = z.object({
  id: z.string().min(1), title: z.string(), description: z.string(), notes: z.string(),
  status: z.enum(["open", "in_progress", "deferred", "closed"]),
  effective_status: z.enum(["open", "in_progress", "deferred", "closed", "blocked"]),
  manual_blocked: z.boolean(), priority: z.number().int().min(0).max(4),
  assignee: z.string().nullable(), revision: z.number().int().positive().safe(),
  claim_epoch: z.number().int().nonnegative().safe().optional(),
  labels: z.array(z.string()), created_at: z.string(), updated_at: z.string(),
  dependencies: z.array(z.object({
    blocker: z.string(), kind: z.enum(["blocks", "relates_to", "verifies"]),
    blocker_status: z.string(), finished: z.boolean(),
  })),
  comments: z.array(z.object({
    id: z.string(), author: z.string(), body: z.string(), created_at: z.string(),
    reply_to_id: z.string().nullable().optional(), resolution_state: z.string(),
  })),
});
/** Native ownership/revision data is retained only within the adapter. */
export type NativeIssue = z.infer<typeof nativeIssueSchema>;
const nativeIssuesSchema = z.array(nativeIssueSchema);

/** Public query projections intentionally use PascalCase, not the request spelling. */
const metadataSchema = z.array(z.object({
  Id: z.string().min(1), IssueType: z.string().min(1),
  ClosedAt: z.string().nullable(), CloseReason: z.string().nullable(),
}));
const cursorSchema = z.object({
  workspace_uuid: z.string().min(1), max_sequence: z.number().int().nonnegative().safe(),
});
/** Three complete attempts bound contention without publishing a mixed snapshot. */
const SNAPSHOT_ATTEMPTS = 3;
const metadataQuery = JSON.stringify({
  version: "v1", predicates: [], sort: [],
  projection: { fields: ["id", "issue_type", "closed_at", "close_reason"] },
});
const listArgs = ["list", "--all", "--comments", "all", "--json"] as const;
const readyArgs = ["list", "--ready", "--all", "--comments", "all", "--json"] as const;
const metadataArgs = ["query", "--json", metadataQuery, "--output-json"] as const;

/** Validate external documents, retaining a stable adapter error rather than defaults. */
export function nativeDocument<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new BdError(`Invalid bead-rs output: ${parsed.error.message}`, "parse_error");
  return parsed.data;
}

/** Read a public issue document for mutation revision and ownership guards. */
export async function readNativeIssue(process: NativeProcess, id: string): Promise<NativeIssue> {
  const issue = nativeDocument(nativeIssueSchema, await process.json(["show", id, "--comments", "all", "--json"]));
  if (issue.id !== id) throw new BdError("bead-rs returned a different issue.", "parse_error");
  return issue;
}

/** Normalize only verified native fields; creation attribution is unavailable. */
function normalize(issue: NativeIssue, metadata: z.infer<typeof metadataSchema>[number]): Bead {
  const dependencies: Bead["dependencies"] = [];
  for (const dependency of issue.dependencies) {
    dependencies.push({ issue_id: issue.id, depends_on_id: dependency.blocker, type: dependency.kind });
  }
  const comments: Bead["comments"] = [];
  for (const comment of issue.comments) {
    comments.push({ id: comment.id, issue_id: issue.id, author: comment.author,
      text: comment.body, created_at: comment.created_at,
      reply_to_id: comment.reply_to_id ?? undefined, resolution_state: comment.resolution_state });
  }
  return {
    id: issue.id, title: issue.title, description: issue.description, notes: issue.notes,
    design: "", acceptance_criteria: "", status: issue.effective_status, base_status: issue.status,
    priority: issue.priority, issue_type: metadata.IssueType, assignee: issue.assignee ?? "",
    created_by: "", created_at: issue.created_at, updated_at: issue.updated_at,
    closed_at: metadata.ClosedAt, close_reason: metadata.CloseReason, labels: issue.labels,
    dependencies, comments,
  };
}

/** Join public records, metadata and readiness inside a stable workspace event cursor. */
export async function nativeSnapshot(process: NativeProcess, id?: string): Promise<BeadsSnapshot & { beads: Bead[] }> {
  for (let attempt = 0; attempt < SNAPSHOT_ATTEMPTS; attempt += 1) {
    const before = nativeDocument(cursorSchema, await process.json(nativeCursorArgs));
    const issues = id === undefined
      ? nativeDocument(nativeIssuesSchema, await process.json(listArgs))
      : [await readNativeIssue(process, id)];
    const metadata = nativeDocument(metadataSchema, await process.json(metadataArgs));
    const ready = nativeDocument(nativeIssuesSchema, await process.json(readyArgs));
    const after = nativeDocument(cursorSchema, await process.json(nativeCursorArgs));
    if (before.workspace_uuid !== after.workspace_uuid || before.max_sequence !== after.max_sequence) continue;

    const metadataById = new Map<string, z.infer<typeof metadataSchema>[number]>();
    for (const item of metadata) {
      if (metadataById.has(item.Id)) throw new BdError("Duplicate bead-rs metadata ID.", "parse_error");
      metadataById.set(item.Id, item);
    }
    const readyIds: string[] = [];
    const seenReady = new Set<string>();
    for (const issue of ready) {
      if (seenReady.has(issue.id) || !metadataById.has(issue.id)) {
        throw new BdError("Invalid bead-rs ready frontier.", "parse_error");
      }
      seenReady.add(issue.id);
      readyIds.push(issue.id);
    }
    const beads: Bead[] = [];
    for (const issue of issues) {
      const item = metadataById.get(issue.id);
      if (!item) throw new BdError("Missing metadata or duplicate bead-rs issue.", "parse_error");
      // Consume each row once, detecting duplicate issues without a second ID index.
      metadataById.delete(issue.id);
      beads.push(normalize(issue, item));
    }
    if (id === undefined && metadataById.size !== 0) {
      throw new BdError("bead-rs list and metadata IDs disagree.", "parse_error");
    }
    return { beads, readyIds };
  }
  throw new BdError("The workspace changed during each read. Retry when writes settle.", "snapshot_conflict");
}
