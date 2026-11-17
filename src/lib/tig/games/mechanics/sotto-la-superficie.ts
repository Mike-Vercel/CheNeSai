import { z } from "zod";
import type { MechanicDef } from "../contract";
import { idSchema, publicOptions, type Option } from "../components/choice";
import { baseView, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";
import { checkSingle, demoSingle, difficultySchema, optionSolution, optionSubmission, scoreSingle, type OptionSubmission } from "./m1/common";

/**
 * 16 · SOTTO LA SUPERFICIE (manche 1) — una chat INVENTATA; un messaggio (evidenziato) ha un doppio senso.
 * I messaggi intorno danno il contesto che rende UNA interpretazione la più probabile (chiave editoriale
 * univoca: niente letture controverse, niente temi sensibili). Quattro interpretazioni, 100 se giusta.
 */

export const surfaceMessageSchema = z.object({
  id: idSchema,
  from: text(22),
  /** messaggio di chi tiene il telefono (fumetto a destra) */
  mine: z.boolean().default(false),
  text: text(150),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});
export type SurfaceMessage = z.infer<typeof surfaceMessageSchema>;

export const surfaceChatSchema = z.object({
  /** nome del gruppo o della persona */
  title: text(32),
  subtitle: text(40),
  messages: z.array(surfaceMessageSchema).min(3).max(7),
});
export type SurfaceChat = z.infer<typeof surfaceChatSchema>;

export const sottoContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    chat: surfaceChatSchema,
    /** id del messaggio da interpretare (evidenziato a tutti) */
    targetId: idSchema,
    /** domanda, es. «Cosa vuole dire davvero Marta?» */
    prompt: text(110),
    options: optionsSchema(4, 4),
    solution: optionSolution,
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkSingle(c.options, c.solution.optionId, ctx);
    const ids = c.chat.messages.map((m) => m.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "id dei messaggi duplicati" });
    if (!ids.includes(c.targetId)) ctx.addIssue({ code: "custom", message: "messaggio da interpretare inesistente", path: ["targetId"] });
  });
export type SottoContent = z.infer<typeof sottoContent>;
export type SottoInput = z.input<typeof sottoContent>;

export interface SottoView extends BaseView {
  chat: SurfaceChat;
  targetId: string;
  prompt: string;
  options: Option[];
}

export interface SottoReveal {
  chat: SurfaceChat;
  targetId: string;
  prompt: string;
  options: Option[];
  solutionId: string;
  explain: string;
}

const def: MechanicDef<SottoContent, OptionSubmission> = {
  code: "sotto-la-superficie",
  number: 16,
  manche: 1,
  title: "Sotto la superficie",
  input: "team",
  timerSec: 35,
  oneDeviceOk: true,
  needs: [],
  rule: "Un messaggio della chat ha un doppio senso. Leggete il contesto e scegliete cosa intende davvero chi l'ha scritto.",
  contentSchema: sottoContent,
  submissionSchema: optionSubmission,
  publicView: (c, ctx): SottoView => ({ ...baseView(def, ctx), chat: c.chat, targetId: c.targetId, prompt: c.prompt, options: publicOptions(c.options, `${ctx.seed}:letture`) }),
  score: ({ content, ctx, submissions }) => scoreSingle(content.solution.optionId, ctx, submissions, { okLabel: "Letto tra le righe", koLabel: "Preso alla lettera" }),
  reveal: (c): SottoReveal => ({ chat: c.chat, targetId: c.targetId, prompt: c.prompt, options: c.options, solutionId: c.solution.optionId, explain: c.explain }),
};

export const sottoLaSuperficie: MechanicModule<SottoContent, OptionSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) => demoSingle(ctx, seed, c.solution.optionId, c.options.map((o) => o.id)),
  },
};
