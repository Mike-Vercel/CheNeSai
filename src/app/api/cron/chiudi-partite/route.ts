import { timingSafeEqual } from "node:crypto";
import { fail, ok, route } from "@/lib/http";
import { closeStaleFreeGames } from "@/lib/server/auto-close";
import { closeStaleRooms } from "@/lib/server/psyco/rooms";

export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Cron giornaliero di Vercel (vercel.json → "crons"): chiude le partite del gioco libero senza
 * attività da 24 ore. Vercel manda `Authorization: Bearer <CRON_SECRET>`: la variabile d'ambiente
 * CRON_SECRET va impostata nel progetto, altrimenti la route rifiuta ogni chiamata.
 * Stesso cron (il piano Hobby ne consente pochi): chiude anche le stanze PSYCO inattive da 24 ore.
 */
export const GET = route(async (req: Request) => {
  if (!authorized(req)) return fail(401, "UNAUTHORIZED", "Non autorizzato");
  const r = await closeStaleFreeGames({ limit: 200 });
  const psyco = await closeStaleRooms({ limit: 500 }).catch((e: unknown) => {
    console.error("[psyco] pulizia stanze non riuscita", e);
    return -1;
  });
  return ok({ closed: r.closed.length, failed: r.failed.length, psycoClosed: psyco });
});
