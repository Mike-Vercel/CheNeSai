import { z } from "zod";
import type { MechanicDef } from "../contract";
import { idSchema } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, text, variantId } from "./_shared";
import { difficultySchema } from "./m5-shared";

/**
 * 70 · PUNTO DI ROTTURA (manche 5) — tre decisioni collegate: la prima scelta decide quali opzioni avrete
 * alla seconda, la seconda quali alla terza (albero a bivi). Ogni opzione consuma due risorse con un limite
 * (es. budget e tempo) e porta punti «obiettivo». Percorso VALIDO (entro i limiti) +60 garantiti; percorso
 * OTTIMALE (il massimo dell'obiettivo tra i validi, unico per costruzione) +120. Fuori limite: 0.
 * L'ottimo si calcola dal contenuto (validato: unico, e almeno un percorso «si rompe»).
 */

export const VALID_POINTS = 60;
export const OPTIMAL_POINTS = 120;

const useSchema = z.record(z.string(), z.number().int().min(0).max(9999));

const leaf = z.object({ id: idSchema, text: text(90), use: useSchema, gain: z.number().int().min(0).max(999) });
const mid = leaf.extend({ next: z.array(leaf).min(2).max(3) });
const top = leaf.extend({ next: z.array(mid).min(2).max(3) });
export type RotturaLeaf = z.infer<typeof leaf>;
export type RotturaMid = z.infer<typeof mid>;
export type RotturaTop = z.infer<typeof top>;

const resourceSchema = z.object({ id: idSchema, label: text(20), unit: text(8), limit: z.number().int().min(1).max(99999) });

export const rotturaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema.optional(),
    title: text(60),
    intro: text(280),
    resources: z.array(resourceSchema).length(2),
    goal: z.object({ label: text(20), unit: text(12) }),
    /** le tre decisioni: domande mostrate a ogni passo */
    steps: z.array(text(80)).length(3),
    tree: z.array(top).min(2).max(3),
    solution: z.object({ path: z.array(idSchema).length(3) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const resIds = c.resources.map((r) => r.id);
    const nodes: RotturaLeaf[] = [];
    const sibs = (list: { id: string }[], where: string) => {
      if (new Set(list.map((n) => n.id)).size !== list.length) ctx.addIssue({ code: "custom", message: `id ripetuti tra le opzioni di ${where}` });
    };
    sibs(c.tree, "primo passo");
    for (const a of c.tree) {
      nodes.push(a);
      sibs(a.next, a.id);
      for (const b of a.next) {
        nodes.push(b);
        sibs(b.next, b.id);
        nodes.push(...b.next);
      }
    }
    for (const n of nodes) for (const k of Object.keys(n.use)) if (!resIds.includes(k)) ctx.addIssue({ code: "custom", message: `${n.id}: risorsa sconosciuta «${k}»` });
    const all = allPaths(c);
    const valid = all.filter((p) => p.valid);
    if (valid.length === all.length) ctx.addIssue({ code: "custom", message: "nessun percorso si rompe: serve almeno un percorso fuori limite" });
    if (!valid.length) ctx.addIssue({ code: "custom", message: "nessun percorso valido" });
    const best = Math.max(...valid.map((p) => p.gain));
    const opt = valid.filter((p) => p.gain === best);
    if (opt.length !== 1) ctx.addIssue({ code: "custom", message: `l'ottimo non è unico (${opt.length})` });
    else if (opt[0].path.join(">") !== c.solution.path.join(">")) ctx.addIssue({ code: "custom", message: `la soluzione non è l'ottimo: ${opt[0].path.join(">")}` });
    // il percorso «avido» (prima scelta col guadagno più alto) non deve essere già l'ottimo: serve strategia
    const greedyTop = c.tree.slice().sort((x, y) => y.gain - x.gain)[0];
    if (opt.length === 1 && greedyTop.id === opt[0].path[0] && c.tree.filter((t) => t.gain === greedyTop.gain).length === 1) {
      ctx.addIssue({ code: "custom", message: "la prima scelta più golosa porta già all'ottimo: niente punto di rottura" });
    }
  });
export type RotturaContent = z.infer<typeof rotturaContent>;
export type RotturaInput = z.input<typeof rotturaContent>;

export const rotturaSubmission = z.object({ path: z.array(idSchema).length(3) });
export type RotturaSubmission = z.infer<typeof rotturaSubmission>;

export interface RotturaPath {
  path: string[];
  totals: Record<string, number>;
  gain: number;
  valid: boolean;
}

