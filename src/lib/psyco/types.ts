import { z } from "zod";

/**
 * PSYCO – tipi condivisi tra server e client.
 *
 * Regola d'oro: `PsycoPublicState` NON contiene mai segreti (testo della regola, proposte,
 * voti individuali, ruoli). Va a tutti: telefoni, schermo TV, canale realtime.
 * I segreti viaggiano solo in `PsycoPrivateView`, costruita dal server per UN partecipante
 * autenticato e solo se ne ha diritto (mai allo PSYCO della manche).
 */

export const MIN_PLAYERS = 3;

/**
 * Macchina a stati della stanza (validata dal server). Corrispondenza col brief:
 *  LOBBY → ROLE_REVEAL (assegnazione + rivelazione privata) →
 *    automatica: DIFFICULTY_VOTE → RULE_VOTE (accetta / un'altra) ↺
 *    libera:     RULE_PROPOSALS → PROPOSAL_VOTE (con spareggio) →
 *  RULE_CONFIRMED (attesa dei «pronti») → PLAYING (conto alla rovescia, poi la manche) ⇄ GUESS_VOTE →
 *  ROUND_END → (nuova manche) ROLE_REVEAL …
 */
export const PHASES = [
  "LOBBY",
  "ROLE_REVEAL",
  "DIFFICULTY_VOTE",
  "RULE_VOTE",
  "RULE_PROPOSALS",
  "PROPOSAL_VOTE",
  "RULE_CONFIRMED",
  "PLAYING",
  "GUESS_VOTE",
  "ROUND_END",
] as const;
export type PsycoPhase = (typeof PHASES)[number];

export type RoomMode = "shared" | "personal";
export type RuleMode = "auto" | "free";
export type Difficulty = "facile" | "media" | "difficile";
export const DIFFICULTIES: Difficulty[] = ["facile", "media", "difficile"];
/** scelta della difficoltà: una delle tre oppure «a sorpresa» (nessuna difficoltà imposta) */
export type DifficultyChoice = Difficulty | "sorpresa";
export type RoundOutcome = "guessed" | "time_up" | "ended" | "psyco_left";
export type Role = "psyco" | "knower";

export const DIFFICULTY_LABEL: Record<DifficultyChoice, string> = { facile: "Facile", media: "Media", difficile: "Difficile", sorpresa: "A sorpresa" };

/** Limite tecnico della durata: le stanze senza attività si chiudono dopo 24 ore. */
export const TIMER_MAX_MS = 24 * 60 * 60 * 1000;
/** Lunghezza massima di una regola scritta dai giocatori (limite tecnico, non di gioco). */
export const RULE_TEXT_MAX = 280;
export const NICKNAME_MAX = 20;
/** Indizio facoltativo che il gruppo scrive per lo PSYCO (regole libere): limite tecnico. */
export const HINT_TEXT_MAX = 140;

/** Chiamate all'Investigatore per manche: 0 = disattivate, al massimo 3 (un livello d'indizio per chiamata). */
export const CALLS_MAX = 3;
export const DEFAULT_CALLS = 2;

/** Categorie (facoltative) delle regole LIBERE: servono a scegliere l'indizio generico dell'Investigatore. */
export const RULE_CATEGORIES = ["parole", "lettere", "gesti", "persone", "verita", "numeri", "altro"] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<RuleCategory, string> = {
  parole: "Parole",
  lettere: "Lettere e suoni",
  gesti: "Gesti e corpo",
  persone: "Persone e ruoli",
  verita: "Verità e bugie",
  numeri: "Numeri e conteggi",
  altro: "Altro",
};

export const settingsSchema = z.object({
  /** null = SENZA LIMITE DI TEMPO */
  timerMs: z.number().int().positive().max(TIMER_MAX_MS).nullable(),
  ruleMode: z.enum(["auto", "free"]),
  /** PSYCO a rotazione automatica (equa) oppure scelto dall'host a ogni manche */
  psycoPick: z.enum(["auto", "manual"]),
  /** chiamate all'Investigatore per manche (0–3); assente = DEFAULT_CALLS (stanze create prima) */
  calls: z.number().int().min(0).max(CALLS_MAX).optional(),
});
export type PsycoSettings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS: PsycoSettings = { timerMs: 5 * 60_000, ruleMode: "auto", psycoPick: "auto", calls: DEFAULT_CALLS };
export const callsOf = (s: Pick<PsycoSettings, "calls">): number => s.calls ?? DEFAULT_CALLS;

