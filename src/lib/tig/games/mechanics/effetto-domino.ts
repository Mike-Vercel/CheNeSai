import { z } from "zod";
import type { MechanicDef } from "../contract";
import { publicOptions, type Option } from "../components/choice";
import { baseView, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { checkSingle, demoSingle, difficultySchema, optionSolution, optionSubmission, scoreSingle, type OptionSubmission } from "./m1/common";

/**
 * 14 · EFFETTO DOMINO (manche 1) — una catena di fatti cade come una fila di tessere del domino (2–4 tessere);
 * tra quattro possibili conseguenze una sola discende davvero dai fatti, le altre li contraddicono o non ne
 * seguono. Stesso contenuto e stesso tempo per tutti i tavoli: 100 se giusta.
 */

export const dominoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** la situazione, es. «Il frigo condiviso» */
    situation: text(48),
    /** le tessere: fatti in ordine di causa, ognuno breve */
    chain: z.array(text(130)).min(2).max(4),
    /** domanda finale, es. «Quale conseguenza è l'unica coerente?» */
    prompt: text(110),
    options: optionsSchema(4, 4),
    solution: optionSolution,
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkSingle(c.options, c.solution.optionId, ctx));
export type DominoContent = z.infer<typeof dominoContent>;
export type DominoInput = z.input<typeof dominoContent>;

export interface DominoView extends BaseView {
  situation: string;
  chain: string[];
  prompt: string;
  options: Option[];
}

export interface DominoReveal {
  situation: string;
  chain: string[];
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
}

const def: MechanicDef<DominoContent, OptionSubmission> = {
  code: "effetto-domino",
  number: 14,
  manche: 1,
  title: "Effetto domino",
  input: "team",
  timerSec: 35,
  oneDeviceOk: true,
  needs: [],
  rule: "Le tessere cadono una sull'altra: tra quattro conseguenze, una sola segue davvero dai fatti. Trovatela.",
  contentSchema: dominoContent,
  submissionSchema: optionSubmission,
  publicView: (c, ctx): DominoView => ({ ...baseView(def, ctx), situation: c.situation, chain: c.chain, prompt: c.prompt, options: publicOptions(c.options, `${ctx.seed}:conseguenze`) }),
  score: ({ content, ctx, submissions }) => scoreSingle(content.solution.optionId, ctx, submissions, { okLabel: "Conseguenza giusta", koLabel: "Catena spezzata" }),
  reveal: (c): DominoReveal => ({ situation: c.situation, chain: c.chain, prompt: c.prompt, options: c.options, solutionId: c.solution.optionId, explain: c.explain }),
};

export const effettoDomino: MechanicModule<DominoContent, OptionSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => demoSingle(ctx, seed, c.solution.optionId, c.options.map((o) => o.id)),
  },
};
