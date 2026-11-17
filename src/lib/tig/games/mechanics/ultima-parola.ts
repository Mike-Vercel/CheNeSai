import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { durationOf, firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { difficultySchema } from "./m2/shared";

/**
 * 32 · ULTIMA PAROLA (manche 2) — una frase-indovinello compare un pezzo alla volta e manca l'ULTIMA parola: va
 * scelta tra quattro. I pezzi continuano ad arrivare mentre il capitano decide quando bloccare: prima si blocca,
 * più vale (120 col primo pezzo, poi giù a passi uguali fino a 40 con la frase intera). Sbagliata: 0.
 * Il pezzo «visto» lo decide l'orario del SERVER all'invio; con `publicViewAt` i pezzi futuri non partono.
 * I pezzi si aprono nei primi tre quarti della prova, qualunque sia la sua durata.
 */

export const TOP = 120;
export const BOTTOM = 40;

export const parolaContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** la frase a pezzi, SENZA l'ultima parola (che è la risposta) */
    chunks: z.array(text(90)).min(5).max(8),
    options: optionsSchema(4, 4),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [c.solution.optionId], ctx, ["options"]));
export type ParolaContent = z.infer<typeof parolaContent>;
export type ParolaInput = z.input<typeof parolaContent>;

export const parolaSubmission = z.object({ optionId: idSchema });
export type ParolaSubmission = z.infer<typeof parolaSubmission>;

export interface ParolaView extends BaseView {
  /** pezzi aperti (null = non ancora) */
  chunks: (string | null)[];
  /** orari di apertura (ms dall'inizio) */
  schedule: number[];
  /** valore della risposta giusta con k pezzi aperti (indice k − 1) */
  worth: number[];
  options: Option[];
}

export interface ParolaReveal {
  chunks: string[];
  options: Option[];
  solutionId: string;
  explain: string;
}

export function scheduleFor(n: number, durationMs: number): number[] {
  const step = Math.floor((durationMs * 0.75) / Math.max(1, n - 1));
  return Array.from({ length: n }, (_, i) => i * step);
}

export function worthFor(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (n <= 1 ? TOP : Math.round((TOP - ((TOP - BOTTOM) * i) / (n - 1)) / 5) * 5));
}

/** Quanti pezzi sono aperti all'istante (almeno uno). */
export function openAt(schedule: readonly number[], elapsedMs: number): number {
  let k = 1;
  schedule.forEach((at, i) => {
    if (elapsedMs >= at) k = i + 1;
  });
  return k;
}

function durOf(ctx: PhaseCtx): number {
  return durationOf(ctx) || def.timerSec * 1000;
}

function view(c: ParolaContent, ctx: PhaseCtx, open: number): ParolaView {
  return {
    ...baseView(def, ctx),
    chunks: c.chunks.map((ch, i) => (i < open ? ch : null)),
    schedule: scheduleFor(c.chunks.length, durOf(ctx)),
    worth: worthFor(c.chunks.length),
    options: publicOptions(c.options, `${ctx.seed}:opzioni`),
  };
}

const def: MechanicDef<ParolaContent, ParolaSubmission> = {
  code: "ultima-parola",
  number: 32,
  manche: 2,
  title: "Ultima parola",
  input: "team",
  timerSec: 45,
  oneDeviceOk: true,
  needs: [],
  rule: "La frase arriva un pezzo alla volta: indovinate la parola che manca alla fine. Prima bloccate, più vale: da 120 a 40.",
  contentSchema: parolaContent,
  submissionSchema: parolaSubmission,
  publicView: (c, ctx) => view(c, ctx, c.chunks.length),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const schedule = scheduleFor(content.chunks.length, durOf(ctx));
    const worth = worthFor(content.chunks.length);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const k = openAt(schedule, s.elapsedMs);
        const ok = s.payload.optionId === content.solution.optionId;
        const pts = ok ? worth[k - 1] : 0;
        return outcome(t.teamId, {
          points: pts,
          chaos: CHAOS.partecipa + (ok && k <= Math.ceil(content.chunks.length / 2) ? CHAOS.rischio : 0) + (ok ? CHAOS.centro : 0),
          correct: ok,
          accuracy: pts / TOP,
          label: `${ok ? "Esatta" : "Sbagliata"}, bloccata con ${k} pezz${k === 1 ? "o" : "i"} su ${content.chunks.length}`,
        });
      }),
    };
  },
  reveal: (c): ParolaReveal => ({ chunks: c.chunks, options: c.options, solutionId: c.solution.optionId, explain: c.explain }),
};

export const ultimaParola: MechanicModule<ParolaContent, ParolaSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, openAt(scheduleFor(c.chunks.length, durOf(ctx)), elapsedMs)),
    demoSubmissions: (c, ctx, seed) => {
      const dur = durOf(ctx);
      const subs = demoPerTeam(ctx, seed, (i, rnd) => ({ optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i) + 0.1) }));
      return subs.map((s, i) => ({ ...s, elapsedMs: Math.round(dur * [0.3, 0.6, 0.85, 0.45, 0.2][i % 5]) }));
    },
  },
};
