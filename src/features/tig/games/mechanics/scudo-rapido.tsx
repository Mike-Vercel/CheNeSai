"use client";

import { useState } from "react";
import type { ScudoReveal, ScudoSubmission, ScudoView } from "@/lib/tig/games/mechanics/scudo-rapido";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { DigitPad } from "../kit/inputs";
import { canEdit, Explain, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<ScudoView, null, ScudoSubmission, ScudoReveal>;
type T = TvGameProps<ScudoView, ScudoReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const [digits, setDigits] = useState("");
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = digits.length === view.length;
  const submit = () => ready && p.canSubmit && send({ digits });

  if (p.stage === "reveal" && reveal) {
    const shield = p.myOutcome?.correct === true;
    return (
      <PlayerFrame view={view} p={p}>
        <Panel tone={shield ? "lime" : "red"} className="tg-pop flex items-center gap-4">
          <Icon name="shield" className={`h-16 w-16 shrink-0 ${shield ? "text-[#c6ff3d]" : "text-[#ff3b4e]"}`} />
          <div>
            <p className="tg-display text-4xl">{shield ? "Scudo attivo" : "Niente scudo"}</p>
            <p className="text-sm font-bold text-white/75">{shield ? "Il prossimo attacco valido contro di voi rimbalza. Dura fino a fine manche." : "Questa volta siete scoperti."}</p>
          </div>
        </Panel>
        <DigitPad value={sent ? digits : reveal.digits} length={view.length} onChange={() => {}} disabled reveal={reveal.digits} />
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Apri il lucchetto" />}
    >
      <Panel>
        <p className="text-lg font-bold leading-relaxed">{view.prompt}</p>
      </Panel>
      <DigitPad value={digits} length={view.length} onChange={setDigits} disabled={!editable} onEnter={submit} />
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const shields = new Set((p.outcome?.outcomes ?? []).filter((o) => o.correct).map((o) => o.teamId));
  return (
    <TvFrame view={view} p={p}>
      <div className="grid h-full grid-cols-[1.4fr_1fr] gap-[1.6cqw]">
        <TvPanel className="flex flex-col justify-center gap-[1.2cqw]">
          <p className="text-[2.2cqw] font-bold leading-snug">{view.prompt}</p>
          {done && <TvExplain text={reveal.explain} />}
        </TvPanel>
        <div className="flex flex-col items-center justify-center gap-[1.6cqw]">
          <Icon name={done ? "shield" : "lock"} className={`h-[9cqw] w-[9cqw] ${done ? "tg-pop text-[#c6ff3d]" : "text-white/70"}`} />
          <div className="flex gap-[0.8cqw]">
            {Array.from({ length: view.length }, (_, i) => (
              <span key={i} className={`tg-num grid h-[7.5cqw] w-[5.5cqw] place-items-center rounded-[1cqw] border-[0.25cqw] text-[5cqw] ${done ? "tg-pop border-[#c6ff3d] text-[#c6ff3d]" : "border-white/20 text-white/25"}`} style={{ animationDelay: `${i * 150}ms` }}>
                {done ? reveal.digits[i] : "•"}
              </span>
            ))}
          </div>
          {done && (
            <p className="tg-display text-[2.2cqw]">
              {shields.size} {shields.size === 1 ? "tavolo ha lo scudo" : "tavoli hanno lo scudo"}
            </p>
          )}
        </div>
      </div>
    </TvFrame>
  );
}

export const scudoRapidoUi = defineUi(Player, Tv);
