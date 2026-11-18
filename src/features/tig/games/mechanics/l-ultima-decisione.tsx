"use client";

import { useState } from "react";
import type { DecisioneMemberView, DecisioneReveal, DecisioneSubmission, DecisioneView } from "@/lib/tig/games/mechanics/l-ultima-decisione";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";
import { BalanceCard, M5Toggle, secsTo, TvLadder, TvWhy } from "./m5-kit";

type P = PlayerGameProps<DecisioneView, DecisioneMemberView, DecisioneSubmission, DecisioneReveal>;
type T = TvGameProps<DecisioneView, DecisioneReveal>;
type Choice = DecisioneSubmission["choice"];

function Player(p: P) {
  const { view, reveal, memberView: mv } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const choosing = p.stage === "play" && elapsed < view.choiceWindowMs;
  // finita la finestra senza scelta vale il premio sicuro: il rischio si dichiara prima di vedere l'enigma
  const effective: Choice | null = choice ?? (choosing ? null : "sicuro");
  const stake = mv?.stake ?? null;
  const ready = !choosing && !!effective && !!picked;
  const submit = () => ready && p.canSubmit && send({ choice: effective!, optionId: picked! });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <Eyebrow>{reveal.heading}</Eyebrow>
          <p className="text-lg font-extrabold leading-snug">{reveal.prompt}</p>
          <ChoiceList options={reveal.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

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
          ready={ready}
          pending={pending}
          error={error}
          onSubmit={submit}
          label={effective === "rischio" ? `Rischio: +${view.riskPoints}` : `Sicuro: +${view.safePoints}`}
          hint={choosing ? `L'enigma arriva tra ${secsTo(view.choiceWindowMs, elapsed)} s: la scelta si blocca lì` : !picked ? "Risolvete l'enigma" : undefined}
        />
      }
    >
      <BalanceCard
        balance={mv?.balance ?? null}
        note={stake === null ? `Rischio: sbagliando perdete il ${Math.round(view.stakeShare * 100)}% del saldo (max ${view.stakeCap})` : stake > 0 ? `Rischio: sbagliando perdete ${stake} punti` : "Saldo a zero: col rischio non perdete nulla"}
      />
      <Panel className="flex flex-col gap-2">
        <Eyebrow className="text-(--tg-teal-hi)">{choosing ? "L'ultima decisione della serata" : "Decisione bloccata"}</Eyebrow>
        <M5Toggle<Choice>
          label="Premio sicuro o grande rischio"
          value={effective}
          onChange={setChoice}
          disabled={!editable || !choosing}
          options={[
            { id: "sicuro", title: "Sicuro", sub: `Risolto +${view.safePoints}, sbagliato 0`, tone: "gold", icon: "shield" },
            { id: "rischio", title: "Rischio", sub: `Risolto +${view.riskPoints}, sbagliato −${stake ?? `${Math.round(view.stakeShare * 100)}%`}`, tone: "red", icon: "flame" },
          ]}
        />
        {!choosing && !choice && p.stage === "play" && <p className="text-sm font-bold text-(--tg-teal-pale)">Tempo di scelta finito: per voi vale il premio sicuro.</p>}
      </Panel>
      {!choosing && view.prompt && view.options ? (
        <Panel tone={effective === "rischio" ? "red" : "lime"} className="tg-rise flex flex-col gap-3">
          <Eyebrow>{view.heading}</Eyebrow>
          <p className="text-xl font-extrabold leading-snug">{view.prompt}</p>
          <ChoiceList options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
        </Panel>
      ) : (
        <Panel className="flex flex-col items-center gap-2 py-8 text-center">
          <Icon name="lock" className="h-10 w-10 text-(--tg-cream)/60" />
          <p className="tg-display text-3xl">L&apos;enigma tra</p>
          <p className="tg-num text-6xl text-(--tg-gold)" aria-live="polite">
            {secsTo(view.choiceWindowMs, elapsed)}
          </p>
        </Panel>
      )}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const choosing = p.stage === "play" && elapsed < view.choiceWindowMs;

  if (p.stage === "reveal" && reveal) {
    const ladder = reveal.summary?.ladder ?? [];
    const choiceOf = new Map(ladder.map((l) => [l.teamId, l.choice]));
    // dal fondo alla vetta: il migliore in alto, le righe compaiono dal basso (chi non ha risposto sta a zero)
    const pts = new Map((p.outcome?.outcomes ?? []).map((o) => [o.teamId, o.points]));
    const rows = p.teams.map((x) => ({
      teamId: x.teamId,
      points: pts.get(x.teamId) ?? 0,
      note: choiceOf.get(x.teamId) === "rischio" ? "Rischio" : choiceOf.get(x.teamId) === "sicuro" ? "Sicuro" : "—",
    }));
    return (
      <TvFrame view={view} p={{ ...p, teams: [] }} subtitle="Dal fondo alla vetta: gli esiti dell'ultima decisione">
        <div className="grid h-full grid-cols-[1fr_1.15fr] gap-[1.4cqw]">
          <div className="flex min-h-0 flex-col gap-[1cqw]">
            <TvPanel className="tg-rise flex flex-col gap-[0.7cqw]">
              <p className="text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-teal-hi)">{reveal.heading}</p>
              <p className="text-[1.55cqw] font-extrabold leading-tight">{reveal.prompt}</p>
              <div className="grid grid-cols-2 gap-[0.5cqw]">
                {reveal.options.map((o, i) => (
                  <TvOption key={o.id} index={i} text={o.text} size="sm" state={o.id === reveal.solutionId ? "right" : "dim"} />
                ))}
              </div>
            </TvPanel>
            <TvWhy text={reveal.explain} />
          </div>
          <TvPanel className="flex min-h-0 flex-col gap-[0.6cqw] self-start p-[1cqw]">
            <p className="flex items-center gap-[0.5cqw] text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-gold)">
              <Icon name="up" className="h-[1.4cqw] w-[1.4cqw]" /> Dal fondo alla vetta
            </p>
            <TvLadder teams={p.teams} rows={rows} />
          </TvPanel>
        </div>
      </TvFrame>
    );
  }

  if (choosing || !view.prompt || !view.options) {
    return (
      <TvFrame view={view} p={p} subtitle={`${view.heading} · prima la scelta, poi l'enigma uguale per tutti`}>
        <div className="flex h-full flex-col justify-center gap-[1.6cqw]">
          <div className="grid grid-cols-2 gap-[1.6cqw]">
            <TvPanel tone="lime" className="tg-rise flex flex-col items-center gap-[0.6cqw] p-[2cqw] text-center">
              <Icon name="shield" className="h-[5cqw] w-[5cqw] text-(--tg-gold)" />
              <p className="tg-display text-[3.6cqw]">Premio sicuro</p>
              <p className="tg-num text-[6cqw] leading-none text-(--tg-gold)">{view.safePoints}</p>
              <p className="text-[1.4cqw] font-bold text-(--tg-cream)/75">Enigma sbagliato: 0</p>
            </TvPanel>
            <TvPanel tone="red" className="tg-rise flex flex-col items-center gap-[0.6cqw] p-[2cqw] text-center">
              <Icon name="flame" className="h-[5cqw] w-[5cqw] text-(--tg-red-hi)" />
              <p className="tg-display text-[3.6cqw]">Grande rischio</p>
              <p className="tg-num text-[6cqw] leading-none text-(--tg-red-hi)">{view.riskPoints}</p>
              <p className="text-[1.4cqw] font-bold text-(--tg-cream)/75">
                Enigma sbagliato: −{Math.round(view.stakeShare * 100)}% del saldo (max {view.stakeCap})
              </p>
            </TvPanel>
          </div>
          <p className="tg-display text-center text-[3cqw]">
            L&apos;enigma tra <span className="tg-num text-(--tg-gold)">{secsTo(view.choiceWindowMs, elapsed)}</span>
          </p>
        </div>
      </TvFrame>
    );
  }

  return (
    <TvFrame view={view} p={p} subtitle={`${view.heading} · un solo enigma per tutti: decide la scelta di prima`}>
      <div className="flex h-full flex-col justify-center gap-[1.4cqw]">
        <TvPanel className="tg-rise flex flex-col gap-[1cqw] p-[2.2cqw]">
          <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.25em] text-(--tg-teal-hi)">L&apos;ultimo enigma</p>
          <p className="text-[2.5cqw] font-extrabold leading-tight">{view.prompt}</p>
        </TvPanel>
        <div className="grid grid-cols-2 gap-[1cqw]">
          {view.options.map((o, i) => (
            <TvOption key={o.id} index={i} text={o.text} />
          ))}
        </div>
      </div>
    </TvFrame>
  );
}

export const lUltimaDecisioneUi = defineUi(Player, Tv);
