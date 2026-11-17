import { z } from "zod";
import type { MechanicDef } from "../contract";
import { clamp, CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema, round3 } from "./_m3";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 37 · QUANTO SIETE PREVEDIBILI (manche 3) — una proposta surreale ma innocua («le riunioni si fanno in piedi su
 * un piede solo»). Ogni tavolo vota SÌ o NO (un voto per tavolo) e con un cursore indovina la PERCENTUALE di
 * tavoli del locale che voterà SÌ. Punti dalla distanza dal risultato reale: entro 2 punti 100, poi −2,5 per
 * ogni punto di scarto (a 42 punti di distanza si arriva a 0). Il voto in sé non dà punti: serve a fare il dato.
 */

export const EXACT_WINDOW = 2;
export const POINTS_PER_POINT = 2.5;
/** scarto entro cui l'esito conta come «centro» (Energia Caos) */
export const BULLSEYE = 5;

export const prevedibiliContent = z.object({
  id: variantId,
  difficulty: difficultySchema,
  /** la proposta surreale */
  proposal: text(170),
  yesLabel: text(26),
  noLabel: text(26),
  explain: explainSchema,
});
export type PrevedibiliContent = z.infer<typeof prevedibiliContent>;
export type PrevedibiliInput = z.input<typeof prevedibiliContent>;

export const prevedibiliSubmission = z.object({ yes: z.boolean(), percent: z.number().int().min(0).max(100) });
export type PrevedibiliSubmission = z.infer<typeof prevedibiliSubmission>;

export interface PrevedibiliView extends BaseView {
  proposal: string;
  yesLabel: string;
  noLabel: string;
}

export interface PrevedibiliSummary {
  yes: number;
  no: number;
  tables: number;
  /** percentuale reale di tavoli che hanno votato SÌ */
  actual: number;
  /** previsioni dei tavoli (numero di tavolo arriva dalla TV) */
  guesses: { teamId: string; percent: number; diff: number }[];
}

export interface PrevedibiliReveal {
  proposal: string;
  yesLabel: string;
  noLabel: string;
  explain: string;
  summary: PrevedibiliSummary | null;
}

/** Punti per uno scarto (in punti percentuali) dal risultato reale. */
export function distancePoints(diff: number): number {
  const d = Math.abs(diff);
  if (d <= EXACT_WINDOW) return POINTS.standard;
  return Math.round(clamp(POINTS.standard - POINTS_PER_POINT * (d - EXACT_WINDOW), 0, POINTS.standard));
}

const def: MechanicDef<PrevedibiliContent, PrevedibiliSubmission> = {
  code: "quanto-siete-prevedibili",
  number: 37,
  manche: 3,
  title: "Quanto siete prevedibili",
  input: "pub",
  timerSec: 45,
  oneDeviceOk: true,
  needs: [],
  rule: "Votate sì o no, poi indovinate la percentuale di tavoli che dirà sì. Entro 2 punti: 100. Ogni punto di scarto in più costa 2,5.",
  contentSchema: prevedibiliContent,
  submissionSchema: prevedibiliSubmission,
  publicView: (c, ctx): PrevedibiliView => ({ ...baseView(def, ctx), proposal: c.proposal, yesLabel: c.yesLabel, noLabel: c.noLabel }),
  score: ({ ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const list = [...firsts.values()];
    const yes = list.filter((s) => s.payload.yes).length;
    const tables = list.length;
    const actual = tables ? Math.round((yes * 100) / tables) : 0;
    const summary: PrevedibiliSummary = { yes, no: tables - yes, tables, actual, guesses: [] };
    const outcomes = scopeTeams(ctx).map((t) => {
      const s = firsts.get(t.teamId);
      if (!s) return noAnswer(t.teamId);
      const diff = Math.abs(s.payload.percent - actual);
      summary.guesses.push({ teamId: t.teamId, percent: s.payload.percent, diff });
      const points = distancePoints(diff);
      const bull = diff <= BULLSEYE;
      return outcome(t.teamId, {
        points,
        chaos: CHAOS.partecipa + (bull ? CHAOS.centro : 0),
        correct: diff <= EXACT_WINDOW,
        accuracy: round3(1 - diff / 100),
        label: diff === 0 ? "Centro perfetto" : diff <= EXACT_WINDOW ? `Centro: scarto ${diff}` : `Scarto ${diff} punti`,
      });
    });
    summary.guesses.sort((a, b) => a.diff - b.diff || a.percent - b.percent);
    const out: ScoreWithSummary<PrevedibiliSummary> = { outcomes, summary };
    return out;
  },
  reveal: (c, out): PrevedibiliReveal => ({ proposal: c.proposal, yesLabel: c.yesLabel, noLabel: c.noLabel, explain: c.explain, summary: (out as ScoreWithSummary<PrevedibiliSummary>).summary ?? null }),
};

export const quantoSietePrevedibili: MechanicModule<PrevedibiliContent, PrevedibiliSubmission> = {
  def,
  extras: {
    demoSubmissions: (_c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({
        yes: i % 3 !== 1,
        percent: i === 0 ? 65 : Math.round(rnd() * 20) * 5,
      })),
  },
};
