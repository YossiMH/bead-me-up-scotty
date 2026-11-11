"use client";
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, editReadbackMatches, mutationOutcomeText, mutationReadbackMatches } from "@/lib/api-client";
import type { NativeMutationOutcome } from "@/lib/backend-contract";
import type { Bead, UpdateInput } from "@/lib/schema";
import { beadsKey } from "@/hooks/use-beads";

/** An edit carries the exact submitted patch through its read-only reconciliation. */
type MutationOutcomeNoticeProps = {
  outcome: NativeMutationOutcome;
  projectId: string;
  onReconciled: (bead: Bead) => void;
  onDiscard?: () => void;
} & ({ mode: "edit"; expectedPatch: UpdateInput } | { mode: "create" | "comment" | "labels"; expectedPatch?: never });

/** Keeps a submitted write separate from read-only reconciliation; never replays it. */
export function MutationOutcomeNotice({ outcome, projectId, mode, expectedPatch, onReconciled, onDiscard }: MutationOutcomeNoticeProps) {
  const qc = useQueryClient();
  const [reading, setReading] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const refresh = async () => {
    if (reading) return;
    setReading(true);
    setMessage("");
    try {
      if (outcome.issueId) {
        const bead = await api.get(projectId, outcome.issueId);
        if (bead?.id !== outcome.issueId) throw new Error("The readback did not identify the requested bead");
        if (mode === "labels" || mode === "edit") {
          // Publish the whole snapshot so labels and readiness come from the same read.
          await qc.cancelQueries({ queryKey: beadsKey(projectId) });
          const snapshot = await api.list(projectId);
          if (snapshot?.meta?.kind !== "bead-rs" || !Array.isArray(snapshot.beads)) {
            throw new Error("A native project snapshot was not returned");
          }
          const refreshed = snapshot.beads.find((item) => item.id === outcome.issueId);
          if (!refreshed) throw new Error("The refreshed project did not contain the requested bead");
          qc.setQueryData(beadsKey(projectId), snapshot);
          if (mode === "edit" && !editReadbackMatches(expectedPatch, refreshed)) {
            setMessage("Current records refreshed. They differ from the submitted edit. Your draft is retained; review the current bead before starting another edit.");
            return;
          }
          onReconciled(refreshed);
          return;
        }
        if (mutationReadbackMatches(outcome, bead)) {
          onReconciled(bead);
          return;
        }
      } else {
        const snapshot = await api.list(projectId);
        if (snapshot?.meta?.kind !== "bead-rs" || !Array.isArray(snapshot.beads)) {
          throw new Error("A native project snapshot was not returned");
        }
      }
      setMessage("Current records refreshed. This submission is still unverified; do not resubmit it. Review the list or comments before starting a different entry.");
    } catch (error) {
      setMessage(`Read-only refresh failed: ${error instanceof Error ? error.message : "Details unavailable"}. The write was not retried.`);
    } finally {
      if (mode !== "labels" && mode !== "edit") await qc.invalidateQueries({ queryKey: beadsKey(projectId) });
      setReading(false);
    }
  };
  return (
    <div role="alert" className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] p-3 text-[12px] leading-[1.5] text-[var(--text)]">
      <p className="m-0">{mutationOutcomeText(outcome)}</p>
      {outcome.receiptId && <p className="m-0 mt-1 break-all font-mono">Receipt: {outcome.receiptId}</p>}
      {message && <p className="m-0 mt-2">{message}</p>}
      <div className="mt-2 flex flex-wrap gap-3">
        <button type="button" disabled={reading} onClick={refresh} className="underline underline-offset-2 disabled:opacity-50">
          {reading ? "Refreshing…" : "Refresh without resubmitting"}
        </button>
        {onDiscard && <button type="button" disabled={reading} onClick={onDiscard} className="underline underline-offset-2 disabled:opacity-50">Discard this draft</button>}
      </div>
    </div>
  );
}
