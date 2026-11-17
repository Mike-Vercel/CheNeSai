import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { clueIndexAt, clueSchedule } from "../components/clues";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { checkEliminations, difficultySchema, remainingAfter } from "./_m4";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 64 · ULTIMO INDIZIO (manche 4) — un caso inventato con 5–6 sospettati. Ogni 15 secondi si apre un indizio
 * (4 in tutto) che ne scagiona qualcuno; solo con l'ULTIMO ne resta uno. La squadra blocca quando vuole:
 * giusta al 1° indizio 100, al 2° 80, al 3° 60, al 4° 40 (il punteggio scende per ogni indizio usato).
 * L'indizio «usato» lo decide l'orario del SERVER al blocco; gli indizi futuri non partono verso i telefoni.
 * Ogni caso si valida da solo: i sospettati rimasti calano a ogni indizio e alla fine resta la soluzione.
 */

export const ULTIMO_STEP_MS = 15000;
export const ULTIMO_CLUES = 4;
export const ULTIMO_POINTS = [100, 80, 60, 40] as const;

const clueSchema = z.object({
  text: text(150),
  /** sospettati che questo indizio scagiona (per la validazione e il reveal; mai nella vista pubblica) */
  clears: z.array(idSchema).min(1).max(4),
});

export const ultimoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    /** il caso, es. «La torta sparita dalla sala riunioni» */
    caseTitle: text(70),
    question: text(110),
    suspects: optionsSchema(5, 6),
    clues: z.array(clueSchema).length(ULTIMO_CLUES),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkOptions(c.suspects, [c.solution.optionId], ctx, ["suspects"]);
    const ids = c.suspects.map((s) => s.id);
    checkEliminations(
      ids,
      c.solution.optionId,
      c.clues.map((k) => k.clears),
      ctx,
      ["clues"],
    );
    let prev = ids.length;
    c.clues.forEach((_, i) => {
      const left = remainingAfter(
        ids,
        c.clues.slice(0, i + 1).map((k) => k.clears),
      ).length;
      if (left >= prev) ctx.addIssue({ code: "custom", message: `l'indizio ${i + 1} non scagiona nessuno di nuovo`, path: ["clues", i] });
      prev = left;
    });
    const end = remainingAfter(
      ids,
      c.clues.map((k) => k.clears),
    );
    if (end.length !== 1 || end[0] !== c.solution.optionId) ctx.addIssue({ code: "custom", message: `dopo l'ultimo indizio restano ${JSON.stringify(end)}` });
    const afterFirst = remainingAfter(ids, [c.clues[0].clears]).length;
    if (afterFirst < 3) ctx.addIssue({ code: "custom", message: "il primo indizio scagiona troppo (restano meno di 3 sospettati)" });
  });
export type UltimoContent = z.infer<typeof ultimoContent>;
export type UltimoInput = z.input<typeof ultimoContent>;

export const ultimoSubmission = z.object({ optionId: idSchema });
export type UltimoSubmission = z.infer<typeof ultimoSubmission>;

export interface UltimoView extends BaseView {
  caseTitle: string;
  question: string;
  /** orari di apertura degli indizi (ms dall'inizio) */
  schedule: number[];
  /** quanto vale una risposta giusta bloccata con 1, 2, 3, 4 indizi aperti */
  worth: number[];
  /** testi degli indizi già apribili (null = non ancora aperto: con `publicViewAt` non parte proprio) */
  clues: (string | null)[];
  suspects: Option[];
}

export interface UltimoReveal {
  caseTitle: string;
  question: string;
  clues: { text: string; clears: string[] }[];
  suspects: Option[];
  solutionId: string;
  explain: string;
}

const schedule = clueSchedule(ULTIMO_CLUES, ULTIMO_STEP_MS);

function view(c: UltimoContent, ctx: PhaseCtx, openUpTo: number): UltimoView {
  return {
    ...baseView(def, ctx),
    caseTitle: c.caseTitle,
    question: c.question,
    schedule,
    worth: [...ULTIMO_POINTS],
    clues: c.clues.map((k, i) => (i <= openUpTo ? k.text : null)),
    suspects: publicOptions(c.suspects, `${ctx.seed}:sospettati`),
  };
}

const def: MechanicDef<UltimoContent, UltimoSubmission> = {
  code: "ultimo-indizio",
  number: 64,
  manche: 4,
  title: "Ultimo indizio",
  input: "team",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Un indizio ogni 15 secondi scagiona qualcuno. Bloccate quando volete: con 1 indizio vale 100, poi 80, 60, 40.",
  contentSchema: ultimoContent,
  submissionSchema: ultimoSubmission,
  publicView: (c, ctx) => view(c, ctx, ULTIMO_CLUES - 1),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const idx = clueIndexAt(s.elapsedMs, schedule);
        const ok = s.payload.optionId === content.solution.optionId;
        const pts = ok ? ULTIMO_POINTS[Math.min(idx, ULTIMO_POINTS.length - 1)] : 0;
        return outcome(t.teamId, {
          points: pts,
          chaos: CHAOS.partecipa + (ok ? CHAOS.centro : 0) + (idx <= 1 ? CHAOS.rischio : 0),
          correct: ok,
          accuracy: pts / 100,
          label: ok ? `Esatto con ${idx + 1} indizi${idx + 1 === 1 ? "o" : ""}` : `Sbagliato con ${idx + 1} indizi${idx + 1 === 1 ? "o" : ""}`,
        });
      }),
    };
  },
  reveal: (c): UltimoReveal => ({
    caseTitle: c.caseTitle,
    question: c.question,
    clues: c.clues.map((k) => ({ text: k.text, clears: k.clears })),
    suspects: c.suspects,
    solutionId: c.solution.optionId,
    explain: c.explain,
  }),
};

export const ultimoIndizio: MechanicModule<UltimoContent, UltimoSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, clueIndexAt(elapsedMs, schedule)),
    demoSubmissions: (c, ctx, seed) => {
      const subs = demoPerTeam(ctx, seed, (i, rnd) => ({ optionId: pickAnswer(rnd, c.solution.optionId, c.suspects.map((o) => o.id), demoSkill(i) - 0.1) }));
      return subs.map((s, i) => ({ ...s, elapsedMs: [47000, 18000, 33000, 9000, 52000][i % 5] }));
    },
  },
};
