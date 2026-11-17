import { z } from "zod";
import type { InputMode, ScoreOutput, TeamOutcome } from "./games/contract";

/**
 * TAVOLI IN GUERRA! — tipi condivisi tra server e client (stato pubblico, viste private, azioni).
 * Lo stato vive SOLO nel database; i client ricevono lo stato pubblico (TV, tutti) e la propria vista
 * privata (telefono/PC del giocatore, regia dell'organizzatore).
 */

// ---------------------------------------------------------------------------
// Macchina a stati della serata (PIANO §3)
// ---------------------------------------------------------------------------
export const EVENT_STATES = [
  "DRAFT",
  "LOBBY_OPEN",
  "LOBBY_LOCKED",
  "INTRO",
  "ROUND_INTRO",
  "GAME_ACTIVE",
  "GAME_RESULTS",
  "LEADERBOARD",
  "BREAK",
  "FINAL",
  "AWARDS",
  "COMPLETED",
  "PAUSED",
  "CANCELLED",
] as const;
export type EventState = (typeof EVENT_STATES)[number];

export type AccessMode = "qr" | "code";
export type GameKind = "regular" | "caos" | "tiebreak";
export type Difficulty = "facile" | "media" | "difficile";

/** Chiavi dei segmenti della scaletta (PDF §02). */
export const SEGMENT_KEYS = ["lobby", "m1", "m2", "m3", "break", "m4", "m5", "awards"] as const;
export type SegmentKey = (typeof SEGMENT_KEYS)[number];

export const MANCHE_TITLES: Record<number, string> = {
  1: "CHI PARTE MALE...",
  2: "FREGALI TUTTI!",
  3: "IL PUB DECIDE!",
  4: "IL GRANDE INGANNO",
  5: "TUTTO O NIENTE!",
};
export const MANCHE_TAGLINES: Record<number, string> = {
  1: "Memoria, osservazione, logica, intuizione. Nessun attacco: si scaldano i motori.",
  2: "Sfide, poteri e duelli tra tavoli. La rivalità riguarda solo la classifica.",
  3: "Voti, previsioni e psicologia del locale. Un voto per tavolo.",
  4: "Bluff, indizi e mini-misteri. Le bugie sono del gioco, mai vostre.",
  5: "Puntate, scelte prudenti o rischiose e l'ultimo ribaltamento.",
};

// ---------------------------------------------------------------------------
// Configurazione della serata (wizard della regia)
// ---------------------------------------------------------------------------
export const MIN_TABLES = 2;
/**
 * Massimo 12 squadre (deciso dal proprietario: per ora 12, come le mascotte, così ognuna ha la sua).
 * Arena 3D, LED e QR in TV reggono anche di più: se in futuro servono altre squadre basta alzare questo numero.
 */
export const MAX_TABLES = 12;
export const MASCOT_SLOTS = 12;
export const MIN_DURATION = 90;
export const MAX_DURATION = 120;
export const DEFAULT_DURATION = 115;

export const segmentsSchema = z
  .object({
    lobby: z.number().int().min(1).max(60),
    m1: z.number().int().min(3).max(60),
    m2: z.number().int().min(3).max(60),
    m3: z.number().int().min(3).max(60),
    break: z.number().int().min(0).max(60),
    m4: z.number().int().min(3).max(60),
    m5: z.number().int().min(3).max(60),
    awards: z.number().int().min(1).max(30),
  })
  .partial();
export type SegmentOverrides = z.infer<typeof segmentsSchema>;

