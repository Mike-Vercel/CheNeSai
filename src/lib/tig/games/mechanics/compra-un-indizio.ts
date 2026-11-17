import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { checkEliminations, difficultySchema, isBuyer, remainingAfter } from "./_m4";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 53 · COMPRA UN INDIZIO (manche 4) — un caso inventato con indizi pubblici e UN dettaglio in vendita.
 * Il dettaglio costa 20 punti POTENZIALI, annunciati prima: risposta giusta senza comprarlo 100, comprandolo
 * 80; risposta sbagliata 0 in entrambi i casi. Il costo si toglie solo dal premio: mai punti negativi.
 * Il dettaglio arriva SOLO al telefono che compra per il tavolo (il capitano, o il primo telefono se il
 * capitano non c'è) e resta sigillato finché non lo compra; l'acquisto viaggia con la risposta.
 * In metà dei casi gli indizi pubblici bastano già (a chi ragiona bene), nell'altra metà lasciano due
 * sospettati: comprare o rischiare è una scelta vera. Lo schema verifica che con il dettaglio resti uno solo.
 */

export const CLUE_PRICE = 20;

const clueSchema = z.object({ text: text(160), clears: z.array(idSchema).max(4) });

export const compraContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    caseTitle: text(70),
    question: text(110),
    suspects: optionsSchema(4, 5),
    clues: z.array(clueSchema).min(2).max(3),
    /** il dettaglio in vendita */
    extra: clueSchema,
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkOptions(c.suspects, [c.solution.optionId], ctx, ["suspects"]);
    const ids = c.suspects.map((s) => s.id);
    checkEliminations(ids, c.solution.optionId, [...c.clues.map((k) => k.clears), c.extra.clears], ctx, ["clues"]);
    const all = remainingAfter(ids, [...c.clues.map((k) => k.clears), c.extra.clears]);
    if (all.length !== 1 || all[0] !== c.solution.optionId) ctx.addIssue({ code: "custom", message: `con il dettaglio restano ${JSON.stringify(all)}` });
    const pub = remainingAfter(
      ids,
      c.clues.map((k) => k.clears),
    );
    if (pub.length > 2) ctx.addIssue({ code: "custom", message: "senza il dettaglio restano troppi sospettati (max 2)" });
    if (c.extra.clears.length === 0) ctx.addIssue({ code: "custom", message: "il dettaglio deve scagionare qualcuno" });
  });
export type CompraContent = z.infer<typeof compraContent>;
export type CompraInput = z.input<typeof compraContent>;

export const compraSubmission = z.object({ optionId: idSchema, bought: z.boolean() });
export type CompraSubmission = z.infer<typeof compraSubmission>;

export interface CompraView extends BaseView {
  caseTitle: string;
  question: string;
  suspects: Option[];
  clues: string[];
  price: number;
  /** chiave della prova (per ricordare l'acquisto sul telefono) */
  instance: string;
}

export interface CompraMemberView {
  /** questo telefono compra per il tavolo */
  buyer: boolean;
  /** il dettaglio (solo al telefono che compra; la UI lo tiene sigillato finché non si compra) */
  extra: string | null;
}

export interface CompraSummary {
  /** tavoli che hanno comprato il dettaglio */
  bought: string[];
}

export interface CompraReveal {
  caseTitle: string;
  question: string;
  suspects: Option[];
  clues: { text: string; clears: string[] }[];
  extra: { text: string; clears: string[] };
  /** il caso si risolveva anche senza comprare */
  freeSolvable: boolean;
  solutionId: string;
  explain: string;
  summary: CompraSummary | null;
}

const def: MechanicDef<CompraContent, CompraSubmission> = {
  code: "compra-un-indizio",
  number: 53,
  manche: 4,
  title: "Compra un indizio",
  input: "team",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Risposta giusta: 100. Il capitano può comprare un dettaglio in più: la giusta vale 80. Sbagliata 0, mai punti in meno.",
  contentSchema: compraContent,
  submissionSchema: compraSubmission,
  publicView: (c, ctx: PhaseCtx): CompraView => ({
    ...baseView(def, ctx),
    caseTitle: c.caseTitle,
    question: c.question,
    suspects: publicOptions(c.suspects, `${ctx.seed}:sospettati`),
    clues: c.clues.map((k) => k.text),
    price: CLUE_PRICE,
    instance: `${ctx.gameInstanceId}:${ctx.startsAt}`,
  }),
  memberView: (c, ctx): CompraMemberView => {
    const buyer = isBuyer(ctx);
    return { buyer, extra: buyer ? c.extra.text : null };
  },
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const summary: CompraSummary = { bought: [...firsts.values()].filter((s) => s.payload.bought).map((s) => s.teamId) };
    const out: ScoreWithSummary<CompraSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const ok = s.payload.optionId === content.solution.optionId;
        const pts = ok ? POINTS.standard - (s.payload.bought ? CLUE_PRICE : 0) : 0;
        return outcome(t.teamId, {
          points: pts,
          chaos: CHAOS.partecipa + (ok ? CHAOS.centro : 0) + (ok && !s.payload.bought ? CHAOS.rischio : 0),
          correct: ok,
          accuracy: pts / POINTS.standard,
          label: ok ? (s.payload.bought ? `Esatto col dettaglio comprato (−${CLUE_PRICE})` : "Esatto senza aiuti") : s.payload.bought ? "Sbagliato (il dettaglio non costa nulla)" : "Sbagliato",
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): CompraReveal => ({
    caseTitle: c.caseTitle,
    question: c.question,
    suspects: c.suspects,
    clues: c.clues.map((k) => ({ text: k.text, clears: k.clears })),
    extra: { text: c.extra.text, clears: c.extra.clears },
    freeSolvable:
      remainingAfter(
        c.suspects.map((s) => s.id),
        c.clues.map((k) => k.clears),
      ).length === 1,
    solutionId: c.solution.optionId,
    explain: c.explain,
    summary: (out as ScoreWithSummary<CompraSummary>).summary ?? null,
  }),
};

export const compraUnIndizio: MechanicModule<CompraContent, CompraSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        const bought = i % 2 === 1;
        return { bought, optionId: pickAnswer(rnd, c.solution.optionId, c.suspects.map((o) => o.id), bought ? 0.95 : demoSkill(i)) };
      }),
  },
};
