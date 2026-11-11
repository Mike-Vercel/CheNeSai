"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import type { TvOverlayContext } from "@/features/display/DisplayApp";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { useTvPrefs } from "@/features/display/tv-prefs";
import { enterFullscreen, unlockMobileAudio } from "@/features/gioca/mobile-show";
import { SeatContext, useSeat } from "@/features/gioca/use-seat";
import type { PublicState } from "@/lib/game-engine/types";
import { IntroSkipButton } from "./IntroSkip";

const DisplayApp = dynamic(() => import("@/features/display/DisplayApp").then((m) => m.DisplayApp), {
  ssr: false,
  loading: () => <LoadingSplash label="Accendo lo show…" />,
});

/**
 * Show sul telefono di un GIOCATORE (partita con lo show «Su questo telefono»): ogni amico, anche
 * in un'altra casa, vede e SENTE lo show completo sul suo telefono (cartello, domanda, risposte da
 * toccare, timer, soluzione, punti, classifiche, intro e podio), come il telefono dell'host.
 * Le voci arrivano solo per le battute della partita (/api/play/tts); la partita la manda avanti
 * solo il telefono dell'host (qui niente scorrimento automatico). Audio attivo di default, con un
 * pulsante per spegnerlo (es. amici nella stessa stanza), ricordato su questo telefono.
 */
export function PlayerPhoneShow({ code, slot, sessionId }: { code: string; slot: string | null; sessionId: string }) {
  const [view, setView] = useState<PublicState | null>(null);
  const onViewState = useCallback((s: PublicState | null) => setView(s), []);
  const { seat } = useSeat(code, view, slot);
  return (
    <SeatContext value={seat}>
      <DisplayApp
        key={sessionId}
        sessionId={sessionId}
        displayKey=""
        layout="portrait"
        viewer={{ code, slot }}
        onViewState={onViewState}
        renderOverlay={(s, ctx) => <PlayerShowOverlay state={s} ctx={ctx} code={code} slot={slot} nickname={seat?.nickname ?? null} />}
      />
    </SeatContext>
  );
}

function PlayerShowOverlay({ state, ctx, code, slot, nickname }: { state: PublicState | null; ctx: TvOverlayContext; code: string; slot: string | null; nickname: string | null }) {
  const [prefs, setPrefs] = useTvPrefs();
  if (!state) return null;
  const vp = state.phase === "PAUSED" && state.pausedFrom ? state.pausedFrom : state.phase;
  const lobby = vp === "LOBBY" || vp === "READY";
  return (
    <div className="font-sans">
      {/* audio del telefono: serve un tocco (regola dei browser); poi si spegne/accende da qui */}
      {!ctx.audioOn ? (
        <button
          type="button"
          onClick={() => {
            void unlockMobileAudio();
            void enterFullscreen();
            ctx.activateAudio();
          }}
          className="absolute left-1/2 top-[40cqh] z-[67] -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-6 py-3 font-display text-xl text-ink shadow-[0_5px_0_#9a5d00]"
        >
          🔊 TOCCA PER L&apos;AUDIO
        </button>
      ) : (
        <button
          type="button"
          aria-pressed={!prefs.muted}
          aria-label={prefs.muted ? "Attiva l'audio" : "Togli l'audio"}
          onClick={() => setPrefs({ muted: !prefs.muted })}
          className="absolute right-3 top-3 z-[66] grid h-11 w-11 place-items-center rounded-full bg-black/55 text-xl text-white backdrop-blur"
          style={{ marginTop: "env(safe-area-inset-top)" }}
        >
          {prefs.muted ? "🔇" : "🔊"}
        </button>
      )}

      {lobby && (
        <div className="absolute inset-x-3 bottom-3 z-[66] rounded-[22px] bg-night/90 p-3 text-center shadow-[0_-10px_40px_rgba(0,0,0,.45)] backdrop-blur-sm" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <p className="text-sm font-black text-[#bfffdc]">✓ Sei dentro{nickname ? ` come ${nickname}` : ""}!</p>
          <p className="mt-1 text-xs font-bold text-white/75">Lo show lo vedi (e lo senti) qui. Aspetta che l&apos;host faccia partire la partita.</p>
        </div>
      )}

      {vp === "INTRO" && state.phase !== "PAUSED" && (
        <div className="absolute inset-x-3 bottom-4 z-[66] flex justify-center" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          <IntroSkipButton code={code} slot={slot} skip={state.introSkip} nickname={nickname} compact className="rounded-[22px] bg-night/85 p-3 backdrop-blur-sm" />
        </div>
      )}
    </div>
  );
}
