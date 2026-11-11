/**
 * Libreria ufficiale delle battute (content/battute/LIBRERIA-UFFICIALE.md → content/show/libreria-ufficiale.json):
 * funzioni PURE condivise da server (regia), TV (tempo che scade) e test.
 *
 * - Livello di comicità: ogni battuta è leggero / sarcastico / irriverente; la regia usa quelle fino al
 *   livello scelto nel pannello (predefinito irriverente).
 * - Condizioni (tags): "gruppo" (parla a più persone), "tutti" (tutti hanno sbagliato), "squadre"
 *   (solo a squadre), "timer30" (cita i trenta secondi), "quattro" (4 opzioni, risposta singola),
 *   "facile"/"difficile", "rimonta", "non_ultima" / "non_finale" (mai sull'ultima domanda del round /
 *   della serata), "countdown" ("tre, due, uno…"), "voce:<tag>" (audio tag scelto a mano).
 * - Testo per la voce: il testo dell'utente resta quello mostrato (sottotitolo/fumetto); per la
 *   sintesi le MAIUSCOLE diventano minuscole (ElevenLabs le leggerebbe come sigle o a caso) e
 *   l'emozione passa agli audio tag v4 già usati nel progetto ([shouts], [excited], [laughs],
 *   [sarcastic], [sighs], [giggles], [clears throat], [whispers]). Palmino: accento siciliano.
 * - Scenette: righe con la stessa scene_key, dette in ordine con le voci dei rispettivi personaggi.
 * - Mancate risposte (PLAYER_NO_ANSWER): solo a tempo scaduto, mai chi è disconnesso, una sola
 *   battuta per domanda, nomi alternati, posizione verificata al momento, contatore lato server.
 */
import type { Presenter } from "@/lib/game-engine/types";
import type { TeamMode } from "@/lib/game-engine/teams";
import { lineFitsMoment, NO_MOMENT, type MomentContext } from "@/features/game/moment";
import {
  COMEDY_LEVELS,
  type ComedyLevel,
  type DialogueTemplate,
  type DirectorConfig,
  type PlayerRef,
  type RevealFacts,
  type ShowEvent,
  type ShowEventType,
  type ShowLine,
  type TeamRef,
} from "./types";

// ---------------------------------------------------------------------------
// Numeri pseudo-casuali stabili (stesso seme → stessa scelta su server, TV e test)
// ---------------------------------------------------------------------------
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Numero stabile in [0, 1). */
export function seededUnit(seed: string): number {
  let t = hash(seed) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** true con probabilità `percent` (0-100), stabile per seme. */
export const chance = (seed: string, percent: number) => seededUnit(seed) * 100 < percent;

// ---------------------------------------------------------------------------
// Livelli di comicità
// ---------------------------------------------------------------------------
export const COMEDY_LEVEL_LABEL: Record<ComedyLevel, string> = {
  leggero: "Leggero (per tutti)",
  sarcastico: "Sarcastico",
  irriverente: "Irriverente (anche parolacce)",
};

export function isComedyLevel(v: unknown): v is ComedyLevel {
  return typeof v === "string" && (COMEDY_LEVELS as readonly string[]).includes(v);
}

/** La battuta (livello `line`) si può dire con l'impostazione `max`? */
export function levelAllowed(line: ComedyLevel | undefined, max: ComedyLevel): boolean {
  return COMEDY_LEVELS.indexOf(line ?? "leggero") <= COMEDY_LEVELS.indexOf(max);
}

// ---------------------------------------------------------------------------
// Testo per la voce
// ---------------------------------------------------------------------------
/** Battuta della libreria ufficiale o aggiunta dal pannello: voce "curata" (maiuscole → audio tag). */
export const isCuratedTemplate = (t: Pick<DialogueTemplate, "origin">) => !!t.origin && t.origin !== "base";

const TAG_RE = /\[[^\][]{1,40}\]/;
const PLACEHOLDER_RE = /\{[a-z_]+\}/g;
/** Sigle che restano maiuscole. */
const ACRONYMS = new Set(["UNESCO", "TV", "OK", "DJ"]);
/** Nomi propri che, scritti in maiuscolo, tornano con l'iniziale maiuscola. */
const PROPER = /^(palmino|professore|professò+|regina|regì|einstein|natale|google|instagram|chatgpt|nobel|maestà|treccani)$/u;

/** Accento di Palmino (audio tag v4; attivabile/disattivabile dal pannello Presentatori). */
export const PALMINO_ACCENT_TAG = "[Sicilian accent]";

/** Quota di lettere maiuscole (segnaposto esclusi). */
export function shoutRatio(text: string): number {
  const letters = text.replace(PLACEHOLDER_RE, "").replace(/\[[^\]]*\]/g, "").match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 0;
  return letters.filter((c) => c !== c.toLocaleLowerCase("it-IT")).length / letters.length;
}

