import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { listSeasons, saveSeason } from "@/lib/server/cms/admin";

export const GET = adminRoute("admin", async () => ok({ seasons: await listSeasons() }));
export const POST = adminRoute("admin", async ({ req, admin }) => ok({ id: await saveSeason(null, await req.json(), admin) }, { status: 201 }));
