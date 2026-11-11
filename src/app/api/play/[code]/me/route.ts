import { getSql } from "@/lib/database/db";
import { ok, route } from "@/lib/http";
import { authenticatePlayer, getPlayerSelf } from "@/lib/server/players";
import { readPlayerToken } from "@/lib/server/player-cookies";
import { buildPublicState } from "@/lib/server/public-state";
import { watchdogTick } from "@/lib/server/engine";

/** Stato personale + snapshot pubblico: recupero completo dopo refresh o disconnessione. */
export const GET = route(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const slot = new URL(req.url).searchParams.get("slot");
  const sql = getSql();
  const auth = await authenticatePlayer(sql, code, await readPlayerToken(code, slot));
  const [self, state] = await Promise.all([getPlayerSelf(sql, auth), buildPublicState(sql, auth.sessionId)]);
  // anche i telefoni fanno da rete di sicurezza dello scorrimento automatico (in background)
  watchdogTick(state);
  return ok({ self, state });
});
