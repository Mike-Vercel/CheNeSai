import { adminRoute } from "@/lib/admin-route";
import { getSql } from "@/lib/database/db";
import { ok } from "@/lib/http";
import { importLibrary } from "@/lib/server/show";

/** Aggiunge le battute della libreria iniziale che mancano (non tocca quelle modificate). */
export const POST = adminRoute("admin", async () => ok({ added: await importLibrary(getSql()) }));
