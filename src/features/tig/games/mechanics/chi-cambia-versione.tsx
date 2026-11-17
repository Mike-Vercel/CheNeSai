"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { CambiaReveal, CambiaSubmission, CambiaView } from "@/lib/tig/games/mechanics/chi-cambia-versione";
import { useAnswerKeys } from "@/features/shared/keyboard";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useClock, useSubmit } from "../kit/ui";

type P = PlayerGameProps<CambiaView, null, CambiaSubmission, CambiaReveal>;
type T = TvGameProps<CambiaView, CambiaReveal>;

function Evidence({ text, tv = false }: { text: string; tv?: boolean }) {
  return (
    <div className={clsx("tg-pop flex items-start border-2 border-(--tg-teal) bg-(--tg-teal)/12", tv ? "gap-[1cqw] rounded-[1.2cqw] px-[1.4cqw] py-[0.9cqw]" : "gap-3 rounded-2xl px-4 py-3")} role="status">
      <Icon name="eye" className={clsx("shrink-0 text-(--tg-teal-hi)", tv ? "h-[2.6cqw] w-[2.6cqw]" : "h-7 w-7")} />
      <div>
        <p className={clsx("tg-display text-(--tg-teal-hi)", tv ? "text-[1.8cqw]" : "text-xl")}>Nuova prova</p>
        <p className={clsx("font-bold leading-snug", tv ? "text-[1.7cqw]" : "text-base")}>{text}</p>
      </div>
    </div>
  );
}

