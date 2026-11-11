import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { listEventDefinitions } from "@/lib/server/cms/admin";

export const GET = adminRoute("operator", async () => ok({ definitions: await listEventDefinitions() }));
