import { getSql, type Db, type Tx } from "@/lib/database/db";
import {
  computeTeamStandings,
  teamsEnabled,
  type TeamAggregation,
  type TeamDef,
  type TeamSettings,
  type TeamStanding,
} from "@/lib/game-engine/teams";
import { EARLY_JOIN_PHASES } from "@/lib/game-engine/transitions";
import type { GamePhase, PublicTeamsInfo, TeamLeaderboardEntry } from "@/lib/game-engine/types";
import type { SessionSettings } from "@/lib/validation/schemas";
import { PlayerError, type PlayerAuth } from "./players";
import { teamSettingsOf } from "./settings";

/**
 * Squadre lato server: classifica dai punti ufficiali (score_totals), posizioni con frecce
 * di movimento, informazioni pubbliche per TV/telefoni e scelta della squadra dal telefono.
 */

interface TeamRow {
  id: string;
  name: string;
  color: string;
  position: number;
  rank: number | null;
  previous_rank: number | null;
}

export async function loadTeamDefs(db: Db, sessionId: string): Promise<TeamRow[]> {
  return db<TeamRow[]>`
    select id, name, color, position, rank, previous_rank from teams where session_id = ${sessionId} order by position, name`;
}

/** Punti ufficiali dei giocatori attivi che fanno parte di una squadra. */
async function loadMemberScores(db: Db, sessionId: string) {
  return db<{ teamId: string; points: number; lastDelta: number; correctCount: number }[]>`
    select p.team_id as "teamId", t.points, t.last_delta as "lastDelta", t.correct_count as "correctCount"
    from participants p join score_totals t on t.participant_id = p.id
    where p.session_id = ${sessionId} and p.status = 'active' and p.team_id is not null`;
}

export async function computeSessionTeamStandings(db: Db, sessionId: string, aggregation: TeamAggregation): Promise<{ teams: TeamRow[]; standings: TeamStanding[] }> {
  const teams = await loadTeamDefs(db, sessionId);
  if (teams.length === 0) return { teams, standings: [] };
  const members = await loadMemberScores(db, sessionId);
  const defs: TeamDef[] = teams.map((t) => ({ id: t.id, name: t.name, color: t.color, position: t.position }));
  return { teams, standings: computeTeamStandings(defs, members, aggregation) };
}

/**
 * Aggiorna le posizioni salvate delle squadre (per le frecce ▲▼), come `rerank` per i giocatori.
 * Senza modalità squadre non fa nulla.
 */
export async function rerankTeams(tx: Tx, sessionId: string): Promise<void> {
  const [s] = await tx<{ settings: SessionSettings }[]>`select settings from game_sessions where id = ${sessionId}`;
  const ts = teamSettingsOf(s?.settings);
  if (!teamsEnabled(ts.mode)) return;
  const { teams, standings } = await computeSessionTeamStandings(tx, sessionId, ts.aggregation);
  if (teams.length === 0) return;
  const rankOf = new Map(standings.map((r) => [r.teamId, r.rank]));
  const ids = teams.map((t) => t.id);
  const ranks = teams.map((t) => rankOf.get(t.id) ?? null);
  await tx`
    update teams t
    set previous_rank = case when t.rank is distinct from v.rank then t.rank else t.previous_rank end,
        rank = v.rank, updated_at = now()
    from (select unnest(${tx.array(ids)}::uuid[]) as id, unnest(${tx.array(ranks as number[])}::int[]) as rank) v
    where t.id = v.id`;
}

/** Classifica a squadre per lo stato pubblico (nessun nome di giocatore). */
export async function loadTeamLeaderboard(db: Db, sessionId: string, aggregation: TeamAggregation): Promise<TeamLeaderboardEntry[]> {
  const { teams, standings } = await computeSessionTeamStandings(db, sessionId, aggregation);
  const stored = new Map(teams.map((t) => [t.id, t]));
  return standings.map((r) => {
    const t = stored.get(r.teamId);
    // se la posizione salvata non è aggiornata, è lei la "posizione precedente"
    const previousRank = !t ? null : t.rank === r.rank ? t.previous_rank : t.rank;
    return {
      teamId: r.teamId,
      rank: r.rank,
      previousRank,
      name: r.name,
      color: r.color,
      members: r.members,
      points: r.points,
      lastDelta: r.lastDelta,
    };
  });
}

/** Squadre della serata con il numero di membri (null se la partita è individuale). */
export async function loadPublicTeams(db: Db, sessionId: string, ts: TeamSettings): Promise<PublicTeamsInfo | null> {
  if (!teamsEnabled(ts.mode)) return null;
  const rows = await db<{ id: string; name: string; color: string; position: number; members: number }[]>`
    select t.id, t.name, t.color, t.position,
      (select count(*)::int from participants p where p.team_id = t.id and p.status = 'active') as members
    from teams t where t.session_id = ${sessionId} order by t.position, t.name`;
  return { mode: ts.mode as PublicTeamsInfo["mode"], selfSelect: ts.selfSelect, aggregation: ts.aggregation, list: rows };
}

/** Squadra del giocatore (per il telefono). */
export async function loadPlayerTeam(db: Db, participantId: string): Promise<{ id: string; name: string; color: string } | null> {
  const [t] = await db<{ id: string; name: string; color: string }[]>`
    select t.id, t.name, t.color from participants p join teams t on t.id = p.team_id where p.id = ${participantId}`;
  return t ?? null;
}

/**
 * Scelta della squadra dal telefono (solo se la regia lo consente).
 * Nella lobby si può cambiare liberamente; a partita iniziata solo chi non ha ancora una squadra.
 */
export async function chooseTeam(auth: PlayerAuth, teamId: string): Promise<{ teamId: string; name: string; color: string }> {
  const sql = getSql();
  const out = await sql.begin(async (tx) => {
    const [g] = await tx<{ phase: GamePhase; settings: SessionSettings; current_team: string | null; status: string }[]>`
      select gs.phase, s.settings, p.team_id as current_team, p.status
      from participants p
      join game_sessions s on s.id = p.session_id
      join game_state gs on gs.session_id = s.id
      where p.id = ${auth.participantId} and p.session_id = ${auth.sessionId}
      for update of p`;
    if (!g) throw new PlayerError("NOT_JOINED", "Non sei ancora entrato in questa partita");
    if (g.status !== "active") throw new PlayerError("KICKED", "Sei stato escluso da questa partita dalla regia");
    const ts = teamSettingsOf(g.settings);
    if (!teamsEnabled(ts.mode)) throw new PlayerError("NOT_OPEN", "Questa partita non è a squadre");
    if (!ts.selfSelect) throw new PlayerError("NOT_OPEN", "Le squadre le assegna la regia");
    if (g.phase === "FINISHED") throw new PlayerError("GAME_FINISHED", "Questa partita è terminata");
    const lobby = g.phase === "READY" || EARLY_JOIN_PHASES.includes(g.phase);
    if (!lobby && g.current_team) throw new PlayerError("NOT_OPEN", "La partita è iniziata: la squadra non si può più cambiare");
    const [team] = await tx<{ id: string; name: string; color: string }[]>`
      select id, name, color from teams where id = ${teamId} and session_id = ${auth.sessionId}`;
    if (!team) throw new PlayerError("NOT_FOUND", "Squadra non trovata");
    await tx`update participants set team_id = ${team.id}, last_seen_at = now() where id = ${auth.participantId}`;
    await rerankTeams(tx, auth.sessionId);
    return { teamId: team.id, name: team.name, color: team.color };
  });
  return out;
}
