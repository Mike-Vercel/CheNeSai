"use client";

import { clsx } from "clsx";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TvOverlayContext } from "@/features/display/DisplayApp";
import { tvWindowName } from "@/features/display/screen-picker";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import type { PublicState } from "@/lib/game-engine/types";
import { AudioSettings, DisplaySettings, GameSettings, PlayersSettings, Section, TvScreenSettings, useHostStatus, VoicesProgress } from "./HostSettings";
import { InviteButton } from "./InviteButton";
import { RematchControls } from "./RematchControls";
import { useHostCommand } from "./use-host-command";
import { useVoicePrep } from "./use-voice-prep";

const DisplayApp = dynamic(() => import("@/features/display/DisplayApp").then((m) => m.DisplayApp), {
  ssr: false,
  loading: () => <LoadingSplash label="Collegamento allo studio…" />,
});

/**
 * TV del gioco libero aperto dall'host (su questo schermo o sul televisore).
 * - Lobby: QR e codice grandi, e in basso un solo pulsante «INIZIA PARTITA» (con almeno un giocatore).
 * - Icona impostazioni (ingranaggio) sempre disponibile: in lobby, pausa e podio resta visibile,
 *   durante il gioco compare muovendo il mouse. Dentro: schermo, audio, partita, giocatori,
 *   scorrimento, QR e voci della serata.
 * - Podio: «RIVINCITA» (stesso QR, giocatori dentro, domande nuove).
 * - Le voci della serata si preparano da sole dalla lobby in poi.
 */
export function HostTv({ sessionId, displayKey, canCreateMore }: { sessionId: string; displayKey: string; canCreateMore: boolean }) {
  useEffect(() => {
    // il pannello dell'host (altro schermo) ritrova questa finestra con "Riapri TV"
    try {
      window.name = tvWindowName(sessionId);
    } catch {
      /* ignora */
    }
  }, [sessionId]);
  return (
    <DisplayApp
      key={sessionId}
      sessionId={sessionId}
      displayKey={displayKey}
      hostMode
      renderOverlay={(s, ctx) => <HostTvOverlay sessionId={sessionId} displayKey={displayKey} state={s} ctx={ctx} canCreateMore={canCreateMore} />}
    />
  );
}

const PINNED: readonly string[] = ["READY", "LOBBY", "PAUSED", "FINISHED"];

