import { getSql } from "@/lib/database/db";
import { fail, ok, route } from "@/lib/http";
import { streamSafeState } from "@/lib/game-engine/stream-view";
import { authorizeLiveViewer, liveTokenParam } from "@/lib/server/live-view";
import { buildPublicState } from "@/lib/server/public-state";

/**
 * Stato per la VISTA LIVE (giocatore della partita o host): lo show pubblico senza codice, QR e link
 * (vedi streamSafeState). La vista non guida mai la partita.
 */
export const GET = route(async (req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await ctx.params;
  const sql = getSql();
  await authorizeLiveViewer(sql, sessionId, liveTokenParam(req));
  const state = await buildPublicState(sql, sessionId);
  if (!state) return fail(409, "NOT_READY", "La partita non è ancora pronta");
  return ok({ state: streamSafeState(state) });
});
