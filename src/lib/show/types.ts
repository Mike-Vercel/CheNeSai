/**
 * Motore dello spettacolo: tipi condivisi (puri, usati da server, test e regia).
 *
 * Flusso: punteggi confermati dal server → rilevamento degli eventi reali (events.ts)
 * → regista che decide chi parla e con quale battuta (director.ts) → testo con i nomi veri
 * → voce sul TV. Nessun evento viene inventato: ogni battuta nasce da un ShowEvent.
 */
import type { Presenter } from "@/lib/game-engine/types";

export interface PlayerRef {
  id: string;
  nickname: string;
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
  | { type: "FINAL_ROUND_START"; leader: PlayerRef; runnerUp: PlayerRef; gap: number };

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
] as const satisfies readonly ShowEventType[];

/** Segnaposto ammessi per ogni evento: le battute che ne usano altri vengono rifiutate. */
export const ALLOWED_PLACEHOLDERS: Record<ShowEventType, readonly string[]> = {
  LEADER_CHANGED: ["nome_primo", "nome_ex_primo", "punti_primo"],
  LEADER_TIE: ["nomi_primi", "punti_primo"],
  LEADER_KEPT: ["nome_primo", "domande"],
  OVERTAKE: ["nome_sorpasso", "nome_superato"],
  COMEBACK: ["nome", "posizioni"],
  NEW_LAST: ["nome_ultimo"],
  FASTEST_CORRECT: ["nome", "secondi"],
  CORRECT_STREAK: ["nome", "serie"],
  WRONG_STREAK: ["nome", "serie"],
  ONLY_ONE_CORRECT: ["nome"],
  ALL_WRONG: [],
  ALL_CORRECT: [],
  POINTS_MILESTONE: ["nome", "soglia"],
  ROUND_WINNER: ["nome_primo", "punti_primo"],
  PLAYERS_JOINED: ["nomi"],
  FINAL_ROUND_START: ["nome_primo", "nome_secondo"],
};

/** Importanza di base del momento (le battute possono alzarla o abbassarla). */
export const EVENT_PRIORITY: Record<ShowEventType, number> = {
  ROUND_WINNER: 90,
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
};

/** Eventi dei punti di una risposta (SCORE_REVEAL); gli altri hanno un momento proprio. */
export const SCORE_EVENT_TYPES: readonly ShowEventType[] = SHOW_EVENT_TYPES.filter((e) => e !== "PLAYERS_JOINED" && e !== "FINAL_ROUND_START");

export const CHARACTER_ANIMATIONS = ["celebrate", "point", "surprised", "wave", "talk", "idle"] as const;
export type CharacterAnimationName = (typeof CHARACTER_ANIMATIONS)[number];

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
}

export interface DirectorConfig {
  enabled: boolean;
  /** battute al massimo per ogni momento (es. dopo i punti di una risposta) */
  maxLines: number;
  /** quante volte lo stesso concorrente può essere nominato in un round */
  maxMentionsPerPlayerPerRound: number;
  /** eventi che possono generare battute (vuoto = tutti) */
  events: ShowEventType[];
}

export const DEFAULT_DIRECTOR_CONFIG: DirectorConfig = {
  enabled: true,
  maxLines: 2,
  maxMentionsPerPlayerPerRound: 3,
  events: [],
};
