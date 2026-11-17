import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { balanceOf, balancesSchema, difficultySchema, riskLoss } from "./m5-shared";

/**
 * 77 · CLASSIFICA BUIA (manche 5) — durante la prova nessuno vede posizioni né punteggi altrui: ogni tavolo
 * vede SOLO il proprio saldo (vista privata, saldo iniettato dal runtime) e la categoria della domanda.
 * Nei primi 15 secondi sceglie: PRUDENZA (+50 sicuri, niente domanda) o RISCHIO (domanda secca: giusta +160,
 * sbagliata −25% del proprio saldo, al massimo 100). Il rischio dipende dal proprio punteggio ed è mostrato
 * prima della scelta. La domanda arriva solo dopo la finestra di scelta (con `publicViewAt`).
 * La TV non mostra mai saldi né posizioni: al reveal solo le scelte e l'esito della prova (la classifica
 * generale resta affidata all'impostazione «classifica buia» della serata e alla premiazione).
 */

export const CHOICE_MS = 15000;
export const SAFE_POINTS = 50;
export const RISK_WIN = 160;
/** perdita massima del rischio (poi 25% del saldo, saldo mai negativo) */
export const RISK_LOSS_MAX = 100;

export const buiaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema.optional(),
    category: text(40),
    prompt: text(220),
    options: optionsSchema(4, 4),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
    balances: balancesSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [c.solution.optionId], ctx, ["options"]));
export type BuiaContent = z.infer<typeof buiaContent>;
export type BuiaInput = z.input<typeof buiaContent>;

export const buiaSubmission = z.discriminatedUnion("choice", [z.object({ choice: z.literal("prudenza") }), z.object({ choice: z.literal("rischio"), optionId: idSchema })]);
export type BuiaSubmission = z.infer<typeof buiaSubmission>;

export interface BuiaView extends BaseView {
  category: string;
  choiceWindowMs: number;
  /** la domanda: solo dopo la finestra di scelta con `publicViewAt` */
  prompt: string | null;
  options: Option[] | null;
  safePoints: number;
  riskWin: number;
  riskLossMax: number;
}

export interface BuiaMemberView {
  /** il proprio saldo (l'unico visibile) */
  balance: number | null;
  /** quanto si perde sbagliando col rischio */
  loss: number;
}

export interface BuiaSummary {
  choices: { teamId: string; choice: "prudenza" | "rischio" }[];
}

export interface BuiaReveal {
  category: string;
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
  summary: BuiaSummary | null;
}

function view(c: BuiaContent, ctx: PhaseCtx, withQuestion: boolean): BuiaView {
  return {
    ...baseView(def, ctx),
    category: c.category,
    choiceWindowMs: CHOICE_MS,
    prompt: withQuestion ? c.prompt : null,
    options: withQuestion ? publicOptions(c.options, `${ctx.seed}:opzioni`) : null,
    safePoints: SAFE_POINTS,
    riskWin: RISK_WIN,
    riskLossMax: RISK_LOSS_MAX,
  };
}

const def: MechanicDef<BuiaContent, BuiaSubmission> = {
  code: "classifica-buia",
  number: 77,
  manche: 5,
  title: "Classifica buia",
  input: "team",
  timerSec: 40,
  oneDeviceOk: true,
  needs: [],
  rule: "Vedete solo il vostro saldo. PRUDENZA +50 sicuri, o RISCHIO: domanda secca, giusta +160, sbagliata −25% del saldo (max 100).",
  contentSchema: buiaContent,
  submissionSchema: buiaSubmission,
  publicView: (c, ctx) => view(c, ctx, true),
  memberView: (c, ctx): BuiaMemberView => {
    const balance = balanceOf(c.balances, ctx.teamId);
    return { balance, loss: riskLoss(balance, RISK_LOSS_MAX) };
  },
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const choices: BuiaSummary["choices"] = [];
    const outcomes = scopeTeams(ctx).map((t) => {
      const s = firsts.get(t.teamId);
      if (!s) return noAnswer(t.teamId);
      const p = s.payload;
      choices.push({ teamId: t.teamId, choice: p.choice });
      if (p.choice === "prudenza") return outcome(t.teamId, { points: SAFE_POINTS, chaos: CHAOS.partecipa, correct: null, accuracy: null, label: `Prudenza · +${SAFE_POINTS} sicuri` });
      const ok = p.optionId === content.solution.optionId;
      const loss = riskLoss(balanceOf(content.balances, t.teamId), RISK_LOSS_MAX);
      return outcome(t.teamId, {
        points: ok ? RISK_WIN : 0 - loss,
        chaos: CHAOS.partecipa + CHAOS.rischio + (ok ? CHAOS.centro : 0),
        correct: ok,
        accuracy: ok ? 1 : 0,
        label: ok ? `Rischio riuscito · +${RISK_WIN}` : `Rischio fallito · −${loss}`,
      });
    });
    const out: ScoreWithSummary<BuiaSummary> = { outcomes, summary: { choices } };
    return out;
  },
  reveal: (c, out): BuiaReveal => ({
    category: c.category,
    prompt: c.prompt,
    options: c.options,
    solutionId: c.solution.optionId,
    explain: c.explain,
    summary: (out as ScoreWithSummary<BuiaSummary>).summary ?? null,
  }),
};

export const classificaBuia: MechanicModule<BuiaContent, BuiaSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, elapsedMs >= CHOICE_MS),
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(
        ctx,
        seed,
        (i, rnd): BuiaSubmission => (i % 3 === 2 ? { choice: "prudenza" } : { choice: "rischio", optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i)) }),
        { minMs: CHOICE_MS + 4000 },
      ),
  },
};
