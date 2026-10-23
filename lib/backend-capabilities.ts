import type { BackendCapabilities, BackendOperation } from "./backend-contract";
import { BdError } from "./bd";
import { BEAD_STATUSES, BD_DEP_TYPES } from "./schema";

/** Original bd/demo features remain available when adding a native project. */
export const originalCapabilities: BackendCapabilities = {
  operations: ["create", "comment", "dependencies", "delete", "parent", "gate", "archive", "refine", "attachments", "publish"],
  editableFields: ["title", "description", "priority", "issue_type", "status", "assignee", "labels", "parent"],
  dependencyTypes: BD_DEP_TYPES,
  statuses: BEAD_STATUSES,
  closeReason: "optional",
  attribution: "available",
};

/** The qualified native-v1 public API cannot represent the omitted operations. */
export const nativeCapabilities: BackendCapabilities = {
  operations: ["create", "comment", "dependencies", "label-delta"],
  editableFields: ["status", "assignee"],
  dependencyTypes: ["blocks", "relates_to", "verifies"],
  statuses: ["open", "in_progress", "blocked", "deferred", "closed"],
  closeReason: "required",
  attribution: "unavailable",
};

/** Reject an unavailable operation before its route performs any side effect. */
export function requireOperation(
  store: { readonly capabilities?: BackendCapabilities },
  operation: BackendOperation,
): void {
  if (store.capabilities && !store.capabilities.operations.includes(operation)) {
    throw new BdError(`This backend does not support ${operation}.`, "unsupported_operation");
  }
}

/** Original activity analytics require creation authorship absent from native documents. */
export function requireAttribution(store: { readonly capabilities?: BackendCapabilities }): void {
  if (store.capabilities?.attribution === "unavailable") {
    throw new BdError("Creation-attribution analytics are unavailable for bead-rs.", "unsupported_operation");
  }
}

/** Inspect native PATCH keys before schema parsing can strip unsupported fields. */
export function requireEditableFields(capabilities: BackendCapabilities, input: unknown): void {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return;
  for (const field of Object.keys(input)) {
    if (!capabilities.editableFields.some((allowed) => allowed === field)) {
      throw new BdError(field === "labels" ? "Native labels must be added or removed individually." : `This backend cannot edit ${field} after creation.`, "unsupported_operation");
    }
  }
}
