/**
 * GIRAMENTE! – tipi, costanti e schemi condivisi da server e client.
 * «La ruota gira. La mente decide.»
 *
 * Il gioco ragiona su un'entità astratta, il CONCORRENTE (competitor): un giocatore (modalità
 * individuale) o una squadra (modalità a squadre). Punteggi, Jolly, turni e prove sono del concorrente.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Costanti di gioco
// ---------------------------------------------------------------------------
export const ROUND_COUNT = 5;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const MIN_TEAMS = 2;
export const MAX_TEAMS = 4;
export const MIN_TEAM_MEMBERS = 2;
export const MAX_TEAM_MEMBERS = 6;
export const NICKNAME_MAX = 20;
export const TEAM_NAME_MAX = 20;
export const ROOM_CODE_LENGTH = 6;
/** niente 0/O, 1/I/L: si leggono male sul TV */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type DeviceMode = "shared" | "personal";
export type GameMode = "individual" | "teams";
export type Difficulty = "facile" | "media" | "difficile";
export type Risk = "verde" | "rosso";
export type JollyPower = "occhio" | "scudo";

/** Spicchi della ruota (contratto condiviso con la ruota 3D). */
export type WheelKind = "intruso" | "sequenza" | "indizi" | "prospettiva" | "mistero" | "jolly" | "bonus" | "colpo";
export type PuzzleKind = "intruso" | "sequenza" | "indizi" | "prospettiva";
export const PUZZLE_KINDS: PuzzleKind[] = ["intruso", "sequenza", "indizi", "prospettiva"];

/** Archivi degli enigmi. */
export type PuzzlePool = "ruota" | "falsa_pista" | "collegamento" | "finale" | "tabellone";
export const PUZZLE_POOLS: PuzzlePool[] = ["ruota", "falsa_pista", "collegamento", "finale", "tabellone"];

/** Prove di una manche. */
export type Stage = "wheel" | "falsa" | "collegamento" | "tabellone" | "finale" | "tiebreak";

export type Phase =
  | "LOBBY"
  | "INTRO"
  | "ROUND_INTRO"
  | "TURN_READY"
  | "CHOICE"
  | "SPIN"
  | "SPINNING"
  | "WHEEL_RESULT"
  | "QUESTION"
  | "TURN_RESULT"
  | "PLAY"
  | "REVEAL"
  | "ROUND_RESULTS"
  | "FINAL";

export interface RoundInfo {
  no: number;
  name: string;
  /** regolamento sintetico (schermata introduttiva) */
  rules: string[];
  wheel: boolean;
}

export const ROUNDS: RoundInfo[] = [
  {
    no: 1,
    name: "SI ACCENDE LA MENTE",
    wheel: true,
    rules: ["Scegli VERDE (+150, se sbagli 0) o ROSSO (+300, se sbagli −100).", "Gira la ruota: decide il tipo di enigma.", "30 secondi per rispondere."],
  },
  {
    no: 2,
    name: "LA FALSA PISTA",
    wheel: false,
    rules: ["Quattro indizi: tre portano alla stessa soluzione, uno è ingannevole.", "Trova la falsa pista (+100) e scrivi la soluzione (+100).", "Due enigmi a testa. Le risposte si scoprono alla fine."],
  },
  {
    no: 3,
    name: "GIRA E RISCHIA",
    wheel: true,
    rules: ["Enigmi più difficili. VERDE +200 / 0, ROSSO +400 / −150.", "I Jolly si possono usare: Occhio Furbo e Scudo.", "Il punteggio non scende mai sotto zero."],
  },
  {
    no: 4,
    name: "IL COLLEGAMENTO",
    wheel: false,
    rules: ["Prima prova: tre parole, un concetto comune. 250 punti, 100 se chiedi il quarto indizio.", "Seconda prova: IL TABELLONE SEGRETO. Indovina la frase nascosta: fino a 250 punti.", "Svelare lettere e indizi abbassa il punteggio (minimo 100)."],
  },
  {
    no: 5,
    name: "IL GIRO DECISIVO",
    wheel: true,
    rules: ["Un giro a testa, niente Jolly, Bonus o penalità.", "Indizi a sblocco: 600, 400 o 200 punti.", "Un solo tentativo, 45 secondi. Vince chi ha più punti."],
  },
];

