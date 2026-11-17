"use client";

import "./m1/m1.css";
import { clsx } from "clsx";
import { useState, type ReactNode } from "react";
import type { OptionSubmission } from "@/lib/tig/games/mechanics/m1/common";
import { hexOf, type Shape } from "@/lib/tig/games/mechanics/m1/draw";
import { posesAt, posesOf, type Clip, type FrameOption, type Pose, type SecondoReveal, type SecondoView } from "@/lib/tig/games/mechanics/un-secondo-prima";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, elapsedOf, useClock, useSubmit, WatchTv } from "../kit/ui";
import { ShapeSvg } from "./m1/art";

type P = PlayerGameProps<SecondoView, null, OptionSubmission, SecondoReveal>;
type T = TvGameProps<SecondoView, SecondoReveal>;

/** Un fotogramma del video: scenografia, attori nelle pose date, forme in più, primo piano. */
function ClipFrame({ clip, poses, extra, label, className, children }: { clip: Clip; poses: Record<string, Required<Pose>>; extra?: Shape[]; label: string; className?: string; children?: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${clip.w} ${clip.h}`} className={className} role="img" aria-label={label}>
      <rect width={clip.w} height={clip.h} fill={hexOf(clip.bg)} />
      {clip.back.map((s, i) => (
        <ShapeSvg key={`b${i}`} s={s} />
      ))}
      {clip.actors.map((a) => {
        const p = poses[a.id];
        if (!p || p.o <= 0) return null;
        return (
          <g key={a.id} opacity={p.o} transform={`translate(${p.x} ${p.y}) rotate(${p.rot}) scale(${p.s} ${p.sy})`}>
            {a.shapes.map((s, i) => (
              <ShapeSvg key={i} s={s} />
            ))}
          </g>
        );
      })}
      {extra?.map((s, i) => (
        <ShapeSvg key={`e${i}`} s={s} />
      ))}
      {clip.front?.map((s, i) => (
        <ShapeSvg key={`f${i}`} s={s} />
      ))}
      {children}
    </svg>
  );
}

/** Banda «fermo immagine» sopra il fotogramma bloccato. */
function Paused({ tv = false }: { tv?: boolean }) {
  return (
    <span className={clsx("tg-display absolute left-[3%] top-[5%] flex items-center gap-[0.3em] rounded-md bg-[#ff3b4e] px-[0.5em] py-[0.15em] text-white", tv ? "text-[1.6cqw]" : "text-sm")}>
      <svg viewBox="0 0 10 10" className="h-[0.8em] w-[0.8em]" aria-hidden>
        <rect x={1} y={1} width={3} height={8} fill="currentColor" />
        <rect x={6} y={1} width={3} height={8} fill="currentColor" />
      </svg>
      Fermo immagine
    </span>
  );
}

function OptionFrame({ clip, o, index, state, tv = false }: { clip: Clip; o: FrameOption; index: number; state: "idle" | "picked" | "right" | "wrong" | "dim"; tv?: boolean }) {
  return (
    <span className={clsx("flex w-full items-center text-left", tv ? "gap-[1cqw]" : "gap-3")}>
      <span
        className={clsx(
          "relative shrink-0 overflow-hidden border-2",
          tv ? "w-[15cqw] rounded-[0.8cqw] border-[0.2cqw]" : "w-[44%] rounded-xl",
          state === "picked" && "border-[#c6ff3d]",
          state === "right" && "border-[#c6ff3d] shadow-[0_0_30px_-6px_rgba(198,255,61,0.8)]",
          state === "wrong" && "border-[#ff3b4e]",
          (state === "idle" || state === "dim") && "border-white/15",
        )}
      >
        <ClipFrame clip={clip} poses={posesOf(clip, o)} extra={o.extra} label={o.text} className="block aspect-video w-full" />
        <span className={clsx("tg-num absolute left-[4%] top-[6%] grid place-items-center rounded-md", tv ? "h-[2.4cqw] w-[2.4cqw] text-[1.5cqw]" : "h-7 w-7 text-lg", state === "right" || state === "picked" ? "bg-[#c6ff3d] text-[#0b0d12]" : "bg-[#0b0d12]/85 text-white")}>{index + 1}</span>
      </span>
      <span className={clsx("min-w-0 flex-1 font-extrabold leading-snug", tv ? "text-[1.55cqw]" : "text-base", state === "dim" && "opacity-50", state === "wrong" && "line-through decoration-2")}>{o.text}</span>
      {state === "right" && <Icon name="check" className={clsx("shrink-0 text-[#c6ff3d]", tv ? "h-[2.4cqw] w-[2.4cqw]" : "h-6 w-6")} />}
    </span>
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
  const watching = p.stage === "play" && elapsed < view.freezeMs;
  useAnswerKeys({ enabled: editable && !reveal && !watching, count: view.options.length, onPick: (i) => setPicked(view.options[i].id), onConfirm: submit });
  const last = posesAt(view.clip, view.clip.durationMs);

  if (p.stage === "reveal" && reveal) {
    const right = reveal.options.find((o) => o.id === reveal.solutionId)!;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <div className="grid grid-cols-2 gap-2">
          <figure className="relative overflow-hidden rounded-xl border-2 border-white/15">
            <ClipFrame clip={reveal.clip} poses={last} label="Fermo immagine" className="block aspect-video w-full" />
            <figcaption className="bg-white/[0.06] py-1 text-center text-xs font-extrabold uppercase tracking-wide text-white/70">Fermo immagine</figcaption>
          </figure>
          <figure className="relative overflow-hidden rounded-xl border-2 border-[#c6ff3d]">
            <ClipFrame clip={reveal.clip} poses={posesOf(reveal.clip, right)} extra={right.extra} label={right.text} className="tg1-freeze block aspect-video w-full" />
            <figcaption className="bg-[#c6ff3d] py-1 text-center text-xs font-extrabold uppercase tracking-wide text-[#0b0d12]">Un secondo dopo</figcaption>
          </figure>
        </div>
        <div className="flex flex-col gap-2">
          {view.options.map((o, i) => (
            <Panel key={o.id} className="p-2">
              <OptionFrame clip={view.clip} o={o} index={i} state={o.id === reveal.solutionId ? "right" : sent && picked === o.id ? "wrong" : "dim"} />
            </Panel>
          ))}
        </div>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  if (watching) {
    return (
      <PlayerFrame view={view} p={p}>
        <WatchTv untilMs={view.freezeMs} elapsed={elapsed} what={`«${view.clipTitle}»: il video parte in TV e si ferma sul più bello.`} />
        <p className="sr-only">{view.alt}</p>
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={
        <SubmitBar
          kbd="Invio"
          canSubmit={p.canSubmit}
          submitted={p.submitted}
          stage={p.stage}
          ready={!!picked}
          pending={pending}
          error={error}
          onSubmit={submit}
          label={picked ? `Viene il n. ${view.options.findIndex((o) => o.id === picked) + 1}` : "Scegliete il fotogramma"}
        />
      }
    >
      <figure className="relative overflow-hidden rounded-2xl border-2 border-white/15">
        <ClipFrame clip={view.clip} poses={last} label={`Fermo immagine. ${view.alt}`} className="tg1-freeze block aspect-video w-full" />
        <Paused />
      </figure>
      <p className="px-1 text-lg font-extrabold leading-snug">{view.prompt}</p>
      <div role="radiogroup" aria-label="Fotogrammi" className="flex flex-col gap-2">
        {view.options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={picked === o.id}
            disabled={!editable}
            onClick={() => editable && setPicked(o.id)}
            className={clsx("rounded-2xl border-2 p-2 transition-transform active:scale-[0.99]", picked === o.id ? "tg-picked border-[#c6ff3d]" : "border-white/12 bg-white/[0.04]")}
          >
            <OptionFrame clip={view.clip} o={o} index={i} state={picked === o.id ? "picked" : "idle"} />
          </button>
        ))}
      </div>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play", 33);
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const clipT = elapsed - view.leadMs;

  if (p.stage === "play" && elapsed < view.freezeMs) {
    const lead = Math.max(1, Math.ceil((view.leadMs - elapsed) / 400));
    return (
      <TvFrame view={view} p={p} hideTimer subtitle={`«${view.clipTitle}»: guardate bene, tra poco si ferma.`}>
        <div className="relative h-full" style={{ containerType: "size" }}>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.6cqw] border border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]" style={{ width: "min(100cqw, 177.78cqh)", height: "min(56.25cqw, 100cqh)" }}>
            {clipT < 0 ? (
              <div className="grid h-full w-full place-items-center bg-[#0b0d12]">
                <p className="tg-num tg-pop text-[18cqh] text-[#c6ff3d]" key={lead}>
                  {lead}
                </p>
              </div>
            ) : (
              <ClipFrame clip={view.clip} poses={posesAt(view.clip, clipT)} label={view.alt} className="block h-full w-full" />
            )}
            <span className="tg-display absolute right-[2%] top-[3%] flex items-center gap-[0.4em] rounded-md bg-[#0b0d12]/75 px-[0.6em] py-[0.2em] text-[4cqh] text-white">
              <span className="tg-pulse inline-block h-[0.6em] w-[0.6em] rounded-full bg-[#ff3b4e]" /> Video
            </span>
          </div>
        </div>
      </TvFrame>
    );
  }

  const done = p.stage === "reveal" && reveal;
  const last = posesAt(view.clip, view.clip.durationMs);
  const right = done ? reveal.options.find((o) => o.id === reveal.solutionId) : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Ecco cosa succedeva un secondo dopo" : view.prompt}>
      <div className="grid h-full grid-cols-[1.25fr_1fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <div className="relative min-h-0 flex-1" style={{ containerType: "size" }}>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[2cqw] border border-white/10" style={{ width: "min(100cqw, 177.78cqh)", height: "min(56.25cqw, 100cqh)" }}>
              {right ? (
                <ClipFrame clip={view.clip} poses={posesOf(view.clip, right)} extra={right.extra} label={right.text} className="tg1-freeze block h-full w-full" />
              ) : (
                <ClipFrame clip={view.clip} poses={last} label={`Fermo immagine. ${view.alt}`} className="tg1-freeze block h-full w-full" />
              )}
              {right ? (
                <span className="tg-display absolute left-[3%] top-[5%] rounded-md bg-[#c6ff3d] px-[0.5em] py-[0.15em] text-[5cqh] text-[#0b0d12]">Un secondo dopo</span>
              ) : (
                <span className="tg-display absolute left-[3%] top-[5%] rounded-md bg-[#ff3b4e] px-[0.5em] py-[0.15em] text-[5cqh] text-white">Fermo immagine</span>
              )}
            </div>
          </div>
          {done && <TvExplain text={reveal.explain} />}
        </div>
        <TvPanel className="flex flex-col justify-center gap-[1cqw]">
          {view.options.map((o, i) => (
            <OptionFrame key={o.id} clip={view.clip} o={o} index={i} tv state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
          ))}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const unSecondoPrimaUi = defineUi(Player, Tv);
