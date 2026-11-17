import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { sceneSchema, type Scene } from "../components/art";
import { checkOptions, idSchema, publicOptions, sameSet, type Option } from "../components/choice";
import { CHAOS, outcome, noAnswer, POINTS } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 01 · MEMORIA LAMPO (manche 1) — la TV mostra una scena affollata per 8 secondi; poi ogni tavolo
 * ricostruisce tre dettagli: due a scelta singola e uno a selezione multipla. Punti per correttezza.
 */

const SHOW_MS = 8000;

const questionSchema = z.object({
  id: idSchema,
  prompt: text(110),
  multi: z.boolean(),
  options: optionsSchema(3, 6),
});

export const memoriaLampoContent = z
  .object({
    id: variantId,
    /** nome della scena, es. «La scrivania del lunedì» */
    sceneTitle: text(48),
    scene: sceneSchema,
    /** alternativa testuale completa della scena (lettori di schermo) */
    alt: text(600),
    questions: z.array(questionSchema).length(3),
    /** id domanda → id delle opzioni giuste */
    solution: z.record(z.string(), z.array(idSchema).min(1)),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    c.questions.forEach((q, i) => {
      const sol = c.solution[q.id];
      if (!sol) ctx.addIssue({ code: "custom", message: `manca la soluzione di ${q.id}`, path: ["solution"] });
      else {
        checkOptions(q.options, sol, ctx, ["questions", i]);
        if (!q.multi && sol.length !== 1) ctx.addIssue({ code: "custom", message: "scelta singola: una sola soluzione", path: ["questions", i] });
      }
    });
    if (!c.questions.some((q) => q.multi)) ctx.addIssue({ code: "custom", message: "serve una domanda a selezione multipla" });
  });
export type MemoriaLampoContent = z.infer<typeof memoriaLampoContent>;
export type MemoriaLampoInput = z.input<typeof memoriaLampoContent>;

export const memoriaLampoSubmission = z.object({
  /** id domanda → opzioni scelte */
  answers: z.record(z.string(), z.array(idSchema).max(6)),
});
export type MemoriaLampoSubmission = z.infer<typeof memoriaLampoSubmission>;

export interface MemoriaLampoView extends BaseView {
  sceneTitle: string;
  /** scena: presente solo nei primi `showMs` se il runtime usa `publicViewAt` */
  scene: Scene | null;
  alt: string | null;
  showMs: number;
  questions: { id: string; prompt: string; multi: boolean; options: Option[] }[];
}

export interface MemoriaLampoReveal {
  sceneTitle: string;
  scene: Scene;
  alt: string;
  questions: { id: string; prompt: string; multi: boolean; options: Option[]; solution: string[] }[];
  explain: string;
}

const def: MechanicDef<MemoriaLampoContent, MemoriaLampoSubmission> = {
  code: "memoria-lampo",
  number: 1,
  manche: 1,
  title: "Memoria lampo",
  input: "team",
  timerSec: 45,
  oneDeviceOk: true,
  needs: ["image"],
  rule: "La scena resta in TV 8 secondi, poi sparisce. Ricostruite tre dettagli: conta solo quanti ne azzeccate.",
  contentSchema: memoriaLampoContent,
  submissionSchema: memoriaLampoSubmission,
  publicView: (c, ctx) => view(c, ctx, true),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        const right = content.questions.filter((q) => sameSet(s.payload.answers[q.id] ?? [], content.solution[q.id] ?? [])).length;
        const all = right === content.questions.length;
        return outcome(t.teamId, {
          points: Math.round((POINTS.standard * right) / content.questions.length),
          chaos: CHAOS.partecipa + (all ? CHAOS.centro : 0),
          correct: all,
          accuracy: right / content.questions.length,
          label: `${right} dettagli su ${content.questions.length}`,
        });
      }),
    };
  },
  reveal: (c): MemoriaLampoReveal => ({
    sceneTitle: c.sceneTitle,
    scene: c.scene,
    alt: c.alt,
    questions: c.questions.map((q) => ({ id: q.id, prompt: q.prompt, multi: q.multi, options: q.options, solution: c.solution[q.id] ?? [] })),
    explain: c.explain,
  }),
};

function view(c: MemoriaLampoContent, ctx: PhaseCtx, withScene: boolean): MemoriaLampoView {
  return {
    ...baseView(def, ctx),
    sceneTitle: c.sceneTitle,
    scene: withScene ? c.scene : null,
    alt: withScene ? c.alt : null,
    showMs: SHOW_MS,
    questions: c.questions.map((q) => ({ id: q.id, prompt: q.prompt, multi: q.multi, options: publicOptions(q.options, `${ctx.seed}:${q.id}`) })),
  };
}

export const memoriaLampo: MechanicModule<MemoriaLampoContent, MemoriaLampoSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, elapsedMs < SHOW_MS),
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({
        answers: Object.fromEntries(
          c.questions.map((q) => {
            const sol = c.solution[q.id] ?? [];
            if (rnd() < demoSkill(i)) return [q.id, sol];
            const wrong = q.options.filter((o) => !sol.includes(o.id)).map((o) => o.id);
            return [q.id, q.multi ? [...sol.slice(1), wrong[0]] : [wrong[Math.floor(rnd() * wrong.length)]]];
          }),
        ),
      })),
  },
};
