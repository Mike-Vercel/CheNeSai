"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/realtime/api-client";

export { ApiError };

type Method = "POST" | "PUT" | "PATCH" | "DELETE";

/** Chiamata JSON con metodo esplicito (gli errori restano ApiError tipizzati). */
export function send<T = { ok: boolean }>(url: string, method: Method, json?: unknown): Promise<T> {
  return api<T>(url, { method, json: json ?? (method === "DELETE" ? undefined : {}), timeoutMs: 20000 });
}

export function get<T>(url: string): Promise<T> {
  return api<T>(url, { timeoutMs: 20000 });
}

/** Messaggio leggibile per l'utente. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Sessione scaduta: effettua di nuovo l'accesso";
    if (e.status === 403) return "Non hai i permessi per questa operazione";
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Errore imprevisto";
}

export interface Issue {
  path: (string | number)[];
  message: string;
}

function isIssueList(v: unknown): v is Issue[] {
  return Array.isArray(v) && v.every((i) => typeof i === "object" && i !== null && "message" in i);
}

/** Issue zod (error.details) → mappa "path.join('.')" → messaggio. */
export function fieldErrors(e: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (e instanceof ApiError && isIssueList(e.details)) {
    for (const i of e.details) {
      const key = Array.isArray(i.path) ? i.path.join(".") : "";
      if (!out[key]) out[key] = i.message;
    }
  }
  return out;
}

/** Caricamento dati con ricarica manuale; mantiene i dati precedenti durante il refresh. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const key = `${url ?? ""}#${nonce}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    get<T>(url)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
        setLoadedKey(key);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(errorMessage(e));
        setLoadedKey(key);
      });
    return () => {
      alive = false;
    };
  }, [url, key]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading: !!url && loadedKey !== key, reload, setData };
}

/** Esegue un'azione mostrando toast di esito; restituisce undefined se fallisce. */
export function useRunner() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, okText?: string): Promise<T | undefined> => {
      setBusy(key);
      try {
        const r = await fn();
        if (okText) toast("ok", okText);
        return r;
      } catch (e) {
        toast("error", errorMessage(e));
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );
  return { busy, run };
}

/** Querystring senza parametri vuoti. */
export function qs(params: Record<string, string | number | undefined | null | false>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