export const eventConfigSchema = z
  .object({
    venue: z.string().trim().min(2, "Scrivi il nome del locale").max(60, "Nome del locale troppo lungo"),
    tables: z.number().int().min(MIN_TABLES, `Servono almeno ${MIN_TABLES} tavoli`).max(MAX_TABLES, `Al massimo ${MAX_TABLES} tavoli`),
    durationMin: z.number().int().min(MIN_DURATION).max(MAX_DURATION).default(DEFAULT_DURATION),
    accessMode: z.enum(["qr", "code"]).default("qr"),
    /** modalità standard: ogni mascotte a un solo tavolo */
    mascotUnique: z.boolean().default(true),
    /** PIN a 4 cifre per tavolo, mostrato dallo staff (facoltativo) */
    staffPin: z.boolean().default(false),
    /** soglie di Energia Caos per i livelli 2 e 3 */
    chaosLevel2: z.number().int().min(10).max(1000).default(60),
    chaosLevel3: z.number().int().min(20).max(2000).default(150),
    /** TUTTO O NIENTE!: la regia nasconde la classifica generale (ogni squadra vede sempre il proprio saldo) */
    hideScoresInFinal: z.boolean().default(false),
    segments: segmentsSchema.default({}),
  })
  .refine((c) => c.chaosLevel3 > c.chaosLevel2, { message: "La soglia del livello 3 deve superare quella del livello 2", path: ["chaosLevel3"] })
  .refine((c) => !c.mascotUnique || c.tables <= MASCOT_SLOTS, { message: `Con le mascotte uniche servono al massimo ${MASCOT_SLOTS} tavoli`, path: ["tables"] });
export type EventConfig = z.infer<typeof eventConfigSchema>;
export type EventConfigInput = z.input<typeof eventConfigSchema>;

// ---------------------------------------------------------------------------
// Stato pubblico (TV, tutti: MAI soluzioni prima del reveal, MAI codici se ?live=1 lato client)
// ---------------------------------------------------------------------------
export interface PublicTeam {
  teamId: string;
  tableNo: number;
  /** nome approvato dallo staff; finché non è approvato si mostra «TAVOLO N» */
  name: string;
  approved: boolean;
  color: string;
  mascotSlot: number | null;
  mascotLevel: 1 | 2 | 3;
  /** null quando la regia nasconde la classifica (TUTTO O NIENTE!) */
  score: number | null;
  rank: number | null;
  /** variazione dall'ultima prova (per l'animazione della classifica) */
  delta: number | null;
  energy: number;
  /** 0..1 verso il prossimo livello */
  chaosProgress: number;
  online: boolean;
  members: number;
  shield: boolean;
  caosUsed: boolean;
  wins: number;
}

export type GameStage = "rule" | "play" | "locked" | "reveal";

export interface PublicGame {
  id: string;
  code: string;
  title: string;
  rule: string;
  input: InputMode;
  kind: GameKind;
  mancheNo: number;
  slotNo: number;
  participants: string[];
  startsAt: string;
  deadlineAt: string;
  timerMs: number;
  stage: GameStage;
  /** publicView della meccanica (uguale per tutti, senza soluzione) */
  view: unknown;
  submittedTeamIds: string[];
  /** solo nel reveal */
  reveal: unknown | null;
  outcome: ScoreOutput | null;
  winnerTeamId: string | null;
  betEnabled: boolean;
  /** la vista cambia col passare del tempo (indizi che si aprono, scena che sparisce): i client rileggono più spesso */
  timed?: boolean;
}

export interface TigEventNote {
  kind: string;
  at: string;
  data?: Record<string, unknown>;
}

export interface Spotlight {
  kind: "duel" | "chaos" | "evolve" | "winner" | "sabotage" | "attack" | "shield";
  teamIds: string[];
  eventId: string;
  level?: number;
}

export interface PlanManche {
  mancheNo: number;
  title: string;
  games: number;
  minutes: number;
  played: number;
}

