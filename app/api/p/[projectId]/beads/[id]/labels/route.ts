import { getStore } from "@/lib/store";
import { getConfig } from "@/lib/config";
import { nativeLabelInputSchema } from "@/lib/schema";
import { requireOperation } from "@/lib/backend-capabilities";
import { BdError } from "@/lib/bd";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ projectId: string; id: string }> };

/** Validate the single-label intent before store qualification can launch a CLI. */
async function apply(req: Request, { params }: Ctx, action: "add" | "remove") {
  try {
    const { label } = nativeLabelInputSchema.parse(await req.json());
    const { projectId, id } = await params;
    const store = await getStore(projectId);
    requireOperation(store, "label-delta");
    if (!store.addLabel) throw new BdError("Native label deltas are unavailable.", "unsupported_operation");
    const actor = getConfig().humanActor;
    return ok(await (action === "add" ? store.addLabel(id, label, actor) : store.removeLabel(id, label, actor)));
  } catch (error) { return fail(error); }
}

export function POST(req: Request, ctx: Ctx) { return apply(req, ctx, "add"); }
export function DELETE(req: Request, ctx: Ctx) { return apply(req, ctx, "remove"); }