function Countdown({ secs, tv = false }: { secs: number; tv?: boolean }) {
  return (
    <div className={clsx("flex items-center justify-between border-2 border-dashed border-(--tg-sky)/60 bg-(--tg-sky)/[0.07]", tv ? "gap-[1cqw] rounded-[1.2cqw] px-[1.4cqw] py-[0.8cqw]" : "gap-3 rounded-2xl px-4 py-3")} role="status" aria-live="polite">
      <p className={clsx("font-extrabold leading-snug text-(--tg-sky-pale)", tv ? "text-[1.6cqw]" : "text-base")}>1° giro · memorizzate cosa dice ognuno: tra poco queste frasi spariscono</p>
      <p className={clsx("tg-num shrink-0 text-(--tg-sky)", tv ? "text-[3.4cqw]" : "text-4xl")}>{secs}</p>
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const round2 = p.stage !== "play" || (elapsed >= view.round2At && view.second.every((s) => s !== null));
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted) && round2;
  const submit = () => picked && p.canSubmit && round2 && send({ personId: picked });
  useAnswerKeys({ enabled: editable, count: view.people.length, onPick: (i) => setPicked(view.people[i].id), onConfirm: submit });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Evidence text={reveal.evidence} />
        {reveal.people.map((x, i) => {
          const bad = x.id === reveal.personId;
          return (
            <Panel key={x.id} tone={bad ? "red" : undefined} className={clsx("flex flex-col gap-2", !bad && "opacity-85")}>
              <p className="flex items-center gap-2">
                <span className="tg-num grid h-8 w-8 place-items-center rounded-lg bg-(--tg-cream)/10 text-lg">{i + 1}</span>
                <span className="tg-display text-2xl">{x.name}</span>
                {bad && <span className="tg-display ml-auto rounded-md bg-(--tg-red) px-2 py-0.5 text-base">Ha cambiato</span>}
                {sent && picked === x.id && !bad && <span className="ml-auto text-xs font-extrabold uppercase text-(--tg-red-hi)">la vostra scelta</span>}
              </p>
              <p className="text-sm font-semibold leading-snug text-(--tg-cream)/75">
                <b className="text-(--tg-cream)/55">1° giro:</b> {x.first}
              </p>
              <p className="text-sm font-semibold leading-snug">
                <b className="text-(--tg-cream)/55">2° giro:</b> {x.second}
              </p>
              {bad && <p className="rounded-lg bg-(--tg-red)/15 px-2 py-1.5 text-sm font-bold text-(--tg-red-hi)">{reveal.contradiction}</p>}
            </Panel>
          );
        })}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  const secs = Math.max(0, Math.ceil((view.round2At - elapsed) / 1000));
  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked && round2} pending={pending} error={error} onSubmit={submit} label="Ha cambiato versione" hint={round2 ? (picked ? undefined : "Toccate chi ha cambiato la sua versione") : "Si risponde dopo la nuova prova"} />}
    >
      <Panel className="py-3">
        <Eyebrow>Il caso</Eyebrow>
        <p className="tg-display mt-1 text-3xl">{view.caseTitle}</p>
      </Panel>
      {round2 ? view.evidence && <Evidence text={view.evidence} /> : <Countdown secs={secs} />}
      <div className="flex flex-col gap-2" role="group" aria-label={round2 ? "Dichiarazioni del secondo giro" : "Dichiarazioni del primo giro"}>
        {view.people.map((x, i) => {
          const said = round2 ? view.second[i] : view.first[i];
          const on = picked === x.id;
          return (
            <button
              key={x.id}
              type="button"
              disabled={!editable}
              onClick={() => setPicked(x.id)}
              aria-pressed={round2 ? on : undefined}
              className={clsx("flex flex-col gap-1 rounded-2xl border-2 px-3 py-3 text-left transition-transform active:scale-[0.99]", on ? "tg-picked border-(--tg-gold)" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04]", !round2 && "cursor-default")}
            >
              <span className="flex items-baseline gap-2">
                <span className="tg-num grid h-8 w-8 shrink-0 place-items-center self-center rounded-lg bg-(--tg-cream)/10 text-lg">{i + 1}</span>
                <span className="tg-display text-2xl">{x.name}</span>
                <span className="min-w-0 truncate text-xs font-bold text-(--tg-cream)/55">{x.role}</span>
                {on && <Icon name="check" className="ml-auto h-6 w-6 shrink-0 text-(--tg-gold)" />}
              </span>
              <span className="text-base font-semibold leading-snug text-(--tg-cream)/90">«{said ?? "…"}»</span>
            </button>
          );
        })}
      </div>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const done = p.stage === "reveal" && reveal;
  const round2 = p.stage !== "play" || (elapsed >= view.round2At && view.second.every((s) => s !== null));
  const secs = Math.max(0, Math.ceil((view.round2At - elapsed) / 1000));
  const people = done ? reveal.people : null;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Ecco chi ha cambiato versione" : round2 ? "2° giro: chi ha cambiato la sua versione?" : `${view.caseTitle} · 1° giro`}>
      <div className="flex h-full flex-col gap-[1.1cqw]">
        <div className="shrink-0">{round2 ? (done ? <Evidence text={reveal.evidence} tv /> : view.evidence && <Evidence text={view.evidence} tv />) : <Countdown secs={secs} tv />}</div>
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-[1.1cqw]">
          {view.people.map((x, i) => {
            const r = people?.[i];
            const bad = done && x.id === reveal.personId;
            return (
              <TvPanel key={x.id} tone={bad ? "red" : undefined} className={clsx("tg-rise flex min-h-0 flex-col", done ? "gap-[0.3cqw] py-[0.7cqw]" : "gap-[0.5cqw] py-[1cqw]", done && !bad && "opacity-55")}>
                <p className="flex items-baseline gap-[0.8cqw]">
                  <span className={clsx("tg-num grid shrink-0 place-items-center self-center rounded-[0.5cqw] bg-(--tg-cream)/10", done ? "h-[2.2cqw] w-[2.2cqw] text-[1.3cqw]" : "h-[2.6cqw] w-[2.6cqw] text-[1.6cqw]")}>{i + 1}</span>
                  <span className={clsx("tg-display", done ? "text-[1.9cqw]" : "text-[2.4cqw]")}>{x.name}</span>
                  <span className="truncate text-[1.1cqw] font-bold text-(--tg-cream)/55">{x.role}</span>
                  {bad && <span className="tg-display ml-auto rounded-[0.4cqw] bg-(--tg-red) px-[0.6cqw] text-[1.4cqw]">Ha cambiato</span>}
                </p>
                {r ? (
                  <>
                    <p className="text-[1.05cqw] font-semibold leading-snug text-(--tg-cream)/70">
                      <b className="text-(--tg-cream)/50">1°</b> «{r.first}»
                    </p>
                    <p className="text-[1.2cqw] font-bold leading-snug">
                      <b className="text-(--tg-cream)/50">2°</b> «{r.second}»
                    </p>
                  </>
                ) : (
                  <p className="text-[1.65cqw] font-semibold leading-snug">«{(round2 ? view.second[i] : view.first[i]) ?? "…"}»</p>
                )}
              </TvPanel>
            );
          })}
        </div>
        {done && <TvExplain text={reveal.explain} className="shrink-0 py-[0.9cqw]" />}
      </div>
    </TvFrame>
  );
}

export const chiCambiaVersioneUi = defineUi(Player, Tv);
