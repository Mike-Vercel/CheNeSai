/**
 * Motore dello spettacolo: tipi condivisi (puri, usati da server, test e regia).
 *
 * Flusso: punteggi confermati dal server → rilevamento degli eventi reali (events.ts)
 * → regista che decide chi parla e con quale battuta (director.ts) → testo con i nomi veri
 * → voce sul TV. Nessun evento viene inventato: ogni battuta nasce da un ShowEvent.
 */
import type { Presenter } from "@/lib/game-engine/types";

/** Genere scelto dal giocatore all'ingresso (facoltativo: null/assente = non detto). */
export type PlayerGender = "m" | "f";

export interface PlayerRef {
  id: string;
  nickname: string;
  /** per gli accordi delle battute ("Brava!", "addormentata"…); assente = non detto */
  gender?: PlayerGender | null;
}

/** Squadra nominata dal regista (mai un singolo giocatore al posto della squadra). */
export interface TeamRef {
  id: string;
  name: string;
}

export type ShowEvent =
  | { type: "LEADER_CHANGED"; leader: PlayerRef; previous: PlayerRef; points: number }
  | { type: "LEADER_TIE"; leaders: PlayerRef[]; points: number }
  | { type: "LEADER_KEPT"; leader: PlayerRef; questions: number }
  | { type: "OVERTAKE"; who: PlayerRef; overtaken: PlayerRef }
  | { type: "COMEBACK"; who: PlayerRef; positions: number }
  | { type: "NEW_LAST"; who: PlayerRef }
  | { type: "FASTEST_CORRECT"; who: PlayerRef; ms: number }
  | { type: "CORRECT_STREAK"; who: PlayerRef; streak: number }
  | { type: "WRONG_STREAK"; who: PlayerRef; streak: number }
  | { type: "ONLY_ONE_CORRECT"; who: PlayerRef }
  | { type: "ALL_WRONG" }
  | { type: "ALL_CORRECT" }
  | { type: "POINTS_MILESTONE"; who: PlayerRef; threshold: number }
  | { type: "ROUND_WINNER"; leaders: PlayerRef[]; points: number }
  /** lobby: nuovi arrivati salutati per nome (`named`), gli altri contati in `others`; `greeted` = tutti i salutati */
  | { type: "PLAYERS_JOINED"; named: PlayerRef[]; others: number; greeted: PlayerRef[] }
  /** inizio del round finale: primo e secondo della classifica ufficiale */
  | { type: "FINAL_ROUND_START"; leader: PlayerRef; runnerUp: PlayerRef; gap: number }
  | { type: "TEAM_LEADER_CHANGED"; team: TeamRef; previous: TeamRef; points: number }
  | { type: "TEAM_ROUND_WINNER"; teams: TeamRef[]; points: number }
  /**
   * Battibecco: un altro presentatore risponde alla battuta appena detta da `RETORT_<chi>`.
   * Non nasce dalla classifica: lo aggiunge il regista dopo la prima battuta. `about` = il
   * concorrente nominato nella battuta a cui si risponde (se c'è).
   */
  | { type: RetortEventType; about: PlayerRef | null }
  // ---- libreria ufficiale (lib/show/library.ts) ----
  /** reazioni alla soluzione (ANSWER_REVEAL): nessun nome, solo l'esito vero della domanda */
  | { type: RevealEventType; facts: RevealFacts }
  /** ultimi secondi del timer (il TV decide se e quando dirla) */
  | { type: "TIME_RUNNING_OUT"; durationSeconds: number }
  /** ruota girata da Palmino (le battute le sceglie pickWheelLines) */
  | { type: "WHEEL_SPIN" }
  /** uno solo ha sbagliato (almeno 2 hanno risposto giusto) */
  | { type: "ONLY_ONE_WRONG"; who: PlayerRef }
  /** mancata risposta verificata dal server a tempo scaduto (mai chi è disconnesso) */
  | { type: NoAnswerEventType; who: PlayerRef; streak: number }
  /** almeno metà dei giocatori in gioco (collegati) non ha risposto */
  | { type: "MANY_NO_ANSWER"; count: number }
  /** modalità "teams": un'intera squadra non ha risposto */
  | { type: "TEAM_NO_ANSWER"; team: TeamRef }
  /** riempitivo raro (tormentoni, scenette) quando non succede niente di speciale */
  | { type: "FILLER" }
  /** battuta di Palmino sulla classifica generale */
  | { type: "LEADERBOARD_QUIP" }
  /** vincitore della serata: SOLO al podio, dopo che il nome è stato rivelato */
  | { type: "GAME_WINNER"; winner: { id: string; name: string; gender?: PlayerGender | null } }
  /** scenetta di chiusura del podio */
  | { type: "GAME_END" };

