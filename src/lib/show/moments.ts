/**
 * Momenti dello spettacolo fuori dai punti di una risposta (funzioni pure e deterministiche).
 *
 * - Lobby (PLAYERS_JOINED): i presentatori salutano per nome chi è appena entrato, a gruppi.
 *   Al massimo un saluto ogni ~25 s, mai due volte lo stesso giocatore, un tetto di saluti per
 *   serata (costo della voce professionale contenuto) e al massimo 4 nomi per battuta
 *   ("Vodka, Gigi, Lalla e altri 3"). Si aspetta qualche secondo dopo l'ultimo ingresso, così chi
 *   entra insieme viene salutato insieme; chi aspetta da più di un cooldown viene salutato comunque.
 * - Inizio del round finale (FINAL_ROUND_START): primo e secondo della classifica ufficiale.
 *
 * Nessun evento viene inventato: tutto nasce da dati del server (giocatori attivi, classifica).
 */
import type { GamePhase } from "@/lib/game-engine/types";
import {
  FINISHED_MOMENT_EVENTS,
  LEADERBOARD_MOMENT_EVENTS,
  OPTIONS_MOMENT_EVENTS,
  REVEAL_MOMENT_EVENTS,
  SCORE_EVENT_TYPES,
  type PlayerRef,
  type ShowEvent,
} from "./types";

export interface LobbyGreetingConfig {
  /** distanza minima fra due saluti */
  cooldownMs: number;
  /** attesa dopo l'ultimo ingresso, per salutare insieme chi arriva insieme */
  settleMs: number;
  /** nomi pronunciati al massimo in una battuta (gli altri: "e altri N") */
  maxNamed: number;
  /** saluti al massimo per serata */
  maxGreetings: number;
}

export const DEFAULT_LOBBY_GREETING: LobbyGreetingConfig = {
  cooldownMs: 25_000,
  settleMs: 4_000,
  maxNamed: 4,
  maxGreetings: 10,
};

export interface LobbyPlayer extends PlayerRef {
  joinedAtMs: number;
}

export interface LobbyGreetingInput {
  /** giocatori attivi (senza bot) in lobby */
  players: LobbyPlayer[];
  /** già salutati in questa serata */
  greetedIds: ReadonlySet<string>;
  /** ultimo saluto (ms epoch), null se nessuno */
  lastGreetingMs: number | null;
  greetingsSoFar: number;
  nowMs: number;
  config?: LobbyGreetingConfig;
}

/** Evento di saluto per i nuovi arrivati, oppure null se non è il momento. */
export function lobbyGreetingEvent(input: LobbyGreetingInput): Extract<ShowEvent, { type: "PLAYERS_JOINED" }> | null {
  const c = input.config ?? DEFAULT_LOBBY_GREETING;
  if (input.greetingsSoFar >= c.maxGreetings) return null;
  if (input.lastGreetingMs !== null && input.nowMs - input.lastGreetingMs < c.cooldownMs) return null;
  const pending = input.players
    .filter((p) => !input.greetedIds.has(p.id) && p.nickname.trim().length > 0)
    .sort((a, b) => a.joinedAtMs - b.joinedAtMs || a.nickname.localeCompare(b.nickname, "it") || a.id.localeCompare(b.id));
  if (pending.length === 0) return null;
  const newest = pending[pending.length - 1].joinedAtMs;
  const oldest = pending[0].joinedAtMs;
  // qualcuno è appena entrato: si aspetta un attimo (a meno che il primo aspetti già da troppo)
  if (input.nowMs - newest < c.settleMs && input.nowMs - oldest < c.cooldownMs) return null;
  const max = Math.max(1, c.maxNamed);
  const named = pending.length <= max ? pending : pending.slice(0, Math.max(1, max - 1));
  const ref = (p: LobbyPlayer): PlayerRef => ({ id: p.id, nickname: p.nickname });
  return { type: "PLAYERS_JOINED", named: named.map(ref), others: pending.length - named.length, greeted: pending.map(ref) };
}

export interface Standing extends PlayerRef {
  points: number;
  /** posizione ufficiale (criteri di spareggio deterministici); null = non ancora classificato */
  rank: number | null;
}

/** Evento di inizio finale: serve un primo con punti e almeno un inseguitore. */
export function finalRoundStartEvent(standings: Standing[]): Extract<ShowEvent, { type: "FINAL_ROUND_START" }> | null {
  const sorted = [...standings].sort(
    (a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || b.points - a.points || a.nickname.localeCompare(b.nickname, "it"),
  );
  if (sorted.length < 2) return null;
  const [leader, runnerUp] = sorted;
  if (leader.points <= 0) return null;
  return {
    type: "FINAL_ROUND_START",
    leader: { id: leader.id, nickname: leader.nickname },
    runnerUp: { id: runnerUp.id, nickname: runnerUp.nickname },
    gap: Math.max(0, leader.points - runnerUp.points),
  };
}

/**
 * Battute del regista visibili al TV nella fase (visiva) corrente: ognuna vale solo nel suo
 * momento, così una battuta rimasta nello stato non viene mai detta fuori posto.
 */
export function showLinesForPhase<L extends { event: string }>(phase: GamePhase, lines: L[] | null | undefined): L[] | null {
  if (!Array.isArray(lines)) return null;
  const allowed = PHASE_EVENTS[phase];
  if (!allowed) return null;
  return lines.filter((l) => allowed.has(l.event));
}

/**
 * Eventi validi per fase: punti di una risposta, inizio finale, lobby; con la libreria ufficiale
 * anche la soluzione (reazioni), le risposte aperte (tempo che scade), la classifica generale e il
 * podio (vincitore della serata: SOLO qui, mai prima).
 */
const PHASE_EVENTS: Partial<Record<GamePhase, ReadonlySet<string>>> = {
  SCORE_REVEAL: new Set(SCORE_EVENT_TYPES),
  ROUND_INTRO: new Set(["FINAL_ROUND_START"]),
  LOBBY: new Set(["PLAYERS_JOINED"]),
  ANSWER_REVEAL: new Set(REVEAL_MOMENT_EVENTS),
  OPTIONS_VISIBLE: new Set(OPTIONS_MOMENT_EVENTS),
  LEADERBOARD: new Set(LEADERBOARD_MOMENT_EVENTS),
  FINISHED: new Set(FINISHED_MOMENT_EVENTS),
};
