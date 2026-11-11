import "server-only";
import { createHash } from "node:crypto";
import { getSql, num, type Db } from "@/lib/database/db";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { stripAudioTags, TTS_ROLES, ttsText, type SpokenLine, type TtsRole } from "@/features/game/script";

/**
 * Voce professionale dei presentatori con ElevenLabs (facoltativa).
 * - Ogni battuta è salvata nel bucket privato "tts" con chiave
 *   sha256(voiceId|model|testo) e registrata in `tts_clips`: si paga una volta.
 * - Battute pre-generate (domande, round, eventi, frasi generiche): modello di qualità.
 * - Battute live (nickname, punteggi): modello veloce.
 * - Budget mensile dell'app: oltre il limite non si genera più nulla (le clip in cache
 *   continuano a funzionare e il TV ripiega sulla voce del browser).
 * - Al massimo 2 richieste parallele a ElevenLabs per istanza, con retry su 429/5xx,
 *   e richieste concorrenti per la stessa chiave unificate.
 * La chiave API resta solo sul server.
 */

export type TtsSource = "pregen" | "live" | "sample";

export interface RoleVoiceSettings {
  voiceId: string;
  /** Nome della voce (solo per il pannello). */
  voiceName: string | null;
  stability: number;
  similarity: number;
  style: number;
  speed: number;
}

export interface VoiceConfig {
  monthlyBudgetChars: number;
  roles: Record<TtsRole, RoleVoiceSettings>;
}

const VOICE_ENV: Record<TtsRole, string> = {
  professore: "ELEVENLABS_VOICE_PROFESSORE",
  regina: "ELEVENLABS_VOICE_REGINA",
  palmino: "ELEVENLABS_VOICE_PALMINO",
  annunciatore: "ELEVENLABS_VOICE_ANNUNCIATORE",
};

/** Impostazioni predefinite: Palmino un po' più veloce e giocoso, l'annunciatore molto espressivo. */
export const DEFAULT_ROLE_SETTINGS: Record<TtsRole, Omit<RoleVoiceSettings, "voiceId" | "voiceName">> = {
  professore: { stability: 0.45, similarity: 0.8, style: 0.35, speed: 1.0 },
  regina: { stability: 0.4, similarity: 0.8, style: 0.45, speed: 1.0 },
  palmino: { stability: 0.3, similarity: 0.75, style: 0.6, speed: 1.08 },
  annunciatore: { stability: 0.3, similarity: 0.8, style: 0.85, speed: 1.0 },
};

export const DEFAULT_MONTHLY_BUDGET = 50_000;
const BUCKET = "tts";
const API = "https://api.elevenlabs.io";
const MAX_PARALLEL = 2;

export class TtsError extends Error {
  readonly code: "TTS_OFF" | "TTS_BUDGET" | "TTS_NO_VOICE" | "TTS_PROVIDER";
  constructor(code: TtsError["code"], message: string) {
    super(message);
    this.name = "TtsError";
    this.code = code;
  }
}

export function ttsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

export function modelFor(live: boolean): string {
  return live ? process.env.ELEVENLABS_MODEL_LIVE || "eleven_v4_turbo" : process.env.ELEVENLABS_MODEL || "eleven_v4";
}

/**
 * Modelli che interpretano gli audio tag ([laughs], [shouts]…) e accettano solo
 * stabilità e somiglianza (Eleven v3/v4). Con gli altri i tag vengono tolti dal testo.
 */
export function modelSupportsTags(model: string): boolean {
  return /^eleven_v[34]/.test(model);
}

// ---------------------------------------------------------------------------
// Configurazione (application_settings.voices, con le variabili d'ambiente come fallback)
// ---------------------------------------------------------------------------
interface StoredVoices {
  monthlyBudgetChars?: number;
  roles?: Partial<Record<TtsRole, Partial<RoleVoiceSettings>>>;
}

let configMemo: { at: number; value: VoiceConfig } | null = null;

export function invalidateVoiceConfig() {
  configMemo = null;
}

const clamp = (v: unknown, min: number, max: number, def: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);