/** Esito della domanda alla soluzione (dati del server). */
export interface RevealFacts {
  /** giocatori in gioco */
  players: number;
  /** risposte date */
  answered: number;
  /** risposte giuste */
  right: number;
  difficulty: number;
  /** domanda a risposta singola con 4 opzioni */
  fourOptions: boolean;
}

export const REVEAL_EVENT_TYPES = ["ANSWER_WRONG", "EASY_WRONG", "ANSWER_CORRECT", "LOSE_PATIENCE"] as const;
export type RevealEventType = (typeof REVEAL_EVENT_TYPES)[number];
export const NO_ANSWER_EVENT_TYPES = ["PLAYER_NO_ANSWER", "NO_ANSWER_LEADER", "NO_ANSWER_LAST", "NO_ANSWER_STREAK"] as const;
export type NoAnswerEventType = (typeof NO_ANSWER_EVENT_TYPES)[number];

export const RETORT_EVENT_TYPES = ["RETORT_PROFESSORE", "RETORT_REGINA", "RETORT_PALMINO"] as const;
export type RetortEventType = (typeof RETORT_EVENT_TYPES)[number];
/** Evento di battibecco per rispondere a un presentatore. */
export const retortEventFor = (who: Presenter): RetortEventType => `RETORT_${who.toUpperCase()}` as RetortEventType;
export const isRetortEvent = (e: string): e is RetortEventType => (RETORT_EVENT_TYPES as readonly string[]).includes(e);

export type ShowEventType = ShowEvent["type"];

export const SHOW_EVENT_TYPES = [
  "LEADER_CHANGED",
  "LEADER_TIE",
  "LEADER_KEPT",
  "OVERTAKE",
  "COMEBACK",
  "NEW_LAST",
  "FASTEST_CORRECT",
  "CORRECT_STREAK",
  "WRONG_STREAK",
  "ONLY_ONE_CORRECT",
  "ALL_WRONG",
  "ALL_CORRECT",
  "POINTS_MILESTONE",
  "ROUND_WINNER",
  "PLAYERS_JOINED",
  "FINAL_ROUND_START",
  "TEAM_LEADER_CHANGED",
  "TEAM_ROUND_WINNER",
  "RETORT_PROFESSORE",
  "RETORT_REGINA",
  "RETORT_PALMINO",
  "ANSWER_WRONG",
  "EASY_WRONG",
  "ANSWER_CORRECT",
  "LOSE_PATIENCE",
  "TIME_RUNNING_OUT",
  "WHEEL_SPIN",
  "ONLY_ONE_WRONG",
  "PLAYER_NO_ANSWER",
  "NO_ANSWER_LEADER",
  "NO_ANSWER_LAST",
  "NO_ANSWER_STREAK",
  "MANY_NO_ANSWER",
  "TEAM_NO_ANSWER",
  "FILLER",
  "LEADERBOARD_QUIP",
  "GAME_WINNER",
  "GAME_END",
] as const satisfies readonly ShowEventType[];

