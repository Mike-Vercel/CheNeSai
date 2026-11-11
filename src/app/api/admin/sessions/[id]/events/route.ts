import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { scheduleEvent } from "@/lib/server/cms/sessions";

export const POST = adminRoute<{ id: string }>("admin", async ({ req, admin, params }) =>
  ok({ id: await scheduleEvent(params.id, await req.json(), admin) }, { status: 201 }),
);
