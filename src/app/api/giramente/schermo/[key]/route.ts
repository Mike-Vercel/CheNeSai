import { ok, route } from "@/lib/http";
import { getDisplayState } from "@/lib/server/giramente/rooms";

/**
 * Schermo pubblico (TV/PC): NON è un partecipante e non serve un account. Con la chiave lunga e
 * casuale della partita riceve SOLO lo stato pubblico (nessuna soluzione prima del momento giusto).
 */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ key: string }> }) => {
  const { key } = await ctx.params;
  return ok(await getDisplayState(key));
});
