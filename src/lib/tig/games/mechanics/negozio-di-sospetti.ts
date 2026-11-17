import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { checkEliminations, difficultySchema, isBuyer, remainingAfter } from "./_m4";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 61 · NEGOZIO DI SOSPETTI (manche 4) — un mistero inventato con 5 sospettati e un «negozio» di 3 prove,
 * ognuna col suo prezzo (5–35 punti, visibile prima). Il capitano compra le prove che vuole; la risposta
 * giusta vale 100 meno quanto speso (punto massimo ridotto in proporzione alla spesa), mai sotto zero; la
 * sbagliata 0, senza costi. Il costo si toglie solo dal premio: nessun saldo negativo.
 * Tutte e tre le prove insieme lasciano un solo sospettato (verificato dallo schema); a volte basta una
 * coppia più economica, a volte una prova cara da sola: capirlo è metà del gioco. Il reveal mostra la spesa
 * minima per essere sicuri.
 */

export const SHOP_SIZE = 3;

const proofSchema = z.object({
  id: idSchema,
  name: text(40),
  price: z.number().int().min(5).max(35).multipleOf(5),
  text: text(180),
  clears: z.array(idSchema).min(1).max(5),
});

export const negozioContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    caseTitle: text(70),
    question: text(110),
    /** il fatto di partenza (non scagiona nessuno) */
    intro: text(200),
    suspects: optionsSchema(5, 5),
    proofs: z.array(proofSchema).length(SHOP_SIZE),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkOptions(c.suspects, [c.solution.optionId], ctx, ["suspects"]);
    const ids = c.suspects.map((s) => s.id);
    checkEliminations(
      ids,
      c.solution.optionId,
      c.proofs.map((p) => p.clears),
      ctx,
      ["proofs"],
    );
    if (new Set(c.proofs.map((p) => p.id)).size !== SHOP_SIZE) ctx.addIssue({ code: "custom", message: "id delle prove duplicati" });
    const end = remainingAfter(
      ids,
      c.proofs.map((p) => p.clears),
    );
    if (end.length !== 1 || end[0] !== c.solution.optionId) ctx.addIssue({ code: "custom", message: `con tutte le prove restano ${JSON.stringify(end)}` });
    if (c.proofs.reduce((s, p) => s + p.price, 0) > 60) ctx.addIssue({ code: "custom", message: "il negozio costa troppo (max 60 in tutto)" });
  });
export type NegozioContent = z.infer<typeof negozioContent>;
export type NegozioInput = z.input<typeof negozioContent>;

export const negozioSubmission = z.object({ optionId: idSchema, bought: z.array(idSchema).max(SHOP_SIZE) });
export type NegozioSubmission = z.infer<typeof negozioSubmission>;

export interface ShopItem {
  id: string;
  name: string;
  price: number;
}

export interface NegozioView extends BaseView {
  caseTitle: string;
  question: string;
  intro: string;
  suspects: Option[];
  shop: ShopItem[];
  /** premio pieno senza acquisti */
  prize: number;
  instance: string;
}

export interface NegozioMemberView {
  buyer: boolean;
  /** contenuto delle prove (solo al telefono che compra; sigillate finché non si comprano) */
  proofs: { id: string; text: string }[] | null;
}

export interface NegozioSummary {
  /** quanto ha speso ogni tavolo che ha risposto */
  spent: { teamId: string; cost: number }[];
}

export interface NegozioReveal {
  caseTitle: string;
  question: string;
  suspects: Option[];
  proofs: (ShopItem & { text: string; clears: string[] })[];
  /** spesa minima per essere sicuri */
  cheapest: { ids: string[]; cost: number };
  solutionId: string;
  explain: string;
  summary: NegozioSummary | null;
}

/** Prove valide (del negozio, senza doppioni) e costo. */
export function purchase(c: NegozioContent, bought: readonly string[]): { ids: string[]; cost: number } {
  const ids = [...new Set(bought)].filter((id) => c.proofs.some((p) => p.id === id));
  return { ids, cost: ids.reduce((s, id) => s + (c.proofs.find((p) => p.id === id)?.price ?? 0), 0) };
}

