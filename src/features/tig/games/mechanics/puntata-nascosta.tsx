"use client";

import { useState } from "react";
import type { PuntataMemberView, PuntataReveal, PuntataSubmission, PuntataView } from "@/lib/tig/games/mechanics/puntata-nascosta";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { AmountPicker, ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";

type P = PlayerGameProps<PuntataView, PuntataMemberView, PuntataSubmission, PuntataReveal>;
type T = TvGameProps<PuntataView, PuntataReveal>;

function Player(p: P) {
  const { view, reveal, memberView: mv } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [bet, setBet] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const betting = p.stage === "play" && elapsed < view.betWindowMs;
  const max = mv?.maxBet ?? view.betCap;
  const step = view.step;
  const ready = !betting && !!picked && !!view.options;
  const submit = () => ready && p.canSubmit && send({ bet, optionId: picked! });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-snug">{reveal.prompt}</p>
          <ChoiceList options={reveal.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  const quarters = [0, Math.floor(max / 3 / step) * step, Math.floor((max * 2) / 3 / step) * step, max];
  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={
        <SubmitBar
          canSubmit={p.canSubmit}
          submitted={p.submitted}
          stage={p.stage}
          ready={ready}
          pending={pending}
          error={error}
          onSubmit={submit}
          label={`Punta ${bet} e rispondi`}
          hint={betting ? `La domanda arriva tra ${Math.ceil((view.betWindowMs - elapsed) / 1000)} s: intanto la puntata` : !picked ? "Scegliete la risposta" : undefined}
        />
      }
    >
      <Panel className="flex items-center gap-3 py-3">
        <Icon name="coins" className="h-8 w-8 shrink-0 text-(--tg-teal-hi)" />
        <div>
          <Eyebrow>Categoria</Eyebrow>
          <p className="tg-display text-3xl">{view.category}</p>
        </div>
      </Panel>
      <Panel tone={betting ? "lime" : undefined}>
        {betting || !editable ? (
          <AmountPicker label={betting ? "La puntata segreta" : "Puntata bloccata"} value={bet} max={max} step={step} onChange={setBet} disabled={!betting || !editable} presets={quarters} />
        ) : (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.14em] text-(--tg-mute)">
              <Icon name="lock" className="h-4 w-4" /> Puntata bloccata
            </span>
            <span className="tg-num text-4xl text-(--tg-gold)">{bet}</span>
          </div>
        )}
        <p className="mt-2 text-xs font-semibold text-(--tg-cream)/60">
          Massimo: 25% del saldo{mv?.balance != null ? ` (${mv.balance})` : ""}, mai oltre {view.betCap}. Giusta +puntata, sbagliata −puntata.
        </p>
      </Panel>
      {!betting && view.prompt && view.options && (
        <Panel className="tg-rise flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-snug">{view.prompt}</p>
          <ChoiceList options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
        </Panel>
      )}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const betting = p.stage === "play" && elapsed < view.betWindowMs;
  const done = p.stage === "reveal" && reveal;
  const prompt = done ? reveal.prompt : view.prompt;
  const options = done ? reveal.options : view.options;
  return (
    <TvFrame view={view} p={p} subtitle={betting ? "Puntate in segreto: massimo 25% del saldo, mai oltre 250." : view.rule}>
      {betting || !prompt || !options ? (
        <div className="flex h-full flex-col items-center justify-center gap-[1.6cqw]">
          <Icon name="coins" className="h-[8cqw] w-[8cqw] text-(--tg-teal-hi)" />
          <p className="text-[1.4cqw] font-extrabold uppercase tracking-[0.3em] text-(--tg-cream)/60">Categoria</p>
          <p className="tg-display tg-pop text-[7cqw] leading-none">{view.category}</p>
          <p className="tg-num text-[3cqw] text-(--tg-gold)">La domanda tra {Math.max(0, Math.ceil((view.betWindowMs - elapsed) / 1000))} s</p>
        </div>
      ) : (
        <div className="grid h-full grid-cols-[1.5fr_1fr] gap-[1.6cqw]">
          <TvPanel className="tg-rise flex flex-col gap-[1cqw]">
            <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-teal-hi)">{view.category}</p>
            <p className="text-[2.5cqw] font-extrabold leading-tight">{prompt}</p>
            <div className="grid grid-cols-2 gap-[0.7cqw]">
              {options.map((o, i) => (
                <TvOption key={o.id} index={i} text={o.text} state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
              ))}
            </div>
          </TvPanel>
          {done ? (
            <TvExplain text={reveal.explain} className="self-start" />
          ) : (
            <TvPanel className="flex flex-col items-center justify-center gap-[0.8cqw] text-center">
              <Icon name="lock" className="h-[5cqw] w-[5cqw] text-(--tg-cream)/70" />
              <p className="tg-display text-[3cqw]">Puntate chiuse</p>
              <p className="text-[1.5cqw] font-bold text-(--tg-cream)/70">Nessuno vede quanto ha puntato l&apos;altro.</p>
            </TvPanel>
          )}
        </div>
      )}
    </TvFrame>
  );
}

export const puntataNascostaUi = defineUi(Player, Tv);
