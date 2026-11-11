import type { BackendKind, BackendCapabilities, ProjectBackend, NativeMutationOutcome } from "./backend-contract";
import type { Bead, CreateInput, UpdateInput, DepType } from "./schema";
import type { UpdateStatus, UpdateResult, UpdateChannel, UpdateTarget } from "./update-types";

export interface Meta {
  /** Absent only for older original-backend servers. */
  capabilities?: BackendCapabilities;
  /** Native authoritative frontier; an empty array means no ready work. */
  readyIds?: readonly string[];
  kind: BackendKind;
  humanActor: string;
  humanAllowlist: string[];
  pollIntervalMs: number;
  gamification?: boolean;
  /** Viewer mode (SCOTTY_READ_ONLY): the server refuses writes; the UI hides them. */
  readOnly?: boolean;
  /** Label prefix (SCOTTY_LANE_PREFIX) that partitions work into Focus-view lane chips. */
  lanePrefix?: string | null;
}
export interface BeadsResponse {
  beads: Bead[];
  meta: Meta;
}

export interface ActivityItem {
  id: string;
  issueId: string;
  title: string;
  actor: string;
  origin: "human" | "agent";
  action: string;
  detail?: string;
  at: string;
}
export interface ActivityResponse {
  items: ActivityItem[];
}

export interface InsightsData {
  days: number;
  throughput: { date: string; human: number; agent: number; total: number }[];
  createdClosed: { date: string; created: number; closed: number }[];
  cycle: {
    overall: { p50: number; p90: number; count: number };
    human: { p50: number; p90: number; count: number };
    agent: { p50: number; p90: number; count: number };
  };
  aging: { id: string; title: string; days: number; origin: "human" | "agent" }[];
  columns: { id: string; name: string; color: string; count: number }[];
  hasEvents: boolean;
}

export interface AssistResult {
  description: string;
  acceptance: string;
  labels: string[];
  duplicates: { id: string; title: string; reason: string }[];
}

export interface ActorStat {
  actor: string;
  origin: "human" | "agent";
  xp: number;
  closed: number;
  currentStreak: number;
  longestStreak: number;
}
export interface Badge {
  key: string;
  label: string;
  description: string;
  earned: boolean;
}
export interface GamificationData {
  actors: ActorStat[];
  totalXp: number;
  totalClosed: number;
  you: ActorStat & { level: number; intoLevel: number; span: number; progress: number; badges: Badge[] };
}

export interface ProjectInfo {
  backend?: ProjectBackend;
  id: string;
  name: string;
  path: string | null;
  addedAt?: string;
  lastOpened?: string;
  hasBeads: boolean;
}
export interface ProjectsResponse {
  projects: ProjectInfo[];
}

export interface DoctorResponse {
  kind: BackendKind;
  ok: boolean;
  version?: string;
  repoPath: string;
  message: string;
  project: { id: string; name: string; path: string | null } | null;
  config: {
    humanActor: string;
    humanAllowlist: string[];
    pollIntervalMs: number;
  };
}

export interface FsEntry {
  name: string;
  path: string;
  hasBeads: boolean;
}
export interface FsResponse {
  path: string;
  parent: string | null;
  home: string;
  hasBeads: boolean;
  entries: FsEntry[];
}
// Self-update wire types live in a shared, non-server-only module so the client
// and lib/self-update.ts can't drift apart. Re-exported here for existing callers.
export type { UpdateStatus, UpdateStep, UpdateResult } from "./update-types";

/**
 * An error from the scotty API that preserves the server's machine-stable
 * `code` and any raw `detail`. The plain `Error` thrown before this dropped
 * both, so the UI had nothing to key off but the message string.
 */
export class ApiError extends Error {
  code?: string;
  detail?: string;
  status: number;
  outcome?: NativeMutationOutcome;
  constructor(message: string, status: number, code?: string, detail?: string, outcome?: NativeMutationOutcome) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.outcome = outcome;
  }
}

/** Retain the commit boundary separately from whether a fresh record was returned. */
export function nativeMutationOutcome(error: unknown): NativeMutationOutcome | undefined {
  return error instanceof ApiError ? error.outcome : undefined;
}

/** Receipt IDs identify comments; matching text alone cannot prove a submission succeeded. */
export function mutationReadbackMatches(outcome: NativeMutationOutcome, bead: Bead): boolean {
  if (outcome.state !== "committed" || !outcome.issueId || bead.id !== outcome.issueId) return false;
  if (outcome.operation === "create") return true;
  return outcome.operation === "comment" && !!outcome.receiptId &&
    (bead.comments ?? []).some((comment) => comment.id === outcome.receiptId);
}

/** Reconcile a scalar edit by its requested values, without claiming an audit receipt. */
export function editReadbackMatches(patch: UpdateInput, bead: Bead): boolean {
  if (patch.labels !== undefined || patch.parent !== undefined) return false;
  const fields = ["title", "description", "notes", "priority", "issue_type", "status", "assignee"] as const;
  return fields.some((field) => patch[field] !== undefined) && fields.every((field) =>
    patch[field] === undefined || patch[field] === bead[field]);
}

