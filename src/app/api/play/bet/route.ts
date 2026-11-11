import { clientIp } from "@/lib/auth/admin";
import { getSql } from "@/lib/database/db";
import { ok, readJson, route } from "@/lib/http";
import { authenticatePlayer, submitBet } from "@/lib/server/players";
import { readPlayerToken } from "@/lib/server/player-cookies";
import { betSchema } from "@/lib/validation/schemas";

/** Puntata della manche "Scommetti tutto": la posta la calcola il server sui suoi punti. */
export const POST = route(async (req: Request) => {
  const body = await readJson(req, betSchema);
  const auth = await authenticatePlayer(getSql(), body.code, await readPlayerToken(body.code, body.slot));
  return ok(await submitBet(auth, body, await clientIp()));
});