export async function loadVoiceConfig(db: Db = getSql()): Promise<VoiceConfig> {
  if (configMemo && Date.now() - configMemo.at < 10_000) return configMemo.value;
  const [row] = await db<{ value: StoredVoices }[]>`select value from application_settings where key = 'voices'`;
  const stored = row?.value ?? {};
  const roles = {} as Record<TtsRole, RoleVoiceSettings>;
  for (const r of TTS_ROLES) {
    const s = stored.roles?.[r] ?? {};
    const d = DEFAULT_ROLE_SETTINGS[r];
    roles[r] = {
      voiceId: (typeof s.voiceId === "string" && s.voiceId) || process.env[VOICE_ENV[r]] || "",
      voiceName: typeof s.voiceName === "string" ? s.voiceName : null,
      stability: clamp(s.stability, 0, 1, d.stability),
      similarity: clamp(s.similarity, 0, 1, d.similarity),
      style: clamp(s.style, 0, 1, d.style),
      speed: clamp(s.speed, 0.7, 1.2, d.speed),
    };
  }
  const value: VoiceConfig = {
    monthlyBudgetChars: Math.round(clamp(stored.monthlyBudgetChars, 0, 10_000_000, DEFAULT_MONTHLY_BUDGET)),
    roles,
  };
  configMemo = { at: Date.now(), value };
  return value;
}

export function envVoiceId(role: TtsRole): string | null {
  return process.env[VOICE_ENV[role]] || null;
}

// ---------------------------------------------------------------------------
// Chiavi di cache
// ---------------------------------------------------------------------------
export function clipKey(voiceId: string, model: string, text: string): string {
  return createHash("sha256").update(`${voiceId}|${model}|${text}`).digest("hex");
}

export interface PlannedClip {
  key: string;
  role: TtsRole;
  text: string;
  model: string;
  voiceId: string;
  live: boolean;
  chars: number;
}

/** Chiave e parametri della clip per una battuta (senza chiamare ElevenLabs). */
export function planClip(cfg: VoiceConfig, line: Pick<SpokenLine, "who" | "text" | "live">, opts: { sampleSalt?: string } = {}): PlannedClip | null {
  const model = modelFor(!!line.live);
  // La chiave usa il testo davvero inviato: con i tag per v3/v4, senza per gli altri modelli.
  const text = modelSupportsTags(model) ? ttsText(line.text) : ttsText(stripAudioTags(line.text));
  const voiceId = cfg.roles[line.who].voiceId;
  if (!text || !voiceId) return null;
  // I campioni della pagina Voci dipendono anche dalle impostazioni (così "Prova" riflette le modifiche).
  const key = clipKey(voiceId, model, opts.sampleSalt ? `${text}|${opts.sampleSalt}` : text);
  return { key, role: line.who, text, model, voiceId, live: !!line.live, chars: text.length };
}

/** Quali chiavi sono già in archivio. */
export async function cachedKeys(db: Db, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db<{ cache_key: string }[]>`select cache_key from tts_clips where cache_key = any(${keys}::text[])`;
  return new Set(rows.map((r) => r.cache_key));
}

// ---------------------------------------------------------------------------
// Contabilità
// ---------------------------------------------------------------------------
export interface AppUsage {
  monthChars: number;
  monthClips: number;
  bySource: Record<TtsSource, number>;
  totalClips: number;
  budget: number;
  remaining: number;
}

export async function appUsage(db: Db = getSql()): Promise<AppUsage> {
  const cfg = await loadVoiceConfig(db);
  const rows = await db<{ source: TtsSource; chars: string | number; clips: number }[]>`
    select source, coalesce(sum(billed_chars), 0) as chars, count(*)::int as clips
    from tts_clips where created_at >= date_trunc('month', now()) and billed_chars > 0
    group by source`;
  const [{ total }] = await db<{ total: number }[]>`select count(*)::int as total from tts_clips`;
  const bySource: Record<TtsSource, number> = { pregen: 0, live: 0, sample: 0 };
  let monthChars = 0;
  let monthClips = 0;
  for (const r of rows) {
    bySource[r.source] = num(r.chars);
    monthChars += num(r.chars);
    monthClips += r.clips;
  }
  return { monthChars, monthClips, bySource, totalClips: total, budget: cfg.monthlyBudgetChars, remaining: Math.max(0, cfg.monthlyBudgetChars - monthChars) };
}

