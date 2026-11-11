import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { updateAdmin } from "@/lib/server/cms/admin";

export const PATCH = adminRoute<{ id: string }>("super_admin", async ({ req, admin, params }) => {
  await updateAdmin(params.id, await req.json(), admin);
  return ok({ ok: true });
});
