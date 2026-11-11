import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { archiveSession } from "@/lib/server/cms/sessions";

export const POST = adminRoute<{ id: string }>("admin", async ({ admin, params }) => {
  await archiveSession(params.id, admin);
  return ok({ ok: true });
});
