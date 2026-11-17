"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { ContraddizioneReveal, ContraddizioneSubmission, ContraddizioneView } from "@/lib/tig/games/mechanics/la-contraddizione";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<ContraddizioneView, null, ContraddizioneSubmission, ContraddizioneReveal>;
type T = TvGameProps<ContraddizioneView, ContraddizioneReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const [pair, setPair] = useState<string[]>([]);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const toggle = (id: string) => setPair((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id].slice(-2)));
  const ready = pair.length === 2;
  const submit = () => ready && p.canSubmit && send({ pair: [pair[0], pair[1]] });
  useAnswerKeys({ enabled: editable, count: view.messages.length, onPick: (i) => toggle(view.messages[i].id), onConfirm: submit });
  const sol = p.stage === "reveal" && reveal ? reveal.pair : null;

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={sol ? undefined : <SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Queste due non tornano" hint={ready ? undefined : `Selezionate due messaggi (${pair.length}/2)`} />}
    >
      {sol && <MyOutcome outcome={p.myOutcome} />}
      <Panel className="py-3">
        <p className="tg-display text-3xl">{view.character}</p>
        <p className="text-sm font-bold text-(--tg-cream)/70">{view.context}</p>
      </Panel>
      <div className="flex flex-col gap-2">
        {view.messages.map((m, i) => {
          const on = (sol ? sent : true) && pair.includes(m.id);
          const bad = sol?.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              disabled={!editable}
              aria-pressed={on}
              onClick={() => toggle(m.id)}
              className={clsx(
                "flex items-start gap-3 rounded-2xl border-2 p-3 text-left transition-transform active:scale-[0.99]",
                sol ? (bad ? "tg-stripes-red border-(--tg-red-hi)" : "border-(--tg-cream)/10 opacity-70") : on ? "tg-picked border-(--tg-gold)" : "border-(--tg-cream)/12 bg-(--tg-raised)",
              )}
            >
              <span className="tg-num grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-(--tg-cream)/10 text-lg">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold leading-snug">{m.text}</span>
                <span className="mt-1 block text-xs font-bold text-(--tg-cream)/50">{m.time}</span>
              </span>
              {(on || bad) && <Icon name={bad ? "x" : "check"} className={clsx("h-6 w-6 shrink-0", bad ? "text-(--tg-red-hi)" : "text-(--tg-gold)")} />}
              <span className="sr-only">{bad ? " · fa parte della contraddizione" : on ? " · selezionato" : ""}</span>
            </button>
          );
        })}
      </div>
      {sol && reveal && <Explain text={reveal.explain} />}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const sol = p.stage === "reveal" && reveal ? reveal.pair : null;
  return (
    <TvFrame view={view} p={p} subtitle={`${view.character} · ${view.context}`}>
      <div className={clsx("grid h-full gap-[1.6cqw]", sol ? "grid-cols-[1.3fr_1fr]" : "grid-cols-1")}>
        <div className={clsx("grid gap-[1cqw]", sol ? "grid-cols-1" : "grid-cols-2")}>
          {view.messages.map((m, i) => {
            const bad = sol?.includes(m.id);
            return (
              <TvPanel key={m.id} tone={bad ? "red" : undefined} className={clsx("tg-rise flex items-start gap-[1cqw] py-[1.1cqw]", sol && !bad && "opacity-45")}>
                <span className="tg-num grid h-[3cqw] w-[3cqw] shrink-0 place-items-center rounded-[0.6cqw] bg-(--tg-cream)/10 text-[1.8cqw]">{i + 1}</span>
                <div>
                  <p className={clsx("font-semibold leading-snug", sol ? "text-[1.6cqw]" : "text-[2cqw]")}>{m.text}</p>
                  <p className="mt-[0.3cqw] text-[1.1cqw] font-bold text-(--tg-cream)/50">{m.time}</p>
                </div>
              </TvPanel>
            );
          })}
        </div>
        {sol && reveal && <TvExplain text={reveal.explain} className="self-center" />}
      </div>
    </TvFrame>
  );
}

export const laContraddizioneUi = defineUi(Player, Tv);
