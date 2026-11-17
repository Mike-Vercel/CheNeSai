import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { durationOf, firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { difficultySchema, secLabel } from "./m5-shared";

/**
 * 66 · ULTIMA CHIAMATA (manche 5) — una raffica di tre micro-sfide, uguali per tutti e aperte a tempo
 * (0, 15 e 30 secondi): si risponde a tutte e tre e si invia una volta sola. Punti SOLO per correttezza
 * (+40 a risposta, +40 di bonus finale con 3 su 3, massimo 160). La rapidità non dà punti: fa da spareggio
 * (ordine d'arrivo della raffica nel riepilogo e un ritocco ≤ 5% sulla precisione, che il runtime usa per
 * le parità in classifica).
 */

export const CALL_AT_MS = [0, 15000, 30000] as const;
export const PER_CALL = 40;
export const FULL_BONUS = 40;
/** peso massimo della rapidità sulla precisione (solo spareggio) */
const SPEED_WEIGHT = 0.05;

const callSchema = z.object({
  id: idSchema,
  /** tipo di micro-sfida mostrato prima che si apra, es. «Calcolo lampo» */
  kind: text(24),
  prompt: text(170),
  options: optionsSchema(3, 4),
});

export const ultimaChiamataContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema.optional(),
    /** tema della raffica, es. «Ultimo giro al bancone» */
    theme: text(50),
    calls: z.array(callSchema).length(CALL_AT_MS.length),
    solution: z.object({ answers: z.record(z.string(), idSchema) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (new Set(c.calls.map((q) => q.id)).size !== c.calls.length) ctx.addIssue({ code: "custom", message: "id delle chiamate duplicati" });
    c.calls.forEach((q, i) => {
      const sol = c.solution.answers[q.id];
      if (!sol) ctx.addIssue({ code: "custom", message: `manca la soluzione di ${q.id}` });
      else checkOptions(q.options, [sol], ctx, ["calls", i]);
    });
  });
export type UltimaChiamataContent = z.infer<typeof ultimaChiamataContent>;
export type UltimaChiamataInput = z.input<typeof ultimaChiamataContent>;

export const ultimaChiamataSubmission = z.object({ answers: z.record(z.string(), idSchema) });
export type UltimaChiamataSubmission = z.infer<typeof ultimaChiamataSubmission>;

export interface UltimaChiamataCallView {
  id: string;
  n: number;
  kind: string;
  opensAtMs: number;
  /** null finché la chiamata non si apre (con `publicViewAt`) */
  prompt: string | null;
  options: Option[] | null;
}

export interface UltimaChiamataView extends BaseView {
  theme: string;
  calls: UltimaChiamataCallView[];
  perCall: number;
  fullBonus: number;
}

export interface UltimaChiamataSummary {
  /** ordine d'arrivo della raffica: più risposte giuste, poi chi ha inviato prima */
  ranking: { teamId: string; right: number; elapsedMs: number }[];
}

export interface UltimaChiamataReveal {
  theme: string;
  calls: { id: string; n: number; kind: string; prompt: string; options: Option[]; solutionId: string }[];
  explain: string;
  summary: UltimaChiamataSummary | null;
}

export function ultimaChiamataPoints(right: number): number {
  return right * PER_CALL + (right === CALL_AT_MS.length ? FULL_BONUS : 0);
}

function view(c: UltimaChiamataContent, ctx: PhaseCtx, elapsedMs: number | null): UltimaChiamataView {
  return {
    ...baseView(def, ctx),
    theme: c.theme,
    calls: c.calls.map((q, i) => {
      const open = elapsedMs === null || elapsedMs >= CALL_AT_MS[i];
      return {
        id: q.id,
        n: i + 1,
        kind: q.kind,
        opensAtMs: CALL_AT_MS[i],
        prompt: open ? q.prompt : null,
        options: open ? publicOptions(q.options, `${ctx.seed}:${q.id}`) : null,
      };
    }),
    perCall: PER_CALL,
    fullBonus: FULL_BONUS,
  };
}

const def: MechanicDef<UltimaChiamataContent, UltimaChiamataSubmission> = {
  code: "ultima-chiamata",
  number: 66,
  manche: 5,
  title: "Ultima chiamata",
  input: "team",
  timerSec: 70,
  oneDeviceOk: true,
  needs: [],
  rule: "Tre micro-sfide a raffica, una ogni 15 secondi. +40 a risposta giusta, +40 se fate 3 su 3. La velocità vale solo per gli spareggi.",
  contentSchema: ultimaChiamataContent,
  submissionSchema: ultimaChiamataSubmission,
  publicView: (c, ctx) => view(c, ctx, null),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const dur = durationOf(ctx) || def.timerSec * 1000;
    const ranking: UltimaChiamataSummary["ranking"] = [];
    const outcomes = scopeTeams(ctx).map((t) => {
      const s = firsts.get(t.teamId);
      if (!s) return noAnswer(t.teamId);
      const right = content.calls.filter((q) => s.payload.answers[q.id] === content.solution.answers[q.id]).length;
      const all = right === content.calls.length;
      const frac = Math.min(1, Math.max(0, s.elapsedMs / dur));
      ranking.push({ teamId: t.teamId, right, elapsedMs: s.elapsedMs });
      return outcome(t.teamId, {
        points: ultimaChiamataPoints(right),
        chaos: CHAOS.partecipa + (all ? CHAOS.centro : 0),
        correct: all,
        accuracy: Math.round((right / content.calls.length) * (1 - SPEED_WEIGHT * frac) * 10000) / 10000,
        label: `${right}/${content.calls.length} giuste · ${secLabel(s.elapsedMs)}`,
      });
    });
    ranking.sort((a, b) => b.right - a.right || a.elapsedMs - b.elapsedMs || (a.teamId < b.teamId ? -1 : 1));
    const out: ScoreWithSummary<UltimaChiamataSummary> = { outcomes, summary: { ranking } };
    return out;
  },
  reveal: (c, out): UltimaChiamataReveal => ({
    theme: c.theme,
    calls: c.calls.map((q, i) => ({ id: q.id, n: i + 1, kind: q.kind, prompt: q.prompt, options: q.options, solutionId: c.solution.answers[q.id] })),
    explain: c.explain,
    summary: (out as ScoreWithSummary<UltimaChiamataSummary>).summary ?? null,
  }),
};

export const ultimaChiamata: MechanicModule<UltimaChiamataContent, UltimaChiamataSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, elapsedMs),
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(
        ctx,
        seed,
        (i, rnd) => ({ answers: Object.fromEntries(c.calls.map((q) => [q.id, pickAnswer(rnd, c.solution.answers[q.id], q.options.map((o) => o.id), demoSkill(i))])) }),
        { minMs: CALL_AT_MS[2] + 6000 },
      ),
  },
};
