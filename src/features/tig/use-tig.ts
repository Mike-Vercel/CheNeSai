"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { LobbyTable, PlayerView, RegiaView, TigAction, TigPublicState, TigView } from "@/lib/tig/types";
import { api, ApiError, uuid, withRetry } from "@/lib/realtime/api-client";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export type LinkStatus = "connecting" | "live" | "reconnecting" | "offline";

const POLL_LIVE_MS = 10_000;
const POLL_FALLBACK_MS = 2_000;
/** prove «a tempo» (indizi che si aprono senza un nuovo stato dal server): rilettura più fitta, solo mentre si gioca */
const POLL_TIMED_MS = 2_500;

export type TigSource = { kind: "event"; eventId: string; as: "player" | "regia" } | { kind: "tv"; displayKey: string; live: boolean };

interface TvResponse {
  state: TigPublicState;
  lobby: LobbyTable[] | null;
}

/**
 * Stato di una serata sincronizzato col server (fonte di verità):
 *  - snapshot via HTTP con stima della differenza d'orologio (stile NTP): timer allineati al server;
 *  - aggiornamenti sul canale realtime PRIVATO 'qz:game:tig-<id>' (solo stato PUBBLICO);
 *  - quando cambiano i dati privati (secretRev, stato, prova) la propria vista si rilegge dall'endpoint autenticato;
 *  - alla partenza della prova e alla scadenza della fase si rilegge lo stato (il server avanza da solo);
 *  - riconnessione, ritorno in primo piano, rete di nuovo online → nuovo snapshot (stato completo).
 */
export function useTig(source: TigSource) {
  const [state, setState] = useState<TigPublicState | null>(null);
  const [view, setView] = useState<PlayerView | RegiaView | null>(null);
  const [lobby, setLobby] = useState<LobbyTable[] | null>(null);
  const [status, setStatus] = useState<LinkStatus>("connecting");
  const [error, setError] = useState<ApiError | null>(null);
  const stateRef = useRef<TigPublicState | null>(null);
  const offsetRef = useRef(0);
  const bestRtt = useRef(Number.POSITIVE_INFINITY);
  const key = source.kind === "event" ? `event:${source.eventId}:${source.as}` : `tv:${source.displayKey}:${source.live}`;
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  });

  const applyState = useCallback((next: TigPublicState, fromRealtime: boolean) => {
    const prev = stateRef.current;
    if (prev && prev.eventId === next.eventId && next.version < prev.version) return false;
    if (prev && fromRealtime && next.version === prev.version) return false;
    if (fromRealtime && !Number.isFinite(bestRtt.current)) offsetRef.current = Date.parse(next.serverNow) - Date.now();
    stateRef.current = next;
    setState(next);
    return true;
  }, []);

  const refresh = useCallback(async () => {
    const src = sourceRef.current;
    const t0 = Date.now();
    try {
      let next: TigPublicState;
      if (src.kind === "event") {
        const r = await api<TigView>(`/api/tig/events/${src.eventId}${src.as === "regia" ? "?as=regia" : ""}`);
        next = r.state;
        setView(r.view);
      } else {
        const r = await api<TvResponse>(`/api/tig/tv/${encodeURIComponent(src.displayKey)}${src.live ? "?live=1" : ""}`);
        next = r.state;
        setLobby(r.lobby);
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
    (r: TigView) => {
      if (r.view) setView(r.view);
      applyState(r.state, false);
    },
    [applyState],
  );

  // snapshot iniziale + polling di sicurezza (anche «battito» di presenza)
  const live = status === "live";
  const timedPlay = state?.state === "GAME_ACTIVE" && state.game?.stage === "play" && !!state.game.timed;
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const every = timedPlay ? POLL_TIMED_MS : live ? POLL_LIVE_MS : POLL_FALLBACK_MS;
    const loop = async () => {
      if (cancelled) return;
      await refresh();
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
  }, [key, refresh, live, timedPlay]);

  // partenza della prova e scadenza della fase: si rilegge (il server fa avanzare la serata)
  const paused = state?.state === "PAUSED";
  const deadline = state && !paused && state.status === "open" ? (state.timer?.deadlineAt ?? null) : null;
  const startsAt = state && !paused && state.game?.stage === "rule" ? state.game.startsAt : null;
  const version = state?.version ?? 0;
  useEffect(() => {
    const times = [deadline, startsAt].filter(Boolean) as string[];
    if (!times.length) return;
    const timers = times.map((t) => {
      const wait = Date.parse(t) - (Date.now() + offsetRef.current) + 300;
      return setTimeout(() => void refresh(), Math.max(120, Math.min(wait, 120_000)) + Math.random() * 250);
    });
    return () => timers.forEach(clearTimeout);
  }, [deadline, startsAt, version, refresh]);

  // canale realtime (solo dati pubblici)
  const eventId = state?.eventId ?? null;
  useEffect(() => {
    if (!eventId) return;
    const supabase = getSupabaseBrowser();
    let channel: RealtimeChannel | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let disposed = false;
    const connect = () => {
      if (disposed) return;
      channel = supabase.channel(`qz:game:tig-${eventId}`, { config: { private: true, broadcast: { self: false } } });
      channel.on("broadcast", { event: "state" }, (msg) => {
        const next = msg.payload as TigPublicState | undefined;
        if (!next || typeof next.version !== "number") return;
        const prev = stateRef.current;
        if (!applyState(next, true)) return;
        const src = sourceRef.current;
        // la vista privata (o la lobby della TV) si rilegge quando cambiano i dati che la riguardano
        if (src.kind === "event" && (!prev || prev.secretRev !== next.secretRev || prev.state !== next.state || prev.game?.id !== next.game?.id)) setTimeout(() => void refresh(), Math.random() * 250);
        if (src.kind === "tv" && (!prev || prev.state !== next.state || prev.teams.length !== next.teams.length || prev.pendingTeams !== next.pendingTeams)) setTimeout(() => void refresh(), Math.random() * 400);
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
  }, [eventId, applyState, refresh]);

  const now = useCallback(() => Date.now() + offsetRef.current, []);
  return { state, view, lobby, status, error, refresh, applyView, now };
}

export interface ActResponse extends TigView {
  result?: Record<string, unknown>;
}

/** Azione: ritenta da sola su rete assente / server occupato (le azioni con chiave di idempotenza sono sicure). */
export async function tigAct(eventId: string, action: TigAction, as: "player" | "regia" = "player"): Promise<ActResponse> {
  return withRetry(() => api<ActResponse>(`/api/tig/events/${eventId}/action${as === "regia" ? "?as=regia" : ""}`, { method: "POST", json: action }), 3, 250);
}

export const newKey = () => uuid();

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
