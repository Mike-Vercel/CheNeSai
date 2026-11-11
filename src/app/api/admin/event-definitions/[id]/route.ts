import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { updateEventDefinition } from "@/lib/server/cms/admin";

export const PATCH = adminRoute<{ id: string }>("admin", async ({ req, admin, params }) => {
  await updateEventDefinition(params.id, await req.json(), admin);
  return ok({ ok: true });
});
