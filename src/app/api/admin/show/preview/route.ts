import { z } from "zod";
import { adminRoute } from "@/lib/admin-route";
import { ok, readJson } from "@/lib/http";
import { ttsUrl } from "@/lib/server/tts";
import { previewText } from "@/lib/show/preview";
import { curatedVoiceText } from "@/lib/show/library";
import { SHOW_EVENT_TYPES } from "@/lib/show/types";

export const maxDuration = 30;

const schema = z.object({
  character: z.enum(["professore", "regina", "palmino"]),
  event: z.enum(SHOW_EVENT_TYPES),
  text: z.string().trim().min(3).max(300),
  name: z.string().trim().min(1).max(24).default("Mario"),
  /** battuta della libreria ufficiale o aggiunta dal pannello: voce "curata" (maiuscole → audio tag) */
  curated: z.boolean().default(false),
  tags: z.array(z.string().max(40)).max(12).default([]),
});

/** "Prova": la battuta con un nome di prova, con la voce vera del personaggio (resta in cache). */
export const POST = adminRoute("admin", async ({ req }) => {
  const b = await readJson(req, schema);
  const voice = b.curated
    ? curatedVoiceText({ text: b.text, character: b.character, event: b.event, tags: b.tags })
    : b.text;
  const text = previewText(b.event, voice, b.name);
  return ok({ text, url: await ttsUrl(b.character, text, { source: "sample" }) });
});
