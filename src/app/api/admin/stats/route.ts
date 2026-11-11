import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { dashboardStats } from "@/lib/server/cms/stats";

export const GET = adminRoute("operator", async () => ok(await dashboardStats()));
