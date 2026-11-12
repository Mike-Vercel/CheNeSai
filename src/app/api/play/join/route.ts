import { clientIp } from "@/lib/auth/admin";
import { ok, readJson, route } from "@/lib/http";
import { getAccountUserId } from "@/lib/server/account";
import { joinSession } from "@/lib/server/players";
import { readDeviceToken, writeDeviceToken, writePlayerToken } from "@/lib/server/player-cookies";
import { scheduleNamePrewarm } from "@/lib/server/tts-names";
import { joinSchema } from "@/lib/validation/schemas";

export const POST = route(async (req: Request) => {
  const body = await readJson(req, joinSchema);
  const result = await joinSession(
    { code: body.code, nickname: body.nickname, recoveryCode: body.recoveryCode || null, slot: body.slot ?? null, gender: body.gender },
    // account del sito: obbligatorio solo nelle partite ONLINE (vedi isOnlineSession), ignorato in salotto
    { ip: await clientIp(), deviceToken: await readDeviceToken(), userId: body.slot ? null : await getAccountUserId() },
  );
  await writePlayerToken(body.code, body.slot, result.participantToken);
  if (result.deviceToken) await writeDeviceToken(result.deviceToken);
  // voce: il nome del nuovo giocatore si prepara subito (in background), così la prima battuta che lo nomina parte veloce
  if (!result.rejoined) scheduleNamePrewarm(result.nickname, result.sessionId);
  return ok({
    participantId: result.participantId,
    nickname: result.nickname,
    rejoined: result.rejoined,
    recoveryCode: result.recoveryCode,
  });
});
