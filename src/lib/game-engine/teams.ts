/**
 * Modalità SQUADRE: regole pure (senza database), condivise da server, test, TV e regia.
 *
 * - Ogni giocatore conserva identità e punti personali; la squadra è solo un raggruppamento.
 * - Il punteggio di squadra si calcola dai punti ufficiali dei membri: somma o media (arrotondata).
 * - Posizioni a pari merito come nella classifica individuale (1, 1, 3…).
 * - Una squadra senza giocatori non è in classifica.
 */

export const TEAM_MODES = ["individual", "teams", "both"] as const;
export type TeamMode = (typeof TEAM_MODES)[number];

export const TEAM_AGGREGATIONS = ["sum", "average"] as const;
export type TeamAggregation = (typeof TEAM_AGGREGATIONS)[number];

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 8;

/** Colori proposti per le squadre (alto contrasto sul TV). */
export const TEAM_COLORS = ["#ff3d6e", "#2fd3ff", "#ffc83d", "#5dffab", "#b07cff", "#ff8a3d", "#ff5ad8", "#3d7bff"] as const;

export const TEAM_MODE_LABEL: Record<TeamMode, string> = {
  individual: "Individuale",
  teams: "Squadre",
  both: "Squadre + individuale",
};

export const TEAM_AGGREGATION_LABEL: Record<TeamAggregation, string> = {
  sum: "Somma dei punti",
  average: "Media dei punti",
};

export interface TeamSettings {
  mode: TeamMode;
  /** true: i giocatori scelgono la squadra nella lobby; false: assegna la regia */
  selfSelect: boolean;
  aggregation: TeamAggregation;
}

export const DEFAULT_TEAM_SETTINGS: TeamSettings = { mode: "individual", selfSelect: false, aggregation: "sum" };

export function teamsEnabled(mode: TeamMode | null | undefined): boolean {
  return mode === "teams" || mode === "both";
}

export interface TeamDef {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface TeamMemberScore {
  teamId: string | null;
  points: number;
  lastDelta: number;
  correctCount: number;
}

export interface TeamStanding {
  teamId: string;
  name: string;
  color: string;
  position: number;
  members: number;
  /** punteggio di squadra (somma o media arrotondata) */
  points: number;
  /** variazione dell'ultima domanda, calcolata con la stessa aggregazione */
  lastDelta: number;
  correctCount: number;
  rank: number;
}

/** Somma o media arrotondata (0 se non ci sono valori). */
export function aggregatePoints(values: number[], aggregation: TeamAggregation): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return aggregation === "sum" ? sum : Math.round(sum / values.length);
}

/**
 * Classifica a squadre dai punti ufficiali dei membri.
 * Ordine: punti (decrescente), poi ordine delle squadre e nome solo per un elenco stabile:
 * a parità di punti la posizione è la stessa (pari merito).
 */
export function computeTeamStandings(teams: TeamDef[], members: TeamMemberScore[], aggregation: TeamAggregation): TeamStanding[] {
  const rows: Omit<TeamStanding, "rank">[] = [];
  for (const t of teams) {
    const mine = members.filter((m) => m.teamId === t.id);
    if (mine.length === 0) continue;
    const now = aggregatePoints(
      mine.map((m) => m.points),
      aggregation,
    );
    const before = aggregatePoints(
      mine.map((m) => m.points - m.lastDelta),
      aggregation,
    );
    rows.push({
      teamId: t.id,
      name: t.name,
      color: t.color,
      position: t.position,
      members: mine.length,
      points: now,
      lastDelta: now - before,
      correctCount: mine.reduce((a, m) => a + m.correctCount, 0),
    });
  }
  rows.sort((a, b) => b.points - a.points || a.position - b.position || a.name.localeCompare(b.name, "it") || (a.teamId < b.teamId ? -1 : 1));
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.points !== rows[i - 1].points) rank = i + 1;
    return { ...r, rank };
  });
}

export interface BalancePlayer {
  id: string;
  points: number;
  teamId: string | null;
}

/**
 * "Bilancia squadre": distribuisce i giocatori perché le squadre abbiano lo stesso numero
 * di membri (±1) e punti il più possibile simili. Deterministico.
 * - onlyUnassigned: tiene chi ha già una squadra e sistema solo gli altri.
 * Restituisce solo i giocatori la cui squadra cambia.
 */
export function balanceTeams(
  teams: Pick<TeamDef, "id" | "position">[],
  players: BalancePlayer[],
  opts: { onlyUnassigned?: boolean } = {},
): { participantId: string; teamId: string }[] {
  if (teams.length === 0) return [];
  const ordered = [...teams].sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1));
  const valid = new Set(ordered.map((t) => t.id));
  const count = new Map(ordered.map((t) => [t.id, 0]));
  const sum = new Map(ordered.map((t) => [t.id, 0]));
  const keep = opts.onlyUnassigned ? players.filter((p) => p.teamId && valid.has(p.teamId)) : [];
  for (const p of keep) {
    count.set(p.teamId!, count.get(p.teamId!)! + 1);
    sum.set(p.teamId!, sum.get(p.teamId!)! + p.points);
  }
  const keptIds = new Set(keep.map((p) => p.id));
  const toPlace = players.filter((p) => !keptIds.has(p.id)).sort((a, b) => b.points - a.points || (a.id < b.id ? -1 : 1));
  const out: { participantId: string; teamId: string }[] = [];
  for (const p of toPlace) {
    let best = ordered[0].id;
    for (const t of ordered) {
      const c = count.get(t.id)!;
      const bc = count.get(best)!;
      if (c < bc || (c === bc && sum.get(t.id)! < sum.get(best)!)) best = t.id;
    }
    count.set(best, count.get(best)! + 1);
    sum.set(best, sum.get(best)! + p.points);
    if (p.teamId !== best) out.push({ participantId: p.id, teamId: best });
  }
  return out;
}
