import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { seededShuffle } from "../components/rng";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { difficultySchema, fingerprint } from "./m5-shared";

/**
 * 74 · TRE CARTE, UN DESTINO (manche 5) — tre carte coperte (A, B, C) nascondono tre sfide diverse con
 * ricompense comparabili (scarto massimo 30). Il mazzo è mescolato col seme della prova: PRIMA si mostra
 * l'impronta del mazzo, al reveal si svela il seme (chiunque può rifare il calcolo: sorteggio verificabile).
 * Ogni tavolo sceglie una carta a scatola chiusa nei primi 12 secondi; poi le carte si girano e il tavolo
 * risolve la sfida della SUA carta: giusta = la ricompensa della carta, sbagliata 0.
 * Con `publicViewAt` le facce delle carte non partono verso i telefoni prima della girata.
 */

export const FLIP_MS = 12000;
export const SLOTS = ["A", "B", "C"] as const;
export type Slot = (typeof SLOTS)[number];

const cardSchema = z.object({
  id: idSchema,
  /** tipo di sfida, es. «Logica», «Calcolo», «Parole» */
  kind: text(24),
  reward: z.number().int().min(80).max(140),
  prompt: text(220),
  options: optionsSchema(3, 4),
});

export const carteContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema.optional(),
    title: text(60),
    cards: z.array(cardSchema).length(3),
    solution: z.object({ answers: z.record(z.string(), idSchema) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (new Set(c.cards.map((k) => k.id)).size !== 3) ctx.addIssue({ code: "custom", message: "id delle carte duplicati" });
    const rewards = c.cards.map((k) => k.reward);
    if (Math.max(...rewards) - Math.min(...rewards) > 30) ctx.addIssue({ code: "custom", message: "ricompense non comparabili (scarto > 30)" });
    c.cards.forEach((k, i) => {
      const sol = c.solution.answers[k.id];
      if (!sol) ctx.addIssue({ code: "custom", message: `manca la soluzione di ${k.id}` });
      else checkOptions(k.options, [sol], ctx, ["cards", i]);
    });
  });
export type CarteContent = z.infer<typeof carteContent>;
export type CarteInput = z.input<typeof carteContent>;

export const carteSubmission = z.object({ slot: z.enum(SLOTS), optionId: idSchema });
export type CarteSubmission = z.infer<typeof carteSubmission>;

/** Testo del sorteggio: da qui il mescolamento e l'impronta mostrata prima. */
function drawSeed(ctx: PhaseCtx): string {
  return `${ctx.seed}:carte`;
}

/** Carta → sfida, deterministico dal seme. */
export function dealCards(cardIds: readonly string[], seedText: string): Record<Slot, string> {
  const order = seededShuffle(cardIds, seedText);
  return { A: order[0], B: order[1], C: order[2] };
}

export interface CarteFace {
  slot: Slot;
  kind: string;
  reward: number;
  prompt: string;
  options: Option[];
}

export interface CarteView extends BaseView {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  flipAtMs: number;
  /** impronta del mazzo (FNV-1a del testo del sorteggio), mostrata prima della scelta */
  deckPrint: string;
  /** facce delle carte: null prima della girata con `publicViewAt` */
  faces: CarteFace[] | null;
}

export interface CarteSummary {
  /** testo del sorteggio svelato a fine prova e carta → sfida */
  draw: string;
  deckPrint: string;
  deal: Record<Slot, string>;
  picks: { teamId: string; slot: Slot }[];
}

export interface CarteReveal {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  cards: { id: string; kind: string; reward: number; prompt: string; options: Option[]; solutionId: string }[];
  explain: string;
  summary: CarteSummary | null;
}

function view(c: CarteContent, ctx: PhaseCtx, flipped: boolean): CarteView {
  const deal = dealCards(
    c.cards.map((k) => k.id),
    drawSeed(ctx),
  );
  return {
    ...baseView(def, ctx),
    heading: c.title,
    flipAtMs: FLIP_MS,
    deckPrint: fingerprint(drawSeed(ctx)),
    faces: flipped
      ? SLOTS.map((slot) => {
          const k = c.cards.find((x) => x.id === deal[slot])!;
          return { slot, kind: k.kind, reward: k.reward, prompt: k.prompt, options: publicOptions(k.options, `${ctx.seed}:${k.id}`) };
        })
      : null,
  };
}

const def: MechanicDef<CarteContent, CarteSubmission> = {
  code: "tre-carte-un-destino",
  number: 74,
  manche: 5,
  title: "Tre carte, un destino",
  input: "team",
  timerSec: 70,
  oneDeviceOk: true,
  needs: [],
  rule: "Scegliete una carta coperta entro 12 secondi: poi si gira e affrontate la sua sfida. Giusta vale la ricompensa della carta.",
  contentSchema: carteContent,
  submissionSchema: carteSubmission,
  publicView: (c, ctx) => view(c, ctx, true),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const deal = dealCards(
      content.cards.map((k) => k.id),
      drawSeed(ctx),
    );
    const picks: CarteSummary["picks"] = [];
    const outcomes = scopeTeams(ctx).map((t) => {
      const s = firsts.get(t.teamId);
      if (!s) return noAnswer(t.teamId);
      picks.push({ teamId: t.teamId, slot: s.payload.slot });
      const card = content.cards.find((k) => k.id === deal[s.payload.slot])!;
      const ok = s.payload.optionId === content.solution.answers[card.id];
      return outcome(t.teamId, {
        points: ok ? card.reward : 0,
        chaos: CHAOS.partecipa + (ok ? CHAOS.centro : 0),
        correct: ok,
        accuracy: ok ? 1 : 0,
        label: `Carta ${s.payload.slot} · ${card.kind} · ${ok ? `vinta (+${card.reward})` : "persa"}`,
      });
    });
    const out: ScoreWithSummary<CarteSummary> = { outcomes, summary: { draw: drawSeed(ctx), deckPrint: fingerprint(drawSeed(ctx)), deal, picks } };
    return out;
  },
  reveal: (c, out): CarteReveal => ({
    heading: c.title,
    cards: c.cards.map((k) => ({ id: k.id, kind: k.kind, reward: k.reward, prompt: k.prompt, options: k.options, solutionId: c.solution.answers[k.id] })),
    explain: c.explain,
    summary: (out as ScoreWithSummary<CarteSummary>).summary ?? null,
  }),
};

export const treCarteUnDestino: MechanicModule<CarteContent, CarteSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, elapsedMs >= FLIP_MS),
    demoSubmissions: (c, ctx, seed) => {
      const deal = dealCards(
        c.cards.map((k) => k.id),
        drawSeed(ctx),
      );
      return demoPerTeam(
        ctx,
        seed,
        (i, rnd) => {
          const slot = SLOTS[Math.floor(rnd() * 3)];
          const card = c.cards.find((k) => k.id === deal[slot])!;
          return { slot, optionId: pickAnswer(rnd, c.solution.answers[card.id], card.options.map((o) => o.id), demoSkill(i)) };
        },
        { minMs: FLIP_MS + 6000 },
      );
    },
  },
};
