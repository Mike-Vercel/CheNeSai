import { getSql } from "@/lib/database/db";
import { fail, ok, route } from "@/lib/http";
import { getHostUser } from "@/lib/server/gioco-libero";
import { isOnlineSession } from "@/lib/server/players";

/**
 * Pagina di ingresso (/play/CODICE): la partita è ONLINE (serve l'account) e chi apre la pagina ha
 * già fatto l'accesso? Restituisce solo lo username da proporre come nickname (mai email né altro).
 */
export const GET = route(async (_req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  if (!/^[A-Za-z0-9]{4,8}$/.test(code)) return fail(400, "BAD_CODE", "Codice non valido");
  const [s] = await getSql()<{ display_mode: string | null; is_test: boolean }[]>`
    select display_mode, is_test from game_sessions where code = ${code.toUpperCase()}`;
  if (!s) return fail(404, "NOT_FOUND", "Partita non trovata");
  const online = isOnlineSession(s);
  const user = online ? await getHostUser().catch(() => null) : null;
  return ok({ online, account: user ? { username: user.profile?.username ?? null } : null });
});
