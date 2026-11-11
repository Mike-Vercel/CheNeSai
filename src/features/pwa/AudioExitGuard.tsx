"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { silenceGame } from "@/features/game/components/ExitButton";

/** Pagine dove suonano musica, effetti e voci (TV, telefoni, regia, anteprime). */
const GAME_ROUTE = /^\/(gioca\/(partita|tv|telefono|schermo|telecomando|collega)|display|play|tv|preview)(\/|$)/;

/**
 * Quando si lascia il gioco senza ricaricare la pagina (tasto indietro, logo, link del sito) il
 * motore audio resterebbe acceso e la sigla continuerebbe sulla home: qui si spegne tutto.
 */
export function AudioExitGuard() {
  const pathname = usePathname();
  const prev = useRef(pathname);
  useEffect(() => {
    const was = prev.current;
    prev.current = pathname;
    if (was && was !== pathname && GAME_ROUTE.test(was) && !GAME_ROUTE.test(pathname ?? "")) silenceGame();
  }, [pathname]);
  return null;
}
