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

export const ROUND_KINDS = ["standard", "music", "image", "video", "category_vote", "category_wheel", "bonus", "final", "bet", "comeback"] as const;
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

/** Riga della classifica del ROUND: punti fatti in questo round (e totale della serata, secondario). */
export interface RoundLeaderboardEntry {
  participantId: string;
  rank: number;
  nickname: string;
  /** punti guadagnati (o persi) nel round */
  points: number;
  /** punti totali della serata */
  total: number;
}

/** Classifica del round a squadre (stessa aggregazione della classifica a squadre). */
export interface TeamRoundLeaderboardEntry {
  teamId: string;
  rank: number;
  name: string;
  color: string;
  members: number;
  points: number;
  total: number;
}

/** Chi si gioca la vittoria all'ultima domanda della serata (per la suspense dei presentatori). */
export interface PublicContender {
  name: string;
  points: number;
}

/** Voto per saltare l'intro (solo durante l'intro): si salta se votano TUTTI i giocatori. */
export interface PublicIntroSkip {
  votes: number;
  /** giocatori attivi che contano (tutti devono votare) */
  needed: number;
  /** nomi di chi ha votato (al massimo 12) */
  names: string[];
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
  /**
   * Classifica del ROUND corrente (punti fatti nel round): ai punti dell'ultima domanda del round
   * e nella classifica di fine round. Assente altrove.
   */
  roundLeaderboard?: RoundLeaderboardEntry[] | null;
  /** classifica del round a squadre (modalità squadre), negli stessi momenti */
  teamRoundLeaderboard?: TeamRoundLeaderboardEntry[] | null;
  /** primi della classifica, solo mentre compare l'ultima domanda della serata (suspense) */
  contenders?: PublicContender[] | null;
  /** intro: quanti giocatori vogliono saltarla (null fuori dall'intro) */
  introSkip?: PublicIntroSkip | null;
  /** l'intro è stata saltata per voto unanime (presentazione del primo round) */
  introSkipped?: boolean;
  /**
   * Dove si guarda lo show (gioco libero): "tv" = televisore, i telefoni dicono "Guarda il TV";
   * "phone" = show sul telefono dell'host e su quello di OGNI giocatore (immagini e audio).
   */
  displayMode?: "tv" | "phone";
  pausedFrom: GamePhase | null;
  /** Ultimi nickname entrati (solo lobby). */
  recentPlayers: string[] | null;
  /** battute del regista automatico per il momento corrente: punti di una risposta, inizio finale, saluti in lobby */
  showLines: PublicShowLine[] | null;
  /**
   * Scorrimento automatico: quando è dovuto il prossimo passo (ora del server) e per quale versione.
   * Serve solo a TV e regia per chiamare /tick al momento giusto (nessun cambiamento visibile).
   * Assente o null = scorrimento manuale o nessun passo in programma.
   */
  auto?: PublicAuto | null;
  /**
   * Gioco libero: l'host ha fatto partire la RIVINCITA (nuova partita con lo stesso codice).
   * TV e telefoni di questa partita passano da soli alla nuova.
   */
  rematch?: { sessionId: string } | null;
}

export interface PublicAuto {
  nextAt: string;
  version: number;
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
  "SET_AUTOPLAY",
  "KICK",
  "ADJUST_SCORE",
  "ASSIGN_TEAM",
  "BALANCE_TEAMS",
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
    | "WHEEL_SPINNING"
    | "TIE_NEEDS_ADMIN"
    | "EVENT_NOT_ALLOWED"
    | "EVENT_LIMIT"
    | "NOT_FOUND"
    | "NOT_TEST_SESSION"
    | "VALIDATION"
    | "FORBIDDEN"
    | "AUTO_NOT_DUE";
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
