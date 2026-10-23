import { getStore } from "@/lib/store";
import { getConfig } from "@/lib/config";
import { addDepSchema, originalAddDepSchema, DEP_TYPES } from "@/lib/schema";
import { ok, fail } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ projectId: string; id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { projectId, id } = await params;
    const store = await getStore(projectId);
    const cfg = getConfig();
    const { depends_on_id, type } = (store.kind === "bead-rs" ? addDepSchema : originalAddDepSchema).parse(await req.json());
    const bead = await store.addDep(id, depends_on_id, type, cfg.humanActor);
    return ok(bead);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { projectId, id } = await params;
    const store = await getStore(projectId);
    const cfg = getConfig();
    const { depends_on_id, type } = z.object({
      depends_on_id: z.string(), type: z.enum(DEP_TYPES).optional(),
    }).parse(await req.json());
    const bead = await store.removeDep(id, depends_on_id, cfg.humanActor, type);
    return ok(bead);
  } catch (e) {
    return fail(e);
  }
}
