import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdmin } from "@/lib/auth/admin";
import { getSql } from "@/lib/database/db";
import { fail, ok, route } from "@/lib/http";
import { verifyDisplayKey } from "@/lib/server/display";
import { checkRateLimit } from "@/lib/server/players";
import { TtsError, ttsConfigured, ttsUrl } from "@/lib/server/tts";
import { TTS_MAX_CHARS, TTS_ROLES } from "@/features/game/script";

export const maxDuration = 30;

/**
 * GET /api/tts?status=1                          → { provider: "elevenlabs" | "browser" }
 * GET /api/tts?who=&text=&live=1&s=&k=           → redirect all'mp3 della battuta
 * GET /api/tts?…&format=json                     → { url } (prefetch del TV, senza redirect)
 * Accesso riservato al TV (chiave schermo) o agli admin: il servizio è a pagamento.
 * Budget mensile esaurito → 503 TTS_BUDGET: il TV usa la voce del browser (le clip in cache restano disponibili).
 */
export const GET = route(async (req: Request) => {
  const url = new URL(req.url);
  if (url.searchParams.get("status")) return ok({ provider: ttsConfigured() ? "elevenlabs" : "browser" });
  if (!ttsConfigured()) return fail(404, "TTS_OFF", "Voce professionale non configurata");
  const q = z
    .object({
      who: z.enum(TTS_ROLES),
      text: z.string().trim().min(1).max(TTS_MAX_CHARS),
      live: z.enum(["0", "1"]).optional(),
      format: z.enum(["json", "redirect"]).optional(),
      s: z.string().optional(),
      k: z.string().optional(),
    })
    .parse(Object.fromEntries(url.searchParams));
  const sql = getSql();
  const allowed = (q.s && q.k && (await verifyDisplayKey(sql, q.s, q.k))) || !!(await getAdmin());
  if (!allowed) return fail(403, "FORBIDDEN", "Voce riservata allo schermo TV");
  if (!(await checkRateLimit(sql, `tts:${q.s ?? "admin"}`, 180, 60))) return fail(429, "RATE_LIMITED", "Troppe richieste");
  let signed: string;
  try {
    signed = await ttsUrl(q.who, q.text, { live: q.live === "1" });
  } catch (e) {
    if (e instanceof TtsError) return fail(e.code === "TTS_BUDGET" ? 503 : 502, e.code, e.message);
    throw e;
  }
  if (q.format === "json") return ok({ url: signed });
  return NextResponse.redirect(signed, { status: 302, headers: { "Cache-Control": "private, max-age=600" } });
});
