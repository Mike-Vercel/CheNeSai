import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { betLimit, capBet } from "../components/bid";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 65 · PUNTATA NASCOSTA (manche 5) — prima si vede solo la CATEGORIA e si punta (in segreto), poi arriva
 * la domanda. Giusta: +puntata; sbagliata: −puntata. Tetto: min(25% del saldo, 250), saldo mai negativo.
 *
 * Il saldo non è nel contesto del contratto: il runtime può iniettarlo nel contenuto al momento del
 * congelamento (`balances`: tavolo → saldo). Senza saldo la meccanica limita a 250 e il runtime
 * riapplica comunque il tetto sul saldo vero (i punti sono sempre e solo PROPOSTI).
 */

export const BET_WINDOW_MS = 15000;
export const BET_STEP = 10;

export const puntataContent = z
  .object({
    id: variantId,
    category: text(50),
    prompt: text(220),
    options: optionsSchema(4, 4),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
    /** iniettato dal runtime: saldo di ogni tavolo all'inizio della prova */
    balances: z.record(z.string(), z.number().min(0)).optional(),
  })
  .superRefine((c, ctx) => checkOptions(c.options, [c.solution.optionId], ctx, ["options"]));
export type PuntataContent = z.infer<typeof puntataContent>;
export type PuntataInput = z.input<typeof puntataContent>;

export const puntataSubmission = z.object({ bet: z.number().int().min(0).max(10000), optionId: idSchema });
export type PuntataSubmission = z.infer<typeof puntataSubmission>;

export interface PuntataView extends BaseView {
  category: string;
  /** la domanda: presente da subito nella vista base (la UI la mostra dopo la finestra), dopo con `publicViewAt` */
  prompt: string | null;
  options: Option[] | null;
  betWindowMs: number;
  betCap: number;
  betShare: number;
  step: number;
}

export interface PuntataMemberView {
  /** saldo noto del proprio tavolo (null se il runtime non lo ha iniettato) */
  balance: number | null;
  maxBet: number;
}

export interface PuntataReveal {
  category: string;
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
}

function view(c: PuntataContent, ctx: PhaseCtx, withQuestion: boolean): PuntataView {
  return {
    ...baseView(def, ctx),
    category: c.category,
    prompt: withQuestion ? c.prompt : null,
    options: withQuestion ? publicOptions(c.options, `${ctx.seed}:opzioni`) : null,
    betWindowMs: BET_WINDOW_MS,
    betCap: POINTS.betCap,
    betShare: POINTS.betShare,
    step: BET_STEP,
  };
}

const def: MechanicDef<PuntataContent, PuntataSubmission> = {
  code: "puntata-nascosta",
  number: 65,
  manche: 5,
  title: "Puntata nascosta",
  input: "team",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Vedete la categoria e puntate in segreto (max 25% del saldo, max 250). Poi la domanda: giusta +puntata, sbagliata −puntata.",
  contentSchema: puntataContent,
  submissionSchema: puntataSubmission,
  publicView: (c, ctx) => view(c, ctx, true),
  memberView: (c, ctx): PuntataMemberView => {
    const balance = c.balances?.[ctx.teamId] ?? null;
    return { balance, maxBet: betLimit(balance) };
  },
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const bet = capBet(s.payload.bet, content.balances?.[t.teamId]);
        const ok = s.payload.optionId === content.solution.optionId;
        return outcome(t.teamId, {
          points: ok ? bet : -bet,
          chaos: CHAOS.partecipa + (bet > 0 ? CHAOS.rischio : 0) + (ok && bet > 0 ? CHAOS.centro : 0),
          correct: ok,
          accuracy: ok ? 1 : 0,
          label: bet === 0 ? `Puntata zero · ${ok ? "giusta" : "sbagliata"}` : `Puntata ${bet} · ${ok ? `+${bet}` : `−${bet}`}`,
        });
      }),
    };
  },
  reveal: (c): PuntataReveal => ({ category: c.category, prompt: c.prompt, options: c.options, solutionId: c.solution.optionId, explain: c.explain }),
};

export const puntataNascosta: MechanicModule<PuntataContent, PuntataSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, elapsedMs >= BET_WINDOW_MS),
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(
        ctx,
        seed,
        (i, rnd) => ({ bet: [200, 80, 0, 250, 40][i % 5], optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i)) }),
        { minMs: BET_WINDOW_MS + 4000 },
      ),
  },
};
