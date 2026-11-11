import { clientIp } from "@/lib/auth/admin";
import { getSql } from "@/lib/database/db";
import { ok, readJson, route } from "@/lib/http";
import { authenticatePlayer, submitAnswer } from "@/lib/server/players";
import { readPlayerToken } from "@/lib/server/player-cookies";
import { answerSchema } from "@/lib/validation/schemas";

/** La conferma arriva SOLO da qui (operazione server-side), mai dal canale realtime. */
export const POST = route(async (req: Request) => {
  const body = await readJson(req, answerSchema);
  const auth = await authenticatePlayer(getSql(), body.code, await readPlayerToken(body.code, body.slot));
  return ok(await submitAnswer(auth, body, await clientIp()));
});
