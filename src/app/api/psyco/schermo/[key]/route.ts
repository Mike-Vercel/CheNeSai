import { ok, route } from "@/lib/http";
import { getDisplayState } from "@/lib/server/psyco/rooms";

/**
 * Schermo pubblico (TV/PC): NON è un partecipante e non serve un account. Con la chiave lunga e
 * casuale della stanza riceve SOLO lo stato pubblico (niente regola, proposte, voti individuali, ruoli).
 */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ key: string }> }) => {
  const { key } = await ctx.params;
  return ok(await getDisplayState(key));
});
