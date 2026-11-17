"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { PattoMemberView, PattoReveal, PattoSubmission, PattoView } from "@/lib/tig/games/mechanics/il-patto-di-60-secondi";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { DigitPad } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { PhoneChip, Step, TvChip } from "./m2/kit";

type P = PlayerGameProps<PattoView, PattoMemberView, PattoSubmission, PattoReveal>;
type T = TvGameProps<PattoView, PattoReveal>;

/** Porta della cassaforte disegnata: maniglia a ruota e quadrante; `open` la socchiude. */
function Vault({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={open ? "Cassaforte aperta" : "Cassaforte chiusa"}>
      <rect x="6" y="6" width="108" height="108" rx="14" fill="var(--tg-night-2)" stroke="var(--tg-cream)" strokeOpacity="0.25" strokeWidth="3" />
      <g style={{ transformOrigin: "16px 60px", transform: open ? "perspective(300px) rotateY(-55deg)" : "none", transition: "transform 900ms cubic-bezier(.2,.9,.2,1)" }}>
        <rect x="16" y="16" width="88" height="88" rx="10" fill="var(--tg-raised)" stroke={open ? "var(--tg-gold)" : "var(--tg-teal-hi)"} strokeWidth="3" />
        <circle cx="60" cy="60" r="24" fill="none" stroke={open ? "var(--tg-gold)" : "var(--tg-teal-hi)"} strokeWidth="4" />
        <circle cx="60" cy="60" r="5" fill={open ? "var(--tg-gold)" : "var(--tg-teal-hi)"} />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <line key={a} x1="60" y1="60" x2={60 + 22 * Math.cos((a * Math.PI) / 180)} y2={60 + 22 * Math.sin((a * Math.PI) / 180)} stroke={open ? "var(--tg-gold)" : "var(--tg-teal-hi)"} strokeWidth="3" strokeLinecap="round" />
        ))}
        <rect x="92" y="50" width="6" height="20" rx="3" fill="var(--tg-cream)" fillOpacity="0.5" />
      </g>
    </svg>
  );
}

