import "server-only";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getSql, num } from "@/lib/database/db";
import { checkRateLimit } from "@/lib/server/players";
import { appUsage, signedClipUrl, withTimeout } from "@/lib/server/tts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fillVoiceText, isVoiceFile, type VoiceVars } from "@/lib/tig/voices/fill";
import type { VoiceFile } from "@/lib/tig/voices/schema";
import { TigError } from "./errors";

/**
 * Voci di TAVOLI IN GUERRA!
 *
 * Catalogo: `content/tig/voci/<personaggio>.json` (forma VoiceFile, 24 personaggi). Non è segreto: lo legge la TV
 * per i sottotitoli.
 *
 * Audio: prima il clip registrato `public/audio/tig/voci/<id battuta>.mp3` (lo cerca il client); altrimenti la
 * sintesi ElevenLabs SOLO se per quel personaggio esiste la variabile `TIG_VOICE_<ID>` (es. TIG_VOICE_DON_PATRIZIO,
 * TIG_VOICE_PROFESSOR_SMOKE)
 * oltre a ELEVENLABS_API_KEY. Oggi nessuna è configurata: si vedono solo i sottotitoli.
 * Il testo da sintetizzare lo compone il SERVER dal catalogo e da variabili numeriche validate: mai testo libero.
 */
const DIR = path.join(process.cwd(), "content", "tig", "voci");
let cache: { at: number; files: VoiceFile[] } | null = null;

async function readDir(dir: string): Promise<VoiceFile[]> {
  let names: string[] = [];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return [];
  }
  const out: VoiceFile[] = [];
  for (const n of names) {
    try {
      const data = JSON.parse(await readFile(path.join(dir, n), "utf8")) as unknown;
      if (isVoiceFile(data)) out.push(data);
    } catch (e) {
      console.warn("[tig] file voci non leggibile", n, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

export async function loadVoiceCatalog(): Promise<VoiceFile[]> {
  if (cache && Date.now() - cache.at < (process.env.NODE_ENV === "production" ? 3_600_000 : 5_000)) return cache.files;
  const files = await readDir(DIR);
  cache = { at: Date.now(), files };
  return files;
}

const envName = (characterId: string) => `TIG_VOICE_${characterId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
/**
 * Personaggi che hanno già una voce negli altri giochi: se manca TIG_VOICE_<ID> si usa la stessa voce
 * (stesso personaggio, stessa voce; Professor Smoke = il Professore, Victor = l'Investigatore, come i modelli 3D).
 */
const SHARED_VOICE: Record<string, string[]> = {
  "professor-smoke": ["ELEVENLABS_VOICE_PROFESSORE"],
  regina: ["ELEVENLABS_VOICE_REGINA"],
  palmino: ["ELEVENLABS_VOICE_PALMINO"],
  victor: ["ELEVENLABS_VOICE_INVESTIGATORE"],
  "don-patrizio": ["ELEVENLABS_VOICE_DONPATRIZIO", "ELEVENLABS_VOICE_DONTRALLA"],
  zafira: ["ELEVENLABS_VOICE_ZAFIRA"],
};
export function tigVoiceId(characterId: string): string | null {
  const own = process.env[envName(characterId)];
  if (own) return own;
  for (const name of SHARED_VOICE[characterId] ?? []) if (process.env[name]) return process.env[name]!;
  return null;
}

/** Stesse impostazioni di GIRAMENTE! per Don Patrizio e Zafira: la voce resta identica da una frase all'altra. */
const VOICE_SETTINGS: Record<string, Record<string, number | boolean>> = {
  "don-patrizio": { stability: 0.5, similarity_boost: 0.9, style: 0.3, use_speaker_boost: true, speed: 1.0 },
  zafira: { stability: 0.45, similarity_boost: 0.9, style: 0.4, use_speaker_boost: true, speed: 0.95 },
};

export async function tigVoicesStatus(): Promise<Record<string, boolean>> {
  const key = !!process.env.ELEVENLABS_API_KEY;
  const files = await loadVoiceCatalog();
  return Object.fromEntries(files.map((f) => [f.character.id, key && !!tigVoiceId(f.character.id)]));
}

const MODEL = () => process.env.TIG_TTS_MODEL || "eleven_multilingual_v2";
const API = "https://api.elevenlabs.io";
const BUCKET = "tts";

async function monthChars(): Promise<number> {
  const [r] = await getSql()<{ chars: string | number }[]>`select coalesce(sum(chars), 0) as chars from tig_tts_clips where created_at >= date_trunc('month', now())`;
  return num(r.chars);
}

/** URL firmato dell'mp3 della battuta (generato la prima volta) oppure null: il client mostra il sottotitolo. */
export async function tigVoiceUrl(eventId: string, characterId: string, lineId: string, vars: VoiceVars): Promise<{ url: string | null; caption: string }> {
  const files = await loadVoiceCatalog();
  const file = files.find((f) => f.character.id === characterId);
  const line = file?.lines.find((l) => l.id === lineId);
  if (!file || !line) throw new TigError("NOT_FOUND", "Battuta sconosciuta");
  const text = fillVoiceText(line.text, vars);
  const voiceId = tigVoiceId(characterId);
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!voiceId || !apiKey) return { url: null, caption: text };
  const sql = getSql();
  if (!(await checkRateLimit(sql, `tig-voce:${eventId}`, 120, 60))) throw new TigError("RATE_LIMITED", "Troppe battute in poco tempo");
  const model = MODEL();
  const sent = text.replace(/manche/gi, "mansh");
  const settings = VOICE_SETTINGS[characterId];
  const key = createHash("sha256").update(`${voiceId}|${model}|${settings ? JSON.stringify(settings) : ""}|${sent}`).digest("hex");
  const [hit] = await sql<{ storage_path: string }[]>`update tig_tts_clips set last_used_at = now() where cache_key = ${key} returning storage_path`;
  if (hit) return { url: await signedClipUrl(hit.storage_path), caption: text };
  const usage = await appUsage(sql);
  if (usage.monthChars + (await monthChars()) + sent.length > usage.budget) return { url: null, caption: text };
  const res = await withTimeout(
    fetch(`${API}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: sent, model_id: model, language_code: "it", ...(settings ? { voice_settings: settings } : {}) }),
      signal: AbortSignal.timeout(15_000),
    }),
    16_000,
    "ElevenLabs",
  ).catch(() => null);
  if (!res || !res.ok) return { url: null, caption: text };
  const audio = Buffer.from(await res.arrayBuffer());
  const storagePath = `tig/${characterId}/${key}.mp3`;
  const up = await withTimeout(getSupabaseAdmin().storage.from(BUCKET).upload(storagePath, audio, { contentType: "audio/mpeg", upsert: true }), 10_000, "Salvataggio audio");
  if (up.error) return { url: null, caption: text };
  await sql`
    insert into tig_tts_clips (cache_key, character_id, line_id, voice_id, model, chars, storage_path)
    values (${key}, ${characterId}, ${lineId}, ${voiceId}, ${model}, ${sent.length}, ${storagePath})
    on conflict (cache_key) do update set last_used_at = now()`;
  return { url: await signedClipUrl(storagePath), caption: text };
}
