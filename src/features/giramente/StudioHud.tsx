"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { GiramenteAction, PrivateView, PublicState } from "@/lib/giramente/types";
import { InvitePanel, Lobby } from "./lobby";
import { ChoicePanel, FinalPanel, IntroScreen, PhaseContent, PlayPanel, QuestionPanel, RevealPanel, RoundIntroScreen, RoundResultsPanel, SectorPanel, SkipButton, SpinButton, type StageProps } from "./stage";
import { phoneWindowHeight, sidePanelWidth, StudioCaption, StudioWindow } from "./studio";
import { ErrorNote, Leaderboard, nameOf } from "./ui";

/**
 * HUD dello STUDIO 3D: le stesse schermate di gioco (pulsanti, scorciatoie da tastiera, timer) sopra la scena.
 *  - PC / tablet in orizzontale e TV: scena a sinistra (finestra libera), pannello di vetro a destra, la cui
 *    larghezza segue la fase (stretto quando la ruota è protagonista, chiuso durante il giro);
 *  - telefono: scena in alto (altezza per fase), HUD sotto con pulsanti grandi; il contenuto scorre sopra la scena.
 * La "finestra" (StudioWindow) dice allo studio dove inquadrare ruota e presentatore: l'HUD non li copre mai.
 */

const NO_BOARD = new Set(["LOBBY", "ROUND_RESULTS", "FINAL"]);

/** «È il tuo turno» / «Tocca a …» (stesse regole di prima). */
function TurnBanner({ state, view, compact = false }: { state: PublicState; view: PrivateView; compact?: boolean }) {
  if (!state.turn || ["INTRO", "ROUND_INTRO", "ROUND_RESULTS", "FINAL", "REVEAL", "LOBBY"].includes(state.phase)) return null;
  const myTurn = view.canAct && ["CHOICE", "SPIN", "WHEEL_RESULT", "QUESTION"].includes(state.phase) && state.devices === "personal";
  const turnName = nameOf(state, state.turn.competitorId);
  return (
    <p className={clsx("gm-display w-full rounded-2xl px-4 py-2 text-center", compact ? "text-xl" : "text-2xl", myTurn ? "gm-panel gm-panel-green gm-pulse text-[#b6ff9e]" : "gm-panel text-white/90")}>
      {myTurn ? "È IL TUO TURNO!" : state.devices === "shared" ? `TOCCA A ${turnName.toUpperCase()}` : `Turno di ${turnName}`}
      {state.turn.of > 0 && <span className="ml-2 align-middle text-sm text-white/60">({state.turn.no}/{state.turn.of})</span>}
    </p>
  );
}

/** Sottopancia nella scena durante il giro (il pannello laterale è chiuso). */
function SpinLowerThird({ state, big = false }: { state: PublicState; big?: boolean }) {
  if (state.phase !== "SPINNING" || !state.turn) return null;
  return (
    <div className="gm-pop pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
      <p className={clsx("gm-panel gm-panel-green gm-display whitespace-nowrap rounded-2xl px-5 py-1.5", big ? "text-4xl" : "text-2xl")}>
        LA RUOTA GIRA… <span className="text-[#39ff14]">{nameOf(state, state.turn.competitorId).toUpperCase()}</span>
      </p>
    </div>
  );
}

interface PlayerHudProps {
  state: PublicState;
  view: PrivateView;
  now: () => number;
  act: (a: GiramenteAction) => Promise<boolean>;
  busy: boolean;
  keyHints: boolean;
  roomId: string;
  wide: boolean;
  error: string | null;
  clearError: () => void;
}

