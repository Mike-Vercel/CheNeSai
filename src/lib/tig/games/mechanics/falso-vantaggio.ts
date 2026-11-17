import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { rngFrom } from "../components/rng";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { difficultySchema } from "./m2/shared";

/**
 * 31 · FALSO VANTAGGIO (manche 2) — due buste COPERTE, regole e probabilità annunciate prima:
 *   - SUBITO: un premio certo, ma di valore coperto: 20, 40, 60 o 80 punti (stessa probabilità, 1 su 4 ciascuno;
 *     media 50);
 *   - ENIGMA: 80, 100 o 120 punti (1 su 3 ciascuno; media 100) solo se si risolve l'enigma chiuso nella busta,
 *     che si vede soltanto dopo averla scelta; enigma sbagliato: 0.
 * I valori delle buste li estrae il seme della prova (uguali per tutti i tavoli) e restano fuori dalla vista
 * pubblica fino al reveal. Il «falso vantaggio» è la busta sicura: certa, ma magari da 20.
 */

export const SUBITO_VALUES = [20, 40, 60, 80] as const;
export const ENIGMA_VALUES = [80, 100, 120] as const;

export const falsoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** l'enigma chiuso nella busta (a risposta univoca) */
    prompt: text(240),
    options: optionsSchema(4, 4),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [c.solution.optionId], ctx, ["options"]));
export type FalsoContent = z.infer<typeof falsoContent>;
export type FalsoInput = z.input<typeof falsoContent>;

export const falsoSubmission = z.discriminatedUnion("busta", [z.object({ busta: z.literal("subito") }), z.object({ busta: z.literal("enigma"), optionId: idSchema })]);
export type FalsoSubmission = z.infer<typeof falsoSubmission>;

export interface FalsoView extends BaseView {
  /** valori possibili (regolamento): quelli veri restano coperti */
  subitoRange: readonly number[];
  enigmaRange: readonly number[];
  prompt: string;
  options: Option[];
}

export interface FalsoSummary {
  /** valori estratti per questa prova (si scoprono solo con l'esito) */
  prizes: { subito: number; enigma: number };
  subito: number;
  enigma: number;
  solved: number;
}

export interface FalsoReveal {
  /** null se l'esito non riporta i valori (mai prima del reveal) */
  subitoPrize: number | null;
  enigmaPrize: number | null;
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
  summary: FalsoSummary | null;
}

/** Valori estratti per questa prova (seme): uguali per tutti i tavoli. */
export function prizesOf(ctx: Pick<PhaseCtx, "seed">): { subito: number; enigma: number } {
  const r = rngFrom(`${ctx.seed}:buste`);
  return { subito: SUBITO_VALUES[Math.floor(r() * SUBITO_VALUES.length)], enigma: ENIGMA_VALUES[Math.floor(r() * ENIGMA_VALUES.length)] };
}

const def: MechanicDef<FalsoContent, FalsoSubmission> = {
  code: "falso-vantaggio",
  number: 31,
  manche: 2,
  title: "Falso vantaggio",
  input: "team",
  timerSec: 40,
  oneDeviceOk: true,
  needs: [],
  rule: "Busta SUBITO: premio certo coperto da 20 a 80. Busta ENIGMA: da 80 a 120 se risolvete l'enigma che contiene, sennò 0.",
  contentSchema: falsoContent,
  submissionSchema: falsoSubmission,
  publicView: (c, ctx): FalsoView => ({
    ...baseView(def, ctx),
    subitoRange: SUBITO_VALUES,
    enigmaRange: ENIGMA_VALUES,
    prompt: c.prompt,
    options: publicOptions(c.options, `${ctx.seed}:opzioni`),
  }),
  score: ({ content, ctx, submissions }) => {
    const prizes = prizesOf(ctx);
    const firsts = firstPerTeam(submissions, ctx);
    const summary: FalsoSummary = { prizes, subito: 0, enigma: 0, solved: 0 };
    const out: ScoreWithSummary<FalsoSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        if (s.payload.busta === "subito") {
          summary.subito++;
          return outcome(t.teamId, { points: prizes.subito, chaos: CHAOS.partecipa, correct: null, accuracy: null, label: `Busta SUBITO: ${prizes.subito}` });
        }
        summary.enigma++;
        const ok = s.payload.optionId === content.solution.optionId;
        if (ok) summary.solved++;
        return outcome(t.teamId, {
          points: ok ? prizes.enigma : 0,
          chaos: CHAOS.partecipa + CHAOS.rischio + (ok ? CHAOS.centro : 0),
          correct: ok,
          accuracy: ok ? 1 : 0,
          label: ok ? `Busta ENIGMA risolta: ${prizes.enigma}` : "Busta ENIGMA: enigma sbagliato",
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): FalsoReveal => {
    const s = (out as ScoreWithSummary<FalsoSummary>).summary ?? null;
    return { subitoPrize: s?.prizes.subito ?? null, enigmaPrize: s?.prizes.enigma ?? null, prompt: c.prompt, options: c.options, solutionId: c.solution.optionId, explain: c.explain, summary: s };
  },
};

export const falsoVantaggio: MechanicModule<FalsoContent, FalsoSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => (i % 2 === 1 ? { busta: "subito" as const } : { busta: "enigma" as const, optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i)) })),
  },
};
