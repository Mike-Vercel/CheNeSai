"use client";

import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { LoadingSplash } from "@/features/game/components/LoadingSplash";
import { getSoundEngine } from "@/features/media/audio-engine";
import type { PublicState } from "@/lib/giramente/types";
import { api } from "@/lib/realtime/api-client";
import { useGiramenteAudio } from "./audio";
import { InvitePanel } from "./lobby";
import {
  ChoicePanel,
  FinalPanel,
  IntroScreen,
  PausedBanner,
  PlayPanel,
  QuestionPanel,
  RevealPanel,
  RoundIntroScreen,
  RoundResultsPanel,
  SectorPanel,
  SpinButton,
  WheelStage,
  type StageProps,
} from "./stage";
import { StudioBackdrop, useStudio } from "./studio";
import { StudioTvHud } from "./StudioHud";
import { Leaderboard, Logo, PresenterDock, RoundBadge, nameOf } from "./ui";
import { useGiramente } from "./use-giramente";

/**
 * SCHERMO TV / PC pubblico: ruota in primo piano, concorrente di turno, manche, timer, punteggi,
 * classifica, presentatore, entrate della Jolly. Nessun account, nessuna azione di gioco, nessuna
 * soluzione prima del momento giusto (lo stato pubblico non le contiene).
 * `live`: vista per lo streaming (OBS/TikTok LIVE) senza codice, QR né link.
 * Con il 3D disponibile: lo STUDIO a tutto schermo (ruota, Don Patrizio, Zafira, regia di camera) con l'HUD sopra.
 */
export function DisplayApp({ displayKey, live = false }: { displayKey: string; live?: boolean }) {
  const { state, error, now } = useGiramente({ source: { kind: "display", displayKey } });
  useGiramenteAudio(state, { voiced: true, source: { key: displayKey } });
  const [unlocked, setUnlocked] = useState(false);
  const [host, setHost] = useState(false);
  const studio = useStudio();
  useEffect(() => getSoundEngine().subscribe((s) => setUnlocked(s.unlocked)), []);
  useEffect(() => {
    if (live) return;
    void api<{ host: boolean }>(`/api/giramente/schermo/${encodeURIComponent(displayKey)}/comandi`)
      .then((r) => setHost(r.host))
      .catch(() => undefined);
  }, [displayKey, live]);

  if (error && !state) {
    return (
      <main className="grid min-h-dvh place-items-center p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <Logo size="lg" />
          <p className="text-2xl font-bold">{error.code === "NOT_FOUND" ? "Schermo non valido: riaprilo dalla partita." : "Connessione assente: riprovo…"}</p>
        </div>
      </main>
    );
  }
  if (!state) return <LoadingSplash game="giramente" label="Accendo le luci dello studio…" />;

  const props: StageProps = { state, view: null, now, act: async () => false, busy: false, keyHints: false, tv: true };
  const wheelPhases = ["CHOICE", "SPIN", "SPINNING", "WHEEL_RESULT"].includes(state.phase);
  const command = async (action: "start_game" | "skip" | "pause" | "resume") => {
    await api(`/api/giramente/schermo/${encodeURIComponent(displayKey)}/comandi`, { method: "POST", json: { action } }).catch(() => undefined);
  };

  const header = (
    <>
      <Logo size="sm" />
      {state.roundNo > 0 && state.phase !== "FINAL" && <RoundBadge roundNo={state.roundNo} />}
      {state.roundName && state.phase !== "LOBBY" && state.phase !== "FINAL" && <p className="gm-display text-3xl">{state.roundName}</p>}
      <div className="ml-auto flex items-center gap-3">
        {state.turn && !["ROUND_RESULTS", "FINAL", "REVEAL", "ROUND_INTRO"].includes(state.phase) && (
          <p className="gm-panel gm-panel-green gm-display rounded-2xl px-4 py-1 text-3xl">TOCCA A {nameOf(state, state.turn.competitorId).toUpperCase()}</p>
        )}
        {state.stagePlay?.competitorId && state.phase === "PLAY" && <p className="gm-panel gm-display rounded-2xl px-4 py-1 text-3xl">Gioca {nameOf(state, state.stagePlay.competitorId)}</p>}
        {!unlocked && (
          <button type="button" className="gm-btn min-h-12 text-xl" onClick={() => void getSoundEngine().unlock()}>
            🔊 ATTIVA AUDIO
          </button>
        )}
        {host && !live && <HostRemote state={state} command={command} />}
      </div>
    </>
  );

  if (studio.on) {
    return (
      <div className="relative flex h-dvh flex-col overflow-hidden">
        <StudioBackdrop state={state} now={now} quality={studio.quality} onFail={studio.fail} />
        <header className="relative z-10 flex items-center gap-4 bg-gradient-to-b from-[#080b0d]/90 to-transparent px-6 pb-3 pt-4 [@media(min-width:1600px)]:px-10">{header}</header>
        <PausedBanner state={state} />
        <StudioTvHud state={state} now={now} live={live} />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden px-6 pb-4 pt-4 [@media(min-width:1600px)]:px-10">
      <header className="flex items-center gap-4">{header}</header>
      <PausedBanner state={state} />
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] gap-6">
        <main className="flex min-h-0 flex-col items-center justify-center overflow-hidden">
          {state.phase === "LOBBY" ? (
            <TvLobby state={state} live={live} />
          ) : wheelPhases ? (
            <div className="grid h-full w-full grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-6">
              <WheelStage state={state} now={now} className="max-w-[min(100%,72vh)]" />
              <div className="flex flex-col items-center gap-4">
                {state.phase === "CHOICE" && <ChoicePanel {...props} />}
                {(state.phase === "SPIN" || state.phase === "SPINNING") && <SpinButton {...props} />}
                {state.phase === "WHEEL_RESULT" && <SectorPanel {...props} />}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-5xl">
              {state.phase === "INTRO" && (
                <div className="flex flex-col items-center gap-6">
                  <Logo size="xl" tagline />
                  <IntroScreen state={state} tv />
                </div>
              )}
              {state.phase === "ROUND_INTRO" && <RoundIntroScreen state={state} tv />}
              {(state.phase === "QUESTION" || state.phase === "TURN_RESULT") && <QuestionPanel {...props} />}
              {(state.phase === "PLAY" || state.phase === "TURN_READY") && <PlayPanel {...props} />}
              {state.phase === "TURN_READY" && <p className="gm-display mt-4 text-center text-5xl text-[#39ff14]">Passa il telefono a {nameOf(state, state.stagePlay?.competitorId)}!</p>}
              {state.phase === "REVEAL" && <RevealPanel state={state} tv />}
              {state.phase === "ROUND_RESULTS" && <RoundResultsPanel state={state} view={null} tv />}
              {state.phase === "FINAL" && <FinalPanel state={state} view={null} tv />}
            </div>
          )}
        </main>
        <aside className="flex min-h-0 flex-col gap-4">
          {!["LOBBY", "ROUND_RESULTS", "FINAL"].includes(state.phase) && <Leaderboard state={state} compact={state.competitors.length > 5} className="min-h-0 overflow-hidden" />}
          <div className="mt-auto">
            <PresenterDock />
          </div>
        </aside>
      </div>
    </div>
  );
}

