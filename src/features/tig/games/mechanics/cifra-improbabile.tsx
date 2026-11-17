"use client";

import { useState } from "react";
import type { CifraReveal, CifraSubmission, CifraView } from "@/lib/tig/games/mechanics/cifra-improbabile";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { GlyphIcon, ScatterArt } from "../kit/glyph";
import { NumberField } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useClock, useSubmit, WatchTv } from "../kit/ui";

type P = PlayerGameProps<CifraView, null, CifraSubmission, CifraReveal>;
type T = TvGameProps<CifraView, CifraReveal>;

function Legend({ view, tv = false }: { view: CifraView; tv?: boolean }) {
  return (
    <div className={tv ? "flex items-center gap-[1.6cqw] text-[1.5cqw] font-extrabold" : "flex flex-wrap items-center gap-x-4 gap-y-1 text-base font-extrabold"}>
      <span className="flex items-center gap-2 text-[#c6ff3d]">
        <GlyphIcon kind={view.glyph} className={tv ? "h-[2.4cqw] w-[2.4cqw]" : "h-7 w-7"} /> Contate: {view.unit}
      </span>
      <span className="flex items-center gap-2 text-white/55">
        <GlyphIcon kind={view.decoyGlyph} className={tv ? "h-[2cqw] w-[2cqw]" : "h-6 w-6"} /> Non contate: {view.decoyUnit}
      </span>
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [guess, setGuess] = useState("");
  const { send, pending, error } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = guess.length > 0;
  const submit = () => ready && p.canSubmit && send({ guess: Number(guess) });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel tone="lime" className="flex items-baseline justify-center gap-3">
          <span className="tg-num text-8xl text-[#c6ff3d]">{reveal.total}</span>
          <span className="tg-display text-3xl">{reveal.unit}</span>
        </Panel>
        <Panel className="p-2">
          <ScatterArt art={reveal.art} label={`${reveal.total} ${reveal.unit} in mezzo ad altre sagome`} className="w-full rounded-xl" />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  if (p.stage === "play" && elapsed < view.flashMs) {
    return (
      <PlayerFrame view={view} p={p}>
        <WatchTv untilMs={view.flashMs} elapsed={elapsed} what={view.prompt} />
        <Legend view={view} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Invia la stima" />}
    >
      <Panel className="flex flex-col gap-2">
        <p className="text-xl font-extrabold leading-snug">{view.prompt}</p>
        <Legend view={view} />
      </Panel>
      <NumberField label="La vostra stima" value={guess} onChange={setGuess} maxDigits={4} unit={view.unit} disabled={!editable} onEnter={submit} />
      <p className="text-sm font-semibold text-white/60">Esatto vale 100; sbagliare della metà vale zero. Conta solo quanto siete vicini.</p>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const flashing = p.stage === "play" && elapsed < view.flashMs && view.art;

  if (p.stage === "reveal" && reveal) {
    return (
      <TvFrame view={view} p={p} subtitle={reveal.prompt}>
        <div className="grid h-full grid-cols-[1.5fr_1fr] gap-[1.6cqw]">
          <TvPanel className="p-[0.6cqw]">
            <ScatterArt art={reveal.art} label={`${reveal.total} ${reveal.unit}`} className="h-full w-full rounded-[1cqw]" />
          </TvPanel>
          <div className="flex flex-col gap-[1.2cqw]">
            <TvPanel tone="lime" className="tg-pop flex flex-col items-center">
              <span className="tg-num text-[11cqw] leading-none text-[#c6ff3d]">{reveal.total}</span>
              <span className="tg-display text-[2.6cqw]">{reveal.unit}</span>
            </TvPanel>
            <TvExplain text={reveal.explain} />
          </div>
        </div>
      </TvFrame>
    );
  }

  if (flashing) {
    const left = Math.max(0, Math.ceil((view.flashMs - elapsed) / 1000));
    return (
      <TvFrame view={view} p={p} hideTimer subtitle={view.prompt}>
        <div className="flex h-full flex-col items-center gap-[1cqw]">
          <Legend view={view} tv />
          <div className="relative min-h-0 flex-1 aspect-video">
            <ScatterArt art={view.art!} label={`Nuvola di ${view.unit} e ${view.decoyUnit}`} className="tg-pop h-full w-full rounded-[1.4cqw] border border-white/10" />
            <div className="tg-glass tg-glass-lime absolute right-[1cqw] top-[1cqw] grid h-[5.5cqw] w-[5.5cqw] place-items-center rounded-full">
              <span className="tg-num text-[3.2cqw] text-[#c6ff3d]">{left}</span>
            </div>
          </div>
        </div>
      </TvFrame>
    );
  }

  return (
    <TvFrame view={view} p={p} subtitle="Sparito. Ora la stima: scrivetela sul telefono.">
      <div className="flex h-full flex-col items-center justify-center gap-[2cqw]">
        <TvPanel className="tg-rise flex max-w-[70cqw] flex-col items-center gap-[1.2cqw] px-[3cqw] text-center">
          <p className="text-[3cqw] font-extrabold leading-tight">{view.prompt}</p>
          <Legend view={view} tv />
        </TvPanel>
        <span className="tg-num tg-pulse text-[14cqw] leading-none text-white/15" aria-hidden>
          ?
        </span>
      </div>
    </TvFrame>
  );
}

export const cifraImprobabileUi = defineUi(Player, Tv);
