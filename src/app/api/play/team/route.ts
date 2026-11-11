import { getSql } from "@/lib/database/db";
import { ok, readJson, route } from "@/lib/http";
import { rebroadcast } from "@/lib/server/engine";
import { authenticatePlayer, checkRateLimit, PlayerError } from "@/lib/server/players";
import { readPlayerToken } from "@/lib/server/player-cookies";
import { chooseTeam } from "@/lib/server/teams";
import { teamChoiceSchema } from "@/lib/validation/schemas";

/** Scelta della squadra dal telefono: il server verifica modalità, fase e appartenenza della squadra. */
export const POST = route(async (req: Request) => {
  const body = await readJson(req, teamChoiceSchema);
  const sql = getSql();
  const auth = await authenticatePlayer(sql, body.code, await readPlayerToken(body.code, body.slot));
  if (!(await checkRateLimit(sql, `team:${auth.participantId}`, 10, 10))) throw new PlayerError("RATE_LIMITED", "Troppe richieste");
  const team = await chooseTeam(auth, body.teamId);
  // TV e telefoni vedono subito i nuovi conteggi delle squadre
  await rebroadcast(auth.sessionId).catch(() => null);
  return ok({ team });
});
