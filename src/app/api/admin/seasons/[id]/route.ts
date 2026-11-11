import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { deleteSeason, saveSeason } from "@/lib/server/cms/admin";

type P = { id: string };

export const PUT = adminRoute<P>("admin", async ({ req, admin, params }) => ok({ id: await saveSeason(params.id, await req.json(), admin) }));
export const DELETE = adminRoute<P>("admin", async ({ admin, params }) => {
  await deleteSeason(params.id, admin);
  return ok({ ok: true });
});