/** Tutti i percorsi dell'albero con totali, obiettivo e validità. */
export function allPaths(c: Pick<RotturaContent, "tree" | "resources">): RotturaPath[] {
  const out: RotturaPath[] = [];
  for (const a of c.tree)
    for (const b of a.next)
      for (const d of b.next) {
        const totals = Object.fromEntries(c.resources.map((r) => [r.id, (a.use[r.id] ?? 0) + (b.use[r.id] ?? 0) + (d.use[r.id] ?? 0)]));
        out.push({ path: [a.id, b.id, d.id], totals, gain: a.gain + b.gain + d.gain, valid: c.resources.every((r) => totals[r.id] <= r.limit) });
      }
  return out;
}

/** Valuta un percorso inviato: inesistente → null. */
export function evalPath(c: Pick<RotturaContent, "tree" | "resources">, path: readonly string[]): RotturaPath | null {
  return allPaths(c).find((p) => p.path.length === path.length && p.path.every((id, i) => id === path[i])) ?? null;
}

export interface RotturaView extends BaseView {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  intro: string;
  resources: { id: string; label: string; unit: string; limit: number }[];
  goal: { label: string; unit: string };
  steps: string[];
  tree: RotturaTop[];
  validPoints: number;
  optimalPoints: number;
}

export interface RotturaSummary {
  /** percorso di ogni tavolo (anonimo: solo id del tavolo) */
  paths: { teamId: string; path: string[] }[];
}

export interface RotturaReveal {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  resources: RotturaView["resources"];
  goal: RotturaView["goal"];
  steps: string[];
  tree: RotturaTop[];
  best: RotturaPath;
  /** quanti percorsi validi e quanti rotti su tutti */
  validCount: number;
  totalPaths: number;
  explain: string;
}

const def: MechanicDef<RotturaContent, RotturaSubmission> = {
  code: "punto-di-rottura",
  number: 70,
  manche: 5,
  title: "Punto di rottura",
  input: "team",
  timerSec: 75,
  oneDeviceOk: true,
  needs: [],
  rule: "Tre scelte a catena: la prima decide le opzioni dopo. Restate nei limiti: percorso valido +60, il migliore possibile +120.",
  contentSchema: rotturaContent,
  submissionSchema: rotturaSubmission,
  publicView: (c, ctx): RotturaView => ({
    ...baseView(def, ctx),
    heading: c.title,
    intro: c.intro,
    resources: c.resources,
    goal: c.goal,
    steps: c.steps,
    tree: c.tree,
    validPoints: VALID_POINTS,
    optimalPoints: OPTIMAL_POINTS,
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const best = Math.max(...allPaths(content).filter((p) => p.valid).map((p) => p.gain));
    const opt = content.solution.path.join(">");
    const paths: RotturaSummary["paths"] = [];
    const outcomes = scopeTeams(ctx).map((t) => {
      const s = firsts.get(t.teamId);
      if (!s) return noAnswer(t.teamId);
      paths.push({ teamId: t.teamId, path: s.payload.path });
      const p = evalPath(content, s.payload.path);
      if (!p) return outcome(t.teamId, { points: 0, chaos: 0, correct: false, accuracy: 0, label: "Percorso inesistente" });
      const optimal = p.valid && p.path.join(">") === opt;
      const broken = content.resources.filter((r) => p.totals[r.id] > r.limit).map((r) => r.label.toLowerCase());
      return outcome(t.teamId, {
        points: optimal ? OPTIMAL_POINTS : p.valid ? VALID_POINTS : 0,
        chaos: CHAOS.partecipa + (optimal ? CHAOS.centro : 0),
        correct: optimal,
        accuracy: p.valid ? Math.round((p.gain / best) * 1000) / 1000 : 0,
        label: optimal ? `Percorso perfetto · ${p.gain} ${content.goal.unit}` : p.valid ? `Percorso valido · ${p.gain} su ${best} ${content.goal.unit}` : `Rottura: sforato ${broken.join(" e ")}`,
      });
    });
    const out: ScoreWithSummary<RotturaSummary> = { outcomes, summary: { paths } };
    return out;
  },
  reveal: (c): RotturaReveal => {
    const all = allPaths(c);
    return {
      heading: c.title,
      resources: c.resources,
      goal: c.goal,
      steps: c.steps,
      tree: c.tree,
      best: evalPath(c, c.solution.path)!,
      validCount: all.filter((p) => p.valid).length,
      totalPaths: all.length,
      explain: c.explain,
    };
  },
};

export const puntoDiRottura: MechanicModule<RotturaContent, RotturaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      const all = allPaths(c);
      const valid = all.filter((p) => p.valid);
      const broken = all.filter((p) => !p.valid);
      return demoPerTeam(ctx, seed, (i, rnd) => {
        const r = rnd();
        if (r < demoSkill(i)) return { path: c.solution.path };
        const pool = r < 0.8 && valid.length ? valid : broken;
        return { path: pool[Math.floor(rnd() * pool.length)].path };
      });
    },
  },
};
