import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 69 · SOGLIA DI RISCHIO (manche 5) — tre domande veloci; il tavolo DICHIARA quante pensa di azzeccarne
 * (0–3). Ogni risposta giusta +20; se raggiunge la soglia dichiarata arriva il bonus: 1 → +20, 2 → +50,
 * 3 → +100. Mancare la soglia non toglie punti: si perde solo il bonus (massimo 160).
 */

export const PER_CORRECT = 20;
export const THRESHOLD_BONUS = [0, 20, 50, 100] as const;
const QUESTIONS = 3;

export const sogliaContent = z
  .object({
    id: variantId,
    /** tema delle tre domande, es. «Il trasloco» */
    theme: text(50),
    questions: z.array(z.object({ id: idSchema, prompt: text(160), options: optionsSchema(3, 3) })).length(QUESTIONS),
    solution: z.object({ answers: z.record(z.string(), idSchema) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    c.questions.forEach((q, i) => {
      const sol = c.solution.answers[q.id];
      if (!sol) ctx.addIssue({ code: "custom", message: `manca la soluzione di ${q.id}` });
      else checkOptions(q.options, [sol], ctx, ["questions", i]);
    });
  });
export type SogliaContent = z.infer<typeof sogliaContent>;
export type SogliaInput = z.input<typeof sogliaContent>;

export const sogliaSubmission = z.object({
  declared: z.number().int().min(0).max(QUESTIONS),
  answers: z.record(z.string(), idSchema),
});
export type SogliaSubmission = z.infer<typeof sogliaSubmission>;

export interface SogliaView extends BaseView {
  theme: string;
  questions: { id: string; prompt: string; options: Option[] }[];
  perCorrect: number;
  bonus: readonly number[];
}

export interface SogliaReveal {
  theme: string;
  questions: { id: string; prompt: string; options: Option[]; solutionId: string }[];
  explain: string;
}

export function sogliaPoints(right: number, declared: number): number {
  return right * PER_CORRECT + (right >= declared ? THRESHOLD_BONUS[declared] : 0);
}

const def: MechanicDef<SogliaContent, SogliaSubmission> = {
  code: "soglia-di-rischio",
  number: 69,
  manche: 5,
  title: "Soglia di rischio",
  input: "team",
  timerSec: 75,
  oneDeviceOk: true,
  needs: [],
  rule: "Dichiarate quante delle 3 domande azzeccherete. Ogni giusta +20; se raggiungete la soglia: bonus fino a +100.",
  contentSchema: sogliaContent,
  submissionSchema: sogliaSubmission,
  publicView: (c, ctx): SogliaView => ({
    ...baseView(def, ctx),
    theme: c.theme,
    questions: c.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: publicOptions(q.options, `${ctx.seed}:${q.id}`) })),
    perCorrect: PER_CORRECT,
    bonus: THRESHOLD_BONUS,
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const right = content.questions.filter((q) => s.payload.answers[q.id] === content.solution.answers[q.id]).length;
        const d = s.payload.declared;
        const hit = right >= d;
        return outcome(t.teamId, {
          points: sogliaPoints(right, d),
          chaos: CHAOS.partecipa + (d === QUESTIONS ? CHAOS.rischio : 0) + (hit && d >= 2 ? CHAOS.centro : 0),
          correct: d > 0 ? hit : null,
          accuracy: right / QUESTIONS,
          label: `${right}/${QUESTIONS} · soglia ${d} ${hit ? "raggiunta" : "mancata"}`,
        });
      }),
    };
  },
  reveal: (c): SogliaReveal => ({
    theme: c.theme,
    questions: c.questions.map((q) => ({ ...q, solutionId: c.solution.answers[q.id] })),
    explain: c.explain,
  }),
};

export const sogliaDiRischio: MechanicModule<SogliaContent, SogliaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({
        declared: [3, 2, 1, 3, 0][i % 5],
        answers: Object.fromEntries(c.questions.map((q) => [q.id, pickAnswer(rnd, c.solution.answers[q.id], q.options.map((o) => o.id), demoSkill(i))])),
      })),
  },
};