/** Insieme di prove più economico che lascia un solo sospettato (a parità, meno prove). */
export function cheapestSure(c: NegozioContent): { ids: string[]; cost: number } {
  const ids = c.suspects.map((s) => s.id);
  let best: { ids: string[]; cost: number } | null = null;
  for (let mask = 1; mask < 1 << c.proofs.length; mask++) {
    const set = c.proofs.filter((_, i) => mask & (1 << i));
    if (remainingAfter(
      ids,
      set.map((p) => p.clears),
    ).length !== 1) continue;
    const cost = set.reduce((s, p) => s + p.price, 0);
    if (!best || cost < best.cost || (cost === best.cost && set.length < best.ids.length)) best = { ids: set.map((p) => p.id), cost };
  }
  return best ?? { ids: c.proofs.map((p) => p.id), cost: c.proofs.reduce((s, p) => s + p.price, 0) };
}

const def: MechanicDef<NegozioContent, NegozioSubmission> = {
  code: "negozio-di-sospetti",
  number: 61,
  manche: 4,
  title: "Negozio di sospetti",
  input: "team",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Tre prove in vendita, ognuna col suo prezzo. La risposta giusta vale 100 meno quanto spendete; sbagliata 0, mai in negativo.",
  contentSchema: negozioContent,
  submissionSchema: negozioSubmission,
  publicView: (c, ctx): NegozioView => ({
    ...baseView(def, ctx),
    caseTitle: c.caseTitle,
    question: c.question,
    intro: c.intro,
    suspects: publicOptions(c.suspects, `${ctx.seed}:sospettati`),
    shop: c.proofs.map((p) => ({ id: p.id, name: p.name, price: p.price })),
    prize: POINTS.standard,
    instance: `${ctx.gameInstanceId}:${ctx.startsAt}`,
  }),
  memberView: (c, ctx): NegozioMemberView => {
    const buyer = isBuyer(ctx);
    return { buyer, proofs: buyer ? c.proofs.map((p) => ({ id: p.id, text: p.text })) : null };
  },
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const summary: NegozioSummary = { spent: [] };
    const out: ScoreWithSummary<NegozioSummary> = {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const { ids, cost } = purchase(content, s.payload.bought);
        summary.spent.push({ teamId: t.teamId, cost });
        const ok = s.payload.optionId === content.solution.optionId;
        const pts = ok ? Math.max(0, POINTS.standard - cost) : 0;
        return outcome(t.teamId, {
          points: pts,
          chaos: CHAOS.partecipa + (ok ? CHAOS.centro : 0) + (ok && ids.length <= 1 ? CHAOS.rischio : 0),
          correct: ok,
          accuracy: pts / POINTS.standard,
          label: ok ? (cost ? `Esatto · spesi ${cost} punti` : "Esatto senza spendere") : `Sbagliato${cost ? " · la spesa non conta" : ""}`,
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): NegozioReveal => ({
    caseTitle: c.caseTitle,
    question: c.question,
    suspects: c.suspects,
    proofs: c.proofs.map((p) => ({ id: p.id, name: p.name, price: p.price, text: p.text, clears: p.clears })),
    cheapest: cheapestSure(c),
    solutionId: c.solution.optionId,
    explain: c.explain,
    summary: (out as ScoreWithSummary<NegozioSummary>).summary ?? null,
  }),
};

export const negozioDiSospetti: MechanicModule<NegozioContent, NegozioSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => {
        const bought = i === 0 ? cheapestSure(c).ids : i === 1 ? c.proofs.map((p) => p.id) : c.proofs.slice(0, 1).map((p) => p.id);
        const sure = remainingAfter(
          c.suspects.map((s) => s.id),
          c.proofs.filter((p) => bought.includes(p.id)).map((p) => p.clears),
        ).length === 1;
        return { bought, optionId: pickAnswer(rnd, c.solution.optionId, c.suspects.map((o) => o.id), sure ? 0.97 : demoSkill(i) - 0.2) };
      }),
  },
};
