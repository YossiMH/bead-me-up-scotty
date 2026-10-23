import type { Bead } from "./schema";

/** Persisted project selection. An absent backend retains original bd behavior. */
export type ProjectBackend = "bd" | "bead-rs";

/** Demo is an explicit project, never a fallback for an unavailable CLI. */
export type BackendKind = ProjectBackend | "demo";

/** Operations exposed by the API and its editing controls. */
export type BackendOperation =
  | "create"
  | "comment"
  | "dependencies"
  | "label-delta"
  | "delete"
  | "parent"
  | "gate"
  | "archive"
  | "refine"
  | "attachments"
  | "publish";

/** Fields accepted by PATCH. Creation has a separate immutable-field contract. */
export type EditableBeadField =
  | "title"
  | "description"
  | "priority"
  | "issue_type"
  | "status"
  | "assignee"
  | "labels"
  | "parent";

/**
 * Serialized in list-response meta.capabilities. Membership grants an operation;
 * an empty collection grants nothing. The server must enforce the same contract.
 * Missing metadata from an older bd server preserves existing client behavior.
 */
export interface BackendCapabilities {
  /** Complete supported operation names, not hints to attempt unsupported writes. */
  readonly operations: readonly BackendOperation[];
  /** Fields editable after creation; native title/description/type/priority are immutable. */
  readonly editableFields: readonly EditableBeadField[];
  /** Exact backend spellings; native relates_to is not bd relates-to. */
  readonly dependencyTypes: readonly string[];
  /** Status actions the backend can represent without a partial multi-write transition. */
  readonly statuses: readonly string[];
  /** Native close rejects a missing or whitespace-only reason before any mutation. */
  readonly closeReason: "required" | "optional";
  /** Whether issue creation attribution exists, independently of comment authorship. */
  readonly attribution: "available" | "unavailable";
}

/**
 * One coherent native read, returned by BeadsStore.listSnapshot(). A native
 * response uses these IDs for readiness rather than open/unblocked inference.
 * Metadata, issue records and readiness must describe the same relevant state.
 */
export interface BeadsSnapshot {
  readonly beads: readonly Bead[];
  readonly readyIds: readonly string[];
}

/** Additive fields in the existing /api/p/:projectId/beads response meta. */
export interface BackendMetadata {
  readonly kind: BackendKind;
  readonly capabilities: BackendCapabilities;
  /** Present for bead-rs, including an empty frontier; absent means legacy inference. */
  readonly readyIds?: readonly string[];
}

/** A native write must not be replayed merely because its response could not be read. */
export interface NativeMutationOutcome {
  readonly state: "committed" | "uncertain";
  readonly operation: string;
  readonly issueId?: string;
  readonly receiptId?: string;
  readonly phase: "command" | "receipt" | "readback" | "credential" | "cleanup";
}