function Player(p: P) {
  const { view, reveal, memberView: mv } = p;
  const [digits, setDigits] = useState("");
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = digits.length === view.codeLength;
  const submit = () => ready && p.canSubmit && send({ digits });
  const partners = mv?.partners ?? [];

  if (p.stage === "reveal" && reveal) {
    const g = reveal.summary?.groups.find((x) => x.teams.includes(p.myTeam.teamId));
    const full = g ? g.correct.length === g.teams.length : false;
    const tableNo = (id: string) => view.pacts.flat().find((t) => t.teamId === id)?.tableNo ?? 0;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {g && (
          <Panel tone={full ? "lime" : undefined} className="flex flex-col gap-2">
            <Eyebrow>Il patto</Eyebrow>
            <p className="text-lg font-extrabold">{full ? "Rispettato: cassaforte aperta per tutti" : g.correct.length ? "A metà: non tutti avevano il codice giusto" : "Rotto: nessun codice giusto"}</p>
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-(--tg-cream)/75">
              {g.teams.map((id) => (
                <PhoneChip key={id} tableNo={tableNo(id)} tone={g.correct.includes(id) ? "lime" : "ice"} />
              ))}
            </p>
          </Panel>
        )}
        <Panel className="flex flex-col gap-3">
          <Eyebrow>Il codice</Eyebrow>
          <DigitPad value={sent ? digits : ""} length={view.codeLength} onChange={() => {}} disabled reveal={reveal.codeDigits} />
          <ol className="flex flex-col gap-1.5">
            {reveal.clues.map((c) => (
              <li key={c.pos} className="flex items-start gap-3 text-sm font-semibold text-(--tg-cream)/85">
                <span className="tg-num grid h-7 w-7 shrink-0 place-items-center rounded-md bg-(--tg-gold) text-lg text-(--tg-ink)">{c.digit}</span>
                {c.text}
              </li>
            ))}
          </ol>
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Apri la cassaforte" hint={!ready ? `Servono tutte le ${view.codeLength} cifre: anche quelle dell'altro tavolo` : undefined} />}
    >
      <Panel tone="lime" className="flex items-center gap-3">
        <Icon name="handshake" className="h-9 w-9 shrink-0 text-(--tg-gold)" />
        <div className="min-w-0">
          <p className="tg-display text-2xl leading-none">{view.theme}</p>
          {partners.length ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-base font-extrabold">
              In patto col tavolo {partners.map((t) => <PhoneChip key={t.teamId} tableNo={t.tableNo} tone="lime" />)}: andate a parlarvi!
            </p>
          ) : (
            <p className="mt-1 text-base font-extrabold">Siete soli: tutti gli indizi sono vostri.</p>
          )}
        </div>
      </Panel>
      <Step n={1} title="I vostri indizi (gli altri li ha il patto)" icon="eye" done={false}>
        <ol className="flex flex-col gap-2">
          {(mv?.clues ?? []).map((c) => (
            <li key={c.pos} className="flex items-start gap-3 rounded-xl border border-(--tg-cream)/10 bg-(--tg-cream)/[0.04] px-3 py-2.5">
              <span className="tg-num shrink-0 rounded-md bg-(--tg-cream)/10 px-2 py-0.5 text-sm leading-6">cifra {c.pos + 1}</span>
              <span className="text-base font-bold leading-snug">{c.text}</span>
            </li>
          ))}
        </ol>
      </Step>
      <Step n={2} title="Il codice intero" icon="lock" done={ready}>
        <DigitPad value={digits} length={view.codeLength} onChange={setDigits} disabled={!editable} onEnter={submit} />
      </Step>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const groups = done ? (reveal.summary?.groups ?? []) : [];
  const anyOpen = groups.some((g) => g.correct.length === g.teams.length);
  const many = view.pacts.length > 6;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Patto rispettato: tutti i tavoli del patto con il codice giusto" : "Ogni tavolo ha solo una parte degli indizi: alzatevi e parlate col tavolo del patto"}>
      <div className="grid h-full grid-cols-[1fr_1.15fr] gap-[1.6cqw]">
        <TvPanel tone={done && anyOpen ? "lime" : undefined} className="flex min-h-0 flex-col items-center gap-[1cqw]">
          <p className="tg-display text-center text-[2.6cqw] leading-none">{view.theme}</p>
          <Vault open={!!done && anyOpen} className="h-[16cqw] w-[16cqw]" />
          <div className="flex gap-[0.6cqw]" aria-label={done ? `Codice ${reveal.codeDigits.split("").join(" ")}` : "Codice nascosto"}>
            {Array.from({ length: view.codeLength }, (_, i) => (
              <span key={i} className={clsx("tg-num grid h-[5cqw] w-[3.8cqw] place-items-center rounded-[0.6cqw] border-[0.2cqw] text-[3.4cqw]", done ? "tg-pop border-(--tg-gold) text-(--tg-gold)" : "border-(--tg-cream)/20 text-(--tg-cream)/30")} style={{ animationDelay: `${i * 90}ms` }}>
                {done ? reveal.codeDigits[i] : "?"}
              </span>
            ))}
          </div>
          {done ? <TvExplain text={reveal.explain} className="mt-auto w-full" /> : <p className="mt-auto text-center text-[1.4cqw] font-bold text-(--tg-cream)/70">Gli indizi sono solo sui telefoni: qui non si vedono.</p>}
        </TvPanel>
        <TvPanel className="flex min-h-0 flex-col gap-[0.6cqw] overflow-hidden">
          <p className="flex items-center gap-[0.6cqw] text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-gold)">
            <Icon name="handshake" className="h-[1.6cqw] w-[1.6cqw]" /> I patti · tutti giusti +{view.points.full} a testa
          </p>
          <div className={clsx("grid min-h-0 gap-[0.5cqw]", many ? "grid-cols-2" : "grid-cols-1")}>
            {view.pacts.map((g, i) => {
              const r = groups.find((x) => x.teams.includes(g[0].teamId));
              const full = r ? r.correct.length === r.teams.length : false;
              return (
                <div key={g[0].teamId} className={clsx("tg-rise flex items-center gap-[0.6cqw] rounded-[0.8cqw] px-[0.8cqw] py-[0.5cqw]", full ? "bg-(--tg-gold)/15" : "bg-(--tg-cream)/[0.05]")} style={{ animationDelay: `${i * 70}ms` }}>
                  {g.map((t, k) => (
                    <span key={t.teamId} className="flex items-center gap-[0.6cqw]">
                      {k > 0 && <Icon name="handshake" className="h-[1.5cqw] w-[1.5cqw] text-(--tg-gold)" />}
                      <TvChip teams={p.teams} id={t.teamId} size={many ? 2.2 : 2.8} />
                    </span>
                  ))}
                  <span className={clsx("ml-auto text-right font-extrabold", many ? "text-[1.05cqw]" : "text-[1.35cqw]")}>
                    {r ? full ? <span className="text-(--tg-gold)">aperta</span> : r.correct.length ? <span className="text-(--tg-teal-hi)">a metà</span> : <span className="text-(--tg-cream)/55">chiusa</span> : <span className="text-(--tg-cream)/45">al lavoro</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const ilPattoDi60SecondiUi = defineUi(Player, Tv);
