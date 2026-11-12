"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PublicState } from "@/lib/game-engine/types";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

interface Options {
  /** Recupera lo snapshot completo dal server (fonte di verità). */
  fetchSnapshot: () => Promise<PublicState>;
  /** Polling di sicurezza (non aggressivo): lo stato arriva normalmente via realtime. */
  safetyPollMs: number;
  enabled?: boolean;
  onState?: (s: PublicState, prev: PublicState | null) => void;
  /** Altri eventi broadcast da ascoltare (es. "media" per il TV). */
  onEvent?: (event: string, payload: unknown) => void;
  extraEvents?: string[];
}

/** Polling quando il canale realtime non è collegato. */
const FALLBACK_POLL_MS = 1500;

/**
 * Stato di gioco sincronizzato:
 * - snapshot iniziale via HTTP (con stima della differenza di orologio)
 * - aggiornamenti via Supabase Realtime Broadcast (canale qz:game:<id>)
 * - ordinamento per versione: i messaggi vecchi o fuori ordine sono scartati
 * - al ricollegamento / ritorno in primo piano / rete di nuovo online:
 *   nuovo snapshot (nessuna dipendenza dalla memoria volatile)
 */
export function useGameState({ fetchSnapshot, safetyPollMs, enabled = true, onState, onEvent, extraEvents }: Options) {
  const [state, setState] = useState<PublicState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef<PublicState | null>(null);
  const offsetRef = useRef(0);
  const bestRttRef = useRef(Number.POSITIVE_INFINITY);
  const fetchRef = useRef(fetchSnapshot);
  const onStateRef = useRef(onState);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    fetchRef.current = fetchSnapshot;
    onStateRef.current = onState;
    onEventRef.current = onEvent;
  });
  const extraKey = (extraEvents ?? []).join(",");

  const apply = useCallback((next: PublicState, source: "snapshot" | "realtime") => {
    const prev = stateRef.current;
    if (prev && prev.sessionId === next.sessionId && next.version < prev.version) return; // fuori ordine
    // stessa versione via realtime: si accetta solo l'avviso "il TV ha illuminato la risposta"
    if (prev && prev.sessionId === next.sessionId && next.version === prev.version && source === "realtime" && next.revealShown === prev.revealShown && next.questionShown === prev.questionShown) return;
    if (source === "realtime") {
      // stima grezza dell'offset anche dai broadcast (latenza inclusa): usata solo se non c'è di meglio
      if (!Number.isFinite(bestRttRef.current)) offsetRef.current = Date.parse(next.serverNow) - Date.now();
    }
    stateRef.current = next;
    setState(next);
    onStateRef.current?.(next, prev);
  }, []);

  const refresh = useCallback(async () => {
    const t0 = Date.now();
    try {
      const s = await fetchRef.current();
      const t1 = Date.now();
      const rtt = t1 - t0;
      // Sincronizzazione orologio stile NTP: si tiene il campione con RTT minimo.
      if (rtt <= bestRttRef.current * 1.5 || rtt < 400) {
        offsetRef.current = Date.parse(s.serverNow) - (t0 + rtt / 2);
        bestRttRef.current = Math.min(bestRttRef.current, rtt);
      }
      setError(null);
      apply(s, "snapshot");
      return s;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore di connessione");
      return null;
    }
  }, [apply]);

  const sessionId = state?.sessionId ?? null;

  // Snapshot iniziale + polling di sicurezza (rapido finché il realtime non è collegato)
  const live = status === "live";
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loop = async () => {
      if (cancelled) return;
      await refresh();
      // senza canale realtime (rete che blocca i websocket, firewall…) si controlla spesso,
      // così regia e telefoni restano allineati entro ~1,5 s invece di aspettare il polling lento
      const every = live ? safetyPollMs : Math.min(safetyPollMs, FALLBACK_POLL_MS);
      if (!cancelled) timer = setTimeout(loop, every + Math.random() * (live ? 500 : 150));
    };
    void loop();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onOnline = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", () => setStatus("offline"));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [enabled, refresh, safetyPollMs, live]);

  // Canale realtime (con riconnessione automatica gestita dal client Supabase + backoff)
  useEffect(() => {
    if (!enabled || !sessionId) return;
    const supabase = getSupabaseBrowser();
    let channel: RealtimeChannel | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      // Canale PRIVATO: ricezione autorizzata via RLS, invio vietato ai client.
      channel = supabase.channel(`qz:game:${sessionId}`, { config: { private: true, broadcast: { self: false } } });
      channel.on("broadcast", { event: "state" }, (msg) => {
        const payload = msg.payload as PublicState | undefined;
        if (payload && typeof payload.version === "number") apply(payload, "realtime");
      });
      for (const ev of extraKey ? extraKey.split(",") : []) {
        channel.on("broadcast", { event: ev }, (msg) => onEventRef.current?.(ev, msg.payload));
      }
      channel.subscribe((s) => {
        if (s === "SUBSCRIBED") {
          attempt = 0;
          setStatus("live");
          void refresh(); // recupera eventuali messaggi persi durante la disconnessione
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          if (disposed) return;
          setStatus(navigator.onLine ? "reconnecting" : "offline");
          const ch = channel;
          channel = null;
          if (ch) void supabase.removeChannel(ch);
          const delay = Math.min(15000, 500 * 2 ** attempt++) + Math.random() * 400;
          retry = setTimeout(connect, delay);
        }
      });
    };
    connect();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled, sessionId, apply, refresh, extraKey]);

  /** Ora del server stimata (ms epoch). */
  const now = useCallback(() => Date.now() + offsetRef.current, []);

  return { state, status, error, refresh, now, applyState: (s: PublicState) => apply(s, "snapshot") };
}

/** Tick periodico per i countdown (requestAnimationFrame-free, leggero). */
export function useTicker(active: boolean, intervalMs = 200): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return tick;
}
