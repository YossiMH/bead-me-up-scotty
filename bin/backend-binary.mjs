import fs from "node:fs";
import path from "node:path";

/** Resolve an explicit CLI selection relative to the caller, before Next changes cwd. */
export function beadBinaryOptions(argv, cwd) {
  const args = [];
  let beadBin;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    let value;
    if (argument === "--bead-bin") {
      value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error("--bead-bin requires an executable path.");
    } else if (argument.startsWith("--bead-bin=")) {
      value = argument.slice("--bead-bin=".length);
      if (!value) throw new Error("--bead-bin requires an executable path.");
    } else {
      args.push(argument);
      continue;
    }
    const filename = path.resolve(cwd, value);
    try {
      if (!fs.statSync(filename).isFile()) throw new Error("Not a file");
      fs.accessSync(filename, fs.constants.X_OK);
    } catch {
      throw new Error(`Cannot use bead-rs executable: ${filename}`);
    }
    beadBin = filename;
  }
  return { args, beadBin };
}
