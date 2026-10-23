"use client";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { toastError } from "@/components/error-toast";
import { canOperate, canEdit, canChangeStatus, canView } from "@/lib/beads-view";
import type { BackendOperation, EditableBeadField } from "@/lib/backend-contract";
import { api, nativeMutationOutcome, type Meta, type BeadsResponse } from "@/lib/api-client";
import type { Bead, CreateInput, UpdateInput, DepType } from "@/lib/schema";
import { useApp } from "@/components/app-context";

/** Query key is scoped per project so tabs on different projects never collide. */
export const beadsKey = (projectId: string) => ["beads", projectId] as const;
export const activityKey = (projectId: string) => ["activity", projectId] as const;

export function useBeads(projectId: string) {
  return useQuery({
    queryKey: beadsKey(projectId),
    queryFn: () => api.list(projectId),
    refetchInterval: (q) => q.state.data?.meta.pollIntervalMs ?? 5000,
  });
}

/** Recent activity feed for a project. Invalidated by the SSE stream on change;
 *  the interval is just a fallback. */
export function useActivity(projectId: string) {
  const { meta } = useApp();
  return useQuery({
    queryKey: activityKey(projectId),
    queryFn: () => api.activity(projectId),
    enabled: meta !== undefined && canView(meta, "activity"),
    refetchInterval: 20000,
  });
}

/** Flow-metrics for the Insights dashboard over a rolling window of `days`. */
export function useInsights(projectId: string, days: number) {
  const { meta } = useApp();
  return useQuery({
    queryKey: ["insights", projectId, days],
    queryFn: () => api.insights(projectId, days),
    enabled: meta !== undefined && canView(meta, "insights"),
    refetchInterval: 30000,
  });
}

/** Gamification XP/level stats. Only enabled when the feature is opted in. */
export function useGamification(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["gamification", projectId],
    queryFn: () => api.gamification(projectId),
    enabled,
    refetchInterval: 30000,
  });
}

function patchCache(
  prev: BeadsResponse | undefined,
  id: string,
  patch: Partial<Bead>,
): BeadsResponse | undefined {
  if (!prev) return prev;
  return {
    ...prev,
    beads: prev.beads.map((b) => (b.id === id ? { ...b, ...patch } : b)),
  };
}

export function useSetStatus() {
  const { projectId, meta, readOnly } = useApp();
  const qc = useQueryClient();
  const KEY = beadsKey(projectId);
  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      {
        requireWrite(meta, readOnly, undefined, ["status"]);
        const bead = qc.getQueryData<BeadsResponse>(KEY)?.beads.find((item) => item.id === id);
        if (bead && !canChangeStatus(meta, bead, status)) throw new Error("This status transition is not supported by this backend.");
        if (status === "closed" && meta?.capabilities?.closeReason === "required" && !reason?.trim()) {
          throw new Error("A close reason is required.");
        }
        return api.setStatus(projectId, id, status, reason);
      },
    onMutate: async ({ id, status }) => {
      requireWrite(meta, readOnly, undefined, ["status"]);
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<BeadsResponse>(KEY);
      // Native lifecycle commands can change assignment and readiness together.
      // Keep its coherent snapshot until the server confirms the whole transition.
      if (meta?.kind !== "bead-rs") qc.setQueryData<BeadsResponse>(KEY, (p) => patchCache(p, id, { status }));
      return { prev: meta?.kind === "bead-rs" ? undefined : prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      toastError(err);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

function mutationToast<TArgs, TRes>(
  fn: (args: TArgs) => Promise<TRes>,
  message: (args: TArgs, res: TRes) => string,
  qc: ReturnType<typeof useQueryClient>,
  key: readonly unknown[],
) {
  return {
    mutationFn: fn,
    onSuccess: (res: TRes, args: TArgs) => {
      toast.success(message(args, res));
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (err: unknown) => {
      if (nativeMutationOutcome(err)) qc.invalidateQueries({ queryKey: key });
      toastError(err);
    },
  };
}

export function useCreateBead() {
  const { projectId, meta, readOnly } = useApp();
  const qc = useQueryClient();
  return useMutation(
    mutationToast<CreateInput, Bead>(
      async (input) => { requireWrite(meta, readOnly, "create"); return api.create(projectId, input, meta?.kind === "bead-rs"); },
      (_a, res) => `Created ${res.id}${meta?.kind === "bead-rs" ? "" : " · bd create"}`,
      qc,
      beadsKey(projectId),
    ),
  );
}

export function useUpdateBead() {
  const { projectId, meta, readOnly } = useApp();
  const qc = useQueryClient();
  return useMutation(
    mutationToast<{ id: string; patch: UpdateInput }, Bead>(
      async ({ id, patch }) => { requireWrite(meta, readOnly, undefined, Object.keys(patch) as EditableBeadField[]); return api.update(projectId, id, patch); },
      () => meta?.kind === "bead-rs" ? "Updated" : "Updated · bd update",
      qc,
      beadsKey(projectId),
    ),
  );
}

export function useDeleteBead() {
  const { projectId, meta, readOnly } = useApp();
  const qc = useQueryClient();
  return useMutation(
    mutationToast<string, { deleted: string }>(
      async (id) => { requireWrite(meta, readOnly, "delete"); return api.remove(projectId, id); },
      (id) => `Deleted ${id} · bd delete`,
      qc,
      beadsKey(projectId),
    ),
  );
}

export function useAddComment() {
  const { projectId, meta, readOnly } = useApp();
  const qc = useQueryClient();
  return useMutation(
    mutationToast<{ id: string; text: string }, Bead>(
      async ({ id, text }) => { requireWrite(meta, readOnly, "comment"); return api.addComment(projectId, id, text, meta?.kind === "bead-rs"); },
      () => "Comment added",
      qc,
      beadsKey(projectId),
    ),
  );
}

/** One native chip intent maps to one public label operation, never a set replacement. */
export function useLabelDelta() {
  const { projectId, meta, readOnly } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, label, action }: { id: string; label: string; action: "add" | "remove" }) => {
      requireWrite(meta, readOnly, "label-delta");
      return api.labelDelta(projectId, id, label, action);
    },
    onError: (error) => toastError(error),
    onSettled: () => qc.invalidateQueries({ queryKey: beadsKey(projectId) }),
  });
}

