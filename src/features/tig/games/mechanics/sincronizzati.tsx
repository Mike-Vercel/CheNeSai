"use client";

import { useState } from "react";
import type { SincroMemberView, SincroReveal, SincroSubmission, SincroView } from "@/lib/tig/games/mechanics/sincronizzati";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<SincroView, SincroMemberView, SincroSubmission, SincroReveal>;
type T = TvGameProps<SincroView, SincroReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const options = p.memberView?.options ?? view.options;
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send({ optionId: picked });

  if (p.stage === "reveal" && reveal) {
    const mine = reveal.summary?.teams.find((x) => x.teamId === p.myTeam.teamId);
    const text = (id: string) => view.options.find((o) => o.id === id)?.text ?? id;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {mine && (
          <Panel className="flex flex-col gap-1">
            <Eyebrow>Il vostro tavolo</Eyebrow>
            <p className="tg-num text-6xl text-(--tg-gold)">{Math.round(mine.share * 100)}%</p>
            <p className="text-base font-bold text-(--tg-cream)/80">
              {mine.voters} voti su {mine.members} telefoni · più scelta: {mine.top.map(text).join(" / ")}
            </p>
          </Panel>
        )}
        <Explain text={reveal.explain} title="Sincronia" />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="Invia il mio voto" hint="Segreto: niente accordi a voce. L'ordine delle risposte cambia su ogni telefono." />}
    >
      <Panel className="flex items-start gap-3">
        <Icon name="users" className="mt-0.5 h-7 w-7 shrink-0 text-(--tg-gold)" />
        <p className="text-xl font-extrabold leading-snug">{view.prompt}</p>
      </Panel>
      <ChoiceList options={options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} big />
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const team = new Map(p.teams.map((x) => [x.teamId, x]));
  const text = (id: string) => view.options.find((o) => o.id === id)?.text ?? id;
  const rows = done ? (reveal.summary?.teams ?? []).slice().sort((a, b) => b.share - a.share) : [];
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Quanto siete sincronizzati, tavolo per tavolo" : "Ognuno vota in segreto, senza parlare. Conta la percentuale di accordo."}>
      <div className="grid h-full grid-cols-[1fr_1.2fr] gap-[1.6cqw]">
        <TvPanel className="flex flex-col gap-[0.8cqw]">
          <p className="text-[2.5cqw] font-extrabold leading-tight">{view.prompt}</p>
          {view.options.map((o, i) => (
            <TvOption key={o.id} index={i} text={o.text} />
          ))}
        </TvPanel>
        {done ? (
          <div className="flex min-h-0 flex-col gap-[1cqw]">
            <TvPanel className="flex min-h-0 flex-col gap-[0.5cqw] overflow-hidden">
              {rows.map((r, i) => (
                <div key={r.teamId} className="tg-rise flex items-center gap-[0.8cqw]" style={{ animationDelay: `${i * 90}ms` }}>
                  <span className="tg-num grid h-[2.6cqw] w-[2.6cqw] shrink-0 place-items-center rounded-[0.5cqw] text-[1.5cqw] text-(--tg-ink)" style={{ background: team.get(r.teamId)?.color }}>
                    {team.get(r.teamId)?.tableNo}
                  </span>
                  <div className="relative h-[2.6cqw] flex-1 overflow-hidden rounded-[0.5cqw] bg-(--tg-cream)/[0.06]">
                    <div className="absolute inset-y-0 left-0 bg-(--tg-gold)/80 transition-[width] duration-1000" style={{ width: `${Math.round(r.share * 100)}%` }} />
                    <span className="absolute inset-0 flex items-center px-[0.8cqw] text-[1.2cqw] font-extrabold text-(--tg-cream) mix-blend-difference">{r.top.map(text).join(" / ")}</span>
                  </div>
                  <span className="tg-num w-[5cqw] text-right text-[2cqw]">{Math.round(r.share * 100)}%</span>
                </div>
              ))}
            </TvPanel>
            <TvExplain text={reveal.explain} />
          </div>
        ) : (
          <TvPanel className="flex flex-col items-center justify-center gap-[1cqw] text-center">
            <Icon name="users" className="h-[8cqw] w-[8cqw] text-(--tg-gold)" />
            <p className="tg-display text-[4cqw]">Silenzio al tavolo</p>
            <p className="text-[1.6cqw] font-bold text-(--tg-cream)/70">2 su 2 vale come 8 su 8. Chi non vota abbassa l&apos;accordo.</p>
          </TvPanel>
        )}
      </div>
    </TvFrame>
  );
}

export const sincronizzatiUi = defineUi(Player, Tv);
