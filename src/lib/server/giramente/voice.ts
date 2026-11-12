import "server-only";
import { createHash } from "node:crypto";
import { getSql, num } from "@/lib/database/db";
import { captionOf, fillLine, isDynamic, LINE_BY_ID, type Speaker } from "@/lib/giramente/lines";
import { roundInfo } from "@/lib/giramente/types";
import { checkRateLimit } from "@/lib/server/players";
import { appUsage, modelSupportsTags, signedClipUrl, withTimeout } from "@/lib/server/tts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { GiramenteError } from "./errors";

/**
 * Voci di Don Patrizio e Zafira per le battute DINAMICHE (nomi, punti, manche) con ElevenLabs.
 *
 * - Voci: ELEVENLABS_VOICE_DONPATRIZIO e ELEVENLABS_VOICE_ZAFIRA (+ ELEVENLABS_API_KEY). Se mancano:
 *   nessun errore per i giocatori, il client mostra solo il sottotitolo.
 * - La chiave resta SOLO sul server; il testo NON arriva dal client: il server compone la battuta
 *   dal catalogo (lib/giramente/lines.ts) con i nomi letti dal database della partita.
 * - Cache: giramente_tts_clips + bucket privato «tts» (giramente/<voce>/<chiave>.mp3); ogni battuta
 *   si paga una volta. Budget mensile condiviso con le voci del quiz (pannello Voci).
 */
/** Don Patrizio (chiave interna «dontralla»): ELEVENLABS_VOICE_DONPATRIZIO, con il vecchio nome come ripiego. */
const VOICE_ENV: Record<Speaker, string[]> = { dontralla: ["ELEVENLABS_VOICE_DONPATRIZIO", "ELEVENLABS_VOICE_DONTRALLA"], zafira: ["ELEVENLABS_VOICE_ZAFIRA"] };
/**
 * Modello per le battute dinamiche: Multilingual v2, lo stesso delle frasi preregistrate, così la voce
 * resta identica (il v3 con le voci "professional" cambiava timbro da una frase all'altra).
 * Gli audio tag si tolgono (vedi modelSupportsTags). GIRAMENTE_TTS_MODEL lo cambia senza toccare il codice.
 */
const MODEL = () => process.env.GIRAMENTE_TTS_MODEL || "eleven_multilingual_v2";
/** Impostazioni fisse per personaggio: le stesse usate per le frasi preregistrate. */
const VOICE_SETTINGS: Record<Speaker, Record<string, number | boolean>> = {
  dontralla: { stability: 0.5, similarity_boost: 0.9, style: 0.3, use_speaker_boost: true, speed: 1.0 },
  zafira: { stability: 0.45, similarity_boost: 0.9, style: 0.4, use_speaker_boost: true, speed: 0.95 },
};
const API = "https://api.elevenlabs.io";
const BUCKET = "tts";

export function giramenteVoiceId(who: Speaker): string | null {
  for (const name of VOICE_ENV[who]) if (process.env[name]) return process.env[name]!;
  return null;
}

export function giramenteVoicesStatus(): Record<Speaker, boolean> {
  const key = !!process.env.ELEVENLABS_API_KEY;
  return { dontralla: key && !!giramenteVoiceId("dontralla"), zafira: key && !!giramenteVoiceId("zafira") };
}

export interface VoiceRequest {
  line: string;
  competitorId?: string | null;
  points?: number | null;
  roundNo?: number | null;
}

