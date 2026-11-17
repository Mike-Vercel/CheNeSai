"use client";

import { useState } from "react";
import type { MaggioranzaReveal, MaggioranzaSubmission, MaggioranzaView } from "@/lib/tig/games/mechanics/prevedi-la-maggioranza";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { VoteBars } from "../kit/bars";
import { defineUi } from "../kit/define";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<MaggioranzaView, null, MaggioranzaSubmission, MaggioranzaReveal>;
type T = TvGameProps<MaggioranzaView, MaggioranzaReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const [vote, setVote] = useState<string | null>(null);
  const [guess, setGuess] = useState<string | null>(null);
  const { send, pending, error } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!vote && !!guess;
  const submit = () => ready && p.canSubmit && send({ vote: vote!, guess: guess! });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {reveal.summary && (
          <Panel className="flex flex-col gap-2">
            <Eyebrow>Il locale ha votato · {reveal.summary.tables} tavoli</Eyebrow>
            <VoteBars options={view.options} percent={reveal.summary.percent} winners={reveal.summary.winners} />
          </Panel>
        )}
        <Explain text={reveal.explain} title="Il locale" />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Vota e prevedi" hint={!vote ? "Prima il vostro voto" : !guess ? "Poi la previsione sul locale" : undefined} />}
    >
      <Panel>
        <p className="text-xl font-extrabold leading-snug">{view.prompt}</p>
      </Panel>
      <Panel className="flex flex-col gap-2">
        <Eyebrow>1 · Il voto del vostro tavolo</Eyebrow>
        <ChoiceList options={view.options} picked={vote ? [vote] : []} onToggle={(id) => editable && setVote(id)} disabled={!editable} keys={!vote} label="Il vostro voto" />
      </Panel>
      <Panel className="flex flex-col gap-2">
        <Eyebrow>2 · Cosa voterà la maggioranza dei tavoli?</Eyebrow>
        <ChoiceList options={view.options} picked={guess ? [guess] : []} onToggle={(id) => editable && setGuess(id)} disabled={!editable} keys={!!vote} onConfirm={submit} label="La vostra previsione" />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Ecco cosa ha scelto il locale" : "Un voto per tavolo, più la previsione: chi indovina la maggioranza prende 100."}>
      <div className="mx-auto flex h-full max-w-[80cqw] flex-col gap-[1.4cqw]">
        <TvPanel className="tg-rise">
          <p className="text-center text-[3cqw] font-extrabold leading-tight">{view.prompt}</p>
        </TvPanel>
        {done && reveal.summary ? (
          <div className="grid flex-1 grid-cols-[1.4fr_1fr] gap-[1.4cqw]">
            <TvPanel>
              <VoteBars options={view.options} percent={reveal.summary.percent} counts={reveal.summary.counts} winners={reveal.summary.winners} tv />
            </TvPanel>
            <TvExplain text={reveal.explain} className="self-start" />
          </div>
        ) : (
          <div className={`grid gap-[1cqw] ${view.options.length > 2 ? "grid-cols-2" : "grid-cols-2"}`}>
            {view.options.map((o, i) => (
              <TvOption key={o.id} index={i} text={<span className="text-[2.2cqw]">{o.text}</span>} />
            ))}
          </div>
        )}
      </div>
    </TvFrame>
  );
}

export const prevediLaMaggioranzaUi = defineUi(Player, Tv);
