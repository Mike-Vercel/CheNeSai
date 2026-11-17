"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { FiloReveal, FiloSubmission, FiloView } from "@/lib/tig/games/mechanics/il-filo-rosso";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<FiloView, null, FiloSubmission, FiloReveal>;
type T = TvGameProps<FiloView, FiloReveal>;

/** I tre indizi «raccolti» nella serata, sempre riepilogati (anche per chi si è riconnesso). */
function Clues({ clues }: { clues: FiloView["clues"] }) {
  return (
    <ol className="flex flex-col gap-2" aria-label="Indizi raccolti">
      {clues.map((c) => (
        <li key={c.n} className="flex gap-3 rounded-2xl border border-[#ff3b4e]/35 bg-[#ff3b4e]/[0.07] px-3 py-2.5">
          <span className="tg-num grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#ff3b4e] text-xl text-white">{c.n}</span>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#ff8c97]">{c.from}</p>
            <p className="text-base font-semibold leading-snug">{c.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [tab, setTab] = useState(0);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const done = view.slots.every((s) => !!answers[s.id]);
  const submit = () => done && p.canSubmit && send({ answers });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {reveal.slots.map((s) => (
          <Panel key={s.id} className="flex flex-col gap-2">
            <Eyebrow>{s.label}</Eyebrow>
            <ChoiceList options={s.options} picked={sent && answers[s.id] ? [answers[s.id]] : []} onToggle={() => {}} keys={false} reveal={{ solution: [s.solutionId] }} />
          </Panel>
        ))}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  const slot = view.slots[tab];
  const pick = (id: string) => {
    if (!editable) return;
    setAnswers((a) => ({ ...a, [slot.id]: id }));
    if (tab < view.slots.length - 1) window.setTimeout(() => setTab((x) => Math.min(x + 1, view.slots.length - 1)), 180);
  };
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
          ready={done}
          pending={pending}
          error={error}
          onSubmit={submit}
          label="Chiudi il filo"
          hint={done ? `+${view.perSlot} a tessera, +${view.threadBonus} se sono giuste tutte e tre` : "Componete la soluzione: tre tessere"}
        />
      }
    >
      <Panel className="py-3">
        <Eyebrow className="text-[#ffc24a]">{view.heading}</Eyebrow>
        <p className="mt-1 text-[15px] font-semibold leading-snug text-white/85">{view.intro}</p>
      </Panel>
      <Clues clues={view.clues} />
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Tessere">
        {view.slots.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === tab}
            onClick={() => setTab(i)}
            className={clsx("flex h-14 flex-col items-center justify-center rounded-xl border-2 px-1 leading-none", i === tab ? "border-[#c6ff3d] text-[#c6ff3d]" : "border-white/12 text-white/75", answers[s.id] && "bg-[#c6ff3d]/10")}
          >
            <span className="tg-display text-xl">{s.label}</span>
            <span className="mt-1 max-w-full truncate text-[11px] font-bold text-white/70">{s.options.find((o) => o.id === answers[s.id])?.text ?? "da scegliere"}</span>
          </button>
        ))}
      </div>
      <Panel className="flex flex-col gap-2" key={slot.id}>
        <Eyebrow>{slot.label}</Eyebrow>
        <ChoiceList options={slot.options} picked={answers[slot.id] ? [answers[slot.id]] : []} onToggle={pick} disabled={!editable} onConfirm={done ? submit : null} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  return (
    <TvFrame view={view} p={p} subtitle={done ? `${view.heading} · il filo completo` : `${view.heading} · tre indizi raccolti nella serata, una soluzione da comporre`}>
      <div className="grid h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-[1cqw]">
        <TvPanel className="tg-rise px-[1.6cqw] py-[0.9cqw]">
          {done ? (
            <p className="text-[1.3cqw] font-semibold leading-snug text-white/90">
              <span className="mr-[0.6cqw] text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-[#c6ff3d]">Perché</span>
              {reveal.explain}
            </p>
          ) : (
            <p className="text-[1.45cqw] font-semibold leading-snug text-white/90">{view.intro}</p>
          )}
        </TvPanel>
        <div className="grid grid-cols-3 gap-[1cqw]">
          {view.clues.map((c, i) => (
            <div key={c.n} className="tg-glass tg-rise flex gap-[0.8cqw] rounded-[1.2cqw] border-[#ff3b4e]/45 p-[0.9cqw]" style={{ animationDelay: `${i * 140}ms` }}>
              <span className="tg-num grid h-[2.8cqw] w-[2.8cqw] shrink-0 place-items-center rounded-[0.6cqw] bg-[#ff3b4e] text-[1.7cqw] text-white">{c.n}</span>
              <div className="min-w-0">
                <p className="text-[0.9cqw] font-extrabold uppercase tracking-[0.14em] text-[#ff8c97]">{c.from}</p>
                <p className="text-[1.25cqw] font-semibold leading-snug">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="grid min-h-0 grid-cols-3 gap-[1cqw]">
          {view.slots.map((s) => {
            const r = done ? reveal.slots.find((x) => x.id === s.id) : null;
            return (
              <TvPanel key={s.id} tone={r ? "lime" : undefined} className="flex min-h-0 flex-col gap-[0.45cqw] p-[1cqw]">
                <p className="tg-display text-[2.1cqw]">{s.label}</p>
                <div className="grid grid-cols-2 gap-[0.45cqw]">
                  {(r ? r.options : s.options).map((o, k) => (
                    <TvOption key={o.id} index={k} text={o.text} size="sm" state={r ? (o.id === r.solutionId ? "right" : "dim") : "idle"} />
                  ))}
                </div>
              </TvPanel>
            );
          })}
        </div>
      </div>
    </TvFrame>
  );
}

export const ilFiloRossoUi = defineUi(Player, Tv);
