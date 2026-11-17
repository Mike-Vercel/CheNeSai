"use client";

import "./m1/m1.css";
import { clsx } from "clsx";
import { useEffect, useRef, useState } from "react";
import type { OptionSubmission } from "@/lib/tig/games/mechanics/m1/common";
import type { SynthEvent } from "@/lib/tig/games/mechanics/m1/synth";
import type { RumoreReveal, RumoreView } from "@/lib/tig/games/mechanics/rumore-di-fondo";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Eyebrow, Explain, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";
import { audioReady, playMix } from "./m1/synth-player";

type P = PlayerGameProps<RumoreView, null, OptionSubmission, RumoreReveal>;
type T = TvGameProps<RumoreView, RumoreReveal>;

const MIX_MS = 6000;

/** Altoparlante disegnato: onde concentriche e barre dell'equalizzatore (solo decorazione, nessun indizio). */
function Speaker({ on, tv = false }: { on: boolean; tv?: boolean }) {
  return (
    <div className={clsx("relative grid place-items-center", tv ? "h-[16cqw] w-[16cqw]" : "h-28 w-28")} aria-hidden>
      {on && [0, 0.6, 1.2].map((d) => <span key={d} className="tg1-ring absolute inset-0 rounded-full border-2 border-(--tg-gold)" style={{ animationDelay: `${d}s` }} />)}
      <div className={clsx("relative grid h-[70%] w-[70%] place-items-center rounded-full border-2", on ? "border-(--tg-gold) bg-(--tg-gold)/10" : "border-(--tg-cream)/20 bg-(--tg-cream)/[0.04]")}>
        <div className={clsx("flex h-[45%] items-end", tv ? "gap-[0.35cqw]" : "gap-1", on && "tg1-eq")}>
          {[0.5, 0.9, 0.65, 1, 0.75, 0.55, 0.85].map((h, i) => (
            <span
              key={i}
              className={clsx("block rounded-full", tv ? "w-[0.55cqw]" : "w-1.5", on ? "bg-(--tg-gold)" : "bg-(--tg-cream)/30")}
              style={{ height: `${h * 100}%`, animationDelay: `${i * 0.11}s`, animationDuration: `${0.5 + (i % 3) * 0.17}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Pulsante «ascolta» del telefono (gesto: sblocca l'audio e suona). */
function ListenButton({ events, label, small = false }: { events: readonly SynthEvent[]; label: string; small?: boolean }) {
  const [state, setState] = useState<"idle" | "on" | "blocked">("idle");
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);
  const play = async () => {
    stopRef.current?.();
    const stop = await playMix(events);
    if (!stop) return setState("blocked");
    stopRef.current = stop;
    setState("on");
    const dur = events.reduce((m, e) => Math.max(m, e[1] + e[2]), 0);
    window.setTimeout(() => setState((s) => (s === "on" ? "idle" : s)), dur * 1000 + 200);
  };
  return (
    <button
      type="button"
      onClick={() => void play()}
      className={clsx(
        "flex items-center justify-center gap-2 rounded-2xl border-2 font-extrabold transition-transform active:scale-[0.98]",
        small ? "h-10 px-3 text-sm" : "tg-display h-14 w-full text-2xl",
        state === "on" ? "border-(--tg-gold) bg-(--tg-gold)/15 text-(--tg-gold)" : "border-(--tg-cream)/15 bg-(--tg-cream)/[0.05] text-(--tg-cream)",
      )}
    >
      <svg viewBox="0 0 24 24" className={small ? "h-5 w-5" : "h-7 w-7"} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9h4l5-4v14l-5-4H4z" />
        {state === "on" ? <path d="M17 8a5 5 0 0 1 0 8M19.5 5.5a9 9 0 0 1 0 13" /> : <path d="M17 9.5a3 3 0 0 1 0 5" />}
      </svg>
      {state === "on" ? "In ascolto…" : state === "blocked" ? "Audio bloccato: tocca ancora" : label}
    </button>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const [textual, setTextual] = useState(false);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const submit = () => picked && p.canSubmit && send({ optionId: picked });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-snug">{reveal.prompt}</p>
          <ul className="flex flex-col gap-2">
            {reveal.options.map((o) => {
              const right = o.id === reveal.solutionId;
              return (
                <li key={o.id} className={clsx("flex items-center gap-3 rounded-2xl border-2 px-3 py-2", right ? "border-(--tg-gold) bg-(--tg-gold)/10" : "border-(--tg-cream)/12")}>
                  <div className="min-w-0 flex-1">
                    <p className={clsx("font-extrabold leading-tight", right && "text-(--tg-gold)")}>
                      {o.text}
                      {right && <Icon name="check" className="ml-1 inline h-5 w-5" />}
                      {sent && picked === o.id && !right && <span className="ml-2 text-sm text-(--tg-red-hi)">(la vostra)</span>}
                    </p>
                    <p className="text-xs font-bold uppercase tracking-wide text-(--tg-cream)/55">{o.present ? (o.loud ? "c'era · il più forte" : "c'era") : "non c'era"}</p>
                  </div>
                  <ListenButton events={o.solo} label="Senti" small />
                </li>
              );
            })}
          </ul>
        </Panel>
        <ListenButton events={view.mix.ev} label="Riascolta il missaggio" />
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="Invia la risposta" />}
    >
      <Panel className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Speaker on={false} />
          <div className="min-w-0">
            <Eyebrow className="text-(--tg-gold)">{view.mode === "dominante" ? "Il più forte" : "L'estraneo"}</Eyebrow>
            <p className="text-sm font-bold leading-snug text-(--tg-cream)/80">La TV lo fa sentire due volte. Potete riascoltarlo qui quante volte volete.</p>
          </div>
        </div>
        <ListenButton events={view.mix.ev} label="Ascolta dal telefono" />
        <button type="button" onClick={() => setTextual((v) => !v)} aria-expanded={textual} className="self-start text-sm font-extrabold text-(--tg-sky) underline underline-offset-4">
          {textual ? "Nascondi la versione testuale" : "Versione testuale (senza audio)"}
        </button>
        {textual && (
          <ul className="flex flex-col gap-1.5 rounded-xl bg-(--tg-cream)/[0.04] p-3" aria-label="Descrizione dei tre suoni">
            {view.descriptions.map((d, i) => (
              <li key={i} className="flex gap-2 text-sm font-semibold leading-snug">
                <span className="tg-num text-(--tg-gold)">{i + 1}</span> {d}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel className="flex flex-col gap-3">
        <p className="text-xl font-extrabold leading-snug">{view.prompt}</p>
        <ChoiceList label="Suoni" options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [ready, setReady] = useState(() => audioReady());
  const stops = useRef<(() => void)[]>([]);
  const played = useRef<Set<number>>(new Set());
  const { plays, mix, durationMs } = view;
  const { now, deadlineAt } = p;
  const play = p.stage === "play";

  // la TV suona il missaggio agli orari previsti (una volta ciascuno), sul bus degli effetti
  useEffect(() => {
    if (!play) return;
    const base = elapsedOf(durationMs, deadlineAt, now());
    const timers = plays.map((at, i) => {
      if (played.current.has(i) || base > at + 1500) return 0;
      return window.setTimeout(() => {
        played.current.add(i);
        void playMix(mix.ev).then((stop) => {
          if (stop) stops.current.push(stop);
          else setReady(false);
        });
      }, Math.max(0, at - base));
    });
    return () => timers.forEach((id) => id && window.clearTimeout(id));
  }, [play, plays, mix, now, deadlineAt, durationMs]);
  useEffect(
    () => () => {
      stops.current.forEach((s) => s());
      stops.current = [];
    },
    [],
  );

  const listening = play && plays.some((at) => elapsed >= at && elapsed < at + MIX_MS);
  const which = plays.findIndex((at) => elapsed >= at && elapsed < at + MIX_MS);
  const done = p.stage === "reveal" && reveal;
  const byId = done ? new Map(reveal.options.map((o) => [o.id, o])) : null;

  return (
    <TvFrame view={view} p={p} subtitle={view.prompt}>
      <div className="grid h-full grid-cols-[0.8fr_1.2fr] gap-[2cqw]">
        <div className="flex min-h-0 flex-col items-center justify-center gap-[1.4cqw]">
          <Speaker on={listening} tv />
          <p className="tg-display text-center text-[2.6cqw] leading-none">
            {done ? "Ecco i suoni" : listening ? `Ascolto ${which + 1} di ${plays.length}` : elapsed < plays[0] ? "Silenzio in sala…" : "Riascoltate dal telefono"}
          </p>
          {!ready && play && (
            <button type="button" onClick={() => void playMix(mix.ev).then((s) => s && (stops.current.push(s), setReady(true)))} className="tg-pulse rounded-[1cqw] border-2 border-(--tg-teal) px-[1.4cqw] py-[0.6cqw] text-[1.4cqw] font-extrabold text-(--tg-teal-hi)">
              Audio bloccato: tocca per far partire i suoni
            </button>
          )}
          {done && <TvExplain text={reveal.explain} />}
        </div>
        <TvPanel className="flex flex-col justify-center gap-[0.9cqw]">
          <p className="text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-gold)">{view.mode === "dominante" ? "Il suono più forte" : "Il suono che non c'entra"}</p>
          {view.options.map((o, i) => {
            const r = byId?.get(o.id);
            return (
              <TvOption
                key={o.id}
                index={i}
                text={o.text}
                state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"}
                note={r ? <span className="shrink-0 text-[1.1cqw] font-extrabold uppercase tracking-wide">{r.present ? (r.loud ? "il più forte" : "c'era") : "non c'era"}</span> : undefined}
              />
            );
          })}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const rumoreDiFondoUi = defineUi(Player, Tv);
