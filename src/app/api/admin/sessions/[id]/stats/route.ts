import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { sessionStats } from "@/lib/server/cms/stats";

export const GET = adminRoute<{ id: string }>("admin", async ({ params }) => ok(await sessionStats(params.id)));
