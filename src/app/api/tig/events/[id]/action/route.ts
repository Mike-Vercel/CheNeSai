import { getSql } from "@/lib/database/db";
import { ok, route } from "@/lib/http";
import { checkRateLimit } from "@/lib/server/players";
import { requireTigUser } from "@/lib/server/tig/auth";
import { runAction } from "@/lib/server/tig/engine";
import { TigError } from "@/lib/server/tig/errors";
import { getEventView } from "@/lib/server/tig/events";
import { actionSchema, ORGANIZER_ACTIONS } from "@/lib/tig/types";

/**
 * Un'azione (regia o giocatore): validata e applicata dal server in UNA transazione con lucchetto sulla serata.
 * Risponde con l'esito (`result`, es. invio accettato) e la vista aggiornata di chi ha agito.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireTigUser();
  if (!(await checkRateLimit(getSql(), `tig-act:${user.userId}`, 300, 60))) throw new TigError("RATE_LIMITED", "Troppi comandi in poco tempo: rallenta un attimo");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new TigError("VALIDATION", "Dati non validi");
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) throw new TigError("VALIDATION", parsed.error.issues[0]?.message ?? "Azione non valida", parsed.error.issues);
  const r = await runAction(id, { userId: user.userId, ip: user.ip }, parsed.data);
  if (parsed.data.action === "leave") return ok({ done: true, result: r.result });
  const as = ORGANIZER_ACTIONS.has(parsed.data.action) || new URL(req.url).searchParams.get("as") === "regia" ? "regia" : "player";
  const view = await getEventView(user, id, as).catch(() => ({ state: r.state, view: null }));
  return ok({ ...view, result: r.result });
});
