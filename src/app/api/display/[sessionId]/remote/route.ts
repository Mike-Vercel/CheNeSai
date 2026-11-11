import { z } from "zod";
import { getSql } from "@/lib/database/db";
import { fail, ok, readJson, route } from "@/lib/http";
import { verifyDisplayKey } from "@/lib/server/display";
import { tvHeartbeat } from "@/lib/server/tv-pairing";

const schema = z.object({ audioOn: z.boolean() });

/** Il TV abbinato al telefono si fa sentire (chiave schermo): riceve le preferenze audio del telecomando. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await ctx.params;
  if (!(await verifyDisplayKey(getSql(), sessionId, new URL(req.url).searchParams.get("k")))) {
    return fail(403, "BAD_DISPLAY_KEY", "Chiave schermo non valida");
  }
  const body = await readJson(req, schema);
  return ok(await tvHeartbeat(sessionId, body.audioOn));
});
