"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { SogliaReveal, SogliaSubmission, SogliaView } from "@/lib/tig/games/mechanics/soglia-di-rischio";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<SogliaView, null, SogliaSubmission, SogliaReveal>;
type T = TvGameProps<SogliaView, SogliaReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const [declared, setDeclared] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const done = view.questions.every((q) => answers[q.id]);
  const ready = declared !== null && done;
  const submit = () => ready && p.canSubmit && send({ declared: declared!, answers });
  const firstOpen = view.questions.findIndex((q) => !answers[q.id]);

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {reveal.questions.map((q, i) => (
          <Panel key={q.id} className="flex flex-col gap-2">
            <p className="text-base font-extrabold leading-snug">
              {i + 1}. {q.prompt}
            </p>
            <ChoiceList options={q.options} picked={sent && answers[q.id] ? [answers[q.id]] : []} onToggle={() => {}} keys={false} reveal={{ solution: [q.solutionId] }} />
          </Panel>
        ))}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label={declared !== null ? `Soglia ${declared}: invia` : "Invia"} hint={declared === null ? "Dichiarate la soglia" : !done ? "Rispondete alle tre domande" : undefined} />}
    >
      <Panel tone="lime" className="flex flex-col gap-3">
        <Eyebrow className="text-[#c6ff3d]">Quante ne azzeccate? · {view.theme}</Eyebrow>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Soglia dichiarata">
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={declared === n}
              disabled={!editable}
              onClick={() => setDeclared(n)}
              className={clsx("flex h-20 flex-col items-center justify-center rounded-xl border-2", declared === n ? "tg-picked border-[#c6ff3d]" : "border-white/12 bg-white/[0.04]")}
            >
              <span className="tg-num text-4xl leading-none">{n}</span>
              <span className="text-[11px] font-extrabold text-white/70">{n === 0 ? "nessun bonus" : `bonus +${view.bonus[n]}`}</span>
            </button>
          ))}
        </div>
        <p className="text-xs font-semibold text-white/65">Ogni risposta giusta +{view.perCorrect}. Il bonus arriva solo se raggiungete la soglia; mancarla non toglie punti.</p>
      </Panel>
      {view.questions.map((q, i) => (
        <Panel key={q.id} className="flex flex-col gap-2">
          <p className="text-base font-extrabold leading-snug">
            {i + 1}. {q.prompt}
          </p>
          <ChoiceList options={q.options} picked={answers[q.id] ? [answers[q.id]] : []} onToggle={(id) => editable && setAnswers((a) => ({ ...a, [q.id]: id }))} disabled={!editable} keys={i === firstOpen} />
        </Panel>
      ))}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  return (
    <TvFrame view={view} p={p} subtitle={`${view.theme} · dichiarate la soglia, poi tre risposte`}>
      <div className="flex h-full flex-col gap-[1.2cqw]">
        <div className="grid grid-cols-4 gap-[1cqw]">
          {[0, 1, 2, 3].map((n) => (
            <TvPanel key={n} className="flex items-center justify-center gap-[1cqw] py-[0.8cqw]">
              <span className="tg-num text-[3.4cqw]">{n}</span>
              <span className="text-[1.3cqw] font-extrabold text-white/75">{n === 0 ? "nessun bonus" : <span className="text-[#c6ff3d]">bonus +{view.bonus[n]}</span>}</span>
            </TvPanel>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[1.2cqw]">
          {(done ? reveal.questions : view.questions).map((q, i) => (
            <TvPanel key={q.id} className="tg-rise flex min-h-0 flex-col gap-[0.7cqw]">
              <p className="text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-[#c6ff3d]">Domanda {i + 1}</p>
              <p className="text-[1.65cqw] font-extrabold leading-tight">{q.prompt}</p>
              {q.options.map((o, j) => (
                <TvOption key={o.id} index={j} text={<span className="text-[1.4cqw]">{o.text}</span>} state={done ? (o.id === (q as SogliaReveal["questions"][number]).solutionId ? "right" : "dim") : "idle"} />
              ))}
            </TvPanel>
          ))}
        </div>
        {done && <TvExplain text={reveal.explain} />}
      </div>
    </TvFrame>
  );
}

export const sogliaDiRischioUi = defineUi(Player, Tv);
