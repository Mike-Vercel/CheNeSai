import { z } from "zod";
import type { MechanicDef } from "../contract";
import { idSchema } from "../components/choice";
import { noAnswer, rightWrong } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { impossibleSteps, toMinutes } from "../components/timeline";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 59 · L'ALIBI IMPOSSIBILE (manche 4) — un personaggio inventato racconta la sua serata ora per ora.
 * Tragitti e orari dei locali sono fatti certi: UNA tappa del racconto è incompatibile (non si arriva in
 * tempo, o il posto era chiuso). Ogni caso è VALIDATO in automatico: il validatore deve trovare
 * esattamente la tappa indicata come soluzione (schema e test).
 */

const placeSchema = z.object({
  id: idSchema,
  name: text(40),
  opens: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  closes: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
});
const legSchema = z.object({ from: idSchema, to: idSchema, minutes: z.number().int().min(1).max(180), how: text(20) });
const stepSchema = z.object({
  id: idSchema,
  time: z.string().regex(/^\d{1,2}:\d{2}$/),
  place: idSchema,
  stayMin: z.number().int().min(0).max(240).optional(),
  /** cosa dice di aver fatto */
  text: text(140),
});

export const alibiContent = z
  .object({
    id: variantId,
    title: text(70),
    /** chi racconta (personaggio inventato) */
    suspect: text(40),
    places: z.array(placeSchema).min(3).max(6),
    legs: z.array(legSchema).min(2).max(10),
    steps: z.array(stepSchema).min(4).max(7),
    solution: z.object({ stepId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const placeIds = new Set(c.places.map((p) => p.id));
    for (const s of c.steps) if (!placeIds.has(s.place)) ctx.addIssue({ code: "custom", message: `luogo ${s.place} inesistente` });
    for (const l of c.legs) if (!placeIds.has(l.from) || !placeIds.has(l.to)) ctx.addIssue({ code: "custom", message: "tragitto con luogo inesistente" });
    for (let i = 1; i < c.steps.length; i++) {
      if (toMinutes(c.steps[i].time) < toMinutes(c.steps[i - 1].time)) ctx.addIssue({ code: "custom", message: "tappe non in ordine di orario" });
    }
    const issues = impossibleSteps(c.steps, c.places, c.legs);
    if (issues.length !== 1 || issues[0].stepId !== c.solution.stepId) {
      ctx.addIssue({ code: "custom", message: `il validatore trova ${JSON.stringify(issues)} invece di ${c.solution.stepId}` });
    }
  });
export type AlibiContent = z.infer<typeof alibiContent>;
export type AlibiInput = z.input<typeof alibiContent>;

export const alibiSubmission = z.object({ stepId: idSchema });
export type AlibiSubmission = z.infer<typeof alibiSubmission>;

export interface AlibiView extends BaseView {
  /** titolo del caso (il titolo della meccanica resta `title`) */
  caseTitle: string;
  suspect: string;
  places: { id: string; name: string; opens?: string; closes?: string }[];
  legs: { from: string; to: string; minutes: number; how: string }[];
  steps: { id: string; time: string; place: string; stayMin?: number; text: string }[];
}

export interface AlibiReveal {
  caseTitle: string;
  suspect: string;
  steps: AlibiView["steps"];
  places: AlibiView["places"];
  stepId: string;
  explain: string;
}

const def: MechanicDef<AlibiContent, AlibiSubmission> = {
  code: "alibi-impossibile",
  number: 59,
  manche: 4,
  title: "L'alibi impossibile",
  input: "team",
  timerSec: 70,
  oneDeviceOk: true,
  needs: [],
  rule: "Orari e tragitti sono certi. Nel racconto della serata c'è una tappa impossibile: toccatela.",
  contentSchema: alibiContent,
  submissionSchema: alibiSubmission,
  publicView: (c, ctx): AlibiView => ({
    ...baseView(def, ctx),
    caseTitle: c.title,
    suspect: c.suspect,
    places: c.places.map((p) => ({ ...p })),
    legs: c.legs.map((l) => ({ ...l })),
    steps: c.steps.map((s) => ({ ...s })),
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        return rightWrong(t.teamId, s.payload.stepId === content.solution.stepId, { okLabel: "Alibi smontato", koLabel: "Tappa sbagliata" });
      }),
    };
  },
  reveal: (c): AlibiReveal => ({ caseTitle: c.title, suspect: c.suspect, steps: c.steps, places: c.places, stepId: c.solution.stepId, explain: c.explain }),
};

export const alibiImpossibile: MechanicModule<AlibiContent, AlibiSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({ stepId: pickAnswer(rnd, c.solution.stepId, c.steps.map((s) => s.id), demoSkill(i)) })),
  },
};
