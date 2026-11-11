import type { LeaderboardEntry, PublicState, TeamLeaderboardEntry } from "@/lib/game-engine/types";

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
