import type { AcceptedSubmission, PhaseCtx, TeamRef } from "../contract";

/**
 * Selezione degli invii validi secondo la modalità d'ingresso. Il runtime deduplica già, ma lo scoring
 * resta corretto anche se gli arrivano invii in più: ordine deterministico (tempo del server, poi membro).
 */

export function sortSubmissions<S>(subs: readonly AcceptedSubmission<S>[]): AcceptedSubmission<S>[] {
  return subs.slice().sort((a, b) => a.elapsedMs - b.elapsedMs || cmp(a.memberId, b.memberId) || cmp(a.teamId, b.teamId));
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Tavoli coinvolti nella prova (i `participants`, o tutti se vuoto), ordinati per numero di tavolo. */
export function scopeTeams(ctx: PhaseCtx): TeamRef[] {
  const ids = new Set(ctx.participants);
  const list = ids.size ? ctx.teams.filter((t) => ids.has(t.teamId)) : ctx.teams.slice();
  return list.sort((a, b) => a.tableNo - b.tableNo || cmp(a.teamId, b.teamId));
}

/**
 * Decisione di squadra: vale il PRIMO invio di ogni tavolo (primo blocco definitivo).
 * `accept` permette di scartare payload non pertinenti (es. invii parziali).
 */
export function firstPerTeam<S>(
  subs: readonly AcceptedSubmission<S>[],
  ctx: PhaseCtx,
  accept: (s: AcceptedSubmission<S>) => boolean = () => true,
): Map<string, AcceptedSubmission<S>> {
  const allowed = new Set(scopeTeams(ctx).map((t) => t.teamId));
  const out = new Map<string, AcceptedSubmission<S>>();
  for (const s of sortSubmissions(subs)) {
    if (!allowed.has(s.teamId) || out.has(s.teamId) || !accept(s)) continue;
    out.set(s.teamId, s);
  }
  return out;
}

/**
 * Voto individuale: vale il PRIMO invio di ogni membro ATTIVO del tavolo (i membri non in `members`
 * non contano: niente voti doppi da telefoni non registrati nella prova).
 */
export function firstPerMember<S>(subs: readonly AcceptedSubmission<S>[], ctx: PhaseCtx): Map<string, Map<string, AcceptedSubmission<S>>> {
  const teams = scopeTeams(ctx);
  const members = new Map(teams.map((t) => [t.teamId, new Set(t.members)]));
  const out = new Map<string, Map<string, AcceptedSubmission<S>>>(teams.map((t) => [t.teamId, new Map()]));
  for (const s of sortSubmissions(subs)) {
    const set = members.get(s.teamId);
    const bucket = out.get(s.teamId);
    if (!set || !bucket || !set.has(s.memberId) || bucket.has(s.memberId)) continue;
    bucket.set(s.memberId, s);
  }
  return out;
}

/** Durata della prova in ms secondo il contesto (fissata all'avvio). */
export function durationOf(ctx: PhaseCtx): number {
  return Math.max(0, ctx.deadlineAt - ctx.startsAt);
}
