import type { Db, Tx } from "@/lib/database/db";
import { rankRoundStandings } from "@/lib/game-engine/ranking";
import { computeTeamStandings, type TeamAggregation } from "@/lib/game-engine/teams";
import type { RoundLeaderboardEntry, TeamRoundLeaderboardEntry } from "@/lib/game-engine/types";

/**
 * Classifica del ROUND: i punti fatti nelle domande del round (somma dei movimenti ufficiali in
 * score_events: risposte, mancate risposte, bonus e puntate legati alle domande del round).
 * Le rettifiche manuali senza domanda non appartengono a nessun round. Solo letture.
 */
export interface RoundStandingRow {
  participantId: string;
  nickname: string;
  teamId: string | null;
  joinedAt: string;
  points: number;
  total: number;
}

export async function loadRoundStandingRows(db: Db | Tx, sessionId: string, roundId: string): Promise<RoundStandingRow[]> {
  const rows = await db<{ id: string; nickname: string; team_id: string | null; joined_at: Date; total: number; round_points: number }[]>`
    select p.id, p.nickname, p.team_id, p.joined_at, t.points as total, coalesce(r.pts, 0)::int as round_points
    from participants p
    join score_totals t on t.participant_id = p.id
    left join (
      select se.participant_id, sum(se.delta) as pts
      from score_events se join session_questions sq on sq.id = se.session_question_id
      where se.session_id = ${sessionId} and sq.round_id = ${roundId}
      group by se.participant_id
    ) r on r.participant_id = p.id
    where p.session_id = ${sessionId} and p.status = 'active'`;
  return rows.map((r) => ({
    participantId: r.id,
    nickname: r.nickname,
    teamId: r.team_id,
    joinedAt: r.joined_at.toISOString(),
    points: r.round_points,
    total: r.total,
  }));
}

/** Classifica individuale del round (prime `limit` righe). */
export function roundLeaderboardFrom(rows: RoundStandingRow[], limit: number): RoundLeaderboardEntry[] {
  return rankRoundStandings(rows)
    .slice(0, limit)
    .map((r) => ({ participantId: r.participantId, rank: r.rank, nickname: r.nickname, points: r.points, total: r.total }));
}

/** Classifica del round a squadre (somma o media dei punti del round dei membri). */
export function teamRoundLeaderboardFrom(
  rows: RoundStandingRow[],
  teams: { id: string; name: string; color: string; position: number }[],
  aggregation: TeamAggregation,
): TeamRoundLeaderboardEntry[] {
  const round = computeTeamStandings(
    teams,
    rows.map((r) => ({ teamId: r.teamId, points: r.points, lastDelta: 0, correctCount: 0 })),
    aggregation,
  );
  const totals = new Map(
    computeTeamStandings(
      teams,
      rows.map((r) => ({ teamId: r.teamId, points: r.total, lastDelta: 0, correctCount: 0 })),
      aggregation,
    ).map((t) => [t.teamId, t.points]),
  );
  return round.map((t) => ({ teamId: t.teamId, rank: t.rank, name: t.name, color: t.color, members: t.members, points: t.points, total: totals.get(t.teamId) ?? 0 }));
}
