"use client";

import { clsx } from "clsx";
import { useId, useState } from "react";
import type { PattoMemberView, PattoReveal, PattoSubmission, PattoView } from "@/lib/tig/games/mechanics/il-patto-di-60-secondi";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { DigitPad } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { PhoneChip, Step, TvChip, tvCompact, TvLabel, TvWhy } from "./m2/kit";

type P = PlayerGameProps<PattoView, PattoMemberView, PattoSubmission, PattoReveal>;
type T = TvGameProps<PattoView, PattoReveal>;

/** Forziere col lucchetto d'ottone, disegnato in codice: chiuso durante la prova, aperto (con l'oro) se un patto apre. */
function Chest({ open, className }: { open: boolean; className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 140 120" className={className} role="img" aria-label={open ? "Forziere aperto" : "Forziere chiuso col lucchetto"}>
      <defs>
        <linearGradient id={`${uid}-w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a5030" />
          <stop offset="1" stopColor="#3b2414" />
        </linearGradient>
        <radialGradient id={`${uid}-g`} cx="0.5" cy="0.55" r="0.6">
          <stop offset="0" stopColor="#fff1b8" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#ffd56b" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd56b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="70" cy="112" rx="58" ry="6" fill="#000" opacity="0.35" />
      {open && (
        // coperchio aperto, ribaltato all'indietro: se ne vede l'interno scuro dietro alle monete (tutto dentro il disegno)
        <g className="tg-rise">
          <path d="M18 58V32Q18 8 70 8Q122 8 122 32V58Z" fill="#2a190d" stroke="#1b1410" strokeWidth="2.2" />
          <path d="M31 58V17M109 58V17" stroke="#c9a24a" strokeWidth="5" opacity="0.75" />
          <path d="M18 32Q18 8 70 8Q122 8 122 32" fill="none" stroke="#c9a24a" strokeWidth="4" />
        </g>
      )}
      {open && <ellipse cx="70" cy="52" rx="62" ry="40" fill={`url(#${uid}-g)`} />}
      {open && (
        <g>
          {[
            [44, 58],
            [58, 52],
            [72, 55],
            [86, 50],
            [98, 57],
            [64, 46],
            [80, 44],
          ].map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y} rx="8" ry="5" fill="#e2a12a" stroke="#8a5514" strokeWidth="1.2" />
              <ellipse cx={x} cy={y - 1} rx="5" ry="2.6" fill="#ffd56b" />
            </g>
          ))}
        </g>
      )}
      <rect x="14" y="58" width="112" height="52" rx="6" fill={`url(#${uid}-w)`} stroke="#1b1410" strokeWidth="2.2" />
      <path d="M14 74H126" stroke="#c9a24a" strokeWidth="5" />
      <rect x="28" y="58" width="9" height="52" fill="#c9a24a" />
      <rect x="103" y="58" width="9" height="52" fill="#c9a24a" />
      {[34, 108].map((x) => [64, 84, 102].map((y) => <circle key={`${x}-${y}`} cx={x - 1.5} cy={y} r="1.6" fill="#6b4210" />))}
      {!open && (
        <g>
          <path d="M14 58V46Q14 22 70 22Q126 22 126 46V58Z" fill={`url(#${uid}-w)`} stroke="#1b1410" strokeWidth="2.2" />
          <path d="M28.5 58V31Q30 28 37 26V58Z" fill="#c9a24a" />
          <path d="M103 58V26Q110 28 111.5 31V58Z" fill="#c9a24a" />
          <path d="M14 52H126" stroke="#c9a24a" strokeWidth="4" />
        </g>
      )}
      <g transform={open ? "translate(0 6)" : undefined}>
        <path d={open ? "M63 66V58a7 7 0 0 1 14 0" : "M63 66V56a7 7 0 0 1 14 0v10"} fill="none" stroke="#c9a24a" strokeWidth="4" strokeLinecap="round" />
        <rect x="58" y="64" width="24" height="20" rx="4" fill="#d9b25a" stroke="#6b4210" strokeWidth="2" />
        <circle cx="70" cy="72" r="2.6" fill="#3b2414" />
        <path d="M70 73.5V79" stroke="#3b2414" strokeWidth="2.4" strokeLinecap="round" />
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
          {/* il codice digitato si confronta solo se è ancora in memoria; dopo un ricaricamento si mostra il codice giusto, neutro */}
          <DigitPad value={sent ? digits : reveal.codeDigits} length={view.codeLength} onChange={() => {}} disabled reveal={sent ? reveal.codeDigits : null} />
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
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Apri il lucchetto" hint={!ready ? `Servono tutte le ${view.codeLength} cifre${partners.length > 1 ? ": anche quelle degli altri tavoli" : partners.length ? ": anche quelle dell'altro tavolo" : ""}` : undefined} />}
    >
      <Panel tone="lime" className="flex items-center gap-3">
        <Icon name="handshake" className="h-9 w-9 shrink-0 text-(--tg-gold)" />
        <div className="min-w-0">
          <p className="tg-title text-[1.7rem] leading-none text-(--tg-gold-hi)">{view.theme}</p>
          {partners.length ? (
            <>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-base font-extrabold">
                {partners.length > 1 ? "In patto coi tavoli" : "In patto col tavolo"} {partners.map((t) => <PhoneChip key={t.teamId} tableNo={t.tableNo} tone="lime" />)}
              </p>
              <p className="mt-1 text-sm font-bold text-(--tg-cream)/85">Andate a parlarvi: le altre cifre le hanno loro.</p>
            </>
          ) : (
            <p className="mt-1 text-base font-extrabold">Siete soli: tutti gli indizi sono vostri.</p>
          )}
        </div>
      </Panel>
      <Step n={1} title="I vostri indizi" icon="eye" done={false}>
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
  const compact = tvCompact(p.teams);
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Patto rispettato: tutti i tavoli del patto con il codice giusto" : "Ogni tavolo ha solo una parte degli indizi: alzatevi e parlate col tavolo del patto"}>
      <div className="grid h-full grid-cols-[1fr_1.15fr] gap-[1.6cqw]">
        <TvPanel tone={done && anyOpen ? "lime" : undefined} className={clsx("flex min-h-0 flex-col items-center", compact ? "gap-[0.6cqw] py-[1.2cqw]" : "gap-[0.9cqw]")}>
          <p className={clsx("tg-title shrink-0 text-center leading-none text-(--tg-gold-hi)", compact ? "text-[2.3cqw]" : "text-[2.8cqw]")}>{view.theme}</p>
          <Chest open={!!done && anyOpen} className={clsx("min-h-0 shrink", compact ? "h-[9cqw] w-[10.5cqw]" : "h-[13cqw] w-[15cqw]")} />
          <div className="flex shrink-0 gap-[0.6cqw]" aria-label={done ? `Codice ${reveal.codeDigits.split("").join(" ")}` : "Codice nascosto"}>
            {Array.from({ length: view.codeLength }, (_, i) => (
              <span
                key={i}
                className={clsx(
                  "tg-num grid place-items-center rounded-[0.6cqw] border-[0.2cqw] leading-none",
                  compact ? "h-[4cqw] w-[3.1cqw] text-[2.7cqw]" : "h-[5cqw] w-[3.8cqw] text-[3.4cqw]",
                  done ? "tg-pop border-(--tg-gold) bg-(--tg-gold)/12 text-(--tg-gold-hi)" : "border-(--tg-brass)/45 bg-(--tg-night)/60 text-(--tg-cream)/35",
                )}
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {done ? reveal.codeDigits[i] : "?"}
              </span>
            ))}
          </div>
          {done ? <TvWhy text={reveal.explain} compact={compact} className="mt-auto w-full" /> : <p className={clsx("mt-auto text-center font-bold text-(--tg-cream)/80", compact ? "text-[1.2cqw]" : "text-[1.4cqw]")}>Gli indizi sono solo sui telefoni: qui non si vedono.</p>}
        </TvPanel>
        <TvPanel className={clsx("flex min-h-0 flex-col overflow-hidden", compact ? "gap-[0.5cqw] py-[1.2cqw]" : "gap-[0.7cqw]")}>
          <TvLabel className="text-(--tg-gold)" icon={<Icon name="handshake" className="h-[1.6cqw] w-[1.6cqw]" />}>
            I patti · tutti giusti +{view.points.full} a testa
          </TvLabel>
          <div className="grid min-h-0 grid-cols-1 content-start gap-[0.5cqw]">
            {view.pacts.map((g, i) => {
              const r = groups.find((x) => x.teams.includes(g[0].teamId));
              const full = r ? r.correct.length === r.teams.length : false;
              return (
                <div key={g[0].teamId} className={clsx("tg-rise flex items-center gap-[0.6cqw] rounded-[0.8cqw] px-[0.8cqw]", compact ? "py-[0.35cqw]" : "py-[0.5cqw]", full ? "bg-(--tg-gold)/15 ring-[0.12cqw] ring-(--tg-gold)/55" : "bg-(--tg-cream)/[0.06]")} style={{ animationDelay: `${i * 70}ms` }}>
                  {g.map((t, k) => (
                    <span key={t.teamId} className="flex items-center gap-[0.6cqw]">
                      {k > 0 && <Icon name="handshake" className="h-[1.5cqw] w-[1.5cqw] text-(--tg-gold)" />}
                      <TvChip teams={p.teams} id={t.teamId} size={compact ? 2.6 : 3} />
                    </span>
                  ))}
                  <span className={clsx("tg-num ml-auto text-right", compact ? "text-[1.25cqw]" : "text-[1.45cqw]")}>
                    {r ? full ? <span className="text-(--tg-gold-hi)">aperto</span> : r.correct.length ? <span className="text-(--tg-teal-hi)">patto a metà</span> : <span className="text-(--tg-cream)/55">resta chiuso</span> : <span className="text-(--tg-cream)/55">al lavoro</span>}
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
