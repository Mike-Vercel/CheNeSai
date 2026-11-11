import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { listAccountVoices } from "@/lib/server/tts";

/** Voci dell'account ElevenLabs (GET /v2/voices), con ricerca. */
export const GET = adminRoute("admin", async ({ url }) => {
  const search = url.searchParams.get("search")?.trim().slice(0, 80) || null;
  const page = url.searchParams.get("page")?.slice(0, 500) || null;
  return ok(await listAccountVoices(search, page));
});
