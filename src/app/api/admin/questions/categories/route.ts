import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { listCategories } from "@/lib/server/cms/questions";

export const GET = adminRoute("admin", async () => ok({ categories: await listCategories() }));
