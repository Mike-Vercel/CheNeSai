import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { createSession, listSessions } from "@/lib/server/cms/sessions";

export const GET = adminRoute("operator", async ({ url }) =>
  ok({ sessions: await listSessions({ status: url.searchParams.get("status") ?? undefined, includeArchived: url.searchParams.get("archived") === "1" }) }),
);

export const POST = adminRoute("admin", async ({ req, admin }) => ok({ id: await createSession(await req.json(), admin) }, { status: 201 }));
