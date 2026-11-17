"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { CarteReveal, CarteSubmission, CarteView, Slot } from "@/lib/tig/games/mechanics/tre-carte-un-destino";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";
import { secsTo, teamMap, TvTableBadge } from "./m5-kit";

type P = PlayerGameProps<CarteView, null, CarteSubmission, CarteReveal>;
type T = TvGameProps<CarteView, CarteReveal>;

const SLOTS: Slot[] = ["A", "B", "C"];

/** Dorso di una carta (lettera grande e trama a righe). */
function CardBack({ slot, picked, tv = false, onClick, disabled }: { slot: Slot; picked?: boolean; tv?: boolean; onClick?: () => void; disabled?: boolean }) {
  const cls = clsx(
    "relative grid place-items-center overflow-hidden border-2 transition-transform duration-200",
    tv ? "aspect-[3/4] h-full max-h-full rounded-[1.4cqw]" : "aspect-[3/4] w-full rounded-2xl active:scale-[0.97]",
    picked ? "tg-picked border-(--tg-gold) shadow-[0_0_40px_-8px_color-mix(in_srgb,var(--tg-gold)_70%,transparent)]" : "border-(--tg-cream)/20 bg-(--tg-night-2)",
  );
  const inner = (
    <>
      <span className="absolute inset-[6%] rounded-[inherit] border border-(--tg-cream)/10 bg-[repeating-linear-gradient(45deg,color-mix(in_srgb,var(--tg-red)_12%,transparent)_0_8px,transparent_8px_16px)]" aria-hidden />
      <span className={clsx("tg-display relative", tv ? "text-[9cqw]" : "text-7xl", picked ? "text-(--tg-gold)" : "text-(--tg-cream)")}>{slot}</span>
      {picked && <Icon name="check" className={clsx("absolute", tv ? "bottom-[1cqw] right-[1cqw] h-[3cqw] w-[3cqw]" : "bottom-2 right-2 h-7 w-7")} />}
    </>
  );
  if (!onClick) return <div className={cls}>{inner}</div>;
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={!!picked} aria-label={`Carta ${slot}`} className={cls}>
      {inner}
    </button>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const flipped = !!view.faces && (p.stage !== "play" || elapsed >= view.flipAtMs);
  const face = flipped && slot ? view.faces!.find((f) => f.slot === slot) : null;
  const ready = !!slot && !!picked && !!face;
  const submit = () => ready && p.canSubmit && send({ slot: slot!, optionId: picked! });
  const choose = (s: Slot) => {
    // prima della girata si può cambiare idea; dopo, la carta scelta resta quella
    if (!editable || (flipped && slot)) return;
    setSlot(s);
  };

  if (p.stage === "reveal" && reveal) {
    const deal = reveal.summary?.deal;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {SLOTS.map((s) => {
          const card = reveal.cards.find((c) => c.id === deal?.[s]);
          if (!card) return null;
          const mine = sent && slot === s;
          return (
            <Panel key={s} tone={mine ? "lime" : undefined} className="flex flex-col gap-2">
              <Eyebrow>
                Carta {s} · {card.kind} · vale {card.reward}
                {mine ? " · la vostra" : ""}
              </Eyebrow>
              <p className="text-base font-extrabold leading-snug">{card.prompt}</p>
              <ChoiceList options={card.options} picked={mine && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [card.solutionId] }} />
            </Panel>
          );
        })}
        {reveal.summary && (
          <p className="px-1 text-xs font-semibold text-(--tg-cream)/60">
            Sorteggio verificabile: impronta {reveal.summary.deckPrint} = FNV-1a di «{reveal.summary.draw}».
          </p>
        )}
        <Explain text={reveal.explain} />
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
          label={face ? `Gioca la carta ${slot} (${face.reward})` : "Invia"}
          hint={!slot ? "Scegliete una carta coperta" : !flipped ? `Le carte si girano tra ${secsTo(view.flipAtMs, elapsed)} s: potete ancora cambiare` : !picked ? "Rispondete alla sfida della vostra carta" : undefined}
        />
      }
    >
      <Panel className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-2">
          <Eyebrow className="text-(--tg-teal-hi)">{flipped ? (slot ? `La vostra carta: ${slot}` : "Scegliete la carta") : `${view.heading} · scegliete a scatola chiusa`}</Eyebrow>
          <span className="tg-num shrink-0 text-xs text-(--tg-cream)/55">Mazzo {view.deckPrint}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {SLOTS.map((s) => (
            <CardBack key={s} slot={s} picked={slot === s} onClick={() => choose(s)} disabled={!editable || (flipped && !!slot && slot !== s)} />
          ))}
        </div>
      </Panel>
      {face && (
        <Panel tone="lime" className="tg-pop flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>
              Carta {face.slot} · {face.kind}
            </Eyebrow>
            <span className="tg-num text-3xl text-(--tg-gold)">{face.reward}</span>
          </div>
          <p className="text-xl font-extrabold leading-snug">{face.prompt}</p>
          <ChoiceList options={face.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
        </Panel>
      )}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const done = p.stage === "reveal" && reveal;
  const flipped = !!view.faces && (p.stage !== "play" || elapsed >= view.flipAtMs);
  const map = teamMap(p.teams);

  if (!flipped || !view.faces) {
    return (
      <TvFrame view={view} p={p} subtitle={`${view.heading} · impronta del mazzo ${view.deckPrint}: il seme si svela alla fine`}>
        <div className="flex h-full flex-col items-center justify-center gap-[1.4cqw]">
          <div className="flex h-[70%] items-center justify-center gap-[2.4cqw]">
            {SLOTS.map((s) => (
              <CardBack key={s} slot={s} tv />
            ))}
          </div>
          <p className="tg-display text-[3cqw]">
            Si girano tra <span className="tg-num text-(--tg-gold)">{secsTo(view.flipAtMs, elapsed)}</span>
          </p>
        </div>
      </TvFrame>
    );
  }

  const deal = done ? reveal.summary?.deal : null;
  return (
    <TvFrame view={view} p={p} subtitle={done && reveal.summary ? `Sorteggio verificabile: impronta ${reveal.summary.deckPrint}, seme «${reveal.summary.draw}»` : `${view.heading} · ognuno gioca la sfida della sua carta`}>
      <div className={clsx("grid h-full gap-[1.1cqw]", done ? "grid-rows-[minmax(0,1fr)_auto]" : "")}>
        <div className="grid min-h-0 grid-cols-3 gap-[1.1cqw]">
          {view.faces.map((f, i) => {
            const card = done ? reveal.cards.find((c) => c.id === deal?.[f.slot]) : null;
            const pickers = done ? (reveal.summary?.picks.filter((x) => x.slot === f.slot) ?? []) : [];
            return (
              <TvPanel key={f.slot} className="tg-pop flex min-h-0 flex-col gap-[0.6cqw]">
                <div className="flex items-center gap-[0.8cqw]" style={{ animationDelay: `${i * 140}ms` }}>
                  <span className="tg-display grid h-[4cqw] w-[3.2cqw] shrink-0 place-items-center rounded-[0.6cqw] bg-(--tg-gold) text-[2.6cqw] text-(--tg-ink)">{f.slot}</span>
                  <p className="tg-display min-w-0 flex-1 truncate text-[2cqw]">{f.kind}</p>
                  <span className="tg-num text-[3cqw] leading-none text-(--tg-gold)">{f.reward}</span>
                </div>
                <p className={clsx("text-[1.45cqw] font-extrabold leading-tight", card && "line-clamp-4")}>{f.prompt}</p>
                <div className="mt-auto flex flex-col gap-[0.4cqw]">
                  {card
                    ? f.options
                        .filter((o) => o.id === card.solutionId)
                        .map((o) => <TvOption key={o.id} index={f.options.indexOf(o)} text={o.text} state="right" />)
                    : f.options.map((o, k) => <TvOption key={o.id} index={k} text={o.text} size="sm" />)}
                </div>
                {done && (
                  <div className="flex flex-wrap items-center gap-[0.4cqw]">
                    <span className="mr-[0.3cqw] text-[1cqw] font-extrabold uppercase tracking-[0.14em] text-(--tg-cream)/60">{pickers.length ? "Scelta da" : "Nessun tavolo"}</span>
                    {pickers.map((x) => (
                      <TvTableBadge key={x.teamId} team={map.get(x.teamId)} />
                    ))}
                  </div>
                )}
              </TvPanel>
            );
          })}
        </div>
        {done && (
          <TvPanel className="tg-rise p-[1cqw]">
            <p className="text-[1.3cqw] font-semibold leading-snug text-(--tg-cream)/90">
              <span className="mr-[0.6cqw] text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-gold)">Perché</span>
              {reveal.explain}
            </p>
          </TvPanel>
        )}
      </div>
    </TvFrame>
  );
}

export const treCarteUnDestinoUi = defineUi(Player, Tv);
