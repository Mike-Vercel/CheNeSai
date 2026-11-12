import { ok, route } from "@/lib/http";
import { requirePsycoUser } from "@/lib/server/psyco/auth";
import { getRoomView } from "@/lib/server/psyco/rooms";

/**
 * Stato della stanza per l'utente autenticato: pubblico + vista privata (ruolo, e la regola SOLO a
 * chi la conosce). Dispositivo condiviso: ?as=<id del giocatore locale> per la vista di chi ha in
 * mano il telefono (solo il proprietario della stanza).
 */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requirePsycoUser();
  const as = new URL(req.url).searchParams.get("as");
  return ok(await getRoomView(user, id, as || null));
});
