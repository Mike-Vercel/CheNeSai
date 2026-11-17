"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { cluePoints } from "@/lib/tig/games/components/clues";
import type { IndizioReveal, IndizioSubmission, IndizioView } from "@/lib/tig/games/mechanics/indizio-dopo-indizio";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";

type P = PlayerGameProps<IndizioView, null, IndizioSubmission, IndizioReveal>;
type T = TvGameProps<IndizioView, IndizioReveal>;

/** Indizi aperti all'istante (dalla linea del tempo e da quelli già arrivati nella vista). */
function openClues(view: IndizioView, elapsed: number, all: boolean): number {
  if (all) return view.clues.length;
  let n = 0;
  view.schedule.forEach((at, i) => {
    if (elapsed >= at && view.clues[i] !== null) n = i + 1;
  });
  return n;
}

function ClueLadder({ clues, open, elapsed, schedule, tv = false }: { clues: (string | null)[]; open: number; elapsed: number; schedule: number[]; tv?: boolean }) {
  return (
    <ol className={clsx("flex flex-col", tv ? "gap-[0.8cqw]" : "gap-2")}>
      {clues.map((c, i) => {
        const isOpen = i < open;
        const inSec = Math.max(0, Math.ceil((schedule[i] - elapsed) / 1000));
        return (
          <li
            key={i}
            className={clsx(
              "flex items-start border-2",
              tv ? "gap-[1cqw] rounded-[1cqw] px-[1.2cqw] py-[0.9cqw]" : "gap-3 rounded-2xl px-3 py-3",
              isOpen ? (i === open - 1 ? "tg-rise border-[#c6ff3d]/70 bg-[#c6ff3d]/[0.07]" : "border-white/12 bg-white/[0.04]") : "border-dashed border-white/12",
            )}
          >
            <span className={clsx("tg-num shrink-0 rounded-lg text-center", tv ? "w-[5cqw] text-[1.6cqw]" : "w-14 text-base", isOpen ? "text-[#c6ff3d]" : "text-white/35")}>
              {cluePoints(i)}
              <span className={clsx("block font-extrabold uppercase tracking-wide", tv ? "text-[0.75cqw]" : "text-[10px]")}>punti</span>
            </span>
            {isOpen && c ? (
              <p className={clsx("font-bold leading-snug", tv ? "text-[2cqw]" : "text-lg")}>{c}</p>
            ) : (
              <p className={clsx("flex items-center gap-2 font-bold text-white/40", tv ? "text-[1.6cqw]" : "text-base")}>
                <Icon name="lock" className={tv ? "h-[1.6cqw] w-[1.6cqw]" : "h-5 w-5"} /> Indizio {i + 1} tra {inSec} s
              </p>
            )}
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
  const open = openClues(view, elapsed, p.stage !== "play");
  const worth = cluePoints(Math.max(0, open - 1));
  const submit = () => picked && p.canSubmit && send({ optionId: picked });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <ClueLadder clues={reveal.clues} open={3} elapsed={view.durationMs} schedule={view.schedule} />
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
      <Panel className="flex items-center justify-between py-3">
        <p className="tg-display text-2xl">{view.category}</p>
        <p className="tg-num text-3xl text-[#c6ff3d]" aria-live="polite">
          ora vale {worth}
        </p>
      </Panel>
      <ClueLadder clues={view.clues} open={open} elapsed={elapsed} schedule={view.schedule} />
      <ChoiceList options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const done = p.stage === "reveal" && reveal;
  const open = openClues(view, elapsed, p.stage !== "play");
  const clues = done ? reveal.clues : view.clues;
  return (
    <TvFrame view={view} p={p} subtitle={`Da indovinare: ${view.category}`}>
      <div className="grid h-full grid-cols-[1.15fr_1fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col gap-[1.2cqw]">
          <ClueLadder clues={clues} open={open} elapsed={elapsed} schedule={view.schedule} tv />
          {done && <TvExplain text={reveal.explain} />}
        </div>
        <TvPanel className="grid grid-cols-1 content-start gap-[0.7cqw]">
          {view.options.map((o, i) => (
            <TvOption key={o.id} index={i} text={o.text} state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
          ))}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const indizioDopoIndizioUi = defineUi(Player, Tv);
