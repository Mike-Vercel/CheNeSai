import { z } from "zod";
import type { MechanicDef, PhaseCtx, TeamRef } from "../contract";
import { matchingPositions } from "../components/coop";
import { rngFrom, seededShuffle } from "../components/rng";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema, teamOf } from "./_m3";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 46 · ALLEANZA ESPRESSA (manche 3) — i tavoli sono accoppiati col seme della prova (con un numero dispari di
 * tavoli l'ultima alleanza è a tre). In ogni alleanza un tavolo ha la GRIGLIA di cifre (generata dal seme, diversa
 * per ogni alleanza: copiare da un'altra coppia non serve), l'altro ha le COORDINATE delle 4 cifre del codice.
 * Da soli non si risolve: bisogna parlarsi tra tavoli. Codice esatto da TUTTI i tavoli dell'alleanza: 100 a
 * ciascuno; se anche uno solo sbaglia o non risponde, 0 a tutti («entrambi guadagnano o entrambi no»).
 * Un tavolo senza alleati (uno solo in gara) vede entrambe le metà: 60 se risolve.
 */

export const CODE_LEN = 4;
export const SOLO_POINTS = 60;

const stepSchema = z.object({
  /** riga e colonna (0-based) nella griglia */
  row: z.number().int().min(0).max(4),
  col: z.number().int().min(0).max(4),
  /** come la cifra viene indicata a chi ha le coordinate (semplice o in forma d'indovinello) */
  clue: text(100),
});

export const alleanzaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** cosa apre il codice, es. «Il lucchetto dell'armadietto» */
    title: text(60),
    rows: z.array(text(12)).min(4).max(5),
    cols: z.array(text(12)).min(4).max(5),
    steps: z.array(stepSchema).length(CODE_LEN),
    /** passaggio finale scritto nella metà della griglia (facoltativo, per le varianti difficili) */
    transform: z.object({ op: z.enum(["piu-uno", "inverti"]), text: text(120) }).optional(),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (c.rows.length !== c.cols.length) ctx.addIssue({ code: "custom", message: "la griglia deve essere quadrata" });
    c.steps.forEach((s, i) => {
      if (s.row >= c.rows.length || s.col >= c.cols.length) ctx.addIssue({ code: "custom", message: `coordinata ${i + 1} fuori griglia`, path: ["steps", i] });
    });
    const cells = c.steps.map((s) => `${s.row}:${s.col}`);
    if (new Set(cells).size !== cells.length) ctx.addIssue({ code: "custom", message: "due cifre nella stessa casella" });
  });
export type AlleanzaContent = z.infer<typeof alleanzaContent>;
export type AlleanzaInput = z.input<typeof alleanzaContent>;

export const alleanzaSubmission = z.object({ digits: z.string().regex(new RegExp(`^\\d{${CODE_LEN}}$`)) });
export type AlleanzaSubmission = z.infer<typeof alleanzaSubmission>;

export type AlleanzaRole = "griglia" | "coordinate" | "solo";

export interface AlleanzaGroup {
  teamIds: string[];
  tableNos: number[];
}

export interface AlleanzaView extends BaseView {
  /** cosa apre il codice (il titolo della meccanica resta `title`) */
  lockName: string;
  length: number;
  groups: AlleanzaGroup[];
}

export interface AlleanzaGrid {
  rows: string[];
  cols: string[];
  cells: number[][];
}

export interface AlleanzaMemberView {
  role: AlleanzaRole;
  partners: { teamId: string; tableNo: number; role: AlleanzaRole }[];
  /** solo per chi ha la griglia (e per chi gioca da solo) */
  grid: AlleanzaGrid | null;
  transform: string | null;
  /** solo per chi ha le coordinate (e per chi gioca da solo) */
  clues: string[] | null;
}

export interface AlleanzaGroupResult {
  teamIds: string[];
  /** codice di questa alleanza */
  digits: string;
  ok: boolean;
  entries: Record<string, string | null>;
}

export interface AlleanzaSummary {
  groups: AlleanzaGroupResult[];
}

export interface AlleanzaReveal {
  lockName: string;
  clues: string[];
  transform: string | null;
  explain: string;
  summary: AlleanzaSummary | null;
}

/** Alleanze della prova: coppie dal seme; con un numero dispari di tavoli l'ultima è a tre. */
export function alliances(ctx: PhaseCtx): TeamRef[][] {
  const teams = scopeTeams(ctx);
  const order = seededShuffle(
    teams.map((t) => t.teamId).sort(),
    `${ctx.seed}:alleanze`,
  ).map((id) => teams.find((t) => t.teamId === id)!);
  const groups: TeamRef[][] = [];
  for (let i = 0; i + 1 < order.length; i += 2) groups.push([order[i], order[i + 1]]);
  if (order.length % 2 === 1) {
    const last = order[order.length - 1];
    if (groups.length) groups[groups.length - 1].push(last);
    else groups.push([last]);
  }
  return groups;
}

/** Ruolo nella propria alleanza: il primo ha la griglia, il secondo le coordinate, il terzo (se c'è) la griglia. */
export function roleOf(group: readonly TeamRef[], teamId: string): AlleanzaRole {
  if (group.length === 1) return "solo";
  return group.findIndex((t) => t.teamId === teamId) === 1 ? "coordinate" : "griglia";
}

