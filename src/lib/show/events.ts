/**
 * Rilevamento degli eventi dello spettacolo confrontando la classifica PRIMA e DOPO
 * i punti di una domanda (dati ufficiali del server). Funzione pura e deterministica.
 *
 * Regole (documentate perché la regia sappia quando i presentatori parlano):
 * - LEADER_CHANGED: c'è un solo primo e prima non era primo (e prima c'era già un primo con punti > 0).
 * - LEADER_TIE: più giocatori a pari merito al primo posto, situazione nuova rispetto a prima.
 * - LEADER_KEPT: stesso primo da 3, 6, 9… domande di fila.
 * - OVERTAKE: A aveva meno punti di B e ora ne ha di più (entrambi in gioco prima e dopo):
 *   un abbandono non conta come sorpasso. Si tiene il sorpasso più "alto" in classifica.
 * - COMEBACK: guadagnate almeno 3 posizioni in una volta (con almeno 6 giocatori).
 * - NEW_LAST: c'è un nuovo ultimo da solo (con almeno 4 giocatori) che prima non era ultimo.
 * - FASTEST_CORRECT: la risposta giusta più veloce, se almeno 2 hanno risposto giusto.
 * - CORRECT_STREAK: 3, 5, 7, 10 risposte giuste di fila. WRONG_STREAK: 3 o 5 sbagliate di fila.
 * - ONLY_ONE_CORRECT: un solo giusto su almeno 3 risposte. ALL_WRONG: nessun giusto su almeno 2 risposte.
 * - ONLY_ONE_WRONG: un solo sbagliato su almeno 3 risposte (gli altri tutti giusti).
 * - ALL_CORRECT: tutti i giocatori (almeno 3) hanno risposto giusto.
 * - POINTS_MILESTONE: superata una soglia (10.000, 20.000, 30.000, 50.000).
 * - ROUND_WINNER: all'ultima domanda del round, chi ha fatto più punti NEL ROUND (con `roundPoints`;
 *   senza, chi è primo in classifica).
 *
 * Solo in modalità squadre (detectTeamEvents, su punteggi di squadra somma/media):
 * - TEAM_LEADER_CHANGED: una sola squadra in testa che prima non lo era (prima c'era una sola squadra
 *   in testa con punti > 0). Almeno 2 squadre con giocatori.
 * - TEAM_ROUND_WINNER: all'ultima domanda del round, la squadra (o le squadre a pari merito) in testa.
 * Nella modalità "teams" la vittoria del round è della squadra: la ROUND_WINNER individuale non si annuncia.
 */
import { teamsEnabled, type TeamMode } from "@/lib/game-engine/teams";
import type { PlayerRef, ShowEvent, TeamRef } from "./types";

export interface ShowPlayer {
  id: string;
  nickname: string;
  points: number;
  prevPoints: number;
  /** ha partecipato alla domanda (era in gioco prima e dopo) */
  inPlay: boolean;
  answered: boolean;
  correct: boolean;
  responseMs: number | null;
  correctStreak: number;
  wrongStreak: number;
  gender?: PlayerRef["gender"];
}

export interface DetectInput {
  players: ShowPlayer[];
  /** domande consecutive con lo stesso primo (compresa questa) */
  leaderStreak: number;
  endOfRound: boolean;
  /** punti fatti nel round da ogni giocatore (vincitore del round = più punti nel round) */
  roundPoints?: ReadonlyMap<string, number>;
}

export const POINT_MILESTONES = [10000, 20000, 30000, 50000];
const CORRECT_STREAKS = new Set([3, 5, 7, 10]);
const WRONG_STREAKS = new Set([3, 5]);

/** Posizioni a pari merito per punti (1, 1, 3…). */
export function ranksByPoints<T extends { id: string }>(rows: T[], points: (r: T) => number): Map<string, number> {
  const sorted = [...rows].sort((a, b) => points(b) - points(a));
  const out = new Map<string, number>();
  let rank = 0;
  sorted.forEach((r, i) => {
    if (i === 0 || points(r) !== points(sorted[i - 1])) rank = i + 1;
    out.set(r.id, rank);
  });
  return out;
}

const ref = (p: ShowPlayer): PlayerRef => (p.gender ? { id: p.id, nickname: p.nickname, gender: p.gender } : { id: p.id, nickname: p.nickname });

