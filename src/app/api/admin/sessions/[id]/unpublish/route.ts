import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { unpublishSession } from "@/lib/server/cms/sessions";

export const POST = adminRoute<{ id: string }>("admin", async ({ admin, params }) => {
  await unpublishSession(params.id, admin);
  return ok({ ok: true });
});
