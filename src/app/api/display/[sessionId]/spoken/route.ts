import { z } from "zod";
import { getSql } from "@/lib/database/db";
import { fail, ok, readJson, route } from "@/lib/http";
import { verifyDisplayKey } from "@/lib/server/display";
import { reportTvSpeech } from "@/lib/server/engine";

export const maxDuration = 60;

const bodySchema = z.object({ version: z.number().int().min(0), speaking: z.boolean() });

/**
 * Il TV (chiave schermo) dice se sta ancora parlando per una versione dello stato o se ha finito.
 * Lo scorrimento automatico non taglia il presentatore e, appena ha finito, non lascia silenzi.
 * Risposta: esito del passo automatico (come /tick) quando il TV ha finito, altrimenti null.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await ctx.params;
  if (!(await verifyDisplayKey(getSql(), sessionId, new URL(req.url).searchParams.get("k")))) {
    return fail(403, "BAD_DISPLAY_KEY", "Chiave schermo non valida");
  }
  const body = await readJson(req, bodySchema);
  return ok({ tick: await reportTvSpeech(sessionId, body.version, body.speaking) });
});
