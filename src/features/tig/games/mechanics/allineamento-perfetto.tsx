"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { Option } from "@/lib/tig/games/components/choice";
import type { AllineamentoReveal, AllineamentoSubmission, AllineamentoSummary, AllineamentoView } from "@/lib/tig/games/mechanics/allineamento-perfetto";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { PromptCard, TvExplainCompact } from "./_m3-kit";

type P = PlayerGameProps<AllineamentoView, null, AllineamentoSubmission, AllineamentoReveal>;
type T = TvGameProps<AllineamentoView, AllineamentoReveal>;

/** Tessere delle risposte: al reveal il fondo si accende in proporzione ai tavoli (con percentuale scritta). */
function Tiles({ options, picked, onPick, disabled, summary, mine, tv = false }: { options: Option[]; picked?: string | null; onPick?: (id: string) => void; disabled?: boolean; summary?: AllineamentoSummary | null; mine?: string | null; tv?: boolean }) {
  const short = options.every((o) => o.text.length <= 4);
  const cols = short ? (options.length > 6 ? (tv ? "grid-cols-9" : "grid-cols-3") : "grid-cols-3") : tv ? (options.length > 6 ? "grid-cols-4" : "grid-cols-3") : "grid-cols-2";
  return (
    <div role={onPick ? "radiogroup" : "list"} aria-label="Le risposte" className={clsx("grid", cols, tv ? "gap-[0.9cqw]" : "gap-2")}>
      {options.map((o, i) => {
        const pct = summary?.percent[o.id];
        const n = summary?.counts[o.id] ?? 0;
        const win = !!summary?.winners.includes(o.id);
        const on = picked === o.id || mine === o.id;
        const body = (
          <>
            {pct !== undefined && <span className="absolute inset-x-0 bottom-0 bg-[#c6ff3d]/25 transition-[height] duration-1000" style={{ height: `${pct}%` }} aria-hidden />}
            <span className={clsx("tg-num absolute rounded bg-white/10 text-white/60", tv ? "left-[0.5cqw] top-[0.5cqw] px-[0.4cqw] text-[1.1cqw]" : "left-1.5 top-1.5 px-1 text-xs")}>{i + 1}</span>
            {win && <Icon name="crown" className={clsx("absolute text-[#c6ff3d]", tv ? "right-[0.5cqw] top-[0.5cqw] h-[2cqw] w-[2cqw]" : "right-1.5 top-1.5 h-4 w-4")} />}
            <span className={clsx("relative font-extrabold leading-tight", short ? (tv ? "tg-num text-[4cqw]" : "tg-num text-4xl") : tv ? "text-[1.9cqw]" : "text-base")}>{o.text}</span>
            {pct !== undefined && (
              <span className={clsx("relative tg-num leading-none", tv ? "text-[2.2cqw]" : "text-xl", win && "text-[#c6ff3d]")}>
                {pct}% <span className={clsx("font-sans font-bold text-white/55", tv ? "text-[1cqw]" : "text-[11px]")}>{n} tav.</span>
              </span>
            )}
            {on && <span className={clsx("relative font-extrabold uppercase text-[#c6ff3d]", tv ? "text-[0.9cqw]" : "text-[10px]")}>{summary ? "la vostra" : ""}</span>}
            <span className="sr-only">{on ? " · scelta" : ""}</span>
          </>
        );
        const cls = clsx(
          "relative flex flex-col items-center justify-center gap-1 overflow-hidden border-2 text-center transition-[transform,border-color] duration-200",
          tv ? (short ? "min-h-[9cqw] rounded-[1cqw] p-[0.8cqw]" : "min-h-[7.5cqw] rounded-[1cqw] p-[1cqw]") : short ? "min-h-20 rounded-2xl p-2" : "min-h-[4.5rem] rounded-2xl px-2 py-3",
          win ? "border-[#c6ff3d]" : on ? "tg-picked border-[#c6ff3d]" : "border-white/12 bg-white/[0.04]",
        );
        return onPick ? (
          <button key={o.id} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onPick(o.id)} className={clsx(cls, "active:scale-[0.97]")}>
            {body}
          </button>
        ) : (
          <div key={o.id} role="listitem" className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send({ optionId: picked });
  useAnswerKeys({ enabled: editable, count: Math.min(9, view.options.length), onPick: (i) => setPicked(view.options[i].id), onConfirm: picked ? submit : null });

  if (p.stage === "reveal" && reveal) {
    const mine = reveal.summary?.picks[p.myTeam.teamId] ?? (sent ? picked : null);
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {reveal.summary && (
          <Panel className="flex flex-col gap-2">
            <Eyebrow>Dove è andato il locale · {reveal.summary.tables} tavoli</Eyebrow>
            <Tiles options={view.options} summary={reveal.summary} mine={mine} />
          </Panel>
        )}
        <Explain text={reveal.explain} title="Il punto d'incontro" />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="Ci allineiamo qui" hint="Pensate a cosa sceglieranno gli altri tavoli, non a cosa vi piace" />}
    >
      <PromptCard icon="target">{view.prompt}</PromptCard>
      <Tiles options={view.options} picked={picked} onPick={(id) => editable && setPicked(id)} disabled={!editable} />
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  const top = s?.winners.map((id) => view.options.find((o) => o.id === id)?.text).join(" · ");
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Ecco dove si è allineato il locale" : "Nessuna risposta giusta. Scegliete quello che sceglieranno gli altri tavoli."}>
      <div className="mx-auto flex h-full max-w-[90cqw] flex-col gap-[1.2cqw]">
        <TvPanel className="tg-rise flex items-center gap-[1.2cqw]">
          <Icon name="target" className="h-[4cqw] w-[4cqw] shrink-0 text-[#c6ff3d]" />
          <p className="text-[2.6cqw] font-extrabold leading-tight">{view.prompt}</p>
        </TvPanel>
        <TvPanel>
          <Tiles options={view.options} summary={s} tv />
        </TvPanel>
        {done && (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.6fr] gap-[1.2cqw]">
            <TvPanel tone="lime" className="tg-pop flex flex-col justify-center gap-[0.4cqw] text-center">
              <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-white/70">Il punto d&apos;incontro</p>
              <p className="tg-display text-[3cqw] leading-none text-[#c6ff3d]">{top || "Nessuno"}</p>
            </TvPanel>
            <TvExplainCompact text={reveal.explain} title="Il punto d'incontro" />
          </div>
        )}
      </div>
    </TvFrame>
  );
}

export const allineamentoPerfettoUi = defineUi(Player, Tv);
