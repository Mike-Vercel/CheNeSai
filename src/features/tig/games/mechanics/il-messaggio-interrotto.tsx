"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { ChatLine, MessaggioReveal, MessaggioSubmission, MessaggioView } from "@/lib/tig/games/mechanics/il-messaggio-interrotto";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, MyOutcome, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<MessaggioView, null, MessaggioSubmission, MessaggioReveal>;
type T = TvGameProps<MessaggioView, MessaggioReveal>;

/**
 * Chat INVENTATA disegnata in HTML (nessuna app reale imitata). Il messaggio sparito è un fumetto tratteggiato;
 * con `fill` mostra l'ipotesi della squadra (o, al reveal, il messaggio giusto).
 */
function Chat({ title, subtitle, messages, fill, fillState = "guess", tv = false }: { title: string; subtitle: string; messages: ChatLine[]; fill?: string | null; fillState?: "guess" | "right" | "wrong"; tv?: boolean }) {
  const initials = title
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <figure className={clsx("flex flex-col overflow-hidden border border-white/10 bg-[#0f131b]", tv ? "rounded-[1.4cqw]" : "rounded-3xl")} aria-label={`Chat ${title}`}>
      <figcaption className={clsx("flex items-center border-b border-white/10 bg-[#161b25]", tv ? "gap-[0.8cqw] px-[1.1cqw] py-[0.7cqw]" : "gap-3 px-3 py-2.5")}>
        <span className={clsx("tg-num grid shrink-0 place-items-center rounded-full bg-[#2a3242] text-[#c6ff3d]", tv ? "h-[2.8cqw] w-[2.8cqw] text-[1.3cqw]" : "h-10 w-10 text-lg")} aria-hidden>
          {initials}
        </span>
        <span className="min-w-0">
          <span className={clsx("block truncate font-extrabold", tv ? "text-[1.45cqw]" : "text-base")}>{title}</span>
          <span className={clsx("block truncate font-semibold text-white/55", tv ? "text-[1cqw]" : "text-xs")}>{subtitle}</span>
        </span>
      </figcaption>
      <ol className={clsx("flex flex-col", tv ? "gap-[0.5cqw] p-[0.9cqw]" : "gap-2 p-3")}>
        {messages.map((m) => {
          const gap = m.text === null;
          const shown = gap ? fill : m.text;
          const onLime = gap && shown && fillState === "right";
          return (
            <li
              key={m.id}
              className={clsx(
                "max-w-[88%]",
                m.mine ? "self-end" : "self-start",
                tv ? "rounded-[0.9cqw] px-[0.9cqw] py-[0.45cqw]" : "rounded-2xl px-3 py-2",
                !gap && (m.mine ? "bg-[#2b3a12] text-[#f3ffd6]" : "bg-[#1d2330]"),
                gap && !shown && "border-2 border-dashed border-[#ffc24a]/70 bg-[#ffc24a]/[0.06]",
                gap && shown && fillState === "guess" && "tg-pop border-2 border-dashed border-[#c6ff3d] bg-[#c6ff3d]/10",
                onLime && "tg-pop border-2 border-[#c6ff3d] bg-[#c6ff3d] text-[#0b0d12]",
                gap && shown && fillState === "wrong" && "tg-stripes-red border-2 border-[#ff3b4e]",
              )}
            >
              <span className={clsx("flex items-baseline justify-between", tv ? "gap-[1cqw]" : "gap-3")}>
                <span className={clsx("font-extrabold", onLime ? "text-[#0b0d12]/70" : "text-[#6fe7ff]", tv ? "text-[0.95cqw]" : "text-xs")}>{m.mine ? "" : m.from}</span>
                <span className={clsx("opacity-55", tv ? "text-[0.85cqw]" : "text-[11px]")}>{m.time}</span>
              </span>
              {gap && !shown ? (
                <span className={clsx("flex items-center gap-2 font-extrabold uppercase tracking-wide text-[#ffc24a]", tv ? "text-[1.3cqw]" : "text-sm")}>
                  <Icon name="dots" className={tv ? "h-[1.6cqw] w-[1.6cqw]" : "h-5 w-5"} /> Messaggio sparito
                </span>
              ) : (
                <span className={clsx("block font-semibold leading-snug", tv ? "text-[1.3cqw]" : "text-[15px]")}>{shown}</span>
              )}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send({ optionId: picked });
  const text = (id: string | null) => view.options.find((o) => o.id === id)?.text ?? null;

  if (p.stage === "reveal" && reveal) {
    const right = reveal.options.find((o) => o.id === reveal.solutionId)?.text ?? null;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Chat title={view.chatTitle} subtitle={view.chatSubtitle} messages={reveal.messages} fill={right} fillState="right" />
        <ChoiceList options={view.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="Questo torna" hint={picked ? undefined : `Che cosa ha scritto ${view.gapFrom}?`} />}
    >
      <Chat title={view.chatTitle} subtitle={view.chatSubtitle} messages={view.messages} fill={text(picked)} />
      <ChoiceList label={`Il messaggio di ${view.gapFrom}`} options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const right = done ? (reveal.options.find((o) => o.id === reveal.solutionId)?.text ?? null) : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Ecco il messaggio che fa tornare la chat" : `Manca un messaggio di ${view.gapFrom}: quale fa tornare le risposte?`}>
      <div className="grid h-full grid-cols-[1.05fr_1fr] gap-[1.6cqw]">
        <div className="min-h-0 overflow-hidden">
          <Chat title={view.chatTitle} subtitle={view.chatSubtitle} messages={done ? reveal.messages : view.messages} fill={right} fillState="right" tv />
        </div>
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className="grid grid-cols-1 content-start gap-[0.7cqw]">
            {view.options.map((o, i) => (
              <TvOption key={o.id} index={i} text={o.text} size="sm" state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
            ))}
          </TvPanel>
          {done && <TvExplain text={reveal.explain} className="py-[1cqw]" />}
        </div>
      </div>
    </TvFrame>
  );
}

export const ilMessaggioInterrottoUi = defineUi(Player, Tv);
