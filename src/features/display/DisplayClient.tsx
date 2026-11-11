"use client";

import dynamic from "next/dynamic";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";

/** Il TV è solo client (audio, fullscreen, preferenze locali, WebGL). */
export const DisplayClient = dynamic(() => import("./DisplayApp").then((m) => m.DisplayApp), {
  ssr: false,
  loading: () => <LoadingSplash label="Collegamento allo studio…" />,
});
