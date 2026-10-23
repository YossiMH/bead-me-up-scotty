import { getStore } from "@/lib/store";
import { getConfig, closeActor } from "@/lib/config";
import { ok, fail } from "@/lib/api";
import { z } from "zod";
import { BEAD_STATUSES } from "@/lib/schema";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  status: z.enum(BEAD_STATUSES),
  /** Optional close reason; ignored for every status other than `closed`. */
  reason: z.string().max(10_000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string; id: string }> }) {
  try {
    const { projectId, id } = await params;
    const store = await getStore(projectId);
    const cfg = getConfig();
    const { status, reason } = bodySchema.parse(await req.json());
    // bd only lets a claimed bead's assignee close it; see closeActor.
    const actor = status === "closed" && store.kind !== "bead-rs"
      ? closeActor((await store.get(id))?.assignee) : cfg.humanActor;
    const bead = await store.setStatus(id, status, actor, reason);
    return ok(bead);
  } catch (e) {
    return fail(e);
  }
}
