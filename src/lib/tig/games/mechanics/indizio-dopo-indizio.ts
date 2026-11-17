import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { clueIndexAt, cluePoints, clueSchedule } from "../components/clues";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 15 · INDIZIO DOPO INDIZIO (manche 1) — tre indizi si aprono ogni 15 secondi; sei risposte possibili
 * sempre visibili. La squadra blocca quando vuole: giusta al 1° indizio 100, al 2° 70, al 3° 40.
 * L'indizio «usato» lo decide l'orario del SERVER al momento del blocco, non il telefono.
 */

export const CLUE_STEP_MS = 15000;
export const CLUE_COUNT = 3;

export const indizioContent = z
  .object({
    id: variantId,
    /** cosa si indovina, es. «Un oggetto di casa» */
    category: text(40),
    clues: z.array(text(120)).length(CLUE_COUNT),
    options: optionsSchema(6, 6),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [c.solution.optionId], ctx, ["options"]));
export type IndizioContent = z.infer<typeof indizioContent>;
export type IndizioInput = z.input<typeof indizioContent>;

export const indizioSubmission = z.object({ optionId: idSchema });
export type IndizioSubmission = z.infer<typeof indizioSubmission>;

export interface IndizioView extends BaseView {
  category: string;
  /** orari di apertura degli indizi (ms dall'inizio) */
  schedule: number[];
  /** indizi già apribili: tutti nella vista base (la UI li mostra all'orario), solo quelli aperti con `publicViewAt` */
  clues: (string | null)[];
  options: Option[];
}

export interface IndizioReveal {
  category: string;
  clues: string[];
  options: Option[];
  solutionId: string;
  explain: string;
}

const schedule = clueSchedule(CLUE_COUNT, CLUE_STEP_MS);

function view(c: IndizioContent, ctx: PhaseCtx, openUpTo: number): IndizioView {
  return {
    ...baseView(def, ctx),
    category: c.category,
    schedule,
    clues: c.clues.map((cl, i) => (i <= openUpTo ? cl : null)),
    options: publicOptions(c.options, `${ctx.seed}:opzioni`),
  };
}

const def: MechanicDef<IndizioContent, IndizioSubmission> = {
  code: "indizio-dopo-indizio",
  number: 15,
  manche: 1,
  title: "Indizio dopo indizio",
  input: "team",
  timerSec: 45,
  oneDeviceOk: true,
  needs: [],
  rule: "Tre indizi, uno ogni 15 secondi. Bloccate la risposta quando volete: al 1° vale 100, al 2° 70, al 3° 40.",
  contentSchema: indizioContent,
  submissionSchema: indizioSubmission,
  publicView: (c, ctx) => view(c, ctx, CLUE_COUNT - 1),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const idx = clueIndexAt(s.elapsedMs, schedule);
        const ok = s.payload.optionId === content.solution.optionId;
        const pts = ok ? cluePoints(idx) : 0;
        return outcome(t.teamId, {
          points: pts,
          chaos: CHAOS.partecipa + (ok && idx === 0 ? CHAOS.centro : 0),
          correct: ok,
          accuracy: pts / 100,
          label: ok ? `Esatto al ${idx + 1}° indizio` : `Sbagliato al ${idx + 1}° indizio`,
        });
      }),
    };
  },
  reveal: (c): IndizioReveal => ({ category: c.category, clues: c.clues, options: c.options, solutionId: c.solution.optionId, explain: c.explain }),
};

export const indizioDopoIndizio: MechanicModule<IndizioContent, IndizioSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, clueIndexAt(elapsedMs, schedule)),
    demoSubmissions: (c, ctx, seed) => {
      const subs = demoPerTeam(ctx, seed, (i, rnd) => ({ optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i)) }));
      return subs.map((s, i) => ({ ...s, elapsedMs: [9000, 22000, 38000, 31000, 12000][i % 5] }));
    },
  },
};
