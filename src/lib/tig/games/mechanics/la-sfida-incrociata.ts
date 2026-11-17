import { z } from "zod";
import type { MechanicDef, PhaseCtx, TeamRef } from "../contract";
import { duelWinner, type DuelSide } from "../components/pairing";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, text, variantId } from "./_shared";
import { difficultySchema, groupsOf, median, type TableRef } from "./m2/shared";

/**
 * 28 · LA SFIDA INCROCIATA (manche 2) — griglia 4×4 da completare con quattro simboli (ogni riga, colonna e
 * riquadro 2×2 li contiene tutti una volta). I tavoli sono accoppiati dal seme: uno riceve la griglia, l'altro la
 * sua versione SPECULARE (colonne rovesciate: stessa difficoltà, soluzione diversa da copiare). Pari condizioni.
 *   - griglia valida: +60;
 *   - duello della coppia: griglia valida nel minor tempo → +40;
 *   - tavolo dispari: sfida il TEMPO MEDIANO delle griglie valide del locale (+40 se è sotto o pari).
 * Si accetta qualunque completamento valido coerente con gli indizi (le varianti hanno soluzione unica).
 */

export const SIZE = 4;
export const CELLS = SIZE * SIZE;
export const INCROCIATA = { valid: 60, duel: 40 } as const;

const gridString = z.string().regex(/^[0-4]{16}$/);

/** La griglia (16 caratteri, riga per riga, 1–4) rispetta righe, colonne e riquadri? */
export function isValidGrid(g: string): boolean {
  if (!/^[1-4]{16}$/.test(g)) return false;
  const at = (r: number, c: number) => g[r * SIZE + c];
  for (let i = 0; i < SIZE; i++) {
    const row = new Set<string>();
    const col = new Set<string>();
    const box = new Set<string>();
    for (let j = 0; j < SIZE; j++) {
      row.add(at(i, j));
      col.add(at(j, i));
      box.add(at(2 * Math.floor(i / 2) + Math.floor(j / 2), 2 * (i % 2) + (j % 2)));
    }
    if (row.size !== SIZE || col.size !== SIZE || box.size !== SIZE) return false;
  }
  return true;
}

/** Rispetta gli indizi (le caselle date)? */
export function fitsGivens(g: string, givens: string): boolean {
  return givens.split("").every((ch, i) => ch === "0" || g[i] === ch);
}

/** Versione speculare (colonne rovesciate): resta una griglia valida, con riquadri che si scambiano. */
export function mirrorGrid(g: string): string {
  let out = "";
  for (let r = 0; r < SIZE; r++) out += g.slice(r * SIZE, r * SIZE + SIZE).split("").reverse().join("");
  return out;
}

/** Numero di soluzioni (si ferma a `limit`), per il controllo editoriale di unicità. */
export function countSolutions(givens: string, limit = 2): number {
  const g = givens.split("");
  let n = 0;
  const ok = (i: number, v: string) => {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    for (let k = 0; k < SIZE; k++) if (g[r * SIZE + k] === v || g[k * SIZE + c] === v) return false;
    const br = 2 * Math.floor(r / 2);
    const bc = 2 * Math.floor(c / 2);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) if (g[(br + a) * SIZE + bc + b] === v) return false;
    return true;
  };
  const go = (i: number): void => {
    if (n >= limit) return;
    if (i === CELLS) {
      n++;
      return;
    }
    if (g[i] !== "0") return go(i + 1);
    for (const v of ["1", "2", "3", "4"]) {
      if (!ok(i, v)) continue;
      g[i] = v;
      go(i + 1);
      g[i] = "0";
    }
  };
  go(0);
  return n;
}

export const incrociataContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** titolo della griglia, es. «Il tavolo perfetto» */
    theme: text(50),
    /** caselle date: 16 caratteri, 0 = vuota */
    givens: gridString,
    solution: z.object({ grid: z.string().regex(/^[1-4]{16}$/) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (!isValidGrid(c.solution.grid)) ctx.addIssue({ code: "custom", message: "soluzione non valida", path: ["solution"] });
    if (!fitsGivens(c.solution.grid, c.givens)) ctx.addIssue({ code: "custom", message: "la soluzione non rispetta gli indizi", path: ["givens"] });
    if (countSolutions(c.givens) !== 1) ctx.addIssue({ code: "custom", message: "la griglia deve avere una sola soluzione", path: ["givens"] });
  });
export type IncrociataContent = z.infer<typeof incrociataContent>;
export type IncrociataInput = z.input<typeof incrociataContent>;

/** Griglia come la vede il tavolo (speculare se è il secondo della coppia). */
export const incrociataSubmission = z.object({ cells: z.string().regex(/^[1-4]{16}$/) });
export type IncrociataSubmission = z.infer<typeof incrociataSubmission>;

export interface IncrociataView extends BaseView {
  theme: string;
  /** indizi della griglia originale; chi ha `mirrored` la vede speculare */
  givens: string;
  pairs: { a: TableRef; b: TableRef | null }[];
  points: typeof INCROCIATA;
}

export interface IncrociataDuel {
  a: string;
  b: string | null;
  winner: string | null;
}

export interface IncrociataSummary {
  duels: IncrociataDuel[];
  /** secondi (interi) di chi ha una griglia valida */
  times: Record<string, number>;
  medianMs: number | null;
}

export interface IncrociataReveal {
  theme: string;
  givens: string;
  grid: string;
  explain: string;
  summary: IncrociataSummary | null;
}

