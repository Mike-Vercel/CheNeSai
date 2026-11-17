"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { FiloReveal, FiloSubmission, FiloView } from "@/lib/tig/games/mechanics/il-filo-rosso";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { TvWhy } from "./m5-kit";

type P = PlayerGameProps<FiloView, null, FiloSubmission, FiloReveal>;
type T = TvGameProps<FiloView, FiloReveal>;

/** Numero dell'indizio come bottone di ceralacca rossa (il «filo rosso» che li lega). */
function ClueSeal({ n, tv = false }: { n: number; tv?: boolean }) {
  return (
    <span className={clsx("tg-num grid shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_38%_32%,#ea6a5f,#c8312b_48%,#7e1a14)] text-(--tg-cream) shadow-[inset_0_0_0_2px_rgba(90,15,11,.55),0_2px_6px_rgba(0,0,0,.45)]", tv ? "h-[3cqw] w-[3cqw] text-[1.7cqw]" : "h-9 w-9 text-xl")}>{n}</span>
  );
}

/** I tre indizi «raccolti» nella serata, sempre riepilogati (anche per chi si è riconnesso): biglietti di pergamena. */
function Clues({ clues }: { clues: FiloView["clues"] }) {
  return (
    <ol className="relative flex flex-col gap-2" aria-label="Indizi raccolti">
      {/* il filo rosso che unisce i biglietti */}
      <span aria-hidden className="absolute bottom-6 left-[1.85rem] top-6 border-l-[3px] border-dashed border-(--tg-red)" />
      {clues.map((c) => (
        <li key={c.n} className="tg-parch relative flex gap-3 px-3 py-2.5">
          <ClueSeal n={c.n} />
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-(--tg-burnt-ink)">{c.from}</p>
            <p className="text-[15px] font-semibold leading-snug">{c.text}</p>
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
        <Eyebrow className="text-(--tg-teal-hi)">{view.heading}</Eyebrow>
        <p className="mt-1 text-[15px] font-semibold leading-snug text-(--tg-cream)/90">{view.intro}</p>
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
            className={clsx("flex h-14 flex-col items-center justify-center rounded-xl border-2 px-1 leading-none", i === tab ? "border-(--tg-gold) text-(--tg-gold)" : "border-(--tg-cream)/12 text-(--tg-cream)/75", answers[s.id] && "bg-(--tg-gold)/10")}
          >
            <span className="tg-display text-xl">{s.label}</span>
            <span className="mt-1 max-w-full truncate text-[11px] font-bold text-(--tg-cream)/70">{s.options.find((o) => o.id === answers[s.id])?.text ?? "da scegliere"}</span>
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
        {done ? (
          <TvWhy text={reveal.explain} size="sm" />
        ) : (
          <TvPanel className="tg-rise px-[1.6cqw] py-[0.9cqw]">
            <p className="text-[1.45cqw] font-semibold leading-snug text-(--tg-cream)/90">{view.intro}</p>
          </TvPanel>
        )}
        <div className="relative grid grid-cols-3 gap-[1.6cqw]">
          {/* il filo rosso teso tra i tre biglietti */}
          <span aria-hidden className="absolute left-[8%] right-[8%] top-[2.4cqw] border-t-[0.3cqw] border-dashed border-(--tg-red)" />
          {view.clues.map((c, i) => (
            <div key={c.n} className="tg-parch tg-rise flex gap-[0.8cqw] p-[0.9cqw]" style={{ animationDelay: `${i * 140}ms` }}>
              <ClueSeal n={c.n} tv />
              <div className="min-w-0">
                <p className="text-[0.9cqw] font-extrabold uppercase tracking-[0.14em] text-(--tg-burnt-ink)">{c.from}</p>
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
