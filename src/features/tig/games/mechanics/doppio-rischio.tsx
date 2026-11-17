"use client";

import { useState } from "react";
import type { DoppioReveal, DoppioSubmission, DoppioView, Rate } from "@/lib/tig/games/mechanics/doppio-rischio";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { BigToggle, ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<DoppioView, null, DoppioSubmission, DoppioReveal>;
type T = TvGameProps<DoppioView, DoppioReveal>;

const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

function Player(p: P) {
  const { view, reveal } = p;
  const [rate, setRate] = useState<Rate | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!rate && !!picked;
  const submit = () => ready && p.canSubmit && send({ rate: rate!, optionId: picked! });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-snug">{reveal.prompt}</p>
          <ChoiceList options={view.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label={rate === "alta" ? "Invia · tariffa ALTA" : "Invia la risposta"} hint={!rate ? "Scegliete la tariffa" : !picked ? "Scegliete la risposta" : undefined} />}
    >
      <Panel className="flex flex-col gap-3">
        <Eyebrow>1 · La tariffa</Eyebrow>
        <BigToggle<Rate>
          label="Tariffa"
          value={rate}
          onChange={setRate}
          disabled={!editable}
          options={[
            { id: "normale", title: "Normale", sub: `${sign(view.rates.normale.win)} se giusta · ${sign(view.rates.normale.lose)} se sbagliata`, tone: "ice" },
            { id: "alta", title: "Alta", sub: `${sign(view.rates.alta.win)} se giusta · ${sign(view.rates.alta.lose)} se sbagliata`, tone: "red", icon: "flame" },
          ]}
        />
      </Panel>
      <Panel className="flex flex-col gap-3">
        <Eyebrow>2 · La domanda</Eyebrow>
        <p className="text-lg font-extrabold leading-snug">{view.prompt}</p>
        <ChoiceList options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  return (
    <TvFrame view={view} p={p}>
      <div className="grid h-full grid-cols-[1.6fr_1fr] gap-[1.6cqw]">
        <TvPanel className="flex flex-col gap-[1cqw]">
          <p className="text-[2.4cqw] font-extrabold leading-tight">{view.prompt}</p>
          <div className="grid grid-cols-2 gap-[0.7cqw]">
            {view.options.map((o, i) => (
              <TvOption key={o.id} index={i} text={o.text} state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
            ))}
          </div>
          {done && <TvExplain text={reveal.explain} className="mt-auto" />}
        </TvPanel>
        <div className="flex flex-col gap-[1.2cqw]">
          <TvPanel className="flex flex-col gap-[0.4cqw]">
            <p className="tg-display text-[2.6cqw]">Normale</p>
            <p className="tg-num text-[3.6cqw] text-[#c6ff3d]">{sign(view.rates.normale.win)}</p>
            <p className="text-[1.4cqw] font-bold text-white/70">se sbagliata: {sign(view.rates.normale.lose)}</p>
          </TvPanel>
          <TvPanel tone="red" className="flex flex-col gap-[0.4cqw]">
            <p className="tg-display text-[2.6cqw] text-[#ff3b4e]">Alta</p>
            <p className="tg-num text-[3.6cqw] text-[#c6ff3d]">{sign(view.rates.alta.win)}</p>
            <p className="text-[1.4cqw] font-bold text-white/70">se sbagliata: {sign(view.rates.alta.lose)}</p>
          </TvPanel>
        </div>
      </div>
    </TvFrame>
  );
}

export const doppioRischioUi = defineUi(Player, Tv);
