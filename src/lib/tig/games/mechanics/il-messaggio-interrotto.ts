import { z } from "zod";
import type { MechanicDef } from "../contract";
import { checkOptions, idSchema, publicOptions, type Option } from "../components/choice";
import { noAnswer, rightWrong } from "../components/scoring";
import { firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { difficultySchema } from "./_m4";
import { explainSchema, optionsSchema, text, variantId } from "./_shared";

/**
 * 58 · IL MESSAGGIO INTERROTTO (manche 4) — una chat inventata con un messaggio sparito. Quattro candidati,
 * scritti tutti dalla stessa persona: uno solo rende coerente quello che viene DOPO (le risposte lo citano).
 * Si valuta la coerenza della conversazione, mai la cultura generale. Giusto 100.
 */

const messageSchema = z.object({
  id: idSchema,
  /** chi scrive (personaggio inventato) o «Tu» per i messaggi propri */
  from: text(24),
  mine: z.boolean().optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  /** testo; assente solo nel messaggio mancante */
  text: text(200).optional(),
  /** il messaggio sparito (uno solo) */
  gap: z.literal(true).optional(),
});

export const messaggioContent = z
  .object({
    id: variantId,
    difficulty: difficultySchema,
    chatTitle: text(40),
    chatSubtitle: text(60),
    messages: z.array(messageSchema).min(4).max(9),
    options: optionsSchema(4, 4),
    solution: z.object({ optionId: idSchema }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    checkOptions(c.options, [c.solution.optionId], ctx, ["options"]);
    const gaps = c.messages.filter((m) => m.gap);
    if (gaps.length !== 1) ctx.addIssue({ code: "custom", message: "serve esattamente un messaggio mancante" });
    c.messages.forEach((m, i) => {
      if (m.gap && m.text) ctx.addIssue({ code: "custom", message: "il messaggio mancante non ha testo", path: ["messages", i] });
      if (!m.gap && !m.text) ctx.addIssue({ code: "custom", message: "messaggio senza testo", path: ["messages", i] });
    });
    const gi = c.messages.findIndex((m) => m.gap);
    if (gi <= 0 || gi >= c.messages.length - 1) ctx.addIssue({ code: "custom", message: "il buco deve stare in mezzo: servono messaggi prima e dopo" });
    if (new Set(c.messages.map((m) => m.id)).size !== c.messages.length) ctx.addIssue({ code: "custom", message: "id dei messaggi duplicati" });
  });
export type MessaggioContent = z.infer<typeof messaggioContent>;
export type MessaggioInput = z.input<typeof messaggioContent>;

export const messaggioSubmission = z.object({ optionId: idSchema });
export type MessaggioSubmission = z.infer<typeof messaggioSubmission>;

export interface ChatLine {
  id: string;
  from: string;
  mine: boolean;
  time: string;
  /** null = il messaggio sparito */
  text: string | null;
}

export interface MessaggioView extends BaseView {
  chatTitle: string;
  chatSubtitle: string;
  messages: ChatLine[];
  /** chi ha scritto il messaggio sparito */
  gapFrom: string;
  options: Option[];
}

export interface MessaggioReveal {
  messages: ChatLine[];
  options: Option[];
  solutionId: string;
  explain: string;
}

function lines(c: MessaggioContent): ChatLine[] {
  return c.messages.map((m) => ({ id: m.id, from: m.from, mine: !!m.mine, time: m.time, text: m.gap ? null : (m.text ?? "") }));
}

const def: MechanicDef<MessaggioContent, MessaggioSubmission> = {
  code: "il-messaggio-interrotto",
  number: 58,
  manche: 4,
  title: "Il messaggio interrotto",
  input: "team",
  timerSec: 50,
  oneDeviceOk: true,
  needs: [],
  rule: "Nella chat manca un messaggio. Leggete le risposte che vengono dopo e scegliete l'unico che le fa tornare.",
  contentSchema: messaggioContent,
  submissionSchema: messaggioSubmission,
  publicView: (c, ctx): MessaggioView => ({
    ...baseView(def, ctx),
    chatTitle: c.chatTitle,
    chatSubtitle: c.chatSubtitle,
    messages: lines(c),
    gapFrom: c.messages.find((m) => m.gap)?.from ?? "",
    options: publicOptions(c.options, `${ctx.seed}:messaggi`),
  }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        return rightWrong(t.teamId, s.payload.optionId === content.solution.optionId, { okLabel: "La chat torna", koLabel: "Messaggio che non torna" });
      }),
    };
  },
  reveal: (c): MessaggioReveal => ({ messages: lines(c), options: c.options, solutionId: c.solution.optionId, explain: c.explain }),
};

export const ilMessaggioInterrotto: MechanicModule<MessaggioContent, MessaggioSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({ optionId: pickAnswer(rnd, c.solution.optionId, c.options.map((o) => o.id), demoSkill(i)) })),
  },
};