/** Ultimo avvenimento pubblico (per i messaggi a schermo e la voce narrante). */
export type PsycoEventKind =
  | "rule_rejected"
  | "runoff"
  | "draw"
  | "guess_wrong"
  | "guess_correct"
  | "time_up"
  | "host_changed"
  | "psyco_left"
  | "round_ended"
  | "no_proposals"
  /** lo PSYCO ha chiamato l'Investigatore: pubblico SOLO il numero della chiamata, mai l'indizio */
  | "investigator_call";
export interface PsycoEvent {
  kind: PsycoEventKind;
  at: string;
  /** dati pubblici (mai segreti): es. nickname */
  data?: Record<string, string | number | null>;
}

export interface PublicParticipant {
  id: string;
  nickname: string;
  kind: "account" | "local";
  online: boolean;
  isHost: boolean;
  /** fa parte della manche in corso (chi entra a manche iniziata aspetta la prossima) */
  inRound: boolean;
  psycoCount: number;
}

export type VoteKind = "difficulty" | "candidate" | "proposals" | "guess";
export interface PublicVote {
  kind: VoteKind;
  /** chiave della votazione (cambia a ogni nuova votazione: nuovo candidato, spareggio…) */
  ballot: string;
  /** quanti hanno diritto di voto (chi conosce la regola, ancora in stanza) */
  eligible: number;
  /** id dei partecipanti che hanno già votato (MAI cosa hanno votato) */
  voted: string[];
  /** conteggi aggregati: per le proposte le chiavi sono id opachi, mai il testo */
  tally: Record<string, number>;
  /** spareggio in corso tra queste opzioni (id opachi) */
  runoff: string[] | null;
}

export interface PublicTimer {
  /** null = senza limite */
  totalMs: number | null;
  /** inizio effettivo della manche (dopo il conto alla rovescia): può essere nel futuro */
  startedAt: string | null;
  pausedAt: string | null;
  pausedMs: number;
}

export interface PublicRound {
  no: number;
  psycoId: string | null;
  psycoNickname: string;
  ruleMode: RuleMode;
  /** difficoltà scelta (non è la regola: si può mostrare a tutti) */
  difficulty: Difficulty | null;
  members: string[];
  seen: string[];
  ready: string[];
  timer: PublicTimer;
  attempts: number;
  /** regole dell'archivio già proposte in questa manche (solo il numero) */
  candidatesShown: number;
  /** modalità libera: chi ha già proposto o passato (non il testo) */
  proposed: string[];
  passed: string[];
  proposalsCount: number;
  vote: PublicVote | null;
  outcome: RoundOutcome | null;
  endedAt: string | null;
  elapsedMs: number | null;
  /** chiamate all'Investigatore: solo i numeri (l'indizio va unicamente allo PSYCO) */
  calls: { max: number; used: number; lastAt: string | null };
  /** la regola diventa pubblica SOLO a manche finita */
  revealedRule: { title: string | null; text: string; source: "archive" | "custom" | null } | null;
}

export interface PublicHistoryItem {
  no: number;
  psycoNickname: string;
  outcome: RoundOutcome | null;
  elapsedMs: number | null;
  attempts: number;
  difficulty: Difficulty | null;
}

export interface PsycoPublicState {
  roomId: string;
  code: string;
  mode: RoomMode;
  /** creata da un PC come SCHERMO PUBBLICO: tutti, host compreso, giocano dal telefono */
  screen: boolean;
  status: "open" | "closed";
  phase: PsycoPhase;
  version: number;
  /** cambia quando cambiano i dati privati (ruoli, regola, proposte): i client rileggono la loro vista */
  secretRev: number;
  serverNow: string;
  settings: PsycoSettings;
  minPlayers: number;
  hostParticipantId: string | null;
  hostOnline: boolean;
  displayOnline: boolean;
  /** solo partecipanti attivi */
  participants: PublicParticipant[];
  activeCount: number;
  round: PublicRound | null;
  history: PublicHistoryItem[];
  event: PsycoEvent | null;
}

