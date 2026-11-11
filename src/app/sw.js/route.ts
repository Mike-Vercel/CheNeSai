import { buildVersion } from "@/lib/server/build-version";
import { OFFLINE_URL, serviceWorkerSource } from "@/lib/pwa/service-worker";

/**
 * /sw.js – service worker dell'app installabile, generato a ogni richiesta con la versione
 * della build nel nome della cache: dopo un deploy il file cambia, il browser installa il nuovo
 * service worker (skipWaiting + clients.claim) e la cache vecchia viene cancellata.
 * Mai in cache HTTP (Cache-Control no-cache), così il controllo aggiornamenti è sempre fresco.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const version = buildVersion() ?? "dev";
  return new Response(serviceWorkerSource(version, OFFLINE_URL), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
