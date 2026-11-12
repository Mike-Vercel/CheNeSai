import { ok, route } from "@/lib/http";
import { requireGiramenteUser } from "@/lib/server/giramente/auth";
import { getRoomView } from "@/lib/server/giramente/rooms";

/** Stato della partita per l'utente autenticato: pubblico + le PROPRIE prove (mai soluzioni). */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireGiramenteUser();
  return ok(await getRoomView(user, id));
});
