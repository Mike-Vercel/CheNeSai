"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/realtime/api-client";

/**
 * "Voci della serata" per il gioco libero: dalla lobby in poi il TV (o il pannello dell'host)
 * fa generare a piccoli lotti tutte le voci della partita (domande, risposte, soluzioni, round,
 * battute fisse), come fa la regia con "Prepara voci". Così in gioco la voce ElevenLabs parte
 * subito invece di essere generata al volo.
 *
 * Una sola finestra alla volta lavora (Web Locks: TV e pannello dello stesso PC non generano due
 * volte la stessa battuta); l'avanzamento passa alle altre finestre con un BroadcastChannel.
 */
export interface VoicePrep {
  configured: boolean;
  total: number;
  ready: number;
  missing: number;
  /** running = sta generando; done = tutte pronte; blocked = budget mensile esaurito; error = guasti ripetuti */
  status: "running" | "done" | "blocked" | "error";
}

interface Progress {
  configured: boolean;
  total: number;
  ready: number;
  missing: number;
  generated?: number;
  blocked?: boolean;
  finished?: boolean;
  liveParts?: number;
}

const BATCH = 4;
const MAX_FAILS = 3;

function channelName(sessionId: string) {
  return `qz-voices:${sessionId}`;
}

export function useVoicePrep({ sessionId, displayKey, active }: { sessionId: string; displayKey: string; active: boolean }): VoicePrep | null {
  const [prep, setPrep] = useState<VoicePrep | null>(null);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    let ch: BroadcastChannel | null = null;
    try {
      ch = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(channelName(sessionId)) : null;
    } catch {
      ch = null;
    }
    if (ch) {
      ch.onmessage = (e) => {
        const d = e.data as VoicePrep | null;
        if (alive && d && typeof d.total === "number") setPrep(d);
      };
    }
    const publish = (p: VoicePrep) => {
      if (!alive) return;
      setPrep(p);
      ch?.postMessage(p);
    };
    const url = `/api/display/${sessionId}/voices?k=${encodeURIComponent(displayKey)}`;
    const toPrep = (r: Progress, status: VoicePrep["status"]): VoicePrep => ({ configured: r.configured, total: r.total, ready: r.ready, missing: r.missing, status });

    const work = async () => {
      let r: Progress;
      try {
        r = await api<Progress>(url, { method: "POST", json: { action: "estimate" } });
      } catch {
        return;
      }
      if (!alive) return;
      if (!r.configured || r.total === 0) {
        publish(toPrep(r, "done"));
        return;
      }
      const pending = (x: Progress) => x.missing > 0 || (x.liveParts ?? 0) > 0;
      publish(toPrep(r, r.missing === 0 ? "done" : "running"));
      let fails = 0;
      // prima le battute della serata, poi i "nomi salvati" dei giocatori collegati
      while (alive && pending(r)) {
        try {
          const b = await api<Progress>(url, { method: "POST", json: { action: "run", batch: BATCH }, timeoutMs: 60000 });
          if (!alive) return;
          r = b;
          if (b.blocked) {
            publish(toPrep(b, "blocked"));
            return;
          }
          if (b.finished) {
            publish(toPrep(b, "done"));
            return;
          }
          fails = b.generated === 0 && pending(b) ? fails + 1 : 0;
          publish(toPrep(b, b.missing === 0 ? "done" : "running"));
        } catch (e) {
          fails++;
          // troppe richieste: si rallenta un attimo
          if (e instanceof ApiError && e.status === 429) await new Promise((res) => setTimeout(res, 8000));
        }
        if (fails >= MAX_FAILS) {
          publish(toPrep(r, "error"));
          return;
        }
      }
    };

    const ctrl = new AbortController();
    const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
    if (locks) {
      void locks.request(channelName(sessionId), { signal: ctrl.signal }, async () => {
        if (alive) await work();
      }).catch(() => undefined);
    } else {
      void work();
    }
    return () => {
      alive = false;
      ctrl.abort();
      ch?.close();
    };
  }, [active, sessionId, displayKey]);

  return prep;
}

/** "Voci pronte 34/120" (null se la voce professionale non è attiva). */
export function voicePrepLabel(p: VoicePrep | null): string | null {
  if (!p || !p.configured || p.total === 0) return null;
  if (p.status === "done" && p.missing === 0) return "Voci pronte ✓";
  if (p.status === "blocked") return `Voci pronte ${p.ready}/${p.total} · budget esaurito`;
  return `Voci pronte ${p.ready}/${p.total}`;
}
