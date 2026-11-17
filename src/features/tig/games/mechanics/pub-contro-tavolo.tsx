"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { PubReveal, PubSubmission, PubView } from "@/lib/tig/games/mechanics/pub-contro-tavolo";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { TableChip, teamMap, TvExplainCompact, TvStamp } from "./_m3-kit";

type P = PlayerGameProps<PubView, null, PubSubmission, PubReveal>;
type T = TvGameProps<PubView, PubReveal>;

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("it-IT");

function ChampionBanner({ view, mine }: { view: PubView; mine: boolean }) {
  if (!view.champion) return null;
  return (
    <Panel tone={mine ? "lime" : "red"} className="flex items-center gap-3">
      <Icon name={mine ? "target" : "users"} className={clsx("h-9 w-9 shrink-0", mine ? "text-[#c6ff3d]" : "text-[#ff3b4e]")} />
      <p className="text-base font-extrabold leading-snug">
        {mine ? "Siete lo sfidante: fate più della media del pub e prendete +40." : `Il tavolo ${view.champion.tableNo} sfida tutto il pub: rispondete bene e tenete alta la media.`}
      </p>
    </Panel>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [picks, setPicks] = useState<Record<string, string>>({});
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const done = view.questions.filter((q) => picks[q.id]).length;
  const ready = done === view.questions.length;
  const current = view.questions.findIndex((q) => !picks[q.id]);
  const submit = () => ready && p.canSubmit && send({ picks });
  const mine = view.champion?.teamId === p.myTeam.teamId;
  /** sceglie e porta in vista la prossima domanda senza risposta */
  const pick = (i: number, id: string) => {
    if (!editable) return;
    const q = view.questions[i];
    setPicks((x) => ({ ...x, [q.id]: id }));
    const next = view.questions.find((x, j) => j > i && !picks[x.id]);
    if (next) window.requestAnimationFrame(() => document.getElementById(`pct-q-${next.id}`)?.parentElement?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  if (p.stage === "reveal" && reveal) {
    const s = reveal.summary;
    const myRight = s?.scores[p.myTeam.teamId];
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {s && view.champion && (
          <Panel tone={s.beaten ? "lime" : "red"} className="flex items-center justify-around gap-3 text-center">
            <div>
              <Eyebrow>Tavolo {view.champion.tableNo}</Eyebrow>
              <p className="tg-num text-5xl">{s.championRight ?? "–"}</p>
            </div>
            <p className="tg-display text-2xl">{s.beaten ? "Batte il pub" : "Il pub resiste"}</p>
            <div>
              <Eyebrow>Media pub</Eyebrow>
              <p className="tg-num text-5xl">{s.rivalsAvg === null ? "3" : fmt(s.rivalsAvg)}</p>
            </div>
          </Panel>
        )}
        {myRight !== undefined && <p className="px-1 text-base font-bold text-white/80">Il vostro tavolo: {myRight} risposte giuste su 5.</p>}
        <Panel className="flex flex-col gap-3">
          <Eyebrow>Le risposte</Eyebrow>
          {reveal.questions.map((q, i) => {
            const right = q.options.find((o) => o.id === q.solutionId)?.text;
            const myPick = sent ? picks[q.id] : undefined;
            return (
              <div key={q.id} className="flex flex-col gap-0.5 border-b border-white/10 pb-2 last:border-0 last:pb-0">
                <p className="text-sm font-bold text-white/70">
                  {i + 1}. {q.prompt}
                </p>
                <p className="flex items-center gap-1.5 text-base font-extrabold text-[#c6ff3d]">
                  <Icon name="check" className="h-4 w-4" /> {right}
                  {myPick && myPick !== q.solutionId && <span className="text-sm font-bold text-[#ff8c97] line-through">{q.options.find((o) => o.id === myPick)?.text}</span>}
                </p>
                <p className="text-sm font-semibold text-white/75">{q.note}</p>
              </div>
            );
          })}
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label={`Invia ${done}/${view.questions.length}`} hint={ready ? undefined : `Mancano ${view.questions.length - done} risposte`} />}
    >
      <ChampionBanner view={view} mine={mine} />
      <Panel className="flex items-center justify-between gap-3">
        <p className="tg-display text-2xl">{view.theme}</p>
        <span className="tg-num text-2xl text-[#c6ff3d]" aria-label={`${done} risposte su ${view.questions.length}`}>
          {done}/{view.questions.length}
        </span>
      </Panel>
      {view.questions.map((q, i) => (
        <Panel key={q.id} className={clsx("flex scroll-mt-4 flex-col gap-2", i === current && editable && "outline outline-2 outline-[#c6ff3d]/50")}>
          <span id={`pct-q-${q.id}`} className="sr-only" />
          <Eyebrow className={clsx(picks[q.id] && "text-[#c6ff3d]")}>Domanda {i + 1}</Eyebrow>
          <p className="text-lg font-extrabold leading-snug">{q.prompt}</p>
          <ChoiceList
            options={q.options}
            picked={picks[q.id] ? [picks[q.id]] : []}
            onToggle={(id) => pick(i, id)}
            disabled={!editable}
            keys={i === (current < 0 ? view.questions.length - 1 : current)}
            onConfirm={ready ? submit : null}
            label={`Domanda ${i + 1}`}
          />
        </Panel>
      ))}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  const teams = teamMap(p.teams);
  const champ = view.champion ? teams.get(view.champion.teamId) : undefined;
  const qs = done ? reveal.questions : view.questions.map((q) => ({ ...q, solutionId: "", note: "" }));
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Com'è finita la sfida" : "Tutti rispondono alle stesse 5 domande. Lo sfidante prende +40 se batte la media del pub."}>
      <div className="grid h-full grid-cols-[0.85fr_1.4fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel tone={s ? (s.beaten ? "lime" : "red") : undefined} className="flex flex-col items-center gap-[0.8cqw] text-center">
            <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-white/60">{view.theme}</p>
            <div className="flex w-full items-center justify-around">
              <div className="flex flex-col items-center gap-[0.4cqw]">
                <TableChip tableNo={view.champion?.tableNo ?? "?"} color={champ?.color} tv className={s ? "!h-[4.2cqw] !min-w-[4.2cqw] !rounded-[0.8cqw] !text-[2.8cqw]" : "!h-[6cqw] !min-w-[6cqw] !rounded-[1cqw] !text-[4cqw]"} />
                <p className="tg-display text-[1.6cqw]">Sfidante</p>
                {s && <p className="tg-num text-[3.8cqw] leading-none">{s.championRight ?? "–"}</p>}
              </div>
              <p className="tg-display text-[4cqw] text-[#ff3b4e]">VS</p>
              <div className="flex flex-col items-center gap-[0.4cqw]">
                <div className={clsx("grid place-items-center rounded-[1cqw] bg-white/10", s ? "h-[4.2cqw] w-[4.2cqw]" : "h-[6cqw] w-[6cqw]")}>
                  <Icon name="users" className={s ? "h-[2.8cqw] w-[2.8cqw] text-[#c6ff3d]" : "h-[4cqw] w-[4cqw] text-[#c6ff3d]"} />
                </div>
                <p className="tg-display text-[1.6cqw]">Il pub</p>
                {s && <p className="tg-num text-[3.8cqw] leading-none">{s.rivalsAvg === null ? "3" : fmt(s.rivalsAvg)}</p>}
              </div>
            </div>
            {s && (
              <TvStamp size="sm" tone={s.beaten ? "lime" : "red"} sub={s.rivalsAvg === null ? "Nessun rivale: serviva almeno 3 su 5" : `Media di ${s.rivals} tavoli rivali`}>
                {s.beaten ? "Lo sfidante vince" : "Il pub resiste"}
              </TvStamp>
            )}
          </TvPanel>
          {done && <TvExplainCompact text={reveal.explain} className="flex-1" />}
        </div>
        <TvPanel className="flex min-h-0 flex-col justify-between gap-[0.6cqw]">
          {qs.map((q, i) => {
            const n = s?.perQuestion[q.id];
            const total = s?.tables ?? 0;
            return (
              <div key={q.id} className="tg-rise flex flex-col gap-[0.3cqw]" style={{ animationDelay: `${i * 80}ms` }}>
                <p className="text-[1.45cqw] font-extrabold leading-tight">
                  <span className="tg-num mr-[0.5cqw] text-[#c6ff3d]">{i + 1}</span>
                  {q.prompt}
                </p>
                <div className="flex flex-wrap items-center gap-[0.5cqw]">
                  {q.options.map((o) => {
                    const right = done && o.id === q.solutionId;
                    return (
                      <span key={o.id} className={clsx("rounded-[0.5cqw] border-[0.12cqw] px-[0.7cqw] py-[0.2cqw] text-[1.15cqw] font-bold", right ? "border-[#c6ff3d] bg-[#c6ff3d] text-[#0b0d12]" : done ? "border-white/10 text-white/40" : "border-white/15 bg-white/[0.05]")}>
                        {o.text}
                      </span>
                    );
                  })}
                  {n !== undefined && total > 0 && (
                    <span className="ml-auto text-[1.05cqw] font-extrabold text-white/70">
                      {n}/{total} tavoli giusti
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const pubControTavoloUi = defineUi(Player, Tv);
