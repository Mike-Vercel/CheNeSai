"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { ParolaReveal, ParolaSubmission, ParolaView } from "@/lib/tig/games/mechanics/ultima-parola";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { ChoiceList } from "../kit/inputs";
import { Doubloon } from "../kit/ornaments";
import { canEdit, elapsedOf, Explain, MyOutcome, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";
import { tvCompact, TvWhy } from "./m2/kit";

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

/** La frase che cresce, scritta a inchiostro sulla pergamena, con la casella vuota (o la risposta) alla fine. */
function Sentence({ chunks, open, answer, tv = false, compact = false }: { chunks: (string | null)[]; open: number; answer?: string | null; tv?: boolean; compact?: boolean }) {
  return (
    <p className={clsx("font-extrabold leading-snug text-(--tg-ink)", tv ? (compact ? "text-[2.2cqw]" : "text-[2.6cqw]") : "text-[1.4rem]")} aria-live="polite">
      {chunks.slice(0, open).map((c, i) => (
        <span key={i} className={clsx(i === open - 1 && !answer && "tg-rise text-(--tg-red) underline decoration-(--tg-red)/40 decoration-2 underline-offset-4")}>
          {c}{" "}
        </span>
      ))}
      {open < chunks.length && <span className={clsx("whitespace-nowrap text-(--tg-ink)/40", tv ? "text-[2cqw]" : "text-lg")}>{"· ".repeat(Math.min(3, chunks.length - open))}</span>}
      {answer ? (
        <span className="tg-pop rounded-[0.3em] bg-(--tg-gold) px-[0.25em] text-(--tg-ink) shadow-[inset_0_-0.12em_0_rgba(122,78,16,.45)]">{answer}</span>
      ) : (
        <span className={clsx("inline-block border-b-4 border-dashed border-(--tg-burnt) align-baseline", tv ? "w-[10cqw]" : "w-24")} aria-label="parola mancante">
          &nbsp;
        </span>
      )}
    </p>
  );
}

/** Quanto vale la risposta: una fila di dobloni, quello di adesso acceso, i passati spenti. */
function WorthBar({ worth, open, tv = false, compact = false }: { worth: number[]; open: number; tv?: boolean; compact?: boolean }) {
  return (
    <div className={clsx("flex items-end justify-between", tv ? "gap-[0.6cqw]" : "gap-1.5")} role="img" aria-label={`Ora vale ${worth[open - 1]}`}>
      {worth.map((w, i) => {
        const now = i === open - 1;
        const past = i < open - 1;
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-[0.15em]">
            {now || !past ? (
              <Doubloon className={clsx(tv ? (now ? (compact ? "h-[4.4cqw] w-[4.4cqw] text-[1.7cqw]" : "h-[5.2cqw] w-[5.2cqw] text-[2cqw]") : compact ? "h-[3.2cqw] w-[3.2cqw] text-[1.25cqw]" : "h-[3.8cqw] w-[3.8cqw] text-[1.45cqw]") : now ? "h-12 w-12 text-lg" : "h-9 w-9 text-sm", !now && "opacity-75 saturate-50", now && "tg-pop shadow-[0_0_24px_rgba(242,177,52,.7)]")}>
                {w}
              </Doubloon>
            ) : (
              <span className={clsx("tg-num grid place-items-center rounded-full border-2 border-dashed border-(--tg-burnt)/50 text-(--tg-ink)/35 line-through", tv ? (compact ? "h-[3.2cqw] w-[3.2cqw] text-[1.2cqw]" : "h-[3.8cqw] w-[3.8cqw] text-[1.4cqw]") : "h-9 w-9 text-sm")}>{w}</span>
            )}
            <span className={clsx("font-extrabold uppercase tracking-wide text-(--tg-ink)/65", tv ? "text-[0.85cqw]" : "text-[9px]")}>{i + 1}° pezzo</span>
          </div>
        );
      })}
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
        <section className="tg-parch flex flex-col gap-3 p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-(--tg-burnt-ink)">La frase intera</p>
          <Sentence chunks={reveal.chunks} open={reveal.chunks.length} answer={ans} />
        </section>
        <ChoiceList options={view.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame view={view} p={p} footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label={`Blocca a ${worth}`} hint={p.canSubmit ? "Il capitano decide quando bloccare: i pezzi continuano ad arrivare" : undefined} />}>
      <section className="tg-parch flex flex-col gap-3 p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-(--tg-burnt-ink)">La frase · manca l&apos;ultima parola</p>
        <Sentence chunks={view.chunks} open={open} />
        <WorthBar worth={view.worth} open={open} />
      </section>
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
  const compact = tvCompact(p.teams);
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Chi ha bloccato prima, se giusto, ha preso di più" : "Un pezzo alla volta: prima bloccate, più vale. Ma sbagliare vale zero"}>
      <div className="grid h-full grid-cols-[1.5fr_1fr] gap-[1.6cqw]">
        <div className={clsx("tg-parch tg-rise flex min-h-0 flex-col overflow-hidden", compact ? "gap-[0.8cqw] px-[2cqw] py-[1.4cqw]" : "gap-[1.2cqw] p-[2cqw]")}>
          <p className="shrink-0 text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-burnt-ink)">La frase · manca l&apos;ultima parola</p>
          <Sentence chunks={chunks} open={open} answer={ans} tv compact={compact} />
          <div className="mt-auto shrink-0">
            <WorthBar worth={view.worth} open={open} tv compact={compact} />
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className={clsx("grid shrink-0 content-start", compact ? "gap-[0.45cqw] py-[1.2cqw]" : "gap-[0.6cqw]")}>
            {view.options.map((o, i) => (
              <TvOption key={o.id} size={compact ? "sm" : "md"} index={i} text={o.text} state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
            ))}
          </TvPanel>
          {done && <TvWhy text={reveal.explain} compact={compact} />}
        </div>
      </div>
    </TvFrame>
  );
}

export const ultimaParolaUi = defineUi(Player, Tv);