// ---------------------------------------------------------------------------
// Limite di concorrenza e chiamata a ElevenLabs
// ---------------------------------------------------------------------------
let active = 0;
const waiters: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (active < MAX_PARALLEL) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
}

function release() {
  const next = waiters.shift();
  if (next) next(); // il posto passa direttamente al prossimo in coda
  else active--;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function synthesize(plan: PlannedClip, s: RoleVoiceSettings): Promise<{ audio: Buffer; billed: number }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new TtsError("TTS_OFF", "Voce professionale non configurata");
  let withLanguage = true;
  let lastError = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    await acquire();
    let res: Response;
    try {
      res = await fetch(`${API}/v1/text-to-speech/${encodeURIComponent(plan.voiceId)}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text: plan.text,
          model_id: plan.model,
          ...(withLanguage ? { language_code: "it" } : {}),
          voice_settings: modelSupportsTags(plan.model)
            ? { stability: s.stability, similarity_boost: s.similarity }
            : { stability: s.stability, similarity_boost: s.similarity, style: s.style, speed: s.speed, use_speaker_boost: true },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const audio = Buffer.from(await res.arrayBuffer());
        // Crediti addebitati: v4 li dichiara in "character-cost" (totale della richiesta,
        // verificato sull'abbonamento); v2/flash in "x-character-count". In mancanza, la lunghezza del testo.
        const costHeader = res.headers.get("character-cost");
        const cost = costHeader === null ? NaN : Number(costHeader);
        const billed = Number.isFinite(cost) && cost >= 0 ? Math.ceil(cost) : Number(res.headers.get("x-character-count")) || plan.chars;
        return { audio, billed };
      }
      lastError = `${res.status}: ${(await res.text()).slice(0, 200)}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      res = new Response(null, { status: 599 });
    } finally {
      release();
    }
    // Alcuni modelli non accettano language_code: si riprova una volta senza.
    if (res.status === 400 && withLanguage && /language/i.test(lastError)) {
      withLanguage = false;
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(10_000, retryAfter * 1000) : 600 * 2 ** attempt);
      continue;
    }
    break;
  }
  throw new TtsError("TTS_PROVIDER", `ElevenLabs ${lastError}`);
}

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const admin = getSupabaseAdmin();
  const { data } = await admin.storage.getBucket(BUCKET);
  if (!data) await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ["audio/mpeg"] });
  bucketReady = true;
}

// ---------------------------------------------------------------------------
// Generazione (con cache, budget e richieste unificate)
// ---------------------------------------------------------------------------
export interface ClipResult {
  key: string;
  path: string;
  cached: boolean;
  billedChars: number;
}

const inflight = new Map<string, Promise<ClipResult>>();

function pathFor(plan: PlannedClip) {
  return `${plan.role}/${plan.key}.mp3`;
}

/**
 * Restituisce la clip della battuta, generandola solo se manca.
 * `generate: false` → solo cache (null se assente).
 */
export async function ensureClip(db: Db, plan: PlannedClip, source: TtsSource, cfg?: VoiceConfig): Promise<ClipResult> {
  const existing = inflight.get(plan.key);
  if (existing) return existing;
  const p = (async (): Promise<ClipResult> => {
    const path = pathFor(plan);
    const [row] = await db<{ storage_path: string }[]>`
      update tts_clips set last_used_at = now() where cache_key = ${plan.key} returning storage_path`;
    if (row) return { key: plan.key, path: row.storage_path, cached: true, billedChars: 0 };

    // Clip generata prima dell'archivio tts_clips (solo modelli v2/flash): si recupera senza pagarla di nuovo.
    const storage = getSupabaseAdmin().storage.from(BUCKET);
    if (!modelSupportsTags(plan.model)) {
      const legacy = await storage.createSignedUrl(path, 60);
      if (legacy.data?.signedUrl) {
        await recordClip(db, plan, path, source, 0);
        return { key: plan.key, path, cached: true, billedChars: 0 };
      }
    }

    const config = cfg ?? (await loadVoiceConfig(db));
    const usage = await appUsage(db);
    if (usage.monthChars + plan.chars > config.monthlyBudgetChars) {
      throw new TtsError("TTS_BUDGET", `Budget mensile delle voci esaurito (${usage.monthChars}/${config.monthlyBudgetChars} caratteri)`);
    }
    const { audio, billed } = await synthesize(plan, config.roles[plan.role]);
    await ensureBucket();
    const up = await storage.upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (up.error) throw new Error(`Salvataggio audio non riuscito: ${up.error.message}`);
    await recordClip(db, plan, path, source, billed);
    return { key: plan.key, path, cached: false, billedChars: billed };
  })();
  inflight.set(plan.key, p);
  try {
    return await p;
  } finally {
    inflight.delete(plan.key);
  }
}