export interface SecretRule {
  title: string | null;
  text: string;
  difficulty: Difficulty | null;
  instructions: string | null;
  example: string | null;
}

/** Vista privata di UN partecipante (o dell'host senza posto). */
export interface PsycoPrivateView {
  /** null = l'utente gestisce la stanza ma non gioca (es. PC dell'host) */
  me: { participantId: string; nickname: string; kind: "account" | "local" } | null;
  isHost: boolean;
  isOwner: boolean;
  /** null = fuori dalla manche (entrato dopo, o in sala d'attesa) */
  role: Role | null;
  roleSeen: boolean;
  /** nome dello PSYCO della manche, solo per chi è nella manche (durante la rivelazione dei ruoli non è pubblico) */
  psycoNickname: string | null;
  ready: boolean;
  /** voto già espresso nella votazione in corso */
  myVote: string | null;
  myProposal: { id: string; text: string; category: RuleCategory | null; hint: string | null } | null;
  myPassed: boolean;
  /**
   * SOLO per lo PSYCO della manche: i messaggi dell'Investigatore (indizi già ricevuti).
   * null per chiunque altro (chi conosce la regola, schermi, chi è fuori dalla manche).
   */
  investigator: { messages: InvestigatorMessage[] } | null;
  /** SOLO per chi conosce la regola: candidato dell'archivio, proposte, regola confermata */
  secret: {
    candidate: (SecretRule & { id: string }) | null;
    proposals: { id: string; text: string; mine: boolean; category: RuleCategory | null }[];
    rule: SecretRule | null;
  } | null;
}

export interface InvestigatorMessage {
  /** numero della chiamata nella manche (1…3) */
  no: number;
  /** livello dell'indizio: 1 vago → 3 quasi rivelatore */
  level: number;
  text: string;
  at: string;
}

export interface PsycoView {
  state: PsycoPublicState;
  view: PsycoPrivateView;
}

// ---------------------------------------------------------------------------
// Azioni (validate dal server)
// ---------------------------------------------------------------------------
const id = z.uuid();
export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start_game"), psycoId: id.optional() }),
  z.object({ action: z.literal("seen") }),
  z.object({ action: z.literal("vote"), ballot: z.string().min(1).max(80), choice: z.string().min(1).max(64) }),
  z.object({
    action: z.literal("propose"),
    text: z.string().max(2000),
    category: z.enum(RULE_CATEGORIES).nullish(),
    hint: z.string().max(2000).nullish(),
  }),
  z.object({ action: z.literal("pass") }),
  z.object({ action: z.literal("close_vote") }),
  z.object({ action: z.literal("close_proposals") }),
  z.object({ action: z.literal("use_archive") }),
  z.object({ action: z.literal("ready") }),
  z.object({ action: z.literal("start_round") }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("guess") }),
  /** lo PSYCO risponde alla chiamata dell'Investigatore: `requestId` rende la chiamata idempotente */
  z.object({ action: z.literal("call_investigator"), requestId: id }),
  z.object({ action: z.literal("end_round") }),
  z.object({ action: z.literal("tick") }),
  z.object({ action: z.literal("next_round"), settings: settingsSchema.optional(), psycoId: id.optional() }),
  z.object({ action: z.literal("update_settings"), settings: settingsSchema }),
  z.object({ action: z.literal("leave") }),
  z.object({ action: z.literal("kick"), participantId: id }),
  z.object({ action: z.literal("claim_host") }),
  z.object({ action: z.literal("close_room") }),
  z.object({ action: z.literal("add_local"), nickname: z.string().max(60) }),
  z.object({ action: z.literal("remove_local"), participantId: id }),
]);
export type PsycoAction = z.infer<typeof actionSchema>;
export type PsycoActionName = PsycoAction["action"];

export const createRoomSchema = z.object({
  mode: z.enum(["shared", "personal"]),
  settings: settingsSchema,
  /** dispositivo condiviso: i nickname di tutti (compreso chi crea) */
  nicknames: z.array(z.string().max(60)).optional(),
  /** dispositivi personali: anche l'host gioca (default sì) */
  hostPlays: z.boolean().optional(),
  hostNickname: z.string().max(60).optional(),
  /** da PC: questo dispositivo diventa lo SCHERMO PUBBLICO e tutti giocano dal telefono (solo «personal») */
  screen: z.boolean().optional(),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
