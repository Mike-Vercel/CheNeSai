import { getSql } from "@/lib/database/db";
import { ok, route } from "@/lib/http";
import { fallbackTick } from "@/lib/server/fallback-tick";
import { authenticatePlayer, checkRateLimit, PlayerError } from "@/lib/server/players";
import { readPlayerToken } from "@/lib/server/player-cookies";

export const maxDuration = 60;

/**
 * Partita ONLINE: passo automatico di riserva chiesto dal dispositivo di un giocatore (cookie del
 * giocatore). Il server lo esegue solo se è in ritardo di almeno FALLBACK_GRACE_MS: se la scheda
 * dell'host si chiude o perde la connessione, la partita va avanti lo stesso.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const slot = new URL(req.url).searchParams.get("slot");
  const sql = getSql();
  const auth = await authenticatePlayer(sql, code, await readPlayerToken(code, slot));
  if (!(await checkRateLimit(sql, `ftick:${auth.participantId}`, 40, 60))) throw new PlayerError("RATE_LIMITED", "Troppe richieste");
  return ok(await fallbackTick(auth.sessionId));
});
