"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { MemoriaLampoReveal, MemoriaLampoSubmission, MemoriaLampoView } from "@/lib/tig/games/mechanics/memoria-lampo";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { ChoiceList, toggleId } from "../kit/inputs";
import { SceneArt } from "../kit/scene";
import { canEdit, elapsedOf, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useClock, useSubmit, WatchTv } from "../kit/ui";

type P = PlayerGameProps<MemoriaLampoView, null, MemoriaLampoSubmission, MemoriaLampoReveal>;
type T = TvGameProps<MemoriaLampoView, MemoriaLampoReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [tab, setTab] = useState(0);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const done = view.questions.every((q) => (answers[q.id]?.length ?? 0) > 0);
  const submit = () => done && p.canSubmit && send({ answers });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="p-2">
          <SceneArt scene={reveal.scene} alt={reveal.alt} className="w-full rounded-xl" />
        </Panel>
        {reveal.questions.map((q) => (
          <Panel key={q.id} className="flex flex-col gap-2">
            <p className="text-lg font-extrabold leading-snug">{q.prompt}</p>
            <ChoiceList options={q.options} picked={sent ? (answers[q.id] ?? []) : []} onToggle={() => {}} multi={q.multi} keys={false} reveal={{ solution: q.solution }} />
          </Panel>
        ))}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  if (p.stage === "play" && elapsed < view.showMs) {
    return (
      <PlayerFrame view={view} p={p}>
        <WatchTv untilMs={view.showMs} elapsed={elapsed} what={`«${view.sceneTitle}»: memorizzate più dettagli che potete.`} />
        {view.alt && <p className="sr-only">{view.alt}</p>}
      </PlayerFrame>
    );
  }

  const q = view.questions[tab];
  const pick = (id: string) => {
    if (!editable) return;
    setAnswers((a) => ({ ...a, [q.id]: toggleId(a[q.id] ?? [], id, q.multi) }));
    if (!q.multi && tab < view.questions.length - 1) window.setTimeout(() => setTab((x) => Math.min(x + 1, view.questions.length - 1)), 180);
  };
  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={done} pending={pending} error={error} onSubmit={submit} label="Invia i 3 dettagli" />}
    >
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Domande">
        {view.questions.map((qq, i) => {
          const answered = (answers[qq.id]?.length ?? 0) > 0;
          return (
            <button
              key={qq.id}
              type="button"
              role="tab"
              aria-selected={i === tab}
              onClick={() => setTab(i)}
              className={clsx("tg-display flex h-12 items-center justify-center gap-2 rounded-xl border-2 text-xl", i === tab ? "border-[#c6ff3d] text-[#c6ff3d]" : "border-white/12 text-white/70", answered && "bg-[#c6ff3d]/10")}
            >
              Dettaglio {i + 1}
              {answered && <span aria-label="risposto">•</span>}
            </button>
          );
        })}
      </div>
      <Panel className="flex flex-col gap-3">
        <p className="text-xl font-extrabold leading-snug">{q.prompt}</p>
        {q.multi && <p className="text-sm font-bold text-[#ffc24a]">Selezione multipla: toccate tutte quelle giuste.</p>}
        <ChoiceList
          key={q.id}
          options={q.options}
          picked={answers[q.id] ?? []}
          onToggle={pick}
          multi={q.multi}
          disabled={!editable}
          onConfirm={() => (tab < view.questions.length - 1 ? setTab(tab + 1) : submit())}
        />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const showing = p.stage === "play" && elapsed < view.showMs && view.scene;

  if (p.stage === "reveal" && reveal) {
    return (
      <TvFrame view={view} p={p} subtitle={`«${reveal.sceneTitle}» · ecco i dettagli`}>
        <div className="grid h-full grid-cols-[1.05fr_1fr] gap-[1.4cqw]">
          <div className="flex min-h-0 flex-col gap-[1.2cqw]">
            <TvPanel className="tg-pop flex min-h-0 flex-1 items-center justify-center p-[0.6cqw]">
              <SceneArt scene={reveal.scene} alt={reveal.alt} className="h-full w-full rounded-[1cqw]" />
            </TvPanel>
            <TvExplain text={reveal.explain} />
          </div>
          <div className="flex min-h-0 flex-col gap-[0.9cqw]">
            {reveal.questions.map((q, qi) => (
              <TvPanel key={q.id} className="tg-rise p-[1.1cqw]" >
                <p className="mb-[0.6cqw] text-[1.45cqw] font-extrabold leading-tight" style={{ animationDelay: `${qi * 120}ms` }}>
                  {q.prompt}
                </p>
                <div className="flex flex-wrap gap-[0.5cqw]">
                  {q.options
                    .filter((o) => q.solution.includes(o.id))
                    .map((o) => (
                      <span key={o.id} className="tg-shine rounded-[0.6cqw] bg-[#c6ff3d] px-[0.8cqw] py-[0.3cqw] text-[1.4cqw] font-extrabold text-[#0b0d12]">
                        {o.text}
                      </span>
                    ))}
                </div>
              </TvPanel>
            ))}
          </div>
        </div>
      </TvFrame>
    );
  }

  if (showing) {
    const left = Math.max(0, Math.ceil((view.showMs - elapsed) / 1000));
    return (
      <TvFrame view={view} p={p} hideTimer subtitle={`«${view.sceneTitle}»: guardate bene, tra poco sparisce.`}>
        <div className="flex h-full items-center justify-center">
          <div className="tg-pop relative h-full max-h-full aspect-video">
            <SceneArt scene={view.scene!} alt={view.alt ?? view.sceneTitle} className="h-full w-full rounded-[1.4cqw] border border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]" />
            <div className="tg-glass tg-glass-lime absolute right-[1.2cqw] top-[1.2cqw] grid h-[6cqw] w-[6cqw] place-items-center rounded-full">
              <span className="tg-num text-[3.6cqw] text-[#c6ff3d]">{left}</span>
            </div>
          </div>
        </div>
      </TvFrame>
    );
  }

  return (
    <TvFrame view={view} p={p} subtitle="La scena è sparita. Tre dettagli: rispondete dal telefono.">
      <div className="grid h-full grid-cols-3 gap-[1.2cqw]">
        {view.questions.map((q, qi) => (
          <TvPanel key={q.id} className="tg-rise flex flex-col gap-[0.7cqw]">
            <p className="text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-[#c6ff3d]">
              Dettaglio {qi + 1}
              {q.multi ? " · più risposte" : ""}
            </p>
            <p className="text-[1.6cqw] font-extrabold leading-tight">{q.prompt}</p>
            <div className="mt-[0.4cqw] flex flex-col gap-[0.45cqw]">
              {q.options.map((o, i) => (
                <TvOption key={o.id} index={i} text={o.text} size="sm" />
              ))}
            </div>
          </TvPanel>
        ))}
      </div>
    </TvFrame>
  );
}

export const memoriaLampoUi = defineUi(Player, Tv);
