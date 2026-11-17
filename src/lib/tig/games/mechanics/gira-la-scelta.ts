import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { difficultySchema, tally } from "./_m3";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 48 · GIRA LA SCELTA (manche 3) — un evento comune (il trasloco, la cena dai suoceri…) mostra tre RISCHI.
 * Per i primi 15 secondi ogni tavolo vede solo i titoli e sceglie quale rischio affrontare; poi si svela la prova
 * di ogni carta: una domanda della stessa difficoltà e con la stessa ricompensa per tutte (risposta giusta 80).
 * Bonus annunciato: +20 a chi risponde giusto sulla carta scelta da MENO tavoli («strada meno battuta»; serve
 * che i tavoli abbiano scelto almeno due carte diverse). Un voto per tavolo.
 * Con `publicViewAt` le domande non partono verso i telefoni prima dei 15 secondi.
 */

export const CHOICE_MS = 15_000;
export const RIGHT_POINTS = 80;
export const ROAD_BONUS = 20;

const cardSchema = z.object({
  id: idSchema,
  /** il rischio, es. «Il divano» */
  title: text(28),
  /** cosa si rischia, visibile prima della scelta */
  teaser: text(80),
  question: text(170),
  options: optionsSchema(3, 3),
});

export const giraContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    event: text(60),
    story: text(170),
    cards: z.array(cardSchema).length(3),
    solution: z.object({ answers: z.record(z.string(), idSchema) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (new Set(c.cards.map((k) => k.id)).size !== 3) ctx.addIssue({ code: "custom", message: "id delle carte duplicati" });
    c.cards.forEach((k, i) => {
      const a = c.solution.answers[k.id];
      if (!a) ctx.addIssue({ code: "custom", message: `manca la risposta della carta ${k.id}`, path: ["cards", i] });
      checkOptions(k.options, a ? [a] : [], ctx, ["cards", i]);
    });
  });
export type GiraContent = z.infer<typeof giraContent>;
export type GiraInput = z.input<typeof giraContent>;

export const giraSubmission = z.object({ cardId: idSchema, optionId: idSchema });
export type GiraSubmission = z.infer<typeof giraSubmission>;

export interface GiraCard {
  id: string;
  title: string;
  teaser: string;
  /** null finché la prova non si svela */
  question: string | null;
  options: Option[] | null;
}

export interface GiraView extends BaseView {
  event: string;
  story: string;
  /** ms dall'inizio in cui si svelano le prove */
  choiceMs: number;
  cards: GiraCard[];
}

export interface GiraSummary {
  /** tavoli per carta */
  cardCounts: Record<string, number>;
  /** risposte giuste per carta */
  right: Record<string, number>;
  /** carte della «strada meno battuta» (vuoto se tutti hanno scelto la stessa) */
  minority: string[];
  tables: number;
  picks: Record<string, { cardId: string; optionId: string }>;
}

export interface GiraReveal {
  event: string;
  cards: (GiraCard & { solutionId: string })[];
  explain: string;
  summary: GiraSummary | null;
}

function cardsAt(c: GiraContent, seed: string, revealed: boolean): GiraCard[] {
  return c.cards.map((k) => ({ id: k.id, title: k.title, teaser: k.teaser, question: revealed ? k.question : null, options: revealed ? publicOptions(k.options, `${seed}:${k.id}`) : null }));
}

const def: MechanicDef<GiraContent, GiraSubmission> = {
  code: "gira-la-scelta",
  number: 48,
  manche: 3,
  title: "Gira la scelta",
  input: "pub",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Scegliete un rischio prima che si sveli la prova. Tutte le carte valgono uguale: giusta 80, +20 sulla carta scelta da meno tavoli.",
  contentSchema: giraContent,
  submissionSchema: giraSubmission,
  publicView: (c, ctx): GiraView => viewAt(c, ctx, true),
  score: ({ content, ctx, submissions }) => {
    const cardIds = content.cards.map((k) => k.id);
    const firsts = firstPerTeam(submissions, ctx, (s) => {
      const card = content.cards.find((k) => k.id === s.payload.cardId);
      return !!card && card.options.some((o) => o.id === s.payload.optionId);
    });
    const list = [...firsts.values()];
    const cardCounts = tally(
      list.map((s) => s.payload.cardId),
      cardIds,
    );
    const chosen = cardIds.filter((id) => cardCounts[id] > 0);
    const min = Math.min(...chosen.map((id) => cardCounts[id]));
    const minority = chosen.length >= 2 ? chosen.filter((id) => cardCounts[id] === min) : [];
    const isRight = (cardId: string, optionId: string) => content.solution.answers[cardId] === optionId;
    const right = Object.fromEntries(cardIds.map((id) => [id, list.filter((s) => s.payload.cardId === id && isRight(id, s.payload.optionId)).length]));
    const out: ScoreWithSummary<GiraSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const ok = isRight(s.payload.cardId, s.payload.optionId);
        const road = ok && minority.includes(s.payload.cardId);
        const title = content.cards.find((k) => k.id === s.payload.cardId)!.title;
        return outcome(t.teamId, {
          points: ok ? RIGHT_POINTS + (road ? ROAD_BONUS : 0) : 0,
          chaos: CHAOS.partecipa + (road ? CHAOS.rischio : 0),
          correct: ok,
          accuracy: ok ? 1 : 0,
          label: ok ? (road ? `«${title}»: giusta e strada meno battuta` : `«${title}»: giusta`) : `«${title}»: sbagliata`,
        });
      }),
      summary: { cardCounts, right, minority, tables: list.length, picks: Object.fromEntries([...firsts].map(([id, s]) => [id, { cardId: s.payload.cardId, optionId: s.payload.optionId }])) },
    };
    return out;
  },
  reveal: (c, out): GiraReveal => ({
    event: c.event,
    cards: c.cards.map((k) => ({ id: k.id, title: k.title, teaser: k.teaser, question: k.question, options: k.options, solutionId: c.solution.answers[k.id] })),
    explain: c.explain,
    summary: (out as ScoreWithSummary<GiraSummary>).summary ?? null,
  }),
};

/** Vista pubblica: le domande delle carte solo quando la prova si è svelata. */
function viewAt(c: GiraContent, ctx: PhaseCtx, revealed: boolean): GiraView {
  return { ...baseView(def, ctx), event: c.event, story: c.story, choiceMs: CHOICE_MS, cards: cardsAt(c, ctx.seed, revealed) };
}

export const giraLaScelta: MechanicModule<GiraContent, GiraSubmission> = {
  def,
  extras: {
    // prima dei 15 secondi le domande non escono dal server
    publicViewAt: (c, ctx, elapsedMs): GiraView => viewAt(c, ctx, elapsedMs >= CHOICE_MS),
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(
        ctx,
        seed,
        (i, rnd) => {
          const card = c.cards[i % 3];
          return {
            cardId: card.id,
            optionId: pickAnswer(
              rnd,
              c.solution.answers[card.id],
              card.options.map((o) => o.id),
              demoSkill(i),
            ),
          };
        },
        { minMs: CHOICE_MS + 2000 },
      ),
  },
};
