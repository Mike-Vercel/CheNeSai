"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import type { PublicState } from "@/lib/game-engine/types";

const DisplayApp = dynamic(() => import("./DisplayApp").then((m) => m.DisplayApp), {
  ssr: false,
  loading: () => <LoadingSplash label="Accendo lo show…" />,
});

/**
 * VISTA PER LA LIVE (da catturare con OBS / TikTok LIVE Studio): lo show orizzontale pulito, in un
 * riquadro 16:9, con presentatori, animazioni, voci, punti e classifiche, ma senza codice, QR, link,
 * comandi né puntatore, e senza nessuna risposta prima della soluzione (qui nessuno gioca: la
 * risposta scelta resta nella finestra di gioco). Segue da sola la rivincita (stesso codice).
 */
export function LiveStream({ sessionId, token, audio }: { sessionId: string; token: string | null; audio: boolean }) {
  const router = useRouter();
  useEffect(() => {
    document.title = "CHE NE SAI?! · LIVE";
  }, []);
  const onViewState = useCallback(
    (s: PublicState | null) => {
      const next = s?.rematch?.sessionId;
      if (!next || next === sessionId) return;
      const qs = new URLSearchParams();
      if (token) qs.set("t", token);
      if (!audio) qs.set("audio", "0");
      const q = qs.toString();
      router.replace(`/gioca/live/${next}${q ? `?${q}` : ""}`);
    },
    [router, sessionId, token, audio],
  );
  return (
    <DisplayApp
      key={sessionId}
      sessionId={sessionId}
      displayKey=""
      layout="landscape"
      stream={{ token, audio }}
      onViewState={onViewState}
      renderOverlay={(_s, ctx) =>
        audio && !ctx.audioOn ? (
          // l'audio parte da solo nella Sorgente browser di OBS; in una finestra del browser serve un clic
          <button
            type="button"
            onClick={() => ctx.activateAudio()}
            className="absolute left-1/2 top-[2cqh] z-[67] -translate-x-1/2 cursor-pointer whitespace-nowrap rounded-full bg-gold px-6 py-2.5 font-display text-xl text-ink shadow-[0_5px_0_#9a5d00]"
          >
            🔊 CLICCA PER L&apos;AUDIO DELLA LIVE
          </button>
        ) : null
      }
    />
  );
}
