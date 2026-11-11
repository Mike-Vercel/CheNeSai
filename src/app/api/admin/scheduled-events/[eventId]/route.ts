import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { unscheduleEvent } from "@/lib/server/cms/sessions";

export const DELETE = adminRoute<{ eventId: string }>("admin", async ({ admin, params }) => {
  await unscheduleEvent(params.eventId, admin);
  return ok({ ok: true });
});
