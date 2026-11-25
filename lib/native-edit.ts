import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BdError } from "./bd";
import type { NativeProcess } from "./native-process";
import type { NativeMutation } from "./native-mutation";
import type { UpdateInput } from "./schema";

/** Leave room for executable, guards and short metadata under Windows argv limits. */
const INLINE_TEXT_BYTES = 8 * 1024;
/** Native option names differ from the patch field for custom types. */
const TEXT_FIELDS = [["description", "description"], ["notes", "notes"], ["issue_type", "issue-type"]] as const;

/** Run one guarded scalar edit; large text files belong only to this request. */
export async function runNativeEdit(
  process: NativeProcess, args: string[], patch: UpdateInput, actor: string, mutation: NativeMutation,
  supportsIssueTypeFile: boolean = false,
): Promise<void> {
  const typeBytes = Buffer.byteLength(patch.issue_type ?? "", "utf8");
  if (typeBytes > INLINE_TEXT_BYTES && !supportsIssueTypeFile) {
    throw new BdError("This bead-rs executable cannot edit types larger than 8 KiB. Select a build that supports issue-type files.", "unsupported_operation");
  }
  const textBytes = typeBytes + Buffer.byteLength(patch.description ?? "", "utf8") + Buffer.byteLength(patch.notes ?? "", "utf8");
  const directory = textBytes > INLINE_TEXT_BYTES ? await fs.mkdtemp(path.join(os.tmpdir(), "scotty-edit-")) : undefined;
  let failed = false;
  try {
    if (patch.title !== undefined) args.push(`--title=${patch.title}`);
    if (patch.priority !== undefined) args.push(`--priority=${patch.priority}`, "--reason=Priority edited in Scotty");
    for (const [field, option] of TEXT_FIELDS) {
      const text = patch[field];
      if (text === undefined) continue;
      if (directory && (field !== "issue_type" || supportsIssueTypeFile)) {
        const filename = path.join(directory, `${field}.txt`);
        await fs.writeFile(filename, text, { encoding: "utf8", mode: 0o600 });
        args.push(`--${option}-file=${filename}`);
      } else args.push(`--${option}=${text}`);
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
