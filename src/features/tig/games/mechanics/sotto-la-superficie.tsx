"use client";

import { useState } from "react";
import type { OptionSubmission } from "@/lib/tig/games/mechanics/m1/common";
import type { SottoReveal, SottoView } from "@/lib/tig/games/mechanics/sotto-la-superficie";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { SurfaceChatView } from "./m1/chat";

type P = PlayerGameProps<SottoView, null, OptionSubmission, SottoReveal>;
type T = TvGameProps<SottoView, SottoReveal>;

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
        <SurfaceChatView chat={reveal.chat} targetId={reveal.targetId} />
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
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="È questo che intende" />}
    >
      <SurfaceChatView chat={view.chat} targetId={view.targetId} />
      <Panel className="flex flex-col gap-3">
        <p className="text-xl font-extrabold leading-snug">{view.prompt}</p>
        <ChoiceList label="Interpretazioni" options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  return (
    <TvFrame view={view} p={p} subtitle={view.prompt}>
      <div className="grid h-full grid-cols-[1fr_1.05fr] gap-[1.6cqw]">
        <div className="tg-rise flex min-h-0 flex-col justify-center">
          <SurfaceChatView chat={view.chat} targetId={view.targetId} size="tv" />
        </div>
        <div className="flex min-h-0 flex-col justify-center gap-[1.2cqw]">
          <TvPanel className="flex flex-col gap-[0.8cqw]">
            <p className="mb-[0.2cqw] text-[1.8cqw] font-extrabold leading-tight">{view.prompt}</p>
            {view.options.map((o, i) => (
              <TvOption key={o.id} index={i} text={o.text} size="sm" state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
            ))}
          </TvPanel>
          {done && <TvExplain text={reveal.explain} />}
        </div>
      </div>
    </TvFrame>
  );
}

export const sottoLaSuperficieUi = defineUi(Player, Tv);
