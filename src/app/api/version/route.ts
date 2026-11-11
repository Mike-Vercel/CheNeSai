import { ok } from "@/lib/http";
import { buildVersion } from "@/lib/server/build-version";

/**
 * Versione della build in esecuzione: TV e telefoni la confrontano con quella con cui sono
 * stati caricati e, se cambia (nuova versione pubblicata), si ricaricano da soli.
 * null = versione non determinabile (nessun ricaricamento automatico).
 */
export async function GET() {
  return ok({ version: buildVersion() }, { headers: { "Cache-Control": "no-store" } });
}
