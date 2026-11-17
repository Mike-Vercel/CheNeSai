"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { DilemmaMatrix } from "@/lib/tig/games/components/vote";
import type { DilemmaReveal, DilemmaSubmission, DilemmaView } from "@/lib/tig/games/mechanics/dilemma-pubblico";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { BigToggle } from "../kit/inputs";
import { canEdit, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<DilemmaView, null, DilemmaSubmission, DilemmaReveal>;
type T = TvGameProps<DilemmaView, DilemmaReveal>;
type Choice = DilemmaSubmission["choice"];

/** Matrice dei punti: righe = soglia raggiunta / mancata, colonne = coopera / compete. */
function Matrix({ m, coopLabel, competeLabel, active, tv = false }: { m: DilemmaMatrix; coopLabel: string; competeLabel: string; active?: "reached" | "missed" | null; tv?: boolean }) {
  const pct = Math.round(m.threshold * 100);
  const cell = (n: number, on: boolean) => (
    <td className={clsx("tg-num text-center", tv ? "px-[1cqw] py-[0.9cqw] text-[3.4cqw]" : "px-2 py-3 text-3xl", on ? "bg-(--tg-gold) text-(--tg-ink)" : "text-(--tg-cream)")}>+{n}</td>
  );
  const head = clsx("font-extrabold uppercase tracking-wide text-(--tg-cream)/70", tv ? "px-[1cqw] py-[0.6cqw] text-[1.2cqw]" : "px-2 py-2 text-[11px]");
  const rowHead = clsx("text-left font-extrabold leading-tight", tv ? "px-[1cqw] py-[0.6cqw] text-[1.45cqw]" : "px-2 py-2 text-sm");
  return (
    <table className="w-full overflow-hidden rounded-xl border border-(--tg-cream)/12 [&_td]:border [&_td]:border-(--tg-cream)/10 [&_th]:border [&_th]:border-(--tg-cream)/10">
      <thead>
        <tr>
          <th className={head} />
          <th className={clsx(head, "text-(--tg-gold)")}>
            <Icon name="handshake" className={clsx("mx-auto", tv ? "h-[2cqw] w-[2cqw]" : "h-5 w-5")} />
            {coopLabel}
          </th>
          <th className={clsx(head, "text-(--tg-red-hi)")}>
            <Icon name="sword" className={clsx("mx-auto", tv ? "h-[2cqw] w-[2cqw]" : "h-5 w-5")} />
            {competeLabel}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr className={active === "reached" ? "outline outline-2 outline-(--tg-gold)" : undefined}>
          <th className={rowHead}>Almeno il {pct}% dei tavoli coopera</th>
          {cell(m.reached.coop, active === "reached")}
          {cell(m.reached.compete, active === "reached")}
        </tr>
        <tr className={active === "missed" ? "outline outline-2 outline-(--tg-red-hi)" : undefined}>
          <th className={rowHead}>Meno del {pct}%</th>
          {cell(m.missed.coop, false)}
          {cell(m.missed.compete, false)}
        </tr>
      </tbody>
    </table>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [choice, setChoice] = useState<Choice | null>(null);
  const { send, pending, error } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => choice && p.canSubmit && send({ choice });

  if (p.stage === "reveal" && reveal) {
    const s = reveal.summary;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {s && (
          <Panel tone={s.reached ? "lime" : "red"} className="text-center">
            <p className="tg-num text-6xl">
              {s.coop}/{s.total}
            </p>
            <p className="text-base font-bold">tavoli hanno cooperato · soglia {s.reached ? "raggiunta" : "mancata"}</p>
          </Panel>
        )}
        <Matrix m={reveal.matrix} coopLabel={reveal.coopLabel} competeLabel={reveal.competeLabel} active={s ? (s.reached ? "reached" : "missed") : null} />
        <Explain text={reveal.explain} title="Com'è andata" />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!choice} pending={pending} error={error} onSubmit={submit} label="Conferma la scelta" />}
    >
      <Panel className="flex flex-col gap-1">
        <p className="tg-display text-3xl">{view.story}</p>
        <p className="text-base font-semibold leading-snug text-(--tg-cream)/85">{view.prompt}</p>
      </Panel>
      <Matrix m={view.matrix} coopLabel={view.coopLabel} competeLabel={view.competeLabel} />
      <BigToggle<Choice>
        label="La vostra scelta"
        value={choice}
        onChange={setChoice}
        disabled={!editable}
        options={[
          { id: "coopera", title: view.coopLabel, tone: "lime", icon: "handshake" },
          { id: "compete", title: view.competeLabel, tone: "red", icon: "sword" },
        ]}
      />
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  return (
    <TvFrame view={view} p={p} subtitle={view.prompt}>
      <div className="grid h-full grid-cols-[1.3fr_1fr] gap-[1.6cqw]">
        <TvPanel className="flex flex-col gap-[1.2cqw]">
          <p className="tg-display text-[3.4cqw]">{view.story}</p>
          <Matrix m={view.matrix} coopLabel={view.coopLabel} competeLabel={view.competeLabel} active={s ? (s.reached ? "reached" : "missed") : null} tv />
        </TvPanel>
        {s ? (
          <div className="flex flex-col gap-[1.2cqw]">
            <TvPanel tone={s.reached ? "lime" : "red"} className="tg-pop flex flex-col items-center gap-[0.6cqw]">
              <p className="tg-num text-[8cqw] leading-none">
                {s.coop}
                <span className="text-(--tg-cream)/40">/{s.total}</span>
              </p>
              <p className="text-[1.6cqw] font-extrabold">tavoli hanno scelto «{view.coopLabel}»</p>
              <div className="relative mt-[0.6cqw] h-[1.4cqw] w-full overflow-hidden rounded-full bg-(--tg-cream)/10">
                <div className="absolute inset-y-0 left-0 rounded-full bg-(--tg-gold) transition-[width] duration-1000" style={{ width: `${Math.round(s.share * 100)}%` }} />
                <div className="absolute inset-y-0 w-[0.25cqw] bg-white" style={{ left: `${Math.round(view.matrix.threshold * 100)}%` }} />
              </div>
              <p className="tg-display text-[2.4cqw]">{s.reached ? "Soglia raggiunta" : "Soglia mancata"}</p>
            </TvPanel>
            <TvExplain text={reveal!.explain} />
          </div>
        ) : (
          <TvPanel className="flex flex-col items-center justify-center gap-[1cqw] text-center">
            <div className="flex gap-[2cqw]">
              <Icon name="handshake" className="h-[7cqw] w-[7cqw] text-(--tg-gold)" />
              <Icon name="sword" className="h-[7cqw] w-[7cqw] text-(--tg-red-hi)" />
            </div>
            <p className="text-[1.8cqw] font-bold text-(--tg-cream)/80">Un voto per tavolo. Le scelte si vedono solo alla fine.</p>
          </TvPanel>
        )}
      </div>
    </TvFrame>
  );
}

export const dilemmaPubblicoUi = defineUi(Player, Tv);
