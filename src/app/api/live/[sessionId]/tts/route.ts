import { z } from "zod";
import { getSql } from "@/lib/database/db";
import { fail, ok, route } from "@/lib/http";
import { authorizeLiveViewer, liveRateKey, liveTokenParam, liveVoiceNeedsPhone } from "@/lib/server/live-view";
import { authorizeShowLine } from "@/lib/server/player-voice";
import { isPublicSession } from "@/lib/server/public-session";
import { TtsError, ttsConfigured, withTimeout } from "@/lib/server/tts";
import { ttsLineUrl } from "@/lib/server/tts-names";
import { TTS_MAX_CHARS, TTS_ROLES } from "@/features/game/script";

export const maxDuration = 30;
const TTS_ROUTE_DEADLINE_MS = 24_000;

/**
 * GET /api/live/[sessionId]/tts?who=&text= → { url } della clip della battuta, per la VISTA LIVE.
 * Stesse regole delle voci dei giocatori (/api/play/tts): solo le battute che lo show può dire
 * adesso in quella partita (stessa cache delle clip, nessun testo arbitrario).
 */
export const GET = route(async (req: Request, ctx: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await ctx.params;
  const url = new URL(req.url);
  if (!ttsConfigured()) return fail(404, "TTS_OFF", "Voce professionale non configurata");
  const q = z
    .object({ who: z.enum(TTS_ROLES), text: z.string().trim().min(1).max(TTS_MAX_CHARS) })
    .parse(Object.fromEntries([...url.searchParams].filter(([k]) => ["who", "text"].includes(k))));
  const sql = getSql();
  const viewer = await authorizeLiveViewer(sql, sessionId, liveTokenParam(req));
  const line = await authorizeShowLine(sql, sessionId, liveRateKey(viewer), q.who, q.text, { requirePhone: liveVoiceNeedsPhone(viewer) });
  try {
    const live = !!line.live;
    const spliced = live && (await isPublicSession(sessionId, sql));
    const signed = await withTimeout(ttsLineUrl({ who: line.who, text: line.text, live }, { sessionId, namesMode: spliced ? "spliced" : undefined }), TTS_ROUTE_DEADLINE_MS, "Voce");
    return ok({ url: signed });
  } catch (e) {
    if (e instanceof TtsError) return fail(e.code === "TTS_BUDGET" ? 503 : 502, e.code, e.message);
    throw e;
  }
});
