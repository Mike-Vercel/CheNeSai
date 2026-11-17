"use client";

import "./m1/m1.css";
import { clsx } from "clsx";
import { useState } from "react";
import type { OptionSubmission } from "@/lib/tig/games/mechanics/m1/common";
import type { TitoliReveal, TitoliView } from "@/lib/tig/games/mechanics/titoli-tagliati";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, MyOutcome, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<TitoliView, null, OptionSubmission, TitoliReveal>;
type T = TvGameProps<TitoliView, TitoliReveal>;

/** Ritaglio di giornale inventato: testata, sezione, titolo con il buco (o col pezzo scelto), sommario. */
function Clipping({
  outlet,
  section,
  headline,
  lead,
  fill,
  final = false,
  tv = false,
}: {
  outlet: string;
  section: string;
  headline: [string, string];
  lead: string;
  fill: string | null;
  final?: boolean;
  tv?: boolean;
}) {
  return (
    <article className={clsx("tg1-paper tg-rise relative shrink-0 overflow-hidden shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]", tv ? "rounded-[1.2cqw] p-[2cqw]" : "rounded-2xl p-4")}>
      <header className={clsx("flex items-baseline justify-between gap-3 border-b-[3px] border-double border-[#12161f]", tv ? "mb-[1.2cqw] pb-[0.6cqw]" : "mb-3 pb-1.5")}>
        <p className={clsx("tg1-serif font-black italic tracking-tight", tv ? "text-[2cqw]" : "text-lg")}>{outlet}</p>
        <p className={clsx("font-extrabold uppercase tracking-[0.18em] text-[#ff3b4e]", tv ? "text-[1cqw]" : "text-[11px]")}>{section}</p>
      </header>
      <h2 className={clsx("tg1-serif font-black leading-[1.08] tracking-tight", tv ? (fill && final ? "text-[2.5cqw]" : "text-[3.1cqw]") : "text-[1.55rem] sm:text-3xl")}>
        {headline[0]}
        {fill ? (
          <mark className={clsx("tg1-filled rounded-[0.2em] px-[0.2em] [-webkit-box-decoration-break:clone] [box-decoration-break:clone]", final && "tg-shine")}>{fill}</mark>
        ) : (
          <span className="tg1-blank inline-block w-[5.5em] rounded-[0.15em] align-baseline" aria-label="parte mancante">
            &nbsp;
          </span>
        )}
        {headline[1]}
      </h2>
      <p className={clsx("font-semibold leading-snug text-[#12161f]/80", tv ? (fill && final ? "mt-[0.9cqw] text-[1.4cqw]" : "mt-[1.2cqw] text-[1.6cqw]") : "mt-3 text-[15px]")}>{lead}</p>
    </article>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send({ optionId: picked });

  if (p.stage === "reveal" && reveal) {
    const right = reveal.options.find((o) => o.id === reveal.solutionId)?.text ?? null;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Clipping outlet={reveal.outlet} section={reveal.section} headline={reveal.headline} lead={reveal.lead} fill={right} final />
        <ChoiceList options={view.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  const fill = picked ? (view.options.find((o) => o.id === picked)?.text ?? null) : null;
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
          ready={!!picked}
          pending={pending}
          error={error}
          onSubmit={submit}
          label="Chiudi il titolo"
          hint={picked ? undefined : "Scegliete il finale: lo vedete subito nel titolo"}
        />
      }
    >
      <Clipping outlet={view.outlet} section={view.section} headline={view.headline} lead={view.lead} fill={fill} />
      <ChoiceList label="Finali possibili" options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const fill = done ? (reveal.options.find((o) => o.id === reveal.solutionId)?.text ?? null) : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Ecco il titolo completo" : "Quale finale torna con i fatti del sommario?"}>
      <div className="grid h-full grid-cols-[1.25fr_1fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col justify-center gap-[1.2cqw]">
          <Clipping outlet={view.outlet} section={view.section} headline={view.headline} lead={view.lead} fill={fill} final tv />
          {done && <TvExplain text={reveal.explain} />}
        </div>
        <TvPanel className="flex flex-col justify-center gap-[0.9cqw]">
          {view.options.map((o, i) => (
            <TvOption key={o.id} index={i} text={o.text} state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
          ))}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const titoliTagliatiUi = defineUi(Player, Tv);
