import { ok, route } from "@/lib/http";
import { requireGiramenteUser } from "@/lib/server/giramente/auth";
import { getDisplayKey } from "@/lib/server/giramente/rooms";

/** Chiave dello schermo TV (solo per chi gestisce la partita). */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireGiramenteUser();
  return ok({ displayKey: await getDisplayKey(user, id) });
});
