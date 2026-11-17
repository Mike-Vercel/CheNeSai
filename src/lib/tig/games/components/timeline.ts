/**
 * Vincoli di tempo e spostamento per i casi «alibi» (n. 59): validatore PURO usato dai test sul contenuto
 * e dal reveal. Una tappa è impossibile se non si può arrivare in tempo dalla precedente (permanenza +
 * tragitto) o se il luogo è chiuso a quell'ora.
 */

export interface Place {
  id: string;
  name: string;
  /** apertura/chiusura "HH:MM" (facoltative) */
  opens?: string;
  closes?: string;
}

export interface Leg {
  from: string;
  to: string;
  minutes: number;
}

export interface Step {
  id: string;
  /** "HH:MM" (stessa serata; dopo mezzanotte usare 24:xx) */
  time: string;
  place: string;
  /** minuti di permanenza dichiarati (facoltativi, default 0) */
  stayMin?: number;
}

export function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return Number.NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function travelMinutes(legs: readonly Leg[], a: string, b: string): number | null {
  if (a === b) return 0;
  const leg = legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
  return leg ? leg.minutes : null;
}

export interface StepIssue {
  stepId: string;
  kind: "tragitto" | "orario";
}

/** Tutte le tappe impossibili (in un caso ben scritto: esattamente una). */
export function impossibleSteps(steps: readonly Step[], places: readonly Place[], legs: readonly Leg[]): StepIssue[] {
  const issues: StepIssue[] = [];
  const placeById = new Map(places.map((p) => [p.id, p]));
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const t = toMinutes(s.time);
    const p = placeById.get(s.place);
    if (p?.opens && t < toMinutes(p.opens)) issues.push({ stepId: s.id, kind: "orario" });
    else if (p?.closes && t >= toMinutes(p.closes)) issues.push({ stepId: s.id, kind: "orario" });
    if (i > 0) {
      const prev = steps[i - 1];
      const travel = travelMinutes(legs, prev.place, s.place);
      const earliest = toMinutes(prev.time) + (prev.stayMin ?? 0) + (travel ?? Number.POSITIVE_INFINITY);
      if (t < earliest && !issues.some((x) => x.stepId === s.id)) issues.push({ stepId: s.id, kind: "tragitto" });
    }
  }
  return issues;
}
