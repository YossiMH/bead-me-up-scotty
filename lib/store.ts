import "server-only";
import type { Bead, CreateInput, UpdateInput, DepType } from "./schema";
import { getProject, touchProject, DEMO_PROJECT, ConfigError } from "./config";
import { createBdStore, isBdAvailable } from "./bd";
import { demoStore } from "./demo-store";
import { createNativeStore } from "./native-store";
import { originalCapabilities } from "./backend-capabilities";
import type { BackendCapabilities, BackendKind, BeadsSnapshot } from "./backend-contract";
import { requireBdWorkspace } from "./backend-workspace";

/**
 * Storage abstraction. Explicit project selection, with no availability fallback:
 *  - BdStore  → shells out to the `bd` CLI (source of truth).
 *  - NativeStore → bead-rs public native-v1 commands.
 *  - DemoStore → in-memory, selected only by the Demo project.
 */
export interface DoctorInfo {
  kind: BackendKind;
  ok: boolean;
  version?: string;
  repoPath: string;
  message: string;
}

export interface BeadsStore {
  kind: BackendKind;
  /** Original stores may omit this internally; getStore supplies their unchanged features. */
  capabilities?: BackendCapabilities;
  /** Native coherent record/metadata/readiness read; absent on original stores. */
  listSnapshot?(): Promise<BeadsSnapshot>;
  list(): Promise<Bead[]>;
  get(id: string): Promise<Bead | null>;
  create(input: CreateInput, actor: string): Promise<Bead>;
  update(id: string, patch: UpdateInput, actor: string): Promise<Bead>;
  /**
   * `reason` is only meaningful when closing — bd records it via
   * `bd close --reason`, and there is no way to attach one after the fact.
   */
  setStatus(id: string, status: string, actor: string, reason?: string): Promise<Bead>;
  remove(id: string, actor: string): Promise<void>;
  addComment(id: string, text: string, actor: string): Promise<Bead>;
  addDep(id: string, dependsOnId: string, type: DepType, actor: string): Promise<Bead>;
  removeDep(id: string, dependsOnId: string, actor: string, type?: DepType): Promise<Bead>;
  /** Create a human approval gate that blocks `blocks` (`bd gate create --type human`). */
  createGate(blocks: string, reason: string | undefined, actor: string): Promise<Bead>;
  /** Explicit native label intent; not a replacement inferred from a previous set. */
  addLabel?(id: string, label: string, actor: string): Promise<Bead>;
  removeLabel(id: string, label: string, actor: string): Promise<Bead>;
  archive(id: string, actor: string): Promise<Bead>;
  doctor(): Promise<DoctorInfo>;
}

// One store per project id. Demo always maps to the shared in-memory store.
const stores = new Map<string, Promise<BeadsStore>>();
const demoWithCapabilities: BeadsStore = { ...demoStore, capabilities: originalCapabilities };

/** Resolve explicit project ownership; failed qualification never falls back to another store. */
export async function getStore(projectId: string): Promise<BeadsStore> {
  if (projectId === DEMO_PROJECT.id) return demoWithCapabilities;

  const cached = stores.get(projectId);
  if (cached) return cached;

  const project = getProject(projectId);
  if (!project || project.path === null) {
    throw new ConfigError(`Unknown project: ${projectId}`, "unknown_project");
  }
  // Cache the in-flight construction too: parallel first requests must share
  // one native command queue and one assignment-credential owner.
  const pending = (async (): Promise<BeadsStore> => {
    let store: BeadsStore;
    if (project.backend === "bead-rs") store = await createNativeStore(project.path);
    else {
      requireBdWorkspace(project.path);
      if (!(await isBdAvailable(project.path))) {
        throw new ConfigError(
          `bd is not available for "${project.name}" (${project.path}). ` +
            `Check that bd is installed and the folder still contains a .beads directory.`,
          "bd_unavailable",
        );
      }
      store = { ...createBdStore(project.path), capabilities: originalCapabilities };
    }
    touchProject(projectId);
    return store;
  })();
  stores.set(projectId, pending);
  try { return await pending; }
  catch (error) {
    if (stores.get(projectId) === pending) stores.delete(projectId);
    throw error;
  }
}

/** Reset cached store(s) — one project, or all when no id is given. */
export function resetStore(projectId?: string) {
  if (projectId) stores.delete(projectId);
  else stores.clear();
}
