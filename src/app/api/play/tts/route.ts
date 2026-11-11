import { z } from "zod";
import { getSql } from "@/lib/database/db";
import { fail, ok, route } from "@/lib/http";
import { authenticatePlayer } from "@/lib/server/players";
import { authorizePlayerLine } from "@/lib/server/player-voice";
import { readPlayerToken } from "@/lib/server/player-cookies";
import { isPublicSession } from "@/lib/server/public-session";
import { TtsError, ttsConfigured, withTimeout } from "@/lib/server/tts";
import { ttsLineUrl } from "@/lib/server/tts-names";
import { TTS_MAX_CHARS, TTS_ROLES } from "@/features/game/script";

export const maxDuration = 30;
const TTS_ROUTE_DEADLINE_MS = 24_000;


/**
 * GET /api/play/tts?code=&who=&text=[&slot=] → { url } della clip della battuta.
 * Solo per i giocatori di una partita con lo show sul telefono (display_mode = "phone"), e SOLO
 * per le battute che lo show può dire adesso in quella partita (stesso copione del telefono
 * dell'host, calcolato qui dallo stato ufficiale): nessun testo arbitrario, nessuna spesa oltre
 * le battute della partita (le stesse che chiede comunque il telefono dell'host: stessa cache).
 */
export const GET = route(async (req: Request) => {
  const url = new URL(req.url);
  if (!ttsConfigured()) return fail(404, "TTS_OFF", "Voce professionale non configurata");
  const q = z
    .object({
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,8}$/),
      who: z.enum(TTS_ROLES),
      text: z.string().trim().min(1).max(TTS_MAX_CHARS),
      slot: z.string().regex(/^[a-z0-9]{1,8}$/).optional(),
    })
    .parse(Object.fromEntries([...url.searchParams].filter(([k]) => ["code", "who", "text", "slot"].includes(k))));
  const sql = getSql();
  const auth = await authenticatePlayer(sql, q.code, await readPlayerToken(q.code, q.slot ?? null));
  const line = await authorizePlayerLine(sql, auth, q.who, q.text);
  try {
    const live = !!line.live;
    const spliced = live && (await isPublicSession(auth.sessionId, sql));
    const signed = await withTimeout(
      ttsLineUrl({ who: line.who, text: line.text, live }, { sessionId: auth.sessionId, namesMode: spliced ? "spliced" : undefined }),
      TTS_ROUTE_DEADLINE_MS,
      "Voce",
    );
    return ok({ url: signed });
  } catch (e) {
    if (e instanceof TtsError) return fail(e.code === "TTS_BUDGET" ? 503 : 502, e.code, e.message);
    throw e;
  }
});
