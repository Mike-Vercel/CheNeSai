import { ok, route } from "@/lib/http";
import { requirePsycoUser } from "@/lib/server/psyco/auth";
import { PsycoError } from "@/lib/server/psyco/errors";
import { runScreenAction, screenControl } from "@/lib/server/psyco/rooms";

/**
 * Comandi dallo SCHERMO PUBBLICO (PC dell'host in «Schermo + telefoni»).
 *
 * GET: chi guarda lo schermo è l'host? Solo un sì/no (senza account: no). Mai ruolo o regola.
 * POST: avvia / via / pausa / ripresa / nuova manche, SOLO per l'host autenticato; la risposta è lo
 * stato PUBBLICO, esattamente come per un televisore: il PC non è un partecipante e non riceve
 * mai la vista privata dell'host (nemmeno se l'host gioca ed è lo PSYCO).
 */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ key: string }> }) => {
  const { key } = await ctx.params;
  const user = await requirePsycoUser().catch((e: unknown) => {
    if (e instanceof PsycoError && e.code === "UNAUTHENTICATED") return null;
    throw e;
  });
  return ok(await screenControl(user, key));
});

export const POST = route(async (req: Request, ctx: { params: Promise<{ key: string }> }) => {
  const { key } = await ctx.params;
  const user = await requirePsycoUser();
  const body: unknown = await req.json().catch(() => null);
  return ok(await runScreenAction(user, key, body));
});
