"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PsycoAction, PsycoPrivateView, PsycoPublicState, PsycoView } from "@/lib/psyco/types";
import { api, ApiError, withRetry } from "@/lib/realtime/api-client";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export type LinkStatus = "connecting" | "live" | "reconnecting" | "offline";

/** Polling di sicurezza: lo stato arriva via realtime; il polling serve anche da «battito» (presenza). */
const POLL_LIVE_MS = 10_000;
const POLL_FALLBACK_MS = 2_000;

interface Options {
  /** stanza (endpoint autenticato) oppure schermo pubblico (chiave) */
  source: { kind: "room"; roomId: string; as?: string | null } | { kind: "display"; displayKey: string };
  onState?: (next: PsycoPublicState, prev: PsycoPublicState | null) => void;
}

/**
 * Stato di una stanza PSYCO sincronizzato col server (fonte di verità):
 *  - snapshot via HTTP (con stima della differenza d'orologio, stile NTP: il timer usa l'ora del server);
 *  - aggiornamenti sul canale realtime PRIVATO 'qz:game:psyco-<id>' (solo stato PUBBLICO);
 *  - quando cambiano i dati privati (secretRev, fase, manche) la vista privata si rilegge dall'endpoint
 *    autenticato: i segreti non passano MAI dal canale realtime;
 *  - riconnessione, ritorno in primo piano, rete di nuovo online → nuovo snapshot.
 */
export function usePsyco({ source, onState }: Options) {
  const [state, setState] = useState<PsycoPublicState | null>(null);
  const [view, setView] = useState<PsycoPrivateView | null>(null);
  const [status, setStatus] = useState<LinkStatus>("connecting");
  const [error, setError] = useState<ApiError | null>(null);
  const stateRef = useRef<PsycoPublicState | null>(null);
  const offsetRef = useRef(0);
  const bestRtt = useRef(Number.POSITIVE_INFINITY);
  const onStateRef = useRef(onState);
  useEffect(() => {
    onStateRef.current = onState;
  });
  const key = source.kind === "room" ? `room:${source.roomId}:${source.as ?? ""}` : `display:${source.displayKey}`;
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  });

  const applyState = useCallback((next: PsycoPublicState, fromRealtime: boolean) => {
    const prev = stateRef.current;
    if (prev && prev.roomId === next.roomId && next.version < prev.version) return false;
    if (prev && fromRealtime && next.version === prev.version) return false;
    if (fromRealtime && !Number.isFinite(bestRtt.current)) offsetRef.current = Date.parse(next.serverNow) - Date.now();
    stateRef.current = next;
    setState(next);
    onStateRef.current?.(next, prev);
    return true;
  }, []);

  const refresh = useCallback(async () => {
    const src = sourceRef.current;
    const t0 = Date.now();
    try {
      let next: PsycoPublicState;
      if (src.kind === "room") {
        const q = src.as ? `?as=${encodeURIComponent(src.as)}` : "";
        const r = await api<PsycoView>(`/api/psyco/rooms/${src.roomId}${q}`);
        next = r.state;
        setView(r.view);
      } else {
        next = await api<PsycoPublicState>(`/api/psyco/schermo/${encodeURIComponent(src.displayKey)}`);
      }
      const rtt = Date.now() - t0;
      if (rtt <= bestRtt.current * 1.5 || rtt < 400) {
        offsetRef.current = Date.parse(next.serverNow) - (t0 + rtt / 2);
        bestRtt.current = Math.min(bestRtt.current, rtt);
      }
      setError(null);
      applyState(next, false);
      return next;
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, "NETWORK", "Connessione assente"));
      return null;
    }
  }, [applyState]);

  /** Applica una risposta del server (es. dopo un'azione) senza aspettare il realtime. */
  const applyView = useCallback(
    (r: PsycoView) => {
      setView(r.view);
      applyState(r.state, false);
    },
    [applyState],
  );

  // snapshot iniziale + polling di sicurezza
  const live = status === "live";
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loop = async () => {
      if (cancelled) return;
      await refresh();
      const every = live ? POLL_LIVE_MS : POLL_FALLBACK_MS;
      if (!cancelled) timer = setTimeout(loop, every + Math.random() * 600);
    };
    void loop();
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    const onOnline = () => void refresh();
    const onOffline = () => setStatus("offline");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [key, refresh, live]);

  // canale realtime (solo dati pubblici); i segreti si rileggono dall'endpoint autenticato
  const roomId = state?.roomId ?? null;
  useEffect(() => {
    if (!roomId) return;
    const supabase = getSupabaseBrowser();
    let channel: RealtimeChannel | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let disposed = false;
    const connect = () => {
      if (disposed) return;
      channel = supabase.channel(`qz:game:psyco-${roomId}`, { config: { private: true, broadcast: { self: false } } });
      channel.on("broadcast", { event: "state" }, (msg) => {
        const next = msg.payload as PsycoPublicState | undefined;
        if (!next || typeof next.version !== "number") return;
        const prev = stateRef.current;
        if (!applyState(next, true)) return;
        // dati privati cambiati (ruoli, regola, proposte, votazione nuova): si rilegge la propria vista
        if (sourceRef.current.kind === "room" && (!prev || prev.secretRev !== next.secretRev || prev.phase !== next.phase || prev.round?.vote?.ballot !== next.round?.vote?.ballot)) {
          setTimeout(() => void refresh(), Math.random() * 250);
        }
      });
      channel.subscribe((s) => {
        if (s === "SUBSCRIBED") {
          attempt = 0;
          setStatus("live");
          void refresh();
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          if (disposed) return;
          setStatus(navigator.onLine ? "reconnecting" : "offline");
          const ch = channel;
          channel = null;
          if (ch) void supabase.removeChannel(ch);
          retry = setTimeout(connect, Math.min(15_000, 500 * 2 ** attempt++) + Math.random() * 400);
        }
      });
    };
    connect();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [roomId, applyState, refresh]);

  const now = useCallback(() => Date.now() + offsetRef.current, []);
  return { state, view, status, error, refresh, applyView, now };
}

/** Azione di gioco: ritenta da sola su rete assente / server occupato; risponde con la vista aggiornata. */
export async function psycoAct(roomId: string, action: PsycoAction, as?: string | null): Promise<PsycoView | { done: true }> {
  return withRetry(() => api<PsycoView | { done: true }>(`/api/psyco/rooms/${roomId}/action`, { method: "POST", json: { ...action, ...(as ? { as } : {}) } }), 3, 250);
}

/** Tick leggero per i cronometri. */
export function useTick(active: boolean, ms = 250): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return t;
}
