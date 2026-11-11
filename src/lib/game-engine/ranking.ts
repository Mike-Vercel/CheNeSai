export interface RankInput {
  participantId: string;
  nickname: string;
  points: number;
  correctCount: number;
  correctResponseMs: number;
  joinedAt: string;
}

/**
 * Ordinamento deterministico della classifica. Criteri di spareggio, in ordine:
 * 1. punti (decrescente)
 * 2. numero di risposte corrette (decrescente)
 * 3. tempo totale impiegato nelle risposte corrette (crescente: più veloce vince)
 * 4. orario di ingresso nella sessione (crescente)
 * 5. nickname (ordine alfabetico) e infine id, per stabilità assoluta
 */
export function compareRank(a: RankInput, b: RankInput): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
  if (a.correctResponseMs !== b.correctResponseMs) return a.correctResponseMs - b.correctResponseMs;
  const ja = Date.parse(a.joinedAt);
  const jb = Date.parse(b.joinedAt);
  if (ja !== jb) return ja - jb;
  const n = a.nickname.localeCompare(b.nickname, "it");
  if (n !== 0) return n;
  return a.participantId < b.participantId ? -1 : a.participantId > b.participantId ? 1 : 0;
}

/**
 * Posizioni in classifica. A parità di punti la posizione è la stessa (pari merito:
 * 1, 1, 3…); i criteri di spareggio servono solo a decidere l'ordine in cui vengono elencati.
 */
export function rankParticipants<T extends RankInput>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort(compareRank);
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.points !== sorted[i - 1].points) rank = i + 1;
    return { ...r, rank };
  });
}

export const TIE_BREAK_DESCRIPTION =
  "A parità di punti si è a pari merito (stessa posizione). Nell'elenco viene prima chi ha più risposte corrette, poi chi è stato più veloce.";

export interface PeriodResult {
  identityKey: string;
  nickname: string;
  points: number;
  finalRank: number;
  sessionDate: string;
}

export interface AggregatedStanding {
  identityKey: string;
  nickname: string;
  total: number;
  sessions: number;
  bestRank: number;
  wins: number;
}

/**
 * Aggrega i risultati di più serate (classifica mensile o stagionale).
 * - sum_points: somma dei punti finali
 * - placement_points: punti per piazzamento (es. 25, 18, 15...)
 */
export function aggregateStandings(
  rows: PeriodResult[],
  mode: "sum_points" | "placement_points",
  placementPoints: number[],
): (AggregatedStanding & { rank: number })[] {
  const map = new Map<string, AggregatedStanding & { lastDate: string }>();
  for (const r of rows) {
    const value = mode === "sum_points" ? r.points : (placementPoints[r.finalRank - 1] ?? 0);
    const cur = map.get(r.identityKey);
    if (!cur) {
      map.set(r.identityKey, {
        identityKey: r.identityKey,
        nickname: r.nickname,
        total: value,
        sessions: 1,
        bestRank: r.finalRank,
        wins: r.finalRank === 1 ? 1 : 0,
        lastDate: r.sessionDate,
      });
    } else {
      cur.total += value;
      cur.sessions += 1;
      cur.bestRank = Math.min(cur.bestRank, r.finalRank);
      cur.wins += r.finalRank === 1 ? 1 : 0;
      if (r.sessionDate >= cur.lastDate) {
        cur.nickname = r.nickname;
        cur.lastDate = r.sessionDate;
      }
    }
  }
  return [...map.values()]
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.wins - a.wins ||
        a.bestRank - b.bestRank ||
        b.sessions - a.sessions ||
        a.nickname.localeCompare(b.nickname, "it"),
    )
    .map(({ lastDate: _lastDate, ...rest }, i) => ({ ...rest, rank: i + 1 }));
}
