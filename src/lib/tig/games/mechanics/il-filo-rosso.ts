import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { CHAOS, noAnswer, outcome } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { difficultySchema } from "./m5-shared";

/**
 * 76 · IL FILO ROSSO (manche 5) — un caso finale e tre indizi «raccolti nelle manche precedenti».
 * Versione autocontenuta: il motore non porta oggetti da una prova all'altra, quindi i tre indizi sono
 * RIEPILOGATI all'inizio della prova (come se fossero stati raccolti prima) e restano sempre visibili, anche a
 * chi si riconnette. La soluzione si COMPONE di tre tessere (es. chi / dove / con cosa): ogni tessera richiede
 * di incrociare gli indizi. +30 per tessera giusta, +60 se il filo è completo (massimo 150).
 */

export const PER_SLOT = 30;
export const THREAD_BONUS = 60;

const clueSchema = z.object({
  /** provenienza dichiarata, es. «Manche 2 · Fregali tutti!» */
  from: text(40),
  text: text(220),
});

const slotSchema = z.object({ id: idSchema, label: text(20), options: optionsSchema(4, 4) });

export const filoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema.optional(),
    title: text(60),
    /** l'enigma finale */
    intro: text(280),
    clues: z.array(clueSchema).length(3),
    slots: z.array(slotSchema).length(3),
    solution: z.object({ answers: z.record(z.string(), idSchema) }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    if (new Set(c.slots.map((s) => s.id)).size !== 3) ctx.addIssue({ code: "custom", message: "id delle tessere duplicati" });
    c.slots.forEach((s, i) => {
      const sol = c.solution.answers[s.id];
      if (!sol) ctx.addIssue({ code: "custom", message: `manca la soluzione di ${s.id}` });
      else checkOptions(s.options, [sol], ctx, ["slots", i]);
    });
  });
export type FiloContent = z.infer<typeof filoContent>;
export type FiloInput = z.input<typeof filoContent>;

export const filoSubmission = z.object({ answers: z.record(z.string(), idSchema) });
export type FiloSubmission = z.infer<typeof filoSubmission>;

export interface FiloView extends BaseView {
  title: string;
  intro: string;
  clues: { n: number; from: string; text: string }[];
  slots: { id: string; label: string; options: Option[] }[];
  perSlot: number;
  threadBonus: number;
}

export interface FiloReveal {
  title: string;
  clues: FiloView["clues"];
  slots: { id: string; label: string; options: Option[]; solutionId: string }[];
  explain: string;
}

export function filoPoints(right: number): number {
  return right * PER_SLOT + (right === 3 ? THREAD_BONUS : 0);
}

const def: MechanicDef<FiloContent, FiloSubmission> = {
  code: "il-filo-rosso",
  number: 76,
  manche: 5,
  title: "Il filo rosso",
  input: "team",
  timerSec: 75,
  oneDeviceOk: true,
  needs: [],
  rule: "Tre indizi raccolti nella serata convergono nel caso finale. Componete la soluzione: +30 a tessera, +60 se il filo è completo.",
  contentSchema: filoContent,
  submissionSchema: filoSubmission,
  publicView: (c, ctx): FiloView => ({
    ...baseView(def, ctx),
    title: c.title,
    intro: c.intro,
    clues: c.clues.map((k, i) => ({ n: i + 1, from: k.from, text: k.text })),
    slots: c.slots.map((s) => ({ id: s.id, label: s.label, options: publicOptions(s.options, `${ctx.seed}:${s.id}`) })),
    perSlot: PER_SLOT,
    threadBonus: THREAD_BONUS,
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const right = content.slots.filter((x) => s.payload.answers[x.id] === content.solution.answers[x.id]).length;
        const all = right === 3;
        return outcome(t.teamId, {
          points: filoPoints(right),
          chaos: CHAOS.partecipa + (all ? CHAOS.centro : 0),
          correct: all,
          accuracy: right / 3,
          label: all ? "Filo completo: 3 tessere su 3" : `${right} tessere su 3`,
        });
      }),
    };
  },
  reveal: (c): FiloReveal => ({
    title: c.title,
    clues: c.clues.map((k, i) => ({ n: i + 1, from: k.from, text: k.text })),
    slots: c.slots.map((s) => ({ id: s.id, label: s.label, options: s.options, solutionId: c.solution.answers[s.id] })),
    explain: c.explain,
  }),
};

export const ilFiloRosso: MechanicModule<FiloContent, FiloSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({ answers: Object.fromEntries(c.slots.map((s) => [s.id, pickAnswer(rnd, c.solution.answers[s.id], s.options.map((o) => o.id), demoSkill(i) + 0.1)])) })),
  },
};
