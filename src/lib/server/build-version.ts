import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Versione della build in esecuzione (id del deploy su Vercel, altrimenti .next/BUILD_ID).
 * La usano /api/version (ricaricamento automatico di TV e telefoni) e /sw.js (nome della cache
 * del service worker: cambia a ogni deploy, così non si serve mai un'app vecchia).
 * null = versione non determinabile (es. `next dev`).
 */
let cached: string | null | undefined;

export function buildVersion(): string | null {
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
