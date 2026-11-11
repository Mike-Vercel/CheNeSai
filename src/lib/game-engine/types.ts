/**
 * Tipi condivisi del motore di gioco.
 * Questo modulo NON dipende da React, Next.js o dal database: descrive le
 * regole e i dati che TV, smartphone e regia si scambiano.
 */

export const GAME_PHASES = [
  "DRAFT",
  "READY",
  "LOBBY",
  "INTRO",
  "ROUND_INTRO",
  "QUESTION_VISIBLE",
  "OPTIONS_VISIBLE",
  "ANSWERS_LOCKED",
  "ANSWER_REVEAL",
  "SCORE_REVEAL",
  "LEADERBOARD",
  "CATEGORY_VOTING",
  "CATEGORY_RESULT",
  "SPECIAL_EVENT",
  "PAUSED",
  "FINISHED",
] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

export const PRESENTERS = ["professore", "regina", "palmino"] as const;
export type Presenter = (typeof PRESENTERS)[number];

export const ROUND_KINDS = ["standard", "music", "image", "video", "category_vote", "bonus", "final", "bet", "comeback"] as const;
export type RoundKind = (typeof ROUND_KINDS)[number];

/** Quote di puntata della manche "Scommetti tutto" (percentuale dei propri punti). */
export const BET_TIERS = [0, 25, 50, 100] as const;
export type BetTier = (typeof BET_TIERS)[number];

/** Impostazioni di una manche speciale (annunciate all'inizio del round). */
export type RoundSpecialSettings =
  | { kind: "bet"; minStake: number; defaultTier: BetTier }
  | { kind: "comeback"; boostMultiplier: number; leaderPenaltyMultiplier: number };

export interface SpecialPlayerRef {
  participantId: string;
  nickname: string;
}

/**
 * Regole speciali della domanda, congelate con le altre regole a MOSTRA RISPOSTE.
 * - bet: la posta la sceglie ogni giocatore (giusta +posta, sbagliata o nessuna risposta −posta);
 * - comeback: chi insegue (metà bassa della classifica) ha il BOOST sui punti guadagnati,
 *   il capolista (se configurato) una penalità maggiorata.
 */
export type SpecialRules =
  | { kind: "bet"; minStake: number; defaultTier: BetTier }
  | {
      kind: "comeback";
      boostMultiplier: number;
      leaderPenaltyMultiplier: number;
      boosted: SpecialPlayerRef[];
      leaders: SpecialPlayerRef[];
    };

