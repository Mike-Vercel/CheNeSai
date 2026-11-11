/* eslint-disable @next/next/no-img-element -- immagine statica già ottimizzata (webp) */
import { clsx } from "clsx";
import type { ReactNode } from "react";

/**
 * Schermata di caricamento ufficiale (immagine fornita dal locale) con barra
 * di avanzamento animata reale al posto di quella disegnata.
 */
export function LoadingSplash({ label = "Caricamento…", children, className }: { label?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={clsx("relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-night", className)}>
      {/* sfondo sfocato che riempie anche gli schermi larghi (TV) */}
      <img src="/brand/loading-600.webp" alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
      <div className="relative z-10 flex w-full max-w-[min(92vw,62vh)] flex-col items-center gap-5 px-4">
        <img src="/brand/loading.webp" width={1199} height={1110} alt="CHE NE SAI?!" className="h-auto w-full drop-shadow-2xl" />
        <div className="h-4 w-[72%] overflow-hidden rounded-full border-2 border-gold/80 bg-black/60 shadow-[0_0_20px_rgba(255,212,59,.45)]" role="progressbar" aria-label={label}>
          <div className="qz-loading-bar h-full rounded-full bg-gradient-to-r from-gold-deep via-gold to-[#fff3a6]" />
        </div>
        <p className="font-display text-xl text-white/90">{label}</p>
        {children}
      </div>
    </div>
  );
}
