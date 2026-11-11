import "server-only";
import { after } from "next/server";
import { getSql, num, type Db } from "@/lib/database/db";
import { PRESENTERS } from "@/lib/game-engine/types";
import { nameVariants, PREWARM_NUMBERS, segmentPause, splitByNames, type SpeechSegment } from "@/features/game/name-segments";
import { stripAudioTags, type SpokenLine } from "@/features/game/script";
import { concatMp3 } from "./mp3";
import { isPublicSession } from "./public-session";
import {
  cachedKeys,
  downloadClip,
  ensureClip,
  loadVoiceConfig,
  planClip,
  planPart,
  signedClipUrl,
  storeClip,
  TtsError,
  ttsConfigured,
  type ClipResult,
  type NamesMode,
  type PartKind,
  type PlannedClip,
  type TtsSource,
  type VoiceConfig,
} from "./tts";

/**
 * "Nomi salvati": le battute live con i nickname non si generano più intere.
 * 1. si cercano nel testo i nomi dei giocatori (e delle squadre) della serata;
 * 2. la battuta si divide in parti fisse (uguali in ogni serata) e parti con i nomi
 *    (archivio per voce e modello, riusato in TUTTE le serate: "Gigi" si paga una volta);
 * 3. si generano solo le parti che mancano, si uniscono gli mp3 senza ricodifica e il
 *    risultato si salva come clip della FRASE INTERA (stessa chiave di sempre): il TV riceve
 *    un normale URL firmato e la stessa richiesta, la volta dopo, è un semplice hit di cache.
 * Se qualcosa va storto si torna alla frase intera (la voce non si rompe mai); il budget
 * esaurito si comporta come prima (TTS_BUDGET → voce del browser sul TV).
 */

/**
 * Silenzio massimo in coda a una parte (mai aggiunto), secondo come finisce: senza punteggiatura
 * quasi niente; virgola/due punti come la pausa di una frase detta intera (~100 ms misurati);
 * fine frase come lo stacco fra due frasi (~250 ms). Una parte generata da sola termina come
 * una battuta intera (fino a ~300 ms di coda): senza limite la frase composta si allunga.
 */
const TAIL_MS = { none: 30, comma: 110, stop: 260 } as const;
/** Contesto per l'intonazione delle parti (previous_text/next_text): al massimo questi caratteri. */
const CONTEXT_CHARS = 200;

/** Testo per il contesto: senza audio tag, spazi compattati. */
const contextText = (parts: string[]) => stripAudioTags(parts.join(" ")).replace(/\s+/g, " ").trim();

/**
 * Contesto generico per i nomi preparati in anticipo (non c'è ancora una battuta vera):
 * dipende dalla punteggiatura, così "Gigi," suona come un richiamo e "Gigi!" come un annuncio.
 */
const NAME_VARIANT_CONTEXT: Record<"none" | "comma" | "stop" | "exclaim", { previous?: string; next?: string }> = {
  none: { previous: "Che colpo di scena:", next: "è in testa alla classifica!" },
  comma: { next: "sei davvero un fenomeno, stasera!" },
  exclaim: { previous: "E il vincitore della serata è…" },
  stop: { previous: "Adesso al comando della classifica c'è" },
};

/** Contesto generico per i numeri piccoli preparati in anticipo (serie, posizioni, "e altri N"). */
const NUMBER_PREWARM_CONTEXT = { previous: "Ne ha azzeccate", next: "di fila, che serie!" };

/** Parte della battuta → tipo di clip in archivio. */
const partKind = (s: SpeechSegment): PartKind => (s.kind === "fixed" ? "segment" : s.kind);

export interface LineClipOptions {
  /** serata della battuta: servono i nomi dei suoi giocatori */
  sessionId?: string | null;
  /** forza la modalità (es. futura "Gioca ora" pubblica: sempre "spliced"); altrimenti quella del pannello Voci */
  namesMode?: NamesMode;
  source?: TtsSource;
}

/** Modalità effettiva: quella forzata dal chiamante, altrimenti l'impostazione del pannello Voci. */
export function resolveNamesMode(cfg: Pick<VoiceConfig, "namesMode">, override?: NamesMode | null): NamesMode {
  return override ?? cfg.namesMode;
}

/** Nickname dei giocatori e nomi delle squadre della serata (come finiscono nelle battute). */
export async function sessionSpeechNames(db: Db, sessionId: string): Promise<string[]> {
  const rows = await db<{ name: string }[]>`
    select nickname as name from participants where session_id = ${sessionId}
    union
    select name from teams where session_id = ${sessionId}`;
  return rows.map((r) => r.name);
}

export interface SplicePlan {
  whole: PlannedClip;
  parts: { segment: SpeechSegment; plan: PlannedClip }[];
}