export function useAddDep() {
  const { projectId, meta, readOnly } = useApp();
  const qc = useQueryClient();
  return useMutation(
    mutationToast<{ id: string; dependsOnId: string; type: DepType }, Bead>(
      async ({ id, dependsOnId, type }) => {
        requireWrite(meta, readOnly, "dependencies");
        if (meta?.capabilities && !meta.capabilities.dependencyTypes.includes(type)) throw new Error("This dependency type is not supported by this backend.");
        return api.addDep(projectId, id, dependsOnId, type);
      },
      () => meta?.kind === "bead-rs" ? "Dependency added" : "Dependency added · bd dep add",
      qc,
      beadsKey(projectId),
    ),
  );
}

export function useRemoveDep() {
  const { projectId, meta, readOnly } = useApp();
  const qc = useQueryClient();
  return useMutation(
    mutationToast<{ id: string; dependsOnId: string; type?: string }, Bead>(
      async ({ id, dependsOnId, type }) => { requireWrite(meta, readOnly, "dependencies"); return api.removeDep(projectId, id, dependsOnId, meta?.kind === "bead-rs" ? type : undefined); },
      () => meta?.kind === "bead-rs" ? "Dependency removed" : "Dependency removed · bd dep remove",
      qc,
      beadsKey(projectId),
    ),
  );
}

/** Create a human approval gate blocking `id` (bd gate create --type human). */
export function useCreateGate() {
  const { projectId, meta, readOnly } = useApp();
  const qc = useQueryClient();
  return useMutation(
    mutationToast<{ id: string; reason?: string }, Bead>(
      async ({ id, reason }) => { requireWrite(meta, readOnly, "gate"); return api.createGate(projectId, id, reason); },
      (_a, res) => `Created approval gate ${res.id} · bd gate create`,
      qc,
      beadsKey(projectId),
    ),
  );
}

/** "Needs You" inbox: respond (comment + close) or dismiss (drop the human label). */
export function useRespondHuman() {
  const { projectId, meta, readOnly } = useApp();
  const qc = useQueryClient();
  return useMutation(
    mutationToast<{ id: string; text: string }, Bead>(
      async ({ id, text }) => { requireWrite(meta, readOnly, "gate"); return api.human.respond(projectId, id, text); },
      (a) => `Responded to ${a.id}`,
      qc,
      beadsKey(projectId),
    ),
  );
}

export function useDismissHuman() {
  const { projectId, meta, readOnly } = useApp();
  const qc = useQueryClient();
  return useMutation(
    mutationToast<{ id: string }, Bead>(
      async ({ id }) => { requireWrite(meta, readOnly, "gate"); return api.human.dismiss(projectId, id); },
      (a) => `Dismissed ${a.id}`,
      qc,
      beadsKey(projectId),
    ),
  );
}

export function useArchiveBead() {
  const { projectId, meta, readOnly } = useApp();
  const qc = useQueryClient();
  return useMutation(
    mutationToast<string, Bead>(
      async (id) => { requireWrite(meta, readOnly, "archive"); return api.archive(projectId, id); },
      (id) => `Archived ${id} · bd close + label`,
      qc,
      beadsKey(projectId),
    ),
  );
}

/** Reject unsupported client mutations before the API or optimistic cache changes. */
function requireWrite(meta: Meta | undefined, readOnly: boolean, operation?: BackendOperation, fields: readonly EditableBeadField[] = []): void {
  if (readOnly) throw new Error("This project is read-only.");
  if (operation && !canOperate(meta, operation)) throw new Error(`This backend does not support ${operation}.`);
  for (const field of fields) {
    if (!canEdit(meta, field)) throw new Error(`This backend does not support editing ${field}.`);
  }
}
