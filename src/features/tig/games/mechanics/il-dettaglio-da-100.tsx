"use client";

import "./m1/m1.css";
import { useState } from "react";
import type { DettaglioReveal, DettaglioView } from "@/lib/tig/games/mechanics/il-dettaglio-da-100";
import type { OptionSubmission } from "@/lib/tig/games/mechanics/m1/common";
import type { Scene } from "@/lib/tig/games/components/art";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { ChoiceList } from "../kit/inputs";
import { SceneArt } from "../kit/scene";
import { canEdit, elapsedOf, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useClock, useSubmit, WatchTv } from "../kit/ui";

type P = PlayerGameProps<DettaglioView, null, OptionSubmission, DettaglioReveal>;
type T = TvGameProps<DettaglioView, DettaglioReveal>;

const CONFETTI = ["#c6ff3d", "#ff3b4e", "#ffc24a", "#6fe7ff", "#b49cff", "#eef2f6"];

/** Scena + stimoli: coriandoli che cadono e la striscia di testo che scorre (solo durante i 6 secondi). */
function BusyScene({ scene, alt, ticker, showMs, live, className }: { scene: Scene; alt: string; ticker: string | null; showMs: number; live: boolean; className?: string }) {
  return (
    <div className={className}>
      <div className="@container relative h-full w-full overflow-hidden rounded-[inherit]">
        <SceneArt scene={scene} alt={alt} className="h-full w-full" />
        {live && (
          <svg viewBox="0 0 160 90" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
            {Array.from({ length: 34 }, (_, i) => {
              const x = (i * 37) % 160;
              const d = 1.6 + ((i * 13) % 10) / 6;
              return (
                <rect
                  key={i}
                  x={x}
                  y={-6}
                  width={1.6}
                  height={3}
                  rx={0.4}
                  fill={CONFETTI[i % CONFETTI.length]}
                  className="tg1-fall"
                  style={{ animationDuration: `${d}s`, animationDelay: `${-((i * 7) % 20) / 10}s` }}
                />
              );
            })}
          </svg>
        )}
        {ticker && (
          <div className="absolute inset-x-0 bottom-0 overflow-hidden bg-[#ff3b4e] py-[1.2%]">
            <p className={live ? "tg1-ticker tg-display inline-block whitespace-nowrap pl-[100%] text-[3.4cqw] text-white" : "tg-display truncate px-[2%] text-center text-[3.4cqw] text-white"} style={live ? { animationDuration: `${showMs}ms` } : undefined}>
              {ticker}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send({ optionId: picked });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="p-2">
          <BusyScene scene={reveal.scene} alt={reveal.alt} ticker={reveal.ticker} showMs={view.showMs} live={false} className="aspect-video w-full rounded-xl" />
        </Panel>
        <Panel className="flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-snug">{reveal.prompt}</p>
          <ChoiceList options={view.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  if (p.stage === "play" && elapsed < view.showMs) {
    return (
      <PlayerFrame view={view} p={p}>
        <WatchTv untilMs={view.showMs} elapsed={elapsed} what={`«${view.sceneTitle}»: 6 secondi, poi una sola domanda. Guardate tutto.`} />
        {view.alt && <p className="sr-only">{view.alt}</p>}
        {view.ticker && <p className="sr-only">Scritta che scorre: {view.ticker}</p>}
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="Vale 100: invia" />}
    >
      <Panel className="flex flex-col gap-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#c6ff3d]">«{view.sceneTitle}» · la scena è sparita</p>
        <p className="text-2xl font-extrabold leading-snug">{view.prompt}</p>
        <ChoiceList label="Risposte" options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} big />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const showing = p.stage === "play" && elapsed < view.showMs && view.scene;

  if (p.stage === "reveal" && reveal) {
    return (
      <TvFrame view={view} p={p} subtitle={`«${reveal.sceneTitle}» · ecco il dettaglio`}>
        <div className="grid h-full grid-cols-[1.15fr_1fr] gap-[1.4cqw]">
          <div className="flex min-h-0 flex-col gap-[1.2cqw]">
            <TvPanel className="tg-pop flex min-h-0 flex-1 items-center justify-center p-[0.6cqw]">
              <BusyScene scene={reveal.scene} alt={reveal.alt} ticker={reveal.ticker} showMs={view.showMs} live={false} className="aspect-video max-h-full w-full rounded-[1cqw]" />
            </TvPanel>
            <TvExplain text={reveal.explain} />
          </div>
          <TvPanel className="flex flex-col justify-center gap-[0.9cqw]">
            <p className="text-[1.9cqw] font-extrabold leading-tight">{reveal.prompt}</p>
            {view.options.map((o, i) => (
              <TvOption key={o.id} index={i} text={o.text} state={o.id === reveal.solutionId ? "right" : "dim"} />
            ))}
          </TvPanel>
        </div>
      </TvFrame>
    );
  }

  if (showing) {
    const left = Math.max(0, Math.ceil((view.showMs - elapsed) / 1000));
    return (
      <TvFrame view={view} p={p} hideTimer subtitle={`«${view.sceneTitle}»: 6 secondi. Guardate TUTTO.`}>
        <div className="flex h-full items-center justify-center">
          <div className="tg-pop relative aspect-video h-full max-h-full">
            <BusyScene scene={view.scene!} alt={view.alt ?? view.sceneTitle} ticker={view.ticker} showMs={view.showMs} live className="h-full w-full rounded-[1.4cqw] border border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]" />
            <div className="tg-glass tg-glass-lime absolute right-[1.2cqw] top-[1.2cqw] grid h-[6cqw] w-[6cqw] place-items-center rounded-full">
              <span className="tg-num text-[3.6cqw] text-[#c6ff3d]">{left}</span>
            </div>
          </div>
        </div>
      </TvFrame>
    );
  }

  return (
    <TvFrame view={view} p={p} subtitle="La scena è sparita. Una domanda sola: rispondete dal telefono.">
      <div className="flex h-full flex-col items-center justify-center gap-[1.6cqw]">
        <p className="tg-rise max-w-[80cqw] text-center text-[3cqw] font-extrabold leading-tight">{view.prompt}</p>
        <div className="grid w-full max-w-[84cqw] grid-cols-2 gap-[1cqw]">
          {view.options.map((o, i) => (
            <TvOption key={o.id} index={i} text={o.text} />
          ))}
        </div>
      </div>
    </TvFrame>
  );
}

export const ilDettaglioDa100Ui = defineUi(Player, Tv);
