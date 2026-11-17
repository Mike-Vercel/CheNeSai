import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { percentages, pubTally } from "../components/vote";
import { baseView, demoPerTeam, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 33 · PREVEDI LA MAGGIORANZA (manche 3) — un dilemma leggero: ogni tavolo dà UN voto e una PREVISIONE
 * di cosa voterà la maggioranza dei tavoli. 100 punti a chi indovina l'opzione più votata
 * (in caso di parità valgono tutte le opzioni a pari merito). Nessuna risposta giusta a priori.
 */

export const maggioranzaContent = z
  .object({
    id: variantId,
    prompt: text(140),
    options: optionsSchema(2, 4),
    /** spiegazione mostrata al reveal (perché il locale tende a votare così, senza giudizi) */
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [], ctx, ["options"]));
export type MaggioranzaContent = z.infer<typeof maggioranzaContent>;
export type MaggioranzaInput = z.input<typeof maggioranzaContent>;

export const maggioranzaSubmission = z.object({ vote: idSchema, guess: idSchema });
export type MaggioranzaSubmission = z.infer<typeof maggioranzaSubmission>;

export interface MaggioranzaView extends BaseView {
  prompt: string;
  /** ordine fisso dell'autore (le opzioni di un dilemma hanno un ordine naturale) */
  options: Option[];
}

export interface MaggioranzaSummary {
  counts: Record<string, number>;
  percent: Record<string, number>;
  winners: string[];
  tables: number;
}

export interface MaggioranzaReveal {
  prompt: string;
  options: Option[];
  explain: string;
  summary: MaggioranzaSummary | null;
}

const def: MechanicDef<MaggioranzaContent, MaggioranzaSubmission> = {
  code: "prevedi-la-maggioranza",
  number: 33,
  manche: 3,
  title: "Prevedi la maggioranza",
  input: "pub",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Ogni tavolo vota una volta e prevede cosa sceglierà la maggioranza del locale. Previsione giusta: 100 punti.",
  contentSchema: maggioranzaContent,
  submissionSchema: maggioranzaSubmission,
  publicView: (c, ctx): MaggioranzaView => ({ ...baseView(def, ctx), prompt: c.prompt, options: c.options.map((o) => ({ id: o.id, text: o.text })) }),
  score: ({ content, ctx, submissions }) => {
    const ids = content.options.map((o) => o.id);
    const firsts = firstPerTeam(submissions, ctx, (s) => ids.includes(s.payload.vote) && ids.includes(s.payload.guess));
    const tally = pubTally(new Map([...firsts].map(([teamId, s]) => [teamId, s.payload.vote])), ids);
    const summary: MaggioranzaSummary = { counts: tally.counts, percent: percentages(tally.counts, ids), winners: tally.winners, tables: tally.tables };
    const out: ScoreWithSummary<MaggioranzaSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const ok = tally.winners.includes(s.payload.guess);
        return outcome(t.teamId, {
          points: ok ? POINTS.standard : 0,
          chaos: CHAOS.partecipa + (ok ? CHAOS.centro : 0),
          correct: ok,
          accuracy: ok ? 1 : 0,
          label: ok ? "Previsione esatta" : "Il locale la pensa diversamente",
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): MaggioranzaReveal => ({
    prompt: c.prompt,
    options: c.options,
    explain: c.explain,
    summary: (out as ScoreWithSummary<MaggioranzaSummary>).summary ?? null,
  }),
};

export const prevediLaMaggioranza: MechanicModule<MaggioranzaContent, MaggioranzaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        const ids = c.options.map((o) => o.id);
        return { vote: ids[i % ids.length], guess: ids[Math.floor(rnd() * ids.length)] };
      }),
  },
};
