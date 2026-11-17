"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { TreVersioniReveal, TreVersioniSubmission, TreVersioniView } from "@/lib/tig/games/mechanics/tre-versioni";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<TreVersioniView, null, TreVersioniSubmission, TreVersioniReveal>;
type T = TvGameProps<TreVersioniView, TreVersioniReveal>;

function Facts({ facts, tv = false }: { facts: string[]; tv?: boolean }) {
  return (
    <ul className={clsx("flex flex-col", tv ? "gap-[0.6cqw]" : "gap-1.5")}>
      {facts.map((f, i) => (
        <li key={i} className={clsx("flex font-bold leading-snug", tv ? "gap-[0.6cqw] text-[1.6cqw]" : "gap-2 text-base")}>
          <Icon name="check" className={clsx("shrink-0 text-(--tg-gold)", tv ? "mt-[0.2cqw] h-[1.6cqw] w-[1.6cqw]" : "mt-0.5 h-5 w-5")} /> {f}
        </li>
      ))}
    </ul>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send({ versionId: picked });
  useAnswerKeys({ enabled: editable, count: view.versions.length, onPick: (i) => setPicked(view.versions[i].id), onConfirm: submit });

  const rev = p.stage === "reveal" && reveal ? new Map(reveal.versions.map((v) => [v.id, v])) : null;
  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={rev ? undefined : <SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="Questa regge" />}
    >
      {rev && <MyOutcome outcome={p.myOutcome} />}
      <Panel className="flex flex-col gap-2">
        <p className="tg-display text-3xl">{view.event}</p>
        <Eyebrow>Fatti certi</Eyebrow>
        <Facts facts={view.facts} />
      </Panel>
      {view.versions.map((v, i) => {
        const r = rev?.get(v.id);
        const on = (rev ? sent : true) && picked === v.id;
        return (
          <button
            key={v.id}
            type="button"
            disabled={!editable}
            onClick={() => setPicked(v.id)}
            aria-pressed={on}
            className={clsx(
              "flex flex-col gap-1.5 rounded-2xl border-2 p-4 text-left transition-transform active:scale-[0.99]",
              r ? (r.ok ? "border-(--tg-gold) bg-(--tg-gold)/10" : "border-(--tg-cream)/10 opacity-80") : on ? "tg-picked border-(--tg-gold)" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04]",
            )}
          >
            <span className="flex items-center gap-2">
              <span className="tg-num grid h-8 w-8 place-items-center rounded-lg bg-(--tg-cream)/10 text-lg">{i + 1}</span>
              <span className="tg-display text-2xl">{v.who}</span>
              {(on || r?.ok) && <Icon name={r && !r.ok ? "x" : "check"} className={clsx("ml-auto h-6 w-6", r && !r.ok ? "text-(--tg-red-hi)" : "text-(--tg-gold)")} />}
            </span>
            <span className="text-base font-semibold leading-snug text-(--tg-cream)/90">{v.text}</span>
            {r && !r.ok && r.note && <span className="rounded-lg bg-(--tg-red)/12 px-2 py-1.5 text-sm font-bold text-(--tg-red-hi)">{r.note}</span>}
            {r?.ok && <span className="text-sm font-extrabold uppercase text-(--tg-gold)">Rispetta tutti i fatti</span>}
          </button>
        );
      })}
      {rev && reveal && <Explain text={reveal.explain} />}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const rev = p.stage === "reveal" && reveal ? new Map(reveal.versions.map((v) => [v.id, v])) : null;
  return (
    <TvFrame view={view} p={p} subtitle={view.event}>
      <div className="flex h-full flex-col gap-[1.2cqw]">
        <TvPanel className={clsx("tg-rise shrink-0", rev ? "py-[0.8cqw]" : "py-[1.2cqw]")}>
          <p className="mb-[0.5cqw] text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-gold)">Fatti certi</p>
          <div className={clsx(rev && "[&_li]:text-[1.25cqw]")}>
            <Facts facts={view.facts} tv />
          </div>
        </TvPanel>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[1.2cqw]">
          {view.versions.map((v, i) => {
            const r = rev?.get(v.id);
            return (
              <TvPanel key={v.id} tone={r?.ok ? "lime" : undefined} className={clsx("tg-rise flex min-h-0 flex-col gap-[0.6cqw]", r && !r.ok && "opacity-60")}>
                <p className="flex items-center gap-[0.6cqw]">
                  <span className="tg-num grid h-[2.6cqw] w-[2.6cqw] place-items-center rounded-[0.5cqw] bg-(--tg-cream)/10 text-[1.6cqw]">{i + 1}</span>
                  <span className="tg-display text-[2.2cqw]">{v.who}</span>
                </p>
                <p className={clsx("font-semibold leading-snug", rev ? "text-[1.2cqw]" : "text-[1.45cqw]")}>{v.text}</p>
                {r && !r.ok && r.note && <p className="mt-auto rounded-[0.6cqw] bg-(--tg-red)/15 px-[0.8cqw] py-[0.5cqw] text-[1.2cqw] font-bold text-(--tg-red-hi)">{r.note}</p>}
                {r?.ok && <p className="tg-display mt-auto text-[1.8cqw] text-(--tg-gold)">Regge tutto</p>}
              </TvPanel>
            );
          })}
        </div>
        {rev && reveal && <TvExplain text={reveal.explain} className="shrink-0 py-[1cqw]" />}
      </div>
    </TvFrame>
  );
}

export const treVersioniUi = defineUi(Player, Tv);