/** A failed follow-up must not invite replay of a committed or uncertain write. */
export function mutationOutcomeText(outcome: NativeMutationOutcome): string {
  const identity = outcome.issueId ? ` for ${outcome.issueId}` : "";
  return outcome.state === "committed"
    ? `The ${outcome.operation} write${identity} committed, but its current details could not be verified. Do not resubmit; refresh to reconcile.`
    : `The ${outcome.operation} outcome${identity} is unknown. It may have committed. Do not resubmit; refresh and check the current records.`;
}

/** Enables conservative transport handling only on native mutation requests. */
type NativeRequest = Pick<NativeMutationOutcome, "operation" | "issueId">;

async function request<T>(url: string, init?: RequestInit, nativeMutation?: NativeRequest): Promise<T> {
  const uncertain = (status: number) => {
    const outcome: NativeMutationOutcome = { ...nativeMutation!, state: "uncertain", phase: "command" };
    return new ApiError(mutationOutcomeText(outcome), status, "mutation_uncertain", undefined, outcome);
  };
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (error) {
    if (nativeMutation) throw uncertain(0);
    throw error;
  }
  let body;
  try { body = await res.json(); }
  catch {
    if (nativeMutation) throw uncertain(res.status);
    body = {};
  }
  if (nativeMutation && (!body || typeof body !== "object")) throw uncertain(res.status);
  if (!res.ok) {
    const b = body as { error?: string; code?: string; detail?: string; outcome?: NativeMutationOutcome };
    if (nativeMutation && !b.outcome && res.status >= 500) throw uncertain(res.status);
    throw new ApiError(
      b.error || `Request failed (${res.status})`,
      res.status,
      b.code,
      b.detail,
      b.outcome,
    );
  }
  if (nativeMutation && (!body || typeof body.id !== "string" || !body.id ||
      (nativeMutation.issueId && body.id !== nativeMutation.issueId))) throw uncertain(res.status);
  return body as T;
}

const enc = encodeURIComponent;
const base = (projectId: string) => `/api/p/${enc(projectId)}`;

