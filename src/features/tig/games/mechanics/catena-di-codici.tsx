"use client";

import { useState } from "react";
import type { CatenaMemberView, CatenaReveal, CatenaSubmission, CatenaView } from "@/lib/tig/games/mechanics/catena-di-codici";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { DigitPad } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<CatenaView, CatenaMemberView, CatenaSubmission, CatenaReveal>;
type T = TvGameProps<CatenaView, CatenaReveal>;

function Player(p: P) {
  const { view, reveal, memberView } = p;
  const [digits, setDigits] = useState("");
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = digits.length === view.length;
  const submit = () => ready && p.canSubmit && send({ digits });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <DigitPad value={sent ? digits : reveal.digits} length={view.length} onChange={() => {}} disabled reveal={reveal.digits} />
        <Panel className="flex flex-col gap-1.5">
          <Eyebrow>Cifra per cifra</Eyebrow>
          {reveal.steps.map((s, i) => (
            <p key={i} className="flex gap-2 text-sm font-bold leading-snug">
              <span className="tg-num w-7 shrink-0 text-xl text-[#c6ff3d]">{reveal.digits[i]}</span> {s}
            </p>
          ))}
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Prova il codice" hint="Leggete ad alta voce i vostri indizi: le cifre vanno in ordine di posizione" />}
    >
      <Panel tone="lime" className="flex flex-col gap-2">
        <Eyebrow className="flex items-center gap-2 text-[#c6ff3d]">
          <Icon name="users" className="h-4 w-4" /> I tuoi indizi {memberView ? `· siete ${memberView.phones} telefon${memberView.phones === 1 ? "o" : "i"}` : ""}
        </Eyebrow>
        {memberView ? (
          memberView.fragments.map((f) => (
            <div key={f.pos} className="flex items-start gap-3 rounded-xl bg-white/[0.05] px-3 py-2.5">
              <span className="tg-num grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#c6ff3d] text-2xl text-[#0b0d12]" aria-label={`Posizione ${f.pos + 1}`}>
                {f.pos + 1}
              </span>
              <p className="text-base font-bold leading-snug">{f.clue}</p>
            </div>
          ))
        ) : (
          <p className="text-sm font-bold text-white/70">Indizi in arrivo…</p>
        )}
      </Panel>
      <Panel className="flex flex-col gap-2">
        <p className="tg-display text-2xl">{view.lockName}</p>
        <DigitPad value={digits} length={view.length} onChange={setDigits} disabled={!editable} onEnter={submit} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Il codice, cifra per cifra" : "Gli indizi sono divisi tra i telefoni di ogni tavolo: parlatevi."}>
      <div className="flex h-full flex-col items-center gap-[1.6cqw]">
        <TvPanel className="tg-rise flex flex-col items-center gap-[1.2cqw] px-[3cqw]">
          <p className="tg-display text-[3cqw]">{view.lockName}</p>
          <div className="flex gap-[0.8cqw]">
            {Array.from({ length: view.length }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-[0.3cqw]">
                <span className={`tg-num grid h-[8cqw] w-[6cqw] place-items-center rounded-[1cqw] border-[0.25cqw] text-[5.4cqw] ${done ? "tg-pop border-[#c6ff3d] text-[#c6ff3d]" : "border-white/20 text-white/20"}`} style={{ animationDelay: `${i * 140}ms` }}>
                  {done ? reveal.digits[i] : "?"}
                </span>
                <span className="tg-num text-[1.3cqw] text-white/50">{i + 1}</span>
              </div>
            ))}
          </div>
        </TvPanel>
        {done && (
          <div className="grid w-full flex-1 grid-cols-[1.4fr_1fr] gap-[1.4cqw]">
            <TvPanel className="grid grid-cols-2 content-start gap-x-[1.4cqw] gap-y-[0.6cqw]">
              {reveal.steps.map((s, i) => (
                <p key={i} className="tg-rise flex gap-[0.6cqw] text-[1.3cqw] font-bold leading-snug" style={{ animationDelay: `${i * 100}ms` }}>
                  <span className="tg-num text-[1.8cqw] text-[#c6ff3d]">{reveal.digits[i]}</span>
                  {s}
                </p>
              ))}
            </TvPanel>
            <TvExplain text={reveal.explain} className="self-start" />
          </div>
        )}
      </div>
    </TvFrame>
  );
}

export const catenaDiCodiciUi = defineUi(Player, Tv);
