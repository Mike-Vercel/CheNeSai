"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { AstaReveal, AstaSubmission, AstaView } from "@/lib/tig/games/mechanics/asta-al-buio";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { AmountPicker } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<AstaView, null, AstaSubmission, AstaReveal>;
type T = TvGameProps<AstaView, AstaReveal>;

function Envelope({ worth, tv = false }: { worth: number | null; tv?: boolean }) {
  return (
    <div className={clsx("relative mx-auto aspect-[1.55] w-full", tv ? "max-w-[30cqw]" : "max-w-[260px]")} aria-label={worth === null ? "Busta chiusa" : `Busta aperta: ${worth} punti`}>
      <div className="absolute inset-0 rounded-[8%] border-2 border-[#c6ff3d]/60 bg-gradient-to-br from-[#1f2733] to-[#11161f]" />
      <div className={clsx("absolute inset-x-0 top-0 h-[55%] origin-top border-b-2 border-[#c6ff3d]/40 transition-transform duration-700", worth !== null && "opacity-0 [transform:rotateX(90deg)]")} style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)", background: "#273041" }} />
      <div className="absolute inset-0 grid place-items-center">
        <span className={clsx("tg-num leading-none", tv ? "text-[7cqw]" : "text-6xl", worth === null ? "text-white/25" : "tg-pop text-[#c6ff3d]")}>{worth === null ? "?" : worth}</span>
      </div>
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [amount, setAmount] = useState(0);
  const { send, pending, error } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const half = Math.round(view.cap / 2 / view.step) * view.step;

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-3">
          <Envelope worth={reveal.worth} />
          <p className="text-center text-lg font-extrabold">
            {reveal.summary?.winner ? `Aggiudicata a ${reveal.summary.winningBid}` : "Nessuna offerta: la busta resta chiusa"}
          </p>
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready pending={pending} error={error} onSubmit={() => send({ amount })} label={amount === 0 ? "Passiamo" : `Offri ${amount}`} hint="Paga solo chi vince. Nessuno vede la vostra offerta." />}
    >
      <Panel className="flex flex-col gap-3">
        <p className="tg-display text-3xl">{view.lot}</p>
        <Envelope worth={null} />
        <Eyebrow>Cosa sapete della busta</Eyebrow>
        <ul className="flex flex-col gap-1.5">
          {view.hints.map((h, i) => (
            <li key={i} className="flex gap-2 text-base font-bold leading-snug">
              <span className="tg-num text-[#c6ff3d]">{i + 1}</span> {h}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <AmountPicker label="La vostra offerta segreta" value={amount} max={view.cap} step={view.step} onChange={setAmount} disabled={!editable} presets={[0, half, Math.round((view.cap * 0.75) / view.step) * view.step, view.cap]} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const team = new Map(p.teams.map((x) => [x.teamId, x]));
  const bids = done ? (reveal.summary?.bids ?? []).slice().sort((a, b) => b.amount - a.amount) : [];
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Le offerte segrete, svelate" : `Offerta massima ${view.cap}. Vince la più alta; paga solo chi vince.`}>
      <div className="grid h-full grid-cols-[1fr_1.1fr] gap-[1.6cqw]">
        <TvPanel tone={done ? "lime" : undefined} className="flex flex-col items-center justify-center gap-[1.2cqw]">
          <p className="tg-display text-[3cqw]">{view.lot}</p>
          <Envelope worth={done ? reveal.worth : null} tv />
          {done && <p className="text-[1.6cqw] font-extrabold text-white/80">La busta valeva {reveal.worth} punti</p>}
        </TvPanel>
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          {!done ? (
            <TvPanel className="flex flex-col gap-[0.9cqw]">
              <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-[#c6ff3d]">Indizi sul valore</p>
              {view.hints.map((h, i) => (
                <p key={i} className="tg-rise text-[2cqw] font-bold leading-snug" style={{ animationDelay: `${i * 150}ms` }}>
                  <span className="tg-num mr-[0.8cqw] text-[#c6ff3d]">{i + 1}</span>
                  {h}
                </p>
              ))}
            </TvPanel>
          ) : (
            <>
              <TvPanel className="flex min-h-0 flex-col gap-[0.5cqw] overflow-hidden">
                {bids.map((b, i) => {
                  const win = reveal.summary?.winner === b.teamId;
                  return (
                    <div key={b.teamId} className={clsx("tg-rise flex items-center gap-[1cqw] rounded-[0.8cqw] px-[1cqw] py-[0.4cqw]", win ? "tg-shine bg-[#c6ff3d] text-[#0b0d12]" : "bg-white/[0.05]")} style={{ animationDelay: `${i * 100}ms` }}>
                      <span className="tg-num grid h-[2.8cqw] w-[2.8cqw] place-items-center rounded-[0.6cqw] text-[1.6cqw] text-[#0b0d12]" style={{ background: team.get(b.teamId)?.color }}>
                        {team.get(b.teamId)?.tableNo}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[1.5cqw] font-extrabold">{team.get(b.teamId)?.name}</span>
                      <span className="tg-num text-[2.2cqw]">{b.amount === 0 ? "passa" : b.amount}</span>
                      {win && <span className="tg-display text-[1.6cqw]">aggiudicata</span>}
                    </div>
                  );
                })}
              </TvPanel>
              <TvExplain text={reveal.explain} />
            </>
          )}
        </div>
      </div>
    </TvFrame>
  );
}

export const astaAlBuioUi = defineUi(Player, Tv);
