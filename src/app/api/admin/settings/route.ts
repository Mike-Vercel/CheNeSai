import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { getSettings, saveSettings } from "@/lib/server/cms/admin";

export const GET = adminRoute("admin", async () => ok({ settings: await getSettings() }));
export const PUT = adminRoute("super_admin", async ({ req, admin }) => ok({ settings: await saveSettings(await req.json(), admin) }));
