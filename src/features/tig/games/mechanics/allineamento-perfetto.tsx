"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { Option } from "@/lib/tig/games/components/choice";
import type { AllineamentoReveal, AllineamentoSubmission, AllineamentoSummary, AllineamentoView } from "@/lib/tig/games/mechanics/allineamento-perfetto";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { CompassRose } from "../kit/ornaments";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { nTavoli, PromptCard, TvExplainCompact } from "./_m3-kit";

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
        // il numerino serve solo se la risposta non è già il suo numero (es. «1»…«9»)
        const showIndex = o.text !== String(i + 1);
        const body = (
          <>
            {/* «livello» dei tavoli: oro scuro e caldo (l'oro trasparente sul blu sembrerebbe verde oliva) */}
            {pct !== undefined && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-(--tg-gold-deep)/90 to-(--tg-gold-dark)/80 transition-[height] duration-1000" style={{ height: `${pct}%` }} aria-hidden />}
            {showIndex && <span className={clsx("tg-num absolute rounded bg-(--tg-cream)/10 text-(--tg-cream)/60", tv ? "left-[0.5cqw] top-[0.5cqw] px-[0.4cqw] text-[1.1cqw]" : "left-1.5 top-1.5 px-1 text-xs")}>{i + 1}</span>}
            {win && <Icon name="crown" className={clsx("absolute text-(--tg-gold-hi)", tv ? "right-[0.5cqw] top-[0.5cqw] h-[2cqw] w-[2cqw]" : "right-1.5 top-1.5 h-4 w-4")} />}
            <span className={clsx("relative font-extrabold leading-tight", short ? (tv ? (summary ? "tg-num text-[3.2cqw]" : "tg-num text-[4cqw]") : "tg-num text-4xl") : tv ? (summary ? "text-[1.6cqw]" : "text-[1.8cqw]") : "text-base", win && "text-(--tg-gold-hi)")}>{o.text}</span>
            {pct !== undefined && (
              <span className="relative flex flex-col items-center">
                <span className={clsx("tg-num leading-none", tv ? "text-[2.1cqw]" : "text-xl", win && "text-(--tg-gold-hi)")}>{pct}%</span>
                <span className={clsx("whitespace-nowrap font-bold text-(--tg-cream)/70", tv ? "text-[0.95cqw]" : "text-[11px]")}>
                  {n} {n === 1 ? "tavolo" : "tavoli"}
                </span>
              </span>
            )}
            {on && summary && <span className={clsx("relative rounded-full border border-(--tg-teal)/70 px-1.5 font-extrabold uppercase leading-tight text-(--tg-teal-hi)", tv ? "text-[0.85cqw]" : "text-[10px]")}>la vostra</span>}
            <span className="sr-only">{on ? " · scelta" : ""}</span>
          </>
        );
        const cls = clsx(
          "relative flex flex-col items-center justify-center gap-1 overflow-hidden border-2 text-center transition-[transform,border-color] duration-200",
          // le risposte lunghe lasciano libero il margine del numerino (in alto a sinistra) e della corona (a destra)
          tv ? (short ? (summary ? "min-h-[7.6cqw] rounded-[1cqw] p-[0.6cqw]" : "min-h-[8.4cqw] rounded-[1cqw] p-[0.8cqw]") : summary ? "min-h-[6.4cqw] rounded-[1cqw] px-[2.6cqw] py-[0.8cqw]" : "min-h-[7cqw] rounded-[1cqw] px-[2.6cqw] py-[1cqw]") : short ? "min-h-20 rounded-2xl p-2" : "min-h-[4.5rem] rounded-2xl px-6 py-3",
          win ? "border-(--tg-gold-hi)" : on ? "tg-picked border-(--tg-gold)" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04]",
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
            <Eyebrow>Dove è andato il locale · {nTavoli(reveal.summary.tables)}</Eyebrow>
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
  const topText = top || "Nessuno";
  // un numero («7») va grande accanto all'etichetta; una risposta lunga («La piazza principale») va sotto, più piccola
  const long = topText.length > 4;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Ecco dove si è allineato il locale" : "Nessuna risposta giusta. Scegliete quello che sceglieranno gli altri tavoli."}>
      <div className={clsx("mx-auto flex h-full max-w-[90cqw] flex-col gap-[1cqw]", !done && "justify-center")}>
        {/* la domanda su pergamena, con la rosa dei venti: «dove si incontra il locale?» */}
        <div className={clsx("tg-parch tg-rise flex items-center gap-[1.2cqw]", s ? "px-[1.6cqw] py-[0.7cqw]" : "px-[2cqw] py-[1.2cqw]")}>
          <CompassRose className={clsx("shrink-0 text-(--tg-burnt)", s ? "h-[3.4cqw] w-[3.4cqw]" : "h-[5cqw] w-[5cqw]")} />
          <p className={clsx("font-extrabold leading-tight text-(--tg-ink)", s ? "text-[2cqw]" : "text-[2.6cqw]")}>{view.prompt}</p>
        </div>
        <TvPanel className="!py-[1.2cqw]">
          <Tiles options={view.options} summary={s} tv />
        </TvPanel>
        {done && (
          // alto quanto il «perché» (niente riquadro mezzo vuoto); lo spazio che avanza resta sotto
          <div className="grid grid-cols-[1fr_2fr] gap-[1.2cqw]">
            <TvPanel tone="lime" className={clsx("tg-pop flex items-center justify-center !py-[0.8cqw]", long ? "flex-col gap-[0.4cqw] text-center" : "gap-[1.4cqw]")}>
              <p className="text-[1.1cqw] font-extrabold uppercase leading-tight tracking-[0.2em] text-(--tg-gold-hi)">
                Il punto
                {long ? " " : <br />}
                d&apos;incontro
              </p>
              <p className={clsx("text-(--tg-gold-hi)", !long ? "tg-num text-[4.8cqw] leading-none" : topText.length <= 12 ? "tg-num text-[2.8cqw] leading-none" : "text-[1.9cqw] font-extrabold leading-tight")}>{topText}</p>
            </TvPanel>
            <TvExplainCompact text={reveal.explain} title="Perché" />
          </div>
        )}
      </div>
    </TvFrame>
  );
}

export const allineamentoPerfettoUi = defineUi(Player, Tv);
