"use client";

import { clsx } from "clsx";
import { GenderPicker, type GenderChoice } from "@/features/players/GenderPicker";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { TvOverlayContext } from "@/features/display/DisplayApp";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import type { PublicState } from "@/lib/game-engine/types";
import { AudioSettings, btnSoft, DisplaySettings, GameSettings, PlayersSettings, Section, useHostStatus, VoicesProgress } from "./HostSettings";
import { InviteButton } from "./InviteButton";
import { enterFullscreen, unlockMobileAudio } from "./mobile-show";
import { RematchControls } from "./RematchControls";
import { IntroSkipButton } from "@/features/players/IntroSkip";
import { SeatContext, useSeat } from "./use-seat";
import { useHostCommand } from "./use-host-command";
import { useVoicePrep } from "./use-voice-prep";
import { ExitButton } from "@/features/game/components/ExitButton";

const DisplayApp = dynamic(() => import("@/features/display/DisplayApp").then((m) => m.DisplayApp), {
  ssr: false,
  loading: () => <LoadingSplash label="Accendo lo show…" />,
});

/**
 * Modalità B: TUTTO lo show su questo telefono, in verticale (1080×1920): lobby con QR, codice e
 * «Invita amici», intro e regole ricomposte in colonna, domande, soluzioni, classifiche e podio,
 * con le voci dei presentatori. L'host gioca anche lui dallo stesso schermo: entra come giocatore
 * (un tocco, nickname = username) e quando arrivano le risposte le tocca direttamente sullo show.
 * I comandi (pausa, avanti, termina, giocatori, audio, rivincita) stanno nel menu in basso a destra.
 */
export function PhoneShow({ sessionId, displayKey, code, host, canCreateMore }: { sessionId: string; displayKey: string; code: string; host: string | null; canCreateMore: boolean }) {
  const [view, setView] = useState<PublicState | null>(null);
  const onViewState = useCallback((s: PublicState | null) => setView(s), []);
  const { seat, joined, join } = useSeat(view?.code ?? code, view);
  return (
    <SeatContext value={seat}>
      <DisplayApp
        key={sessionId}
        sessionId={sessionId}
        displayKey={displayKey}
        hostMode
        layout="portrait"
        onViewState={onViewState}
        renderOverlay={(s, ctx) => (
          <PhoneShowOverlay sessionId={sessionId} displayKey={displayKey} state={s} ctx={ctx} host={host} canCreateMore={canCreateMore} seatJoined={joined} seatName={seat?.nickname ?? null} join={join} />
        )}
      />
    </SeatContext>
  );
}

/** Ingresso dell'host come giocatore: nickname e genere (facoltativo). */
type JoinFn = (nickname: string, gender?: GenderChoice) => Promise<string | null>;

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function JoinAsPlayer({ host, join, joined, name }: { host: string | null; join: JoinFn; joined: "unknown" | "no" | "yes"; name: string | null }) {
  const [nick, setNick] = useState(host ?? "");
  const [gender, setGender] = useState<GenderChoice>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (joined === "unknown") return null;
  if (joined === "yes") {
    return (
      <p className="rounded-2xl bg-[#1f5c3d]/70 px-4 py-2.5 text-center text-sm font-black text-[#bfffdc]">
        ✓ Giochi anche tu come <span className="text-white">{name}</span>: rispondi toccando lo schermo
      </p>
    );
  }
  return (
    <form
      className="flex flex-col gap-2 rounded-2xl bg-white/8 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        void join(nick.trim(), gender).then((err) => {
          setBusy(false);
          setError(err);
        });
      }}
    >
      <label htmlFor="host-nick" className="text-sm font-black text-white">
        Giochi anche tu? Rispondi da questo schermo
      </label>
      <div className="flex gap-2">
        <input
          id="host-nick"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          maxLength={24}
          autoComplete="nickname"
          placeholder="Il tuo nickname"
          className="h-12 min-w-0 flex-1 rounded-xl border-2 border-gold/70 bg-white px-3 text-[17px] font-extrabold text-ink focus:border-cyan focus:outline-none"
        />
        <button type="submit" disabled={busy || nick.trim().length < 2} className="h-12 shrink-0 rounded-xl bg-white px-4 font-display text-lg text-ink disabled:opacity-40">
          {busy ? "…" : "GIOCO ANCH'IO"}
        </button>
      </div>
      <GenderPicker value={gender} onChange={setGender} compact />
      {error && <p className="text-sm font-bold text-[#ffc2cd]">{error}</p>}
    </form>
  );
}

