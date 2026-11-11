import { ok, route } from "@/lib/http";
import { pollPairing } from "@/lib/server/tv-pairing";

/**
 * Il televisore chiede se il suo codice è stato abbinato (gettone segreto in ?t=).
 * Abbinato: id della partita e chiave dello schermo, UNA volta sola.
 */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return ok(await pollPairing(id, new URL(req.url).searchParams.get("t") ?? ""));
});
