"use client";

import dynamic from "next/dynamic";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";

/** L'app giocatore è solo client (cookie di sessione letti dalle API, storage locale). */
export const PlayerClient = dynamic(() => import("./PlayerApp").then((m) => m.PlayerApp), {
  ssr: false,
  loading: () => <LoadingSplash label="Si accendono le luci…" />,
});
