import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { createTemplate, listTemplates } from "@/lib/server/cms/dialogue";

export const GET = adminRoute("admin", async () => ok({ templates: await listTemplates() }));
export const POST = adminRoute("admin", async ({ req, admin }) => ok({ id: await createTemplate(await req.json(), admin) }));
