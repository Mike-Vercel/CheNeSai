import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { deleteTemplate, updateTemplate } from "@/lib/server/cms/dialogue";

type P = { id: string };

export const PATCH = adminRoute<P>("admin", async ({ req, admin, params }) => {
  await updateTemplate(params.id, await req.json(), admin);
  return ok({ ok: true });
});
export const DELETE = adminRoute<P>("admin", async ({ admin, params }) => {
  await deleteTemplate(params.id, admin);
  return ok({ ok: true });
});
