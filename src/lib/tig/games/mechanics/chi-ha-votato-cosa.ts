import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { percentages } from "../components/vote";
import { baseView, demoPerTeam, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema, pubPoll, tally, topIds, type PubPoll } from "./_m3";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 34 · CHI HA VOTATO COSA? (manche 3) — due domande leggere a due risposte (es. «mare o montagna?» e
 * «colazione dolce o salata?»): ogni tavolo dà il suo voto anonimo a entrambe e il capitano indovina la
 * COPPIA di risposte più votata dal locale («chi ha votato mare, cosa ha votato dopo?»).
 * Un voto per tavolo. Coppia giusta 100; altrimenti 30 per ogni metà che coincide con la risposta più
 * votata di quella domanda (massimo 60). In TV solo la griglia 2×2 con i conteggi: mai chi ha votato cosa.
 */

export const COMBO_POINTS = POINTS.standard;
export const HALF_POINTS = 30;

const questionSchema = z.object({ id: idSchema, prompt: text(90), options: optionsSchema(2, 2) });

export const chiHaVotatoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** situazione comune alle due domande, es. «Il sabato perfetto» */
    intro: text(70),
    questions: z.tuple([questionSchema, questionSchema]),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    c.questions.forEach((q, i) => checkOptions(q.options, [], ctx, ["questions", i]));
    if (c.questions[0].id === c.questions[1].id) ctx.addIssue({ code: "custom", message: "id delle domande duplicati" });
    const all = c.questions.flatMap((q) => q.options.map((o) => o.id));
    if (new Set(all).size !== all.length) ctx.addIssue({ code: "custom", message: "id delle risposte ripetuti tra le due domande" });
  });
export type ChiHaVotatoContent = z.infer<typeof chiHaVotatoContent>;
export type ChiHaVotatoInput = z.input<typeof chiHaVotatoContent>;

const pair = z.tuple([idSchema, idSchema]);
export const chiHaVotatoSubmission = z.object({ vote: pair, guess: pair });
export type ChiHaVotatoSubmission = z.infer<typeof chiHaVotatoSubmission>;

export interface ChiHaVotatoQuestion {
  id: string;
  prompt: string;
  options: Option[];
}

export interface ChiHaVotatoView extends BaseView {
  intro: string;
  questions: [ChiHaVotatoQuestion, ChiHaVotatoQuestion];
}

export interface ChiHaVotatoCombo {
  /** chiave «idA+idB» */
  key: string;
  a: string;
  b: string;
  n: number;
  pct: number;
}

export interface ChiHaVotatoSummary {
  combos: ChiHaVotatoCombo[];
  /** coppie più votate (parità = più coppie) */
  winners: string[];
  /** per domanda: sondaggio del locale */
  perQuestion: [PubPoll, PubPoll];
  tables: number;
  /** coppia indovinata da ogni tavolo (per segnare «la vostra» sul telefono) */
  guesses: Record<string, string>;
}

export interface ChiHaVotatoReveal {
  intro: string;
  questions: [ChiHaVotatoQuestion, ChiHaVotatoQuestion];
  explain: string;
  summary: ChiHaVotatoSummary | null;
}

export const comboKey = (a: string, b: string) => `${a}+${b}`;

/** Le quattro coppie possibili, in ordine fisso (prima domanda × seconda). */
export function combosOf(c: Pick<ChiHaVotatoContent, "questions">): { key: string; a: string; b: string }[] {
  const [q1, q2] = c.questions;
  return q1.options.flatMap((x) => q2.options.map((y) => ({ key: comboKey(x.id, y.id), a: x.id, b: y.id })));
}

function validPair(c: ChiHaVotatoContent, p: readonly [string, string]): boolean {
  return c.questions[0].options.some((o) => o.id === p[0]) && c.questions[1].options.some((o) => o.id === p[1]);
}

const def: MechanicDef<ChiHaVotatoContent, ChiHaVotatoSubmission> = {
  code: "chi-ha-votato-cosa",
  number: 34,
  manche: 3,
  title: "Chi ha votato cosa?",
  input: "pub",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Due domande, un voto anonimo per tavolo. Indovinate la coppia di risposte più votata dal locale: 100, mezza coppia 30.",
  contentSchema: chiHaVotatoContent,
  submissionSchema: chiHaVotatoSubmission,
  publicView: (c, ctx): ChiHaVotatoView => ({
    ...baseView(def, ctx),
    intro: c.intro,
    questions: [
      { id: c.questions[0].id, prompt: c.questions[0].prompt, options: c.questions[0].options.map((o) => ({ id: o.id, text: o.text })) },
      { id: c.questions[1].id, prompt: c.questions[1].prompt, options: c.questions[1].options.map((o) => ({ id: o.id, text: o.text })) },
    ],
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx, (s) => validPair(content, s.payload.vote) && validPair(content, s.payload.guess));
    const combos = combosOf(content);
    const keys = combos.map((k) => k.key);
    const votes = [...firsts.values()].map((s) => s.payload.vote);
    const counts = tally(
      votes.map((v) => comboKey(v[0], v[1])),
      keys,
    );
    const pct = percentages(counts, keys);
    const winners = topIds(counts, keys);
    const perQuestion: [PubPoll, PubPoll] = [
      pubPoll(
        votes.map((v) => v[0]),
        content.questions[0].options.map((o) => o.id),
      ),
      pubPoll(
        votes.map((v) => v[1]),
        content.questions[1].options.map((o) => o.id),
      ),
    ];
    const summary: ChiHaVotatoSummary = {
      combos: combos.map((k) => ({ ...k, n: counts[k.key], pct: pct[k.key] })),
      winners,
      perQuestion,
      tables: votes.length,
      guesses: Object.fromEntries([...firsts].map(([id, x]) => [id, comboKey(x.payload.guess[0], x.payload.guess[1])])),
    };
    const out: ScoreWithSummary<ChiHaVotatoSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const [g1, g2] = s.payload.guess;
        if (winners.includes(comboKey(g1, g2))) {
          return outcome(t.teamId, { points: COMBO_POINTS, chaos: CHAOS.partecipa + CHAOS.centro, correct: true, accuracy: 1, label: "Coppia esatta" });
        }
        const halves = (perQuestion[0].winners.includes(g1) ? 1 : 0) + (perQuestion[1].winners.includes(g2) ? 1 : 0);
        return outcome(t.teamId, {
          points: halves * HALF_POINTS,
          chaos: CHAOS.partecipa,
          correct: false,
          accuracy: (halves * HALF_POINTS) / COMBO_POINTS,
          label: halves === 2 ? "Due metà giuste, coppia no" : halves === 1 ? "Mezza coppia giusta" : "Il locale ha votato altro",
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): ChiHaVotatoReveal => ({
    intro: c.intro,
    questions: [
      { id: c.questions[0].id, prompt: c.questions[0].prompt, options: c.questions[0].options },
      { id: c.questions[1].id, prompt: c.questions[1].prompt, options: c.questions[1].options },
    ],
    explain: c.explain,
    summary: (out as ScoreWithSummary<ChiHaVotatoSummary>).summary ?? null,
  }),
};

export const chiHaVotatoCosa: MechanicModule<ChiHaVotatoContent, ChiHaVotatoSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        const a = c.questions[0].options.map((o) => o.id);
        const b = c.questions[1].options.map((o) => o.id);
        const pick = (ids: string[]) => ids[Math.floor(rnd() * ids.length)];
        return { vote: [a[i % 2], b[(i + 1) % 2]], guess: [pick(a), pick(b)] };
      }),
  },
};
