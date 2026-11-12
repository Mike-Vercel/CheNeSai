import { ok, route } from "@/lib/http";
import { requirePsycoUser } from "@/lib/server/psyco/auth";
import { getDisplayKey } from "@/lib/server/psyco/rooms";

/** Chiave dello schermo pubblico (solo per chi gestisce la stanza): per aprirlo su questo PC o su un'altra finestra. */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requirePsycoUser();
  return ok({ displayKey: await getDisplayKey(user, id) });
});
