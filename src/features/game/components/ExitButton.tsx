"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { getSoundEngine } from "@/features/media/audio-engine";
import { getVoice } from "@/features/media/voice";

/** Ferma musica, effetti e voci: da usare prima di lasciare una schermata di gioco. */
export function silenceGame() {
  try {
    getVoice().stop();
  } catch {
    /* motore voce non ancora pronto */
  }
  try {
    getSoundEngine().silenceAll();
  } catch {
    /* motore audio non ancora pronto */
  }
}

/**
 * Tasto "Esci" delle schermate di gioco. Primo tocco: chiede conferma ("Esci davvero?") per 3
 * secondi, così un tocco per sbaglio non fa uscire nessuno. Secondo tocco: spegne tutto l'audio e
 * carica la pagina di destinazione da zero (nessuna musica o scena 3D resta accesa dietro).
 * La partita resta aperta: si può rientrare dal profilo o con lo stesso codice.
 */
export function ExitButton({
  to = "/",
  className,
  size = "md",
  confirm = true,
}: {
  to?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  confirm?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      aria-label={armed ? "Conferma: esci dalla partita" : "Esci dalla partita"}
      onClick={(e) => {
        e.stopPropagation();
        if (confirm && !armed) {
          setArmed(true);
          return;
        }
        silenceGame();
        if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
        window.location.assign(to);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      className={clsx(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-extrabold backdrop-blur transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold",
        armed ? "bg-flame text-white shadow-[0_4px_0_#7a1030]" : "bg-black/55 text-white/90 hover:bg-black/75 hover:text-white",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-base",
        size === "lg" && "h-12 px-5 text-lg",
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-[1.1em] w-[1.1em]" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
        <path d="M10 17l-5-5 5-5" />
        <path d="M5 12h11" />
      </svg>
      {armed ? "Esci davvero?" : "Esci"}
    </button>
  );
}
