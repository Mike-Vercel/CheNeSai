import { ok, route } from "@/lib/http";
import { actionSchema } from "@/lib/giramente/types";
import { requireGiramenteUser } from "@/lib/server/giramente/auth";
import { runAction } from "@/lib/server/giramente/engine";
import { GiramenteError } from "@/lib/server/giramente/errors";
import { getRoomView } from "@/lib/server/giramente/rooms";
import { checkRateLimit } from "@/lib/server/players";
import { getSql } from "@/lib/database/db";

/**
 * Un'azione di gioco (Verde/Rosso, GIRA, risposta, Jolly, pausa…): validata e applicata dal server in
 * una transazione. Risponde con la vista aggiornata di chi ha agito.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireGiramenteUser();
  if (!(await checkRateLimit(getSql(), `giramente-act:${user.userId}`, 240, 60))) throw new GiramenteError("RATE_LIMITED", "Troppi comandi in poco tempo: rallenta un attimo");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new GiramenteError("VALIDATION", "Dati non validi");
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) throw new GiramenteError("VALIDATION", "Azione non valida", parsed.error.issues);
  await runAction(id, { userId: user.userId, ip: user.ip }, parsed.data);
  if (parsed.data.action === "leave" || parsed.data.action === "close_room") return ok({ done: true });
  return ok(await getRoomView(user, id));
});
