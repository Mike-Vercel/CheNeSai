"use client";

import { useState } from "react";
import type { BuiaMemberView, BuiaReveal, BuiaSubmission, BuiaView } from "@/lib/tig/games/mechanics/classifica-buia";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";
import { BalanceCard, M5Toggle, secsTo, TvBigWait, TvOutcomeGrid, TvTeamTag } from "./m5-kit";

type P = PlayerGameProps<BuiaView, BuiaMemberView, BuiaSubmission, BuiaReveal>;
type T = TvGameProps<BuiaView, BuiaReveal>;
type Choice = BuiaSubmission["choice"];

function Player(p: P) {
  const { view, reveal, memberView: mv } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const choosing = p.stage === "play" && elapsed < view.choiceWindowMs;
  // finita la finestra senza scelta: resta solo la prudenza (il rischio si decide prima di vedere la domanda)
  const effective: Choice | null = choice ?? (choosing ? null : "prudenza");
  const loss = mv?.loss ?? view.riskLossMax;
  const question = !choosing && effective === "rischio" && view.prompt && view.options;
  const ready = effective === "prudenza" || (effective === "rischio" && !!picked && !choosing);
  const submit = () => {
    if (!ready || !p.canSubmit) return;
    send(effective === "rischio" ? { choice: "rischio", optionId: picked! } : { choice: "prudenza" });
  };

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <Eyebrow>{reveal.category}</Eyebrow>
          <p className="text-lg font-extrabold leading-snug">{reveal.prompt}</p>
          <ChoiceList options={reveal.options} picked={sent && effective === "rischio" && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
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
          label={effective === "prudenza" ? `Prudenza: +${view.safePoints}` : "Rischio: rispondi"}
          hint={choosing ? `La domanda arriva tra ${secsTo(view.choiceWindowMs, elapsed)} s: la scelta si blocca lì` : effective === "rischio" && !picked ? "Scegliete la risposta" : undefined}
        />
      }
    >
      <BalanceCard balance={mv?.balance ?? null} note="Classifica buia: le posizioni degli altri non si vedono. Si scopre tutto alla fine." />
      <Panel className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Icon name="eye" className="h-8 w-8 shrink-0 text-(--tg-teal-hi)" />
          <div className="min-w-0">
            <Eyebrow>Categoria della domanda</Eyebrow>
            <p className="tg-display text-3xl leading-none">{view.category}</p>
          </div>
        </div>
        <M5Toggle<Choice>
          label="Prudenza o rischio"
          value={effective}
          onChange={setChoice}
          disabled={!editable || !choosing}
          options={[
            { id: "prudenza", title: "Prudenza", sub: `+${view.safePoints} sicuri, niente domanda`, tone: "gold", icon: "shield" },
            { id: "rischio", title: "Rischio", sub: `Giusta +${view.riskWin}, sbagliata −${loss}`, tone: "red", icon: "flame" },
          ]}
        />
        {!choosing && !choice && p.stage === "play" && <p className="text-sm font-bold text-(--tg-teal-pale)">Tempo di scelta finito: per voi vale la prudenza.</p>}
      </Panel>
      {question && (
        <Panel tone="red" className="tg-rise flex flex-col gap-3">
          <p className="text-xl font-extrabold leading-snug">{view.prompt}</p>
          <ChoiceList options={view.options!} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
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
    const choiceOf = new Map((reveal.summary?.choices ?? []).map((c) => [c.teamId, c.choice]));
    return (
      <TvFrame view={view} p={{ ...p, teams: [] }} subtitle={`${reveal.category} · chi ha rischiato e chi no`}>
        <div className="grid h-full grid-cols-[1.2fr_1fr] gap-[1.4cqw]">
          <div className="flex min-h-0 flex-col gap-[1cqw]">
            <TvPanel className="tg-rise flex flex-col gap-[0.8cqw]">
              <p className="text-[1.9cqw] font-extrabold leading-tight">{reveal.prompt}</p>
              <div className="grid grid-cols-2 gap-[0.6cqw]">
                {reveal.options.map((o, i) => (
                  <TvOption key={o.id} index={i} text={o.text} size="sm" state={o.id === reveal.solutionId ? "right" : "dim"} />
                ))}
              </div>
            </TvPanel>
            <TvExplain text={reveal.explain} />
          </div>
          <TvPanel className="min-h-0 p-[1cqw]">
            <TvOutcomeGrid cols={2} teams={p.teams} outcome={p.outcome} note={(id) => (choiceOf.get(id) === "rischio" ? "Rischio" : choiceOf.get(id) === "prudenza" ? "Prudenza" : "Nessuna scelta")} />
          </TvPanel>
        </div>
      </TvFrame>
    );
  }

  if (choosing || !view.prompt || !view.options) {
    return (
      <TvFrame view={view} p={p} subtitle="Le posizioni sono al buio: ogni tavolo vede solo il proprio saldo.">
        <div className="grid h-full grid-cols-[1fr_1.1fr] gap-[1.4cqw]">
          <TvPanel className="flex min-h-0 flex-col gap-[0.6cqw]">
            <p className="text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-cream)/60">Classifica</p>
            <div className="grid content-start gap-[0.5cqw]" style={{ gridTemplateColumns: p.teams.length > 8 ? "1fr 1fr" : "1fr" }}>
              {p.teams.map((tm, i) => (
                <div key={tm.teamId} className="flex min-w-0 items-center gap-[0.6cqw] rounded-[0.7cqw] border border-(--tg-cream)/8 bg-(--tg-cream)/[0.03] px-[0.7cqw] py-[0.4cqw]">
                  <span className="tg-num w-[1.6cqw] text-[1.3cqw] text-(--tg-cream)/40">?</span>
                  <TvTeamTag team={tm} className="min-w-0 flex-1 opacity-80" />
                  <span className="tg-num shrink-0 text-[1.5cqw] tracking-[0.2em] text-(--tg-cream)/35" style={{ animationDelay: `${i * 40}ms` }}>
                    •••
                  </span>
                </div>
              ))}
            </div>
          </TvPanel>
          <TvBigWait
            icon="eye"
            kicker={view.category}
            title={choosing ? "Prudenza o rischio?" : "Si decide"}
            sub={choosing ? `La domanda tra ${secsTo(view.choiceWindowMs, elapsed)} s` : undefined}
          />
        </div>
      </TvFrame>
    );
  }

  return (
    <TvFrame view={view} p={p} subtitle={`${view.category} · rispondono solo i tavoli che hanno scelto il rischio`}>
      <div className="flex h-full flex-col justify-center gap-[1.4cqw]">
        <TvPanel tone="red" className="tg-rise flex flex-col gap-[1cqw] p-[2.2cqw]">
          <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.25em] text-(--tg-red-hi)">
            Rischio: +{view.riskWin} o fino a −{view.riskLossMax}
          </p>
          <p className="text-[2.8cqw] font-extrabold leading-tight">{view.prompt}</p>
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

export const classificaBuiaUi = defineUi(Player, Tv);
