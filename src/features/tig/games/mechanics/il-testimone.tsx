"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { TestimoneMemberView, TestimoneReveal, TestimoneSubmission, TestimoneView } from "@/lib/tig/games/mechanics/il-testimone";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, OptionButton, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { FactList } from "./m4/kit";

type P = PlayerGameProps<TestimoneView, TestimoneMemberView, TestimoneSubmission, TestimoneReveal>;
type T = TvGameProps<TestimoneView, TestimoneReveal>;

function Player(p: P) {
  const { view, reveal, memberView: mv } = p;
  const [witness, setWitness] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!witness && !!answer;
  const submit = () => ready && p.canSubmit && send({ witnessId: witness!, optionId: answer! });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {reveal.witnesses.map((w) => (
          <Panel key={w.id} tone={w.reliable ? "lime" : undefined} className={clsx("flex flex-col gap-1.5", !w.reliable && "opacity-85")}>
            <p className="flex items-center justify-between gap-2">
              <span className="tg-display text-xl">{w.source}</span>
              <span className={clsx("tg-display rounded-md px-2 text-base", w.reliable ? "bg-[#c6ff3d] text-[#0b0d12]" : "bg-[#ff3b4e] text-white")}>{w.reliable ? "Vera" : "Falsa"}</span>
            </p>
            <p className="text-base font-semibold leading-snug">«{w.text}»</p>
            <p className={clsx("text-sm font-bold", w.reliable ? "text-[#dfff9a]" : "text-[#ff9aa4]")}>{w.note}</p>
            {sent && witness === w.id && <p className="text-xs font-extrabold uppercase text-white/60">Il testimone che avete scelto</p>}
          </Panel>
        ))}
        <ChoiceList options={view.options} picked={sent && answer ? [answer] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Invia per il tavolo" hint={!witness ? "Di quale testimone vi fidate?" : !answer ? "Qual è la risposta?" : "Vale il primo invio del tavolo: decidete insieme"} />}
    >
      <Panel className="flex flex-col gap-3">
        <div>
          <Eyebrow>{view.caseTitle}</Eyebrow>
          <p className="mt-1 text-lg font-extrabold leading-snug">{view.question}</p>
        </div>
        <FactList facts={view.facts} title="Fatti certi" />
      </Panel>
      <Panel tone="lime" className="flex flex-col gap-2">
        <Eyebrow className="flex items-center gap-2 text-[#c6ff3d]">
          <Icon name="eye" className="h-4 w-4" /> Sul tuo telefono {mv ? `· siete ${mv.phones} telefon${mv.phones === 1 ? "o" : "i"}` : ""}
        </Eyebrow>
        {mv ? (
          mv.mine.map((w) => (
            <div key={w.id} className="rounded-xl bg-white/[0.06] px-3 py-2.5">
              <p className="tg-display text-lg text-[#c6ff3d]">{w.source}</p>
              <p className="text-base font-semibold leading-snug">«{w.text}»</p>
            </div>
          ))
        ) : (
          <p className="text-sm font-bold text-white/70">Testimonianze in arrivo…</p>
        )}
        {mv && mv.mine.length < view.sources.length && <p className="text-sm font-semibold text-white/75">Le altre testimonianze sono sugli altri telefoni del tavolo: leggetevele a vicenda. Una sola è vera.</p>}
      </Panel>
      <Panel className="flex flex-col gap-2">
        <Eyebrow>Di chi vi fidate? · +{view.payoff.testimone}</Eyebrow>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Testimone">
          {view.sources.map((s) => (
            <OptionButton key={s.id} text={s.source} state={witness === s.id ? "picked" : "idle"} disabled={!editable} onClick={() => setWitness(s.id)} />
          ))}
        </div>
      </Panel>
      <Panel className="flex flex-col gap-2">
        <Eyebrow>La risposta · +{view.payoff.risposta}</Eyebrow>
        <ChoiceList label="La risposta" options={view.options} picked={answer ? [answer] : []} onToggle={(id) => editable && setAnswer(id)} disabled={!editable} keys={false} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const rev = done ? new Map(reveal.witnesses.map((w) => [w.id, w])) : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Il testimone affidabile e le due testimonianze che non reggono" : view.question}>
      <div className="grid h-full grid-cols-[1fr_1.2fr] gap-[1.4cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className={clsx("flex shrink-0 flex-col", done ? "gap-[0.5cqw] py-[1.2cqw]" : "gap-[0.8cqw]")}>
            <p className={clsx("tg-display", done ? "text-[1.8cqw]" : "text-[2.2cqw]")}>{view.caseTitle}</p>
            <div className={clsx(done && "[&_li]:text-[1.2cqw]")}>
              <FactList facts={view.facts} tv title="Fatti certi" />
            </div>
          </TvPanel>
          <TvPanel className="grid shrink-0 grid-cols-1 content-start gap-[0.5cqw]">
            {view.options.map((o, i) =>
              // al reveal resta solo la risposta giusta: la spiegazione sta sotto, anche con 12 tavoli in basso
              done && o.id !== reveal.solutionId ? null : <TvOption key={o.id} index={i} text={o.text} size="sm" state={done ? "right" : "idle"} />,
            )}
          </TvPanel>
          {done && <TvExplain text={reveal.explain} className="shrink-0 py-[0.8cqw]" />}
        </div>
        <div className="flex min-h-0 flex-col gap-[0.8cqw]">
          {view.sources.map((s, i) => {
            const r = rev?.get(s.id);
            return (
              <div
                key={s.id}
                className={clsx(
                  "tg-rise flex shrink-0 items-start gap-[1cqw] rounded-[1.1cqw] border-[0.18cqw] px-[1.2cqw]",
                  r ? "py-[0.6cqw]" : "py-[0.9cqw]",
                  !r && "border-dashed border-[#c6ff3d]/50 bg-[repeating-linear-gradient(135deg,rgba(198,255,61,0.05)_0_1cqw,transparent_1cqw_2cqw)]",
                  r?.reliable && "tg-pop border-[#c6ff3d] bg-[#c6ff3d]/12",
                  r && !r.reliable && "border-[#ff3b4e]/70 bg-[#ff3b4e]/10",
                )}
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <Icon name={r ? (r.reliable ? "check" : "x") : "lock"} className={clsx("mt-[0.2cqw] h-[2.4cqw] w-[2.4cqw] shrink-0", r ? (r.reliable ? "text-[#c6ff3d]" : "text-[#ff3b4e]") : "text-[#c6ff3d]/70")} />
                <div className="min-w-0">
                  <p className="flex items-baseline gap-[0.8cqw]">
                    <span className="tg-display text-[1.9cqw] leading-tight">{s.source}</span>
                    {r && <span className={clsx("tg-display rounded-[0.4cqw] px-[0.5cqw] text-[1.3cqw]", r.reliable ? "bg-[#c6ff3d] text-[#0b0d12]" : "bg-[#ff3b4e] text-white")}>{r.reliable ? "Vera" : "Falsa"}</span>}
                  </p>
                  {r ? (
                    <>
                      <p className="text-[1.25cqw] font-semibold leading-snug">«{r.text}»</p>
                      <p className={clsx("mt-[0.2cqw] text-[1.1cqw] font-bold leading-snug", r.reliable ? "text-[#dfff9a]" : "text-[#ff9aa4]")}>{r.note}</p>
                    </>
                  ) : (
                    <p className="text-[1.25cqw] font-bold text-white/65">Testimonianza sigillata: è sul telefono di qualcuno al vostro tavolo.</p>
                  )}
                </div>
              </div>
            );
          })}
          {!done && (
            <p className="text-center text-[1.2cqw] font-bold text-white/70">
              Una sola testimonianza è vera · risposta giusta +{view.payoff.risposta} · testimone giusto +{view.payoff.testimone}
            </p>
          )}
        </div>
      </div>
    </TvFrame>
  );
}

export const ilTestimoneUi = defineUi(Player, Tv);
