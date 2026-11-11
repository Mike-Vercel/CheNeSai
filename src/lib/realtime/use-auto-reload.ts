"use client";

import { useEffect } from "react";

/**
 * Ricarica la pagina quando sul server gira una versione nuova dell'app
 * (dopo un aggiornamento), così TV e telefoni non restano con la grafica vecchia.
 * Lo stato di gioco è sempre sul server: ricaricare non fa perdere nulla.
 */
export function useAutoReload(everyMs = 20000) {
  useEffect(() => {
    let first: string | null | undefined;
    let stopped = false;
    const check = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const { version } = (await r.json()) as { version: string | null };
        if (!version) return;
        if (first === undefined) first = version;
        else if (version !== first && !stopped) {
          stopped = true;
          window.location.reload();
        }
      } catch {
        // server momentaneamente irraggiungibile (es. riavvio): si riprova al giro dopo
      }
    };
    void check();
    const id = setInterval(() => void check(), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
}
