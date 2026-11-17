import type { AcceptedSubmission, InputMode, MechanicDef, PhaseCtx, ScoreOutput } from "./contract";
import { rngFrom } from "./components/rng";
import { durationOf, scopeTeams } from "./components/submissions";

/**
 * Estensioni FACOLTATIVE accanto al contratto (non ne cambiano la forma).
 *
 * - `publicViewAt`: vista pubblica a un certo istante della prova. Il contratto non passa l'orologio a
 *   `publicView`, quindi per le prove a tempo (indizi che si aprono, scena che sparisce) `publicView`
 *   contiene la linea del tempo completa e la UI la rispetta. Se il runtime chiama `publicViewAt` a ogni
 *   lettura, i dati futuri NON partono proprio verso i telefoni (consigliato).
 * - `demoSubmissions`: invii finti plausibili (anteprima e test).
 * - `effect`: effetto di gioco non in punti che il runtime deve applicare (es. lo scudo).
 *
 * `score()` di alcune meccaniche restituisce anche `summary` (dati aggregati e anonimi: conteggi dei voti,
 * offerte per tavolo…): il runtime deve passare a `reveal()` e alla TV l'oggetto restituito da `score()`
 * così com'è (campo in più compreso). Senza `summary` il reveal funziona lo stesso, con meno dettagli.
 */
export interface MechanicExtras<C = unknown, S = unknown> {
  publicViewAt?: (content: C, ctx: PhaseCtx, elapsedMs: number) => unknown;
  demoSubmissions: (content: C, ctx: PhaseCtx, seed: string) => AcceptedSubmission<S>[];
  effect?: { kind: "scudo"; when: "correct"; note: string };
}

export interface MechanicModule<C = unknown, S = unknown> {
  def: MechanicDef<C, S>;
  extras: MechanicExtras<C, S>;
}

export type ScoreWithSummary<T> = ScoreOutput & { summary?: T };

/** Riassunto (se presente) dell'esito: vedi nota sopra. */
export function summaryOf<T>(out: ScoreOutput | null | undefined): T | null {
  const s = (out as ScoreWithSummary<T> | null | undefined)?.summary;
  return s === undefined ? null : s;
}

/** Campi comuni di ogni vista pubblica. */
export interface BaseView {
  /** codice della meccanica */
  mechanic: string;
  number: number;
  title: string;
  rule: string;
  input: InputMode;
  /** durata della prova (ms); la UI ricava il tempo trascorso da `deadlineAt`: durationMs − (deadlineAt − now) */
  durationMs: number;
}

export function baseView(def: Pick<MechanicDef, "code" | "number" | "title" | "rule" | "input" | "timerSec">, ctx: PhaseCtx): BaseView {
  const d = durationOf(ctx);
  return { mechanic: def.code, number: def.number, title: def.title, rule: def.rule, input: def.input, durationMs: d > 0 ? d : def.timerSec * 1000 };
}

// ---------------------------------------------------------------------------
// Invii finti per anteprima e test (deterministici)
// ---------------------------------------------------------------------------

/**
 * Per ogni tavolo della prova chiama `make(team, i, rnd)`; restituisce invii col capitano (o il primo membro)
 * a un tempo plausibile. `skip` (0..1) lascia qualche tavolo senza risposta.
 */
export function demoPerTeam<S>(
  ctx: PhaseCtx,
  seed: string,
  make: (teamIndex: number, rnd: () => number) => S | null,
  opts: { minMs?: number; maxMs?: number } = {},
): AcceptedSubmission<S>[] {
  const rnd = rngFrom(`${seed}:demo`);
  const dur = durationOf(ctx) || 60000;
  const min = opts.minMs ?? Math.round(dur * 0.2);
  const max = opts.maxMs ?? Math.round(dur * 0.85);
  const out: AcceptedSubmission<S>[] = [];
  scopeTeams(ctx).forEach((t, i) => {
    const payload = make(i, rnd);
    if (payload === null) return;
    const memberId = t.captainId ?? t.members[0] ?? `${t.teamId}-m0`;
    out.push({ teamId: t.teamId, memberId, elapsedMs: Math.round(min + rnd() * (max - min)), payload });
  });
  return out;
}

/** Come sopra ma un invio per OGNI membro attivo (voto individuale). */
export function demoPerMember<S>(
  ctx: PhaseCtx,
  seed: string,
  make: (teamIndex: number, memberIndex: number, rnd: () => number) => S | null,
): AcceptedSubmission<S>[] {
  const rnd = rngFrom(`${seed}:demo-voti`);
  const dur = durationOf(ctx) || 60000;
  const out: AcceptedSubmission<S>[] = [];
  scopeTeams(ctx).forEach((t, ti) => {
    t.members.forEach((m, mi) => {
      const payload = make(ti, mi, rnd);
      if (payload === null) return;
      out.push({ teamId: t.teamId, memberId: m, elapsedMs: Math.round(dur * (0.2 + rnd() * 0.6)), payload });
    });
  });
  return out;
}

/** Sceglie la risposta giusta con probabilità `p`, altrimenti una sbagliata a caso. */
export function pickAnswer(rnd: () => number, correct: string, all: readonly string[], p: number): string {
  if (rnd() < p) return correct;
  const wrong = all.filter((x) => x !== correct);
  return wrong.length ? wrong[Math.floor(rnd() * wrong.length)] : correct;
}

/** Abilità simulata dei tavoli finti: il primo forte, il secondo medio, gli altri a caso. */
export function demoSkill(teamIndex: number): number {
  return teamIndex === 0 ? 0.9 : teamIndex === 1 ? 0.6 : 0.35;
}
