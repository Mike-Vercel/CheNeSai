"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { ImboscataReveal, ImboscataSubmission, ImboscataView } from "@/lib/tig/games/mechanics/l-imboscata";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { BigToggle, ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, OptionButton, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { teamMap, TvOutcomeGrid, TvSolved, TvTableBadge } from "./m5-kit";

type P = PlayerGameProps<ImboscataView, null, ImboscataSubmission, ImboscataReveal>;
type T = TvGameProps<ImboscataView, ImboscataReveal>;
type Stake = ImboscataSubmission["stake"];

function Player(p: P) {
  const { view, reveal } = p;
  const [trap, setTrap] = useState<string | null>(null);
  const [stake, setStake] = useState<Stake | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [tab, setTab] = useState(0);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const me = view.links.find((l) => l.teamId === p.myTeam.teamId);
  const tableOf = (id: string | null | undefined) => view.links.find((l) => l.teamId === id)?.tableNo;
  const hasTarget = !!me?.targetId;
  const allAnswered = view.traps.every((t) => !!answers[t.id]);
  const ready = (!hasTarget || !!trap) && stake !== null && allAnswered;
  const submit = () => ready && p.canSubmit && send({ trap: trap ?? view.traps[0].id, stake: stake ?? 0, answers });

  if (p.stage === "reveal" && reveal) {
    const hit = reveal.summary?.ambushes.find((a) => a.to === p.myTeam.teamId);
    const mine = reveal.summary?.ambushes.find((a) => a.from === p.myTeam.teamId);
    const hitTrap = reveal.traps.find((t) => t.id === hit?.trapId);
    const myTrap = reveal.traps.find((t) => t.id === mine?.trapId);
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {hit && hitTrap && (
          <Panel tone={hit.held ? "lime" : "red"} className="flex flex-col gap-2">
            <Eyebrow>{hit.house ? "Trappola sorteggiata dalla casa" : `Il tavolo ${tableOf(hit.from) ?? "?"} vi ha teso: ${hitTrap.name}`}</Eyebrow>
            <p className="text-lg font-extrabold leading-snug">{hitTrap.prompt}</p>
            <ChoiceList options={hitTrap.options} picked={sent && answers[hitTrap.id] ? [answers[hitTrap.id]] : []} onToggle={() => {}} keys={false} reveal={{ solution: [hitTrap.solutionId] }} />
            <p className="text-sm font-bold text-(--tg-cream)/75">{hit.held ? `Difesa riuscita: +60${hit.stake ? ` e +${hit.stake} di rischio` : ""}.` : hit.stake ? `Difesa caduta: ${hit.stake} punti di rischio persi.` : "Difesa caduta, ma non avevate rischiato nulla."}</p>
          </Panel>
        )}
        {mine && myTrap && (
          <Panel className="flex items-center gap-3">
            <Icon name="target" className="h-8 w-8 shrink-0 text-(--tg-teal-hi)" />
            <p className="text-base font-bold leading-snug">
              La vostra trappola al tavolo {tableOf(mine.to) ?? "?"}: {myTrap.name} · {mine.held ? "l'ha retta" : "ci è cascato (+20)"}
            </p>
          </Panel>
        )}
        <Panel className="flex flex-col gap-1">
          <Eyebrow>Le tre risposte giuste</Eyebrow>
          {reveal.traps.map((t) => (
            <p key={t.id} className="text-sm font-semibold leading-snug text-(--tg-cream)/85">
              <b className="text-(--tg-teal-hi)">{t.name}:</b> {t.options.find((o) => o.id === t.solutionId)?.text}
            </p>
          ))}
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  const q = view.traps[tab];
  const pickAnswer = (id: string) => {
    if (!editable) return;
    setAnswers((a) => ({ ...a, [q.id]: id }));
    const nextIdx = view.traps.findIndex((t, i) => i > tab && !answers[t.id]);
    if (nextIdx >= 0) window.setTimeout(() => setTab(nextIdx), 180);
  };
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
          ready={ready}
          pending={pending}
          error={error}
          onSubmit={submit}
          label="Tendi l'imboscata"
          hint={!ready ? `Mancano: ${[hasTarget && !trap ? "la trappola" : null, stake === null ? "il rischio" : null, !allAnswered ? "le risposte" : null].filter(Boolean).join(", ")}` : undefined}
        />
      }
    >
      <Panel className="grid grid-cols-2 gap-3 py-3">
        <div className="flex items-center gap-2">
          <Icon name="target" className="h-7 w-7 shrink-0 text-(--tg-teal-hi)" />
          <div>
            <Eyebrow>Il vostro bersaglio</Eyebrow>
            <p className="tg-display text-2xl">{hasTarget ? `Tavolo ${tableOf(me?.targetId)}` : "Nessuno"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Icon name="shield" className="h-7 w-7 shrink-0 text-(--tg-red-hi)" />
          <div>
            <Eyebrow>Vi colpisce</Eyebrow>
            <p className="tg-display text-2xl">{me?.attackerId ? `Tavolo ${tableOf(me.attackerId)}` : "La casa"}</p>
          </div>
        </div>
      </Panel>

      {hasTarget && (
        <Panel className="flex flex-col gap-2">
          <Eyebrow className="text-(--tg-teal-hi)">1 · La trappola per il tavolo {tableOf(me?.targetId)}</Eyebrow>
          {view.traps.map((t) => (
            <OptionButton key={t.id} text={<span className="flex flex-col"><span>{t.name}</span><span className="text-sm font-semibold text-(--tg-cream)/70">{t.blurb}</span></span>} state={trap === t.id ? "picked" : "idle"} onClick={() => editable && setTrap(t.id)} disabled={!editable} />
          ))}
        </Panel>
      )}

      <Panel className="flex flex-col gap-2">
        <Eyebrow className="text-(--tg-teal-hi)">{hasTarget ? "2" : "1"} · Quanto rischiate in difesa?</Eyebrow>
        <BigToggle<string>
          label="Rischio in difesa"
          value={stake === null ? null : String(stake)}
          onChange={(v) => editable && setStake(Number(v) as Stake)}
          disabled={!editable}
          options={view.stakes.map((s) => ({ id: String(s), title: s === 0 ? "Zero" : `${s}`, sub: s === 0 ? `Retta +${view.defensePoints}` : `+${view.defensePoints + s} o −${s}`, tone: s === 40 ? "red" : s === 20 ? "ice" : "lime" }))}
        />
        <p className="text-xs font-semibold text-(--tg-cream)/60">Se la difesa cade, il rischio va a chi vi ha teso la trappola (scudi e tetti valgono sempre).</p>
      </Panel>

      <Panel className="flex flex-col gap-3">
        <Eyebrow className="text-(--tg-teal-hi)">{hasTarget ? "3" : "2"} · Rispondete a tutte e tre: una sarà la vostra</Eyebrow>
        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Trappole">
          {view.traps.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={i === tab}
              onClick={() => setTab(i)}
              className={clsx("flex h-12 items-center justify-center rounded-xl border-2 px-1 text-center text-xs font-extrabold uppercase leading-tight tracking-wide", i === tab ? "border-(--tg-gold) text-(--tg-gold)" : "border-(--tg-cream)/12 text-(--tg-cream)/75", answers[t.id] && "bg-(--tg-gold)/10")}
            >
              {t.name}
            </button>
          ))}
        </div>
        <p className="text-lg font-extrabold leading-snug">{q.prompt}</p>
        <ChoiceList key={q.id} options={q.options} picked={answers[q.id] ? [answers[q.id]] : []} onToggle={pickAnswer} disabled={!editable} onConfirm={ready ? submit : null} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const map = teamMap(p.teams);
  const trapName = (id: string) => view.traps.find((t) => t.id === id)?.name ?? "";
  if (done) {
    return (
      <TvFrame view={view} p={p} subtitle={`${view.heading} · chi ha retto e chi ci è cascato`}>
        <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-[1cqw]">
          <div className="grid grid-cols-3 gap-[1cqw]">
            {reveal.traps.map((t, i) => (
              <TvSolved key={t.id} kicker={`Trappola ${i + 1} · ${t.name}`} prompt={t.prompt} answer={t.options.find((o) => o.id === t.solutionId)?.text ?? ""} />
            ))}
          </div>
          <TvPanel className="flex min-h-0 flex-col gap-[0.6cqw] p-[1cqw]">
            <p className="line-clamp-2 text-[1.2cqw] font-semibold leading-snug text-(--tg-cream)/85">
              <span className="mr-[0.6cqw] text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-gold)">Perché</span>
              {reveal.explain}
            </p>
            <TvOutcomeGrid
              teams={p.teams}
              outcome={p.outcome}
              note={(id) => {
                const a = reveal.summary?.ambushes.find((x) => x.to === id);
                if (!a) return null;
                return `${a.house ? "Casa" : `Dal ${map.get(a.from ?? "")?.tableNo ?? "?"}`}: ${trapName(a.trapId)} · ${a.held ? "retta" : "caduta"}${a.stake ? ` (rischio ${a.stake})` : ""}`;
              }}
            />
          </TvPanel>
        </div>
      </TvFrame>
    );
  }
  return (
    <TvFrame view={view} p={p} subtitle={`${view.heading} · ognuno tende una trappola al tavolo dopo di lui`}>
      <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-[1.1cqw]">
        <div className="grid min-h-0 grid-cols-3 gap-[1.1cqw]">
          {view.traps.map((t, i) => (
            <TvPanel key={t.id} className="tg-rise flex min-h-0 flex-col gap-[0.6cqw]">
              <p className="text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-teal-hi)" style={{ animationDelay: `${i * 100}ms` }}>
                Trappola {i + 1} · {t.name}
              </p>
              <p className="text-[1.5cqw] font-extrabold leading-tight">{t.prompt}</p>
              <div className="mt-auto flex flex-col gap-[0.4cqw]">
                {t.options.map((o, k) => (
                  <TvOption key={o.id} index={k} text={o.text} size="sm" />
                ))}
              </div>
            </TvPanel>
          ))}
        </div>
        <TvPanel className="flex flex-wrap items-center gap-x-[1.2cqw] gap-y-[0.5cqw] p-[1cqw]">
          <span className="text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-gold)">Chi tende la trappola a chi</span>
          {view.links
            .filter((l) => l.targetId)
            .map((l) => (
              <span key={l.teamId} className="flex items-center gap-[0.3cqw]">
                <TvTableBadge team={map.get(l.teamId)} />
                <Icon name="arrow" className="h-[1.4cqw] w-[1.4cqw] text-(--tg-red-hi)" />
                <TvTableBadge team={map.get(l.targetId!)} />
              </span>
            ))}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const lImboscataUi = defineUi(Player, Tv);
