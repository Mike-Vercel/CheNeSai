"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { UltimaChiamataReveal, UltimaChiamataSubmission, UltimaChiamataView } from "@/lib/tig/games/mechanics/ultima-chiamata";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";
import { secsTo, teamMap, TvTeamTag } from "./m5-kit";

type P = PlayerGameProps<UltimaChiamataView, null, UltimaChiamataSubmission, UltimaChiamataReveal>;
type T = TvGameProps<UltimaChiamataView, UltimaChiamataReveal>;

const isOpen = (c: UltimaChiamataView["calls"][number], elapsed: number, playing: boolean) => !!c.prompt && !!c.options && (!playing || elapsed >= c.opensAtMs);

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [tab, setTab] = useState(0);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const playing = p.stage === "play";
  const done = view.calls.every((c) => !!answers[c.id]);
  const submit = () => done && p.canSubmit && send({ answers });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {reveal.calls.map((c) => (
          <Panel key={c.id} className="flex flex-col gap-2">
            <Eyebrow>
              Chiamata {c.n} · {c.kind}
            </Eyebrow>
            <p className="text-lg font-extrabold leading-snug">{c.prompt}</p>
            <ChoiceList options={c.options} picked={sent && answers[c.id] ? [answers[c.id]] : []} onToggle={() => {}} keys={false} reveal={{ solution: [c.solutionId] }} />
          </Panel>
        ))}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  const call = view.calls[tab];
  const open = isOpen(call, elapsed, playing);
  const next = view.calls.find((c) => !isOpen(c, elapsed, playing));
  const pick = (id: string) => {
    if (!editable) return;
    setAnswers((a) => ({ ...a, [call.id]: id }));
    const after = view.calls.findIndex((c, i) => i > tab && isOpen(c, elapsed, playing) && !answers[c.id]);
    if (after >= 0) window.setTimeout(() => setTab(after), 180);
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
          ready={done}
          pending={pending}
          error={error}
          onSubmit={submit}
          label="Chiudi la raffica"
          hint={!done ? (next ? `Chiamata ${next.n} tra ${secsTo(next.opensAtMs, elapsed)} s: rispondete a tutte e tre, poi inviate` : "Rispondete a tutte e tre le chiamate") : "Conta solo la correttezza: inviare prima vale solo per gli spareggi"}
        />
      }
    >
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Chiamate">
        {view.calls.map((c, i) => {
          const o = isOpen(c, elapsed, playing);
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={i === tab}
              disabled={!o}
              onClick={() => setTab(i)}
              className={clsx(
                "flex h-14 flex-col items-center justify-center rounded-xl border-2 leading-none",
                i === tab ? "border-[#c6ff3d] text-[#c6ff3d]" : "border-white/12 text-white/75",
                answers[c.id] && "bg-[#c6ff3d]/10",
                !o && "border-dashed opacity-60",
              )}
            >
              <span className="tg-display text-xl">Chiamata {c.n}</span>
              <span className="mt-1 text-[11px] font-extrabold uppercase tracking-wide">{o ? (answers[c.id] ? "risposta data" : c.kind) : `tra ${secsTo(c.opensAtMs, elapsed)} s`}</span>
            </button>
          );
        })}
      </div>
      {open && call.prompt && call.options ? (
        <Panel className="tg-rise flex flex-col gap-3" key={call.id}>
          <Eyebrow className="text-[#ffc24a]">
            Chiamata {call.n} · {call.kind}
          </Eyebrow>
          <p className="text-xl font-extrabold leading-snug">{call.prompt}</p>
          <ChoiceList options={call.options} picked={answers[call.id] ? [answers[call.id]] : []} onToggle={pick} disabled={!editable} onConfirm={done ? submit : null} />
        </Panel>
      ) : (
        <Panel className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon name="clock" className="h-12 w-12 text-[#ffc24a]" />
          <p className="tg-display text-4xl">Chiamata {call.n} in arrivo</p>
          <p className="text-base font-bold text-white/75">{call.kind}</p>
          <p className="tg-num text-6xl text-[#c6ff3d]" aria-live="polite">
            {secsTo(call.opensAtMs, elapsed)}
          </p>
        </Panel>
      )}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const playing = p.stage === "play";
  const done = p.stage === "reveal" && reveal;
  const latest = view.calls.filter((c) => isOpen(c, elapsed, playing)).length - 1;

  if (done) {
    const map = teamMap(p.teams);
    const ranking = reveal.summary?.ranking.slice(0, 6) ?? [];
    return (
      <TvFrame view={view} p={p} subtitle={`${view.theme} · ecco le risposte giuste`}>
        <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-[1.2cqw]">
          <div className="grid min-h-0 grid-cols-3 gap-[1.2cqw]">
            {reveal.calls.map((c, i) => (
              <TvPanel key={c.id} className="tg-rise flex min-h-0 flex-col gap-[0.6cqw]">
                <p className="text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-[#ffc24a]" style={{ animationDelay: `${i * 120}ms` }}>
                  Chiamata {c.n} · {c.kind}
                </p>
                <p className="text-[1.55cqw] font-extrabold leading-tight">{c.prompt}</p>
                <div className="mt-auto flex flex-col gap-[0.45cqw]">
                  {c.options.map((o, k) => (
                    <TvOption key={o.id} index={k} text={o.text} size="sm" state={o.id === c.solutionId ? "right" : "dim"} />
                  ))}
                </div>
              </TvPanel>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_1.2fr] gap-[1.2cqw]">
            <TvPanel className="flex flex-col gap-[0.5cqw] p-[1.2cqw]">
              <p className="text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-[#c6ff3d]">Ordine d&apos;arrivo · spareggio</p>
              <ol className="grid grid-cols-2 gap-x-[1cqw] gap-y-[0.35cqw]">
                {ranking.map((r, i) => (
                  <li key={r.teamId} className="flex min-w-0 items-center gap-[0.5cqw]">
                    <span className="tg-num w-[1.6cqw] text-[1.3cqw] text-white/60">{i + 1}</span>
                    <TvTeamTag team={map.get(r.teamId)} className="min-w-0 flex-1" />
                    <span className="tg-num shrink-0 text-[1.3cqw] text-[#c6ff3d]">{r.right}/3</span>
                  </li>
                ))}
              </ol>
            </TvPanel>
            <TvExplain text={reveal.explain} />
          </div>
        </div>
      </TvFrame>
    );
  }

  return (
    <TvFrame view={view} p={p} subtitle={`${view.theme} · una chiamata ogni 15 secondi, si invia tutto insieme`}>
      <div className="grid h-full grid-cols-3 gap-[1.2cqw]">
        {view.calls.map((c, i) => {
          const o = isOpen(c, elapsed, playing);
          return (
            <TvPanel key={c.id} tone={o && i === latest && playing ? "lime" : undefined} className={clsx("flex min-h-0 flex-col gap-[0.7cqw]", o && "tg-rise")}>
              <p className="text-[1.05cqw] font-extrabold uppercase tracking-[0.2em] text-[#ffc24a]">
                Chiamata {c.n} · {c.kind}
              </p>
              {o && c.prompt && c.options ? (
                <>
                  <p className="text-[1.75cqw] font-extrabold leading-tight">{c.prompt}</p>
                  <div className="mt-auto flex flex-col gap-[0.45cqw]">
                    {c.options.map((x, k) => (
                      <TvOption key={x.id} index={k} text={x.text} size="sm" />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-[0.6cqw] text-center">
                  <Icon name="lock" className="h-[4.5cqw] w-[4.5cqw] text-white/50" />
                  <p className="tg-display text-[2.6cqw] text-white/80">In arrivo</p>
                  <p className="tg-num text-[4.6cqw] leading-none text-[#c6ff3d]">{secsTo(c.opensAtMs, elapsed)}</p>
                </div>
              )}
            </TvPanel>
          );
        })}
      </div>
    </TvFrame>
  );
}

export const ultimaChiamataUi = defineUi(Player, Tv);
