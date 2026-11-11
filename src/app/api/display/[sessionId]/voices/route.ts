import { z } from "zod";
import { getSql } from "@/lib/database/db";
import { fail, ok, readJson, route } from "@/lib/http";
import { DISPLAY_VOICES_MAX_BATCH, DisplayVoicesError, displayVoices } from "@/lib/server/display-voices";

// Ogni richiesta genera un piccolo lotto: il TV ripete finché non manca più nulla.
export const maxDuration = 60;

const bodySchema = z.object({
  action: z.enum(["estimate", "run"]),
  batch: z.number().int().min(1).max(DISPLAY_VOICES_MAX_BATCH).optional(),
});

/**
 * "Voci della serata" dal TV (chiave schermo `k`): come "Prepara voci" della regia, solo per
 * le battute di questa serata e nei limiti del budget mensile.
 * POST { action: "estimate" } → { configured, total, ready, missing }
 * POST { action: "run", batch } → genera fino a `batch` battute mancanti e restituisce l'avanzamento
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await ctx.params;
  const body = await readJson(req, bodySchema);
  try {
    return ok(await displayVoices(getSql(), sessionId, new URL(req.url).searchParams.get("k"), body.action, body.batch));
  } catch (e) {
    if (e instanceof DisplayVoicesError) return fail(e.status, e.code, e.message);
    throw e;
  }
});
