"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ExitButton } from "@/features/game/components/ExitButton";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { useKeyHints, useShowLayout } from "@/features/shared/device";
import type { GiramenteAction, GiramenteView, PrivateView, PublicState } from "@/lib/giramente/types";
import { ApiError } from "@/lib/realtime/api-client";
import { useGiramenteAudio } from "./audio";
import { Lobby, openScreen } from "./lobby";
import { PausedBanner, PhaseContent, SkipButton, WheelStage, type StageProps } from "./stage";
import { StudioBackdrop, useStudio } from "./studio";
import { StudioPlayerHud } from "./StudioHud";
import { AudioMenu, CaptionBar, ErrorNote, Leaderboard, LinkBadge, Logo, PresenterDock, RoundBadge, nameOf } from "./ui";
import { gmAct, useGiramente } from "./use-giramente";

/**
 * GIRAMENTE! sul dispositivo di chi gioca (account obbligatorio):
 *  - un dispositivo a testa: il proprio turno, le proprie prove private, la classifica;
 *  - un solo dispositivo (`shared`): il telefono passa di mano, «TOCCA A …» nasconde le prove a turno.
 * PC = dispositivo di gioco completo (mouse e tastiera: 1–4, Invio), impaginazione larga; telefono =
 * interazioni essenziali con pulsanti grandi. Lo stato arriva SEMPRE dal server.
 * Con il 3D disponibile la pagina è lo STUDIO (scena unica sotto l'HUD, vedi studio.tsx); altrimenti il 2D di sempre.
 */
function useActions(roomId: string, applyView: (v: GiramenteView) => void, refresh: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (a: GiramenteAction): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const r = await gmAct(roomId, a);
        if ("state" in r) applyView(r);
        return true;
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : "Qualcosa è andato storto: riprova";
        // azioni superate dagli eventi (es. tempo scaduto mentre si rispondeva): si rilegge lo stato
        if (e instanceof ApiError && ["WRONG_PHASE", "TOO_LATE", "ALREADY_ANSWERED"].includes(e.code)) refresh();
        setError(msg);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [roomId, applyView, refresh],
  );
  return { run, busy, error, clearError: () => setError(null) };
}

const WHEEL_PHASES = new Set(["SPIN", "SPINNING", "WHEEL_RESULT"]);

