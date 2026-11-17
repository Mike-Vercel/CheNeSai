import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema, pubPoll } from "./_m3";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 45 · IL PUB HA TORTO? (manche 3) — la TV mostra un dato FITTIZIO e verificabile (scontrino, grafico, tabella
 * disegnati in codice) con una domanda che ha una trappola per chi legge in fretta. Ogni tavolo:
 *   1. risponde alla domanda (+60 se giusta);
 *   2. prevede se la MAGGIORANZA dei tavoli sbaglierà (+40 se la previsione è giusta).
 * «Maggioranza sbagliata» = più della metà dei tavoli che hanno risposto. Punti distinti, un voto per tavolo.
 */

export const ANSWER_POINTS = 60;
export const PREDICTION_POINTS = 40;

const rowSchema = z.object({
  label: text(44),
  /** testo del dato così come appare (es. «7,5 ore», «32,00 €») */
  shown: text(24),
  /** lunghezza della barra (solo per i grafici a barre) */
  bar: z.number().min(0).optional(),
  note: text(30).optional(),
});

export const tortoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    title: text(60),
    data: z.object({
      kind: z.enum(["barre", "tabella", "scontrino"]),
      caption: text(90),
      rows: z.array(rowSchema).min(2).max(8),
      footnote: text(160).optional(),
    }),
    question: text(150),
    options: optionsSchema(3, 4),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkOptions(c.options, [c.solution.optionId], ctx, ["options"]);
    if (c.data.kind === "barre" && c.data.rows.some((r) => r.bar === undefined)) ctx.addIssue({ code: "custom", message: "grafico a barre: ogni riga vuole `bar`", path: ["data"] });
  });
export type TortoContent = z.infer<typeof tortoContent>;
export type TortoInput = z.input<typeof tortoContent>;
export type TortoData = TortoContent["data"];

export const tortoSubmission = z.object({ optionId: idSchema, pubWrong: z.boolean() });
export type TortoSubmission = z.infer<typeof tortoSubmission>;

export interface TortoView extends BaseView {
  /** titolo del dato (il titolo della meccanica resta `title`) */
  caseTitle: string;
  data: TortoData;
  question: string;
  options: Option[];
}

export interface TortoSummary {
  counts: Record<string, number>;
  percent: Record<string, number>;
  tables: number;
  /** tavoli che hanno sbagliato la risposta */
  wrong: number;
  majorityWrong: boolean;
  /** tavoli che avevano previsto «la maggioranza sbaglia» */
  predictedWrong: number;
  picks: Record<string, { optionId: string; pubWrong: boolean }>;
}

export interface TortoReveal {
  caseTitle: string;
  data: TortoData;
  question: string;
  options: Option[];
  solutionId: string;
  explain: string;
  summary: TortoSummary | null;
}

const def: MechanicDef<TortoContent, TortoSubmission> = {
  code: "il-pub-ha-torto",
  number: 45,
  manche: 3,
  title: "Il pub ha torto?",
  input: "pub",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Leggete il dato e rispondete (+60). Poi prevedete se la maggioranza dei tavoli sbaglierà (+40). Occhio alle trappole.",
  contentSchema: tortoContent,
  submissionSchema: tortoSubmission,
  publicView: (c, ctx): TortoView => ({ ...baseView(def, ctx), caseTitle: c.title, data: c.data, question: c.question, options: publicOptions(c.options, `${ctx.seed}:torto`) }),
  score: ({ content, ctx, submissions }) => {
    const ids = content.options.map((o) => o.id);
    const firsts = firstPerTeam(submissions, ctx, (s) => ids.includes(s.payload.optionId));
    const list = [...firsts.values()];
    const poll = pubPoll(
      list.map((s) => s.payload.optionId),
      ids,
    );
    const sol = content.solution.optionId;
    const wrong = list.filter((s) => s.payload.optionId !== sol).length;
    const majorityWrong = wrong * 2 > list.length;
    const summary: TortoSummary = {
      counts: poll.counts,
      percent: poll.percent,
      tables: list.length,
      wrong,
      majorityWrong,
      predictedWrong: list.filter((s) => s.payload.pubWrong).length,
      picks: Object.fromEntries([...firsts].map(([id, s]) => [id, { optionId: s.payload.optionId, pubWrong: s.payload.pubWrong }])),
    };
    const out: ScoreWithSummary<TortoSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const right = s.payload.optionId === sol;
        const pred = s.payload.pubWrong === majorityWrong;
        return outcome(t.teamId, {
          points: (right ? ANSWER_POINTS : 0) + (pred ? PREDICTION_POINTS : 0),
          chaos: CHAOS.partecipa + (right && pred ? CHAOS.centro : 0),
          correct: right,
          accuracy: ((right ? 1 : 0) + (pred ? 1 : 0)) / 2,
          label: right && pred ? "Risposta e previsione giuste" : right ? "Risposta giusta, previsione no" : pred ? "Previsione giusta, risposta no" : "Il dato vi ha fregato",
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): TortoReveal => ({
    caseTitle: c.title,
    data: c.data,
    question: c.question,
    options: c.options,
    solutionId: c.solution.optionId,
    explain: c.explain,
    summary: (out as ScoreWithSummary<TortoSummary>).summary ?? null,
  }),
};

export const ilPubHaTorto: MechanicModule<TortoContent, TortoSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({
        optionId: pickAnswer(
          rnd,
          c.solution.optionId,
          c.options.map((o) => o.id),
          demoSkill(i),
        ),
        pubWrong: rnd() < 0.5,
      })),
  },
};