async function recordClip(db: Db, plan: PlannedClip, path: string, source: TtsSource, billed: number) {
  await db`
    insert into tts_clips (cache_key, role, model, voice_id, text, chars, billed_chars, storage_path, source)
    values (${plan.key}, ${plan.role}, ${plan.model}, ${plan.voiceId}, ${plan.text}, ${plan.chars}, ${billed}, ${path}, ${source})
    on conflict (cache_key) do update set last_used_at = now()`;
}

export async function signedClipUrl(path: string, seconds = 3600): Promise<string> {
  const signed = await getSupabaseAdmin().storage.from(BUCKET).createSignedUrl(path, seconds);
  if (!signed.data?.signedUrl) throw new Error("URL audio non disponibile");
  return signed.data.signedUrl;
}

/** URL firmato dell'mp3 di una battuta (generandolo solo la prima volta). */
export async function ttsUrl(who: TtsRole, text: string, opts: { live?: boolean; source?: TtsSource } = {}): Promise<string> {
  const db = getSql();
  const cfg = await loadVoiceConfig(db);
  const plan = planClip(cfg, { who, text, live: opts.live });
  if (!plan) throw new TtsError("TTS_NO_VOICE", `Nessuna voce assegnata a ${who}`);
  const clip = await ensureClip(db, plan, opts.source ?? (opts.live ? "live" : "pregen"), cfg);
  return signedClipUrl(clip.path);
}

// ---------------------------------------------------------------------------
// Account ElevenLabs (solo pannello admin)
// ---------------------------------------------------------------------------
async function elevenGet<T>(path: string): Promise<T> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new TtsError("TTS_OFF", "Voce professionale non configurata");
  const res = await fetch(`${API}${path}`, { headers: { "xi-api-key": apiKey }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!res.ok) throw new TtsError("TTS_PROVIDER", `ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

export interface SubscriptionInfo {
  tier: string | null;
  used: number;
  limit: number;
  resetAt: string | null;
  status: string | null;
}

export async function subscriptionInfo(): Promise<SubscriptionInfo> {
  const j = await elevenGet<{ tier?: string; character_count?: number; character_limit?: number; next_character_count_reset_unix?: number; status?: string }>(
    "/v1/user/subscription",
  );
  return {
    tier: j.tier ?? null,
    used: j.character_count ?? 0,
    limit: j.character_limit ?? 0,
    resetAt: j.next_character_count_reset_unix ? new Date(j.next_character_count_reset_unix * 1000).toISOString() : null,
    status: j.status ?? null,
  };
}

export interface AccountVoice {
  voiceId: string;
  name: string;
  category: string | null;
  description: string | null;
  labels: Record<string, string>;
  previewUrl: string | null;
}

export async function listAccountVoices(search: string | null, pageToken: string | null): Promise<{ voices: AccountVoice[]; nextPageToken: string | null }> {
  const p = new URLSearchParams({ page_size: "100" });
  if (search) p.set("search", search);
  if (pageToken) p.set("next_page_token", pageToken);
  const j = await elevenGet<{
    voices: { voice_id: string; name: string; category?: string; description?: string | null; labels?: Record<string, string>; preview_url?: string | null }[];
    has_more?: boolean;
    next_page_token?: string | null;
  }>(`/v2/voices?${p.toString()}`);
  return {
    voices: j.voices.map((v) => ({
      voiceId: v.voice_id,
      name: v.name,
      category: v.category ?? null,
      description: v.description ?? null,
      labels: v.labels ?? {},
      previewUrl: v.preview_url ?? null,
    })),
    nextPageToken: j.has_more ? (j.next_page_token ?? null) : null,
  };
}