/** Il TV è a schermo intero? (anche F11 conta: finestra grande quanto lo schermo) */
function useFullscreen(): boolean {
  const [fs, setFs] = useState(true);
  useEffect(() => {
    const sync = () => setFs(!!document.fullscreenElement || (window.innerHeight >= screen.height - 2 && window.innerWidth >= screen.width - 2));
    const t = setTimeout(sync, 0);
    document.addEventListener("fullscreenchange", sync);
    window.addEventListener("resize", sync);
    return () => {
      clearTimeout(t);
      document.removeEventListener("fullscreenchange", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);
  return fs;
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function HostTvOverlay({ sessionId, displayKey, state, ctx, canCreateMore }: { sessionId: string; displayKey: string; state: PublicState | null; ctx: TvOverlayContext; canCreateMore: boolean }) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phase = state?.phase ?? "LOBBY";
  const prep = useVoicePrep({ sessionId, displayKey, active: !!state && phase !== "FINISHED" });
  const [status, refreshStatus] = useHostStatus(sessionId, sheet ? state : null);
  const start = useHostCommand(sessionId);
  const fullscreen = useFullscreen();

  useEffect(() => {
    const wake = () => {
      setActive(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setActive(false), 3500);
    };
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", wake);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!sheet && !qrOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSheet(false);
        setQrOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, qrOpen]);

  // rivincita partita (anche dall'altro schermo): il TV passa da solo alla nuova partita, stesso QR
  const goTo = useCallback((id: string) => router.replace(`/gioca/tv/${id}`), [router]);
  const next = state?.rematch?.sessionId ?? null;
  useEffect(() => {
    if (next) goTo(next);
  }, [next, goTo]);

  if (!state) return null;
  const pinned = PINNED.includes(phase);
  const showGear = pinned || active || sheet;
  const lobby = phase === "LOBBY" || phase === "READY";

  return (
    <div onDoubleClick={(e) => e.stopPropagation()}>
      {/* in alto a destra: voci della serata (in lobby) e ingranaggio */}
      <div className={clsx("absolute right-[1.2cqw] top-[1.6cqh] z-[68] flex items-center gap-3 transition-opacity duration-300", showGear ? "opacity-100" : "pointer-events-none opacity-0")}>
        {(lobby || sheet) && <VoicesProgress prep={prep} compact />}
        <button
          type="button"
          aria-label="Impostazioni"
          aria-expanded={sheet}
          onClick={() => setSheet((s) => !s)}
          className="grid h-12 w-12 place-items-center rounded-full bg-black/55 text-white/90 backdrop-blur transition hover:rotate-45 hover:bg-black/75 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
        >
          <GearIcon />
        </button>
      </div>

      {/* audio non ancora attivo (finestra aperta senza clic): un clic ovunque lo attiva */}
      {/* TV non ancora a schermo intero o senza audio (pagina aperta senza un clic, regola dei browser):
          un solo pulsante grande che fa tutto, mai una finestra a metà */}
      {(!ctx.audioOn || !fullscreen) && (
        <button
          type="button"
          onClick={() => {
            if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
            ctx.activateAudio();
          }}
          className="absolute left-1/2 top-[5cqh] z-[67] -translate-x-1/2 rounded-full bg-gold px-8 py-4 font-display text-[clamp(1.2rem,2.2cqw,2.2rem)] text-ink shadow-[0_6px_0_#9a5d00] transition hover:bg-white"
        >
          {!fullscreen && !ctx.audioOn ? "▶ AVVIA IL TV (schermo intero e audio)" : !fullscreen ? "⛶ SCHERMO INTERO" : "🔊 ATTIVA L'AUDIO"}
        </button>
      )}

      {/* lobby: un solo pulsante grande */}
      {phase === "LOBBY" && (
        <div className="absolute bottom-[3cqh] left-[3cqw] z-[66] flex max-w-[44cqw] flex-col items-start gap-2 rounded-[28px] bg-night/80 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="qz-play rounded-full bg-gold px-10 py-4 font-display text-[clamp(1.6rem,3.2cqw,3rem)] leading-none text-ink transition hover:bg-white disabled:opacity-40"
            disabled={!!start.busy || state.playerCount < 1}
            onClick={() => void start.run("start")}
          >
            {start.busy ? "PARTE…" : "▶ INIZIA PARTITA"}
          </button>
          <p className="px-2 text-base font-bold text-white/85">
            {state.playerCount < 1 ? "Aspetta che entri almeno un giocatore dal telefono." : `${state.playerCount} ${state.playerCount === 1 ? "giocatore pronto" : "giocatori pronti"}: si parte con l'intro e le regole.`}
          </p>
          <InviteButton code={state.code} tone="sheet" className="px-1" />
          {start.error && (
            <p role="alert" className="px-2 text-sm font-bold text-[#ffb3c1]">
              {start.error}
            </p>
          )}
        </div>
      )}

      {phase === "PAUSED" && (
        <div className="absolute bottom-[3cqh] left-1/2 z-[66] -translate-x-1/2">
          <button type="button" className="qz-play rounded-full bg-gold px-10 py-4 font-display text-3xl text-ink hover:bg-white" disabled={!!start.busy} onClick={() => void start.run("resume")}>
            ▶ RIPRENDI
          </button>
        </div>
      )}

      {phase === "FINISHED" && (
        <div className="absolute bottom-[3cqh] left-[3cqw] z-[66] flex max-w-[50cqw] flex-col gap-3 rounded-[28px] bg-night/85 p-5 backdrop-blur-sm">
          <RematchControls sessionId={sessionId} onStarted={goTo} size="tv" />
          <div className="flex flex-wrap gap-2">
            {canCreateMore && (
              <Link href="/gioca" className="rounded-full bg-white/12 px-5 py-2.5 text-base font-black text-white hover:bg-white/25">
                Nuova partita
              </Link>
            )}
            <Link href="/" className="rounded-full bg-white/12 px-5 py-2.5 text-base font-black text-white hover:bg-white/25">
              Torna alla home
            </Link>
          </div>
        </div>
      )}

      {sheet && (
        <>
          <button type="button" aria-label="Chiudi impostazioni" className="absolute inset-0 z-[74] cursor-default bg-black/30" onClick={() => setSheet(false)} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Impostazioni"
            className="absolute inset-y-0 right-0 z-[75] flex w-[min(440px,100%)] flex-col bg-[#1a0b2c]/97 text-white shadow-[-20px_0_60px_rgba(0,0,0,.5)]"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="font-display text-2xl leading-none">Impostazioni</h2>
                <p className="mt-1 text-sm font-bold text-white/60">
                  Codice <span className="tracking-[0.15em] text-gold">{state.code}</span> · {state.playerCount} {state.playerCount === 1 ? "giocatore" : "giocatori"}
                </p>
              </div>
              <button type="button" aria-label="Chiudi" onClick={() => setSheet(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl font-bold hover:bg-white/20">
                ✕
              </button>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              <Section title="Partita">
                <GameSettings sessionId={sessionId} state={state} status={status} onChanged={refreshStatus} />
                {phase === "FINISHED" && <RematchControls sessionId={sessionId} onStarted={goTo} />}
              </Section>
              <Section title={`Giocatori (${state.playerCount})`}>
                <button
                  type="button"
                  className="w-fit rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20"
                  onClick={() => {
                    setQrOpen(true);
                    setSheet(false);
                  }}
                >
                  ▦ Mostra QR e codice sul TV
                </button>
                <InviteButton code={state.code} tone="sheet" />
                <PlayersSettings sessionId={sessionId} status={status} onChanged={refreshStatus} />
              </Section>
              <Section title="Schermo">
                <TvScreenSettings />
              </Section>
              <Section title="Audio">
                {!ctx.audioOn && (
                  <button type="button" className="w-fit rounded-full bg-gold px-4 py-2 text-sm font-black text-ink" onClick={ctx.activateAudio}>
                    🔊 Attiva l&apos;audio
                  </button>
                )}
                <AudioSettings onTestVoices={ctx.testVoices} />
              </Section>
              <Section title="Voci della serata">
                <VoicesProgress prep={prep} />
              </Section>
              <Section title="Grafica">
                <DisplaySettings />
              </Section>
            </div>
          </aside>
        </>
      )}

      {qrOpen && (
        <div role="dialog" aria-modal="true" aria-label="QR per entrare" className="absolute inset-0 z-[76] grid place-items-center bg-night/90 backdrop-blur" onClick={() => setQrOpen(false)}>
          <div className="flex flex-col items-center gap-[2cqh] text-center">
            <p className="font-display text-[6cqh] leading-none text-white">Inquadra e gioca!</p>
            {ctx.qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ctx.qrDataUrl} alt={`QR code per entrare: ${ctx.joinUrl}`} className="h-[56cqh] w-[56cqh] rounded-[3cqh] border-[0.8cqh] border-gold bg-white p-[1.6cqh]" />
            )}
            <p className="text-[3cqh] font-extrabold text-white/85">
              {ctx.joinUrl.replace(/^https?:\/\//, "")} · codice <span className="font-display tracking-[0.2em] text-gold">{state.code}</span>
            </p>
            <button type="button" className="rounded-full bg-white/15 px-6 py-2 text-lg font-black text-white" onClick={() => setQrOpen(false)}>
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