export function detectShowEvents(input: DetectInput): ShowEvent[] {
  const players = input.players.filter((p) => p.inPlay);
  if (players.length === 0) return [];
  const out: ShowEvent[] = [];
  const now = ranksByPoints(players, (p) => p.points);
  const before = ranksByPoints(players, (p) => p.prevPoints);
  const leaders = players.filter((p) => now.get(p.id) === 1);
  const prevLeaders = players.filter((p) => before.get(p.id) === 1);
  const prevTop = Math.max(...players.map((p) => p.prevPoints));
  const sameSet = (a: ShowPlayer[], b: ShowPlayer[]) => a.length === b.length && a.every((x) => b.some((y) => y.id === x.id));

  // --- primo posto ---
  if (leaders.length === 1 && prevTop > 0 && !prevLeaders.some((p) => p.id === leaders[0].id)) {
    out.push({ type: "LEADER_CHANGED", leader: ref(leaders[0]), previous: ref(prevLeaders[0]), points: leaders[0].points });
  } else if (leaders.length > 1 && leaders[0].points > 0 && !sameSet(leaders, prevLeaders)) {
    out.push({ type: "LEADER_TIE", leaders: leaders.map(ref), points: leaders[0].points });
  } else if (leaders.length === 1 && input.leaderStreak >= 3 && input.leaderStreak % 3 === 0) {
    out.push({ type: "LEADER_KEPT", leader: ref(leaders[0]), questions: input.leaderStreak });
  }

  // --- sorpasso più in alto in classifica (escluso chi è appena diventato primo: c'è già l'evento) ---
  const newLeaderId = out.some((e) => e.type === "LEADER_CHANGED") ? leaders[0].id : null;
  let best: { a: ShowPlayer; b: ShowPlayer; rank: number } | null = null;
  for (const a of players) {
    if (a.id === newLeaderId) continue;
    for (const b of players) {
      if (a.id === b.id) continue;
      if (a.prevPoints < b.prevPoints && a.points > b.points) {
        const r = now.get(a.id)!;
        if (!best || r < best.rank) best = { a, b, rank: r };
      }
    }
  }
  if (best) out.push({ type: "OVERTAKE", who: ref(best.a), overtaken: ref(best.b) });

  // --- rimonta ---
  if (players.length >= 6) {
    let top: { p: ShowPlayer; gain: number } | null = null;
    for (const p of players) {
      const gain = before.get(p.id)! - now.get(p.id)!;
      if (gain >= 3 && (!top || gain > top.gain)) top = { p, gain };
    }
    if (top) out.push({ type: "COMEBACK", who: ref(top.p), positions: top.gain });
  }

  // --- nuovo ultimo ---
  if (players.length >= 4) {
    const lastRank = Math.max(...players.map((p) => now.get(p.id)!));
    const last = players.filter((p) => now.get(p.id) === lastRank);
    const prevLastRank = Math.max(...players.map((p) => before.get(p.id)!));
    if (last.length === 1 && before.get(last[0].id) !== prevLastRank) out.push({ type: "NEW_LAST", who: ref(last[0]) });
  }

  // --- risposte ---
  const answered = players.filter((p) => p.answered);
  const correct = players.filter((p) => p.correct);
  if (correct.length >= 2) {
    const fastest = [...correct].filter((p) => p.responseMs !== null).sort((a, b) => a.responseMs! - b.responseMs! || a.nickname.localeCompare(b.nickname))[0];
    if (fastest) out.push({ type: "FASTEST_CORRECT", who: ref(fastest), ms: fastest.responseMs! });
  }
  if (correct.length === 1 && answered.length >= 3) out.push({ type: "ONLY_ONE_CORRECT", who: ref(correct[0]) });
  const wrong = answered.filter((p) => !p.correct);
  if (wrong.length === 1 && answered.length >= 3) out.push({ type: "ONLY_ONE_WRONG", who: ref(wrong[0]) });
  if (correct.length === 0 && answered.length >= 2) out.push({ type: "ALL_WRONG" });
  if (players.length >= 3 && correct.length === players.length) out.push({ type: "ALL_CORRECT" });

  // --- serie ---
  const streaker = [...players].filter((p) => p.correct && CORRECT_STREAKS.has(p.correctStreak)).sort((a, b) => b.correctStreak - a.correctStreak)[0];
  if (streaker) out.push({ type: "CORRECT_STREAK", who: ref(streaker), streak: streaker.correctStreak });
  const wrongStreaker = [...players].filter((p) => p.answered && !p.correct && WRONG_STREAKS.has(p.wrongStreak)).sort((a, b) => b.wrongStreak - a.wrongStreak)[0];
  if (wrongStreaker) out.push({ type: "WRONG_STREAK", who: ref(wrongStreaker), streak: wrongStreaker.wrongStreak });

  // --- soglie di punteggio ---
  for (const t of [...POINT_MILESTONES].reverse()) {
    const crossed = players.filter((p) => p.prevPoints < t && p.points >= t).sort((a, b) => b.points - a.points)[0];
    if (crossed) {
      out.push({ type: "POINTS_MILESTONE", who: ref(crossed), threshold: t });
      break;
    }
  }

  // --- fine round: chi ha vinto il ROUND (punti fatti nel round) ---
  if (input.endOfRound) {
    const rp = input.roundPoints;
    const score = (p: ShowPlayer) => (rp ? (rp.get(p.id) ?? 0) : p.points);
    const top = Math.max(...players.map(score));
    if (top > 0) out.push({ type: "ROUND_WINNER", leaders: players.filter((p) => score(p) === top).map(ref), points: top });
  }
  return out;
}