export interface TigPublicState {
  eventId: string;
  version: number;
  secretRev: number;
  serverNow: string;
  status: "open" | "closed";
  closeReason: string | null;
  state: EventState;
  pausedFrom: EventState | null;
  venue: string;
  accessMode: AccessMode;
  lateJoin: boolean;
  manche: { no: number; title: string; tagline: string; gameIndex: number; gamesTotal: number } | null;
  timer: { startedAt: string | null; deadlineAt: string | null; totalMs: number | null } | null;
  teams: PublicTeam[];
  pendingTeams: number;
  game: PublicGame | null;
  spotlight: Spotlight | null;
  caosWindow: boolean;
  hideScores: boolean;
  awards: { order: string[] } | null;
  event: TigEventNote | null;
  plan: PlanManche[];
  breakEndsAt: string | null;
  chaosThresholds: { level2: number; level3: number };
}

/** Tavoli per la lobby della TV (QR e codici): mai nella vista live. */
export interface LobbyTable {
  tableNo: number;
  token: string;
  code: string;
  teamName: string | null;
  members: number;
  approved: boolean;
}

// ---------------------------------------------------------------------------
// Vista privata del giocatore
// ---------------------------------------------------------------------------
export interface MemberInfo {
  memberId: string;
  nickname: string;
  online: boolean;
  isCaptain: boolean;
  isMe: boolean;
}

export interface CaosTarget {
  teamId: string;
  tableNo: number;
  name: string;
  allowed: boolean;
  why: string | null;
}

export interface PlayerView {
  role: "player";
  me: { memberId: string; nickname: string; teamId: string; isCaptain: boolean };
  team: {
    teamId: string;
    tableNo: number;
    name: string;
    approved: boolean;
    color: string;
    score: number;
    rank: number | null;
    energy: number;
    level: 1 | 2 | 3;
    nextThreshold: number | null;
    chaosProgress: number;
    mascotSlot: number | null;
    mascotConfirmed: boolean;
    members: MemberInfo[];
    shieldActive: boolean;
    caosUsed: boolean;
    wins: number;
  };
  mascot: { open: boolean; myVote: number | null; tally: Record<string, number>; taken: number[]; canConfirm: boolean; unique: boolean };
  game: {
    id: string;
    memberView: unknown | null;
    participant: boolean;
    canSubmit: boolean;
    submitted: boolean;
    outcome: TeamOutcome | null;
    bet: { allowed: boolean; cap: number; amount: number | null };
  } | null;
  caos: { available: boolean; windowOpen: boolean; reason: string | null; targets: CaosTarget[] };
  shield: { canActivate: boolean; active: boolean; reason: string | null };
}

// ---------------------------------------------------------------------------
// Vista della regia
// ---------------------------------------------------------------------------
export interface RegiaTable {
  tableId: string;
  tableNo: number;
  token: string;
  code: string;
  pin: string | null;
  team: {
    teamId: string;
    name: string;
    approved: boolean;
    status: "active" | "kicked";
    captainMemberId: string | null;
    mascotSlot: number | null;
    score: number;
    energy: number;
    level: number;
    online: number;
    members: { memberId: string; nickname: string; online: boolean; isCaptain: boolean; status: string; lastSeenAt: string }[];
  } | null;
}

export interface RegiaLogEntry {
  id: number;
  kind: string;
  audit: boolean;
  reason: string | null;
  fromState: string | null;
  toState: string | null;
  at: string;
  data: Record<string, unknown> | null;
}

export interface RegiaGameInfo {
  id: string;
  mancheNo: number;
  slotNo: number;
  kind: GameKind;
  code: string;
  title: string;
  status: string;
  submissions: number;
  expected: number;
}

export interface RegiaView {
  role: "organizer";
  config: EventConfig;
  displayKey: string;
  tables: RegiaTable[];
  log: RegiaLogEntry[];
  games: RegiaGameInfo[];
  segments: { key: SegmentKey; label: string; minutes: number; games: number | null }[];
  displayOnline: boolean;
  canRollback: boolean;
  canSkip: boolean;
  catalog: { implemented: number; total: number; available: number };
}

export interface TigView {
  state: TigPublicState;
  view: PlayerView | RegiaView | null;
}

