import { adminRoute } from "@/lib/admin-route";
import { getSql } from "@/lib/database/db";
import { ok } from "@/lib/http";
import { importAllLibraries } from "@/lib/server/show";

/** Aggiunge le battute della libreria iniziale e della libreria ufficiale che mancano (non tocca quelle modificate). */
export const POST = adminRoute("admin", async () => ok({ added: await importAllLibraries(getSql()) }));
