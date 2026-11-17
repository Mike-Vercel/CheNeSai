import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema, pubPoll } from "./_m3";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 47 · EFFETTO GREGGE (manche 3) — una domanda con una risposta giusta verificabile e una trappola per l'istinto.
 * Ogni tavolo dà la SUA risposta e sceglie la strategia:
 *   - ISTINTO: vale la propria risposta → giusta 100;
 *   - GREGGE: vale la risposta più data dai tavoli del locale → giusta 60 (più sicuro, paga meno).
 * Se il gregge è diviso (parità in testa) vale la propria risposta, pagata come gregge. Il voto popolare non è
 * necessariamente giusto: con le domande trabocchetto il gregge sbaglia spesso. Un voto per tavolo.
 */

export const INSTINCT_POINTS = POINTS.standard;
export const HERD_POINTS = 60;

export const greggeContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    prompt: text(170),
    options: optionsSchema(3, 4),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [c.solution.optionId], ctx, ["options"]));
export type GreggeContent = z.infer<typeof greggeContent>;
export type GreggeInput = z.input<typeof greggeContent>;

export const greggeSubmission = z.object({ optionId: idSchema, follow: z.boolean() });
export type GreggeSubmission = z.infer<typeof greggeSubmission>;

export interface GreggeView extends BaseView {
  prompt: string;
  options: Option[];
}

export interface GreggeSummary {
  counts: Record<string, number>;
  percent: Record<string, number>;
  /** risposte più date (più di una = gregge diviso) */
  popular: string[];
  tables: number;
  /** tavoli che hanno seguito il gregge */
  followers: number;
  /** la risposta del gregge (unica) era giusta */
  herdRight: boolean | null;
  picks: Record<string, { optionId: string; follow: boolean; effective: string }>;
}

export interface GreggeReveal {
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
  summary: GreggeSummary | null;
}

const def: MechanicDef<GreggeContent, GreggeSubmission> = {
  code: "effetto-gregge",
  number: 47,
  manche: 3,
  title: "Effetto gregge",
  input: "pub",
  timerSec: 50,
  oneDeviceOk: true,
  needs: [],
  rule: "Date la vostra risposta, poi scegliete: istinto (vale la vostra, 100) o gregge (vale la più votata dal locale, 60).",
  contentSchema: greggeContent,
  submissionSchema: greggeSubmission,
  publicView: (c, ctx): GreggeView => ({ ...baseView(def, ctx), prompt: c.prompt, options: publicOptions(c.options, `${ctx.seed}:gregge`) }),
  score: ({ content, ctx, submissions }) => {
    const ids = content.options.map((o) => o.id);
    const firsts = firstPerTeam(submissions, ctx, (s) => ids.includes(s.payload.optionId));
    const poll = pubPoll(
      [...firsts.values()].map((s) => s.payload.optionId),
      ids,
    );
    const sol = content.solution.optionId;
    const herd = poll.winners.length === 1 ? poll.winners[0] : null;
    const picks: GreggeSummary["picks"] = {};
    const out: ScoreWithSummary<GreggeSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const follow = s.payload.follow;
        const effective = follow && herd ? herd : s.payload.optionId;
        picks[t.teamId] = { optionId: s.payload.optionId, follow, effective };
        const right = effective === sol;
        const points = right ? (follow ? HERD_POINTS : INSTINCT_POINTS) : 0;
        return outcome(t.teamId, {
          points,
          chaos: CHAOS.partecipa + (right && !follow ? CHAOS.rischio : 0),
          correct: right,
          accuracy: right ? 1 : 0,
          label: !follow ? (right ? "Istinto giusto" : "Istinto sbagliato") : !herd ? (right ? "Gregge diviso: valeva la vostra, giusta" : "Gregge diviso: valeva la vostra, sbagliata") : right ? "Il gregge aveva ragione" : "Il gregge sbagliava",
        });
      }),
      summary: {
        counts: poll.counts,
        percent: poll.percent,
        popular: poll.winners,
        tables: poll.tables,
        followers: [...firsts.values()].filter((s) => s.payload.follow).length,
        herdRight: herd ? herd === sol : null,
        picks,
      },
    };
    return out;
  },
  reveal: (c, out): GreggeReveal => ({ prompt: c.prompt, options: c.options, solutionId: c.solution.optionId, explain: c.explain, summary: (out as ScoreWithSummary<GreggeSummary>).summary ?? null }),
};

export const effettoGregge: MechanicModule<GreggeContent, GreggeSubmission> = {
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
        follow: i % 2 === 1,
      })),
  },
};