/** Piano delle parti di una battuta live (null = niente da dividere: frase intera). */
export function planSplice(cfg: VoiceConfig, whole: PlannedClip, names: readonly string[]): SplicePlan | null {
  if (!whole.live) return null;
  const segments = splitByNames(whole.text, names);
  if (!segments || segments.length < 2) return null;
  const parts: SplicePlan["parts"] = [];
  for (const [i, segment] of segments.entries()) {
    const plan = planPart(cfg, whole.role, segment.text, partKind(segment), whole.model);
    if (!plan) return null;
    // intonazione: la parte "sa" cosa viene prima e dopo nella frase (la prima generazione vince in archivio)
    const previous = contextText(segments.slice(0, i).map((s) => s.text)).slice(-CONTEXT_CHARS);
    const next = contextText(segments.slice(i + 1).map((s) => s.text)).slice(0, CONTEXT_CHARS);
    plan.context = { ...(previous ? { previous } : {}), ...(next ? { next } : {}) };
    parts.push({ segment, plan });
  }
  return { whole, parts };
}

const inflight = new Map<string, Promise<ClipResult>>();

/** Genera le parti mancanti, le unisce e salva la frase intera. */
async function spliceClip(db: Db, cfg: VoiceConfig, sp: SplicePlan): Promise<ClipResult> {
  const results = await Promise.all(sp.parts.map((p) => ensureClip(db, p.plan, partKind(p.segment), cfg)));
  const audios = await Promise.all(results.map((r) => r.audio ?? downloadClip(r.path)));
  const joined = concatMp3(
    audios.map((audio, i) => {
      const last = i === audios.length - 1;
      // pause fra le parti come in una frase detta intera (l'ultima parte resta com'è)
      return { audio, tailMs: last ? undefined : TAIL_MS[segmentPause(sp.parts[i].segment.text)] };
    }),
  );
  const billed = results.reduce((a, r) => a + r.billedChars, 0);
  const synthesizedChars = results.reduce((a, r, i) => a + (r.cached ? 0 : sp.parts[i].plan.chars), 0);
  const saved = Math.max(0, sp.whole.chars - synthesizedChars);
  const path = await storeClip(db, sp.whole, joined.audio, "spliced", 0, saved);
  return { key: sp.whole.key, path, cached: false, billedChars: billed };
}

/**
 * Clip di una battuta: per le battute live di una serata con la modalità "nomi salvati"
 * compone la frase dalle parti in archivio; in tutti gli altri casi è ensureClip di sempre.
 */
export async function ensureLineClip(db: Db, cfg: VoiceConfig, line: SpokenLine, opts: LineClipOptions = {}): Promise<ClipResult> {
  const whole = planClip(cfg, line);
  if (!whole) throw new TtsError("TTS_NO_VOICE", `Nessuna voce assegnata a ${line.who}`);
  const source = opts.source ?? (whole.live ? "live" : "pregen");
  if (!whole.live || !opts.sessionId || resolveNamesMode(cfg, opts.namesMode) !== "spliced") return ensureClip(db, whole, source, cfg);
  // già in archivio (intera o composta): hit di cache come sempre
  if ((await cachedKeys(db, [whole.key])).has(whole.key)) return ensureClip(db, whole, source, cfg);
  const running = inflight.get(whole.key);
  if (running) return running;

  const sessionId = opts.sessionId;
  const p = (async (): Promise<ClipResult> => {
    let sp: SplicePlan | null = null;
    try {
      sp = planSplice(cfg, whole, await sessionSpeechNames(db, sessionId));
    } catch (e) {
      console.warn("[quizzone] nomi della serata non disponibili", e instanceof Error ? e.message : e);
    }
    if (!sp) return ensureClip(db, whole, source, cfg);
    try {
      return await spliceClip(db, cfg, sp);
    } catch (e) {
      // budget esaurito: come oggi (il TV usa la voce del browser)
      if (e instanceof TtsError && e.code === "TTS_BUDGET") throw e;
      console.warn("[quizzone] battuta con i nomi salvati non riuscita, si genera intera", e instanceof Error ? e.message : e);
      return ensureClip(db, whole, source, cfg);
    }
  })();
  inflight.set(whole.key, p);
  try {
    return await p;
  } finally {
    inflight.delete(whole.key);
  }
}

/** URL firmato dell'mp3 di una battuta (con i nomi salvati per le battute live della serata). */
export async function ttsLineUrl(line: SpokenLine, opts: LineClipOptions = {}): Promise<string> {
  const db = getSql();
  const cfg = await loadVoiceConfig(db);
  const clip = await ensureLineClip(db, cfg, line, opts);
  return signedClipUrl(clip.path);
}

// ---------------------------------------------------------------------------
// Nomi preparati all'ingresso del giocatore
// ---------------------------------------------------------------------------
/**
 * Genera (se mancano) le varianti più usate del nome ("Gigi", "Gigi,", "Gigi!", "Gigi.")
 * con le voci dei tre presentatori, a bassa priorità: le battute del TV passano prima.
 */