export const roundInfo = (no: number): RoundInfo | null => ROUNDS.find((r) => r.no === no) ?? null;

// ---------------------------------------------------------------------------
// Impostazioni
// ---------------------------------------------------------------------------
export const settingsSchema = z.object({
  difficulty: z.enum(["facile", "media", "difficile"]).default("media"),
  /** secondi per rispondere nelle manche con la ruota */
  answerSec: z.number().int().min(15).max(90).default(30),
  /** sfida lampo (Colpo di scena) */
  lampoSec: z.number().int().min(8).max(30).default(12),
  /** la Falsa Pista: tempo per i due enigmi insieme */
  falsaSec: z.number().int().min(45).max(240).default(100),
  collegamentoSec: z.number().int().min(20).max(120).default(45),
  tabelloneSec: z.number().int().min(30).max(120).default(60),
  finaleSec: z.number().int().min(20).max(120).default(45),
  /** introduzioni e animazioni brevi */
  quickIntros: z.boolean().default(false),
});
export type Settings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

export const teamInputSchema = z.object({
  name: z.string().max(60),
  /** solo dispositivo condiviso: i componenti (nomi) */
  members: z.array(z.string().max(60)).max(MAX_TEAM_MEMBERS).optional(),
});

export const createRoomSchema = z.object({
  devices: z.enum(["shared", "personal"]),
  mode: z.enum(["individual", "teams"]),
  settings: settingsSchema.partial().optional(),
  /** dispositivo condiviso, individuale: i nomi dei concorrenti (il primo può essere chi crea) */
  players: z.array(z.string().max(60)).max(MAX_PLAYERS).optional(),
  /** modalità a squadre: nomi delle squadre (e, nel dispositivo condiviso, i componenti) */
  teams: z.array(teamInputSchema).max(MAX_TEAMS).optional(),
  /** dispositivi personali: nickname di chi crea (gioca anche lui) */
  hostNickname: z.string().max(60).optional(),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

// ---------------------------------------------------------------------------
// Azioni (validate dal server)
// ---------------------------------------------------------------------------
const uuid = z.uuid();
const requestId = z.string().min(8).max(64);
export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("tick") }),
  z.object({ action: z.literal("start_game") }),
  z.object({ action: z.literal("skip") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("choose_risk"), choice: z.enum(["verde", "rosso"]) }),
  z.object({ action: z.literal("spin"), requestId }),
  z.object({ action: z.literal("choose_jolly"), power: z.enum(["occhio", "scudo"]) }),
  z.object({ action: z.literal("colpo"), accept: z.boolean() }),
  z.object({ action: z.literal("start_turn") }),
  z.object({ action: z.literal("use_occhio"), playId: uuid }),
  z.object({ action: z.literal("next_clue"), playId: uuid }),
  z.object({ action: z.literal("reveal_letter"), playId: uuid }),
  z.object({ action: z.literal("board_hint"), playId: uuid }),
  z.object({
    action: z.literal("answer"),
    playId: uuid,
    requestId,
    choice: z.number().int().min(0).max(3).optional(),
    falseIndex: z.number().int().min(0).max(3).optional(),
    text: z.string().max(120).optional(),
  }),
  z.object({ action: z.literal("join_team"), competitorId: uuid }),
  z.object({ action: z.literal("set_team"), participantId: uuid, competitorId: uuid }),
  z.object({ action: z.literal("set_captain"), participantId: uuid }),
  z.object({ action: z.literal("kick"), participantId: uuid }),
  z.object({ action: z.literal("update_settings"), settings: settingsSchema.partial() }),
  z.object({ action: z.literal("leave") }),
  z.object({ action: z.literal("close_room") }),
]);
export type GiramenteAction = z.infer<typeof actionSchema>;

