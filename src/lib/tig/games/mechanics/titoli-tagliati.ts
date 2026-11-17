import { z } from "zod";
import type { MechanicDef } from "../contract";
import { publicOptions, type Option } from "../components/choice";
import { baseView, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { checkSingle, demoSingle, difficultySchema, optionSolution, optionSubmission, scoreSingle, type OptionSubmission } from "./m1/common";

/**
 * 07 · TITOLI TAGLIATI (manche 1) — un titolo di giornale INVENTATO (realistico e ironico) ha un buco: manca
 * la frase che dà senso alla notizia. Il sommario sotto il titolo contiene i fatti: tra quattro finali, uno
 * solo è coerente con quei fatti (chiave di risposta editoriale, non voto del pubblico). 100 se giusto.
 */

/** Segnaposto del pezzo mancante nel titolo. */
export const CUT = "___";

export const titoliContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** testata inventata, es. «La Gazzetta del Bancone» */
    outlet: text(36),
    /** sezione, es. «Cronaca», «Lavoro», «Viaggi» */
    section: text(24),
    /** titolo con il buco `___` (una volta sola) */
    headline: text(150),
    /** sommario: i fatti che rendono UNA sola chiusura coerente */
    lead: text(240),
    options: optionsSchema(4, 4),
    solution: optionSolution,
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkSingle(c.options, c.solution.optionId, ctx);
    if (c.headline.split(CUT).length !== 2) ctx.addIssue({ code: "custom", message: `il titolo deve contenere «${CUT}» una volta`, path: ["headline"] });
  });
export type TitoliContent = z.infer<typeof titoliContent>;
export type TitoliInput = z.input<typeof titoliContent>;

export interface TitoliView extends BaseView {
  outlet: string;
  section: string;
  /** titolo diviso al buco: [prima, dopo] */
  headline: [string, string];
  lead: string;
  options: Option[];
}

export interface TitoliReveal {
  outlet: string;
  section: string;
  headline: [string, string];
  lead: string;
  options: Option[];
  solutionId: string;
  explain: string;
}

function split(h: string): [string, string] {
  const [a, b] = h.split(CUT);
  return [a ?? "", b ?? ""];
}

const def: MechanicDef<TitoliContent, OptionSubmission> = {
  code: "titoli-tagliati",
  number: 7,
  manche: 1,
  title: "Titoli tagliati",
  input: "team",
  timerSec: 30,
  oneDeviceOk: true,
  needs: [],
  rule: "Al titolo manca il pezzo che dà senso alla notizia. Leggete il sommario: un solo finale torna con i fatti.",
  contentSchema: titoliContent,
  submissionSchema: optionSubmission,
  publicView: (c, ctx): TitoliView => ({
    ...baseView(def, ctx),
    outlet: c.outlet,
    section: c.section,
    headline: split(c.headline),
    lead: c.lead,
    options: publicOptions(c.options, `${ctx.seed}:finali`),
  }),
  score: ({ content, ctx, submissions }) => scoreSingle(content.solution.optionId, ctx, submissions, { okLabel: "Titolo completato", koLabel: "Finale incoerente" }),
  reveal: (c): TitoliReveal => ({ outlet: c.outlet, section: c.section, headline: split(c.headline), lead: c.lead, options: c.options, solutionId: c.solution.optionId, explain: c.explain }),
};

export const titoliTagliati: MechanicModule<TitoliContent, OptionSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => demoSingle(ctx, seed, c.solution.optionId, c.options.map((o) => o.id)),
  },
};