/** Segnaposto ammessi per ogni evento: le battute che ne usano altri vengono rifiutate. */
export const ALLOWED_PLACEHOLDERS: Record<ShowEventType, readonly string[]> = {
  LEADER_CHANGED: ["nome_primo", "nome_ex_primo", "punti_primo", "nome_nuovo_primo", "nome_primo_precedente"],
  LEADER_TIE: ["nomi_primi", "punti_primo"],
  LEADER_KEPT: ["nome_primo", "domande"],
  OVERTAKE: ["nome_sorpasso", "nome_superato"],
  COMEBACK: ["nome", "posizioni", "nome_rimonta"],
  NEW_LAST: ["nome_ultimo"],
  FASTEST_CORRECT: ["nome", "secondi", "nome_piu_veloce"],
  CORRECT_STREAK: ["nome", "serie"],
  WRONG_STREAK: ["nome", "serie"],
  ONLY_ONE_CORRECT: ["nome", "nome_risposta_corretta"],
  ALL_WRONG: [],
  ALL_CORRECT: [],
  POINTS_MILESTONE: ["nome", "soglia"],
  ROUND_WINNER: ["nome_primo", "punti_primo"],
  PLAYERS_JOINED: ["nomi"],
  FINAL_ROUND_START: ["nome_primo", "nome_secondo"],
  TEAM_LEADER_CHANGED: ["nome_squadra", "nome_ex_squadra"],
  TEAM_ROUND_WINNER: ["nome_squadra", "punti_squadra"],
  RETORT_PROFESSORE: ["nome"],
  RETORT_REGINA: ["nome"],
  RETORT_PALMINO: ["nome"],
  ANSWER_WRONG: [],
  EASY_WRONG: [],
  ANSWER_CORRECT: [],
  LOSE_PATIENCE: [],
  TIME_RUNNING_OUT: [],
  WHEEL_SPIN: [],
  ONLY_ONE_WRONG: ["nome", "nome_risposta_errata"],
  PLAYER_NO_ANSWER: ["nome", "nome_giocatore"],
  NO_ANSWER_LEADER: ["nome", "nome_giocatore"],
  NO_ANSWER_LAST: ["nome", "nome_giocatore"],
  NO_ANSWER_STREAK: ["nome", "nome_giocatore", "serie"],
  MANY_NO_ANSWER: [],
  TEAM_NO_ANSWER: ["nome_squadra"],
  FILLER: [],
  LEADERBOARD_QUIP: [],
  // il nome del vincitore della serata esiste SOLO qui (podio, dopo la rivelazione)
  GAME_WINNER: ["nome_vincitore"],
  GAME_END: [],
};

/** Importanza di base del momento (le battute possono alzarla o abbassarla). */
export const EVENT_PRIORITY: Record<ShowEventType, number> = {
  TEAM_ROUND_WINNER: 92,
  // i battibecchi non sono eventi della classifica: li aggiunge il regista dopo la prima battuta
  RETORT_PROFESSORE: 0,
  RETORT_REGINA: 0,
  RETORT_PALMINO: 0,
  ROUND_WINNER: 90,
  TEAM_LEADER_CHANGED: 87,
  LEADER_CHANGED: 85,
  LEADER_TIE: 75,
  ALL_WRONG: 70,
  ONLY_ONE_CORRECT: 65,
  COMEBACK: 62,
  OVERTAKE: 60,
  ALL_CORRECT: 60,
  CORRECT_STREAK: 55,
  FASTEST_CORRECT: 50,
  POINTS_MILESTONE: 50,
  LEADER_KEPT: 45,
  WRONG_STREAK: 35,
  NEW_LAST: 35,
  // momenti a sé (lobby, inizio finale): non competono con gli eventi dei punti
  FINAL_ROUND_START: 80,
  PLAYERS_JOINED: 40,
  // mancate risposte: al massimo un evento per domanda (scelto da noAnswerEvent)
  MANY_NO_ANSWER: 66,
  NO_ANSWER_STREAK: 64,
  NO_ANSWER_LEADER: 63,
  TEAM_NO_ANSWER: 61,
  ONLY_ONE_WRONG: 58,
  NO_ANSWER_LAST: 48,
  PLAYER_NO_ANSWER: 44,
  // riempitivo: solo se resta spazio
  FILLER: 5,
  // momenti a sé (soluzione, timer, ruota, classifica, podio): non competono con i punti
  ANSWER_WRONG: 50,
  EASY_WRONG: 50,
  ANSWER_CORRECT: 50,
  LOSE_PATIENCE: 50,
  TIME_RUNNING_OUT: 50,
  WHEEL_SPIN: 50,
  LEADERBOARD_QUIP: 50,
  GAME_WINNER: 95,
  GAME_END: 40,
};

/** Eventi con un momento proprio (fuori dai punti di una risposta). */
export const REVEAL_MOMENT_EVENTS: readonly ShowEventType[] = REVEAL_EVENT_TYPES;
export const OPTIONS_MOMENT_EVENTS: readonly ShowEventType[] = ["TIME_RUNNING_OUT"];
export const LEADERBOARD_MOMENT_EVENTS: readonly ShowEventType[] = ["LEADERBOARD_QUIP"];
export const FINISHED_MOMENT_EVENTS: readonly ShowEventType[] = ["GAME_WINNER", "GAME_END"];
const OWN_MOMENT: ReadonlySet<string> = new Set<string>([
  "PLAYERS_JOINED",
  "FINAL_ROUND_START",
  "WHEEL_SPIN",
  ...REVEAL_MOMENT_EVENTS,
  ...OPTIONS_MOMENT_EVENTS,
  ...LEADERBOARD_MOMENT_EVENTS,
  ...FINISHED_MOMENT_EVENTS,
]);