/** HUD del dispositivo di chi gioca (PC e telefono, anche dispositivo condiviso). */
export function StudioPlayerHud({ state, view, now, act, busy, keyHints, roomId, wide, error, clearError }: PlayerHudProps) {
  const props: StageProps = { state, view, now, act, busy, keyHints, studio: true };
  const lobby = state.phase === "LOBBY";
  const content: ReactNode = lobby ? (
    <Lobby state={state} view={view} act={act} busy={busy} roomId={roomId} stacked={wide} />
  ) : (
    <>
      <TurnBanner state={state} view={view} compact={wide} />
      <PhaseContent {...props} onNew={() => window.location.assign("/giramente/nuova")} />
      <SkipButton state={state} view={view} act={act} busy={busy} />
    </>
  );

  if (wide) {
    return (
      <div className="relative z-10 flex min-h-0 flex-1">
        <StudioWindow className="relative min-w-0 flex-1">
          <SpinLowerThird state={state} />
          <StudioCaption className="absolute bottom-4 left-4 right-4" />
        </StudioWindow>
        <aside className="gm-hud-side relative min-h-0 shrink-0 overflow-hidden transition-[width] duration-700 ease-out" style={{ width: sidePanelWidth(state.phase, false) }} aria-hidden={state.phase === "SPINNING" ? true : undefined}>
          <div className="flex h-full min-w-[19rem] flex-col items-center gap-3 overflow-y-auto px-4 pb-6 pt-3">
            <ErrorNote error={error} onClose={clearError} />
            {content}
            {!lobby && !NO_BOARD.has(state.phase) && <Leaderboard state={state} highlight={view.competitorId} compact className="mt-auto w-full" />}
          </div>
        </aside>
      </div>
    );
  }

  return (
    <>
      <StudioWindow className="relative w-full shrink-0 transition-[height] duration-700 ease-out" style={{ height: phoneWindowHeight(state.phase) }}>
        <SpinLowerThird state={state} />
        <StudioCaption className="absolute bottom-7 left-2 right-10" size="sm" />
      </StudioWindow>
      <div className="gm-hud-sheet relative z-10 -mt-5 flex w-full flex-col items-center gap-4 rounded-t-[1.75rem] px-3 pb-28 pt-4">
        <ErrorNote error={error} onClose={clearError} />
        {content}
        {!lobby && !NO_BOARD.has(state.phase) && (
          <details className="w-full">
            <summary className="gm-chip mx-auto w-fit cursor-pointer list-none">🏆 Classifica</summary>
            <Leaderboard state={state} highlight={view.competitorId} compact className="mt-2" title={false} />
          </details>
        )}
      </div>
    </>
  );
}

/** HUD dello schermo TV / vista LIVE: niente azioni, testi grandi, la scena a tutto schermo. */
export function StudioTvHud({ state, now, live }: { state: PublicState; now: () => number; live: boolean }) {
  const props: StageProps = { state, view: null, now, act: async () => false, busy: false, keyHints: false, tv: true, studio: true };
  const p = state.phase;
  let content: ReactNode = null;
  if (p === "LOBBY") {
    content = (
      <div className="flex w-full flex-col gap-4">
        {!live && state.devices === "personal" && <InvitePanel code={state.code} compact />}
        <section className="gm-panel rounded-3xl p-5">
          <h2 className="gm-display mb-3 text-3xl">{state.mode === "teams" ? "Squadre" : "Giocatori"}</h2>
          <ul className="grid grid-cols-2 gap-2">
            {state.competitors.map((c) => (
              <li key={c.id} className="gm-pop rounded-2xl border border-white/15 bg-black/45 px-3 py-2">
                <p className="gm-display truncate text-2xl">{c.name}</p>
                {c.kind === "team" && <p className="truncate text-sm font-bold text-white/70">{c.members.map((m) => m.nickname).join(" · ") || "—"}</p>}
              </li>
            ))}
          </ul>
        </section>
        <p className="gm-display text-center text-3xl text-white/85">Si parte tra poco…</p>
      </div>
    );
  } else if (p === "INTRO") content = <IntroScreen state={state} />;
  else if (p === "ROUND_INTRO") content = <RoundIntroScreen state={state} tv />;
  else if (p === "CHOICE") content = <ChoicePanel {...props} />;
  else if (p === "SPIN" || p === "SPINNING") content = <SpinButton {...props} />;
  else if (p === "WHEEL_RESULT") content = <SectorPanel {...props} />;
  else if (p === "QUESTION" || p === "TURN_RESULT") content = <QuestionPanel {...props} />;
  else if (p === "PLAY" || p === "TURN_READY")
    content = (
      <>
        <PlayPanel {...props} />
        {p === "TURN_READY" && <p className="gm-display mt-2 text-center text-5xl text-[#39ff14]">Passa il telefono a {nameOf(state, state.stagePlay?.competitorId)}!</p>}
      </>
    );
  else if (p === "REVEAL") content = <RevealPanel state={state} tv />;
  else if (p === "ROUND_RESULTS") content = <RoundResultsPanel state={state} view={null} tv />;
  else if (p === "FINAL") content = <FinalPanel state={state} view={null} tv />;

  return (
    <div className="relative z-10 mt-3 flex min-h-0 flex-1 gap-5 px-6 pb-4 [@media(min-width:1600px)]:px-10">
      <StudioWindow className="relative min-w-0 flex-1">
        <SpinLowerThird state={state} big />
        <StudioCaption className="absolute bottom-2 left-2 right-2" size="lg" />
      </StudioWindow>
      <aside className="gm-hud-side relative min-h-0 shrink-0 overflow-hidden rounded-3xl transition-[width] duration-700 ease-out" style={{ width: sidePanelWidth(p, true) }} aria-hidden={p === "SPINNING" ? true : undefined}>
        <div className="flex h-full min-w-[20rem] flex-col gap-4 overflow-y-auto p-4">
          {content}
          {!NO_BOARD.has(p) && <Leaderboard state={state} compact={state.competitors.length > 4} className="mt-auto min-h-0" />}
        </div>
      </aside>
    </div>
  );
}
