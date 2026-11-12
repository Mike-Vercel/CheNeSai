import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { createPuzzle, listPuzzles } from "@/lib/server/giramente/admin";

/** Archivio degli enigmi di GIRAMENTE! (pannello admin). */
export const GET = adminRoute("admin", async () => ok({ puzzles: await listPuzzles() }));
export const POST = adminRoute("admin", async ({ req }) => ok(await createPuzzle(await req.json().catch(() => null)), { status: 201 }));