export interface ShowTeam {
  id: string;
  name: string;
  /** punteggio di squadra dopo la domanda (somma o media, come la classifica a squadre) */
  points: number;
  /** punteggio di squadra prima della domanda */
  prevPoints: number;
  members: number;
}

export interface DetectTeamInput {
  mode: TeamMode;
  teams: ShowTeam[];
  endOfRound: boolean;
  /** punti di squadra fatti nel round (vincitrice del round = più punti nel round) */
  roundPoints?: ReadonlyMap<string, number>;
}

const teamRef = (t: ShowTeam): TeamRef => ({ id: t.id, name: t.name });

/** Eventi delle squadre (vuoto se la serata non è a squadre). Funzione pura e deterministica. */
export function detectTeamEvents(input: DetectTeamInput): ShowEvent[] {
  if (!teamsEnabled(input.mode)) return [];
  const teams = input.teams.filter((t) => t.members > 0);
  if (teams.length < 2) return [];
  const out: ShowEvent[] = [];
  const now = ranksByPoints(teams, (t) => t.points);
  const before = ranksByPoints(teams, (t) => t.prevPoints);
  const leaders = teams.filter((t) => now.get(t.id) === 1);
  const prevLeaders = teams.filter((t) => before.get(t.id) === 1);
  const prevTop = Math.max(...teams.map((t) => t.prevPoints));
  if (leaders.length === 1 && prevLeaders.length === 1 && prevTop > 0 && prevLeaders[0].id !== leaders[0].id) {
    out.push({ type: "TEAM_LEADER_CHANGED", team: teamRef(leaders[0]), previous: teamRef(prevLeaders[0]), points: leaders[0].points });
  }
  if (input.endOfRound) {
    const rp = input.roundPoints;
    const score = (t: ShowTeam) => (rp ? (rp.get(t.id) ?? 0) : t.points);
    const top = Math.max(...teams.map(score));
    if (top > 0) out.push({ type: "TEAM_ROUND_WINNER", teams: teams.filter((t) => score(t) === top).map(teamRef), points: top });
  }
  return out;
}

/**
 * Eventi del momento secondo la modalità: individuale → solo giocatori; "both" → giocatori + squadre;
 * "teams" → giocatori + squadre, ma la vittoria del round è solo della squadra.
 */
export function combineShowEvents(mode: TeamMode, individual: ShowEvent[], team: ShowEvent[]): ShowEvent[] {
  if (!teamsEnabled(mode)) return individual;
  const own = mode === "teams" ? individual.filter((e) => e.type !== "ROUND_WINNER") : individual;
  return [...own, ...team];
}

/** Squadre a cui l'evento si riferisce (per non nominarle due volte nello stesso momento). */
export function eventTeams(e: ShowEvent): TeamRef[] {
  if (e.type === "TEAM_LEADER_CHANGED") return [e.team, e.previous];
  if (e.type === "TEAM_ROUND_WINNER") return e.teams;
  if (e.type === "TEAM_NO_ANSWER") return [e.team];
  return [];
}

/** Concorrenti a cui l'evento si riferisce (per i limiti di menzioni). Gli eventi di squadra non nominano giocatori. */
export function eventPlayers(e: ShowEvent): PlayerRef[] {
  switch (e.type) {
    case "TEAM_LEADER_CHANGED":
    case "TEAM_ROUND_WINNER":
      return [];
    case "LEADER_CHANGED":
      return [e.leader, e.previous];
    case "LEADER_TIE":
    case "ROUND_WINNER":
      return e.leaders;
    case "LEADER_KEPT":
      return [e.leader];
    case "OVERTAKE":
      return [e.who, e.overtaken];
    case "ALL_WRONG":
    case "ALL_CORRECT":
      return [];
    case "PLAYERS_JOINED":
      return e.greeted;
    case "FINAL_ROUND_START":
      return [e.leader, e.runnerUp];
    case "RETORT_PROFESSORE":
    case "RETORT_REGINA":
    case "RETORT_PALMINO":
      return e.about ? [e.about] : [];
    case "ANSWER_WRONG":
    case "EASY_WRONG":
    case "ANSWER_CORRECT":
    case "LOSE_PATIENCE":
    case "TIME_RUNNING_OUT":
    case "WHEEL_SPIN":
    case "MANY_NO_ANSWER":
    case "TEAM_NO_ANSWER":
    case "FILLER":
    case "LEADERBOARD_QUIP":
    case "GAME_END":
      return [];
    case "GAME_WINNER":
      return [{ id: e.winner.id, nickname: e.winner.name, gender: e.winner.gender ?? null }];
    default:
      return [e.who];
  }
}
