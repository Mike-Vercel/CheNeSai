"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { secondOptions, type TerrenoReveal, type TerrenoSubmission, type TerrenoView } from "@/lib/tig/games/mechanics/scegli-il-terreno";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { CompassRose, Doubloon } from "../kit/ornaments";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { Step, TvAnswers, tvCompact, TvWhy } from "./m2/kit";

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
            <Doubloon className="h-7 w-7 text-base">{LETTER[i]}</Doubloon>
            <span className={clsx("tg-title leading-none", view.terreni[i].name.length > 12 ? "text-[1.55rem]" : "text-[1.9rem]", on ? "text-(--tg-gold-hi)" : "text-(--tg-cream)")}>{view.terreni[i].name}</span>
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
      <Step n={2} title={`2° turno · +${view.perTurno}`} icon="swap" done={second !== null && !!a2} className={clsx(first === null && "opacity-60")}>
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
  const compact = tvCompact(p.teams);
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Categorie con difficoltà e punti uguali: contava scegliere il terreno giusto" : `1° turno: A o B. 2° turno: una delle due rimaste. +${view.perTurno} a risposta giusta`}>
      <div className="flex h-full min-h-0 flex-col gap-[1.2cqw]">
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[1.2cqw]">
          {view.terreni.map((t, i) => (
            <TvPanel key={i} tone={i === 2 ? "lime" : undefined} className={clsx("tg-rise relative flex min-h-0 flex-col", compact ? "gap-[0.45cqw] py-[1.2cqw]" : "gap-[0.6cqw]")}>
              <div className="flex shrink-0 items-center gap-[0.8cqw]">
                <Doubloon className={compact ? "h-[3cqw] w-[3cqw] text-[1.5cqw]" : "h-[3.6cqw] w-[3.6cqw] text-[1.8cqw]"}>{LETTER[i]}</Doubloon>
                <p className={clsx("tg-title min-w-0 flex-1 truncate leading-[1.3] text-(--tg-gold-hi)", compact ? "text-[2.5cqw]" : "text-[3cqw]")}>{t.name}</p>
              </div>
              {!done && <p className="shrink-0 text-[1cqw] font-extrabold uppercase tracking-[0.16em] text-(--tg-cream)/70">{i === 2 ? "Entra al 2° turno" : "1° e 2° turno"}</p>}
              {done ? (
                <>
                  <p className={clsx("font-extrabold leading-tight", compact ? "text-[1.2cqw]" : "text-[1.35cqw]")}>{reveal.terreni[i].prompt}</p>
                  <TvAnswers options={t.options} solutionId={reveal.terreni[i].solutionId} compact={compact} />
                  {picks && (
                    <p className="mt-auto flex shrink-0 flex-wrap items-baseline gap-x-[0.8cqw] text-[1.15cqw] font-extrabold text-(--tg-cream)/80">
                      <span>
                        1° turno <span className="tg-num text-[1.5cqw] text-(--tg-gold-hi)">{picks.first[i]}</span>
                      </span>
                      <span>
                        2° turno <span className="tg-num text-[1.5cqw] text-(--tg-gold-hi)">{picks.second[i]}</span>
                      </span>
                    </p>
                  )}
                </>
              ) : (
                <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-[0.6cqw] overflow-hidden text-center">
                  <CompassRose className="pointer-events-none absolute left-1/2 top-1/2 h-[14cqw] w-[14cqw] -translate-x-1/2 -translate-y-1/2 text-(--tg-brass) opacity-[0.16]" />
                  <Icon name="lock" className="relative h-[2.8cqw] w-[2.8cqw] text-(--tg-gold)" />
                  <p className={clsx("relative max-w-[22cqw] font-bold leading-snug text-(--tg-cream)/80", compact ? "text-[1.2cqw]" : "text-[1.35cqw]")}>La domanda si apre sul telefono di chi sceglie questo terreno</p>
                </div>
              )}
            </TvPanel>
          ))}
        </div>
        {done && <TvWhy text={reveal.explain} compact={compact} />}
      </div>
    </TvFrame>
  );
}

export const scegliIlTerrenoUi = defineUi(Player, Tv);
