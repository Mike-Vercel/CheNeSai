"use client";

import { useState } from "react";
import type { GreggeReveal, GreggeSubmission, GreggeView } from "@/lib/tig/games/mechanics/effetto-gregge";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { VoteBars } from "../kit/bars";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { BigToggle, ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { PromptCard, Step, TvExplainCompact, TvStamp } from "./_m3-kit";

type P = PlayerGameProps<GreggeView, null, GreggeSubmission, GreggeReveal>;
type T = TvGameProps<GreggeView, GreggeReveal>;
type Strategy = "istinto" | "gregge";

function herdVerdict(s: NonNullable<GreggeReveal["summary"]>): { text: string; tone: "lime" | "red" | "ice" } {
  if (s.herdRight === null) return { text: "Gregge diviso", tone: "ice" };
  return s.herdRight ? { text: "Il gregge aveva ragione", tone: "lime" } : { text: "Il gregge sbagliava", tone: "red" };
}

function Player(p: P) {
  const { view, reveal } = p;
  const [answer, setAnswer] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const { send, pending, error } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!answer && !!strategy;
  const submit = () => ready && p.canSubmit && send({ optionId: answer!, follow: strategy === "gregge" });

  if (p.stage === "reveal" && reveal) {
    const s = reveal.summary;
    const mine = s?.picks[p.myTeam.teamId];
    const textOf = (id: string) => view.options.find((o) => o.id === id)?.text ?? id;
    const v = s ? herdVerdict(s) : null;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {s && v && (
          <Panel tone={v.tone === "ice" ? undefined : v.tone} className="text-center">
            <p className="tg-display text-4xl">{v.text}</p>
            <p className="text-base font-bold">
              {s.followers} tavoli su {s.tables} hanno seguito il gregge
            </p>
          </Panel>
        )}
        {mine && (
          <p className="px-1 text-base font-bold text-(--tg-cream)/85">
            Avete scelto {mine.follow ? "il gregge" : "l'istinto"}: valeva «{textOf(mine.effective)}».
          </p>
        )}
        {s && (
          <Panel className="flex flex-col gap-2">
            <Eyebrow>Le risposte del locale · quella giusta ha la corona</Eyebrow>
            <VoteBars options={view.options} percent={s.percent} counts={s.counts} winners={[reveal.solutionId]} />
          </Panel>
        )}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Conferma" hint={!answer ? "Prima la vostra risposta" : !strategy ? "Poi: istinto o gregge?" : undefined} />}
    >
      <PromptCard>{view.prompt}</PromptCard>
      <Step n={1} title="La vostra risposta" done={!!answer}>
        <ChoiceList options={view.options} picked={answer ? [answer] : []} onToggle={(id) => editable && setAnswer(id)} disabled={!editable} onConfirm={ready ? submit : null} label="La vostra risposta" />
      </Step>
      <Step n={2} title="Su cosa scommettete?" done={!!strategy}>
        <BigToggle<Strategy>
          label="Istinto o gregge"
          value={strategy}
          onChange={(v) => editable && setStrategy(v)}
          disabled={!editable}
          options={[
            { id: "istinto", title: "Istinto", sub: "Vale la vostra risposta: giusta 100", tone: "lime", icon: "bolt" },
            { id: "gregge", title: "Gregge", sub: "Vale la più votata dal locale: giusta 60", tone: "ice", icon: "users" },
          ]}
        />
      </Step>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  const v = s ? herdVerdict(s) : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "La risposta giusta e cosa ha fatto il gregge" : "Istinto: vale la vostra risposta (100). Gregge: vale la più votata dal locale (60)."}>
      <div className="grid h-full grid-cols-[1.25fr_1fr] gap-[1.6cqw]">
        <TvPanel className="flex min-h-0 flex-col gap-[0.8cqw]">
          <p className="text-[2.3cqw] font-extrabold leading-tight">{view.prompt}</p>
          {s ? <VoteBars options={view.options} percent={s.percent} counts={s.counts} winners={[reveal!.solutionId]} tv /> : view.options.map((o, i) => <TvOption key={o.id} index={i} text={o.text} />)}
        </TvPanel>
        {s && v ? (
          <div className="flex min-h-0 flex-col gap-[1cqw]">
            <TvStamp size="sm" tone={v.tone} sub={`${s.followers} tavoli su ${s.tables} hanno seguito il gregge`}>
              {v.text}
            </TvStamp>
            <TvExplainCompact text={reveal!.explain} className="flex-1" />
          </div>
        ) : (
          <div className="grid grid-rows-2 gap-[1.2cqw]">
            <TvPanel tone="lime" className="flex items-center gap-[1.2cqw]">
              <Icon name="bolt" className="h-[5cqw] w-[5cqw] shrink-0 text-(--tg-gold)" />
              <div>
                <p className="tg-display text-[3.4cqw] leading-none">Istinto</p>
                <p className="text-[1.5cqw] font-bold text-(--tg-cream)/80">La vostra risposta · giusta 100</p>
              </div>
            </TvPanel>
            <TvPanel className="flex items-center gap-[1.2cqw]">
              <Icon name="users" className="h-[5cqw] w-[5cqw] shrink-0 text-(--tg-cream)" />
              <div>
                <p className="tg-display text-[3.4cqw] leading-none">Gregge</p>
                <p className="text-[1.5cqw] font-bold text-(--tg-cream)/80">La più votata dal locale · giusta 60</p>
              </div>
            </TvPanel>
          </div>
        )}
      </div>
    </TvFrame>
  );
}

export const effettoGreggeUi = defineUi(Player, Tv);
