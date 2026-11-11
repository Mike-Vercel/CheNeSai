import type { LeaderboardEntry, PublicState, RoundLeaderboardEntry, TeamLeaderboardEntry, TeamRoundLeaderboardEntry } from "@/lib/game-engine/types";

/**
 * Modalità squadre lato schermo (TV, telefoni, voce): quale classifica raccontare.
 * - "teams": classifica, podio e voce parlano delle SQUADRE (nomi di squadra, mai di un giocatore);
 * - "both": classifica a squadre + individuale, podio individuale con la squadra vincitrice;
 * - individuale (teams = null): tutto come prima.
 */
export function teamMode(state: Pick<PublicState, "teams">): "individual" | "teams" | "both" {
  return state.teams?.mode ?? "individual";
}

/** Le squadre come righe di classifica (per podio e voce, che lavorano su nome/posizione/punti). */
export function teamsAsEntries(rows: TeamLeaderboardEntry[]): LeaderboardEntry[] {
  return rows.map((t) => ({
    participantId: t.teamId,
    rank: t.rank,
    previousRank: t.previousRank,
    nickname: t.name,
    points: t.points,
    lastDelta: t.lastDelta,
    correctCount: 0,
  }));
}

/** Classifica da usare per podio e voce: le squadre in modalità "teams", altrimenti i giocatori. */
export function standingsForShow(state: Pick<PublicState, "teams" | "teamLeaderboard" | "leaderboard">): LeaderboardEntry[] {
  if (teamMode(state) === "teams" && state.teamLeaderboard) return teamsAsEntries(state.teamLeaderboard);
  return state.leaderboard ?? [];
}

/** Squadre in testa (più di una se a pari merito). */
export function leadingTeams(state: Pick<PublicState, "teamLeaderboard">): TeamLeaderboardEntry[] {
  return (state.teamLeaderboard ?? []).filter((t) => t.rank === 1);
}

/** Classifica del round come righe di classifica (punti = punti del round). */
export function roundAsEntries(rows: readonly RoundLeaderboardEntry[]): LeaderboardEntry[] {
  return rows.map((r) => ({ participantId: r.participantId, rank: r.rank, previousRank: null, nickname: r.nickname, points: r.points, lastDelta: r.points, correctCount: 0 }));
}

export function teamRoundAsEntries(rows: readonly TeamRoundLeaderboardEntry[]): LeaderboardEntry[] {
  return rows.map((t) => ({ participantId: t.teamId, rank: t.rank, previousRank: null, nickname: t.name, points: t.points, lastDelta: t.points, correctCount: 0 }));
}

/**
 * Classifica del ROUND per la voce: le squadre in modalità "teams", altrimenti i giocatori.
 * null se lo stato non la contiene (fuori dalla fine del round).
 */
export function roundStandingsForShow(state: Pick<PublicState, "teams" | "roundLeaderboard" | "teamRoundLeaderboard">): LeaderboardEntry[] | null {
  if (teamMode(state) === "teams") return state.teamRoundLeaderboard ? teamRoundAsEntries(state.teamRoundLeaderboard) : null;
  return state.roundLeaderboard ? roundAsEntries(state.roundLeaderboard) : null;
}
