import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import type { NativeProcess } from "./native-process";
import { NativeMutation } from "./native-mutation";
import { nativeDocument } from "./native-read";

/** Closed native-v1 operation variants; fencing/reopen/release have no representation. */
export type NativeOperation =
  | { readonly op: "create"; readonly local_id: string; readonly title: string;
      readonly description: string; readonly priority: number; readonly issue_type: string;
      readonly labels: readonly string[]; readonly assignee?: string }
  | { readonly op: "update"; readonly id: string; readonly status?: string;
      readonly assignee?: string; readonly clear_assignee?: boolean;
      readonly notes?: string; readonly if_revision?: number };

/** Successful commit reports local-reference resolutions through issue_id. */
const resultSchema = z.object({
  committed: z.literal(true), dry_run: z.literal(false), manifest_version: z.literal(1),
  results: z.array(z.object({ local_id: z.string().nullable().optional(), issue_id: z.string().optional() })),
});
/** Verified commit receipt; issue IDs resolve manifest-local references after the transaction. */
export type NativeManifestResult = z.infer<typeof resultSchema>;

/** Publish one atomic operation set, then remove its request-owned temporary file. */
export async function commitNativeManifest(
  process: NativeProcess, operations: readonly NativeOperation[], actor: string, mutation: NativeMutation,
): Promise<NativeManifestResult> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "scotty-native-"));
  let failed = false;
  try {
    const filename = path.join(directory, "manifest.json");
    await fs.writeFile(filename, JSON.stringify({ manifest_version: 1, operations }), { mode: 0o600 });
    const value = await mutation.json(process, ["manifest", "commit", "--input", filename, "--format", "json"], actor);
    return await mutation.after("receipt", () => {
      const receipt = nativeDocument(resultSchema, value);
      mutation.issueId ??= receipt.results.find((result) => result.local_id === "created")?.issue_id;
      return receipt;
    });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try { await fs.rm(directory, { recursive: true, force: true }); }
    catch (error) { if (!failed) throw mutation.failure("cleanup", error); }
  }
}
