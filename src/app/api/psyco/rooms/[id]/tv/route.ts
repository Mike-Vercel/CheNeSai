import { z } from "zod";
import { ok, readJson, route } from "@/lib/http";
import { requirePsycoUser } from "@/lib/server/psyco/auth";
import { claimTvForRoom } from "@/lib/server/psyco/rooms";

const schema = z.object({ code: z.string().max(12) });

/** L'host scrive il codice di 4 cifre mostrato su /tv: quel televisore diventa lo schermo pubblico della stanza. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requirePsycoUser();
  const body = await readJson(req, schema);
  return ok(await claimTvForRoom(user, id, body.code));
});
