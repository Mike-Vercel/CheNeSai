"use client";

import { clsx } from "clsx";
import { useEffect, useRef } from "react";
import type { TempoFantasmaReveal, TempoFantasmaSubmission, TempoFantasmaView } from "@/lib/tig/games/mechanics/tempo-fantasma";
import { isTypingTarget } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { elapsedOf, Explain, MyOutcome, Panel, PlayerFrame, TvExplain, TvFrame, TvPanel, useClock, useSubmit } from "../kit/ui";

type P = PlayerGameProps<TempoFantasmaView, null, TempoFantasmaSubmission, TempoFantasmaReveal>;
type T = TvGameProps<TempoFantasmaView, TempoFantasmaReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play", 100);
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const { send, pending, error } = useSubmit(p.submit);
  const running = p.stage === "play" && elapsed >= view.leadInMs && !p.submitted;
  const can = running && p.canSubmit && !pending;
  const stopRef = useRef(() => {});
  useEffect(() => {
    stopRef.current = () => can && send({ stop: true });
  });
  // PC: barra spaziatrice o Invio fermano il tempo
  useEffect(() => {
    if (!can) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === "Enter") && !e.repeat && !isTypingTarget(e.target)) {
        e.preventDefault();
        stopRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [can]);

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p} hideTimer>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="text-center">
          <p className="tg-display text-2xl text-(--tg-cream)/70">Bersaglio</p>
          <p className="tg-num text-7xl text-(--tg-gold)">{reveal.targetSec} s</p>
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  const lead = Math.ceil((view.leadInMs - elapsed) / 1000);
  return (
    <PlayerFrame view={view} p={p} hideTimer>
      <Panel className="text-center">
        <p className="tg-display text-3xl">{view.theme}</p>
        <p className="mt-1 text-base font-semibold text-(--tg-cream)/80">{view.flavor}</p>
        <p className="mt-3 text-sm font-extrabold uppercase tracking-[0.16em] text-(--tg-mute)">Bersaglio</p>
        <p className="tg-num text-6xl text-(--tg-gold)">{view.targetSec} secondi</p>
      </Panel>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
        {p.stage === "play" && elapsed < view.leadInMs ? (
          <p className="tg-num tg-pop text-[9rem] leading-none text-(--tg-cream)" key={lead} aria-live="assertive">
            {Math.max(1, lead)}
          </p>
        ) : p.submitted ? (
          <div className="tg-pop flex flex-col items-center gap-2 text-center">
            <span className="grid h-56 w-56 place-items-center rounded-full border-4 border-(--tg-gold) bg-(--tg-gold)/10">
              <Icon name="check" className="h-24 w-24 text-(--tg-gold)" />
            </span>
            <p className="tg-display text-3xl">Fermato</p>
            <p className="text-sm font-semibold text-(--tg-cream)/70">Lo scarto lo misura il server: lo vedrete al reveal.</p>
          </div>
        ) : p.stage === "locked" ? (
          <p className="tg-display text-4xl text-(--tg-red-hi)">Nessuno ha fermato il tempo</p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => stopRef.current()}
              disabled={!can}
              className={clsx(
                "tg-display grid h-64 w-64 place-items-center rounded-full text-7xl transition-transform duration-100 active:scale-95",
                can ? "bg-(--tg-red) text-white shadow-[0_0_80px_-10px_color-mix(in_srgb,var(--tg-red)_80%,transparent)]" : "border-4 border-dashed border-(--tg-cream)/25 text-(--tg-cream)/40",
              )}
              aria-label="Stop"
            >
              STOP
            </button>
            <p className="max-w-xs text-center text-base font-bold text-(--tg-cream)/80">
              {p.canSubmit ? "Il tempo scorre. Toccate quando pensate sia il momento (sul PC: barra spaziatrice)." : "Il tempo scorre: contate insieme, il capitano tocca STOP."}
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-(--tg-red)/15 px-3 py-2 text-sm font-bold text-(--tg-red-hi)">
            {error}
          </p>
        )}
      </div>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play", 100);
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const beat = 60 / view.distractorBpm;

  if (p.stage === "reveal" && reveal) {
    const outs = (p.outcome?.outcomes ?? []).slice().sort((a, b) => b.points - a.points);
    const team = new Map(p.teams.map((x) => [x.teamId, x]));
    return (
      <TvFrame view={view} p={p} hideTimer subtitle={`Bersaglio: ${reveal.targetSec} secondi dal VIA`}>
        <div className="grid h-full grid-cols-[1.2fr_1fr] gap-[1.6cqw]">
          <TvPanel className="flex min-h-0 flex-col gap-[0.6cqw] overflow-hidden">
            {outs.map((o, i) => (
              <div key={o.teamId} className="tg-rise flex items-center gap-[1cqw] rounded-[0.9cqw] bg-(--tg-cream)/[0.05] px-[1cqw] py-[0.6cqw]" style={{ animationDelay: `${i * 90}ms` }}>
                <span className="tg-num w-[3cqw] text-[2cqw] text-(--tg-cream)/50">{i + 1}°</span>
                <span className="tg-num grid h-[2.8cqw] w-[2.8cqw] place-items-center rounded-[0.6cqw] text-[1.6cqw] text-(--tg-ink)" style={{ background: team.get(o.teamId)?.color }}>
                  {team.get(o.teamId)?.tableNo}
                </span>
                <span className="min-w-0 flex-1 truncate text-[1.6cqw] font-extrabold">{o.label}</span>
                <span className="tg-num text-[2.2cqw] text-(--tg-gold)">+{o.points}</span>
              </div>
            ))}
          </TvPanel>
          <TvExplain text={reveal.explain} className="self-start" />
        </div>
      </TvFrame>
    );
  }

  const lead = Math.ceil((view.leadInMs - elapsed) / 1000);
  const go = p.stage === "play" && elapsed >= view.leadInMs;
  return (
    <TvFrame view={view} p={p} hideTimer subtitle={view.flavor}>
      <div className="flex h-full flex-col items-center justify-center gap-[1.5cqw]">
      <div className="flex items-center justify-center gap-[5cqw]">
        <TvPanel className="tg-rise flex flex-col items-center gap-[0.6cqw] px-[3cqw]">
          <p className="tg-display text-[2.6cqw]">{view.theme}</p>
          <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.24em] text-(--tg-cream)/60">Bersaglio</p>
          <p className="tg-num text-[9cqw] leading-none text-(--tg-gold)">{view.targetSec}</p>
          <p className="tg-display text-[2.2cqw] text-(--tg-cream)/70">secondi</p>
        </TvPanel>
        <div className="relative grid h-[26cqw] w-[26cqw] place-items-center">
          {/* disturbo: pulsa a un ritmo diverso dai secondi */}
          {go && (
            <span
              className="absolute inset-0 rounded-full border-[0.5cqw] border-(--tg-red-hi)"
              style={{ animation: `tg-beat ${beat}s ease-out infinite` }}
              aria-hidden
            />
          )}
          <span className="tg-glass absolute inset-[3cqw] rounded-full" aria-hidden />
          {p.stage === "play" && !go ? (
            <span className="tg-num tg-pop relative text-[12cqw] leading-none" key={lead}>
              {Math.max(1, lead)}
            </span>
          ) : (
            <span className="tg-display relative text-center text-[4cqw] leading-none">{p.stage === "locked" ? "Stop" : "Via!"}</span>
          )}
        </div>
      </div>
      <p className="text-center text-[1.4cqw] font-bold text-(--tg-cream)/70">{go ? "Nessun cronometro: la luce rossa non batte i secondi." : "Al VIA parte il tempo. Nessuno lo vedrà scorrere."}</p>
      </div>
    </TvFrame>
  );
}

export const tempoFantasmaUi = defineUi(Player, Tv);
