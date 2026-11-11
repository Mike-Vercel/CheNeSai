import { getSql } from "@/lib/database/db";
import { fail, ok, route } from "@/lib/http";
import { buildPublicState } from "@/lib/server/public-state";
import { lazyCloseIfStale } from "@/lib/server/auto-close";

/** Snapshot pubblico (stesso contenuto del TV): caricamento iniziale e recupero dopo disconnessione. */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  if (!/^[A-Za-z0-9]{4,8}$/.test(code)) return fail(400, "BAD_CODE", "Codice non valido");
  const sql = getSql();
  const [s] = await sql<{ id: string }[]>`select id from game_sessions where code = ${code.toUpperCase()}`;
  if (!s) return fail(404, "NOT_FOUND", "Partita non trovata");
  const state = await buildPublicState(sql, s.id);
  if (!state) return fail(409, "NOT_READY", "La partita non è ancora pronta");
  if (state.phase !== "FINISHED") lazyCloseIfStale(s.id);
  return ok({ state });
});