export const api = {
  viewerMode: () => request<{ readOnly: boolean }>("/api/viewer-mode", { cache: "no-store" }),
  setViewerMode: (readOnly: boolean) => request<{ readOnly: boolean }>("/api/viewer-mode", {
    method: "PUT", body: JSON.stringify({ readOnly }),
  }),
  list: (projectId: string) => request<BeadsResponse>(`${base(projectId)}/beads`),
  get: (projectId: string, id: string) => request<Bead>(`${base(projectId)}/beads/${enc(id)}`),
  create: (projectId: string, input: CreateInput, native = false) =>
    request<Bead>(`${base(projectId)}/beads`, { method: "POST", body: JSON.stringify(input) }, native ? { operation: "create" } : undefined),
  update: (projectId: string, id: string, patch: UpdateInput, native = false) =>
    request<Bead>(`${base(projectId)}/beads/${enc(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }, native ? { operation: "update", issueId: id } : undefined),
  setStatus: (projectId: string, id: string, status: string, reason?: string) =>
    request<Bead>(`${base(projectId)}/beads/${enc(id)}/status`, {
      method: "POST",
      body: JSON.stringify({ status, reason }),
    }),
  remove: (projectId: string, id: string) =>
    request<{ deleted: string }>(`${base(projectId)}/beads/${enc(id)}`, { method: "DELETE" }),
  addComment: (projectId: string, id: string, text: string, native = false) =>
    request<Bead>(`${base(projectId)}/beads/${enc(id)}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }, native ? { operation: "comment", issueId: id } : undefined),
  labelDelta: (projectId: string, id: string, label: string, action: "add" | "remove") =>
    request<Bead>(`${base(projectId)}/beads/${enc(id)}/labels`, {
      method: action === "add" ? "POST" : "DELETE", body: JSON.stringify({ label }),
    }, { operation: `label_${action}`, issueId: id }),
  addDep: (projectId: string, id: string, depends_on_id: string, type: DepType) =>
    request<Bead>(`${base(projectId)}/beads/${enc(id)}/deps`, {
      method: "POST",
      body: JSON.stringify({ depends_on_id, type }),
    }),
  removeDep: (projectId: string, id: string, depends_on_id: string, type?: string) =>
    request<Bead>(`${base(projectId)}/beads/${enc(id)}/deps`, {
      method: "DELETE",
      body: JSON.stringify({ depends_on_id, type }),
    }),
  createGate: (projectId: string, id: string, reason?: string) =>
    request<Bead>(`${base(projectId)}/beads/${enc(id)}/gate`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  archive: (projectId: string, id: string) =>
    request<Bead>(`${base(projectId)}/beads/${enc(id)}/archive`, { method: "POST" }),
  doctor: (projectId: string) => request<DoctorResponse>(`${base(projectId)}/doctor`),

  activity: (projectId: string) => request<ActivityResponse>(`${base(projectId)}/activity`),

  insights: (projectId: string, days: number) =>
    request<InsightsData>(`${base(projectId)}/insights?days=${days}`),

  gamification: (projectId: string) =>
    request<GamificationData>(`${base(projectId)}/gamification`),

  assist: (projectId: string, id: string) =>
    request<AssistResult>(`${base(projectId)}/beads/${enc(id)}/assist`, { method: "POST" }),

  // Act on a "Needs You" (human-labelled) bead, mirroring `bd human`.
  human: {
    respond: (projectId: string, id: string, text: string) =>
      request<Bead>(`${base(projectId)}/beads/${enc(id)}/human`, {
        method: "POST",
        body: JSON.stringify({ action: "respond", text }),
      }),
    dismiss: (projectId: string, id: string) =>
      request<Bead>(`${base(projectId)}/beads/${enc(id)}/human`, {
        method: "POST",
        body: JSON.stringify({ action: "dismiss" }),
      }),
  },

  // Manual per-column board ordering (stored in app config, not in beads).
  order: {
    get: (projectId: string) =>
      request<{ orders: Record<string, string[]> }>(`${base(projectId)}/order`),
    set: (projectId: string, columnId: string, ids: string[]) =>
      request<{ orders: Record<string, string[]> }>(`${base(projectId)}/order`, {
        method: "PUT",
        body: JSON.stringify({ columnId, ids }),
      }),
  },

  // Image attachments stored under <repo>/.beads/attachments/<beadId>/.
  attachments: {
    upload: async (projectId: string, beadId: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("beadId", beadId);
      // No JSON Content-Type — let the browser set the multipart boundary.
      const res = await fetch(`${base(projectId)}/attachments`, { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error || `Upload failed (${res.status})`);
      }
      return body as { ref: string; url: string; name: string };
    },
    finalize: (projectId: string, draftId: string, beadId: string) =>
      request<{ moved: boolean }>(`${base(projectId)}/attachments`, {
        method: "PUT",
        body: JSON.stringify({ draftId, beadId }),
      }),
    /** Map an `attachment://<beadId>/<file>` ref to its serve URL. */
    urlFor: (projectId: string, ref: string) => {
      const rel = ref.replace(/^attachment:\/\//, "");
      // encodeURIComponent leaves "." and ".." alone, and the browser would
      // resolve them, steering a ref from bead text to another same-origin URL.
      const encoded = rel
        .split("/")
        .filter((segment) => segment && segment !== "." && segment !== "..")
        .map(encodeURIComponent)
        .join("/");
      return `${base(projectId)}/attachments/${encoded}`;
    },
  },

  // Publish/showcase: build a static Eleventy site from a project's beads.
  showcase: {
    build: (
      projectId: string,
      opts: {
        template: string;
        title: string;
        scope: "project" | "all";
        stats: boolean;
        search: boolean;
        gamification?: boolean;
      },
    ) =>
      request<{ outDir: string; indexPath: string; count: number }>(`${base(projectId)}/publish`, {
        method: "POST",
        body: JSON.stringify({ action: "build", ...opts }),
      }),
    open: (projectId: string, path: string) =>
      request<{ opened: boolean }>(`${base(projectId)}/publish`, {
        method: "POST",
        body: JSON.stringify({ action: "open", path }),
      }),
    deploy: (projectId: string, path: string) =>
      request<{ deployed: boolean; url?: string; error?: string; hint?: string }>(`${base(projectId)}/publish`, {
        method: "POST",
        body: JSON.stringify({ action: "deploy", path }),
      }),
  },

  // Self-update (bead bgb) — app-level, not project-scoped. Named `selfUpdate`
  // to avoid colliding with `update` (the per-bead PATCH method above).
  selfUpdate: {
    check: (channel: UpdateChannel = "stable") => request<UpdateStatus>(`/api/update/check?channel=${channel}`),
    run: (target: UpdateTarget) => request<UpdateResult>("/api/update/run", { method: "POST", body: JSON.stringify(target) }),
  },

  saveConfig: (patch: Record<string, unknown>) =>
    request<DoctorResponse["config"]>("/api/config", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  projects: {
    list: () => request<ProjectsResponse>("/api/projects"),
    add: (path: string, backend?: ProjectBackend) =>
      request<ProjectInfo>("/api/projects", { method: "POST", body: JSON.stringify({ path, backend }) }),
    remove: (id: string) =>
      request<{ removed: string }>(`/api/projects/${enc(id)}`, { method: "DELETE" }),
    rename: (id: string, name: string) =>
      request<ProjectInfo>(`/api/projects/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
  },

  fs: {
    browse: (path?: string) =>
      request<FsResponse>(`/api/fs${path ? `?path=${enc(path)}` : ""}`),
  },
};
