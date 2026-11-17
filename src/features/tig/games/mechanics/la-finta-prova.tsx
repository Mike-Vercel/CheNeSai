"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { DossierItem, FintaReveal, FintaSubmission, FintaView } from "@/lib/tig/games/mechanics/la-finta-prova";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { DocCard, type DocState } from "./m4/docs";
import { FactList } from "./m4/kit";

type P = PlayerGameProps<FintaView, null, FintaSubmission, FintaReveal>;
type T = TvGameProps<FintaView, FintaReveal>;

function Suggests({ text, tv = false }: { text: string; tv?: boolean }) {
  return (
    <p className={clsx("border-t border-black/10 font-bold leading-snug opacity-80", tv ? "mt-[0.3cqw] pt-[0.4cqw] text-[1.05cqw]" : "mt-1 pt-1.5 text-sm")}>
      <span className="uppercase tracking-wide opacity-70">Se fosse vera: </span>
      {text}
    </p>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send({ itemId: picked });
  useAnswerKeys({ enabled: editable, count: view.items.length, onPick: (i) => setPicked(view.items[i].id), onConfirm: submit });
  const rev = p.stage === "reveal" && reveal ? new Map(reveal.items.map((i) => [i.id, i])) : null;

  const card = (it: DossierItem, i: number) => {
    const r = rev?.get(it.id);
    const state: DocState = r ? (r.fake ? "fake" : "genuine") : picked === it.id ? "picked" : "idle";
    const body = (
      <DocCard kind={it.kind} title={it.title} lines={it.lines} icon={it.icon} iconLabel={it.iconLabel} state={state} index={i}>
        <Suggests text={it.suggests} />
      </DocCard>
    );
    return (
      <div key={it.id} className="flex flex-col gap-2">
        {rev ? (
          body
        ) : (
          <button type="button" onClick={() => setPicked(it.id)} disabled={!editable} aria-pressed={picked === it.id} className="text-left transition-transform active:scale-[0.99]">
            {body}
            <span className="sr-only">{picked === it.id ? " · scelta come finta" : ""}</span>
          </button>
        )}
        {r && (
          <p className={clsx("rounded-xl px-3 py-2 text-sm font-bold leading-snug", r.fake ? "bg-[#ff3b4e]/15 text-[#ff9aa4]" : "bg-[#c6ff3d]/10 text-[#dfff9a]")}>
            <span className="tg-display mr-1 text-base">{r.fake ? "Falsa:" : "Vera:"}</span>
            {r.note}
            {r.fake && sent && picked === it.id ? " · l'avete smascherata" : ""}
          </p>
        )}
      </div>
    );
  };

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={rev ? undefined : <SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="È questa la finta" hint={picked ? undefined : "Toccate la prova costruita per depistare"} />}
    >
      {rev && <MyOutcome outcome={p.myOutcome} />}
      <Panel className="flex flex-col gap-3">
        <div>
          <Eyebrow>{view.caseTitle}</Eyebrow>
          <p className="mt-1 text-base font-semibold leading-snug text-white/90">{view.story}</p>
        </div>
        <FactList facts={view.facts} />
      </Panel>
      <div className="flex flex-col gap-4">{view.items.map(card)}</div>
      {rev && reveal && <Explain text={reveal.explain} />}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const rev = p.stage === "reveal" && reveal ? new Map(reveal.items.map((i) => [i.id, i])) : null;
  return (
    <TvFrame view={view} p={p} subtitle={rev ? "Il dettaglio che tradisce la prova falsa" : view.story}>
      <div className="flex h-full flex-col gap-[1.1cqw]">
        <TvPanel className="tg-rise shrink-0 py-[1cqw]">
          <p className="tg-display mb-[0.5cqw] text-[2cqw]">{view.caseTitle}</p>
          <FactList facts={view.facts} tv />
        </TvPanel>
        <div className="grid min-h-0 flex-1 grid-cols-3 items-start gap-[1.4cqw]">
          {view.items.map((it, i) => {
            const r = rev?.get(it.id);
            return (
              <div key={it.id} className="tg-rise flex min-h-0 flex-col gap-[0.6cqw]" style={{ animationDelay: `${i * 90}ms` }}>
                <DocCard kind={it.kind} title={it.title} lines={it.lines} icon={it.icon} iconLabel={it.iconLabel} state={r ? (r.fake ? "fake" : "genuine") : "idle"} index={i} tv>
                  {!r && <Suggests text={it.suggests} tv />}
                </DocCard>
                {r && (
                  <p className={clsx("tg-pop rounded-[0.8cqw] px-[0.9cqw] py-[0.6cqw] text-[1.15cqw] font-bold leading-snug", r.fake ? "bg-[#ff3b4e] text-white" : "bg-[#c6ff3d]/15 text-[#dfff9a]")}>
                    <span className="tg-display mr-[0.4cqw] text-[1.5cqw]">{r.fake ? "FALSA" : "Regge"}</span>
                    {r.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {rev && reveal && <TvExplain text={reveal.explain} className="shrink-0 py-[0.9cqw]" />}
      </div>
    </TvFrame>
  );
}

export const laFintaProvaUi = defineUi(Player, Tv);