export function GameApp({ roomId }: { roomId: string }) {
  const { state, view, status, error, refresh, applyView, now } = useGiramente({ source: { kind: "room", roomId } });
  const { run, busy, error: actError, clearError } = useActions(roomId, applyView, () => void refresh());
  const keyHints = useKeyHints();
  const layout = useShowLayout();
  const studio = useStudio();
  // voce e sigla: dispositivo condiviso, oppure telefono/PC di chi gestisce se nessuno schermo TV è collegato
  const voiced = !!state && (state.devices === "shared" || (!!view?.isHost && !state.displayOnline));
  useGiramenteAudio(state, { voiced, source: { roomId } });

  if (error && !state && ["NOT_MEMBER", "KICKED", "NOT_FOUND", "UNAUTHENTICATED"].includes(error.code)) {
    return (
      <Shell>
        <section className="flex flex-col items-center gap-5 py-16 text-center">
          <Logo size="md" />
          <p className="text-xl font-extrabold">{error.message}</p>
          <Link href="/giramente/entra" className="gm-btn">
            ENTRA CON UN CODICE
          </Link>
          <Link href="/giramente" className="font-bold text-white/70 underline">
            Home di GIRAMENTE!
          </Link>
        </section>
      </Shell>
    );
  }
  if (!state || !view) return <LoadingSplash game="giramente" label="Entro nella sala partita…" />;
  if (state.status === "closed") {
    return (
      <Shell>
        <section className="flex flex-col items-center gap-6 py-10 text-center">
          <Logo size="lg" />
          <p className="gm-display text-4xl">Partita chiusa</p>
          <Link href="/giramente" className="gm-btn">
            NUOVA PARTITA
          </Link>
        </section>
      </Shell>
    );
  }

  const props: StageProps = { state, view, now, act: run, busy, keyHints };
  const wide = layout === "landscape";
  const leave = () => void run({ action: "leave" }).then((ok) => ok && window.location.assign("/giramente"));

  if (studio.on) {
    return (
      <Shell state={state} view={view} roomId={roomId} onLeave={leave} act={run} studio={wide ? "fixed" : "scroll"}>
        <StudioBackdrop state={state} now={now} quality={studio.quality} onFail={studio.fail} />
        <LinkBadge status={status} />
        <PausedBanner state={state} />
        <StudioPlayerHud state={state} view={view} now={now} act={run} busy={busy} keyHints={keyHints} roomId={roomId} wide={wide} error={actError} clearError={clearError} />
      </Shell>
    );
  }
  const myTurn = view.canAct && ["CHOICE", "SPIN", "WHEEL_RESULT", "QUESTION"].includes(state.phase) && state.devices === "personal";
  const turnName = nameOf(state, state.turn?.competitorId);
  const showWheel = WHEEL_PHASES.has(state.phase) || (wide && ["CHOICE", "QUESTION", "TURN_RESULT"].includes(state.phase) && !!state.turn);

  return (
    <Shell state={state} view={view} roomId={roomId} onLeave={leave} act={run}>
      <LinkBadge status={status} />
      <PausedBanner state={state} />
      <div className="flex w-full flex-col items-center gap-4">
        <ErrorNote error={actError} onClose={clearError} />
        {state.phase === "LOBBY" ? (
          <Lobby state={state} view={view} act={run} busy={busy} roomId={roomId} />
        ) : (
          <>
            {/* «è il tuo turno» / «tocca a …» */}
            {state.turn && !["INTRO", "ROUND_INTRO", "ROUND_RESULTS", "FINAL", "REVEAL"].includes(state.phase) && (
              <p className={clsx("gm-display w-full rounded-2xl px-4 py-2 text-center text-2xl", myTurn ? "gm-panel gm-panel-green gm-pulse text-[#b6ff9e]" : "gm-panel text-white/90")}>
                {myTurn ? "È IL TUO TURNO!" : state.devices === "shared" ? `TOCCA A ${turnName.toUpperCase()}` : `Turno di ${turnName}`}
                {state.turn.of > 0 && <span className="ml-2 align-middle text-sm text-white/60">({state.turn.no}/{state.turn.of})</span>}
              </p>
            )}
            <div className={clsx("grid w-full gap-4", wide && "grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-start")}>
              {wide && (
                <div className="flex flex-col items-center gap-3">
                  {showWheel ? (
                    <WheelStage state={state} now={now} className="max-w-[30rem]" />
                  ) : (
                    !["ROUND_RESULTS", "FINAL"].includes(state.phase) && <Leaderboard state={state} highlight={view.competitorId} className="w-full" />
                  )}
                  {voiced && <PresenterDock />}
                </div>
              )}
              <div className="flex w-full flex-col items-center gap-4">
                {!wide && WHEEL_PHASES.has(state.phase) && <WheelStage state={state} now={now} className="max-w-[20rem]" />}
                <PhaseContent {...props} onNew={() => window.location.assign("/giramente/nuova")} />
                <SkipButton state={state} view={view} act={run} busy={busy} />
                {wide && showWheel && <Leaderboard state={state} highlight={view.competitorId} compact />}
              </div>
            </div>
            {!wide && !["ROUND_RESULTS", "FINAL"].includes(state.phase) && (
              <details className="w-full">
                <summary className="gm-chip mx-auto w-fit cursor-pointer list-none">🏆 Classifica</summary>
                <Leaderboard state={state} highlight={view.competitorId} compact className="mt-2" title={false} />
              </details>
            )}
          </>
        )}
      </div>
      {(!voiced || !wide) && <CaptionBar />}
    </Shell>
  );
}

