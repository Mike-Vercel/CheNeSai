"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import type { TvOverlayContext } from "@/features/display/DisplayApp";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { useTvPrefs } from "@/features/display/tv-prefs";
import { enterFullscreen, unlockMobileAudio } from "@/features/gioca/mobile-show";
import { SeatContext, useSeat } from "@/features/gioca/use-seat";
import { AudioChip, CopyInvite, LobbyDock, RoundButton, ScoreHud, TopRightCluster } from "@/features/gioca/DesktopShowControls";
import { LiveViewButton } from "@/features/gioca/LiveViewButton";
import { useShowLayout } from "@/features/shared/device";
import type { PublicState } from "@/lib/game-engine/types";
import { IntroSkipButton } from "./IntroSkip";
import { ExitButton } from "@/features/game/components/ExitButton";

const DisplayApp = dynamic(() => import("@/features/display/DisplayApp").then((m) => m.DisplayApp), {
  ssr: false,
  loading: () => <LoadingSplash label="Accendo lo show…" />,
});

/**
 * Show sul dispositivo di un GIOCATORE (partita ONLINE, show su ogni dispositivo): ogni amico, anche
 * in un'altra casa, vede e SENTE lo show completo (cartello, domanda, risposte da scegliere, timer,
 * soluzione, punti, classifiche, intro e podio), come l'host.
 * - Telefono (o finestra stretta): show verticale, risposte da toccare.
 * - PC / tablet in orizzontale: show orizzontale del TV con le risposte da cliccare (o tasti 1–4 e
 *   Invio), i miei punti in alto a destra e la «Vista per la LIVE» per chi fa una diretta.
 * Le voci arrivano solo per le battute della partita (/api/play/tts); la partita la manda avanti il
 * dispositivo dell'host; se l'host sparisce, i giocatori chiedono il passo di riserva (vedi
 * DisplayApp, /api/play/[code]/tick). Audio attivo di default, con un pulsante per spegnerlo.
 */
export function PlayerPhoneShow({
  code,
  slot,
  sessionId,
  onShowState,
}: {
  code: string;
  slot: string | null;
  sessionId: string;
  /** stato visto dallo show, per la pagina che lo contiene (un solo canale in tempo reale) */
  onShowState?: (s: PublicState | null) => void;
}) {
  const [view, setView] = useState<PublicState | null>(null);
  const onViewState = useCallback(
    (s: PublicState | null) => {
      setView(s);
      onShowState?.(s);
    },
    [onShowState],
  );
  const { seat } = useSeat(code, view, slot);
  const layout = useShowLayout();
  const desktop = layout === "landscape";
  return (
    <SeatContext value={seat}>
      <DisplayApp
        key={sessionId}
        sessionId={sessionId}
        displayKey=""
        layout={layout}
        variant={desktop ? "online" : "tv"}
        viewer={{ code, slot }}
        onViewState={onViewState}
        renderOverlay={(s, ctx) =>
          desktop ? (
            <DesktopPlayerOverlay state={s} ctx={ctx} code={code} slot={slot} nickname={seat?.nickname ?? null} />
          ) : (
            <PlayerShowOverlay state={s} ctx={ctx} code={code} slot={slot} nickname={seat?.nickname ?? null} />
          )
        }
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
          aria-label={prefs.muted ? "Attiva l'audio" : "Togli l'audio"}
          onClick={() => setPrefs({ muted: !prefs.muted })}
          className="absolute bottom-3 right-3 z-[66] grid h-11 w-11 place-items-center rounded-full bg-black/55 text-xl text-white backdrop-blur"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          {prefs.muted ? "🔇" : "🔊"}
        </button>
      )}

      {!lobby && (
        <div className={vp === "INTRO" ? "absolute left-3 top-1.5 z-[66]" : "absolute bottom-3 left-3 z-[66]"} style={vp === "INTRO" ? { marginTop: "env(safe-area-inset-top)" } : { marginBottom: "env(safe-area-inset-bottom)" }}>
          <ExitButton size="sm" className={vp === "INTRO" ? "!h-9" : "!h-11"} />
        </div>
      )}

      {lobby && (
        <div className="absolute inset-x-3 bottom-3 z-[66] rounded-[22px] bg-night/90 p-3 text-center shadow-[0_-10px_40px_rgba(0,0,0,.45)] backdrop-blur-sm" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <p className="text-sm font-black text-[#bfffdc]">✓ Sei dentro{nickname ? ` come ${nickname}` : ""}!</p>
          <p className="mt-1 text-xs font-bold text-white/75">Lo show lo vedi (e lo senti) qui. Aspetta che l&apos;host faccia partire la partita.</p>
          <div className="mt-2 flex justify-center">
            <ExitButton size="sm" />
          </div>
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

/** Giocatore sul PC (show orizzontale): lobby con giocatori, codice e link da copiare; in partita punti, audio, LIVE ed Esci. */
function DesktopPlayerOverlay({ state, ctx, code, slot, nickname }: { state: PublicState | null; ctx: TvOverlayContext; code: string; slot: string | null; nickname: string | null }) {
  const [prefs, setPrefs] = useTvPrefs();
  if (!state) return null;
  const vp = state.phase === "PAUSED" && state.pausedFrom ? state.pausedFrom : state.phase;
  const lobby = vp === "LOBBY" || vp === "READY";
  const audioToggle = ctx.audioOn && (
    <RoundButton label={prefs.muted ? "Attiva l'audio" : "Togli l'audio"} onClick={() => setPrefs({ muted: !prefs.muted })}>
      {prefs.muted ? "🔇" : "🔊"}
    </RoundButton>
  );
  return (
    <div className="font-sans">
      <AudioChip ctx={ctx} />
      {lobby ? (
        <LobbyDock
          left={
            <>
              <p className="text-base font-black text-[#bfffdc]">✓ Sei dentro{nickname ? ` come ${nickname}` : ""}!</p>
              <p className="text-sm font-bold text-white/80">Lo show lo vedi e lo senti qui: quando arrivano le domande clicca la risposta o premi 1–4 (Invio per confermare le risposte multiple).</p>
              <p className="text-sm font-bold text-white/60">Aspetta che l&apos;host faccia partire la partita.</p>
            </>
          }
          right={
            <>
              {state.code && <CopyInvite code={state.code} />}
              <div className="flex items-center justify-between gap-2">
                <LiveViewButton sessionId={state.sessionId} placement="up" />
                <div className="flex items-center gap-2">
                  {audioToggle}
                  <ExitButton size="sm" />
                </div>
              </div>
            </>
          }
        />
      ) : (
        <TopRightCluster>
          <ScoreHud phase={state.phase} />
          {audioToggle}
          <LiveViewButton sessionId={state.sessionId} />
          <ExitButton size="sm" className="!h-11" />
        </TopRightCluster>
      )}

      {vp === "INTRO" && state.phase !== "PAUSED" && (
        <div className="absolute inset-x-0 bottom-[3cqh] z-[66] flex justify-center">
          <IntroSkipButton code={code} slot={slot} skip={state.introSkip} nickname={nickname} compact className="rounded-[22px] bg-night/85 p-3 backdrop-blur-sm" />
        </div>
      )}
    </div>
  );
}
