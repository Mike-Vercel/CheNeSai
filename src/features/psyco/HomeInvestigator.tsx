"use client";

import { useSyncExternalStore } from "react";
import { PsycoNarratorSlot } from "./NarratorSlot";

/**
 * L'Investigatore 3D nella home di PSYCO, dal primo istante: nella sua cornice con la targhetta.
 *  - PC (≥ 1024 px): ritratto grande a destra, sopra la copertina;
 *  - telefono: ritratto medio con il benvenuto nel fumetto, sotto la copertina.
 * Uno solo dei due esiste davvero (un solo canvas 3D per pagina), scelto dalla larghezza dello schermo.
 * Senza voce (la home non parla): respira, sbatte gli occhi, si guarda intorno (animazione Idle).
 * Intanto il modello resta in cache per l'intro e le schermate della partita.
 */
const WIDE = "(min-width: 1024px)";

function useWide(): boolean | null {
  return useSyncExternalStore(
    (fn) => {
      const mq = window.matchMedia(WIDE);
      mq.addEventListener("change", fn);
      return () => mq.removeEventListener("change", fn);
    },
    () => window.matchMedia(WIDE).matches,
    () => null,
  );
}

export function HomeInvestigator({ variant }: { variant: "desktop" | "mobile" }) {
  const wide = useWide();
  if (wide === null || wide !== (variant === "desktop")) return null;
  if (variant === "desktop") {
    return (
      <div className="pointer-events-none absolute right-[max(2rem,calc((100vw-72rem)/2))] top-1/2 z-10 -translate-y-[42%]">
        <div className="psy-hero-float">
          <PsycoNarratorSlot size="hero" plate />
        </div>
      </div>
    );
  }
  return (
    <div className="flex w-full max-w-xl items-center gap-4">
      <PsycoNarratorSlot size="lg" plate className="!h-[min(58vw,15rem)] !w-[min(45vw,11.5rem)]" />
      <p className="psy-bubble psy-type rounded-2xl px-3 py-2 text-base text-paper">Benvenuto nel mio ufficio. Siediti… e non fidarti di nessuno.</p>
    </div>
  );
}
