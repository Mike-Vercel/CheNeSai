import { z } from "zod";
import { adminRoute } from "@/lib/admin-route";
import { ok, readJson } from "@/lib/http";
import { generateSample } from "@/lib/server/cms/voices";
import { TTS_ROLES } from "@/features/game/script";

export const maxDuration = 30;

/** "Prova": frase fissa breve per un ruolo (si paga una volta, poi resta in cache). */
export const POST = adminRoute("admin", async ({ req }) => {
  const { role } = await readJson(req, z.object({ role: z.enum(TTS_ROLES) }));
  return ok(await generateSample(role));
});
