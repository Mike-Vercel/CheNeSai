"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { AlibiReveal, AlibiSubmission, AlibiView } from "@/lib/tig/games/mechanics/alibi-impossibile";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<AlibiView, null, AlibiSubmission, AlibiReveal>;
type T = TvGameProps<AlibiView, AlibiReveal>;

function Facts({ view, tv = false }: { view: AlibiView; tv?: boolean }) {
  const name = new Map(view.places.map((p) => [p.id, p.name]));
  const hours = view.places.filter((p) => p.opens || p.closes);
  const txt = tv ? "text-[1.35cqw]" : "text-sm";
  return (
    <div className={clsx("flex flex-col", tv ? "gap-[0.5cqw]" : "gap-1.5")}>
      {view.legs.map((l, i) => (
        <p key={i} className={clsx("flex items-center gap-2 font-bold leading-snug", txt)}>
          <Icon name="clock" className={clsx("shrink-0 text-(--tg-sky)", tv ? "h-[1.4cqw] w-[1.4cqw]" : "h-4 w-4")} />
          <span className="min-w-0">
            {name.get(l.from)} ↔ {name.get(l.to)}: <span className="tg-num text-(--tg-sky)">{l.minutes}′</span> {l.how}
          </span>
        </p>
      ))}
      {hours.map((p) => (
        <p key={p.id} className={clsx("flex items-center gap-2 font-bold leading-snug", txt)}>
          <Icon name="lock" className={clsx("shrink-0 text-(--tg-teal-hi)", tv ? "h-[1.4cqw] w-[1.4cqw]" : "h-4 w-4")} />
          <span className="min-w-0">
            {p.name}: {[p.opens ? `apre alle ${p.opens}` : "", p.closes ? `chiude alle ${p.closes}` : ""].filter(Boolean).join(", ")}
          </span>
        </p>
      ))}
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send({ stepId: picked });
  useAnswerKeys({ enabled: editable, count: view.steps.length, onPick: (i) => setPicked(view.steps[i].id), onConfirm: submit });
  const name = new Map(view.places.map((pl) => [pl.id, pl.name]));
  const sol = p.stage === "reveal" && reveal ? reveal.stepId : null;

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={sol ? undefined : <SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="Questa è impossibile" />}
    >
      {sol && <MyOutcome outcome={p.myOutcome} />}
      <Panel className="flex flex-col gap-2">
        <p className="tg-display text-3xl">{view.caseTitle}</p>
        <Eyebrow>Fatti certi</Eyebrow>
        <Facts view={view} />
      </Panel>
      <Eyebrow className="px-1">Il racconto di {view.suspect}</Eyebrow>
      <ol className="relative flex flex-col gap-2 before:absolute before:bottom-3 before:left-[2.1rem] before:top-3 before:w-0.5 before:bg-(--tg-cream)/12">
        {view.steps.map((s, i) => {
          const on = (sol ? sent : true) && picked === s.id;
          const bad = sol === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!editable}
                aria-pressed={on}
                onClick={() => setPicked(s.id)}
                className={clsx(
                  "relative flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left",
                  sol ? (bad ? "tg-stripes-red border-(--tg-red-hi)" : "border-(--tg-cream)/10 opacity-70") : on ? "tg-picked border-(--tg-gold)" : "border-(--tg-cream)/12 bg-(--tg-night-2)",
                )}
              >
                <span className="tg-num z-10 w-[3.2rem] shrink-0 rounded-lg bg-(--tg-night) py-1 text-center text-xl">{s.time}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold uppercase tracking-wide text-(--tg-sky)">
                    {i + 1} · {name.get(s.place)}
                    {s.stayMin ? ` · ${s.stayMin}′` : ""}
                  </span>
                  <span className="block text-base font-semibold leading-snug">{s.text}</span>
                </span>
                {(on || bad) && <Icon name={bad ? "x" : "check"} className={clsx("h-6 w-6 shrink-0", bad ? "text-(--tg-red-hi)" : "text-(--tg-gold)")} />}
              </button>
            </li>
          );
        })}
      </ol>
      {sol && reveal && <Explain text={reveal.explain} />}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const sol = p.stage === "reveal" && reveal ? reveal.stepId : null;
  const name = new Map(view.places.map((pl) => [pl.id, pl.name]));
  return (
    <TvFrame view={view} p={p} subtitle={`${view.caseTitle} · il racconto di ${view.suspect}`}>
      <div className="grid h-full grid-cols-[1.35fr_1fr] gap-[1.6cqw]">
        <TvPanel className="flex min-h-0 flex-col gap-[0.6cqw]">
          {view.steps.map((s, i) => {
            const bad = sol === s.id;
            return (
              <div key={s.id} className={clsx("tg-rise flex items-start gap-[1cqw] rounded-[0.9cqw] border-[0.15cqw] px-[1cqw] py-[0.6cqw]", bad ? "tg-stripes-red border-(--tg-red-hi)" : "border-(--tg-cream)/10", sol && !bad && "opacity-50")} style={{ animationDelay: `${i * 90}ms` }}>
                <span className="tg-num w-[6cqw] shrink-0 text-[2.2cqw] text-(--tg-gold)">{s.time}</span>
                <div className="min-w-0">
                  <p className="text-[1.05cqw] font-extrabold uppercase tracking-wide text-(--tg-sky)">
                    {name.get(s.place)}
                    {s.stayMin ? ` · resta ${s.stayMin}′` : ""}
                  </p>
                  <p className="text-[1.5cqw] font-semibold leading-snug">{s.text}</p>
                </div>
                {bad && <Icon name="x" className="ml-auto h-[2.4cqw] w-[2.4cqw] shrink-0 text-(--tg-red-hi)" />}
              </div>
            );
          })}
        </TvPanel>
        <div className="flex min-h-0 flex-col gap-[1.2cqw]">
          <TvPanel>
            <p className="mb-[0.6cqw] text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-gold)">Fatti certi</p>
            <Facts view={view} tv />
          </TvPanel>
          {sol && reveal && <TvExplain text={reveal.explain} />}
        </div>
      </div>
    </TvFrame>
  );
}

export const alibiImpossibileUi = defineUi(Player, Tv);