// ---------------------------------------------------------------------------
// Stato pubblico (telefoni, TV, canale realtime): MAI soluzioni prima del momento giusto
// ---------------------------------------------------------------------------
export interface PublicTimer {
  startedAt: string | null;
  deadlineAt: string | null;
  /** totale del timer (per la barra) */
  totalMs: number | null;
}

export interface PublicCompetitor {
  id: string;
  kind: "player" | "team";
  name: string;
  seat: number;
  score: number;
  jolly: JollyPower | null;
  members: { id: string; nickname: string; captain: boolean; online: boolean }[];
  online: boolean;
  /** prova in corso (contemporanea o a turno): ha già consegnato tutto */
  done: boolean;
}

export interface PublicParticipant {
  id: string;
  nickname: string;
  kind: "account" | "local";
  competitorId: string | null;
  captain: boolean;
  online: boolean;
  isHost: boolean;
}

export interface Standing {
  competitorId: string;
  position: number;
  score: number;
}

export interface WheelSpinPublic {
  spinId: string;
  targetIndex: number;
  startedAt: string;
  durationMs: number;
}

/** Enigma visibile a tutti (manche con la ruota e finale): mai la soluzione prima del risultato. */
export interface PublicQuestion {
  playId: string;
  pool: PuzzlePool;
  kind: PuzzleKind | null;
  category: string | null;
  prompt: string;
  clues: string[];
  visual: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  options: string[] | null;
  /** finale: indizi sbloccati (1–3) e punti in palio */
  clueLevel: number;
  clueCount: number;
  /** OCCHIO FURBO usato: l'indizio extra (previsto nell'enigma) */
  extraClue: string | null;
  pointsAtStake: number;
  timer: PublicTimer;
}

export interface TurnResult {
  playId: string;
  competitorId: string;
  correct: boolean;
  timeout: boolean;
  /** risposta data (testo dell'opzione o testo scritto) */
  given: string | null;
  solution: string;
  explanation: string | null;
  /** punti per voce (base, bonus, lampo, penalità annullata…) */
  lines: { label: string; delta: number }[];
  delta: number;
  shieldUsed: boolean;
}

export interface PublicTurn {
  competitorId: string;
  playId: string;
  no: number;
  of: number;
  risk: Risk | null;
  sector: WheelKind | null;
  /** il concorrente sta scegliendo un potere della Jolly (ne ha già uno: +50) */
  jolly: { offer: boolean; duplicate: boolean; chosen: JollyPower | null } | null;
  /** Colpo di scena: sfida lampo offerta / accettata */
  colpo: { offered: boolean; accepted: boolean | null } | null;
  bonus: boolean;
  lampo: boolean;
}

/** Tabellone: solo forma delle parole e lettere scoperte. */
export type BoardCellData = { kind: "letter"; char: string | null; justRevealed?: boolean } | { kind: "space" } | { kind: "punct"; char: string };

export interface PublicStage {
  stage: Stage;
  /** contemporanea (dispositivi personali) o a turno (dispositivo condiviso) */
  simultaneous: boolean;
  timer: PublicTimer;
  /** a turno: chi sta giocando */
  competitorId: string | null;
  turnNo: number;
  turnOf: number;
  /** contemporanea: il contenuto comune SENZA soluzioni (per il TV) */
  common: {
    falsa?: { clues: string[] }[];
    collegamento?: { words: string[] };
    tabellone?: { category: string; rows: BoardCellData[][] };
    tiebreak?: { prompt: string; visual: string | null; firstClue: string };
  } | null;
  /** concorrenti in gara (spareggio: solo i pari merito) */
  competitors: string[];
}

