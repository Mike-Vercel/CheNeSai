import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { createRule, listRules } from "@/lib/server/psyco/rules-admin";

/** Archivio delle regole PSYCO (pannello admin). */
export const GET = adminRoute("admin", async () => ok({ rules: await listRules() }));
export const POST = adminRoute("admin", async ({ req }) => ok(await createRule(await req.json().catch(() => null)), { status: 201 }));
