/**
 * COMPONENTE BASE 8 — FRAMMENTI COOPERATIVI.
 * Il codice ha sempre la stessa lunghezza; i frammenti si dividono tra i telefoni ATTIVI del tavolo
 * (a turno). Con un solo telefono arrivano tutti allo stesso: la difficoltà resta identica, cambia solo
 * quanto lavoro fa ciascuno. Con più telefoni che frammenti, i frammenti si ripetono (nessuno resta senza).
 */
export function fragmentsFor(memberIndex: number, memberCount: number, total: number): number[] {
  if (total <= 0) return [];
  const m = Math.max(1, memberCount);
  const idx = ((memberIndex % m) + m) % m;
  if (m >= total) return [idx % total];
  const out: number[] = [];
  for (let p = 0; p < total; p++) if (p % m === idx) out.push(p);
  return out;
}

/** Quante posizioni coincidono (stessa cifra nella stessa posizione). */
export function matchingPositions(submitted: string, solution: string): number {
  let n = 0;
  for (let i = 0; i < solution.length; i++) if (submitted[i] === solution[i]) n++;
  return n;
}
