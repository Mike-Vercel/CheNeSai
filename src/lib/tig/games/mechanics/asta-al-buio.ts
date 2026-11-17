import { z } from "zod";
import type { MechanicDef } from "../contract";
import { resolveSealedBid } from "../components/bid";
import { CHAOS, outcome, noAnswer } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, type BaseView, type MechanicModule, type ScoreWithSummary } from "../extras";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 23 · ASTA AL BUIO (manche 2) — all'asta una BUSTA CHIUSA con un bonus di punti; gli indizi dicono
 * più o meno quanto vale. Offerte sigillate (multipli di 5, fino al tetto). Vince l'offerta più alta e
 * paga SOLO il vincitore: incassa il valore della busta meno l'offerta (può anche rimetterci, al massimo 40).
 * Parità: chi ha offerto prima (tempo del server), poi il tavolo col numero più basso.
 */

export const BID_STEP = 5;
/** perdita massima possibile per il vincitore (valore minimo della busta vs tetto) */
export const MAX_LOSS = 40;

export const astaContent = z
  .object({
    id: variantId,
    /** nome del lotto, es. «La busta del bancone» */
    lot: text(60),
    /** 2–3 indizi sul valore (devono restringere senza svelare) */
    hints: z.array(text(110)).min(2).max(3),
    /** offerta massima ammessa */
    cap: z.number().int().min(30).max(100).refine((v) => v % BID_STEP === 0, "multiplo di 5"),
    solution: z.object({ value: z.number().int().min(20).max(160) }),
    explain: explainSchema,
  })
  .refine((c) => c.cap - c.solution.value <= MAX_LOSS, `il vincitore non può perdere più di ${MAX_LOSS}`);
export type AstaContent = z.infer<typeof astaContent>;
export type AstaInput = z.input<typeof astaContent>;

export const astaSubmission = z.object({ amount: z.number().int().min(0).max(1000) });
export type AstaSubmission = z.infer<typeof astaSubmission>;

export interface AstaView extends BaseView {
  lot: string;
  hints: string[];
  cap: number;
  step: number;
}

export interface AstaSummary {
  winner: string | null;
  winningBid: number;
  /** offerte svelate a fine prova (tavolo → offerta valida) */
  bids: { teamId: string; amount: number }[];
}

export interface AstaReveal {
  lot: string;
  hints: string[];
  worth: number;
  explain: string;
  summary: AstaSummary | null;
}

/** Offerta valida: tra 0 e il tetto, arrotondata per difetto al multiplo di 5. */
export function normalizeBid(amount: number, cap: number): number {
  return Math.max(0, Math.min(cap, Math.floor(amount / BID_STEP) * BID_STEP));
}

const def: MechanicDef<AstaContent, AstaSubmission> = {
  code: "asta-al-buio",
  number: 23,
  manche: 2,
  title: "Asta al buio",
  input: "team",
  timerSec: 45,
  oneDeviceOk: true,
  needs: [],
  rule: "Offerta segreta per la busta chiusa. Vince la più alta e paga solo chi vince: incassa la busta meno l'offerta.",
  contentSchema: astaContent,
  submissionSchema: astaSubmission,
  publicView: (c, ctx): AstaView => ({ ...baseView(def, ctx), lot: c.lot, hints: c.hints, cap: c.cap, step: BID_STEP }),
  score: ({ content, ctx, submissions }) => {
    const teams = scopeTeams(ctx);
    const firsts = firstPerTeam(submissions, ctx);
    const bids = teams
      .filter((t) => firsts.has(t.teamId))
      .map((t) => {
        const s = firsts.get(t.teamId)!;
        return { teamId: t.teamId, tableNo: t.tableNo, amount: normalizeBid(s.payload.amount, content.cap), elapsedMs: s.elapsedMs };
      });
    const win = resolveSealedBid(bids);
    const worth = content.solution.value;
    const summary: AstaSummary = { winner: win?.teamId ?? null, winningBid: win?.amount ?? 0, bids: bids.map((b) => ({ teamId: b.teamId, amount: b.amount })) };
    const out: ScoreWithSummary<AstaSummary> = {
      outcomes: teams.map((t) => {
        const b = bids.find((x) => x.teamId === t.teamId);
        if (!b) return noAnswer(t.teamId, "Nessuna offerta");
        if (win && win.teamId === t.teamId) {
          const net = worth - b.amount;
          return outcome(t.teamId, {
            points: net,
            chaos: CHAOS.partecipa + CHAOS.rischio + (net > 0 ? CHAOS.centro : 0),
            correct: net >= 0,
            accuracy: null,
            label: `Busta vinta a ${b.amount}: valeva ${worth} (${net >= 0 ? "+" : ""}${net})`,
          });
        }
        return outcome(t.teamId, {
          points: 0,
          chaos: b.amount > 0 ? CHAOS.partecipa : 0,
          correct: null,
          accuracy: null,
          label: b.amount > 0 ? `Offerta ${b.amount}: superata` : "Avete passato",
        });
      }),
      summary,
    };
    return out;
  },
  reveal: (c, out): AstaReveal => ({
    lot: c.lot,
    hints: c.hints,
    worth: c.solution.value,
    explain: c.explain,
    summary: (out as ScoreWithSummary<AstaSummary>).summary ?? null,
  }),
};

export const astaAlBuio: MechanicModule<AstaContent, AstaSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => demoPerTeam(ctx, seed, (i) => ({ amount: normalizeBid(c.cap * [0.55, 0.8, 0.3, 1, 0][i % 5], c.cap) })),
  },
};
