import { getSql } from "@/lib/database/db";
import { fail, ok, route } from "@/lib/http";
import { regenerateRecoveryCode } from "@/lib/server/players";
import { readDeviceToken } from "@/lib/server/player-cookies";

/** Genera un nuovo codice giocatore per questo dispositivo (il precedente smette di valere). */
export const POST = route(async () => {
  const token = await readDeviceToken();
  const code = token ? await regenerateRecoveryCode(getSql(), token) : null;
  if (!code) return fail(404, "NO_IDENTITY", "Nessuna identità su questo dispositivo");
  return ok({ recoveryCode: code });
});
