import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { BdError } from "./bd";

/** Native commands are bounded; exhaustion is an error, never an empty result. */
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 60_000;
const capabilitiesArgs = ["capabilities"] as const;
/** Shared immutable command input; every invocation still obtains a fresh native cursor. */
export const nativeCursorArgs = ["changes", "--snapshot", "--json"] as const;
const executeFile = promisify(execFile);
const processFailureSchema = z.object({
  code: z.union([z.number(), z.string()]).optional(),
  stderr: z.string().optional(),
  message: z.string().optional(),
}).passthrough();
const workspaceSchema = z.object({
  workspace_uuid: z.string().min(1), max_sequence: z.number().int().nonnegative().safe(),
});
const requiredCommands = ["list", "show", "query", "changes", "create", "comment", "manifest", "update", "close", "reopen", "release", "dep", "label"];
const requiredDependencyKinds = ["blocks", "relates_to", "verifies"];

/** Validated fields needed to qualify the native command/document contract. */
const capabilitySchema = z.object({
  implementation: z.literal("bead-rs"),
  contract: z.literal("native-v1"),
  version: z.string(),
  commands: z.array(z.string()),
  dependency_kinds: z.array(z.string()),
  agent_ergonomics: z.object({
    version: z.literal(1),
    issue_documents: z.object({
      list_json: z.literal("array"),
      show_json: z.literal("object"),
      create_json: z.literal("object"),
    }),
  }),
});

/** Native process owner, bound to one selected folder and executable. */
export interface NativeProcess {
  readonly repositoryPath: string;
  run(args: readonly string[], actor?: string): Promise<string>;
  json(args: readonly string[], actor?: string): Promise<unknown>;
  qualify(): Promise<string>;
  workspace(): Promise<string>;
}

/** Validate JSON without accepting bd envelopes or coercing malformed output. */
export function parseNativeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new BdError("bead-rs returned invalid JSON.", "parse_error");
  }
}

/** Bind native commands to cwd; never search past a missing/foreign .beads. */
export function nativeProcess(repositoryPath: string): NativeProcess {
  const binary = process.env.BEAD_BIN || "bead";

  /** Invoke the public CLI without a shell or retries, including on uncertain writes. */
  async function run(args: readonly string[], actor?: string): Promise<string> {
    if (!fs.existsSync(path.join(repositoryPath, ".beads"))) {
      throw new BdError(`No .beads directory in ${repositoryPath}. Initialize it with bead-rs first.`, "native_unavailable");
    }
    try {
      const { stdout } = await executeFile(binary, args, {
        cwd: repositoryPath,
        maxBuffer: MAX_OUTPUT_BYTES,
        timeout: COMMAND_TIMEOUT_MS,
        env: { ...process.env, ...(actor ? { BEAD_ACTOR: actor } : {}) },
      });
      return stdout;
    } catch (error: unknown) {
      const failure = processFailureSchema.safeParse(error);
      const detail = failure.success ? failure.data : {};
      const message = detail.stderr?.trim() || detail.message || "bead-rs command failed";
      if (detail.code === "ENOENT") {
        throw new BdError(`Cannot run ${binary}. Set BEAD_BIN to the supported bead-rs executable.`, "native_unavailable");
      }
      const code = detail.code === 3 && args[0] === "show" && /issue/i.test(message)
        ? "not_found" : detail.code === 4 ? "claim_conflict" : "native_command_failed";
      throw new BdError(message, code);
    }
  }

  /** Read one complete public JSON document; callers validate its schema. */
  async function json(args: readonly string[], actor?: string): Promise<unknown> {
    return parseNativeJson(await run(args, actor));
  }

  /** Qualify identity before store use; actual reads also validate workspace identity. */
  async function qualify(): Promise<string> {
    const result = capabilitySchema.safeParse(await json(capabilitiesArgs));
    if (!result.success || requiredCommands.some((command) => !result.data.commands.includes(command))
      || requiredDependencyKinds.some((kind) => !result.data.dependency_kinds.includes(kind))) {
      throw new BdError("Unsupported bead-rs contract. Use the qualified 0.3.0 native-v1 build; v0.2.6 is not supported.", "unsupported_version");
    }
    // No --skip-foreign-workspace flag is used: native discovery must refuse a
    // foreign store rather than silently operating on an ancestor's database.
    return workspace();
  }

  /** Read the public identity before using an issued credential in this workspace. */
  async function workspace(): Promise<string> {
    const result = workspaceSchema.safeParse(await json(nativeCursorArgs));
    if (!result.success) throw new BdError("Invalid bead-rs workspace snapshot.", "parse_error");
    return result.data.workspace_uuid;
  }

  return { repositoryPath, run, json, qualify, workspace };
}
