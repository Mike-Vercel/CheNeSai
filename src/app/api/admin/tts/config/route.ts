import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { saveVoiceConfig, voicePanelData } from "@/lib/server/cms/voices";

/** Voci dei presentatori: assegnazione per ruolo, impostazioni e budget mensile. */
export const GET = adminRoute("admin", async () => ok(await voicePanelData()));
export const PUT = adminRoute("admin", async ({ req, admin }) => ok(await saveVoiceConfig(await req.json(), admin)));
