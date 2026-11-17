"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { ParolaReveal, ParolaSubmission, ParolaView } from "@/lib/tig/games/mechanics/ultima-parola";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";

type P = PlayerGameProps<ParolaView, null, ParolaSubmission, ParolaReveal>;
type T = TvGameProps<ParolaView, ParolaReveal>;

/** Pezzi aperti all'istante: dalla linea del tempo e da quelli già arrivati dal server. */
function openCount(view: ParolaView, elapsed: number, all: boolean): number {
  if (all) return view.chunks.length;
  let n = 1;
  view.schedule.forEach((at, i) => {
    if (elapsed >= at && view.chunks[i] !== null) n = i + 1;
  });
  return n;
}

/** La frase che cresce, con la casella vuota (o la risposta) alla fine. */
function Sentence({ chunks, open, answer, tv = false }: { chunks: (string | null)[]; open: number; answer?: string | null; tv?: boolean }) {
  return (
    <p className={clsx("font-extrabold leading-snug", tv ? "text-[2.6cqw]" : "text-2xl")} aria-live="polite">
      {chunks.slice(0, open).map((c, i) => (
        <span key={i} className={clsx(i === open - 1 && !answer && "tg-rise text-(--tg-gold)")}>
          {c}{" "}
        </span>
      ))}
      {open < chunks.length && <span className={clsx("text-(--tg-cream)/30", tv ? "text-[2cqw]" : "text-lg")}>{"· ".repeat(Math.min(3, chunks.length - open))}</span>}
      {answer ? (
        <span className={clsx("tg-pop rounded-[0.3em] bg-(--tg-gold) px-[0.25em] text-(--tg-ink)")}>{answer}</span>
      ) : (
        <span className={clsx("inline-block border-b-4 border-dashed border-(--tg-gold)/70 align-baseline", tv ? "w-[10cqw]" : "w-24")} aria-label="parola mancante">
          &nbsp;
        </span>
      )}
    </p>
  );
}

function WorthBar({ worth, open, tv = false }: { worth: number[]; open: number; tv?: boolean }) {
  return (
    <div className={clsx("grid", tv ? "gap-[0.4cqw]" : "gap-1")} style={{ gridTemplateColumns: `repeat(${worth.length}, minmax(0, 1fr))` }} aria-label={`Ora vale ${worth[open - 1]}`}>
      {worth.map((w, i) => (
        <div key={i} className={clsx("flex flex-col items-center rounded-lg border-2", tv ? "py-[0.3cqw]" : "py-1", i === open - 1 ? "border-(--tg-gold) bg-(--tg-gold)/15" : i < open - 1 ? "border-(--tg-cream)/5 opacity-35" : "border-(--tg-cream)/12")}>
          <span className={clsx("tg-num leading-none", tv ? "text-[1.8cqw]" : "text-xl", i === open - 1 ? "text-(--tg-gold)" : "text-(--tg-cream)/70")}>{w}</span>
          <span className={clsx("font-extrabold uppercase text-(--tg-cream)/50", tv ? "text-[0.7cqw]" : "text-[9px]")}>{i + 1}° pezzo</span>
        </div>
      ))}
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const open = openCount(view, elapsed, p.stage !== "play");
  const worth = view.worth[open - 1];
  const submit = () => picked && p.canSubmit && send({ optionId: picked });

  if (p.stage === "reveal" && reveal) {
    const ans = reveal.options.find((o) => o.id === reveal.solutionId)?.text ?? "";
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-3">
          <Eyebrow>La frase intera</Eyebrow>
          <Sentence chunks={reveal.chunks} open={reveal.chunks.length} answer={ans} />
        </Panel>
        <ChoiceList options={view.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame view={view} p={p} footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label={`Blocca a ${worth}`} hint={p.canSubmit ? "Il capitano decide quando bloccare: i pezzi continuano ad arrivare" : undefined} />}>
      <Panel className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Eyebrow>La frase · manca l&apos;ultima parola</Eyebrow>
          <p className="tg-num text-2xl text-(--tg-gold)">ora vale {worth}</p>
        </div>
        <Sentence chunks={view.chunks} open={open} />
        <WorthBar worth={view.worth} open={open} />
      </Panel>
      <ChoiceList options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} label="L'ultima parola" />
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const done = p.stage === "reveal" && reveal;
  const open = openCount(view, elapsed, p.stage !== "play");
  const chunks = done ? reveal.chunks : view.chunks;
  const ans = done ? (reveal.options.find((o) => o.id === reveal.solutionId)?.text ?? null) : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Chi ha bloccato prima, se giusto, ha preso di più" : "Un pezzo alla volta: prima bloccate, più vale. Ma sbagliare vale zero"}>
      <div className="grid h-full grid-cols-[1.5fr_1fr] gap-[1.6cqw]">
        <TvPanel className="flex min-h-0 flex-col gap-[1.2cqw]">
          <Sentence chunks={chunks} open={open} answer={ans} tv />
          <div className="mt-auto">
            <WorthBar worth={view.worth} open={open} tv />
          </div>
        </TvPanel>
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className="grid content-start gap-[0.6cqw]">
            {view.options.map((o, i) => (
              <TvOption key={o.id} index={i} text={o.text} state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
            ))}
          </TvPanel>
          {done && <TvExplain text={reveal.explain} />}
        </div>
      </div>
    </TvFrame>
  );
}

export const ultimaParolaUi = defineUi(Player, Tv);