/** Griglia di cifre dell'alleanza n. `index` (dal seme della prova: uguale su server e telefoni). */
export function gridOf(c: AlleanzaContent, seed: string, index: number): number[][] {
  const rnd = rngFrom(`${seed}:griglia:${index}`);
  return c.rows.map(() => c.cols.map(() => Math.floor(rnd() * 10)));
}

/** Codice dell'alleanza: le cifre alle coordinate, poi l'eventuale passaggio finale. */
export function codeOf(c: AlleanzaContent, grid: number[][]): string {
  let d = c.steps.map((s) => grid[s.row][s.col]);
  if (c.transform?.op === "piu-uno") d = d.map((x) => (x + 1) % 10);
  if (c.transform?.op === "inverti") d = d.slice().reverse();
  return d.join("");
}

const def: MechanicDef<AlleanzaContent, AlleanzaSubmission> = {
  code: "alleanza-espressa",
  number: 46,
  manche: 3,
  title: "Alleanza espressa",
  input: "duel",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Un tavolo ha la griglia, l'alleato le coordinate: parlatevi e trovate il codice. Giusto per tutti: 100 a testa, altrimenti 0.",
  contentSchema: alleanzaContent,
  submissionSchema: alleanzaSubmission,
  publicView: (c, ctx): AlleanzaView => ({
    ...baseView(def, ctx),
    lockName: c.title,
    length: CODE_LEN,
    groups: alliances(ctx).map((g) => ({ teamIds: g.map((t) => t.teamId), tableNos: g.map((t) => t.tableNo) })),
  }),
  memberView: (c, ctx): AlleanzaMemberView => {
    const groups = alliances(ctx);
    const index = groups.findIndex((g) => g.some((t) => t.teamId === ctx.teamId));
    const group = groups[index] ?? (teamOf(ctx) ? [teamOf(ctx)!] : []);
    const role = roleOf(group, ctx.teamId);
    const grid: AlleanzaGrid = { rows: c.rows, cols: c.cols, cells: gridOf(c, ctx.seed, Math.max(0, index)) };
    return {
      role,
      partners: group.filter((t) => t.teamId !== ctx.teamId).map((t) => ({ teamId: t.teamId, tableNo: t.tableNo, role: roleOf(group, t.teamId) })),
      grid: role === "coordinate" ? null : grid,
      transform: role === "coordinate" ? null : (c.transform?.text ?? null),
      clues: role === "griglia" ? null : c.steps.map((s) => s.clue),
    };
  },
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const summary: AlleanzaSummary = { groups: [] };
    const byTeam = new Map<string, { ok: boolean; groupOk: boolean; matching: number; group: TeamRef[] }>();
    alliances(ctx).forEach((g, i) => {
      const digits = codeOf(content, gridOf(content, ctx.seed, i));
      const entries = Object.fromEntries(g.map((t) => [t.teamId, firsts.get(t.teamId)?.payload.digits ?? null]));
      const ok = g.every((t) => entries[t.teamId] === digits);
      summary.groups.push({ teamIds: g.map((t) => t.teamId), digits, ok, entries });
      for (const t of g) {
        const e = entries[t.teamId];
        byTeam.set(t.teamId, { ok: e === digits, groupOk: ok, matching: e ? matchingPositions(e, digits) : 0, group: g });
      }
    });
    const out: ScoreWithSummary<AlleanzaSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        const r = byTeam.get(t.teamId);
        if (!s || !r) return noAnswer(t.teamId);
        const others = r.group.filter((x) => x.teamId !== t.teamId).map((x) => x.tableNo);
        const who = others.length === 1 ? `il tavolo ${others[0]}` : `i tavoli ${others.join(" e ")}`;
        if (r.group.length === 1) {
          return outcome(t.teamId, { points: r.ok ? SOLO_POINTS : 0, chaos: CHAOS.partecipa, correct: r.ok, accuracy: r.matching / CODE_LEN, label: r.ok ? "Senza alleati: 60" : "Codice sbagliato" });
        }
        return outcome(t.teamId, {
          points: r.groupOk ? POINTS.standard : 0,
          chaos: CHAOS.partecipa + (r.groupOk ? CHAOS.centro : 0),
          correct: r.groupOk,
          accuracy: r.matching / CODE_LEN,
          label: r.groupOk ? `Alleanza riuscita con ${who}` : r.ok ? `Codice giusto, ma ${who} no` : "Codice sbagliato: alleanza saltata",
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): AlleanzaReveal => ({
    lockName: c.title,
    clues: c.steps.map((s) => s.clue),
    transform: c.transform?.text ?? null,
    explain: c.explain,
    summary: (out as ScoreWithSummary<AlleanzaSummary>).summary ?? null,
  }),
};

export const alleanzaEspressa: MechanicModule<AlleanzaContent, AlleanzaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      const groups = alliances(ctx);
      return demoPerTeam(ctx, seed, (i, rnd) => {
        const t = scopeTeams(ctx)[i];
        const gi = groups.findIndex((g) => g.some((x) => x.teamId === t.teamId));
        const digits = codeOf(c, gridOf(c, ctx.seed, gi));
        if (rnd() < demoSkill(i) + 0.2) return { digits };
        return { digits: digits.slice(0, 3) + String((Number(digits[3]) + 1) % 10) };
      });
    },
  },
};
