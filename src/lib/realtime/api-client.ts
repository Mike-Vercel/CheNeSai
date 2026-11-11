"use client";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** fetch JSON con errori tipizzati, timeout e nessuna cache. */
export async function api<T>(url: string, init: RequestInit & { json?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const { json, timeoutMs = 10000, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...rest,
      signal: rest.signal ?? ctrl.signal,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      if (res.redirected && res.url.includes("/admin/login")) throw new ApiError(401, "UNAUTHENTICATED", "Sessione scaduta: rifai il login");
      throw new ApiError(res.status || 502, "BAD_RESPONSE", "Il server non ha risposto bene, riprovo…");
    }
    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
      throw new ApiError(res.status, err?.code ?? "HTTP_" + res.status, err?.message ?? "Errore di rete", err?.details);
    }
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") throw new ApiError(0, "TIMEOUT", "La connessione è lenta, riprovo…");
    throw new ApiError(0, "NETWORK", "Connessione assente");
  } finally {
    clearTimeout(timer);
  }
}

/** Ritenta con backoff esponenziale + jitter (solo errori di rete/5xx). */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4, baseMs = 300): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const retriable = e instanceof ApiError && (e.status === 0 || e.status >= 500 || e.status === 429);
      if (!retriable || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i + Math.random() * baseMs));
    }
  }
  throw last;
}

export function uuid(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  // fallback per browser datati (es. Safari < 15.4)
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
