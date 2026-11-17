import { z } from "zod";
import type { MechanicDef } from "../contract";
import { idSchema } from "../components/choice";
import { noAnswer, rightWrong } from "../components/scoring";
import { durationOf, firstPerTeam, scopeTeams } from "../components/submissions";
import { baseView, demoPerTeam, demoSkill, pickAnswer, type BaseView, type MechanicModule } from "../extras";
import { explainSchema, text, variantId } from "./_shared";

/**
 * 03 · SCREENSHOT TRADITORE (manche 1) — due screenshot di una chat inventata sembrano identici; in quello
 * «inoltrato» un dettaglio è stato cambiato. Si tocca il fumetto (o l'intestazione) modificato.
 * Punto solo per il dettaglio giusto, con bonus velocità (max 20): sbagliare costa la prova.
 */

export const HEADER_REGION = "intestazione";

const messageSchema = z.object({
  id: idSchema,
  from: text(22),
  /** messaggio di chi tiene il telefono (fumetto a destra) */
  mine: z.boolean().default(false),
  text: text(140),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

const chatSchema = z.object({
  /** nome del gruppo o della persona */
  title: text(32),
  subtitle: text(40),
  messages: z.array(messageSchema).min(4).max(7),
});
export type Chat = z.infer<typeof chatSchema>;

export const screenshotContent = z
  .object({
    id: variantId,
    /** la situazione in una riga, es. «Marta giura di aver scritto un altro orario» */
    context: text(120),
    /** la chat COME È STATA INOLTRATA (con il dettaglio cambiato) */
    chat: chatSchema,
    solution: z.object({
      /** id del fumetto cambiato, oppure "intestazione" */
      regionId: z.string(),
      /** come era nell'originale (solo i campi cambiati) */
      before: z.object({ text: text(140).optional(), time: z.string().optional(), from: text(22).optional(), title: text(32).optional(), subtitle: text(40).optional() }),
    }),
    explain: explainSchema,
  })
  .superRefine((c, ctx) => {
    const ids = c.chat.messages.map((m) => m.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "id dei fumetti duplicati" });
    if (ids.includes(HEADER_REGION)) ctx.addIssue({ code: "custom", message: `"${HEADER_REGION}" è riservato` });
    const { regionId, before } = c.solution;
    if (regionId !== HEADER_REGION && !ids.includes(regionId)) ctx.addIssue({ code: "custom", message: "regione della soluzione inesistente" });
    const changed = Object.keys(before).filter((k) => before[k as keyof typeof before] !== undefined);
    if (changed.length === 0) ctx.addIssue({ code: "custom", message: "l'originale deve differire" });
    const orig = originalChat(c);
    if (JSON.stringify(orig) === JSON.stringify(c.chat)) ctx.addIssue({ code: "custom", message: "originale identico all'inoltrato" });
  });
export type ScreenshotContent = z.infer<typeof screenshotContent>;
export type ScreenshotInput = z.input<typeof screenshotContent>;

export const screenshotSubmission = z.object({ regionId: z.string().min(1).max(40) });
export type ScreenshotSubmission = z.infer<typeof screenshotSubmission>;

/** La chat originale (prima della modifica). */
export function originalChat(c: Pick<ScreenshotContent, "chat" | "solution">): Chat {
  const { regionId, before } = c.solution;
  if (regionId === HEADER_REGION) {
    return { ...c.chat, title: before.title ?? c.chat.title, subtitle: before.subtitle ?? c.chat.subtitle };
  }
  return {
    ...c.chat,
    messages: c.chat.messages.map((m) =>
      m.id === regionId ? { ...m, text: before.text ?? m.text, time: before.time ?? m.time, from: before.from ?? m.from } : m,
    ),
  };
}

export interface ScreenshotView extends BaseView {
  context: string;
  /** screenshot originale (a sinistra in TV; «vedi originale» sul telefono) */
  original: Chat;
  /** screenshot inoltrato: si tocca qui */
  forwarded: Chat;
}

export interface ScreenshotReveal {
  context: string;
  original: Chat;
  forwarded: Chat;
  regionId: string;
  explain: string;
}

const def: MechanicDef<ScreenshotContent, ScreenshotSubmission> = {
  code: "screenshot-traditore",
  number: 3,
  manche: 1,
  title: "Screenshot traditore",
  input: "team",
  timerSec: 30,
  oneDeviceOk: true,
  needs: ["image"],
  rule: "Due screenshot quasi identici: in quello inoltrato qualcuno ha cambiato un dettaglio. Toccatelo. Prima è, più vale.",
  contentSchema: screenshotContent,
  submissionSchema: screenshotSubmission,
  publicView: (c, ctx): ScreenshotView => ({ ...baseView(def, ctx), context: c.context, original: originalChat(c), forwarded: c.chat }),
  score: ({ content, ctx, submissions }) => {
    const firsts = firstPerTeam(submissions, ctx);
    const windowMs = durationOf(ctx) || def.timerSec * 1000;
    return {
      outcomes: scopeTeams(ctx).map((t) => {
        const s = firsts.get(t.teamId);
        if (!s) return noAnswer(t.teamId);
        return rightWrong(t.teamId, s.payload.regionId === content.solution.regionId, { speed: true, elapsedMs: s.elapsedMs, windowMs, koLabel: "Dettaglio sbagliato" });
      }),
    };
  },
  reveal: (c): ScreenshotReveal => ({ context: c.context, original: originalChat(c), forwarded: c.chat, regionId: c.solution.regionId, explain: c.explain }),
};

export const screenshotTraditore: MechanicModule<ScreenshotContent, ScreenshotSubmission> = {
  def,
  extras: {
    demoSubmissions: (c, ctx, seed) =>
      demoPerTeam(ctx, seed, (i, rnd) => ({
        regionId: pickAnswer(rnd, c.solution.regionId, [HEADER_REGION, ...c.chat.messages.map((m) => m.id)], demoSkill(i)),
      })),
  },
};
