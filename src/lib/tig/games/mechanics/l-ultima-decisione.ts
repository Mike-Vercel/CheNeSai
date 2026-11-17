import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { betLimit } from "../components/bid";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { balanceOf, balancesSchema, difficultySchema } from "./m5-shared";

/**
 * 80 · L'ULTIMA DECISIONE (manche 5) — prima la scelta (15 secondi, l'enigma non è ancora arrivato):
 * PREMIO SICURO (enigma risolto +100, sbagliato 0) o GRANDE RISCHIO (risolto +240, sbagliato si perde la
 * puntata: 25% del proprio saldo, al massimo 250; senza saldo noto 100). Esito e puntata sono espliciti prima
 * della scelta (vista privata col proprio saldo). Poi TUTTI i tavoli risolvono lo stesso enigma.
 * Reveal dal fondo alla vetta: la TV svela gli esiti dal peggiore al migliore.
 */

export const CHOICE_MS = 15000;
/** puntata quando il saldo non è noto (anteprima, test): il runtime riapplica il tetto sul saldo vero */
export const NOMINAL_STAKE = 100;

export const decisioneContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema.optional(),
    title: text(60),
    prompt: text(280),
    options: optionsSchema(4, 4),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
    balances: balancesSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [c.solution.optionId], ctx, ["options"]));
export type DecisioneContent = z.infer<typeof decisioneContent>;
export type DecisioneInput = z.input<typeof decisioneContent>;

export const decisioneSubmission = z.object({ choice: z.enum(["sicuro", "rischio"]), optionId: idSchema });
export type DecisioneSubmission = z.infer<typeof decisioneSubmission>;

export interface DecisioneView extends BaseView {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  choiceWindowMs: number;
  /** l'enigma: solo dopo la scelta con `publicViewAt` */
  prompt: string | null;
  options: Option[] | null;
  safePoints: number;
  riskPoints: number;
  stakeShare: number;
  stakeCap: number;
}

export interface DecisioneMemberView {
  balance: number | null;
  /** quanto si perde sbagliando col rischio */
  stake: number;
}

export interface DecisioneSummary {
  /** esiti dal fondo alla vetta (punti della prova crescenti) */
  ladder: { teamId: string; choice: "sicuro" | "rischio"; points: number }[];
}

export interface DecisioneReveal {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
  summary: DecisioneSummary | null;
}

export function stakeOf(balance: number | null): number {
  return balance === null ? NOMINAL_STAKE : betLimit(balance);
}

function view(c: DecisioneContent, ctx: PhaseCtx, withQuestion: boolean): DecisioneView {
  return {
    ...baseView(def, ctx),
    heading: c.title,
    choiceWindowMs: CHOICE_MS,
    prompt: withQuestion ? c.prompt : null,
    options: withQuestion ? publicOptions(c.options, `${ctx.seed}:opzioni`) : null,
    safePoints: POINTS.finalSafe,
    riskPoints: POINTS.finalRisk,
    stakeShare: POINTS.betShare,
    stakeCap: POINTS.betCap,
  };
}

const def: MechanicDef<DecisioneContent, DecisioneSubmission> = {
  code: "l-ultima-decisione",
  number: 80,
  manche: 5,
  title: "L'ultima decisione",
  input: "team",
  timerSec: 75,
  oneDeviceOk: true,
  needs: [],
  rule: "Prima scegliete: SICURO (+100 se risolvete) o RISCHIO (+240, ma sbagliando perdete il 25% del saldo). Poi l'enigma, uguale per tutti.",
  contentSchema: decisioneContent,
  submissionSchema: decisioneSubmission,
  publicView: (c, ctx) => view(c, ctx, true),
  memberView: (c, ctx): DecisioneMemberView => {
    const balance = balanceOf(c.balances, ctx.teamId);
    return { balance, stake: stakeOf(balance) };
  },
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const ladder: DecisioneSummary["ladder"] = [];
    const outcomes = scopeTeams(ctx).map((t) => {
      const s = firsts.get(t.teamId);
      if (!s) return noAnswer(t.teamId);
      const risky = s.payload.choice === "rischio";
      const ok = s.payload.optionId === content.solution.optionId;
      const stake = stakeOf(balanceOf(content.balances, t.teamId));
      const points = ok ? (risky ? POINTS.finalRisk : POINTS.finalSafe) : risky ? 0 - stake : 0;
      ladder.push({ teamId: t.teamId, choice: s.payload.choice, points });
      return outcome(t.teamId, {
        points,
        chaos: CHAOS.partecipa + (risky ? CHAOS.rischio : 0) + (ok ? CHAOS.centro : 0),
        correct: ok,
        accuracy: ok ? 1 : 0,
        label: `${risky ? "Grande rischio" : "Premio sicuro"} · ${ok ? "enigma risolto" : risky ? `puntata persa (−${stake})` : "enigma mancato"}`,
      });
    });
    ladder.sort((a, b) => a.points - b.points || (a.teamId < b.teamId ? -1 : 1));
    const out: ScoreWithSummary<DecisioneSummary> = { outcomes, summary: { ladder } };
    return out;
  },
  reveal: (c, out): DecisioneReveal => ({
    heading: c.title,
    prompt: c.prompt,
    options: c.options,
    solutionId: c.solution.optionId,
    explain: c.explain,
    summary: (out as ScoreWithSummary<DecisioneSummary>).summary ?? null,
  }),
};

export const lUltimaDecisione: MechanicModule<DecisioneContent, DecisioneSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, elapsedMs >= CHOICE_MS),
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(
        ctx,
        seed,
        (i, rnd) => ({ choice: i % 2 === 0 ? "rischio" : "sicuro", optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i)) }),
        { minMs: CHOICE_MS + 8000 },
      ),
  },
};
