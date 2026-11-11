import type { GameCommand, GamePhase, RoundKind } from "./types";

/**
 * SCORRIMENTO AUTOMATICO della serata (funzione pura, nessun database).
 *
 * In automatico la serata esegue da sola la stessa sequenza di comandi che premerebbe la regia:
 *   INTRO → INIZIA ROUND → (AVVIA/CHIUDI VOTAZIONE | GIRA LA RUOTA) → MOSTRA DOMANDA → MOSTRA RISPOSTE
 *   → (timer) → RIVELA SOLUZIONE → ASSEGNA PUNTEGGI → … → MOSTRA CLASSIFICA (fine round)
 *   → INIZIA ROUND → … → TERMINA PARTITA (podio finale).
 * Ogni passo aspetta che il presentatore abbia finito di parlare sul TV più una breve pausa;
 * il timer delle risposte e quello della votazione scorrono per intero.
 *
 * Restano alla regia: aprire la lobby e far partire la serata (AVVIA INTRO o INIZIA ROUND),
 * la pausa, gli eventi manuali e le decisioni (es. parità nella votazione con "Decide la regia").
 */

export const ADVANCE_MODES = ["manual", "auto"] as const;
export type AdvanceMode = (typeof ADVANCE_MODES)[number];

export const ADVANCE_MODE_LABELS: Record<AdvanceMode, string> = {
  manual: "Manuale",
  auto: "Automatico",
};

/**
 * Respiro dopo l'ultima battuta, prima del passo successivo (breve: niente silenzi). Con il TV
 * collegato il passo parte comunque appena il TV dice di aver finito (vedi reportTvSpeech).
 */
export const AUTO_BREATH_MS = 600;
/** Passo mai prima di così (anche quando tutto è già "scaduto"): la regia ha il tempo di vedere cosa succede. */
export const AUTO_MIN_STEP_MS = 1000;
/** Appena attivato l'automatico a fase in corso: un attimo prima di muoversi. */
export const AUTO_SWITCH_DELAY_MS = 3000;
/** Margine dopo la scadenza del timer (risposte o voti), oltre alla tolleranza di rete del server. */
export const AUTO_TIMER_MARGIN_MS = 1200;
/** Scommetti tutto: tempo per puntare dal telefono dopo che la domanda è stata letta. */
export const AUTO_BET_WINDOW_MS = 10_000;
/**
 * Intro 3D completa con la spiegazione delle regole: 29,8 s di sigla + ~1,2 s di attesa sulla
 * battuta di Palmino + ~69 s di regole (clip in public/audio/regole: somma delle durate + 0,6 s
 * ciascuna). Misurata sulle clip registrate, con un piccolo margine.
 */
export const AUTO_INTRO_MS = 104_000;
/**
 * Durata minima a schermo di ogni fase (il tempo delle animazioni del TV), anche se il presentatore
 * tace: solo quanto serve, così in automatico non restano silenzi.
 */
export const AUTO_MIN_PHASE_MS: Partial<Record<GamePhase, number>> = {
  ROUND_INTRO: 4000,
  CATEGORY_RESULT: 3000,
  SPECIAL_EVENT: 3500,
  QUESTION_VISIBLE: 2500,
  ANSWERS_LOCKED: 1200,
  ANSWER_REVEAL: 3000,
  SCORE_REVEAL: 4000,
  LEADERBOARD: 6000,
};
/** Risposte aperte senza un orario di chiusura (non dovrebbe succedere): attesa prudente. */
const OPTIONS_FALLBACK_MS = 30_000;

export interface AutoplayContext {
  phase: GamePhase;
  roundKind: RoundKind | null;
  /** categoria del round già decisa (voto chiuso o ruota girata) */
  voteDone: boolean;
  hasNextQuestion: boolean;
  hasNextRound: boolean;
  /** ora del server (ms) */
  now: number;
  /** inizio della fase corrente (ms, ora del server) */
  phaseStartedAt: number;
  /** quanto parla il TV entrando in questa fase (ms, stima dalle clip vere) */
  speechMs: number;
  /** INTRO: inizio della sigla */
  introStartedAt: number | null;
  /** OPTIONS_VISIBLE: chiusura delle risposte (già comprende la lettura delle risposte) */
  answersCloseAt: number | null;
  /** CATEGORY_VOTING: chiusura della votazione */
  voteClosesAt: number | null;
  /** WHEEL_SPIN: quando la ruota si ferma */
  wheelStopsAt: number | null;
  /** WHEEL_SPIN: battuta detta quando la ruota si ferma */
  wheelStopSpeechMs: number;
  /** QUESTION_VISIBLE: media della domanda (l'audio parte dopo la lettura, il video insieme) */
  media: { kind: "audio" | "video"; ms: number } | null;
  /** QUESTION_VISIBLE nella manche "Scommetti tutto": tempo per puntare */
  betRound: boolean;
  /** attesa minima da adesso (es. appena attivato l'automatico) */
  minDelayMs?: number;
}

export type AutoplayPlan =
  | { kind: "step"; command: GameCommand; dueAt: number }
  | { kind: "wait"; reason: string }
  | { kind: "idle" };

