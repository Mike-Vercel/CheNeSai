"use client";

import "./m1/m1.css";
import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import { cluePoints } from "@/lib/tig/games/components/clues";
import type { OptionSubmission } from "@/lib/tig/games/mechanics/m1/common";
import type { PixelLevel, PixelReveal, PixelView } from "@/lib/tig/games/mechanics/pixel-killer";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";
import { ArtSvg } from "./m1/art";

type P = PlayerGameProps<PixelView, null, OptionSubmission, PixelReveal>;
type T = TvGameProps<PixelView, PixelReveal>;

/** Livello visibile adesso: quello dell'orario, se è già arrivato; altrimenti il migliore disponibile prima. */
function shownLevel(view: PixelView, elapsed: number, all: boolean): number {
  if (all) return view.levels.length - 1;
  let k = 0;
  view.schedule.forEach((at, i) => {
    if (elapsed >= at) k = i;
  });
  while (k > 0 && !view.levels[k]) k--;
  return k;
}

/** Griglia di colori disegnata su una tela minuscola e ingrandita «a quadrettoni» (niente sfumature). */
function PixelCanvas({ level, className }: { level: PixelLevel; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    const img = g.createImageData(level.cols, level.rows);
    for (let i = 0; i < level.cols * level.rows; i++) {
      const h = level.cells.slice(i * 3, i * 3 + 3);
      for (let k = 0; k < 3; k++) img.data[i * 4 + k] = parseInt(h[k] ?? "0", 16) * 17;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, [level]);
  return (
    <div className={clsx("relative overflow-hidden", className)}>
      <canvas ref={ref} width={level.cols} height={level.rows} className="tg1-pixels block h-full w-full" role="img" aria-label={`Immagine a quadrettoni ${level.cols} per ${level.rows}: ${level.hint}`} />
      <div className="tg1-scan absolute inset-0" aria-hidden />
    </div>
  );
}

/** Scala dei tre livelli: punti, quadrettoni, secondi che mancano al prossimo. */
function Ladder({ view, shown, elapsed, tv = false, done = false }: { view: PixelView; shown: number; elapsed: number; tv?: boolean; done?: boolean }) {
  return (
    <ol className={clsx("grid grid-cols-3", tv ? "gap-[0.6cqw]" : "gap-2")} aria-label="Livelli">
      {view.schedule.map((at, i) => {
        const open = i <= shown;
        const now = i === shown && !done;
        const inSec = Math.max(0, Math.ceil((at - elapsed) / 1000));
        return (
          <li
            key={i}
            className={clsx(
              "flex flex-col items-center border-2 text-center",
              tv ? "rounded-[0.9cqw] px-[0.6cqw] py-[0.5cqw]" : "rounded-xl px-1 py-1.5",
              now ? "tg-glass-lime border-[#c6ff3d] bg-[#c6ff3d]/10" : open ? "border-white/15 bg-white/[0.04]" : "border-dashed border-white/12",
            )}
          >
            <span className={clsx("tg-num leading-none", tv ? "text-[2.4cqw]" : "text-2xl", now ? "text-[#c6ff3d]" : open ? "text-white/70" : "text-white/35")}>{cluePoints(i)}</span>
            <span className={clsx("font-extrabold uppercase tracking-wide", tv ? "text-[0.8cqw]" : "text-[10px]", open ? "text-white/60" : "text-white/35")}>
              {open ? `${view.levels[i]?.cols ?? ""}×${view.levels[i]?.rows ?? ""}` : `tra ${inSec} s`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const shown = shownLevel(view, elapsed, p.stage !== "play");
  const worth = cluePoints(shown);
  const submit = () => picked && p.canSubmit && send({ optionId: picked });
  const level = view.levels[shown];

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="p-2">
          <ArtSvg art={reveal.art} label={reveal.alt} className="tg1-sharpen block aspect-video w-full rounded-xl" />
        </Panel>
        <div className="grid grid-cols-3 gap-2" aria-label="I tre livelli">
          {reveal.levels.map((l, i) => (
            <figure key={i} className="flex flex-col gap-1">
              <PixelCanvas level={l} className="aspect-video w-full rounded-lg" />
              <figcaption className="text-center text-xs font-extrabold text-white/60">
                {cluePoints(i)} punti · {l.cols}×{l.rows}
              </figcaption>
            </figure>
          ))}
        </div>
        <ChoiceList options={view.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label={`Blocca a ${worth}`} />}
    >
      <Panel className="flex flex-col gap-2 p-2">
        {level && <PixelCanvas key={shown} level={level} className="tg-pop aspect-video w-full rounded-xl" />}
        <Ladder view={view} shown={shown} elapsed={elapsed} />
      </Panel>
      <ChoiceList label="Cosa c'è nella foto?" options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const done = p.stage === "reveal" && reveal;
  const shown = shownLevel(view, elapsed, p.stage !== "play");
  const level = view.levels[shown];
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Ecco la foto vera" : `Ora vale ${cluePoints(shown)}: chi la riconosce, blocchi dal telefono.`}>
      <div className="grid h-full grid-cols-[1.45fr_1fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <div className="relative min-h-0 flex-1" style={{ containerType: "size" }}>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[2cqw] border border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]" style={{ width: "min(100cqw, 177.78cqh)", height: "min(56.25cqw, 100cqh)" }}>
              {done ? (
                <ArtSvg art={reveal.art} label={reveal.alt} className="tg1-sharpen block h-full w-full" />
              ) : (
                level && <PixelCanvas key={shown} level={level} className="tg-pop h-full w-full" />
              )}
            </div>
          </div>
          {!done && <Ladder view={view} shown={shown} elapsed={elapsed} tv />}
          {done && <TvExplain text={reveal.explain} />}
        </div>
        <TvPanel className="flex flex-col justify-center gap-[0.9cqw]">
          <p className="flex items-center gap-[0.6cqw] text-[1.9cqw] font-extrabold leading-tight">
            <Icon name="eye" className="h-[2.2cqw] w-[2.2cqw] text-[#c6ff3d]" /> Cosa c&apos;è nella foto?
          </p>
          {view.options.map((o, i) => (
            <TvOption key={o.id} index={i} text={o.text} state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
          ))}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const pixelKillerUi = defineUi(Player, Tv);
