"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PreferitoReveal, PreferitoScenario, PreferitoSubmission, PreferitoSummary, PreferitoView } from "@/lib/tig/games/mechanics/indovina-il-preferito";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { IconBadge } from "../kit/scene";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { PromptCard, Step } from "./_m3-kit";

type P = PlayerGameProps<PreferitoView, null, PreferitoSubmission, PreferitoReveal>;
type T = TvGameProps<PreferitoView, PreferitoReveal>;

/** Scheda illustrata di uno scenario (telefono: selezionabile; TV: grande, con esito al reveal). */
function ScenarioCard({ s, index, on, onPick, disabled, summary, tv = false }: { s: PreferitoScenario; index: number; on?: boolean; onPick?: () => void; disabled?: boolean; summary?: PreferitoSummary | null; tv?: boolean }) {
  const win = !!summary?.winners.includes(s.id);
  const last = !!summary?.losers.includes(s.id) && !win;
  const pct = summary?.percent[s.id];
  const body = (
    <>
      <span className={clsx("tg-num absolute rounded bg-(--tg-cream)/10 text-(--tg-cream)/70", tv ? "left-[0.7cqw] top-[0.7cqw] px-[0.5cqw] text-[1.3cqw]" : "left-2 top-2 px-1.5 text-sm")}>{index + 1}</span>
      {win && <Icon name="crown" className={clsx("absolute text-(--tg-gold)", tv ? "right-[0.7cqw] top-[0.7cqw] h-[2.4cqw] w-[2.4cqw]" : "right-2 top-2 h-5 w-5")} />}
      <IconBadge kind={s.icon} tone={s.tone} className={clsx("shrink-0", tv ? (summary ? "h-[5.5cqw] w-[5.5cqw]" : "h-[8cqw] w-[8cqw]") : "h-14 w-14")} />
      <span className={clsx("font-extrabold leading-tight", tv ? "text-[1.7cqw]" : "text-sm")}>{s.text}</span>
      {pct !== undefined && (
        <span className={clsx("tg-num leading-none", tv ? "text-[3.4cqw]" : "text-3xl", win ? "text-(--tg-gold)" : last ? "text-(--tg-red-hi)" : "text-(--tg-cream)")}>
          {pct}%<span className={clsx("ml-1 font-sans font-bold text-(--tg-cream)/55", tv ? "text-[1.1cqw]" : "text-xs")}>{summary?.counts[s.id] ?? 0} tav.</span>
        </span>
      )}
      {(win || last) && (
        <span className={clsx("tg-display rounded px-2", tv ? "text-[1.6cqw]" : "text-base", win ? "bg-(--tg-gold) text-(--tg-ink)" : "bg-(--tg-red)/80 text-(--tg-cream)")}>{win ? "Il preferito" : "Lo snobbato"}</span>
      )}
      {on && <Icon name="check" className="absolute bottom-2 right-2 h-6 w-6 text-(--tg-gold)" />}
      <span className="sr-only">{on ? " · scelto" : ""}</span>
    </>
  );
  const cls = clsx(
    "relative flex flex-col items-center justify-start border-2 text-center transition-[transform,border-color] duration-200",
    tv ? "gap-[0.6cqw] rounded-[1.2cqw] px-[1cqw] pb-[1cqw] pt-[2.4cqw]" : "min-h-[9.5rem] gap-2 rounded-2xl px-2 pb-3 pt-6",
    win ? "tg-shine border-(--tg-gold) bg-(--tg-gold)/10" : last ? "border-(--tg-red-hi)/70" : on ? "tg-picked border-(--tg-gold)" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04]",
  );
  return onPick ? (
    <button type="button" role="radio" aria-checked={!!on} disabled={disabled} onClick={onPick} className={clsx(cls, "active:scale-[0.97]")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Previsione compatta: per ogni scenario «preferito» o «snobbato» (mai lo stesso). */
function PredictTable({ scenarios, favorite, last, onFavorite, onLast, disabled }: { scenarios: PreferitoScenario[]; favorite: string | null; last: string | null; onFavorite: (id: string) => void; onLast: (id: string) => void; disabled: boolean }) {
  const btn = (on: boolean, tone: "lime" | "red") =>
    clsx("tg-display flex h-11 w-[3.6rem] items-center justify-center rounded-xl border-2 text-lg leading-none transition-transform active:scale-95", on ? (tone === "lime" ? "border-(--tg-gold) bg-(--tg-gold) text-(--tg-ink)" : "border-(--tg-red-hi) bg-(--tg-red) text-white") : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04] text-(--tg-cream)/75");
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 gap-y-2">
      <span />
      <span />
      <span className="flex w-[3.6rem] flex-col items-center text-[10px] font-extrabold uppercase leading-tight text-(--tg-gold)">
        <Icon name="crown" className="h-4 w-4" />
        Preferito
      </span>
      <span className="flex w-[3.6rem] flex-col items-center text-[10px] font-extrabold uppercase leading-tight text-(--tg-red-hi)">
        <Icon name="down" className="h-4 w-4" />
        Ultimo
      </span>
      {scenarios.map((s, i) => (
        <div key={s.id} className="contents">
          <IconBadge kind={s.icon} tone={s.tone} className="h-10 w-10 shrink-0" />
          <span className="min-w-0 text-sm font-bold leading-tight">
            <span className="tg-num mr-1 text-(--tg-cream)/50">{i + 1}</span>
            {s.text}
          </span>
          <button type="button" aria-pressed={favorite === s.id} disabled={disabled} onClick={() => onFavorite(s.id)} className={btn(favorite === s.id, "lime")} aria-label={`Preferito del pubblico: ${s.text}`}>
            +70
          </button>
          <button type="button" aria-pressed={last === s.id} disabled={disabled} onClick={() => onLast(s.id)} className={btn(last === s.id, "red")} aria-label={`Meno votato dal pubblico: ${s.text}`}>
            +30
          </button>
        </div>
      ))}
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [vote, setVote] = useState<string | null>(null);
  const [favorite, setFavorite] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const { send, pending, error } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!vote && !!favorite && !!last;
  const submit = () => ready && p.canSubmit && send({ vote: vote!, favorite: favorite!, last: last! });
  const pickFavorite = (id: string) => {
    if (!editable) return;
    setFavorite(id);
    if (last === id) setLast(null);
  };
  const pickLast = (id: string) => {
    if (!editable) return;
    setLast(id);
    if (favorite === id) setFavorite(null);
  };
  useAnswerKeys({
    enabled: editable,
    count: view.scenarios.length,
    onPick: (i) => {
      const id = view.scenarios[i].id;
      if (!vote) setVote(id);
      else if (!favorite) pickFavorite(id);
      else pickLast(id);
    },
    onConfirm: ready ? submit : null,
  });

  if (p.stage === "reveal" && reveal) {
    const g = reveal.summary?.guesses[p.myTeam.teamId];
    const textOf = (id: string) => view.scenarios.find((s) => s.id === id)?.text ?? id;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {reveal.summary && (
          <Panel className="flex flex-col gap-2">
            <Eyebrow>Il pubblico · {reveal.summary.tables} tavoli</Eyebrow>
            <div className="grid grid-cols-2 gap-2">
              {view.scenarios.map((s, i) => (
                <ScenarioCard key={s.id} s={s} index={i} summary={reveal.summary} />
              ))}
            </div>
            {g && (
              <p className="text-sm font-bold text-(--tg-cream)/80">
                Avevate previsto: preferito «{textOf(g.favorite)}», snobbato «{textOf(g.last)}».
              </p>
            )}
          </Panel>
        )}
        <Explain text={reveal.explain} title="Il pubblico" />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Vota e prevedi" hint={!vote ? "Prima il vostro preferito" : !favorite ? "Poi il preferito del pubblico" : !last ? "E il meno votato" : undefined} />}
    >
      <PromptCard>{view.prompt}</PromptCard>
      <Step n={1} title="Il preferito del vostro tavolo" done={!!vote}>
        <div role="radiogroup" aria-label="Il preferito del vostro tavolo" className="grid grid-cols-2 gap-2">
          {view.scenarios.map((s, i) => (
            <ScenarioCard key={s.id} s={s} index={i} on={vote === s.id} disabled={!editable} onPick={() => editable && setVote(s.id)} />
          ))}
        </div>
      </Step>
      <Step n={2} title="E il pubblico? Preferito (+70) e meno votato (+30)" done={!!favorite && !!last}>
        <PredictTable scenarios={view.scenarios} favorite={favorite} last={last} onFavorite={pickFavorite} onLast={pickLast} disabled={!editable} />
      </Step>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Il preferito e lo snobbato del pubblico" : "Un voto per tavolo, poi la previsione: il preferito del pubblico vale 70, il meno votato 30."}>
      <div className="mx-auto flex h-full max-w-[90cqw] flex-col gap-[1.2cqw]">
        <TvPanel className="tg-rise">
          <p className="text-center text-[2.7cqw] font-extrabold leading-tight">{view.prompt}</p>
        </TvPanel>
        <div className="grid grid-cols-4 gap-[1.2cqw]">
          {view.scenarios.map((x, i) => (
            <ScenarioCard key={x.id} s={x} index={i} summary={s} tv />
          ))}
        </div>
        {done && <TvExplain text={reveal.explain} />}
      </div>
    </TvFrame>
  );
}

export const indovinaIlPreferitoUi = defineUi(Player, Tv);
