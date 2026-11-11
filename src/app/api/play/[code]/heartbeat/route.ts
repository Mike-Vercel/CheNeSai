import { getSql } from "@/lib/database/db";
import { ok, route } from "@/lib/http";
import { authenticatePlayer } from "@/lib/server/players";
import { readPlayerToken } from "@/lib/server/player-cookies";

/** Segnale di presenza leggero (ogni ~30 s): alimenta lo stato "online" in regia. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const slot = new URL(req.url).searchParams.get("slot");
  const sql = getSql();
  const auth = await authenticatePlayer(sql, code, await readPlayerToken(code, slot));
  await sql`update participants set last_seen_at = now() where id = ${auth.participantId} and last_seen_at < now() - interval '10 seconds'`;
  const [v] = await sql<{ version: number }[]>`select version from game_state where session_id = ${auth.sessionId}`;
  return ok({ version: v?.version ?? 0 });
});
