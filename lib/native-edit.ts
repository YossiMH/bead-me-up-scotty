import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { NativeProcess } from "./native-process";
import type { NativeMutation } from "./native-mutation";
import type { UpdateInput } from "./schema";

/** Leave room for executable, guards and short metadata under Windows argv limits. */
const INLINE_TEXT_BYTES = 8 * 1024;

/** Run one guarded scalar edit; large text files belong only to this request. */
export async function runNativeEdit(
  process: NativeProcess, args: string[], patch: UpdateInput, actor: string, mutation: NativeMutation,
): Promise<void> {
  const textBytes = Buffer.byteLength(patch.description ?? "", "utf8") + Buffer.byteLength(patch.notes ?? "", "utf8");
  const directory = textBytes > INLINE_TEXT_BYTES ? await fs.mkdtemp(path.join(os.tmpdir(), "scotty-edit-")) : undefined;
  let failed = false;
  try {
    if (patch.title !== undefined) args.push(`--title=${patch.title}`);
    if (patch.issue_type !== undefined) args.push(`--issue-type=${patch.issue_type}`);
    if (patch.priority !== undefined) args.push(`--priority=${patch.priority}`, "--reason=Priority edited in Scotty");
    for (const field of ["description", "notes"] as const) {
      const text = patch[field];
      if (text === undefined) continue;
      if (directory) {
        const filename = path.join(directory, `${field}.txt`);
        await fs.writeFile(filename, text, { encoding: "utf8", mode: 0o600 });
        args.push(`--${field}-file=${filename}`);
      } else args.push(`--${field}=${text}`);
    }
    await mutation.run(process, args, actor);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (directory) {
      try { await fs.rm(directory, { recursive: true, force: true }); }
      catch (error) { if (!failed) throw mutation.failure("cleanup", error); }
    }
  }
}
