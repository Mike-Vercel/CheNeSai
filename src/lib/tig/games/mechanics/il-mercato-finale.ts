import { z } from "zod";
import type { MechanicDef } from "../contract";
import { betLimit } from "../components/bid";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { balanceOf, balancesSchema, difficultySchema } from "./m5-shared";

/**
 * 75 · IL MERCATO FINALE (manche 5) — un enigma finale e un banco con tre indizi a prezzo diverso
 * (al massimo 50 punti). Ogni tavolo può comprarne UNO solo (o nessuno), poi risponde.
 * Giusta: +120 meno il prezzo pagato; sbagliata: −prezzo. Il prezzo si paga comunque (costo dichiarato).
 * Il saldo non va mai sotto zero e non si spende più del 25% del saldo: gli indizi troppo cari per il proprio
 * saldo sono bloccati (saldo iniettato dal runtime; senza saldo vale il prezzo pieno, il runtime riapplica i tetti).
 *
 * Nota onesta: l'acquisto viaggia con l'unico invio della squadra (il contratto non ha una seconda richiesta),
 * quindi il testo degli indizi è nella vista e il telefono lo mostra solo dopo l'acquisto, che blocca subito.
 */

export const PRIZE = 120;
export const MAX_PRICE = 50;

const hintSchema = z.object({
  id: idSchema,
  price: z.number().int().min(5).max(MAX_PRICE),
  /** cosa si compra, visibile a tutti prima dell'acquisto */
  label: text(48),
  /** l'indizio vero e proprio, mostrato a chi lo compra */
  text: text(220),
});

export const mercatoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema.optional(),
    title: text(60),
    prompt: text(260),
    options: optionsSchema(4, 4),
    hints: z.array(hintSchema).length(3),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
    balances: balancesSchema,
  })
  .superRefine((c, ctx) => {
    checkOptions(c.options, [c.solution.optionId], ctx, ["options"]);
    if (new Set(c.hints.map((h) => h.id)).size !== 3) ctx.addIssue({ code: "custom", message: "id degli indizi duplicati" });
    if (new Set(c.hints.map((h) => h.price)).size !== 3) ctx.addIssue({ code: "custom", message: "tre prezzi diversi" });
  });
export type MercatoContent = z.infer<typeof mercatoContent>;
export type MercatoInput = z.input<typeof mercatoContent>;

export const mercatoSubmission = z.object({ buy: idSchema.nullable(), optionId: idSchema });
export type MercatoSubmission = z.infer<typeof mercatoSubmission>;

export interface MercatoView extends BaseView {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  prompt: string;
  options: Option[];
  /** banco: dal più economico al più caro */
  hints: { id: string; price: number; label: string; text: string }[];
  prize: number;
  maxPrice: number;
}

export interface MercatoMemberView {
  balance: number | null;
  /** spesa massima consentita (25% del saldo, mai oltre 50) */
  maxSpend: number;
}

export interface MercatoSummary {
  /** acquisti per tavolo (null = nessun acquisto) */
  buys: { teamId: string; hintId: string | null; paid: number }[];
}

export interface MercatoReveal {
  /** titolo della variante (il titolo della meccanica resta `title`) */
  heading: string;
  prompt: string;
  options: Option[];
  solutionId: string;
  hints: { id: string; price: number; label: string; text: string }[];
  explain: string;
  summary: MercatoSummary | null;
}

/** Prezzo effettivo: un indizio oltre la spesa consentita costa comunque quanto si può spendere. */
export function pricePaid(price: number, balance: number | null): number {
  return balance === null ? price : Math.min(price, betLimit(balance));
}

const sortedHints = (c: MercatoContent) => c.hints.slice().sort((a, b) => a.price - b.price);

const def: MechanicDef<MercatoContent, MercatoSubmission> = {
  code: "il-mercato-finale",
  number: 75,
  manche: 5,
  title: "Il mercato finale",
  input: "team",
  timerSec: 45,
  oneDeviceOk: true,
  needs: [],
  rule: "Potete comprare UN indizio (massimo 50 punti) prima di rispondere. Giusta +120 meno la spesa; sbagliata: perdete la spesa.",
  contentSchema: mercatoContent,
  submissionSchema: mercatoSubmission,
  publicView: (c, ctx): MercatoView => ({
    ...baseView(def, ctx),
    heading: c.title,
    prompt: c.prompt,
    options: publicOptions(c.options, `${ctx.seed}:opzioni`),
    hints: sortedHints(c).map((h) => ({ id: h.id, price: h.price, label: h.label, text: h.text })),
    prize: PRIZE,
    maxPrice: MAX_PRICE,
  }),
  memberView: (c, ctx): MercatoMemberView => {
    const balance = balanceOf(c.balances, ctx.teamId);
    return { balance, maxSpend: balance === null ? MAX_PRICE : Math.min(MAX_PRICE, betLimit(balance)) };
  },
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const buys: MercatoSummary["buys"] = [];
    const outcomes = scopeTeams(ctx).map((t) => {
      const s = firsts.get(t.teamId);
      if (!s) return noAnswer(t.teamId);
      const hint = s.payload.buy ? content.hints.find((h) => h.id === s.payload.buy) : undefined;
      const paid = hint ? pricePaid(hint.price, balanceOf(content.balances, t.teamId)) : 0;
      buys.push({ teamId: t.teamId, hintId: hint?.id ?? null, paid });
      const ok = s.payload.optionId === content.solution.optionId;
      return outcome(t.teamId, {
        points: (ok ? PRIZE : 0) - paid,
        chaos: CHAOS.partecipa + (hint ? CHAOS.rischio : 0) + (ok ? CHAOS.centro : 0),
        correct: ok,
        accuracy: ok ? 1 : 0,
        label: `${hint ? `Indizio da ${paid}` : "Nessun acquisto"} · ${ok ? `giusta: +${PRIZE - paid}` : paid ? `sbagliata: −${paid}` : "sbagliata"}`,
      });
    });
    const out: ScoreWithSummary<MercatoSummary> = { outcomes, summary: { buys } };
    return out;
  },
  reveal: (c, out): MercatoReveal => ({
    heading: c.title,
    prompt: c.prompt,
    options: c.options,
    solutionId: c.solution.optionId,
    hints: sortedHints(c),
    explain: c.explain,
    summary: (out as ScoreWithSummary<MercatoSummary>).summary ?? null,
  }),
};

export const ilMercatoFinale: MechanicModule<MercatoContent, MercatoSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => {
      const hints = sortedHints(c);
      return demoPerTeam(ctx, seed, (i, rnd) => {
        const buy = [hints[2], hints[0], null, hints[1]][i % 4];
        return { buy: buy?.id ?? null, optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), Math.min(0.95, demoSkill(i) + (buy ? buy.price / 100 : 0))) };
      });
    },
  },
};
