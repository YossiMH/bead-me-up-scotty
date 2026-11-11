import { getStore } from "@/lib/store";
import { getConfig } from "@/lib/config";
import { nativeUpdateInputSchema, updateInputSchema } from "@/lib/schema";
import { ok, fail } from "@/lib/api";
import { requireEditableFields } from "@/lib/backend-capabilities";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ projectId: string; id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { projectId, id } = await params;
    const store = await getStore(projectId);
    const bead = await store.get(id);
    if (!bead) return ok({ error: "not found" }, 404);
    return ok(bead);
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { projectId, id } = await params;
    const store = await getStore(projectId);
    const cfg = getConfig();
    const body: unknown = await req.json();
    if (store.kind === "bead-rs" && store.capabilities) requireEditableFields(store.capabilities, body);
    const patch = (store.kind === "bead-rs" ? nativeUpdateInputSchema : updateInputSchema).parse(body);
    const bead = await store.update(id, patch, cfg.humanActor);
    return ok(bead);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { projectId, id } = await params;
    const store = await getStore(projectId);
    const cfg = getConfig();
    await store.remove(id, cfg.humanActor);
    return ok({ deleted: id });
  } catch (e) {
    return fail(e);
  }
}
