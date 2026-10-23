import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { BdError } from "./bd";

/** Persisted provenance from an assignment issued and confirmed by this application. */
const credentialSchema = z.object({
  version: z.literal(1),
  workspace: z.string().min(1),
  repository: z.string().min(1),
  issue: z.string().min(1),
  actor: z.string().min(1),
  epoch: z.number().int().positive().safe(),
}).strict();
type Credential = z.infer<typeof credentialSchema>;

/** App-local provenance store; only confirmed assignments may be recorded. */
export interface NativeCredentials {
  read(issue: string, actor: string, epoch: number): Promise<Credential | undefined>;
  record(issue: string, actor: string, epoch: number): Promise<void>;
  forget(issue: string, actor: string, epoch: number): Promise<void>;
}

/** Bind issued credentials to both the selected folder and its native workspace UUID. */
export function nativeCredentials(repository: string, workspace: string): NativeCredentials {
  const root = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
    "bead-me-up-scotty", "native-claims");
  const directory = path.join(root, createHash("sha256").update(JSON.stringify([repository, workspace])).digest("hex"));

  /** A tenure owns its filename, so older completions cannot replace or erase newer claims. */
  function filename(issue: string, actor: string, epoch: number): string {
    return path.join(directory, `${createHash("sha256").update(JSON.stringify([issue, actor, epoch])).digest("hex")}.json`);
  }

  /** Missing provenance is not authority; corrupt/unreadable provenance is an explicit failure. */
  async function read(issue: string, actor: string, epoch: number): Promise<Credential | undefined> {
    let text: string;
    try { text = await fs.readFile(filename(issue, actor, epoch), "utf8"); }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
      throw new BdError("Cannot read Scotty's issued claim credential. Check the app configuration directory.", "claim_conflict");
    }
    let value: unknown;
    try { value = JSON.parse(text); }
    catch { throw new BdError("Scotty's issued claim credential is invalid.", "claim_conflict"); }
    const result = credentialSchema.safeParse(value);
    if (!result.success || result.data.workspace !== workspace || result.data.repository !== repository || result.data.issue !== issue || result.data.actor !== actor || result.data.epoch !== epoch) {
      throw new BdError("Scotty's issued claim credential does not match this workspace.", "claim_conflict");
    }
    return result.data;
  }

  /** Atomically retain confirmed provenance outside the task store, with owner-only new files. */
  async function record(issue: string, actor: string, epoch: number): Promise<void> {
    const temporary = path.join(directory, `${randomUUID()}.tmp`);
    try {
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      await fs.writeFile(temporary, JSON.stringify({ version: 1, workspace, repository, issue, actor, epoch }), { mode: 0o600, flag: "wx" });
      await fs.rename(temporary, filename(issue, actor, epoch));
    } catch {
      throw new BdError("The assignment succeeded, but Scotty could not retain its claim credential. Refresh and use the native CLI to reconcile; do not replay the assignment.", "claim_conflict");
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }

  /** A released/reassigned tenure no longer grants this application mutation authority. */
  async function forget(issue: string, actor: string, epoch: number): Promise<void> {
    await fs.rm(filename(issue, actor, epoch), { force: true });
  }

  return { read, record, forget };
}
