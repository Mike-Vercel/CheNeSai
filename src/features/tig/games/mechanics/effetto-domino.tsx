"use client";

import "./m1/m1.css";
import { clsx } from "clsx";
import { useState } from "react";
import type { DominoReveal, DominoView } from "@/lib/tig/games/mechanics/effetto-domino";
import type { OptionSubmission } from "@/lib/tig/games/mechanics/m1/common";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Eyebrow, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<DominoView, null, OptionSubmission, DominoReveal>;
type T = TvGameProps<DominoView, DominoReveal>;

const PIPS: Record<number, [number, number][]> = {
  1: [[10, 10]],
  2: [[6, 6], [14, 14]],
  3: [[5, 5], [10, 10], [15, 15]],
  4: [[6, 6], [14, 6], [6, 14], [14, 14]],
  5: [[5, 5], [15, 5], [10, 10], [5, 15], [15, 15]],
};

/** Tessera del domino disegnata (due metà, punti = posizione nella catena). */
function DominoPiece({ n, className, lit = false }: { n: number; className?: string; lit?: boolean }) {
  const top = Math.min(n, 5);
  return (
    <svg viewBox="0 0 22 44" className={className} aria-hidden>
      <rect x={1} y={1} width={20} height={42} rx={4} fill={lit ? "#c6ff3d" : "#eef2f6"} stroke="#0b0d12" strokeWidth={1.5} />
      <line x1={4} y1={22} x2={18} y2={22} stroke="#0b0d12" strokeWidth={1.4} />
      {PIPS[top].map(([x, y], i) => (
        <circle key={`a${i}`} cx={x + 1} cy={y + 1} r={2} fill="#0b0d12" />
      ))}
      {PIPS[top].map(([x, y], i) => (
        <circle key={`b${i}`} cx={x + 1} cy={y + 23} r={2} fill="#0b0d12" />
      ))}
    </svg>
  );
}

function Chain({ chain, tv = false }: { chain: string[]; tv?: boolean }) {
  return (
    <ol className={clsx("flex", tv ? "items-stretch gap-[0.8cqw]" : "flex-col gap-2")} aria-label="Catena dei fatti">
      {chain.map((c, i) => (
        <li key={i} className={clsx("flex min-w-0", tv ? "flex-1 items-center gap-[0.8cqw]" : "items-stretch gap-2")}>
          <div
            className={clsx("tg-glass flex min-w-0 flex-1 items-center", tv ? "tg1-tile gap-[1cqw] rounded-[1.1cqw] p-[1cqw]" : "tg-rise gap-3 rounded-2xl p-3")}
            style={{ animationDelay: `${i * (tv ? 450 : 90)}ms` }}
          >
            <DominoPiece n={i + 1} className={tv ? "h-[5.6cqw] w-auto shrink-0" : "h-14 w-auto shrink-0"} />
            <p className={clsx("font-bold leading-snug", tv ? "text-[1.55cqw]" : "text-base")}>
              <span className="sr-only">Fatto {i + 1}: </span>
              {c}
            </p>
          </div>
          {tv && i < chain.length - 1 && <Icon name="arrow" className="h-[2.2cqw] w-[2.2cqw] shrink-0 text-[#c6ff3d]" />}
        </li>
      ))}
    </ol>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send({ optionId: picked });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Chain chain={reveal.chain} />
        <Panel className="flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-snug">{reveal.prompt}</p>
          <ChoiceList options={view.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="Fate cadere l'ultima" />}
    >
      <Eyebrow className="px-1 text-[#c6ff3d]">{view.situation}</Eyebrow>
      <Chain chain={view.chain} />
      <Panel className="flex flex-col gap-3">
        <p className="text-xl font-extrabold leading-snug">{view.prompt}</p>
        <ChoiceList label="Conseguenze" options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const right = done ? reveal.options.find((o) => o.id === reveal.solutionId) : null;
  return (
    <TvFrame view={view} p={p} subtitle={`«${view.situation}»: ${view.prompt}`}>
      <div className="flex h-full flex-col gap-[1.4cqw]">
        <div className="flex items-stretch gap-[0.8cqw]">
          <div className="min-w-0 flex-1">
            <Chain chain={view.chain} tv />
          </div>
          {right && (
            <>
              <Icon name="arrow" className="h-[2.2cqw] w-[2.2cqw] shrink-0 self-center text-[#c6ff3d]" />
              <div className="tg1-tile-land tg-glass tg-glass-lime flex w-[24cqw] shrink-0 items-center gap-[1cqw] rounded-[1.1cqw] p-[1cqw]">
                <DominoPiece n={view.chain.length + 1} lit className="h-[5.6cqw] w-auto shrink-0" />
                <p className="text-[1.55cqw] font-extrabold leading-snug text-[#c6ff3d]">{right.text}</p>
              </div>
            </>
          )}
        </div>
        <div className={clsx("grid min-h-0 flex-1 gap-[1.4cqw]", done ? "grid-cols-[1.4fr_1fr]" : "grid-cols-1")}>
          <TvPanel className="grid grid-cols-2 content-center gap-[0.9cqw]">
            {view.options.map((o, i) => (
              <TvOption key={o.id} index={i} text={o.text} state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
            ))}
          </TvPanel>
          {done && <TvExplain text={reveal.explain} className="self-center" />}
        </div>
      </div>
    </TvFrame>
  );
}

export const effettoDominoUi = defineUi(Player, Tv);