function TvLobby({ state, live }: { state: PublicState; live: boolean }) {
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <Logo size="xl" tagline />
      <div className={clsx("grid w-full max-w-5xl gap-6", !live && state.devices === "personal" && "grid-cols-2")}>
        {!live && state.devices === "personal" && <InvitePanel code={state.code} />}
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
      </div>
      <p className="gm-display text-3xl text-white/80">Si parte tra poco…</p>
    </div>
  );
}

function HostRemote({ state, command }: { state: PublicState; command: (a: "start_game" | "skip" | "pause" | "resume") => Promise<void> }) {
  const skippable = ["INTRO", "ROUND_INTRO", "TURN_RESULT", "REVEAL", "ROUND_RESULTS"].includes(state.phase);
  return (
    <div className="flex gap-2">
      {state.phase === "LOBBY" && (
        <button type="button" className="gm-btn min-h-11 text-lg" onClick={() => void command("start_game")}>
          ▶ AVVIA
        </button>
      )}
      {skippable && !state.pausedAt && (
        <button type="button" className="gm-btn gm-btn-ghost min-h-11 text-lg" onClick={() => void command("skip")}>
          AVANTI ›
        </button>
      )}
      {state.phase !== "LOBBY" && state.phase !== "FINAL" && state.phase !== "SPINNING" && (
        <button type="button" className="gm-btn gm-btn-ghost min-h-11 text-lg" onClick={() => void command(state.pausedAt ? "resume" : "pause")}>
          {state.pausedAt ? "▶" : "⏸"}
        </button>
      )}
    </div>
  );
}