// ---------------------------------------------------------------------------
// Azioni (validate dal server)
// ---------------------------------------------------------------------------
const idem = z.string().min(8).max(80);
const reason = z.string().trim().max(200).optional();
export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("tick") }),
  // regia
  z.object({ action: z.literal("open_lobby") }),
  z.object({ action: z.literal("lock_lobby") }),
  z.object({ action: z.literal("unlock_lobby") }),
  z.object({ action: z.literal("late_join"), open: z.boolean() }),
  z.object({ action: z.literal("approve_team"), teamId: z.uuid(), approved: z.boolean().default(true) }),
  z.object({ action: z.literal("rename_team"), teamId: z.uuid(), name: z.string().max(60) }),
  z.object({ action: z.literal("kick_team"), teamId: z.uuid(), reason }),
  z.object({ action: z.literal("kick_member"), memberId: z.uuid() }),
  z.object({ action: z.literal("set_captain"), memberId: z.uuid() }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("pause"), reason }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("skip"), reason }),
  z.object({ action: z.literal("rollback"), reason: z.string().trim().min(3, "Scrivi il motivo").max(200) }),
  z.object({ action: z.literal("set_segments"), segments: z.record(z.string(), z.number().int().min(0).max(60)) }),
  z.object({ action: z.literal("end_event"), reason }),
  z.object({ action: z.literal("cancel_event"), reason: z.string().trim().min(3, "Scrivi il motivo").max(200) }),
  z.object({ action: z.literal("assign_mascot"), teamId: z.uuid(), slot: z.number().int().min(1).max(MASCOT_SLOTS).nullish() }),
  // giocatori
  z.object({ action: z.literal("vote_mascot"), slot: z.number().int().min(1).max(MASCOT_SLOTS) }),
  z.object({ action: z.literal("confirm_mascot") }),
  z.object({ action: z.literal("captain_rename"), name: z.string().max(60) }),
  z.object({ action: z.literal("submit"), gameId: z.uuid(), payload: z.unknown(), idempotencyKey: idem }),
  z.object({ action: z.literal("bet"), gameId: z.uuid(), amount: z.number().int().min(0).max(250), idempotencyKey: idem }),
  z.object({ action: z.literal("caos"), targetTeamId: z.uuid(), idempotencyKey: idem }),
  z.object({ action: z.literal("shield"), idempotencyKey: idem }),
  z.object({ action: z.literal("leave") }),
]);
export type TigAction = z.infer<typeof actionSchema>;

/** Azioni riservate alla regia. */
export const ORGANIZER_ACTIONS = new Set<TigAction["action"]>([
  "open_lobby",
  "lock_lobby",
  "unlock_lobby",
  "late_join",
  "approve_team",
  "rename_team",
  "kick_team",
  "kick_member",
  "set_captain",
  "start",
  "pause",
  "resume",
  "skip",
  "rollback",
  "set_segments",
  "end_event",
  "cancel_event",
  "assign_mascot",
]);

export const joinSchema = z
  .object({
    token: z.string().max(100).optional(),
    code: z.string().max(12).optional(),
    nickname: z.string().max(60),
    teamName: z.string().max(60).optional(),
    pin: z.string().max(8).optional(),
  })
  .refine((v) => !!v.token || !!v.code, { message: "Serve il QR o il codice del tavolo" });
export type JoinInput = z.infer<typeof joinSchema>;

export interface JoinPreview {
  eventId: string;
  venue: string;
  state: EventState;
  status: "open" | "closed";
  tableNo: number;
  team: { teamId: string; name: string; approved: boolean; members: number } | null;
  /** squadra a cui appartiene già questo account in questa serata */
  mine: { teamId: string; tableNo: number; sameTable: boolean } | null;
  needsPin: boolean;
  canCreate: boolean;
  canJoin: boolean;
  blockedReason: string | null;
  suggestedNickname: string | null;
}

export interface MyEvent {
  eventId: string;
  venue: string;
  state: EventState;
  role: "organizer" | "player";
  tables: number;
  updatedAt: string;
}
