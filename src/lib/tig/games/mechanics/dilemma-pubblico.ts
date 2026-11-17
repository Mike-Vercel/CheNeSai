import { z } from "zod";
import type { MechanicDef } from "../contract";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { dilemmaResult, type DilemmaMatrix } from "../components/vote";
import { baseView, demoPerTeam, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 39 · IL DILEMMA PUBBLICO (manche 3) — ogni tavolo sceglie COOPERARE o COMPETERE. La matrice dei punti è
 * visibile prima: se abbastanza tavoli cooperano scatta lo scenario «insieme» (più punti per tutti), ma chi
 * compete prende sempre un po' di più. Un voto per tavolo; chi non sceglie non conta e prende 0.
 */

const payoff = z.number().int().min(0).max(100);

export const dilemmaContent = z
  .object({
    id: variantId,
    /** titolo della situazione, es. «Il frigo condiviso» */
    story: text(60),
    prompt: text(200),
    coopLabel: text(28),
    competeLabel: text(28),
    matrix: z.object({
      threshold: z.number().min(0.3).max(0.9),
      reached: z.object({ coop: payoff, compete: payoff }),
      missed: z.object({ coop: payoff, compete: payoff }),
    }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const m = c.matrix;
    // dilemma vero: competere conviene al singolo, cooperare conviene a tutti
    if (!(m.reached.compete > m.reached.coop && m.missed.compete > m.missed.coop)) ctx.addIssue({ code: "custom", message: "competere deve convenire al singolo" });
    if (!(m.reached.coop > m.missed.compete)) ctx.addIssue({ code: "custom", message: "cooperare insieme deve battere il «tutti contro tutti»" });
  });
export type DilemmaContent = z.infer<typeof dilemmaContent>;
export type DilemmaInput = z.input<typeof dilemmaContent>;

export const dilemmaSubmission = z.object({ choice: z.enum(["coopera", "compete"]) });
export type DilemmaSubmission = z.infer<typeof dilemmaSubmission>;

export interface DilemmaView extends BaseView {
  story: string;
  prompt: string;
  coopLabel: string;
  competeLabel: string;
  matrix: DilemmaMatrix;
}

export interface DilemmaSummary {
  total: number;
  coop: number;
  share: number;
  reached: boolean;
}

export interface DilemmaReveal {
  story: string;
  coopLabel: string;
  competeLabel: string;
  matrix: DilemmaMatrix;
  explain: string;
  summary: DilemmaSummary | null;
}

const def: MechanicDef<DilemmaContent, DilemmaSubmission> = {
  code: "dilemma-pubblico",
  number: 39,
  manche: 3,
  title: "Il dilemma pubblico",
  input: "pub",
  timerSec: 55,
  oneDeviceOk: true,
  needs: [],
  rule: "Cooperare o competere? Se abbastanza tavoli cooperano vincono tutti, ma chi compete prende un po' di più. Matrice in TV.",
  contentSchema: dilemmaContent,
  submissionSchema: dilemmaSubmission,
  publicView: (c, ctx): DilemmaView => ({
    ...baseView(def, ctx),
    story: c.story,
    prompt: c.prompt,
    coopLabel: c.coopLabel,
    competeLabel: c.competeLabel,
    matrix: c.matrix,
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const r = dilemmaResult(new Map([...firsts].map(([k, s]) => [k, s.payload.choice])), content.matrix);
    const summary: DilemmaSummary = { total: r.total, coop: r.coop, share: r.share, reached: r.reached };
    const out: ScoreWithSummary<DilemmaSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId, "Nessuna scelta");
        const coop = s.payload.choice === "coopera";
        return outcome(t.teamId, {
          points: coop ? r.pay.coop : r.pay.compete,
          chaos: CHAOS.partecipa + (coop && r.reached ? CHAOS.centro : 0),
          correct: null,
          accuracy: null,
          label: `${coop ? content.coopLabel : content.competeLabel} · ${r.reached ? "soglia raggiunta" : "soglia mancata"}`,
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): DilemmaReveal => ({
    story: c.story,
    coopLabel: c.coopLabel,
    competeLabel: c.competeLabel,
    matrix: c.matrix,
    explain: c.explain,
    summary: (out as ScoreWithSummary<DilemmaSummary>).summary ?? null,
  }),
};

export const dilemmaPubblico: MechanicModule<DilemmaContent, DilemmaSubmission> = {
  def,
  extras: {
    demoSubmissions: (_c, ctx, seed) => demoPerTeam(ctx, seed, (i) => ({ choice: i % 3 === 2 ? "compete" : "coopera" })),
  },
};