export function Shell({
  children,
  state,
  view,
  roomId,
  onLeave,
  act,
  studio,
}: {
  children: React.ReactNode;
  state?: PublicState;
  view?: PrivateView;
  roomId?: string;
  onLeave?: () => void;
  act?: (a: GiramenteAction) => Promise<boolean>;
  /** studio 3D: "fixed" = pagina a tutta altezza (PC), "scroll" = l'HUD scorre sopra la scena (telefono) */
  studio?: "fixed" | "scroll";
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div className={clsx(studio === "fixed" ? "flex h-dvh flex-col overflow-hidden" : "min-h-dvh", studio && "relative")}>
      <header className={clsx("qz-safe-header sticky top-0 z-30 flex shrink-0 items-center gap-3", studio ? "bg-gradient-to-b from-[#080b0d]/95 via-[#080b0d]/70 to-transparent" : "bg-[#080b0d]/85 backdrop-blur")}>
        <Link href="/giramente" aria-label="Home di GIRAMENTE!" className="shrink-0">
          <Logo size="sm" />
        </Link>
        {state && state.devices === "personal" && (
          <span className="hidden min-[460px]:block">
            <span className="gm-chip font-mono tracking-[0.2em]" aria-label={`Codice ${state.code}`}>
              {state.code}
            </span>
          </span>
        )}
        {state && state.roundNo > 0 && state.phase !== "FINAL" && (
          <span className="hidden sm:block">
            <RoundBadge roundNo={state.roundNo} />
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {state && <AudioMenu />}
          {state && view && (view.isHost || view.me) && (
            <div className="relative">
              <button type="button" className="gm-chip" aria-expanded={menu} onClick={() => setMenu((m) => !m)} aria-label="Altro">
                ⋯
              </button>
              {menu && (
                <div className="gm-panel absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl p-2">
                  {view.isHost && act && state.phase !== "LOBBY" && state.phase !== "FINAL" && (
                    <button type="button" className="w-full rounded-xl px-3 py-2.5 text-left font-bold hover:bg-white/8" onClick={() => void act({ action: state.pausedAt ? "resume" : "pause" }).then(() => setMenu(false))}>
                      {state.pausedAt ? "▶ Riprendi la partita" : "⏸ Metti in pausa"}
                    </button>
                  )}
                  {view.isHost && roomId && (
                    <>
                      <button type="button" className="w-full rounded-xl px-3 py-2.5 text-left font-bold hover:bg-white/8" onClick={() => void openScreen(roomId)}>
                        📺 Apri lo schermo TV
                      </button>
                      <button type="button" className="w-full rounded-xl px-3 py-2.5 text-left font-bold hover:bg-white/8" onClick={() => void openScreen(roomId, true)}>
                        🔴 Vista per la LIVE
                      </button>
                    </>
                  )}
                  {view.isHost && act && (
                    <button type="button" className="w-full rounded-xl px-3 py-2.5 text-left font-bold text-[#ff8a95] hover:bg-white/8" onClick={() => void act({ action: "close_room" }).then((ok) => ok && window.location.assign("/giramente"))}>
                      Chiudi la partita
                    </button>
                  )}
                  {view.me && !view.isHost && onLeave && (
                    <button type="button" className="w-full rounded-xl px-3 py-2.5 text-left font-bold text-[#ff8a95] hover:bg-white/8" onClick={onLeave}>
                      Lascia la partita
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <ExitButton to="/giramente" size="sm" />
        </div>
      </header>
      {studio === "fixed" ? (
        <main className="relative flex min-h-0 flex-1 flex-col">{children}</main>
      ) : studio === "scroll" ? (
        <main className="relative flex w-full flex-col items-center">{children}</main>
      ) : (
        <main className="mx-auto flex w-full max-w-6xl flex-col items-center px-3 pb-28 pt-4 sm:px-6">{children}</main>
      )}
    </div>
  );
}