/**
 * Le MAIUSCOLE dell'utente diventano minuscole per la sintesi (le sigle restano), con l'iniziale
 * maiuscola a inizio frase e sui nomi propri. Il testo minuscolo resta com'è; i segnaposto pure.
 */
export function normalizeCaps(text: string): string {
  // il nome dello show resta un nome ("il vincitore di CHE NE SAI?!" → "di Che ne sai?!")
  text = text.replace(/\bCHE NE SAI\b/g, "Che ne sai");
  const out = text.replace(/[\p{L}][\p{L}'’]*/gu, (word, offset: number) => {
    const letters = word.replace(/['’]/g, "");
    const upper = letters === letters.toLocaleUpperCase("it-IT") && letters !== letters.toLocaleLowerCase("it-IT");
    if (!upper) return word;
    // dentro un segnaposto (mai: sono minuscoli) o una sigla
    if (ACRONYMS.has(letters)) return word;
    let w = word.toLocaleLowerCase("it-IT");
    const before = text.slice(0, offset);
    // i puntini di sospensione non chiudono la frase ("Minchia… e ci hai pure pensato!")
    const sentenceStart = /(^|[.!?]\s+|^\s*\[[^\]]*\]\s*)$/u.test(before) || /^\s*["«]?$/.test(before);
    if (sentenceStart || PROPER.test(w.replace(/['’].*$/, ""))) w = w.charAt(0).toLocaleUpperCase("it-IT") + w.slice(1);
    return w;
  });
  return out;
}

type Mood = "negative" | "positive" | "time" | "filler" | "neutral";
const MOOD: Partial<Record<ShowEventType, Mood>> = {
  ANSWER_WRONG: "negative",
  EASY_WRONG: "negative",
  LOSE_PATIENCE: "negative",
  ONLY_ONE_WRONG: "negative",
  NEW_LAST: "negative",
  PLAYER_NO_ANSWER: "negative",
  NO_ANSWER_LEADER: "negative",
  NO_ANSWER_LAST: "negative",
  NO_ANSWER_STREAK: "negative",
  MANY_NO_ANSWER: "negative",
  TEAM_NO_ANSWER: "negative",
  LEADERBOARD_QUIP: "negative",
  WRONG_STREAK: "negative",
  ALL_WRONG: "negative",
  ANSWER_CORRECT: "positive",
  ONLY_ONE_CORRECT: "positive",
  FASTEST_CORRECT: "positive",
  LEADER_CHANGED: "positive",
  LEADER_KEPT: "positive",
  OVERTAKE: "positive",
  COMEBACK: "positive",
  GAME_WINNER: "positive",
  GAME_END: "positive",
  WHEEL_SPIN: "positive",
  TIME_RUNNING_OUT: "time",
  FILLER: "filler",
};
const MOOD_TAGS: Record<Mood, Record<Presenter, readonly string[]>> = {
  negative: { professore: ["[sarcastic]", "[sighs]"], regina: ["[sarcastic]", "[laughs]"], palmino: ["[laughs]", "[giggles]"] },
  positive: { professore: ["[excited]", "[clears throat]"], regina: ["[excited]", "[laughs]"], palmino: ["[excited]", "[giggles]"] },
  time: { professore: ["[clears throat]"], regina: ["[sarcastic]"], palmino: ["[giggles]"] },
  filler: { professore: ["[clears throat]"], regina: ["[laughs]"], palmino: ["[giggles]"] },
  neutral: { professore: [""], regina: [""], palmino: [""] },
};

/** Audio tag scelto per una battuta senza tag scritti a mano. */
export function autoAudioTag(text: string, who: Presenter, event: ShowEventType, tags: readonly string[] = []): string {
  const manual = tags.find((t) => t.startsWith("voce:"));
  if (manual) return `[${manual.slice(5).trim()}]`;
  const mood = MOOD[event] ?? "neutral";
  const ratio = shoutRatio(text);
  // tutta in maiuscolo: urlata; nei momenti belli (indovinato, primo, vincitore) è entusiasmo più che rabbia
  if (ratio >= 0.6) return mood === "positive" ? "[excited]" : "[shouts]";
  // un'esclamazione in maiuscolo ("AMOOOORE, …", "MIIII!") dentro una frase normale
  if (/\b\p{Lu}{4,}\b/u.test(text.replace(PLACEHOLDER_RE, ""))) return "[excited]";
  const pool = MOOD_TAGS[mood][who];
  return pool[hash(text) % pool.length];
}

export interface VoiceOptions {
  palminoAccent?: boolean;
}

/**
 * Testo per la sintesi di una battuta curata (con i segnaposto ancora da riempire): maiuscole
 * normalizzate e audio tag. Se l'autore ha già scritto dei tag li si rispetta (niente tag automatici).
 */
export function curatedVoiceText(t: Pick<DialogueTemplate, "text" | "character" | "event" | "tags">, opts: VoiceOptions = {}): string {
  const body = normalizeCaps(t.text).replace(/\s+/g, " ").trim();
  const lead = TAG_RE.test(t.text) ? "" : autoAudioTag(t.text, t.character, t.event, t.tags ?? []);
  const accent = t.character === "palmino" && opts.palminoAccent ? PALMINO_ACCENT_TAG : "";
  return [accent, lead, body].filter((p) => p.length > 0).join(" ");
}

/** Testo da mostrare: quello scritto, senza audio tag. */
export function displayOf(text: string): string {
  return text
    .replace(/\[[^\][]{1,40}\]/g, " ")
    .replace(/\s+([!?.,…])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Riempie i segnaposto; null se ne manca qualcuno. */
export function fillPlaceholders(text: string, values: Record<string, string>): string | null {
  let missing = false;
  const out = text.replace(PLACEHOLDER_RE, (m) => {
    const v = values[m.slice(1, -1)];
    if (v === undefined || v === "") missing = true;
    return v ?? "";
  });
  return missing ? null : out;
}

export interface RenderedLine {
  /** testo per la sintesi */
  text: string;
  /** testo da mostrare (solo battute curate) */
  display?: string;
  /** con nomi o numeri della serata */
  live: boolean;
}

/**
 * Battuta pronta con i valori dei segnaposto. Le battute di sempre (origin "base") restano identiche
 * a prima (stesse chiavi di cache); quelle curate passano da curatedVoiceText.
 */
export function renderTemplate(t: Pick<DialogueTemplate, "text" | "character" | "event" | "tags" | "origin">, values: Record<string, string>, opts: VoiceOptions = {}): RenderedLine | null {
  if (!isCuratedTemplate(t)) {
    const text = fillPlaceholders(t.text, values);
    return text === null ? null : { text, live: true };
  }
  const voice = fillPlaceholders(curatedVoiceText(t, opts), values);
  const display = fillPlaceholders(displayOf(t.text), values);
  if (voice === null || display === null) return null;
  return { text: voice, display, live: (t.text.match(PLACEHOLDER_RE) ?? []).length > 0 };
}

// ---------------------------------------------------------------------------
// Condizioni (tags)
// ---------------------------------------------------------------------------
export interface LineContext {
  mode?: TeamMode;
  /** durata del timer della domanda (s) */
  timerSeconds?: number | null;
  difficulty?: number | null;
  /** domanda a risposta singola con 4 opzioni */
  fourOptions?: boolean;
  /** quante persone riguarda la battuta (chi ha sbagliato, chi non ha risposto…): "gruppo" ne vuole 2+ */
  group?: number | null;
  /** tutti quelli che hanno risposto hanno sbagliato ("tutti") */
  everyone?: boolean;
  /** c'è stata una rimonta o un sorpasso nel round ("rimonta") */
  comeback?: boolean;
  moment?: MomentContext;
}

/** Le condizioni della battuta valgono in questo contesto? Tag sconosciuti: ignorati. */
export function tagsAllow(tags: readonly string[] | undefined, ctx: LineContext): boolean {
  for (const tag of tags ?? []) {
    switch (tag) {
      case "squadre":
        if (!ctx.mode || ctx.mode === "individual") return false;
        break;
      case "timer30":
        if (ctx.timerSeconds !== 30) return false;
        break;
      case "quattro":
        if (!ctx.fourOptions) return false;
        break;
      case "facile":
        if (ctx.difficulty == null || ctx.difficulty > 2) return false;
        break;
      case "difficile":
        if (ctx.difficulty == null || ctx.difficulty < 4) return false;
        break;
      case "gruppo":
        if (ctx.group != null && ctx.group < 2) return false;
        break;
      case "tutti":
        if (!ctx.everyone) return false;
        break;
      case "rimonta":
        if (!ctx.comeback) return false;
        break;
      case "non_ultima":
        if (ctx.moment?.lastOfRound || ctx.moment?.lastOfGame) return false;
        break;
      case "non_finale":
        if (ctx.moment?.lastOfGame) return false;
        break;
    }
  }
  return true;
}

/** Niente "venerdì" (regola dello spettacolo: le serate non sono sempre di venerdì). */
export const BANNED_WORDS = /\bvenerd[iì]\b/i;

// ---------------------------------------------------------------------------
// Candidati (battute singole e scenette)
// ---------------------------------------------------------------------------
export interface CandidateRow {
  t: DialogueTemplate;
  line: RenderedLine;
}

export interface LibraryCandidate {
  /** id della battuta (o della prima riga della scenetta): cooldown e peso */
  id: string;
  /** chi parla per primo */
  character: Presenter;
  weight: number;
  scene: string | null;
  rows: CandidateRow[];
}

export type Render = (t: DialogueTemplate) => RenderedLine | null;

export interface CandidateInput {
  templates: readonly DialogueTemplate[];
  event: ShowEventType;
  render: Render;
  comedyLevel: ComedyLevel;
  ctx: LineContext;
  lastUsed: ReadonlyMap<string, number>;
  nowMs: number;
  /** già scelte in questo momento */
  used?: ReadonlySet<string>;
  /** scenette ammesse in questo momento */
  allowScenes: boolean;
  /** battute dette nelle ultime serate dello stesso host: peso ridotto (variazione fra serate) */
  elsewhere?: ReadonlySet<string>;
}

/** Peso delle battute già usate nelle ultime serate dello stesso host. */
export const ELSEWHERE_WEIGHT = 0.3;

function rowOk(input: CandidateInput, t: DialogueTemplate): CandidateRow | null {
  if (!t.enabled || t.event !== input.event) return null;
  if (!levelAllowed(t.level, input.comedyLevel)) return null;
  if (!tagsAllow(t.tags, input.ctx)) return null;
  const line = input.render(t);
  if (!line) return null;
  const shown = line.display ?? displayOf(line.text);
  const moment = input.ctx.moment ?? NO_MOMENT;
  if (!lineFitsMoment(shown, moment) || !lineFitsMoment(displayOf(line.text), moment)) return null;
  if (BANNED_WORDS.test(shown)) return null;
  return { t, line };
}

const coolingDown = (input: CandidateInput, t: DialogueTemplate) => {
  const last = input.lastUsed.get(t.id);
  return last !== undefined && input.nowMs - last < t.cooldownSec * 1000;
};

/** Battute (e scenette) utilizzabili per l'evento, con i testi già pronti. */
export function libraryCandidates(input: CandidateInput): LibraryCandidate[] {
  const out: LibraryCandidate[] = [];
  const scenes = new Map<string, DialogueTemplate[]>();
  for (const t of input.templates) {
    if (t.event !== input.event) continue;
    if (t.sceneKey) {
      scenes.set(t.sceneKey, [...(scenes.get(t.sceneKey) ?? []), t]);
      continue;
    }
    if (input.used?.has(t.id) || coolingDown(input, t)) continue;
    const row = rowOk(input, t);
    if (!row) continue;
    out.push({ id: t.id, character: t.character, weight: weightOf(input, t), scene: null, rows: [row] });
  }
  if (!input.allowScenes) return out;
  for (const [key, rows] of scenes) {
    const sorted = [...rows].sort((a, b) => (a.sceneStep ?? 0) - (b.sceneStep ?? 0));
    const first = sorted[0];
    if (sorted.length < 2 || input.used?.has(first.id) || coolingDown(input, first)) continue;
    // una riga disattivata o non adatta al momento: la scenetta non si fa (mai un dialogo a metà)
    const ok = sorted.map((t) => rowOk(input, t));
    if (ok.some((r) => r === null)) continue;
    out.push({ id: first.id, character: first.character, weight: weightOf(input, first), scene: key, rows: ok as CandidateRow[] });
  }
  return out;
}

function weightOf(input: CandidateInput, t: DialogueTemplate): number {
  const w = Math.max(0.1, t.weight);
  return input.elsewhere?.has(t.id) ? w * ELSEWHERE_WEIGHT : w;
}

/** Scelta pesata e deterministica. */
export function pickCandidate<C extends { weight: number }>(pool: readonly C[], seed: string): C | null {
  if (pool.length === 0) return null;
  const total = pool.reduce((a, c) => a + c.weight, 0);
  let r = seededUnit(seed) * total;
  for (const c of pool) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return pool[pool.length - 1];
}

/** Righe pronte per lo stato del TV (una scenetta = più righe nello stesso gruppo). */
export function candidateLines(c: LibraryCandidate, event: ShowEventType, mentions: string[], seed: string): ShowLine[] {
  return c.rows.map((r, i) => {
    const curated = isCuratedTemplate(r.t);
    const line: ShowLine = {
      templateId: r.t.id,
      event,
      who: r.t.character,
      text: r.line.text,
      animation: r.t.animation,
      mentions: i === 0 ? mentions : [],
    };
    if (curated) {
      line.display = r.line.display;
      line.live = r.line.live;
      line.optional = true;
      if (c.scene) line.group = `${c.scene}|${seed}`;
      const tvTags = (r.t.tags ?? []).filter((t) => t === "countdown");
      if (tvTags.length) line.tags = tvTags;
    }
    return line;
  });
}

// ---------------------------------------------------------------------------
// Momenti con un solo evento (soluzione, timer, classifica, podio, ruota)
// ---------------------------------------------------------------------------
/** Distanza minima fra due scenette (non parlare troppo). */
export const SCENE_GAP_MS = 150_000;

export interface MomentPickInput extends Omit<CandidateInput, "allowScenes" | "event"> {
  event: ShowEvent;
  mentions?: string[];
  seed: string;
  /** ultima scenetta detta (ms), per la distanza minima */
  lastSceneMs?: number | null;
  /** scenette ammesse (oltre alla distanza minima); predefinito sì */
  scenes?: boolean;
  /** personaggio preferito (es. Palmino per la classifica e la ruota) */
  prefer?: Presenter | null;
}

export function pickMomentLines(input: MomentPickInput): ShowLine[] {
  const sceneOk = input.scenes !== false && (input.lastSceneMs == null || input.nowMs - input.lastSceneMs >= SCENE_GAP_MS);
  let pool = libraryCandidates({ ...input, event: input.event.type, allowScenes: sceneOk });
  if (input.prefer && pool.some((c) => c.character === input.prefer)) pool = pool.filter((c) => c.character === input.prefer);
  const chosen = pickCandidate(pool, `${input.seed}|${input.event.type}`);
  return chosen ? candidateLines(chosen, input.event.type, input.mentions ?? [], input.seed) : [];
}

// ---------------------------------------------------------------------------
// Soluzione: quale reazione (esito VERO della domanda)
// ---------------------------------------------------------------------------
export interface RevealChoice {
  event: Extract<ShowEvent, { facts: RevealFacts }>;
  ctx: LineContext;
}

/**
 * Evento della reazione alla soluzione, oppure null (nessuno ha risposto: resta la battuta di sempre).
 * - nessuno giusto (2+ risposte): perde la pazienza (spesso se la domanda era facilissima) o "sbagliato";
 * - maggioranza sbagliata: "sbagliata su domanda facilissima" (difficoltà 1) o "sbagliato";
 * - maggioranza giusta: "indovinato".
 */
export function revealChoice(facts: RevealFacts, seed: string): RevealChoice | null {
  const { answered, right } = facts;
  if (answered <= 0) return null;
  const wrong = answered - right;
  const easy = facts.difficulty <= 1;
  const base = { difficulty: facts.difficulty, fourOptions: facts.fourOptions } satisfies LineContext;
  if (right === 0) {
    const patience = answered >= 2 && chance(`${seed}|pazienza`, easy ? 60 : 30);
    const type = patience ? "LOSE_PATIENCE" : easy ? "EASY_WRONG" : "ANSWER_WRONG";
    return { event: { type, facts }, ctx: { ...base, group: wrong, everyone: true } };
  }
  if (wrong > right) return { event: { type: easy ? "EASY_WRONG" : "ANSWER_WRONG", facts }, ctx: { ...base, group: wrong, everyone: false } };
  return { event: { type: "ANSWER_CORRECT", facts }, ctx: { ...base, group: right, everyone: wrong === 0 } };
}

// ---------------------------------------------------------------------------
// Tempo che scade (TV)
// ---------------------------------------------------------------------------
/** Probabilità che una domanda abbia la battuta sul tempo (rara). */
export const TIME_LINE_PERCENT = 30;

/** Stima della durata di una battuta (come autoplay: ~13 caratteri al secondo). */
export function spokenMs(text: string): number {
  const clean = displayOf(text);
  return Math.round((clean.length / 13) * 1000 + 300);
}

/**
 * Quando dire la battuta sul tempo: deve finire PRIMA che il tempo scada (circa 1 s prima), negli
 * ultimi secondi; "tre, due, uno…" proprio alla fine. Restituisce i ms rimasti a cui partire.
 */
export function timeLineStartMs(text: string, tags: readonly string[] = []): number {
  if (tags.includes("countdown")) return 3800;
  return Math.min(10_000, Math.max(4_000, spokenMs(text) + 1_200));
}

/** Il TV può dire adesso la battuta sul tempo? (mai sopra un'altra voce, mai se hanno già risposto tutti) */
export function timeLineDue(p: { remainingMs: number; startAtMs: number; textMs: number; answered: number | null; players: number; voiceBusy: boolean }): boolean {
  if (p.voiceBusy || p.players <= 0) return false;
  if (p.answered !== null && p.answered >= p.players) return false;
  // dentro la finestra: dall'istante scelto fino a quando c'è ancora tempo per finirla
  return p.remainingMs <= p.startAtMs && p.remainingMs >= Math.min(p.startAtMs, p.textMs + 400);
}

// ---------------------------------------------------------------------------
// Mancate risposte
// ---------------------------------------------------------------------------
/** Dopo quanto senza segni di vita un telefono è "disconnesso" (battito ogni 30 s, stato ogni 15 s). */
export const DISCONNECTED_AFTER_MS = 50_000;
/** Lo stesso giocatore non viene preso in giro per il silenzio più di una volta in questo tempo. */
export const NO_ANSWER_COOLDOWN_MS = 240_000;
/** Probabilità della battuta per un silenzio "normale" (le situazioni speciali parlano sempre). */
export const PLAIN_NO_ANSWER_PERCENT = 50;

export interface NoAnswerPlayer extends PlayerRef {
  /** partecipava alla domanda (entrato prima della chiusura) */
  inPlay: boolean;
  answered: boolean;
  /** telefono collegato (ultimo contatto recente) */
  connected: boolean;
  /** posizione ufficiale dopo i punti (null = non classificato) */
  rank: number | null;
  points: number;
  /** mancate risposte consecutive (già aggiornate con questa domanda) */
  streak: number;
  teamId: string | null;
}

export interface NoAnswerInput {
  players: NoAnswerPlayer[];
  mode: TeamMode;
  teams: TeamRef[];
  /** ultima battuta sul silenzio per giocatore (ms) */
  lastMocked: ReadonlyMap<string, number>;
  nowMs: number;
  seed: string;
}

/**
 * Nuovo valore del contatore delle mancate risposte consecutive.
 * Risponde → 0; non risponde da collegato → +1; non risponde da disconnesso → 0 (al rientro si riparte).
 */
export function nextNoAnswerStreak(prev: number, p: { answered: boolean; connected: boolean }): number {
  if (p.answered || !p.connected) return 0;
  return Math.max(0, prev) + 1;
}

/**
 * L'evento sulle mancate risposte di questa domanda (al massimo UNO), oppure null.
 * Mai chi è disconnesso; in modalità "teams" mai un singolo (solo la squadra intera).
 */
export function noAnswerEvent(input: NoAnswerInput): ShowEvent | null {
  const inPlay = input.players.filter((p) => p.inPlay);
  const silent = inPlay.filter((p) => !p.answered && p.connected);
  if (inPlay.length === 0 || silent.length === 0) return null;
  // tanti non rispondono: almeno metà dei giocatori in gioco (e almeno 2)
  if (inPlay.length >= 3 && silent.length >= 2 && silent.length * 2 >= inPlay.length) return { type: "MANY_NO_ANSWER", count: silent.length };

  if (input.mode === "teams") {
    const sleepy = input.teams.filter((t) => {
      const members = inPlay.filter((p) => p.teamId === t.id);
      return members.length > 0 && members.every((m) => !m.answered) && members.some((m) => m.connected);
    });
    const team = pickCandidate(
      sleepy.map((t) => ({ t, weight: 1 })),
      `${input.seed}|squadra-muta`,
    );
    return team ? { type: "TEAM_NO_ANSWER", team: team.t } : null;
  }

  const fresh = silent.filter((p) => {
    const last = input.lastMocked.get(p.id);
    return last === undefined || input.nowMs - last >= NO_ANSWER_COOLDOWN_MS;
  });
  if (fresh.length === 0) return null;
  const ranked = inPlay.filter((p) => p.rank !== null);
  const topRank = ranked.filter((p) => p.rank === 1);
  const lastRank = Math.max(0, ...ranked.map((p) => p.rank!));
  const lastOnes = ranked.filter((p) => p.rank === lastRank);
  const kind = (p: NoAnswerPlayer): { type: ShowEventType; prio: number } => {
    if (p.streak >= 3 && p.streak % 3 === 0) return { type: "NO_ANSWER_STREAK", prio: 4 };
    if (p.rank === 1 && topRank.length === 1 && p.points > 0 && ranked.length >= 2) return { type: "NO_ANSWER_LEADER", prio: 3 };
    if (ranked.length >= 3 && p.rank === lastRank && lastOnes.length === 1 && lastRank > 1) return { type: "NO_ANSWER_LAST", prio: 2 };
    return { type: "PLAYER_NO_ANSWER", prio: 1 };
  };
  // alternanza: prima chi non è mai stato nominato per il silenzio, poi chi lo è stato meno di recente
  const scored = fresh.map((p) => ({ p, k: kind(p), last: input.lastMocked.get(p.id) ?? -1, r: seededUnit(`${input.seed}|${p.id}`) }));
  scored.sort((a, b) => b.k.prio - a.k.prio || a.last - b.last || a.r - b.r);
  const best = scored[0];
  if (best.k.type === "PLAYER_NO_ANSWER" && !chance(`${input.seed}|silenzio`, PLAIN_NO_ANSWER_PERCENT)) return null;
  const who = { id: best.p.id, nickname: best.p.nickname };
  return { type: best.k.type as Extract<ShowEvent, { streak: number }>["type"], who, streak: best.p.streak };
}

// ---------------------------------------------------------------------------
// Ruota (Palmino): da collegare alla ruota girata da Palmino
// ---------------------------------------------------------------------------
export interface WheelLinesInput {
  templates: readonly DialogueTemplate[];
  comedyLevel: ComedyLevel;
  /** seme stabile (es. id del round + numero del giro) */
  seed: string;
  nowMs?: number;
  lastUsed?: ReadonlyMap<string, number>;
  mode?: TeamMode;
  moment?: MomentContext;
  palminoAccent?: boolean;
  /** battute al massimo (Palmino per primo, poi un altro presentatore); predefinito 1 */
  max?: number;
  /** chi parla per primo: predefinito Palmino; null = chiunque (scelta pesata) */
  first?: Presenter | null;
  elsewhere?: ReadonlySet<string>;
}

/**
 * Battute "Durante la ruota" (evento WHEEL_SPIN) per il giro della ruota: Palmino per primo, poi
 * (se `max` > 1) un commento di un altro presentatore. Pura e deterministica (stesso seme → stesse
 * battute): il TV e il pre-riscaldamento delle voci ottengono lo stesso testo.
 */
export function pickWheelLines(input: WheelLinesInput): ShowLine[] {
  const max = Math.max(1, input.max ?? 1);
  const render: Render = (t) => renderTemplate(t, {}, { palminoAccent: input.palminoAccent });
  const base: CandidateInput = {
    templates: input.templates,
    event: "WHEEL_SPIN",
    render,
    comedyLevel: input.comedyLevel,
    ctx: { mode: input.mode, moment: input.moment },
    lastUsed: input.lastUsed ?? new Map(),
    nowMs: input.nowMs ?? 0,
    allowScenes: false,
    elsewhere: input.elsewhere,
  };
  const all = libraryCandidates(base);
  const out: ShowLine[] = [];
  const want = input.first === undefined ? "palmino" : input.first;
  const preferred = want ? all.filter((c) => c.character === want) : all;
  const first = pickCandidate(preferred.length ? preferred : all, `${input.seed}|ruota|1`);
  if (!first) return out;
  out.push(...candidateLines(first, "WHEEL_SPIN", [], input.seed));
  if (max > 1) {
    const others = all.filter((c) => c.character !== first.character);
    const second = pickCandidate(others, `${input.seed}|ruota|2`);
    if (second) out.push(...candidateLines(second, "WHEEL_SPIN", [], input.seed));
  }
  return out.slice(0, max);
}

/** Margine fra la fine della battuta "Durante la ruota" e la fermata della ruota ("Tocca a… X!"). */
export const WHEEL_LINE_MARGIN_MS = 1200;

/**
 * La battuta "Durante la ruota" ci sta ancora? Solo se, partendo adesso, finisce con un margine
 * prima che la ruota si fermi: così non si sovrappone mai al risultato e non lo ritarda.
 */
export function wheelLineFits(msToStop: number, text: string): boolean {
  return msToStop >= spokenMs(text) + WHEEL_LINE_MARGIN_MS;
}

/** Configurazione di regia rilevante per le voci delle battute curate. */
export const voiceOptionsOf = (c: Pick<DirectorConfig, "palminoAccent">): VoiceOptions => ({ palminoAccent: c.palminoAccent });