/** Eventi dei punti di una risposta (SCORE_REVEAL); gli altri hanno un momento proprio. */
export const SCORE_EVENT_TYPES: readonly ShowEventType[] = SHOW_EVENT_TYPES.filter((e) => !OWN_MOMENT.has(e));

export const CHARACTER_ANIMATIONS = ["celebrate", "point", "surprised", "wave", "talk", "idle"] as const;
export type CharacterAnimationName = (typeof CHARACTER_ANIMATIONS)[number];

/** Livello di comicità (impostazione della regia e classificazione di ogni battuta). */
export const COMEDY_LEVELS = ["leggero", "sarcastico", "irriverente"] as const;
export type ComedyLevel = (typeof COMEDY_LEVELS)[number];

/** Provenienza: libreria di sempre, libreria ufficiale dell'utente, aggiunte dal pannello. */
export const TEMPLATE_ORIGINS = ["base", "ufficiale", "admin"] as const;
export type TemplateOrigin = (typeof TEMPLATE_ORIGINS)[number];

/** Battuta della libreria (dato, mai codice eseguibile). */
export interface DialogueTemplate {
  id: string;
  character: Presenter;
  event: ShowEventType;
  text: string;
  tone: string;
  intensity: number;
  priority: number;
  weight: number;
  cooldownSec: number;
  animation: CharacterAnimationName | null;
  enabled: boolean;
  /** livello di comicità (assente = leggero) */
  level?: ComedyLevel;
  /** assente = base */
  origin?: TemplateOrigin;
  /** condizioni e indicazioni di voce (vedi lib/show/library.ts) */
  tags?: string[];
  /** scenetta: righe con la stessa chiave, dette in ordine di passo */
  sceneKey?: string | null;
  sceneStep?: number | null;
  /**
   * Varianti per genere del giocatore nominato: `text` è la versione maschile (testo ufficiale),
   * `textF` la femminile, `textN` la neutra (genere non detto, squadre). Con `textF` e senza
   * `textN` la battuta non si dice a chi non ha indicato il genere.
   */
  textF?: string | null;
  textN?: string | null;
}

/** Battuta scelta dal regista, con i nomi veri già inseriti. */
export interface ShowLine {
  templateId: string;
  event: ShowEventType;
  who: Presenter;
  text: string;
  animation: CharacterAnimationName | null;
  /** concorrenti nominati (per i limiti di menzioni) */
  mentions: string[];
  /**
   * Testo da mostrare (sottotitolo/fumetto): quello scritto nella libreria, con i nomi veri e senza
   * audio tag. Assente = il testo parlato senza tag. `text` resta il testo per la sintesi.
   */
  display?: string;
  /** battuta con nomi/numeri della serata (modello veloce); false = frase fissa pre-generata */
  live?: boolean;
  /** battuta "di contorno": se la voce non arriva in tempo il TV la salta (mai sottotitolo muto) */
  optional?: boolean;
  /** righe della stessa scenetta: se una salta, saltano anche le successive */
  group?: string;
  /** tag della battuta utili al TV (es. "countdown") */
  tags?: string[];
}

export interface DirectorConfig {
  enabled: boolean;
  /** battute al massimo per ogni momento (es. dopo i punti di una risposta) */
  maxLines: number;
  /** quante volte lo stesso concorrente può essere nominato in un round */
  maxMentionsPerPlayerPerRound: number;
  /** eventi che possono generare battute (vuoto = tutti) */
  events: ShowEventType[];
  /** probabilità (0-100) che un altro presentatore risponda alla prima battuta (battibecco) */
  banterPercent: number;
  /** livello di comicità massimo delle battute (predefinito: irriverente, uso fra amici) */
  comedyLevel: ComedyLevel;
  /** battute su chi non risponde (PLAYER_NO_ANSWER e simili) */
  noAnswerLines: boolean;
}

export const DEFAULT_DIRECTOR_CONFIG: DirectorConfig = {
  enabled: true,
  maxLines: 2,
  maxMentionsPerPlayerPerRound: 3,
  events: [],
  banterPercent: 50,
  comedyLevel: "irriverente",
  noAnswerLines: true,
};
