import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { CHAOS, outcome, noAnswer } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, text, variantId } from "./_shared";
import { difficultySchema, duelGroups, secLabel } from "./m5-shared";

/**
 * 72 · DUELLO SILENZIOSO (manche 5) — i tavoli sono accoppiati (seme della prova; con un numero dispari
 * l'ultimo gruppo è da tre) e risolvono lo STESSO enigma a combinazione (cifre tutte diverse, righe di prova
 * con «giuste al posto giusto» e «giuste al posto sbagliato»: soluzione unica, verificata dal contenuto).
 * Nessuno sa se l'avversario ha già finito: la TV non mostra chi ha inviato fino al reveal.
 * Vince chi dà la combinazione giusta per primo (tempo del server): +100. Se i due giusti arrivano entro
 * 3 secondi è un PAREGGIO VALIDO: +60 a testa. Chi perde o sbaglia: 0 (mai punti persi).
 */

export const WIN_POINTS = 100;
export const TIE_POINTS = 60;
/** «fotofinish»: due risposte giuste così vicine sono un pareggio valido */
export const TIE_MS = 3000;

const rowSchema = z.object({
  /** tentativo mostrato, es. «682» */
  guess: z.string().regex(/^\d{3,4}$/),
  /** cifre giuste al posto giusto */
  spot: z.number().int().min(0).max(4),
  /** cifre giuste al posto sbagliato */
  near: z.number().int().min(0).max(4),
});
export type DuelloRow = z.infer<typeof rowSchema>;

/** Confronto di un codice con un tentativo (cifre tutte diverse). */
export function feedbackOf(pin: string, guess: string): { spot: number; near: number } {
  let spot = 0;
  let near = 0;
  for (let i = 0; i < guess.length; i++) {
    if (pin[i] === guess[i]) spot++;
    else if (pin.includes(guess[i])) near++;
  }
  return { spot, near };
}

/** Tutte le combinazioni a cifre diverse compatibili con le righe. */
export function candidatesFor(digits: number, rows: readonly DuelloRow[]): string[] {
  const out: string[] = [];
  const max = 10 ** digits;
  for (let n = 0; n < max; n++) {
    const s = String(n).padStart(digits, "0");
    if (new Set(s).size !== digits) continue;
    if (rows.every((r) => {
      const f = feedbackOf(s, r.guess);
      return f.spot === r.spot && f.near === r.near;
    }))
      out.push(s);
  }
  return out;
}

export const duelloContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema.optional(),
    /** cosa si apre, es. «L'armadietto della palestra» */
    title: text(60),
    story: text(200),
    digits: z.number().int().min(3).max(4),
    rows: z.array(rowSchema).min(3).max(6),
    solution: z.object({ pin: z.string().regex(/^\d{3,4}$/) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    c.rows.forEach((r, i) => {
      if (r.guess.length !== c.digits || new Set(r.guess).size !== c.digits) ctx.addIssue({ code: "custom", message: `riga ${i}: ${c.digits} cifre tutte diverse`, path: ["rows", i] });
      if (r.spot + r.near > c.digits) ctx.addIssue({ code: "custom", message: `riga ${i}: indizio impossibile`, path: ["rows", i] });
    });
    const cands = candidatesFor(c.digits, c.rows);
    if (cands.length !== 1) ctx.addIssue({ code: "custom", message: `soluzioni possibili: ${cands.length} (serve 1)` });
    else if (cands[0] !== c.solution.pin) ctx.addIssue({ code: "custom", message: `la soluzione vera è ${cands[0]}` });
  });
export type DuelloContent = z.infer<typeof duelloContent>;
export type DuelloInput = z.input<typeof duelloContent>;

export const duelloSubmission = z.object({ pin: z.string().regex(/^\d{3,4}$/) });
export type DuelloSubmission = z.infer<typeof duelloSubmission>;

export interface DuelloView extends BaseView {
  title: string;
  story: string;
  digits: number;
  rows: DuelloRow[];
  /** gruppi di duello (coppie, o un trio con un numero dispari di tavoli) */
  groups: { teamId: string; tableNo: number }[][];
  winPoints: number;
  tiePoints: number;
  tieMs: number;
}

