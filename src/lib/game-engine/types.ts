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
  "WHEEL_SPIN",
  "PAUSED",
  "FINISHED",
] as const;
export type GamePhase = (typeof GAME_PHASES)[number];

export const PRESENTERS = ["professore", "regina", "palmino"] as const;
export type Presenter = (typeof PRESENTERS)[number];

export const ROUND_KINDS = ["standard", "music", "image", "video", "category_vote", "category_wheel", "bonus", "final"] as const;
export type RoundKind = (typeof ROUND_KINDS)[number];

/** Round con categorie (domande assegnate a una categoria; se ne gioca una sola). */
export const CATEGORY_ROUND_KINDS: readonly RoundKind[] = ["category_vote", "category_wheel"];
export function isCategoryRound(kind: RoundKind | string | null | undefined): boolean {
  return kind === "category_vote" || kind === "category_wheel";
}
/** Numero massimo di categorie: 4 per la votazione (tasti A-D sul telefono), 8 spicchi per la ruota. */
export function maxCategories(kind: RoundKind): number {
  return kind === "category_wheel" ? 8 : 4;
}
export const MIN_CATEGORIES = 2;
/**
 * Tipo di round usato per le regole degli eventi speciali: la ruota segue le stesse
 * regole del voto di categoria (allowed_round_kinds delle definizioni).
 */
export function eventRoundKind(kind: RoundKind): RoundKind {
  return kind === "category_wheel" ? "category_vote" : kind;
}

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

/** Spicchio della ruota (stesso ordine per position su server, TV e telefoni). */
export interface PublicWheelSegment {
  id: string;
  position: number;
  label: string;
}

/** Giro deciso dal server: ogni TV disegna la stessa animazione dagli stessi numeri. */
export interface PublicWheelSpin {
  /** Inizio dell'animazione (ora del server; può essere di poco nel futuro). */
  startedAt: string;
  durationMs: number;
  turns: number;
  /** Punto di arrivo dentro lo spicchio vincente (0..1). */
  landing: number;
  /** Rotazione finale totale in gradi (senso orario). */
  rotationDeg: number;
  winnerIndex: number;
  winnerOptionId: string;
  /** In pausa: millisecondi di giro già trascorsi (la ruota resta ferma lì). */
  frozenElapsedMs: number | null;
}

export interface PublicWheel {
  roundId: string;
  segments: PublicWheelSegment[];
  spin: PublicWheelSpin | null;
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

/** Squadra della serata (stato pubblico: nessun dato personale dei membri). */
export interface PublicTeam {
  id: string;
  name: string;
  color: string;
  position: number;
  members: number;
}

/** Riga della classifica a squadre (mai attribuita a un singolo giocatore). */
export interface TeamLeaderboardEntry {
  teamId: string;
  rank: number;
  previousRank: number | null;
  name: string;
  color: string;
  members: number;
  points: number;
  lastDelta: number;
}

export interface PublicTeamsInfo {
  mode: "teams" | "both";
  selfSelect: boolean;
  aggregation: "sum" | "average";
  list: PublicTeam[];
}

/** Battuta del regista automatico (con i nomi veri già inseriti). */
export interface PublicShowLine {
  who: Presenter;
  text: string;
  animation: string | null;
  event: string;
  /** id nel registro delle battute (per riconoscere i saluti nuovi della lobby) */
  id?: string;
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
  /** Ruota impazzita del round corrente (presentazione e giro). */
  wheel: PublicWheel | null;
  leaderboard: LeaderboardEntry[] | null;
  /** modalità squadre attiva (null = partita individuale) */
  teams: PublicTeamsInfo | null;
  /** classifica a squadre, nelle stesse fasi della classifica individuale */
  teamLeaderboard: TeamLeaderboardEntry[] | null;
  pausedFrom: GamePhase | null;
  /** Ultimi nickname entrati (solo lobby). */
  recentPlayers: string[] | null;
  /** battute del regista automatico per il momento corrente: punti di una risposta, inizio finale, saluti in lobby */
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
  "SPIN_WHEEL",
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
  "ASSIGN_TEAM",
  "BALANCE_TEAMS",
  "RESET_TEST",
  "SIM_ADD_BOTS",
  "SIM_BOTS_ANSWER",
  "SIM_BOTS_VOTE",
] as const;
export type GameCommand = (typeof COMMANDS)[number];

export interface CommandError {
  code:
    | "INVALID_TRANSITION"
    | "VERSION_CONFLICT"
    | "NO_MORE_QUESTIONS"
    | "NO_MORE_ROUNDS"
    | "TIMER_RUNNING"
    | "WHEEL_SPINNING"
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
