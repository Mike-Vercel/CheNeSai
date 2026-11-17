"use client";

import { useState } from "react";
import type { SicuroReveal, SicuroSubmission, SicuroView } from "@/lib/tig/games/mechanics/sicuro-o-rischio";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { BigToggle, ChoiceList, NumberField } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<SicuroView, null, SicuroSubmission, SicuroReveal>;
type T = TvGameProps<SicuroView, SicuroReveal>;
type Branch = SicuroSubmission["branch"];

function Player(p: P) {
  const { view, reveal } = p;
  const [branch, setBranch] = useState<Branch | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [num, setNum] = useState("");
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = branch === "sicuro" ? !!picked : branch === "rischio" ? num.length > 0 : false;
  const submit = () => {
    if (!ready || !p.canSubmit) return;
    send(branch === "sicuro" ? { branch: "sicuro", optionId: picked! } : { branch: "rischio", number: Number(num) });
  };

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <Eyebrow>Sicuro · {view.safe.points}</Eyebrow>
          <p className="text-base font-extrabold leading-snug">{reveal.safe.prompt}</p>
          <ChoiceList options={reveal.safe.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.safe.solutionId] }} />
        </Panel>
        <Panel tone="red" className="flex flex-col gap-2">
          <Eyebrow className="text-[#ff8c97]">Rischio · {view.risky.points}</Eyebrow>
          <p className="text-base font-extrabold leading-snug">{reveal.risky.prompt}</p>
          <p className="tg-num text-5xl text-[#c6ff3d]">
            {reveal.risky.solution} <span className="tg-display text-2xl text-white/70">{reveal.risky.unit}</span>
          </p>
          <p className="text-sm font-semibold text-white/80">{reveal.risky.why}</p>
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label={branch === "rischio" ? `Rischio: ${view.risky.points}` : branch === "sicuro" ? `Sicuro: ${view.safe.points}` : "Invia"} hint={!branch ? "Scegliete il ramo: si gioca una sola prova" : undefined} />}
    >
      <Panel className="flex flex-col gap-3">
        <Eyebrow>{view.theme} · scegliete il ramo</Eyebrow>
        <BigToggle<Branch>
          label="Ramo"
          value={branch}
          onChange={setBranch}
          disabled={!editable}
          options={[
            { id: "sicuro", title: `Sicuro ${view.safe.points}`, sub: "Tre opzioni, più accessibile", tone: "lime", icon: "shield" },
            { id: "rischio", title: `Rischio ${view.risky.points}`, sub: "Numero esatto, nessuna opzione", tone: "red", icon: "flame" },
          ]}
        />
      </Panel>
      {branch === "sicuro" && (
        <Panel className="tg-rise flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-snug">{view.safe.prompt}</p>
          <ChoiceList options={view.safe.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
        </Panel>
      )}
      {branch === "rischio" && (
        <Panel tone="red" className="tg-rise flex flex-col gap-3">
          <p className="text-lg font-extrabold leading-snug">{view.risky.prompt}</p>
          <NumberField label="Risposta esatta" value={num} onChange={setNum} maxDigits={view.risky.maxDigits} unit={view.risky.unit} disabled={!editable} onEnter={submit} />
        </Panel>
      )}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  return (
    <TvFrame view={view} p={p} subtitle={`${view.theme} · una sola prova a testa, sbagliare vale zero`}>
      <div className="grid h-full grid-cols-2 gap-[1.6cqw]">
        <TvPanel tone="lime" className="tg-rise flex flex-col gap-[1cqw]">
          <div className="flex items-center gap-[1cqw]">
            <Icon name="shield" className="h-[3.4cqw] w-[3.4cqw] text-[#c6ff3d]" />
            <p className="tg-display text-[3.4cqw]">Sicuro</p>
            <p className="tg-num ml-auto text-[4.4cqw] text-[#c6ff3d]">{view.safe.points}</p>
          </div>
          <p className="text-[1.9cqw] font-extrabold leading-tight">{view.safe.prompt}</p>
          {(done ? reveal.safe.options : view.safe.options).map((o, i) => (
            <TvOption key={o.id} index={i} text={o.text} state={done ? (o.id === reveal.safe.solutionId ? "right" : "dim") : "idle"} />
          ))}
          {done && <p className="mt-auto text-[1.4cqw] font-semibold leading-snug text-white/85">{reveal.explain}</p>}
        </TvPanel>
        <TvPanel tone="red" className="tg-rise flex flex-col gap-[1cqw]" >
          <div className="flex items-center gap-[1cqw]">
            <Icon name="flame" className="h-[3.4cqw] w-[3.4cqw] text-[#ff3b4e]" />
            <p className="tg-display text-[3.4cqw]">Rischio</p>
            <p className="tg-num ml-auto text-[4.4cqw] text-[#ff3b4e]">{view.risky.points}</p>
          </div>
          <p className="text-[1.9cqw] font-extrabold leading-tight">{view.risky.prompt}</p>
          {done ? (
            <div className="tg-pop mt-auto flex flex-col gap-[0.5cqw]">
              <p className="tg-num text-[6cqw] leading-none text-[#c6ff3d]">
                {reveal.risky.solution} <span className="tg-display text-[2.4cqw] text-white/70">{reveal.risky.unit}</span>
              </p>
              <p className="text-[1.4cqw] font-semibold leading-snug text-white/85">{reveal.risky.why}</p>
            </div>
          ) : (
            <p className="mt-auto text-[1.5cqw] font-bold text-white/60">Risposta esatta in {view.risky.unit}: niente opzioni, niente fortuna.</p>
          )}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const sicuroORischioUi = defineUi(Player, Tv);