function PhoneShowOverlay({
  sessionId,
  displayKey,
  state,
  ctx,
  host,
  canCreateMore,
  seatJoined,
  seatName,
  join,
}: {
  sessionId: string;
  displayKey: string;
  state: PublicState | null;
  ctx: TvOverlayContext;
  host: string | null;
  canCreateMore: boolean;
  seatJoined: "unknown" | "no" | "yes";
  seatName: string | null;
  join: JoinFn;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const phase = state?.phase ?? "LOBBY";
  const prep = useVoicePrep({ sessionId, displayKey, active: !!state && phase !== "FINISHED" });
  const [status, refreshStatus] = useHostStatus(sessionId, sheet || phase === "LOBBY" ? state : null);
  const start = useHostCommand(sessionId);

  // rivincita: lo show passa da solo alla nuova partita (stesso codice; l'host resta giocatore)
  const goTo = useCallback((id: string) => router.replace(`/gioca/telefono/${id}`), [router]);
  const next = state?.rematch?.sessionId ?? null;
  useEffect(() => {
    if (next) goTo(next);
  }, [next, goTo]);

  if (!state) return null;
  const lobby = phase === "LOBBY" || phase === "READY";

  return (
    <div className="font-sans">
      {/* audio dei telefoni: serve un tocco (regola dei browser) */}
      {!ctx.audioOn && (
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
      )}

      {lobby && (
        <div className="absolute inset-x-3 bottom-3 z-[66] flex flex-col gap-2.5 rounded-[26px] bg-night/90 p-3 shadow-[0_-10px_40px_rgba(0,0,0,.45)] backdrop-blur-sm" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <JoinAsPlayer host={host} join={join} joined={seatJoined} name={seatName} />
          {/* voci della partita: si preparano dalla creazione, qui l'avanzamento ("Voci pronte X/Y") */}
          <div className="flex justify-center">
            <VoicesProgress prep={prep} compact />
          </div>
          <InviteButton code={state.code} host={host} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="qz-play h-14 flex-1 rounded-full bg-gold font-display text-2xl text-ink transition active:scale-[0.98] disabled:opacity-40"
              disabled={!!start.busy || state.playerCount < 1 || phase !== "LOBBY"}
              onClick={() => void start.run("start")}
            >
              {start.busy ? "PARTE…" : "▶ INIZIA PARTITA"}
            </button>
            <button type="button" aria-label="Impostazioni" onClick={() => setSheet(true)} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/12 text-white">
              <MenuIcon />
            </button>
          </div>
          <div className="flex justify-center">
            <ExitButton size="sm" />
          </div>
          {(start.error || state.playerCount < 1) && (
            <p role={start.error ? "alert" : undefined} className={clsx("text-center text-xs font-bold", start.error ? "text-[#ffb3c1]" : "text-white/70")}>
              {start.error ?? "Entra tu o fai entrare almeno un amico per iniziare."}
            </p>
          )}
        </div>
      )}

      {/* in partita: in basso a sinistra (a destra c'è il menu); durante l'intro in alto (in basso c'è "Salta intro") */}
      {!lobby && !sheet && (
        <div className={clsx("absolute left-3 z-[66]", phase === "INTRO" ? "top-1.5" : "bottom-3")} style={phase === "INTRO" ? { marginTop: "env(safe-area-inset-top)" } : { marginBottom: "env(safe-area-inset-bottom)" }}>
          <ExitButton size="sm" className={phase === "INTRO" ? "!h-9" : "!h-12"} />
        </div>
      )}

      {!lobby && (
        <button
          type="button"
          aria-label="Impostazioni"
          onClick={() => setSheet(true)}
          className="absolute bottom-3 right-3 z-[66] grid h-12 w-12 place-items-center rounded-full bg-black/55 text-white/90 backdrop-blur"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <MenuIcon />
        </button>
      )}

      {/* intro e regole: anche l'host (se gioca) può votare per saltarle */}
      {phase === "INTRO" && seatJoined === "yes" && (
        <div className="absolute inset-x-3 bottom-4 z-[66] flex justify-center" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          <IntroSkipButton code={state.code} slot={null} skip={state.introSkip} nickname={seatName} compact className="rounded-[22px] bg-night/85 p-3 backdrop-blur-sm" />
        </div>
      )}

      {phase === "PAUSED" && (
        <div className="absolute inset-x-0 bottom-[12cqh] z-[66] flex justify-center">
          <button type="button" className="qz-play rounded-full bg-gold px-10 py-4 font-display text-3xl text-ink" disabled={!!start.busy} onClick={() => void start.run("resume")}>
            ▶ RIPRENDI
          </button>
        </div>
      )}

      {phase === "FINISHED" && !sheet && (
        <button type="button" onClick={() => setSheet(true)} className="absolute right-3 top-3 z-[66] rounded-full bg-gold px-4 py-2 font-display text-base text-ink shadow-[0_4px_0_#9a5d00]" style={{ marginTop: "env(safe-area-inset-top)" }}>
          ⟳ RIVINCITA
        </button>
      )}

      {sheet && (
        <>
          <button type="button" aria-label="Chiudi impostazioni" className="absolute inset-0 z-[74] cursor-default bg-black/50" onClick={() => setSheet(false)} />
          <aside role="dialog" aria-modal="true" aria-label="Impostazioni" className="absolute inset-x-0 bottom-0 z-[75] flex max-h-[86%] flex-col rounded-t-[28px] bg-[#1a0b2c] text-white shadow-[0_-20px_60px_rgba(0,0,0,.5)]">
            <header className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
              <div>
                <h2 className="font-display text-2xl leading-none">Impostazioni</h2>
                <p className="mt-1 text-sm font-bold text-white/60">
                  Codice <span className="tracking-[0.15em] text-gold">{state.code}</span> · {state.playerCount} {state.playerCount === 1 ? "giocatore" : "giocatori"}
                </p>
              </div>
              <button type="button" aria-label="Chiudi" onClick={() => setSheet(false)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl font-bold">
                ✕
              </button>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
              <Section title="Partita">
                {phase === "FINISHED" ? (
                  <>
                    <RematchControls sessionId={sessionId} onStarted={goTo} />
                    <div className="flex flex-wrap gap-2">
                      {canCreateMore && (
                        <Link href="/gioca" className={btnSoft}>
                          Nuova partita
                        </Link>
                      )}
                      <Link href="/" className={btnSoft}>
                        Torna alla home
                      </Link>
                    </div>
                  </>
                ) : (
                  <GameSettings sessionId={sessionId} state={state} status={status} onChanged={refreshStatus} />
                )}
              </Section>
              {phase !== "FINISHED" && (
                <Section title="Invita">
                  <InviteButton code={state.code} host={host} tone="sheet" />
                </Section>
              )}
              <Section title={`Giocatori (${state.playerCount})`}>
                <PlayersSettings sessionId={sessionId} status={status} onChanged={refreshStatus} />
              </Section>
              <Section title="Audio">
                <AudioSettings onTestVoices={ctx.testVoices} />
              </Section>
              <Section title="Voci della serata">
                <VoicesProgress prep={prep} />
              </Section>
              <Section title="Grafica">
                <DisplaySettings />
              </Section>
              <Link href={`/gioca/schermo/${sessionId}`} className="w-fit text-sm font-bold text-white/70 underline underline-offset-4">
                Passa al televisore
              </Link>
              <ExitButton size="md" className="self-start" />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
