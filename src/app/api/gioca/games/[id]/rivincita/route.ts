import { clientIp } from "@/lib/auth/admin";
import { getSql } from "@/lib/database/db";
import { ok, route } from "@/lib/http";
import { previousOptions, rematchPublicGame, requireHostUser } from "@/lib/server/gioco-libero";

/**
 * RIVINCITA della partita libera finita (solo il proprietario): nuova partita con lo stesso codice
 * e QR, giocatori già dentro, domande mai viste da questo host.
 * Corpo: {} = stesse impostazioni di prima, oppure { totalQuestions, rounds, mix }.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const host = await requireHostUser(await clientIp());
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const raw = body && body.totalQuestions !== undefined ? body : null;
  return ok(await rematchPublicGame(host, id, raw));
});

/** Impostazioni della partita (proposte uguali per la rivincita): solo il proprietario. */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const host = await requireHostUser();
  const sql = getSql();
  const [s] = await sql<{ host_user_id: string | null }[]>`select host_user_id from game_sessions where id = ${/^[0-9a-f-]{36}$/i.test(id) ? id : "00000000-0000-0000-0000-000000000000"}`;
  if (!s || s.host_user_id !== host.userId) return ok({ options: null });
  return ok({ options: await previousOptions(sql, id) });
});
