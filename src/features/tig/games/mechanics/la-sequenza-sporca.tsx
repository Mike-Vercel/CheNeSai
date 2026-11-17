"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { SequenzaReveal, SequenzaSubmission, SequenzaView } from "@/lib/tig/games/mechanics/la-sequenza-sporca";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, Eyebrow, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { tokenLabel, TokenFace, TokenTile } from "./m1/token";

type P = PlayerGameProps<SequenzaView, null, SequenzaSubmission, SequenzaReveal>;
type T = TvGameProps<SequenzaView, SequenzaReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const [picked, setPicked] = useState<number | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked !== null && p.canSubmit && send({ index: picked });
  useAnswerKeys({ enabled: editable && !reveal, count: Math.min(9, view.items.length), onPick: (i) => setPicked(i), onConfirm: submit });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <div className={clsx("grid gap-2 sm:grid-cols-5", reveal.items.length > 6 ? "grid-cols-4" : "grid-cols-3")}>
          {reveal.items.map((t, i) => (
            <TokenTile key={i} token={t} index={i} state={i === reveal.index ? "wrong" : sent && picked === i ? "picked" : "dim"} />
          ))}
        </div>
        <Panel tone="lime" className="flex items-center gap-4">
          <TokenFace token={reveal.expected} className="h-16 w-16 shrink-0 text-[#c6ff3d]" />
          <div>
            <Eyebrow>Al posto del n. {reveal.index + 1} doveva esserci</Eyebrow>
            <p className="text-lg font-extrabold leading-snug">{reveal.law}</p>
          </div>
        </Panel>
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
          ready={picked !== null}
          pending={pending}
          error={error}
          onSubmit={submit}
          label={picked !== null ? `Intruso: il n. ${picked + 1}` : "Scegliete l'intruso"}
          hint={picked === null ? "Leggete la fila da sinistra a destra (dal PC: tasti 1–9)" : undefined}
        />
      }
    >
      <div role="radiogroup" aria-label="Elementi della sequenza" className={clsx("grid gap-2 sm:grid-cols-5", view.items.length > 6 ? "grid-cols-4" : "grid-cols-3")}>
        {view.items.map((t, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={picked === i}
            aria-label={`Elemento ${i + 1}: ${tokenLabel(t)}`}
            disabled={!editable}
            onClick={() => editable && setPicked(i)}
            className="rounded-2xl transition-transform active:scale-95 disabled:opacity-80"
          >
            <TokenTile token={t} index={i} state={picked === i ? "picked" : "idle"} />
          </button>
        ))}
      </div>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const n = view.items.length;
  return (
    <TvFrame view={view} p={p} subtitle={done ? reveal.law : "Una regola, un intruso. Leggete la fila da sinistra a destra."}>
      <div className="flex h-full flex-col justify-center gap-[2cqw]">
        <ol className="mx-auto grid w-full items-start gap-[1cqw]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, maxWidth: `${Math.min(96, n * 12)}cqw` }} aria-label="Sequenza">
          {view.items.map((t, i) => {
            const bad = done && i === reveal.index;
            return (
              <li key={i} className="tg-rise flex flex-col items-center gap-[0.6cqw]" style={{ animationDelay: `${i * 70}ms` }}>
                <TokenTile token={t} index={i} tv state={done ? (bad ? "wrong" : "dim") : "idle"} className="w-full" />
                {bad && (
                  <span className="tg-pop flex flex-col items-center">
                    <Icon name="up" className="h-[2cqw] w-[2cqw] text-[#c6ff3d]" />
                    <span className="tg-glass tg-glass-lime grid h-[8cqw] w-[8cqw] place-items-center rounded-[1cqw] text-[#c6ff3d]">
                      <TokenFace token={reveal.expected} className="h-[78%] w-[78%]" />
                    </span>
                    <span className="mt-[0.3cqw] text-[1cqw] font-extrabold uppercase tracking-[0.16em] text-[#c6ff3d]">doveva essere</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {done && <TvExplain text={reveal.explain} className="mx-auto max-w-[70cqw]" />}
        {!done && (
          <TvPanel className="mx-auto flex items-center gap-[1cqw] px-[2cqw] py-[1cqw]">
            <Icon name="target" className="h-[2.2cqw] w-[2.2cqw] text-[#c6ff3d]" />
            <p className="text-[1.6cqw] font-extrabold">Dal telefono: toccate l&apos;elemento che rompe la regola</p>
          </TvPanel>
        )}
      </div>
    </TvFrame>
  );
}

export const laSequenzaSporcaUi = defineUi(Player, Tv);
