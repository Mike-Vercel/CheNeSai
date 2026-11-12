import { getSql } from "@/lib/database/db";
import { ok, route } from "@/lib/http";
import { authorizeLiveViewer, liveToken } from "@/lib/server/live-view";
import { PlayerError } from "@/lib/server/players";

/**
 * Indirizzo della VISTA LIVE per una «Sorgente browser» di OBS (browser separato, senza i cookie del
 * giocatore): con il gettone `t` che apre solo la vista pulita. Solo per chi gioca la partita (cookie)
 * o per l'host (account): un gettone non ne genera altri.
 */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await ctx.params;
  const sql = getSql();
  const viewer = await authorizeLiveViewer(sql, sessionId);
  if (viewer.kind === "token") throw new PlayerError("NOT_JOINED", "Apri la vista LIVE dalla tua partita");
  const t = await liveToken(sql, sessionId, viewer.kind === "player" ? viewer.auth.participantId : "h");
  return ok({ path: `/gioca/live/${sessionId}?t=${encodeURIComponent(t)}` });
});