/** Testo della battuta con i dati VERI della partita (mai testo libero dal client). */
async function composeText(roomId: string, req: VoiceRequest): Promise<{ who: Speaker; text: string; dynamic: boolean }> {
  const line = LINE_BY_ID[req.line];
  if (!line) throw new GiramenteError("NOT_FOUND", "Battuta sconosciuta");
  if (!isDynamic(line)) return { who: line.who, text: line.text, dynamic: false };
  let name: string | null = null;
  if (req.competitorId) {
    const [c] = await getSql()<{ name: string }[]>`select name from giramente_competitors where id = ${req.competitorId} and room_id = ${roomId}`;
    if (!c) throw new GiramenteError("NOT_FOUND", "Concorrente non trovato");
    name = c.name;
  }
  const points = typeof req.points === "number" && Number.isInteger(req.points) && req.points >= 0 && req.points <= 100_000 ? req.points : undefined;
  return {
    who: line.who,
    text: fillLine(line, { playerName: name ?? undefined, teamName: name ?? undefined, points, roundName: req.roundNo ? (roundInfo(req.roundNo)?.name ?? undefined) : undefined }),
    dynamic: true,
  };
}

async function monthChars(): Promise<number> {
  const [r] = await getSql()<{ chars: string | number }[]>`
    select coalesce(sum(billed_chars), 0) as chars from giramente_tts_clips where created_at >= date_trunc('month', now())`;
  return num(r.chars);
}

/**
 * URL firmato dell'mp3 della battuta (generato solo la prima volta), oppure null se la voce non è
 * configurata (il client mostra il sottotitolo). L'autorizzazione (membro o schermo) la fa la route.
 */
export async function giramenteVoiceUrl(roomId: string, req: VoiceRequest): Promise<{ url: string | null; caption: string; who: Speaker }> {
  const { who, text, dynamic } = await composeText(roomId, req);
  const caption = captionOf(text);
  const voiceId = giramenteVoiceId(who);
  const apiKey = process.env.ELEVENLABS_API_KEY;
  // le battute fisse sono clip preregistrati (public/audio/giramente/voci): niente sintesi, niente costi
  if (!voiceId || !apiKey || !dynamic) return { url: null, caption, who };
  const sql = getSql();
  if (!(await checkRateLimit(sql, `giramente-voce:${roomId}`, 120, 60))) throw new GiramenteError("RATE_LIMITED", "Troppe battute in poco tempo");
  const model = MODEL();
  const sent = modelSupportsTags(model) ? text : captionOf(text);
  const key = createHash("sha256").update(`${voiceId}|${model}|${JSON.stringify(VOICE_SETTINGS[who])}|${sent}`).digest("hex");
  const [hit] = await sql<{ storage_path: string }[]>`update giramente_tts_clips set last_used_at = now() where cache_key = ${key} returning storage_path`;
  if (hit) return { url: await signedClipUrl(hit.storage_path), caption, who };

  // budget mensile condiviso con le voci del quiz
  const usage = await appUsage(sql);
  if (usage.monthChars + (await monthChars()) + sent.length > usage.budget) return { url: null, caption, who };

  const res = await withTimeout(
    fetch(`${API}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: sent, model_id: model, language_code: "it", voice_settings: VOICE_SETTINGS[who] }),
      signal: AbortSignal.timeout(15_000),
    }),
    16_000,
    "ElevenLabs",
  ).catch(() => null);
  if (!res || !res.ok) return { url: null, caption, who };
  const audio = Buffer.from(await res.arrayBuffer());
  const billed = Number(res.headers.get("character-cost")) || Number(res.headers.get("x-character-count")) || sent.length;
  const path = `giramente/${who}/${key}.mp3`;
  const up = await withTimeout(getSupabaseAdmin().storage.from(BUCKET).upload(path, audio, { contentType: "audio/mpeg", upsert: true }), 10_000, "Salvataggio audio");
  if (up.error) return { url: null, caption, who };
  await sql`
    insert into giramente_tts_clips (cache_key, who, model, voice_id, text, chars, billed_chars, storage_path)
    values (${key}, ${who}, ${model}, ${voiceId}, ${sent}, ${sent.length}, ${Math.ceil(billed)}, ${path})
    on conflict (cache_key) do update set last_used_at = now()`;
  return { url: await signedClipUrl(path), caption, who };
}
