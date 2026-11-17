"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { CarteReveal, CarteSubmission, CarteView, Slot } from "@/lib/tig/games/mechanics/tre-carte-un-destino";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { CompassRose } from "../kit/ornaments";
import { ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";
import { secsTo, teamMap, TvTableBadge, TvWhy } from "./m5-kit";

type P = PlayerGameProps<CarteView, null, CarteSubmission, CarteReveal>;
type T = TvGameProps<CarteView, CarteReveal>;

const SLOTS: Slot[] = ["A", "B", "C"];

/**
 * Dorso di una carta da gioco della taverna: mare di notte, cornice d'ottone, rosa dei venti in filigrana, lettera
 * d'oro al centro e negli angoli (come le carte vere). Scelta: bordo e bagliore d'oro con la spunta.
 */
function CardBack({ slot, picked, tv = false, onClick, disabled }: { slot: Slot; picked?: boolean; tv?: boolean; onClick?: () => void; disabled?: boolean }) {
  const cls = clsx(
    "relative grid place-items-center overflow-hidden border-2 bg-[radial-gradient(circle_at_50%_38%,#16404f,#0b1f2a_58%,#07131a)] shadow-[inset_0_0_0_1px_rgba(0,0,0,.4),0_18px_40px_-18px_rgba(0,0,0,.9)] transition-transform duration-200",
    tv ? "aspect-[3/4] h-full max-h-full rounded-[1.4cqw]" : "aspect-[3/4] w-full rounded-2xl active:scale-[0.97]",
    picked ? "border-(--tg-gold) shadow-[0_0_40px_-8px_color-mix(in_srgb,var(--tg-gold)_75%,transparent)]" : "border-(--tg-brass)/70",
  );
  const corner = clsx("tg-display absolute leading-none text-(--tg-gold)/85", tv ? "text-[1.8cqw]" : "text-sm");
  const inner = (
    <>
      <span className={clsx("absolute inset-[6%] rounded-[inherit] border bg-[repeating-linear-gradient(45deg,rgba(201,162,74,.09)_0_6px,transparent_6px_13px)]", picked ? "border-(--tg-gold)/80" : "border-(--tg-brass)/45")} aria-hidden />
      <CompassRose className="absolute inset-[16%] text-(--tg-brass) opacity-25" />
      <span className={clsx(corner, tv ? "left-[9%] top-[6%]" : "left-[11%] top-[6%]")} aria-hidden>
        {slot}
      </span>
      <span className={clsx(corner, "rotate-180", tv ? "bottom-[6%] right-[9%]" : "bottom-[6%] right-[11%]")} aria-hidden>
        {slot}
      </span>
      <span className={clsx("tg-display relative drop-shadow-[0_3px_6px_rgba(0,0,0,.7)]", tv ? "text-[8.5cqw]" : "text-6xl", picked ? "text-(--tg-gold-hi)" : "text-(--tg-gold)")}>{slot}</span>
      {picked && <Icon name="check" className={clsx("absolute text-(--tg-gold-hi)", tv ? "bottom-[1cqw] left-[1cqw] h-[3cqw] w-[3cqw]" : "bottom-2 left-2 h-6 w-6")} />}
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
          <TvWhy text={reveal.explain} size="sm" />
        )}
      </div>
    </TvFrame>
  );
}

export const treCarteUnDestinoUi = defineUi(Player, Tv);