function pairsOf(ctx: PhaseCtx): { a: TeamRef; b: TeamRef | null }[] {
  const teams = scopeTeams(ctx);
  const byId = new Map(teams.map((t) => [t.teamId, t]));
  return groupsOf(
    teams.map((t) => t.teamId),
    ctx.seed,
    "solo",
  ).map((g) => ({ a: byId.get(g[0])!, b: g[1] ? byId.get(g[1])! : null }));
}

/** Il tavolo vede la griglia speculare? */
export function isMirrored(pairs: { b: { teamId: string } | null }[], teamId: string): boolean {
  return pairs.some((p) => p.b?.teamId === teamId);
}

const def: MechanicDef<IncrociataContent, IncrociataSubmission> = {
  code: "la-sfida-incrociata",
  number: 28,
  manche: 2,
  title: "La sfida incrociata",
  input: "duel",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Completate la griglia: ogni simbolo una volta per riga, colonna e riquadro. Valida +60; più rapidi del rivale speculare +40.",
  contentSchema: incrociataContent,
  submissionSchema: incrociataSubmission,
  publicView: (c, ctx): IncrociataView => ({
    ...baseView(def, ctx),
    theme: c.theme,
    givens: c.givens,
    pairs: pairsOf(ctx).map((p) => ({ a: { teamId: p.a.teamId, tableNo: p.a.tableNo }, b: p.b ? { teamId: p.b.teamId, tableNo: p.b.tableNo } : null })),
    points: INCROCIATA,
  }),
  score: ({ content, ctx, submissions }) => {
    const teams = scopeTeams(ctx);
    const firsts = firstPerTeam(submissions, ctx);
    const pairs = pairsOf(ctx);
    /** griglia riportata all'orientamento originale e controllata */
    const valid = (id: string): boolean => {
      const s = firsts.get(id);
      if (!s) return false;
      const g = isMirrored(pairs, id) ? mirrorGrid(s.payload.cells) : s.payload.cells;
      return isValidGrid(g) && fitsGivens(g, content.givens);
    };
    const filled = (id: string): number => {
      const s = firsts.get(id);
      if (!s) return 0;
      const g = isMirrored(pairs, id) ? mirrorGrid(s.payload.cells) : s.payload.cells;
      const blanks = content.givens.split("").map((ch, i) => (ch === "0" ? i : -1)).filter((i) => i >= 0);
      return blanks.length ? blanks.filter((i) => g[i] === content.solution.grid[i]).length / blanks.length : 1;
    };
    const times: Record<string, number> = {};
    for (const t of teams) if (valid(t.teamId)) times[t.teamId] = Math.round(firsts.get(t.teamId)!.elapsedMs / 1000);
    const medianMs = median(teams.filter((t) => valid(t.teamId)).map((t) => firsts.get(t.teamId)!.elapsedMs));
    const side = (t: TeamRef): DuelSide | null => {
      const s = firsts.get(t.teamId);
      return s ? { teamId: t.teamId, tableNo: t.tableNo, correct: valid(t.teamId), elapsedMs: s.elapsedMs } : null;
    };
    const duels: IncrociataDuel[] = pairs.map((p) => {
      if (p.b) return { a: p.a.teamId, b: p.b.teamId, winner: duelWinner(side(p.a), side(p.b)) };
      const s = firsts.get(p.a.teamId);
      const beat = !!s && valid(p.a.teamId) && medianMs !== null && s.elapsedMs <= medianMs;
      return { a: p.a.teamId, b: null, winner: beat ? p.a.teamId : null };
    });
    const out: ScoreWithSummary<IncrociataSummary> = {
      outcomes: teams.map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const ok = valid(t.teamId);
        const d = duels.find((x) => x.a === t.teamId || x.b === t.teamId)!;
        const won = d.winner === t.teamId;
        const rival = d.b === null ? null : teams.find((x) => x.teamId === (d.a === t.teamId ? d.b : d.a));
        return outcome(t.teamId, {
          points: (ok ? INCROCIATA.valid : 0) + (won ? INCROCIATA.duel : 0),
          chaos: CHAOS.partecipa + (d.b ? CHAOS.sfida : 0) + (won ? CHAOS.centro : 0),
          correct: ok,
          accuracy: filled(t.teamId),
          label: !ok ? "Griglia non valida" : won ? (rival ? `Valida e più rapidi del tavolo ${rival.tableNo}` : "Valida e sotto il tempo mediano") : rival ? `Valida, ma il tavolo ${rival.tableNo} è stato più rapido` : "Valida, sopra il tempo mediano",
        });
      }),
      summary: { duels, times, medianMs },
    };
    return out;
  },
  reveal: (c, out): IncrociataReveal => ({ theme: c.theme, givens: c.givens, grid: c.solution.grid, explain: c.explain, summary: (out as ScoreWithSummary<IncrociataSummary>).summary ?? null }),
};

export const laSfidaIncrociata: MechanicModule<IncrociataContent, IncrociataSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      const pairs = pairsOf(ctx);
      const teams = scopeTeams(ctx);
      return demoPerTeam(ctx, seed, (i, rnd) => {
        let g = c.solution.grid;
        if (rnd() > demoSkill(i) + 0.2) {
          // errore tipico: due simboli scambiati in una riga
          const r = Math.floor(rnd() * SIZE);
          const row = g.slice(r * SIZE, r * SIZE + SIZE).split("");
          [row[0], row[1]] = [row[1], row[0]];
          g = g.slice(0, r * SIZE) + row.join("") + g.slice(r * SIZE + SIZE);
        }
        return { cells: isMirrored(pairs, teams[i].teamId) ? mirrorGrid(g) : g };
      });
    },
  },
};
