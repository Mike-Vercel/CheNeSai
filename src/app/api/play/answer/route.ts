import { clientIp } from "@/lib/auth/admin";
import { getSql } from "@/lib/database/db";
import { ok, readJson, route } from "@/lib/http";
import { closeAnswersIfAllAnswered } from "@/lib/server/engine";
import { authenticatePlayer, submitAnswer } from "@/lib/server/players";
import { readPlayerToken } from "@/lib/server/player-cookies";
import { answerSchema } from "@/lib/validation/schemas";

/** La conferma arriva SOLO da qui (operazione server-side), mai dal canale realtime. */
export const POST = route(async (req: Request) => {
  const body = await readJson(req, answerSchema);
  const auth = await authenticatePlayer(getSql(), body.code, await readPlayerToken(body.code, body.slot));
  const res = await submitAnswer(auth, body, await clientIp());
  // hanno risposto tutti: le risposte si chiudono subito (mai un errore per il giocatore)
  if (res.status === "recorded") {
    await closeAnswersIfAllAnswered(auth.sessionId, res.sessionQuestionId).catch((e) => console.warn("[quizzone] chiusura anticipata non riuscita", e instanceof Error ? e.message : e));
  }
  return ok(res);
});