export interface RevealItem {
  competitorId: string;
  /** una riga per enigma */
  items: {
    playId: string;
    title: string;
    solution: string;
    given: string | null;
    correct: boolean;
    detail: string | null;
    points: number;
  }[];
  points: number;
}

export interface PublicReveal {
  stage: Stage;
  /** soluzione comune (contemporanea) */
  solutions: string[];
  results: RevealItem[];
  /** tabellone: la frase intera, ora pubblica */
  board: { category: string; rows: BoardCellData[][] } | null;
  /** spareggio: chi l'ha vinto (null = ancora parità) */
  tiebreakWinner: string | null;
}

export type GiramenteEventKind =
  | "joined"
  | "game_start"
  | "round_start"
  | "turn"
  | "risk"
  | "spin"
  | "sector"
  | "jolly_power"
  | "jolly_dup"
  | "colpo"
  | "question"
  | "occhio"
  | "result"
  | "penalty"
  | "shield"
  | "bonus"
  | "stage_start"
  | "reveal"
  | "round_end"
  | "tiebreak"
  | "winner"
  | "pause"
  | "resume";

export interface GiramenteEvent {
  kind: GiramenteEventKind;
  at: string;
  data?: Record<string, string | number | boolean | null>;
}

export interface PublicState {
  roomId: string;
  code: string;
  devices: DeviceMode;
  mode: GameMode;
  status: "open" | "closed";
  phase: Phase;
  version: number;
  secretRev: number;
  serverNow: string;
  settings: Settings;
  roundNo: number;
  roundName: string | null;
  stage: Stage | null;
  tiebreakNo: number;
  phaseTimer: PublicTimer;
  /** in pausa: i timer restano fermi a questo istante (riprendono da dove erano) */
  pausedAt: string | null;
  hostOnline: boolean;
  displayOnline: boolean;
  competitors: PublicCompetitor[];
  participants: PublicParticipant[];
  standings: Standing[];
  wheel: { finale: boolean; spin: WheelSpinPublic | null; restIndex: number | null };
  turn: PublicTurn | null;
  question: PublicQuestion | null;
  result: TurnResult | null;
  stagePlay: PublicStage | null;
  reveal: PublicReveal | null;
  winners: string[];
  event: GiramenteEvent | null;
  /** stima della durata (minuti) per la configurazione */
  estimate: { min: number; max: number };
}

// ---------------------------------------------------------------------------
// Vista privata (endpoint autenticato): le PROPRIE prove, mai quelle degli altri
// ---------------------------------------------------------------------------
export interface PrivatePlay {
  playId: string;
  stage: Stage;
  pool: PuzzlePool;
  turnNo: number;
  status: "open" | "answered" | "timeout";
  prompt: string | null;
  clues: string[];
  words: string[];
  visual: string | null;
  clueLevel: number;
  clueCount: number;
  extraClue: string | null;
  /** collegamento: quarto indizio chiesto (100 punti invece di 250) */
  extraUsed: boolean;
  board: { category: string; rows: BoardCellData[][]; hint: string | null; lettersUsed: number; hintsUsed: number; canReveal: boolean } | null;
  pointsAtStake: number;
  /** la mia risposta (registrata, l'esito si vede al momento della rivelazione) */
  given: { falseIndex?: number | null; text?: string | null } | null;
  timer: PublicTimer;
}

export interface PrivateView {
  me: { participantId: string; nickname: string; kind: "account" | "local" } | null;
  isHost: boolean;
  isOwner: boolean;
  competitorId: string | null;
  captain: boolean;
  /** può agire nel turno / nella prova in corso (giocatore, capitano, proprietario del dispositivo condiviso) */
  canAct: boolean;
  /** prove private in corso (Falsa Pista, Collegamento, Tabellone, Spareggio) */
  plays: PrivatePlay[];
}

export interface GiramenteView {
  state: PublicState;
  view: PrivateView;
}
