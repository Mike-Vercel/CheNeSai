"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { secondOptions, type TerrenoReveal, type TerrenoSubmission, type TerrenoView } from "@/lib/tig/games/mechanics/scegli-il-terreno";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { Step } from "./m2/kit";

type P = PlayerGameProps<TerrenoView, null, TerrenoSubmission, TerrenoReveal>;
type T = TvGameProps<TerrenoView, TerrenoReveal>;

const LETTER = ["A", "B", "C"];

function TerrainPicker({ view, allowed, value, onChange, disabled, locked }: { view: TerrenoView; allowed: number[]; value: number | null; onChange: (i: number) => void; disabled: boolean; locked?: number | null }) {
  const shown = locked === undefined || locked === null ? allowed : [...allowed, locked].sort();
  return (
    <div className={clsx("grid gap-2", shown.length === 3 ? "grid-cols-3" : "grid-cols-2")} role="radiogroup" aria-label="Categoria">
      {shown.map((i) => {
        const isLocked = i === locked;
        const on = value === i;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled || isLocked}
            onClick={() => onChange(i)}
            className={clsx(
              "relative flex min-h-24 flex-col items-start justify-between gap-1 rounded-2xl border-2 p-3 text-left transition-transform active:scale-[0.98]",
              isLocked ? "border-dashed border-(--tg-cream)/15 bg-(--tg-cream)/[0.02] opacity-50" : on ? "tg-picked border-(--tg-gold)" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04]",
            )}
          >
            <span className="tg-num text-lg text-(--tg-cream)/50">{LETTER[i]}</span>
            <span className={clsx("tg-display leading-[0.95]", view.terreni[i].name.length > 12 ? "text-[1.4rem]" : "text-3xl", on && "text-(--tg-gold)")}>{view.terreni[i].name}</span>
            {isLocked && (
              <span className="flex items-center gap-1 text-xs font-extrabold uppercase text-(--tg-cream)/70">
                <Icon name="lock" className="h-4 w-4" /> appena giocata
              </span>
            )}
            {on && <Icon name="check" className="absolute right-2 top-2 h-6 w-6 text-(--tg-gold)" />}
          </button>
        );
      })}
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [first, setFirst] = useState<number | null>(null);
  const [a1, setA1] = useState<string | null>(null);
  const [second, setSecond] = useState<number | null>(null);
  const [a2, setA2] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = first !== null && !!a1 && second !== null && !!a2;
  const submit = () => ready && p.canSubmit && send({ first: first!, firstAnswer: a1!, second: second!, secondAnswer: a2! });
  const pickFirst = (i: number) => {
    if (i === first) return;
    setFirst(i);
    setA1(null);
    if (second === i) {
      setSecond(null);
      setA2(null);
    }
  };
  const pickSecond = (i: number) => {
    if (i === second) return;
    setSecond(i);
    setA2(null);
  };

  if (p.stage === "reveal" && reveal) {
    const picks = reveal.summary?.picks;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {reveal.terreni.map((t, i) => {
          const mine = sent ? (i === first ? a1 : i === second ? a2 : null) : null;
          return (
            <Panel key={i} className={clsx("flex flex-col gap-2", sent && i !== first && i !== second && "opacity-70")}>
              <Eyebrow>
                {LETTER[i]} · {t.name}
                {sent && i === first ? " · vostro 1° turno" : sent && i === second ? " · vostro 2° turno" : ""}
                {picks ? ` · scelta da ${picks.first[i] + picks.second[i]}` : ""}
              </Eyebrow>
              <p className="text-base font-extrabold leading-snug">{t.prompt}</p>
              <ChoiceList options={view.terreni[i].options} picked={mine ? [mine] : []} onToggle={() => {}} keys={false} reveal={{ solution: [t.solutionId] }} />
            </Panel>
          );
        })}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Invia i due turni" hint={first === null ? "1° turno: A o B?" : !a1 ? "Rispondete al 1° turno" : second === null ? "2° turno: una delle due rimaste" : !a2 ? "Rispondete al 2° turno" : undefined} />}
    >
      <Step n={1} title={`1° turno · +${view.perTurno}`} icon="target" done={first !== null && !!a1}>
        <TerrainPicker view={view} allowed={[0, 1]} value={first} onChange={pickFirst} disabled={!editable} />
        {first !== null && (
          <div key={first} className="tg-rise flex flex-col gap-2">
            <p className="text-lg font-extrabold leading-snug">{view.terreni[first].prompt}</p>
            <ChoiceList options={view.terreni[first].options} picked={a1 ? [a1] : []} onToggle={(id) => editable && setA1(id)} disabled={!editable} keys={!a1} label="Risposta del 1° turno" />
          </div>
        )}
      </Step>
      <Step n={2} title={`2° turno · +${view.perTurno} · mai la stessa di fila`} icon="swap" done={second !== null && !!a2} className={clsx(first === null && "opacity-60")}>
        {first === null ? (
          <p className="flex items-center gap-2 text-base font-bold text-(--tg-cream)/60">
            <Icon name="lock" className="h-5 w-5" /> Prima scegliete il 1° turno: quella categoria qui sarà bloccata.
          </p>
        ) : (
          <>
            <TerrainPicker view={view} allowed={secondOptions(first)} value={second} onChange={pickSecond} disabled={!editable} locked={first} />
            {second !== null && (
              <div key={second} className="tg-rise flex flex-col gap-2">
                <p className="text-lg font-extrabold leading-snug">{view.terreni[second].prompt}</p>
                <ChoiceList options={view.terreni[second].options} picked={a2 ? [a2] : []} onToggle={(id) => editable && setA2(id)} disabled={!editable} keys={!!a1 && !a2} onConfirm={submit} label="Risposta del 2° turno" />
              </div>
            )}
          </>
        )}
      </Step>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const picks = done ? reveal.summary?.picks : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Categorie con difficoltà e punti uguali: contava scegliere il terreno giusto" : `1° turno: A o B. 2° turno: una delle due rimaste. +${view.perTurno} a risposta giusta`}>
      <div className="flex h-full min-h-0 flex-col gap-[1.2cqw]">
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[1.2cqw]">
          {view.terreni.map((t, i) => (
            <TvPanel key={i} tone={i === 2 ? "lime" : undefined} className="tg-rise flex min-h-0 flex-col gap-[0.6cqw]" >
              <div className="flex items-baseline justify-between">
                <span className="tg-num text-[3.4cqw] leading-none text-(--tg-cream)/40">{LETTER[i]}</span>
                <span className="text-[1.05cqw] font-extrabold uppercase tracking-[0.16em] text-(--tg-cream)/60">{i === 2 ? "entra al 2° turno" : "1° e 2° turno"}</span>
              </div>
              <p className="tg-display text-[3cqw] leading-none">{t.name}</p>
              {done ? (
                <>
                  <p className="text-[1.35cqw] font-extrabold leading-tight">{reveal.terreni[i].prompt}</p>
                  <div className="flex flex-col gap-[0.35cqw]">
                    {t.options.map((o, j) => (
                      <TvOption key={o.id} size="sm" index={j} text={o.text} state={o.id === reveal.terreni[i].solutionId ? "right" : "dim"} />
                    ))}
                  </div>
                  {picks && (
                    <p className="mt-auto text-[1.2cqw] font-extrabold text-(--tg-cream)/75">
                      Scelta al 1° turno: <span className="tg-num text-(--tg-gold)">{picks.first[i]}</span> · al 2°: <span className="tg-num text-(--tg-gold)">{picks.second[i]}</span>
                    </p>
                  )}
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-[0.6cqw] text-center">
                  <Icon name="lock" className="h-[3cqw] w-[3cqw] text-(--tg-cream)/35" />
                  <p className="text-[1.3cqw] font-bold text-(--tg-cream)/60">La domanda si apre sul telefono di chi sceglie questo terreno</p>
                </div>
              )}
            </TvPanel>
          ))}
        </div>
        {done && <TvExplain text={reveal.explain} />}
      </div>
    </TvFrame>
  );
}

export const scegliIlTerrenoUi = defineUi(Player, Tv);
