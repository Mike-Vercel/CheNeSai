"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { CassaReveal, CassaSubmission, CassaView } from "@/lib/tig/games/mechanics/la-cassa-chiusa";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { DigitPad } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";

type P = PlayerGameProps<CassaView, null, CassaSubmission, CassaReveal>;
type T = TvGameProps<CassaView, CassaReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [tab, setTab] = useState(0);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const done = view.locks.every((l) => (codes[l.id] ?? "").length === l.digits);
  const submit = () => done && p.canSubmit && send({ codes });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {reveal.locks.map((l) => {
          const mine = sent ? (codes[l.id] ?? "") : "";
          const ok = mine === l.combination;
          return (
            <Panel key={l.id} tone={sent ? (ok ? "lime" : "red") : undefined} className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <Icon name={sent && !ok ? "lock" : "check"} className={clsx("h-7 w-7 shrink-0", sent && !ok ? "text-(--tg-red-hi)" : "text-(--tg-gold)")} />
                <div className="min-w-0 flex-1">
                  <Eyebrow>
                    Serratura {l.n} · {l.name}
                  </Eyebrow>
                  <p className="tg-num text-4xl leading-none tracking-[0.2em] text-(--tg-gold)">{l.combination}</p>
                </div>
                {sent && !ok && <p className="tg-num text-xl text-(--tg-cream)/60 line-through decoration-2">{mine || "—"}</p>}
              </div>
              <p className="text-sm font-semibold leading-snug text-(--tg-cream)/85">{l.step}</p>
            </Panel>
          );
        })}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  const lock = view.locks[tab];
  const set = (v: string) => {
    if (!editable) return;
    setCodes((c) => ({ ...c, [lock.id]: v }));
    if (v.length === lock.digits && tab < view.locks.length - 1) window.setTimeout(() => setTab((x) => Math.min(x + 1, view.locks.length - 1)), 250);
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
          label="Apri la cassa"
          hint={done ? `+${view.perLock} per serratura, +${view.openBonus} se si apre tutta` : "Inserite le tre combinazioni (anche quelle di cui non siete sicuri)"}
        />
      }
    >
      <Panel className="py-3">
        <Eyebrow>{view.heading}</Eyebrow>
        <p className="mt-1 text-[15px] font-semibold leading-snug text-(--tg-cream)/85">{view.intro}</p>
      </Panel>
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Serrature">
        {view.locks.map((l, i) => {
          const v = codes[l.id] ?? "";
          const full = v.length === l.digits;
          return (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={i === tab}
              onClick={() => setTab(i)}
              className={clsx("flex h-16 flex-col items-center justify-center gap-1 rounded-xl border-2", i === tab ? "border-(--tg-gold) text-(--tg-gold)" : "border-(--tg-cream)/12 text-(--tg-cream)/75", full && "bg-(--tg-gold)/10")}
            >
              <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide">
                <Icon name={full ? "check" : "lock"} className="h-4 w-4" /> Serratura {l.n}
              </span>
              <span className="tg-num text-2xl leading-none tracking-[0.15em]">{v.padEnd(l.digits, "·")}</span>
            </button>
          );
        })}
      </div>
      <Panel className="flex flex-col gap-3" key={lock.id}>
        <div>
          <Eyebrow className="text-(--tg-teal-hi)">
            Serratura {lock.n} · {lock.name}
          </Eyebrow>
          <p className="mt-1 text-lg font-extrabold leading-snug">{lock.clue}</p>
          {tab > 0 && (
            <p className="mt-2 flex flex-wrap gap-2 text-sm font-bold text-(--tg-cream)/70">
              {view.locks.slice(0, tab).map((l) => (
                <span key={l.id} className="rounded-lg bg-(--tg-cream)/10 px-2 py-0.5">
                  Serratura {l.n}: <span className="tg-num text-base text-(--tg-cream)">{codes[l.id] || "?"}</span>
                </span>
              ))}
            </p>
          )}
        </div>
        <DigitPad key={lock.id} value={codes[lock.id] ?? ""} length={lock.digits} onChange={set} disabled={!editable} onEnter={() => (tab < view.locks.length - 1 ? setTab(tab + 1) : submit())} />
      </Panel>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  return (
    <TvFrame view={view} p={p} subtitle={done ? `${view.heading} · ecco le tre combinazioni` : `${view.heading} · indizi a catena: ogni codice serve per il successivo`}>
      <div className={clsx("grid h-full gap-[1.2cqw]", done ? "grid-rows-[minmax(0,1fr)_auto]" : "grid-rows-[auto_minmax(0,1fr)]")}>
        {!done && (
          <TvPanel className="tg-rise px-[1.6cqw] py-[1cqw]">
            <p className="text-[1.5cqw] font-semibold leading-snug text-(--tg-cream)/90">{view.intro}</p>
          </TvPanel>
        )}
        <div className="grid min-h-0 grid-cols-3 gap-[1.2cqw]">
          {view.locks.map((l, i) => {
            const r = done ? reveal.locks.find((x) => x.id === l.id) : null;
            return (
              <TvPanel key={l.id} tone={r ? "lime" : undefined} className="tg-rise flex min-h-0 flex-col gap-[0.8cqw]">
                <div className="flex items-center gap-[0.8cqw]" style={{ animationDelay: `${i * 120}ms` }}>
                  <span className={clsx("grid h-[4.2cqw] w-[4.2cqw] shrink-0 place-items-center rounded-full border-[0.25cqw]", r ? "border-(--tg-gold) text-(--tg-gold)" : "border-(--tg-cream)/30 text-(--tg-cream)/80")}>
                    <Icon name={r ? "check" : "lock"} className="h-[2.2cqw] w-[2.2cqw]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-teal-hi)">Serratura {l.n}</p>
                    <p className="tg-display truncate text-[2.2cqw]">{l.name}</p>
                  </div>
                </div>
                {r ? (
                  <>
                    <p className="tg-num tg-pop text-[5.4cqw] leading-none tracking-[0.25em] text-(--tg-gold)">{r.combination}</p>
                    <p className="text-[1.6cqw] font-semibold leading-snug text-(--tg-cream)/90">{r.step}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[1.6cqw] font-extrabold leading-snug">{l.clue}</p>
                    <div className="mt-auto flex gap-[0.5cqw]">
                      {Array.from({ length: l.digits }, (_, k) => (
                        <span key={k} className="tg-num grid h-[4cqw] w-[3cqw] place-items-center rounded-[0.6cqw] border-[0.18cqw] border-(--tg-cream)/20 text-[2.4cqw] text-(--tg-cream)/30">
                          ?
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </TvPanel>
            );
          })}
        </div>
        {done && <TvExplain text={reveal.explain} />}
      </div>
    </TvFrame>
  );
}

export const laCassaChiusaUi = defineUi(Player, Tv);
