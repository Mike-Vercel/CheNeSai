import { adminRoute } from "@/lib/admin-route";
import { ok } from "@/lib/http";
import { usageData } from "@/lib/server/cms/voices";

/** Consumo: abbonamento ElevenLabs (usati/limite/rinnovo) e caratteri generati dall'app nel mese. */
export const GET = adminRoute("admin", async () => ok(await usageData()));
