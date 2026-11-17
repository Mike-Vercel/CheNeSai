"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { BersaglioReveal, BersaglioSubmission, BersaglioView } from "@/lib/tig/games/mechanics/scegli-il-bersaglio";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<BersaglioView, null, BersaglioSubmission, BersaglioReveal>;
type T = TvGameProps<BersaglioView, BersaglioReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const rivals = view.targets.filter((x) => x.teamId !== p.myTeam.teamId);
  const [target, setTarget] = useState<string | null>(rivals.length === 1 ? rivals[0].teamId : null);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!target && !!picked;
  const submit = () => ready && p.canSubmit && send({ targetId: target!, optionId: picked! });
  const table = new Map(view.targets.map((x) => [x.teamId, x.tableNo]));

  if (p.stage === "reveal" && reveal) {
    const mine = reveal.summary?.duels.filter((d) => d.a === p.myTeam.teamId || d.b === p.myTeam.teamId) ?? [];
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {mine.length > 0 && (
          <Panel className="flex flex-col gap-2">
            <Eyebrow>I vostri duelli</Eyebrow>
            {mine.map((d) => {
              const other = d.a === p.myTeam.teamId ? d.b : d.a;
              const won = d.winner === p.myTeam.teamId;
              return (
                <p key={`${d.a}${d.b}`} className="flex items-center gap-2 text-lg font-extrabold">
                  <Icon name="sword" className="h-5 w-5" /> contro il tavolo {table.get(other)}:{" "}
                  <span className={won ? "text-[#c6ff3d]" : d.winner ? "text-[#ff8c97]" : "text-white/60"}>{won ? "vinto +40" : d.winner ? "perso" : "pari"}</span>
                </p>
              );
            })}
          </Panel>
        )}
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
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Sfida e rispondi" hint={!target ? "Prima scegliete chi sfidare" : !picked ? "Poi la risposta" : undefined} />}
    >
      <Panel className="flex flex-col gap-3">
        <Eyebrow className="flex items-center gap-2">
          <Icon name="target" className="h-4 w-4" /> 1 · Chi sfidate?
        </Eyebrow>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Tavolo da sfidare">
          {rivals.map((r) => (
            <button
              key={r.teamId}
              type="button"
              role="radio"
              aria-checked={target === r.teamId}
              disabled={!editable}
              onClick={() => setTarget(r.teamId)}
              className={clsx("tg-num flex h-16 flex-col items-center justify-center rounded-xl border-2 text-3xl leading-none", target === r.teamId ? "tg-picked border-[#ff3b4e] text-white" : "border-white/12 bg-white/[0.04] text-white/80")}
            >
              {r.tableNo}
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-white/60">tavolo</span>
            </button>
          ))}
        </div>
      </Panel>
      <Panel className="flex flex-col gap-3">
        <Eyebrow>2 · L&apos;enigma (uguale per tutti)</Eyebrow>
        <p className="text-lg font-extrabold leading-snug">{view.prompt}</p>
        <ChoiceList options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const team = new Map(p.teams.map((x) => [x.teamId, x]));
  const chip = (id: string) => (
    <span className="tg-num grid h-[3.2cqw] w-[3.2cqw] place-items-center rounded-[0.6cqw] text-[1.9cqw] text-[#0b0d12]" style={{ background: team.get(id)?.color ?? "#eef2f6" }}>
      {team.get(id)?.tableNo ?? "?"}
    </span>
  );
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Duelli: vince chi risponde giusto, a pari merito il più veloce" : "Ognuno sceglie un rivale. Stesso enigma per tutti: duello vinto +40."}>
      <div className="grid h-full grid-cols-[1.3fr_1fr] gap-[1.6cqw]">
        <TvPanel className="flex min-h-0 flex-col gap-[1cqw]">
          <p className="text-[2.3cqw] font-extrabold leading-tight">{view.prompt}</p>
          <div className="grid grid-cols-2 gap-[0.7cqw]">
            {view.options.map((o, i) => (
              <TvOption key={o.id} index={i} text={o.text} state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
            ))}
          </div>
          {done && <TvExplain text={reveal.explain} className="mt-auto" />}
        </TvPanel>
        <TvPanel className="flex min-h-0 flex-col gap-[0.7cqw] overflow-hidden">
          <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-[#ff3b4e]">Duelli</p>
          {done && reveal.summary ? (
            reveal.summary.duels.map((d, i) => (
              <div key={`${d.a}${d.b}`} className="tg-rise flex items-center gap-[0.8cqw] rounded-[0.8cqw] bg-white/[0.05] px-[0.8cqw] py-[0.5cqw]" style={{ animationDelay: `${i * 120}ms` }}>
                {chip(d.a)}
                <Icon name="sword" className="h-[2cqw] w-[2cqw] text-[#ff3b4e]" />
                {chip(d.b)}
                <span className="ml-auto text-[1.5cqw] font-extrabold">{d.winner ? <span className="text-[#c6ff3d]">vince il {team.get(d.winner)?.tableNo} · +40</span> : <span className="text-white/60">nessun vincitore</span>}</span>
              </div>
            ))
          ) : (
            <p className="text-[1.6cqw] font-bold text-white/60">Le sfide restano segrete fino al reveal.</p>
          )}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const scegliIlBersaglioUi = defineUi(Player, Tv);
