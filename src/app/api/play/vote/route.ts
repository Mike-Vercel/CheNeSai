import { clientIp } from "@/lib/auth/admin";
import { getSql } from "@/lib/database/db";
import { ok, readJson, route } from "@/lib/http";
import { authenticatePlayer, submitVote } from "@/lib/server/players";
import { readPlayerToken } from "@/lib/server/player-cookies";
import { voteSchema } from "@/lib/validation/schemas";

export const POST = route(async (req: Request) => {
  const body = await readJson(req, voteSchema);
  const auth = await authenticatePlayer(getSql(), body.code, await readPlayerToken(body.code, body.slot));
  return ok(await submitVote(auth, body, await clientIp()));
});
