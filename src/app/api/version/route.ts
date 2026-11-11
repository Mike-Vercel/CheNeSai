import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ok } from "@/lib/http";

/**
 * Versione della build in esecuzione: TV e telefoni la confrontano con quella con cui sono
 * stati caricati e, se cambia (nuova versione pubblicata), si ricaricano da soli.
 * null = versione non determinabile (nessun ricaricamento automatico).
 */
let cached: string | null | undefined;

function buildVersion(): string | null {
  if (cached !== undefined) return cached;
  const fromEnv = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  if (fromEnv) return (cached = fromEnv);
  try {
    cached = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function GET() {
  return ok({ version: buildVersion() }, { headers: { "Cache-Control": "no-store" } });
}
