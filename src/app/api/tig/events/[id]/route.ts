import { ok, route } from "@/lib/http";
import { requireTigUser } from "@/lib/server/tig/auth";
import { getEventView } from "@/lib/server/tig/events";

/** Stato della serata + vista privata: `?as=regia` (solo organizzatore) oppure giocatore (membro di una squadra). */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireTigUser();
  const as = new URL(req.url).searchParams.get("as") === "regia" ? "regia" : "player";
  return ok(await getEventView(user, id, as));
});
