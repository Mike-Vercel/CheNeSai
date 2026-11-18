"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { PubReveal, PubSubmission, PubView } from "@/lib/tig/games/mechanics/pub-contro-tavolo";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { CrewTag, teamMap, ThemeBanner, TvExplainCompact, TvStamp } from "./_m3-kit";

type P = PlayerGameProps<PubView, null, PubSubmission, PubReveal>;
type T = TvGameProps<PubView, PubReveal>;

const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString("it-IT");

function ChampionBanner({ view, mine }: { view: PubView; mine: boolean }) {
  if (!view.champion) return null;
  return (
    <Panel tone={mine ? "lime" : "red"} className="flex items-center gap-3">
      <Icon name={mine ? "target" : "users"} className={clsx("h-9 w-9 shrink-0", mine ? "text-(--tg-gold)" : "text-(--tg-red-hi)")} />
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
        {myRight !== undefined && <p className="px-1 text-base font-bold text-(--tg-cream)/80">Il vostro tavolo: {myRight} risposte giuste su 5.</p>}
        <Panel className="flex flex-col gap-3">
          <Eyebrow>Le risposte</Eyebrow>
          {reveal.questions.map((q, i) => {
            const right = q.options.find((o) => o.id === q.solutionId)?.text;
            const myPick = sent ? picks[q.id] : undefined;
            return (
              <div key={q.id} className="flex flex-col gap-0.5 border-b border-(--tg-cream)/10 pb-2 last:border-0 last:pb-0">
                <p className="text-sm font-bold text-(--tg-cream)/70">
                  {i + 1}. {q.prompt}
                </p>
                <p className="flex items-center gap-1.5 text-base font-extrabold text-(--tg-gold)">
                  <Icon name="check" className="h-4 w-4" /> {right}
                  {myPick && myPick !== q.solutionId && <span className="text-sm font-bold text-(--tg-red-hi) line-through">{q.options.find((o) => o.id === myPick)?.text}</span>}
                </p>
                <p className="text-sm font-semibold text-(--tg-cream)/75">{q.note}</p>
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
      <ThemeBanner
        eyebrow="Il quiz"
        title={view.theme}
        size="sm"
        aside={
          <span className="tg-num text-2xl text-(--tg-ink)" aria-label={`${done} risposte su ${view.questions.length}`}>
            {done}/{view.questions.length}
          </span>
        }
      />
      {view.questions.map((q, i) => (
        <Panel key={q.id} className={clsx("flex scroll-mt-4 flex-col gap-2", i === current && editable && "outline outline-2 outline-(--tg-gold)/50")}>
          <span id={`pct-q-${q.id}`} className="sr-only" />
          <Eyebrow className={clsx(picks[q.id] && "text-(--tg-gold)")}>Domanda {i + 1}</Eyebrow>
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
  // stesso ordine delle risposte della prova (mescolato col seme), soluzione aggiunta solo al reveal
  const qs = view.questions.map((q) => ({ ...q, solutionId: (done ? reveal.questions.find((r) => r.id === q.id)?.solutionId : null) ?? "" }));
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Com'è finita la sfida" : "Tutti rispondono alle stesse 5 domande. Lo sfidante prende +40 se batte la media del pub."}>
      <div className="grid h-full grid-cols-[0.85fr_1.4fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          {/* al reveal il tema lascia spazio al verdetto e al «perché» (con 12 tavoli serve tutto lo spazio) */}
          {!done && <ThemeBanner tv size="sm" eyebrow="Il quiz" title={view.theme} className="tg-rise" />}
          {/* il duello: la bandiera della ciurma sfidante contro tutto il locale */}
          <TvPanel tone={s ? (s.beaten ? "lime" : "red") : undefined} className={clsx("flex flex-col items-center text-center", s ? "gap-[0.5cqw] !py-[1.1cqw]" : "gap-[0.8cqw]")}>
            <div className="flex w-full items-center justify-around">
              <div className="flex flex-col items-center gap-[0.3cqw]">
                <CrewTag tableNo={view.champion?.tableNo ?? "?"} color={champ?.color} className={s ? "h-[3.6cqw]" : "h-[5.6cqw]"} />
                <p className="tg-display text-[1.4cqw] text-(--tg-gold-hi)">Sfidante</p>
                {s && <p className="tg-num text-[3.4cqw] leading-none">{s.championRight ?? "–"}</p>}
              </div>
              <p className={clsx("tg-title text-(--tg-red-hi)", s ? "text-[3.4cqw]" : "text-[4.6cqw]")}>contro</p>
              <div className="flex flex-col items-center gap-[0.3cqw]">
                <div className={clsx("grid place-items-center rounded-full border-[0.18cqw] border-(--tg-brass)/70 bg-(--tg-night)", s ? "h-[3.6cqw] w-[3.6cqw]" : "h-[5.6cqw] w-[5.6cqw]")}>
                  <Icon name="users" className={s ? "h-[2.2cqw] w-[2.2cqw] text-(--tg-gold)" : "h-[3.4cqw] w-[3.4cqw] text-(--tg-gold)"} />
                </div>
                <p className="tg-display text-[1.4cqw] text-(--tg-gold-hi)">Il pub</p>
                {s && <p className="tg-num text-[3.4cqw] leading-none">{s.rivalsAvg === null ? "3" : fmt(s.rivalsAvg)}</p>}
              </div>
            </div>
            {s && (
              <TvStamp size="sm" tone={s.beaten ? "lime" : "red"} sub={s.rivalsAvg === null ? "Nessun rivale: serviva almeno 3 su 5" : s.rivals === 1 ? "Un solo tavolo rivale" : `Media di ${s.rivals} tavoli rivali`}>
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
                  <span className="tg-num mr-[0.5cqw] text-(--tg-gold)">{i + 1}</span>
                  {q.prompt}
                </p>
                <div className="flex flex-wrap items-center gap-[0.5cqw]">
                  {q.options.map((o) => {
                    const right = done && o.id === q.solutionId;
                    return (
                      <span key={o.id} className={clsx("rounded-[0.5cqw] border-[0.12cqw] px-[0.7cqw] py-[0.2cqw] text-[1.15cqw] font-bold", right ? "border-(--tg-gold) bg-(--tg-gold) text-(--tg-ink)" : done ? "border-(--tg-cream)/10 text-(--tg-cream)/40" : "border-(--tg-cream)/15 bg-(--tg-cream)/[0.05]")}>
                        {o.text}
                      </span>
                    );
                  })}
                  {n !== undefined && total > 0 && (
                    <span className="ml-auto text-[1.05cqw] font-extrabold text-(--tg-cream)/70">
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
