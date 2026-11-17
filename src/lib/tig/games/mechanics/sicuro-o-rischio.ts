import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 71 · SICURO O RISCHIO (manche 5) — due prove sullo stesso tema: SICURO (3 opzioni, 100 punti) oppure
 * RISCHIO (risposta numerica esatta da digitare, 240 punti). Si gioca UNA sola delle due; sbagliare dà 0,
 * mai punti negativi. Nel ramo rischioso non si può tirare a indovinare tra opzioni: nessun esito casuale.
 */

export const branchSchema = z.enum(["sicuro", "rischio"]);

export const sicuroContent = z
  .object({
    id: variantId,
    theme: text(50),
    safe: z.object({ prompt: text(200), options: optionsSchema(3, 3) }),
    risky: z.object({
      prompt: text(240),
      /** unità mostrata accanto al numero, es. «euro», «minuti» */
      unit: text(16),
      /** cifre massime della risposta */
      maxDigits: z.number().int().min(1).max(4),
    }),
    solution: z.object({ safe: idSchema, risky: z.number().int().min(0).max(9999), riskyWhy: text(220) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkOptions(c.safe.options, [c.solution.safe], ctx, ["safe"]);
    if (String(c.solution.risky).length > c.risky.maxDigits) ctx.addIssue({ code: "custom", message: "la soluzione ha più cifre del previsto" });
  });
export type SicuroContent = z.infer<typeof sicuroContent>;
export type SicuroInput = z.input<typeof sicuroContent>;

export const sicuroSubmission = z.discriminatedUnion("branch", [
  z.object({ branch: z.literal("sicuro"), optionId: idSchema }),
  z.object({ branch: z.literal("rischio"), number: z.number().int().min(0).max(9999) }),
]);
export type SicuroSubmission = z.infer<typeof sicuroSubmission>;

export interface SicuroView extends BaseView {
  theme: string;
  safe: { prompt: string; options: Option[]; points: number };
  risky: { prompt: string; unit: string; maxDigits: number; points: number };
}

export interface SicuroReveal {
  theme: string;
  safe: { prompt: string; options: Option[]; solutionId: string };
  risky: { prompt: string; unit: string; solution: number; why: string };
  explain: string;
}

const def: MechanicDef<SicuroContent, SicuroSubmission> = {
  code: "sicuro-o-rischio",
  number: 71,
  manche: 5,
  title: "Sicuro o rischio",
  input: "team",
  timerSec: 65,
  oneDeviceOk: true,
  needs: [],
  rule: "Due prove, ne giocate una: SICURA da 100 (tre opzioni) o RISCHIOSA da 240 (numero esatto). Sbagliare vale 0.",
  contentSchema: sicuroContent,
  submissionSchema: sicuroSubmission,
  publicView: (c, ctx): SicuroView => ({
    ...baseView(def, ctx),
    theme: c.theme,
    safe: { prompt: c.safe.prompt, options: publicOptions(c.safe.options, `${ctx.seed}:sicuro`), points: POINTS.finalSafe },
    risky: { prompt: c.risky.prompt, unit: c.risky.unit, maxDigits: c.risky.maxDigits, points: POINTS.finalRisk },
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const p = s.payload;
        const risky = p.branch === "rischio";
        const ok = risky ? p.number === content.solution.risky : p.optionId === content.solution.safe;
        return outcome(t.teamId, {
          points: ok ? (risky ? POINTS.finalRisk : POINTS.finalSafe) : 0,
          chaos: CHAOS.partecipa + (risky ? CHAOS.rischio : 0) + (ok ? CHAOS.centro : 0),
          correct: ok,
          accuracy: ok ? 1 : 0,
          label: `${risky ? "RISCHIO" : "SICURO"} · ${ok ? "riuscito" : "fallito"}`,
        });
      }),
    };
  },
  reveal: (c): SicuroReveal => ({
    theme: c.theme,
    safe: { prompt: c.safe.prompt, options: c.safe.options, solutionId: c.solution.safe },
    risky: { prompt: c.risky.prompt, unit: c.risky.unit, solution: c.solution.risky, why: c.solution.riskyWhy },
    explain: c.explain,
  }),
};

export const sicuroORischio: MechanicModule<SicuroContent, SicuroSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd): SicuroSubmission => {
        if (i % 2 === 1) return { branch: "rischio", number: rnd() < demoSkill(i) ? c.solution.risky : c.solution.risky + 5 };
        return { branch: "sicuro", optionId: pickAnswer(rnd, c.solution.safe, c.safe.options.map((o) => o.id), demoSkill(i)) };
      }),
  },
};