/** Motivi di attesa mostrati in regia ("In attesa della regia: …"). */
export const AUTO_WAIT_REASONS = {
  ready: "apri la lobby per far entrare i giocatori",
  lobby: "quando i giocatori sono entrati premi AVVIA INTRO (o INIZIA ROUND): da lì la serata va da sola",
  paused: "serata in pausa, premi RIPRENDI per ripartire",
} as const;

/** Prossimo comando della sequenza (lo stesso che suggerisce la regia) e quando eseguirlo. */
export function planAutoplay(ctx: AutoplayContext): AutoplayPlan {
  const cmd = nextAutoCommand(ctx);
  if (cmd === null) return { kind: "idle" };
  if (typeof cmd === "object") return cmd;
  const at = Math.max(dueAt(ctx), ctx.now + Math.max(AUTO_MIN_STEP_MS, ctx.minDelayMs ?? 0));
  return { kind: "step", command: cmd, dueAt: Math.round(at) };
}

function nextAutoCommand(ctx: AutoplayContext): GameCommand | { kind: "wait"; reason: string } | null {
  const afterRound: GameCommand = ctx.hasNextRound ? "START_ROUND" : "FINISH";
  switch (ctx.phase) {
    case "DRAFT":
    case "FINISHED":
      return null;
    case "READY":
      return { kind: "wait", reason: AUTO_WAIT_REASONS.ready };
    case "LOBBY":
      return { kind: "wait", reason: AUTO_WAIT_REASONS.lobby };
    case "PAUSED":
      return { kind: "wait", reason: AUTO_WAIT_REASONS.paused };
    case "INTRO":
      return afterRound;
    case "ROUND_INTRO":
      if (ctx.roundKind === "category_vote" && !ctx.voteDone) return "START_VOTE";
      if (ctx.roundKind === "category_wheel" && !ctx.voteDone) return "SPIN_WHEEL";
      return ctx.hasNextQuestion ? "SHOW_QUESTION" : afterRound;
    case "CATEGORY_VOTING":
      return "CLOSE_VOTE";
    case "CATEGORY_RESULT":
    case "WHEEL_SPIN":
      // categoria senza domande (non dovrebbe succedere): si chiude il round con la classifica
      return ctx.hasNextQuestion ? "SHOW_QUESTION" : "SHOW_LEADERBOARD";
    case "SPECIAL_EVENT":
      return "SHOW_QUESTION";
    case "QUESTION_VISIBLE":
      return "SHOW_OPTIONS";
    case "OPTIONS_VISIBLE":
      // a tempo scaduto la regia passa direttamente alla soluzione
      return "REVEAL";
    case "ANSWERS_LOCKED":
      return "REVEAL";
    case "ANSWER_REVEAL":
      return "SCORE";
    case "SCORE_REVEAL":
      // la classifica si mostra solo a fine round
      return ctx.hasNextQuestion ? "SHOW_QUESTION" : "SHOW_LEADERBOARD";
    case "LEADERBOARD":
      return ctx.hasNextQuestion ? "SHOW_QUESTION" : afterRound;
  }
}

/** Istante (ms, ora del server) in cui il passo è dovuto, prima dei minimi. */
function dueAt(ctx: AutoplayContext): number {
  const start = ctx.phaseStartedAt;
  const talk = (phase: GamePhase, extra = 0) => start + Math.max(ctx.speechMs + extra, AUTO_MIN_PHASE_MS[phase] ?? 0) + AUTO_BREATH_MS;
  switch (ctx.phase) {
    case "INTRO":
      return Math.max((ctx.introStartedAt ?? start) + AUTO_INTRO_MS, start + ctx.speechMs) + AUTO_BREATH_MS;
    case "CATEGORY_VOTING":
      return Math.max(ctx.voteClosesAt !== null ? ctx.voteClosesAt + AUTO_TIMER_MARGIN_MS : start + 15_000, start + ctx.speechMs + AUTO_BREATH_MS);
    case "WHEEL_SPIN": {
      const stop = Math.max(ctx.wheelStopsAt ?? start, start + ctx.speechMs);
      return stop + ctx.wheelStopSpeechMs + AUTO_BREATH_MS;
    }
    case "QUESTION_VISIBLE": {
      // audio: il TV lo fa partire DOPO la lettura; video: parte insieme alla domanda
      const audio = ctx.media?.kind === "audio" ? ctx.media.ms : 0;
      const video = ctx.media?.kind === "video" ? ctx.media.ms : 0;
      const read = Math.max(ctx.speechMs + audio, video, AUTO_MIN_PHASE_MS.QUESTION_VISIBLE ?? 0);
      return start + read + (ctx.betRound ? AUTO_BET_WINDOW_MS : 0) + AUTO_BREATH_MS;
    }
    case "OPTIONS_VISIBLE":
      return ctx.answersCloseAt !== null ? ctx.answersCloseAt + AUTO_TIMER_MARGIN_MS + AUTO_BREATH_MS : start + OPTIONS_FALLBACK_MS;
    default:
      return talk(ctx.phase);
  }
}

/**
 * Stima della durata di una battuta senza clip in archivio: ~13 caratteri al secondo (come la stima
 * della lettura delle risposte in read-time.ts, prudente per le voci ElevenLabs) più l'attacco.
 * Gli audio tag ([laughs], [excited]…) non si leggono.
 */
export function estimateSpeechMs(text: string): number {
  const clean = text.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return 0;
  return Math.round((clean.length / 13) * 1000 + 300);
}
