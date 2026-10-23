import "server-only";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { BdError } from "./bd";

/** Public bead-rs workspace marker, not its private database or checkpoint format. */
const nativeMarker = z.object({
  uuid: z.string().min(1), prefix: z.string().min(1), version: z.literal(1),
});

/** Refuse original CLI discovery on a native workspace without changing the selected backend. */
export function requireBdWorkspace(repositoryPath: string): void {
  const filename = path.join(repositoryPath, ".beads", "config.json");
  let content: string;
  try { content = fs.readFileSync(filename, "utf8"); }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw new BdError("Cannot inspect this folder's backend marker. Check .beads/config.json before opening it.", "backend_mismatch");
  }
  let marker: unknown;
  try { marker = JSON.parse(content); }
  catch { throw new BdError("This folder has an invalid .beads/config.json backend marker. Check it before opening it.", "backend_mismatch"); }
  if (nativeMarker.safeParse(marker).success) {
    throw new BdError("This folder is a bead-rs workspace. Add it with the bead-rs backend; the original bd CLI was not invoked.", "backend_mismatch");
  }
}
