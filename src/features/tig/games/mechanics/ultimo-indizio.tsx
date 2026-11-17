"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { UltimoReveal, UltimoSubmission, UltimoView } from "@/lib/tig/games/mechanics/ultimo-indizio";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useClock, useSubmit } from "../kit/ui";
import { Ladder, openCount, splitProfile, SuspectButton, TvSuspect, useCrossed, type SuspectState } from "./m4/kit";

type P = PlayerGameProps<UltimoView, null, UltimoSubmission, UltimoReveal>;
type T = TvGameProps<UltimoView, UltimoReveal>;

/** Chi scagiona ogni indizio, per nome (solo al reveal). */
function clearedNames(reveal: UltimoReveal, i: number): string {
  const name = new Map(reveal.suspects.map((s) => [s.id, splitProfile(s.text)[0]]));
  return reveal.clues[i].clears.map((id) => name.get(id) ?? id).join(", ");
}

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [picked, setPicked] = useState<string | null>(null);
  const { crossed, toggle } = useCrossed();
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const open = openCount(view.schedule, view.clues, elapsed, p.stage !== "play");
  const worth = view.worth[Math.max(0, open - 1)] ?? view.worth[view.worth.length - 1];
  const submit = () => picked && p.canSubmit && send({ optionId: picked });
  useAnswerKeys({ enabled: editable, count: Math.min(9, view.suspects.length), onPick: (i) => setPicked(view.suspects[i].id), onConfirm: submit });

  if (p.stage === "reveal" && reveal) {
    const mine = sent ? picked : null;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Ladder
          clues={reveal.clues.map((c) => c.text)}
          open={reveal.clues.length}
          elapsed={view.durationMs}
          schedule={view.schedule}
          worth={view.worth}
          extra={(i) => <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-(--tg-cream)/55">Scagiona: {clearedNames(reveal, i)}</p>}
        />
        <div className="flex flex-col gap-2">
          {view.suspects.map((s, i) => (
            <SuspectButton key={s.id} option={s} index={i} state={s.id === reveal.solutionId ? "right" : s.id === mine ? "wrong" : "cleared"} />
          ))}
        </div>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label={`Blocca a ${worth}`} hint={picked ? undefined : "Toccate il colpevole; con «fuori» segnate chi è scagionato"} />}
    >
      <Panel className="flex flex-col gap-1">
        <Eyebrow>{view.caseTitle}</Eyebrow>
        <div className="flex items-end justify-between gap-3">
          <p className="text-lg font-extrabold leading-snug">{view.question}</p>
          <p className="tg-num shrink-0 text-right text-3xl leading-none text-(--tg-gold)" aria-live="polite">
            {worth}
            <span className="block text-[10px] font-extrabold uppercase tracking-wide">ora vale</span>
          </p>
        </div>
      </Panel>
      <Ladder clues={view.clues} open={open} elapsed={elapsed} schedule={view.schedule} worth={view.worth} />
      <div role="group" aria-label="Sospettati" className="flex flex-col gap-2">
        {view.suspects.map((s, i) => {
          const state: SuspectState = picked === s.id ? "picked" : crossed.includes(s.id) ? "crossed" : "idle";
          return <SuspectButton key={s.id} option={s} index={i} state={state} disabled={!editable} onPick={() => setPicked(s.id)} onCross={() => toggle(s.id)} />;
        })}
      </div>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const done = p.stage === "reveal" && reveal;
  const open = openCount(view.schedule, view.clues, elapsed, p.stage !== "play");
  const clearedBy = new Map<string, number>();
  if (done) reveal.clues.forEach((c, i) => c.clears.forEach((id) => clearedBy.set(id, i)));
  return (
    <TvFrame view={view} p={p} subtitle={`${view.caseTitle} · ${view.question}`}>
      <div className="grid h-full grid-cols-[1.1fr_1fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <Ladder clues={done ? reveal.clues.map((c) => c.text) : view.clues} open={open} elapsed={elapsed} schedule={view.schedule} worth={view.worth} tv />
          {done && <TvExplain text={reveal.explain} className="py-[1cqw]" />}
        </div>
        <TvPanel className="grid grid-cols-1 content-start gap-[0.6cqw]">
          {view.suspects.map((s, i) => {
            const by = clearedBy.get(s.id);
            return (
              <TvSuspect
                key={s.id}
                option={s}
                index={i}
                state={done ? (s.id === reveal.solutionId ? "right" : "cleared") : "idle"}
                badge={
                  done && by !== undefined ? (
                    <span className={clsx("tg-display shrink-0 rounded-[0.5cqw] bg-(--tg-cream)/10 px-[0.6cqw] py-[0.2cqw] text-[1.1cqw]")}>indizio {by + 1}</span>
                  ) : undefined
                }
              />
            );
          })}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const ultimoIndizioUi = defineUi(Player, Tv);
