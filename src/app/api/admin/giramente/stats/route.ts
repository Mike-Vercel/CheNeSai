import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { giramenteStats } from "@/lib/server/giramente/admin";

/** Partite e statistiche di GIRAMENTE!. */
export const GET = adminRoute("admin", async () => ok(await giramenteStats()));
