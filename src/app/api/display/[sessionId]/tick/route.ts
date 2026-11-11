import { getSql } from "@/lib/database/db";
import { fail, ok, route } from "@/lib/http";
import { verifyDisplayKey } from "@/lib/server/display";
import { autoTick } from "@/lib/server/engine";

// un tick dura pochi secondi: lucchetti e query hanno limiti propri (vedi runCommand)
export const maxDuration = 60;

/**
 * Scorrimento automatico guidato dal TV: quando arriva l'orario del prossimo passo il TV chiama
 * questo endpoint. Il server esegue il passo SOLO se l'automatico è attivo e il passo è dovuto
 * (nessun altro comando è possibile da qui); più TV insieme lo eseguono una volta sola.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await ctx.params;
  if (!(await verifyDisplayKey(getSql(), sessionId, new URL(req.url).searchParams.get("k")))) {
    return fail(403, "BAD_DISPLAY_KEY", "Chiave schermo non valida");
  }
  return ok(await autoTick(sessionId));
});