export const QUESTION_TYPES = ["single", "multiple"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const MEDIA_KINDS = ["image", "audio", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const SPECIAL_EVENT_TYPES = [
  "double_points",
  "no_penalty",
  "lightning",
  "super_bonus",
  "mystery_question",
  "impossible_comeback",
  "palmino_decides",
  "finalissima",
] as const;
export type SpecialEventType = (typeof SPECIAL_EVENT_TYPES)[number];

export const SESSION_STATUSES = ["draft", "ready", "live", "finished", "archived"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Parametri di un evento speciale (tutti opzionali, validati alla creazione). */
export interface SpecialEventParams {
  correctMultiplier?: number;
  wrongMultiplier?: number;
  bonusPoints?: number;
  durationSeconds?: number;
}

/** Regole effettive di una domanda, già annunciate prima dell'apertura delle risposte. */
export interface QuestionRules {
  correctPoints: number;
  wrongPenalty: number;
  noAnswerPenalty: number;
  bonusPoints: number;
  durationSeconds: number;
  partialScoring: boolean;
  speedBonusMax: number;
  allowNegative: boolean;
  /** Etichette leggibili delle modifiche applicate (round + eventi). */
  modifiers: string[];
  /** Manche speciale (Scommetti tutto, Grande ribaltone); assente nelle domande normali. */
  special?: SpecialRules | null;
}

export interface PublicOption {
  position: number;
  text: string;
}

export interface PublicMedia {
  id: string;
  kind: MediaKind;
  audioStartMs: number;
  audioDurationMs: number | null;
  audioPlays: number;
}

export interface PublicQuestion {
  id: string;
  number: number;
  totalInRound: number;
  positionInRound: number;
  type: QuestionType;
  text: string;
  category: string;
  difficulty: number;
  presenter: Presenter;
  media: PublicMedia | null;
  /** null finché l'admin non preme MOSTRA RISPOSTE. */
  options: PublicOption[] | null;
  rules: QuestionRules;
  openedAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
  /** null fino alla rivelazione: mai presente prima nel payload. */
  correctPositions: number[] | null;
  /** Distribuzione delle risposte, solo dopo la rivelazione. */
  distribution: number[] | null;
  answeredCount: number | null;
  animation: string | null;
  /** Solo nella manche "Scommetti tutto". */
  bets?: PublicBets | null;
}

export interface PublicBetHighlight {
  participantId: string;
  nickname: string;
  tier: BetTier;
  stake: number;
  delta: number;
}

/** Puntate della domanda: mai la posta dei singoli prima della chiusura, solo conteggi. */
export interface PublicBets {
  /** puntate scelte dai giocatori (quelle predefinite non contano) */
  placed: number;
  /** chiuse a MOSTRA RISPOSTE */
  locked: boolean;
  /** quanti giocatori per quota (dopo la chiusura) */
  distribution: { tier: BetTier; count: number }[] | null;
  /** posta totale in gioco (dopo la chiusura) */
  totalStake: number | null;
  /** grandi vincite e grandi perdite (dopo i punti) */
  wins: PublicBetHighlight[] | null;
  losses: PublicBetHighlight[] | null;
}

export interface PublicRound {
  id: string;
  index: number;
  total: number;
  title: string;
  kind: RoundKind;
  presenter: Presenter;
  description: string | null;
  pointsMultiplier: number;
  penaltyMultiplier: number;
  noPenalty: boolean;
  /** Impostazioni della manche speciale (null nei round normali). */
  special?: RoundSpecialSettings | null;
}

export interface PublicEvent {
  id: string;
  type: SpecialEventType;
  title: string;
  tagline: string;
  params: SpecialEventParams;
  source: "manual" | "scheduled" | "palmino_decides";
  animation: string;
  sound: string;
  targetQuestionId: string | null;
}

export interface PublicVoteOption {
  id: string;
  position: number;
  label: string;
  votes: number | null;
}

export interface PublicVote {
  roundId: string;
  options: PublicVoteOption[];
  openedAt: string | null;
  closesAt: string | null;
  closedAt: string | null;
  liveResults: boolean;
  totalVotes: number | null;
  winnerOptionId: string | null;
  tieBreak: { method: TieBreakMethod; tiedOptionIds: string[] } | null;
}

export interface LeaderboardEntry {
  participantId: string;
  rank: number;
  previousRank: number | null;
  nickname: string;
  points: number;
  lastDelta: number;
  correctCount: number;
}

/** Battuta del regista automatico (con i nomi veri già inseriti). */
export interface PublicShowLine {
  who: Presenter;
  text: string;
  animation: string | null;
  event: string;
}

export interface PublicState {
  sessionId: string;
  code: string;
  title: string;
  isTest: boolean;
  phase: GamePhase;
  version: number;
  serverNow: string;
  phaseStartedAt: string;
  joinLocked: boolean;
  allowLateJoin: boolean;
  playerCount: number;
  questionsPlayed: number;
  totalQuestions: number;
  /** Intro in corso: inizio (orologio server) e punteggi base della serata, mostrati nelle regole. */
  intro: { startedAt: string; scoring: { correct: number; wrong: number; noAnswer: number } } | null;
  round: PublicRound | null;
  question: PublicQuestion | null;
  event: PublicEvent | null;
  vote: PublicVote | null;
  leaderboard: LeaderboardEntry[] | null;
  pausedFrom: GamePhase | null;
  /** Ultimi nickname entrati (solo lobby). */
  recentPlayers: string[] | null;
  /** battute del regista automatico per il momento corrente (dopo i punti di una risposta) */
  showLines: PublicShowLine[] | null;
}

export type TieBreakMethod = "random" | "admin" | "first";

export const COMMANDS = [
  "OPEN_LOBBY",
  "START_INTRO",
  "SKIP_INTRO",
  "START_ROUND",
  "START_VOTE",
  "CLOSE_VOTE",
  "SHOW_QUESTION",
  "SHOW_OPTIONS",
  "CLOSE_ANSWERS",
  "REVEAL",
  "SCORE",
  "SHOW_LEADERBOARD",
  "ACTIVATE_EVENT",
  "PAUSE",
  "RESUME",
  "FINISH",
  "SET_JOIN",
  "KICK",
  "ADJUST_SCORE",
  "RESET_TEST",
  "SIM_ADD_BOTS",
  "SIM_BOTS_ANSWER",
  "SIM_BOTS_VOTE",
  "SIM_BOTS_BET",
] as const;
export type GameCommand = (typeof COMMANDS)[number];

export interface CommandError {
  code:
    | "INVALID_TRANSITION"
    | "VERSION_CONFLICT"
    | "NO_MORE_QUESTIONS"
    | "NO_MORE_ROUNDS"
    | "TIMER_RUNNING"
    | "TIE_NEEDS_ADMIN"
    | "EVENT_NOT_ALLOWED"
    | "EVENT_LIMIT"
    | "NOT_FOUND"
    | "NOT_TEST_SESSION"
    | "VALIDATION"
    | "FORBIDDEN";
  message: string;
  details?: Record<string, unknown>;
}

export class GameError extends Error {
  readonly code: CommandError["code"];
  readonly details?: Record<string, unknown>;
  constructor(code: CommandError["code"], message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "GameError";
    this.code = code;
    this.details = details;
  }
}
