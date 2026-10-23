import "server-only";
import { BdError } from "./bd";
import type { NativeMutationOutcome } from "./backend-contract";
import { parseNativeJson, type NativeProcess } from "./native-process";

type Phase = NativeMutationOutcome["phase"];

/** Preserve write knowledge when a later receipt, read or local cleanup fails. */
export class NativeMutationError extends BdError {
  constructor(readonly outcome: NativeMutationOutcome, cause: unknown) {
    super(`${outcome.state === "committed" ? "The write succeeded" : "The write outcome is uncertain"}${outcome.issueId ? ` for ${outcome.issueId}` : ""}. ${outcome.state === "committed" ? `The ${outcome.phase} step could not be completed. ` : ""}Do not resubmit. Refresh and reconcile through read-only checks.`,
      outcome.state === "committed" ? "mutation_committed" : "mutation_uncertain");
    this.name = "NativeMutationError";
    this.cause = cause;
  }
}

/** Per-request outcome state, set immediately after the public command exits successfully. */
export class NativeMutation {
  private state: NativeMutationOutcome["state"] = "uncertain";
  issueId?: string;
  receiptId?: string;
  constructor(readonly operation: string, issueId?: string) { this.issueId = issueId; }

  /** Keep the first classified failure, including any identity already returned by the CLI. */
  failure(phase: Phase, cause: unknown): NativeMutationError {
    return cause instanceof NativeMutationError ? cause : new NativeMutationError({
      state: this.state, operation: this.operation, issueId: this.issueId, receiptId: this.receiptId, phase,
    }, cause);
  }

  /** The successful exit is the commit boundary; a later parser cannot erase that knowledge. */
  async run(process: NativeProcess, args: readonly string[], actor: string): Promise<string> {
    let output: string;
    try { output = await process.run(args, actor); }
    catch (error) {
      // These errors denote a refused claim or a command that could not start.
      if (error instanceof BdError && (error.code === "claim_conflict" || error.code === "native_unavailable")) throw error;
      throw this.failure("command", error);
    }
    this.state = "committed";
    return output;
  }

  /** JSON decoding follows the commit boundary, so malformed output still blocks replay. */
  async json(process: NativeProcess, args: readonly string[], actor: string): Promise<unknown> {
    const output = await this.run(process, args, actor);
    return this.after("receipt", () => parseNativeJson(output));
  }

  /** Attach outcome knowledge to read-only reconciliation or app-local credential/cleanup failures. */
  async after<T>(phase: Phase, operation: () => T | Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) { throw this.failure(phase, error); }
  }
}
