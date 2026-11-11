import { clientIp } from "@/lib/auth/admin";
import { getSql } from "@/lib/database/db";
import { ok, route } from "@/lib/http";
import { createPublicGame, listHostGames, loadPublicGamesSettings, quotaOf, requireHostUser } from "@/lib/server/gioco-libero";

export const maxDuration = 30;

/** GET: le partite dell'host collegato, quota e stato del gioco libero. */
export const GET = route(async () => {
  const host = await requireHostUser();
  const sql = getSql();
  const settings = await loadPublicGamesSettings(sql);
  return ok({ profile: host.profile, quota: quotaOf(host, settings), open: settings.enabled, games: await listHostGames(sql, host.userId) });
});

/** POST { totalQuestions, rounds, mix }: crea, pubblica e apre la lobby di una nuova partita libera. */
export const POST = route(async (req: Request) => {
  const host = await requireHostUser(await clientIp());
  const raw: unknown = await req.json().catch(() => ({}));
  return ok(await createPublicGame(host, raw), { status: 201 });
});
