import { clientIp } from "@/lib/auth/admin";
import { ok, readJson, route } from "@/lib/http";
import { joinSession } from "@/lib/server/players";
import { readDeviceToken, writeDeviceToken, writePlayerToken } from "@/lib/server/player-cookies";
import { joinSchema } from "@/lib/validation/schemas";

export const POST = route(async (req: Request) => {
  const body = await readJson(req, joinSchema);
  const result = await joinSession(
    { code: body.code, nickname: body.nickname, recoveryCode: body.recoveryCode || null, slot: body.slot ?? null },
    { ip: await clientIp(), deviceToken: await readDeviceToken() },
  );
  await writePlayerToken(body.code, body.slot, result.participantToken);
  if (result.deviceToken) await writeDeviceToken(result.deviceToken);
  return ok({
    participantId: result.participantId,
    nickname: result.nickname,
    rejoined: result.rejoined,
    recoveryCode: result.recoveryCode,
  });
});
