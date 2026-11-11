import { ok, route } from "@/lib/http";
import { hostGameStatus, requireHostUser } from "@/lib/server/gioco-libero";

/** Giocatori della partita libera (per espellerli) e scorrimento attivo: solo per il proprietario. */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const host = await requireHostUser();
  return ok(await hostGameStatus(host, id));
});
