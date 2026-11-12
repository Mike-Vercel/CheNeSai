"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { GiramenteAction, GiramenteView, PrivateView, PublicState } from "@/lib/giramente/types";
import { api, ApiError, uuid, withRetry } from "@/lib/realtime/api-client";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export type LinkStatus = "connecting" | "live" | "reconnecting" | "offline";

const POLL_LIVE_MS = 10_000;
const POLL_FALLBACK_MS = 2_000;

interface Options {
  source: { kind: "room"; roomId: string } | { kind: "display"; displayKey: string };
  onState?: (next: PublicState, prev: PublicState | null) => void;
}

/**
 * Stato di una partita GIRAMENTE! sincronizzato col server (fonte di verità):
 *  - snapshot via HTTP con stima della differenza d'orologio (stile NTP): ruota e timer usano l'ora del server;
 *  - aggiornamenti sul canale realtime PRIVATO 'qz:game:giramente-<id>' (solo stato PUBBLICO);
 *  - quando cambiano i dati privati (secretRev, fase) la propria vista si rilegge dall'endpoint autenticato;
 *  - alla scadenza di una fase si rilegge lo stato: il server avanza da solo (anche se nessuno tocca nulla);
 *  - riconnessione, ritorno in primo piano, rete di nuovo online → nuovo snapshot: chi ha perso le
 *    animazioni ricostruisce comunque lo stato giusto.
 */
export function useGiramente({ source, onState }: Options) {
  const [state, setState] = useState<PublicState | null>(null);
  const [view, setView] = useState<PrivateView | null>(null);
  const [status, setStatus] = useState<LinkStatus>("connecting");
  const [error, setError] = useState<ApiError | null>(null);
  const stateRef = useRef<PublicState | null>(null);
  const offsetRef = useRef(0);
  const bestRtt = useRef(Number.POSITIVE_INFINITY);
  const onStateRef = useRef(onState);
  useEffect(() => {
    onStateRef.current = onState;
  });
  const key = source.kind === "room" ? `room:${source.roomId}` : `display:${source.displayKey}`;
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  });

  const applyState = useCallback((next: PublicState, fromRealtime: boolean) => {
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
      let next: PublicState;
      if (src.kind === "room") {
        const r = await api<GiramenteView>(`/api/giramente/rooms/${src.roomId}`);
        next = r.state;
        setView(r.view);
      } else {
        next = await api<PublicState>(`/api/giramente/schermo/${encodeURIComponent(src.displayKey)}`);
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

  const applyView = useCallback(
    (r: GiramenteView) => {
      setView(r.view);
      applyState(r.state, false);
    },
    [applyState],
  );

  // snapshot iniziale + polling di sicurezza (anche «battito» di presenza)
  const live = status === "live";
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loop = async () => {
      if (cancelled) return;
      await refresh();
      if (!cancelled) timer = setTimeout(loop, (live ? POLL_LIVE_MS : POLL_FALLBACK_MS) + Math.random() * 600);
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

  // scadenza della fase (o delle prove): si rilegge lo stato, il server fa avanzare la partita
  const deadline = state && !state.pausedAt && state.status === "open" ? (state.phaseTimer.deadlineAt ?? state.stagePlay?.timer.deadlineAt ?? null) : null;
  const version = state?.version ?? 0;
  useEffect(() => {
    if (!deadline) return;
    const wait = Date.parse(deadline) - (Date.now() + offsetRef.current) + 350;
    const t = setTimeout(() => void refresh(), Math.max(150, Math.min(wait, 120_000)) + Math.random() * 300);
    return () => clearTimeout(t);
  }, [deadline, version, refresh]);

  // canale realtime (solo dati pubblici)
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
      channel = supabase.channel(`qz:game:giramente-${roomId}`, { config: { private: true, broadcast: { self: false } } });
      channel.on("broadcast", { event: "state" }, (msg) => {
        const next = msg.payload as PublicState | undefined;
        if (!next || typeof next.version !== "number") return;
        const prev = stateRef.current;
        if (!applyState(next, true)) return;
        if (sourceRef.current.kind === "room" && (!prev || prev.secretRev !== next.secretRev || prev.phase !== next.phase)) {
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
export async function gmAct(roomId: string, action: GiramenteAction): Promise<GiramenteView | { done: true }> {
  return withRetry(() => api<GiramenteView | { done: true }>(`/api/giramente/rooms/${roomId}/action`, { method: "POST", json: action }), 3, 250);
}

export const newRequestId = () => uuid();

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
