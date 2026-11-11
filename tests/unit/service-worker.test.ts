import { describe, expect, it, vi } from "vitest";
import { OFFLINE_URL, serviceWorkerSource, swStrategy } from "@/lib/pwa/service-worker";

describe("service worker: cosa va in cache", () => {
  it("solo file statici; mai API né pagine", () => {
    expect(swStrategy("/_next/static/chunks/app-123.js")).toBe("static");
    expect(swStrategy("/_next/static/media/nunito.woff2")).toBe("static");
    expect(swStrategy("/brand/logo-full-480.webp")).toBe("asset");
    expect(swStrategy("/characters/palmino-512.webp")).toBe("asset");
    expect(swStrategy("/icons/icon-192.png")).toBe("asset");
    expect(swStrategy("/offline.html")).toBe("asset");
    for (const p of ["/api/version", "/api/play/ABCD/me", "/api", "/play/ABCD", "/display/x", "/admin", "/", "/sw.js", "/manifest.webmanifest", "/audio/x.mp3", "/brand/../api/x"]) {
      expect(swStrategy(p)).toBe("none");
    }
  });
});

type Handler = (event: Record<string, unknown>) => void;

/** Risposta "di rete" dello stesso dominio (nel browser ha type "basic", in Node no). */
function netResponse(body: string): Response {
  const make = (): Response => ({ status: 200, type: "basic", clone: make, text: async () => body }) as unknown as Response;
  return make();
}

/** Esegue il sorgente di /sw.js in un finto ambiente service worker. */
function loadWorker(version = "build-1", net: (req: Request) => Promise<Response> = async () => netResponse("ok")) {
  const handlers: Record<string, Handler> = {};
  const stores = new Map<string, Map<string, Response>>();
  const cacheFor = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    const key = (r: Request | string) => (typeof r === "string" ? new URL(r, "https://quiz.test").pathname : new URL(r.url).pathname);
    return {
      match: async (r: Request | string) => m.get(key(r))?.clone(),
      put: async (r: Request | string, res: Response) => void m.set(key(r), res),
      addAll: async (list: Request[]) => list.forEach((r) => m.set(key(r), netResponse("cached"))),
    };
  };
  const caches = {
    open: async (name: string) => cacheFor(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (r: Request | string) => {
      for (const name of stores.keys()) {
        const hit = await cacheFor(name).match(r);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  const self = {
    location: { origin: "https://quiz.test" },
    addEventListener: (type: string, h: Handler) => (handlers[type] = h),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };
  const fetchMock = vi.fn(net);
  new Function("self", "caches", "fetch", serviceWorkerSource(version))(self, caches, fetchMock);

  async function dispatchFetch(url: string, init: { mode?: string; method?: string; headers?: Record<string, string> } = {}) {
    let responded: Promise<Response> | null = null;
    const request = { url, method: init.method ?? "GET", mode: init.mode ?? "no-cors", headers: new Headers(init.headers) } as unknown as Request;
    handlers.fetch({ request, respondWith: (p: Promise<Response>) => (responded = p), waitUntil: () => undefined });
    return responded as Promise<Response> | null;
  }
  async function lifecycle(type: "install" | "activate") {
    let wait: Promise<unknown> = Promise.resolve();
    handlers[type]({ waitUntil: (p: Promise<unknown>) => (wait = p) });
    await wait;
  }
  return { self, stores, fetchMock, dispatchFetch, lifecycle };
}

describe("service worker: comportamento", () => {
  it("il sorgente è JavaScript valido con la versione nel nome della cache", () => {
    const src = serviceWorkerSource("abc123");
    expect(src).toContain('"qz-static-abc123"');
    expect(() => new Function(src)).not.toThrow();
    // caratteri strani nella versione non rompono il sorgente
    expect(serviceWorkerSource('x"; alert(1); //')).toContain('"qz-static-xalert1"');
  });

  it("installazione: pagina offline in cache e attivazione immediata", async () => {
    const w = loadWorker("v1");
    await w.lifecycle("install");
    expect(w.stores.get("qz-static-v1")?.has(OFFLINE_URL)).toBe(true);
    expect(w.self.skipWaiting).toHaveBeenCalled();
  });

  it("nuovo deploy: le cache vecchie vengono cancellate", async () => {
    const w = loadWorker("v2");
    w.stores.set("qz-static-v1", new Map());
    w.stores.set("altro-sito", new Map());
    await w.lifecycle("install");
    await w.lifecycle("activate");
    expect([...w.stores.keys()].sort()).toEqual(["altro-sito", "qz-static-v2"]);
    expect(w.self.clients.claim).toHaveBeenCalled();
  });

  it("API, POST, altri domini e richieste a pezzi non vengono toccati", async () => {
    const w = loadWorker();
    expect(await w.dispatchFetch("https://quiz.test/api/version")).toBeNull();
    expect(await w.dispatchFetch("https://quiz.test/api/admin/sessions/x/backup", { mode: "navigate" })).toBeNull();
    expect(await w.dispatchFetch("https://quiz.test/_next/static/a.js", { method: "POST" })).toBeNull();
    expect(await w.dispatchFetch("https://db.supabase.co/rest/v1/x")).toBeNull();
    expect(await w.dispatchFetch("https://quiz.test/characters/x.webp", { headers: { range: "bytes=0-" } })).toBeNull();
  });

  it("file statici: dalla cache dopo il primo caricamento", async () => {
    const w = loadWorker();
    const first = await w.dispatchFetch("https://quiz.test/_next/static/chunks/a.js");
    expect(await first?.text()).toBe("ok");
    const second = await w.dispatchFetch("https://quiz.test/_next/static/chunks/a.js");
    expect(await second?.text()).toBe("ok");
    expect(w.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("pagine: sempre dalla rete e mai salvate; offline solo se la rete manca", async () => {
    const w = loadWorker("v1");
    await w.lifecycle("install");
    const online = await w.dispatchFetch("https://quiz.test/play/ABCD", { mode: "navigate" });
    expect(await online?.text()).toBe("ok");
    expect(w.stores.get("qz-static-v1")?.has("/play/ABCD")).toBe(false);

    const off = loadWorker("v1", async () => {
      throw new TypeError("Failed to fetch");
    });
    await off.lifecycle("install");
    const res = await off.dispatchFetch("https://quiz.test/play/ABCD", { mode: "navigate" });
    expect(await res?.text()).toBe("cached"); // la pagina offline precaricata
  });
});
