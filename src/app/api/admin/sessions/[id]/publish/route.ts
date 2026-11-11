import { scheduleSessionPrep } from "@/lib/server/tts-prewarm";
import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { getSql } from "@/lib/database/db";
import { publishSession, validateForPublish } from "@/lib/server/cms/sessions";

type P = { id: string };

/** GET: verifica pre-pubblicazione. POST: pubblica e congela la sessione. */
export const GET = adminRoute<P>("admin", async ({ params }) => ok({ issues: await validateForPublish(getSql(), params.id) }));
export const POST = adminRoute<P>("admin", async ({ admin, params }) => {
  const res = await publishSession(params.id, admin);
  // "Prepara voci" automatico appena la serata è pubblicata
  scheduleSessionPrep(params.id);
  return ok(res);
});
