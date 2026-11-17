import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema, pubPoll, round3, type PubPoll } from "./_m3";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 44 · ALLINEAMENTO PERFETTO (manche 3) — gioco del «punto d'incontro»: una domanda con tante risposte possibili
 * e nessuna giusta. Ogni tavolo sceglie senza potersi accordare con gli altri; conta la CONVERGENZA.
 * Punti = 100 × (tavoli che hanno scelto come voi) / (altri tavoli che hanno risposto): tutti allineati 100,
 * nessuno con voi 0. Un voto per tavolo, nessun vantaggio numerico. Un solo tavolo in gara: 50 fissi.
 */

export const SOLO_POINTS = 50;

export const allineamentoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    prompt: text(140),
    /** ordine dell'autore (conta: è lo stesso per tutti e fa parte del gioco) */
    options: optionsSchema(5, 9),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [], ctx, ["options"]));
export type AllineamentoContent = z.infer<typeof allineamentoContent>;
export type AllineamentoInput = z.input<typeof allineamentoContent>;

export const allineamentoSubmission = z.object({ optionId: idSchema });
export type AllineamentoSubmission = z.infer<typeof allineamentoSubmission>;

export interface AllineamentoView extends BaseView {
  prompt: string;
  options: Option[];
}

export type AllineamentoSummary = PubPoll & { picks: Record<string, string> };

export interface AllineamentoReveal {
  prompt: string;
  options: Option[];
  explain: string;
  summary: AllineamentoSummary | null;
}

const def: MechanicDef<AllineamentoContent, AllineamentoSubmission> = {
  code: "allineamento-perfetto",
  number: 44,
  manche: 3,
  title: "Allineamento perfetto",
  input: "pub",
  timerSec: 40,
  oneDeviceOk: true,
  needs: [],
  rule: "Nessuna risposta giusta: scegliete quella che sceglieranno gli altri tavoli. Più tavoli con voi, più punti.",
  contentSchema: allineamentoContent,
  submissionSchema: allineamentoSubmission,
  publicView: (c, ctx): AllineamentoView => ({ ...baseView(def, ctx), prompt: c.prompt, options: c.options.map((o) => ({ id: o.id, text: o.text })) }),
  score: ({ content, ctx, submissions }) => {
    const ids = content.options.map((o) => o.id);
    const firsts = firstPerTeam(submissions, ctx, (s) => ids.includes(s.payload.optionId));
    const poll = pubPoll(
      [...firsts.values()].map((s) => s.payload.optionId),
      ids,
    );
    const n = poll.tables;
    const summary: AllineamentoSummary = { ...poll, picks: Object.fromEntries([...firsts].map(([id, s]) => [id, s.payload.optionId])) };
    const out: ScoreWithSummary<AllineamentoSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        if (n < 2) return outcome(t.teamId, { points: SOLO_POINTS, chaos: CHAOS.partecipa, correct: null, accuracy: null, label: "Unico tavolo in gara: 50" });
        const with_ = poll.counts[s.payload.optionId] - 1;
        const share = with_ / (n - 1);
        const all = with_ === n - 1;
        return outcome(t.teamId, {
          points: Math.round(POINTS.standard * share),
          chaos: CHAOS.partecipa + (all ? CHAOS.centro : 0),
          correct: poll.winners.includes(s.payload.optionId) && with_ > 0,
          accuracy: round3(share),
          label: all ? "Allineati con tutto il locale" : with_ ? `Con voi ${with_} ${with_ === 1 ? "tavolo" : "tavoli"} su ${n - 1}` : "Nessuno con voi",
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): AllineamentoReveal => ({ prompt: c.prompt, options: c.options, explain: c.explain, summary: (out as ScoreWithSummary<AllineamentoSummary>).summary ?? null }),
};

export const allineamentoPerfetto: MechanicModule<AllineamentoContent, AllineamentoSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        const ids = c.options.map((o) => o.id);
        return { optionId: i < 2 ? ids[0] : ids[Math.floor(rnd() * ids.length)] };
      }),
  },
};
