import { z } from "zod";
import type { MechanicDef, PhaseCtx } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { noAnswer, rightWrong } from "../components/scoring";
import { durationOf, firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { difficultySchema } from "./m5-shared";

/**
 * 79 · FALSO FINALE (manche 5) — la TV mostra una «classifica finale» con confetti… di squadre INVENTATE
 * (mai i tavoli veri: non tocca la classifica reale). Dopo 7 secondi lo schermo si incrina: FALSO FINALE.
 * Parte la prova bonus annunciata dal regolamento fin dall'inizio: un mini-enigma che si risolve proprio
 * guardando quella classifica finta (che resta visibile). Giusta +100 e fino a +20 di rapidità, sbagliata 0:
 * la sorpresa è solo narrativa, non cambia nessuna regola e non toglie punti.
 */

export const FAKE_MS = 7000;

const rowSchema = z.object({
  /** squadra inventata, es. «Le Polpette Volanti» */
  name: text(28),
  pts: z.number().int().min(0).max(9999),
  /** colonna facoltativa (prove vinte, tavolo inventato…) */
  note: z.string().trim().max(18).optional(),
});

export const falsoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema.optional(),
    board: z.object({
      title: text(40),
      /** intestazione della colonna facoltativa */
      noteLabel: z.string().trim().max(16).optional(),
      rows: z.array(rowSchema).min(4).max(8),
    }),
    /** annuncio della svolta, es. «Fermi tutti: questa classifica è truccata» */
    twist: text(120),
    prompt: text(220),
    options: optionsSchema(4, 4),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => checkOptions(c.options, [c.solution.optionId], ctx, ["options"]));
export type FalsoContent = z.infer<typeof falsoContent>;
export type FalsoInput = z.input<typeof falsoContent>;

export const falsoSubmission = z.object({ optionId: idSchema });
export type FalsoSubmission = z.infer<typeof falsoSubmission>;

export interface FalsoView extends BaseView {
  fakeMs: number;
  board: FalsoContent["board"];
  /** svolta e domanda: solo dopo il falso finale con `publicViewAt` */
  twist: string | null;
  prompt: string | null;
  options: Option[] | null;
}

export interface FalsoReveal {
  board: FalsoContent["board"];
  twist: string;
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
}

function view(c: FalsoContent, ctx: PhaseCtx, open: boolean): FalsoView {
  return {
    ...baseView(def, ctx),
    fakeMs: FAKE_MS,
    board: c.board,
    twist: open ? c.twist : null,
    prompt: open ? c.prompt : null,
    options: open ? publicOptions(c.options, `${ctx.seed}:opzioni`) : null,
  };
}

const def: MechanicDef<FalsoContent, FalsoSubmission> = {
  code: "falso-finale",
  number: 79,
  manche: 5,
  title: "Falso finale",
  input: "team",
  timerSec: 60,
  oneDeviceOk: true,
  needs: [],
  rule: "Da regolamento: dopo una «classifica finale» può partire una prova bonus. Mini-enigma: giusta +100 più rapidità, mai punti persi.",
  contentSchema: falsoContent,
  submissionSchema: falsoSubmission,
  publicView: (c, ctx) => view(c, ctx, true),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const windowMs = Math.max(1, (durationOf(ctx) || def.timerSec * 1000) - FAKE_MS);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        return rightWrong(t.teamId, s.payload.optionId === content.solution.optionId, { speed: true, elapsedMs: Math.max(0, s.elapsedMs - FAKE_MS), windowMs });
      }),
    };
  },
  reveal: (c): FalsoReveal => ({ board: c.board, twist: c.twist, prompt: c.prompt, options: c.options, solutionId: c.solution.optionId, explain: c.explain }),
};

export const falsoFinale: MechanicModule<FalsoContent, FalsoSubmission> = {
  def,
  extras: {
    publicViewAt: (c, ctx, elapsedMs) => view(c, ctx, elapsedMs >= FAKE_MS),
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({ optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i)) }), { minMs: FAKE_MS + 5000 }),
  },
};