export interface DuelloSummary {
  groups: { teams: string[]; winners: string[]; tie: boolean; times: Record<string, number | null>; right: Record<string, boolean> }[];
}

export interface DuelloReveal {
  title: string;
  digits: number;
  rows: DuelloRow[];
  pin: string;
  explain: string;
  summary: DuelloSummary | null;
}

function groupsView(ctx: PhaseCtx) {
  return duelGroups(ctx).map((g) => g.map((t) => ({ teamId: t.teamId, tableNo: t.tableNo })));
}

const def: MechanicDef<DuelloContent, DuelloSubmission> = {
  code: "duello-silenzioso",
  number: 72,
  manche: 5,
  title: "Duello silenzioso",
  input: "duel",
  timerSec: 70,
  oneDeviceOk: true,
  needs: [],
  rule: "Stesso enigma per voi e il tavolo rivale, e nessuno vede se l'altro ha finito. Primo giusto +100; entro 3 secondi, pari: +60 a testa.",
  contentSchema: duelloContent,
  submissionSchema: duelloSubmission,
  publicView: (c, ctx): DuelloView => ({
    ...baseView(def, ctx),
    title: c.title,
    story: c.story,
    digits: c.digits,
    rows: c.rows,
    groups: groupsView(ctx),
    winPoints: WIN_POINTS,
    tiePoints: TIE_POINTS,
    tieMs: TIE_MS,
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const summary: DuelloSummary = { groups: [] };
    const pts = new Map<string, { points: number; label: string; won: boolean }>();
    for (const g of duelGroups(ctx)) {
      const right = Object.fromEntries(g.map((t) => [t.teamId, firsts.get(t.teamId)?.payload.pin === content.solution.pin]));
      const times = Object.fromEntries(g.map((t) => [t.teamId, firsts.get(t.teamId)?.elapsedMs ?? null]));
      const good = g.filter((t) => right[t.teamId]).sort((a, b) => (times[a.teamId] ?? 0) - (times[b.teamId] ?? 0) || a.tableNo - b.tableNo);
      let winners: string[] = [];
      let tie = false;
      if (good.length) {
        const t0 = times[good[0].teamId] ?? 0;
        const close = good.filter((t) => (times[t.teamId] ?? 0) - t0 <= TIE_MS);
        tie = close.length > 1;
        winners = (tie ? close : [good[0]]).map((t) => t.teamId);
      }
      summary.groups.push({ teams: g.map((t) => t.teamId), winners, tie, times, right });
      const alone = g.length === 1;
      for (const t of g) {
        const won = winners.includes(t.teamId);
        const sent = times[t.teamId] !== null;
        const points = won ? (tie ? TIE_POINTS : WIN_POINTS) : 0;
        const label = !sent
          ? "Nessuna risposta"
          : won
            ? tie
              ? `Pareggio valido · ${secLabel(times[t.teamId] ?? 0)}`
              : alone
                ? `Combinazione giusta · ${secLabel(times[t.teamId] ?? 0)}`
                : `Duello vinto · ${secLabel(times[t.teamId] ?? 0)}`
            : right[t.teamId]
              ? "Giusta, ma il rivale è arrivato prima"
              : "Combinazione sbagliata";
        pts.set(t.teamId, { points, label, won });
      }
    }
    const out: ScoreWithSummary<DuelloSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const r = pts.get(t.teamId)!;
        const ok = s.payload.pin === content.solution.pin;
        return outcome(t.teamId, {
          points: r.points,
          chaos: CHAOS.partecipa + CHAOS.sfida + (r.won ? CHAOS.centro : 0),
          correct: ok,
          accuracy: ok ? 1 : 0,
          label: r.label,
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): DuelloReveal => ({
    title: c.title,
    digits: c.digits,
    rows: c.rows,
    pin: c.solution.pin,
    explain: c.explain,
    summary: (out as ScoreWithSummary<DuelloSummary>).summary ?? null,
  }),
};

export const duelloSilenzioso: MechanicModule<DuelloContent, DuelloSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        if (rnd() < demoSkill(i) + 0.15) return { pin: c.solution.pin };
        const p = c.solution.pin.split("");
        [p[0], p[1]] = [p[1], p[0]];
        return { pin: p.join("") };
      }),
  },
};
