/**
 * Service worker minimale dell'app installabile (PWA).
 *
 * Regole (volutamente strette: è un gioco live, lo stato è sempre sul server):
 * - in cache SOLO file statici: /_next/static (JS, CSS e font di next/font, con hash nel nome),
 *   icone, logo (/brand), personaggi (/characters) e la pagina offline;
 * - MAI /api/*, Realtime (websocket, altro dominio), né l'HTML delle pagine (/play, /display, /admin…):
 *   le navigazioni vanno sempre in rete e, solo se la rete manca, si mostra la pagina offline;
 * - la cache ha nel nome la versione della build: a ogni deploy il service worker cambia,
 *   si attiva subito (skipWaiting + clients.claim) e cancella le cache vecchie.
 */

export const OFFLINE_URL = "/offline.html";

export type SwStrategy = "static" | "asset" | "none";

/**
 * Cosa fare di una richiesta GET dello stesso dominio, dal percorso.
 * Deve restare autosufficiente (nessun riferimento esterno): viene copiata nel sorgente di /sw.js.
 */
export function swStrategy(pathname: string): SwStrategy {
  if (pathname.startsWith("/api/") || pathname === "/api") return "none";
  // file con hash nel nome: immutabili, cache-first
  if (pathname.startsWith("/_next/static/")) return "static";
  // file pubblici senza hash: dalla cache ma riaggiornati in background (e la cache cambia a ogni deploy)
  if (/^\/(icons|brand|characters)\/[^/]+\.(png|webp|jpg|jpeg|svg|ico)$/i.test(pathname)) return "asset";
  if (pathname === "/favicon.ico" || pathname === "/offline.html") return "asset";
  return "none";
}

/** Sorgente JavaScript di /sw.js per una certa versione della build. */
export function serviceWorkerSource(version: string, offlineUrl: string = OFFLINE_URL): string {
  const cacheName = `qz-static-${version.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 64) || "dev"}`;
  return `/* CHE NE SAI?! – service worker (${cacheName}) */
"use strict";
const CACHE = ${JSON.stringify(cacheName)};
const OFFLINE_URL = ${JSON.stringify(offlineUrl)};
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];
const strategyFor = ${swStrategy.toString()};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(new URL(u, self.location.origin).href, { cache: "reload" }))))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("qz-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function cacheable(response) {
  return response && response.status === 200 && response.type === "basic";
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (cacheable(response)) cache.put(request, response.clone()).catch(() => undefined);
  return response;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(event.request);
  const refresh = fetch(event.request).then((response) => {
    if (cacheable(response)) return cache.put(event.request, response.clone()).then(() => response);
    return response;
  });
  if (hit) {
    event.waitUntil(refresh.catch(() => undefined));
    return hit;
  }
  return refresh;
}

async function networkWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch (err) {
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, Realtime, CDN: mai toccati
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    // HTML sempre dalla rete (mai in cache): la pagina offline solo se la rete manca
    event.respondWith(networkWithOfflineFallback(request));
    return;
  }
  if (request.headers.has("range")) return; // audio/video a pezzi: lasciati al browser
  const strategy = strategyFor(url.pathname);
  if (strategy === "static") event.respondWith(cacheFirst(request));
  else if (strategy === "asset") event.respondWith(staleWhileRevalidate(event));
});
`;
}
