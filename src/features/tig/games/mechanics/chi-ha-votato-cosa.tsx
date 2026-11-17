"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { comboKey, type ChiHaVotatoQuestion, type ChiHaVotatoReveal, type ChiHaVotatoSubmission, type ChiHaVotatoSummary, type ChiHaVotatoView } from "@/lib/tig/games/mechanics/chi-ha-votato-cosa";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { BigToggle, ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { Step } from "./_m3-kit";

type P = PlayerGameProps<ChiHaVotatoView, null, ChiHaVotatoSubmission, ChiHaVotatoReveal>;
type T = TvGameProps<ChiHaVotatoView, ChiHaVotatoReveal>;
type Qs = [ChiHaVotatoQuestion, ChiHaVotatoQuestion];

const textOf = (q: ChiHaVotatoQuestion, id: string) => q.options.find((o) => o.id === id)?.text ?? id;

/**
 * Griglia 2×2 delle coppie (righe = risposte della prima domanda, colonne = della seconda).
 * Prima del reveal le caselle sono vuote (TV) o selezionabili (telefono); al reveal mostrano la percentuale.
 */
function ComboGrid({ questions, summary, picked, mine, onPick, tv = false }: { questions: Qs; summary?: ChiHaVotatoSummary | null; picked?: string | null; mine?: string | null; onPick?: (key: string) => void; tv?: boolean }) {
  const [q1, q2] = questions;
  const byKey = new Map((summary?.combos ?? []).map((c) => [c.key, c]));
  const head = clsx("font-extrabold uppercase leading-tight tracking-wide text-white/70", tv ? "p-[0.5cqw] text-[1.15cqw]" : "p-1.5 text-[11px]");
  return (
    <div role={onPick ? "radiogroup" : "table"} aria-label="Le quattro coppie possibili" className={clsx("grid grid-cols-[auto_1fr_1fr]", tv ? "gap-[0.6cqw]" : "gap-1.5")}>
      <span />
      {q2.options.map((o) => (
        <span key={o.id} className={clsx(head, "text-center")}>
          {o.text}
        </span>
      ))}
      {q1.options.map((a) => (
        <div key={a.id} className="contents">
          <span className={clsx(head, "flex items-center", tv ? "max-w-[14cqw]" : "max-w-[6.5rem]")}>{a.text}</span>
          {q2.options.map((b) => {
            const key = comboKey(a.id, b.id);
            const c = byKey.get(key);
            const win = !!summary?.winners.includes(key);
            const on = picked === key;
            const isMine = mine === key;
            const body = (
              <>
                {summary && c ? (
                  <>
                    <span className={clsx("tg-num leading-none", tv ? "text-[3.4cqw]" : "text-3xl", win && "text-[#c6ff3d]")}>{c.pct}%</span>
                    <span className={clsx("font-bold text-white/60", tv ? "text-[1cqw]" : "text-[11px]")}>
                      {c.n} {c.n === 1 ? "tavolo" : "tavoli"}
                    </span>
                    {win && <Icon name="crown" className={clsx("absolute text-[#c6ff3d]", tv ? "right-[0.5cqw] top-[0.5cqw] h-[1.8cqw] w-[1.8cqw]" : "right-1.5 top-1.5 h-4 w-4")} />}
                    {isMine && <span className={clsx("absolute font-extrabold uppercase text-white/80", tv ? "bottom-[0.4cqw] text-[0.8cqw]" : "bottom-1 text-[10px]")}>la vostra</span>}
                  </>
                ) : (
                  <span className={clsx("tg-num text-white/30", tv ? "text-[3cqw]" : "text-2xl")}>{on ? <Icon name="check" className="h-7 w-7 text-[#c6ff3d]" /> : "?"}</span>
                )}
                <span className="sr-only">
                  {a.text} e {b.text}
                  {c ? `: ${c.pct}%` : ""}
                  {win ? ", la più votata" : ""}
                </span>
              </>
            );
            const cls = clsx(
              "relative flex flex-col items-center justify-center border-2 text-center transition-[transform,background-color,border-color] duration-200",
              tv ? "min-h-[7cqw] rounded-[0.9cqw]" : "min-h-[4.5rem] rounded-xl",
              win ? "tg-shine border-[#c6ff3d] bg-[#c6ff3d]/12" : on ? "tg-picked border-[#c6ff3d]" : "border-white/12 bg-white/[0.04]",
            );
            return onPick ? (
              <button key={key} type="button" role="radio" aria-checked={on} onClick={() => onPick(key)} className={clsx(cls, "active:scale-[0.97]")}>
                {body}
              </button>
            ) : (
              <div key={key} className={cls}>
                {body}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [q1, q2] = view.questions;
  const [v1, setV1] = useState<string | null>(null);
  const [v2, setV2] = useState<string | null>(null);
  const [guess, setGuess] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!v1 && !!v2 && !!guess;
  const submit = () => {
    if (!ready || !p.canSubmit) return;
    const [g1, g2] = guess!.split("+");
    send({ vote: [v1!, v2!], guess: [g1, g2] });
  };
  const combos = q1.options.flatMap((a) => q2.options.map((b) => ({ id: comboKey(a.id, b.id), text: `${a.text} + ${b.text}` })));

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {reveal.summary && (
          <Panel className="flex flex-col gap-2">
            <Eyebrow>Il locale · {reveal.summary.tables} tavoli</Eyebrow>
            <ComboGrid questions={view.questions} summary={reveal.summary} mine={reveal.summary.guesses[p.myTeam.teamId] ?? (sent ? guess : null)} />
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
          label="Vota e indovina"
          hint={!v1 || !v2 ? "Prima i due voti del tavolo" : !guess ? "Poi la coppia più votata dal locale" : undefined}
        />
      }
    >
      <Panel>
        <p className="tg-display text-3xl">{view.intro}</p>
      </Panel>
      <Step n={1} title="Il voto anonimo del vostro tavolo" done={!!v1 && !!v2}>
        <p className="text-lg font-extrabold leading-snug">{q1.prompt}</p>
        <BigToggle label={q1.prompt} value={v1} onChange={(v) => editable && setV1(v)} disabled={!editable} options={q1.options.map((o, i) => ({ id: o.id, title: o.text, tone: i === 0 ? "lime" : "ice" }))} />
        <p className="mt-1 text-lg font-extrabold leading-snug">{q2.prompt}</p>
        <BigToggle label={q2.prompt} value={v2} onChange={(v) => editable && setV2(v)} disabled={!editable} options={q2.options.map((o, i) => ({ id: o.id, title: o.text, tone: i === 0 ? "lime" : "ice" }))} />
      </Step>
      <Step n={2} title="Quale coppia vincerà nel locale?" done={!!guess}>
        <ChoiceList options={combos} picked={guess ? [guess] : []} onToggle={(id) => editable && setGuess(id)} disabled={!editable} onConfirm={submit} label="La coppia più votata secondo voi" />
      </Step>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  const [q1, q2] = view.questions;
  const winText = s?.winners.length
    ? s.winners
        .map((k) => {
          const [a, b] = k.split("+");
          return `${textOf(q1, a)} + ${textOf(q2, b)}`;
        })
        .join(" · ")
    : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "La griglia del locale: un voto per tavolo, nessun nome" : "Un voto anonimo per tavolo su due domande. Indovinate la coppia che vince nel locale."}>
      <div className="grid h-full grid-cols-[1fr_1.15fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className="tg-rise">
            <p className="tg-display text-[3.6cqw] text-[#c6ff3d]">{view.intro}</p>
          </TvPanel>
          {[q1, q2].map((q, i) => (
            <TvPanel key={q.id} className="tg-rise flex flex-col gap-[0.6cqw]" tone={undefined}>
              <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-white/60">Domanda {i + 1}</p>
              <p className="text-[2.1cqw] font-extrabold leading-tight">{q.prompt}</p>
              <div className="grid grid-cols-2 gap-[0.8cqw]">
                {q.options.map((o) => {
                  const pq = s?.perQuestion[i];
                  const win = !!pq?.winners.includes(o.id);
                  return (
                    <div key={o.id} className={clsx("flex items-center justify-between gap-[0.6cqw] rounded-[0.8cqw] border-[0.15cqw] px-[1cqw] py-[0.7cqw]", win ? "border-[#c6ff3d] bg-[#c6ff3d]/10" : "border-white/14 bg-white/[0.05]")}>
                      <span className="text-[1.7cqw] font-extrabold leading-tight">{o.text}</span>
                      {pq && <span className={clsx("tg-num text-[2cqw]", win && "text-[#c6ff3d]")}>{pq.percent[o.id] ?? 0}%</span>}
                    </div>
                  );
                })}
              </div>
            </TvPanel>
          ))}
        </div>
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className="flex flex-col gap-[0.8cqw]">
            <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-[#c6ff3d]">{s ? "Le coppie del locale" : "Quale coppia vincerà?"}</p>
            <ComboGrid questions={view.questions} summary={s} tv />
            {winText && <p className="tg-pop text-center text-[1.7cqw] font-extrabold">Vince: {winText}</p>}
          </TvPanel>
          {done && <TvExplain text={reveal.explain} />}
        </div>
      </div>
    </TvFrame>
  );
}

export const chiHaVotatoCosaUi = defineUi(Player, Tv);