export async function prewarmNameClips(db: Db, cfg: VoiceConfig, nickname: string, opts: { namesMode?: NamesMode } = {}): Promise<{ generated: number; billedChars: number }> {
  if (resolveNamesMode(cfg, opts.namesMode) !== "spliced") return { generated: 0, billedChars: 0 };
  const plans = PRESENTERS.flatMap((who) =>
    nameVariants(nickname).map((v) => {
      const plan = planPart(cfg, who, v, "name");
      if (plan) plan.context = NAME_VARIANT_CONTEXT[v.endsWith("!") ? "exclaim" : segmentPause(v)];
      return plan;
    }),
  ).filter((p) => p !== null);
  const cached = await cachedKeys(db, plans.map((p) => p.key));
  const todo = plans.filter((p) => !cached.has(p.key));
  const results = await Promise.allSettled(todo.map((p) => ensureClip(db, p, "name", cfg, { priority: "low" })));
  let generated = 0;
  let billedChars = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    generated++;
    billedChars += r.value.billedChars;
  }
  return { generated, billedChars };
}

/**
 * Numeri piccoli (1–20, forma semplice) per i tre presentatori: serie, posizioni, domande,
 * "e altri N". Costo una tantum minimo (~60 clip da 1–2 caratteri), poi gratis per sempre.
 */
export async function prewarmNumberClips(db: Db, cfg: VoiceConfig, opts: { namesMode?: NamesMode } = {}): Promise<{ generated: number; billedChars: number }> {
  if (resolveNamesMode(cfg, opts.namesMode) !== "spliced") return { generated: 0, billedChars: 0 };
  const plans = PRESENTERS.flatMap((who) =>
    PREWARM_NUMBERS.map((n) => {
      const plan = planPart(cfg, who, n, "number");
      if (plan) plan.context = NUMBER_PREWARM_CONTEXT;
      return plan;
    }),
  ).filter((p) => p !== null);
  const cached = await cachedKeys(db, plans.map((p) => p.key));
  const results = await Promise.allSettled(plans.filter((p) => !cached.has(p.key)).map((p) => ensureClip(db, p, "number", cfg, { priority: "low" })));
  let generated = 0;
  let billedChars = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    generated++;
    billedChars += r.value.billedChars;
  }
  return { generated, billedChars };
}

/**
 * All'ingresso di un nuovo giocatore: nomi preparati in background (mai bloccante).
 * Partite libere (`sessionId` pubblica): sempre "nomi salvati".
 */
export function scheduleNamePrewarm(nickname: string, sessionId: string | null = null): void {
  try {
    if (!ttsConfigured() || process.env.VITEST) return;
    after(async () => {
      try {
        const db = getSql();
        const namesMode = sessionId && (await isPublicSession(sessionId, db)) ? "spliced" : undefined;
        await prewarmNameClips(db, await loadVoiceConfig(db), nickname, { namesMode });
      } catch (e) {
        console.warn("[quizzone] preparazione del nome non riuscita", e instanceof Error ? e.message : e);
      }
    });
  } catch {
    // fuori da una richiesta: niente preparazione
  }
}

// ---------------------------------------------------------------------------
// Statistiche per il pannello Voci
// ---------------------------------------------------------------------------
export interface NamesArchiveStats {
  /** nomi diversi in archivio (senza punteggiatura e maiuscole) */
  names: number;
  /** clip di nomi (varianti per voce e punteggiatura) */
  nameClips: number;
  /** numeri diversi in archivio e clip di numeri (varianti per voce e punteggiatura) */
  numbers: number;
  numberClips: number;
  /** parti fisse in archivio */
  segments: number;
  /** battute composte */
  spliced: number;
  /** caratteri risparmiati rispetto alle frasi intere (stima, da sempre / nel mese) */
  savedChars: number;
  monthSavedChars: number;
}

export async function namesArchiveStats(db: Db = getSql()): Promise<NamesArchiveStats> {
  const [r] = await db<{ names: number; name_clips: number; numbers: number; number_clips: number; segments: number; spliced: number; saved: string | number; month_saved: string | number }[]>`
    select
      count(distinct lower(regexp_replace(text, '[[:punct:][:space:]…]+$', ''))) filter (where source = 'name')::int as names,
      count(*) filter (where source = 'name')::int as name_clips,
      count(distinct regexp_replace(text, '[^0-9,-]+$', '')) filter (where source = 'number')::int as numbers,
      count(*) filter (where source = 'number')::int as number_clips,
      count(*) filter (where source = 'segment')::int as segments,
      count(*) filter (where source = 'spliced')::int as spliced,
      coalesce(sum(saved_chars), 0) as saved,
      coalesce(sum(saved_chars) filter (where created_at >= date_trunc('month', now())), 0) as month_saved
    from tts_clips where source in ('name', 'number', 'segment', 'spliced')`;
  return {
    names: r?.names ?? 0,
    nameClips: r?.name_clips ?? 0,
    numbers: r?.numbers ?? 0,
    numberClips: r?.number_clips ?? 0,
    segments: r?.segments ?? 0,
    spliced: r?.spliced ?? 0,
    savedChars: num(r?.saved ?? 0),
    monthSavedChars: num(r?.month_saved ?? 0),
  };
}
