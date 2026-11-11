"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicAuto } from "@/lib/game-engine/types";

/** Risposta di /tick (vedi autoTick in lib/server/engine). */
export interface AutoTickResponse {
  advanced: boolean;
  nextAt: string | null;
  version: number | null;
  waiting: string | null;
}

/** Tentativi massimi per lo stesso passo (orologi un po' diversi, rete che salta). */
const MAX_ATTEMPTS = 6;

/**
 * Scorrimento automatico guidato dal client (TV e regia): quando arriva l'orario del prossimo passo
 * (`auto.nextAt`, ora del server) chiama /tick. Il server decide se il passo è davvero dovuto e lo
 * esegue una volta sola anche se più schermi chiamano insieme: qui basta non chiamare a vuoto.
 * Nessun timer sul server (Vercel serverless): finché un TV o la regia sono aperti la serata va avanti.
 */
export function useAutoTick({
  auto,
  now,
  tick,
  extraDelayMs = 0,
  enabled = true,
}: {
  auto: PublicAuto | null | undefined;
  /** ora del server stimata (ms) */
  now: () => number;
  tick: () => Promise<AutoTickResponse>;
  /** ritardo in più (la regia lascia guidare il TV, se c'è) */
  extraDelayMs?: number;
  enabled?: boolean;
}) {
  const tickRef = useRef(tick);
  const nowRef = useRef(now);
  useEffect(() => {
    tickRef.current = tick;
    nowRef.current = now;
  }, [tick, now]);

  // piano ricevuto dalla risposta del tick (arriva prima dello stato in tempo reale)
  const [fromTick, setFromTick] = useState<PublicAuto | null>(null);
  const target = auto && (!fromTick || auto.version >= fromTick.version) ? auto : fromTick && (!auto || fromTick.version > auto.version) ? fromTick : null;
  const nextAt = target?.nextAt ?? null;
  const version = target?.version ?? null;

  useEffect(() => {
    if (!enabled || !nextAt || version === null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const schedule = (atMs: number) => {
      // un po' di casualità: più TV non chiamano tutti nello stesso millisecondo
      const wait = Math.max(0, atMs - nowRef.current()) + extraDelayMs + Math.random() * 300;
      timer = setTimeout(() => void fire(), Math.min(wait, 2 ** 31 - 1));
    };
    const fire = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const r = await tickRef.current();
        if (cancelled) return;
        if (r.nextAt && r.version !== null && r.version > version) {
          setFromTick({ nextAt: r.nextAt, version: r.version });
          return;
        }
        // non ancora dovuto per il server (orologio leggermente avanti): si riprova all'orario indicato
        if (!r.advanced && r.nextAt && r.version === version && attempts < MAX_ATTEMPTS) schedule(Date.parse(r.nextAt) + 400 * attempts);
      } catch {
        if (!cancelled && attempts < MAX_ATTEMPTS) schedule(nowRef.current() + 1500 * attempts);
      }
    };
    schedule(Date.parse(nextAt));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, nextAt, version, extraDelayMs]);
}
