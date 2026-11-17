import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 24 · DOPPIO RISCHIO (manche 2) — una domanda di ragionamento e due tariffe annunciate PRIMA:
 * NORMALE (+100 se giusta, 0 se sbagliata) o ALTA (+160 se giusta, −40 se sbagliata).
 * Il tavolo sceglie la tariffa insieme alla risposta: è una scommessa sulla propria sicurezza.
 */

export const RATES = {
  normale: { win: 100, lose: 0 },
  alta: { win: 160, lose: -40 },
} as const;
export type Rate = keyof typeof RATES;

export const doppioContent = z
  .object({
    id: variantId,
    prompt: text(220),
    options: optionsSchema(4, 4),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [c.solution.optionId], ctx, ["options"]));
export type DoppioContent = z.infer<typeof doppioContent>;
export type DoppioInput = z.input<typeof doppioContent>;

export const doppioSubmission = z.object({ rate: z.enum(["normale", "alta"]), optionId: idSchema });
export type DoppioSubmission = z.infer<typeof doppioSubmission>;

export interface DoppioView extends BaseView {
  prompt: string;
  options: Option[];
  rates: typeof RATES;
}

export interface DoppioReveal {
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
}

const def: MechanicDef<DoppioContent, DoppioSubmission> = {
  code: "doppio-rischio",
  number: 24,
  manche: 2,
  title: "Doppio rischio",
  input: "team",
  timerSec: 45,
  oneDeviceOk: true,
  needs: [],
  rule: "Scegliete la tariffa: NORMALE +100 o 0, ALTA +160 o −40. Poi rispondete. Quanto siete sicuri?",
  contentSchema: doppioContent,
  submissionSchema: doppioSubmission,
  publicView: (c, ctx): DoppioView => ({ ...baseView(def, ctx), prompt: c.prompt, options: publicOptions(c.options, `${ctx.seed}:opzioni`), rates: RATES }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const ok = s.payload.optionId === content.solution.optionId;
        const rate = RATES[s.payload.rate];
        const high = s.payload.rate === "alta";
        return outcome(t.teamId, {
          points: ok ? rate.win : rate.lose,
          chaos: CHAOS.partecipa + (high ? CHAOS.rischio : 0) + (ok ? CHAOS.centro : 0),
          correct: ok,
          accuracy: ok ? 1 : 0,
          label: `${high ? "ALTA" : "NORMALE"} · ${ok ? "giusta" : "sbagliata"}`,
        });
      }),
    };
  },
  reveal: (c): DoppioReveal => ({ prompt: c.prompt, options: c.options, solutionId: c.solution.optionId, explain: c.explain }),
};

export const doppioRischio: MechanicModule<DoppioContent, DoppioSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({
        rate: i % 2 === 0 ? "alta" : "normale",
        optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i)),
      })),
  },
};
