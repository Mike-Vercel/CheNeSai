"use client";

import { clsx } from "clsx";
import { useId, useState } from "react";
import type { CaosReveal, CaosSubmission, CaosView } from "@/lib/tig/games/mechanics/bottone-del-caos";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { ChoiceList } from "../kit/inputs";
import { Doubloon, SkullMark } from "../kit/ornaments";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { PhoneChip, Step, TablePicker, TvAnswers, TvChip, tvCompact, TvLabel, TvWhy } from "./m2/kit";

type P = PlayerGameProps<CaosView, null, CaosSubmission, CaosReveal>;
type T = TvGameProps<CaosView, CaosReveal>;

/** Il Bottone del Caos disegnato: cupola rossa col teschio simpatico su una base di legno con le borchie d'ottone. */
function CaosButton({ className, pressed = false }: { className?: string; pressed?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const y = pressed ? 47 : 39;
  return (
    <svg viewBox="0 0 120 90" className={className} role="img" aria-label="Bottone del Caos">
      <defs>
        <linearGradient id={`${uid}-w`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a5030" />
          <stop offset="1" stopColor="#3b2414" />
        </linearGradient>
        <radialGradient id={`${uid}-l`} cx="40%" cy="30%" r="70%">
          <stop offset="0" stopColor="#ff9a8c" />
          <stop offset="0.45" stopColor="var(--tg-red)" />
          <stop offset="1" stopColor="var(--tg-red-deep)" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="84" rx="54" ry="5" fill="#000" opacity="0.4" />
      <rect x="8" y="58" width="104" height="24" rx="6" fill={`url(#${uid}-w)`} stroke="#c9a24a" strokeWidth="2.5" />
      {[18, 40, 80, 102].map((x) => (
        <circle key={x} cx={x} cy="70" r="2.4" fill="#ffd56b" stroke="#6b4210" strokeWidth="0.8" />
      ))}
      <rect x="26" y={y} width="68" height="20" rx="6" fill="var(--tg-red-deep)" />
      <ellipse cx="60" cy={y} rx="34" ry="14" fill={`url(#${uid}-l)`} stroke="var(--tg-red-ink)" strokeWidth="2" />
      <ellipse cx="49" cy={y - 5} rx="11" ry="3.5" fill="#fff" fillOpacity="0.3" />
      <g transform={`translate(60 ${y - 1})`}>
        <path d="M-6.5 0a6.5 6 0 0 1 13 0c0 2.2-1.1 3.6-2.4 4.3v2.2h-8.2V4.3C-5.4 3.6-6.5 2.2-6.5 0Z" fill="#f6ead2" opacity="0.92" />
        <circle cx="-2.4" cy="0.2" r="1.6" fill="var(--tg-red-ink)" />
        <circle cx="2.4" cy="0.2" r="1.6" fill="var(--tg-red-ink)" />
      </g>
    </svg>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const rivals = view.targets.filter((x) => x.teamId !== p.myTeam.teamId);
  const [target, setTarget] = useState<string | null>(rivals.length === 1 ? rivals[0].teamId : null);
  const [ans, setAns] = useState<(string | null)[]>(() => view.raffica.map(() => null));
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const done = ans.filter(Boolean).length;
  const ready = !!target && done === view.raffica.length;
  const submit = () => ready && p.canSubmit && send({ targetId: target!, raffica: ans as string[] });
  const nextOpen = ans.findIndex((a) => !a);
  const table = new Map(view.targets.map((x) => [x.teamId, x.tableNo]));

  if (p.stage === "reveal" && reveal) {
    const mine = reveal.summary?.duels.filter((d) => d.a === p.myTeam.teamId || d.b === p.myTeam.teamId) ?? [];
    const hits = reveal.summary?.hits ?? {};
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <Eyebrow>I vostri duelli</Eyebrow>
          {mine.length === 0 && <p className="text-base font-extrabold text-(--tg-cream)/70">Nessun duello.</p>}
          {mine.map((d) => {
            const other = d.a === p.myTeam.teamId ? d.b : d.a;
            const won = d.winner === p.myTeam.teamId;
            return (
              <p key={`${d.a}${d.b}`} className="flex flex-wrap items-center gap-2 text-base font-extrabold">
                Contro il tavolo <PhoneChip tableNo={table.get(other) ?? 0} tone="red" /> ({hits[p.myTeam.teamId] ?? 0} a {hits[other] ?? 0}):{" "}
                <span className={won ? "text-(--tg-gold)" : d.winner ? "text-(--tg-red-hi)" : "text-(--tg-cream)/60"}>{won ? `vinto +${view.prize}` : d.winner ? "perso, nessun malus" : "pari"}</span>
              </p>
            );
          })}
        </Panel>
        {reveal.raffica.map((q, i) => (
          <Panel key={i} className="flex flex-col gap-2">
            <Eyebrow>Domanda {i + 1}</Eyebrow>
            <p className="text-base font-extrabold leading-snug">{q.prompt}</p>
            <ChoiceList options={view.raffica[i].options} picked={sent && ans[i] ? [ans[i]!] : []} onToggle={() => {}} keys={false} reveal={{ solution: [q.solutionId] }} />
          </Panel>
        ))}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Premi il bottone!" hint={!target ? "Contro chi?" : done < view.raffica.length ? `Raffica: ${done} su ${view.raffica.length}` : undefined} />}
    >
      <Panel tone="red" className="flex items-center gap-3">
        <CaosButton className="h-14 w-20 shrink-0" pressed={p.submitted} />
        <p className="text-base font-extrabold leading-snug">
          Duello identico: vince chi fa più risposte giuste, a pari merito il più rapido. <span className="text-(--tg-gold)">+{view.prize}</span>, chi perde non perde nulla.
        </p>
      </Panel>
      <Step n={1} title="Contro chi premete il bottone?" icon="target" done={!!target} tone="red">
        <TablePicker tables={rivals} value={target} onChange={setTarget} disabled={!editable} label="Tavolo da sfidare" />
      </Step>
      <Step n={2} title="La raffica (uguale per tutti)" icon="bolt" done={done === view.raffica.length}>
        {view.raffica.map((q, i) => (
          <div key={i} className={clsx("flex flex-col gap-2 rounded-2xl border border-(--tg-cream)/10 p-3", ans[i] && "border-(--tg-gold)/40")}>
            <p className="text-base font-extrabold leading-snug">
              <span className="tg-num mr-2 text-(--tg-red-hi)">{i + 1}</span>
              {q.prompt}
            </p>
            <ChoiceList
              options={q.options}
              picked={ans[i] ? [ans[i]!] : []}
              onToggle={(id) => editable && setAns((a) => a.map((x, k) => (k === i ? id : x)))}
              disabled={!editable}
              keys={nextOpen === i}
              onConfirm={nextOpen === -1 ? submit : null}
              label={`Domanda ${i + 1}`}
            />
          </div>
        ))}
      </Step>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  const compact = tvCompact(p.teams);
  const many = (s?.duels.length ?? 0) > 2;
  const three = (s?.duels.length ?? 0) > 6;
  // domande lunghe (o risposte lunghe): risposte compatte, così le tre schede non tagliano niente
  const dense = view.raffica.some((q) => q.prompt.length > (compact ? 70 : 110) || q.options.some((o) => o.text.length > 16));
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Più risposte giuste vince; a pari merito il più rapido. Chi perde: nessun malus" : `Allarme Caos! Tre domande uguali per tutti, duello vinto +${view.prize}`}>
      <div className="flex h-full min-h-0 flex-col gap-[1.1cqw]">
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[1.2cqw]">
          {view.raffica.map((q, i) => {
            const sol = done ? reveal.raffica[i].solutionId : null;
            return (
              <TvPanel key={i} className={clsx("tg-rise flex min-h-0 flex-col", compact ? "gap-[0.4cqw] py-[1.1cqw]" : "gap-[0.6cqw]")} tone={i === 1 ? "red" : undefined}>
                <div className="flex shrink-0 items-start gap-[0.7cqw]">
                  <Doubloon className={compact ? "h-[2.6cqw] w-[2.6cqw] text-[1.3cqw]" : "h-[3cqw] w-[3cqw] text-[1.5cqw]"}>{i + 1}</Doubloon>
                  <p className={clsx("font-extrabold leading-tight", compact ? "text-[1.35cqw]" : "text-[1.6cqw]")}>{q.prompt}</p>
                </div>
                {dense ? (
                  <TvAnswers options={q.options} solutionId={sol} compact={compact} className="mt-auto" />
                ) : (
                  <div className="mt-auto flex flex-col gap-[0.35cqw]">
                    {q.options.map((o, j) => (
                      <TvOption key={o.id} size="sm" index={j} text={o.text} state={sol ? (o.id === sol ? "right" : "dim") : "idle"} />
                    ))}
                  </div>
                )}
              </TvPanel>
            );
          })}
        </div>
        <div className={clsx("grid shrink-0 gap-[1.2cqw]", done ? (three ? "grid-cols-[1.7fr_1fr]" : "grid-cols-[1.25fr_1fr]") : "grid-cols-[1.4fr_1fr]", done && three ? "h-[15cqw]" : compact ? "h-[12.5cqw]" : "h-[14cqw]")}>
          <TvPanel tone="red" className={clsx("flex min-h-0 flex-col overflow-hidden", compact ? "gap-[0.4cqw] py-[1cqw]" : "gap-[0.5cqw] py-[1.3cqw]")}>
            <TvLabel className="text-(--tg-red-hi)" icon={<SkullMark className="h-[1.9cqw] w-[1.9cqw] text-(--tg-cream)" />}>
              Duelli del Caos
            </TvLabel>
            {s ? (
              <div className={clsx("grid min-h-0 content-start gap-[0.3cqw] overflow-hidden", three ? "grid-cols-3" : many ? "grid-cols-2" : "grid-cols-1")}>
                {s.duels.length === 0 && <p className="text-[1.5cqw] font-bold text-(--tg-cream)/70">Nessun duello.</p>}
                {s.duels.map((d, i) => (
                  <div key={`${d.a}${d.b}`} className={clsx("tg-rise flex items-center rounded-[0.7cqw] bg-(--tg-cream)/[0.06]", three ? "gap-[0.35cqw] px-[0.45cqw] py-[0.12cqw]" : many ? "gap-[0.35cqw] px-[0.45cqw] py-[0.2cqw]" : "gap-[0.5cqw] px-[0.6cqw] py-[0.3cqw]")} style={{ animationDelay: `${i * 90}ms` }}>
                    <TvChip teams={p.teams} id={d.a} size={three ? 1.9 : many ? 2.1 : 2.6} />
                    <span className={clsx("tg-num text-(--tg-cream)/85", many ? "text-[1.1cqw]" : "text-[1.4cqw]")}>
                      {s.hits[d.a] ?? 0}–{s.hits[d.b] ?? 0}
                    </span>
                    <TvChip teams={p.teams} id={d.b} size={three ? 1.9 : many ? 2.1 : 2.6} />
                    <span className={clsx("tg-num ml-auto text-right", many ? "text-[1cqw]" : "text-[1.3cqw]")}>
                      {d.winner ? <span className="text-(--tg-gold-hi)">+{view.prize} al {p.teams.find((t) => t.teamId === d.winner)?.tableNo}</span> : <span className="text-(--tg-cream)/55">pari</span>}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 items-center gap-[1.4cqw]">
                <CaosButton className={clsx("tg-pulse shrink-0", compact ? "h-[7cqw] w-[9.5cqw]" : "h-[8.5cqw] w-[11.5cqw]")} />
                <p className={clsx("font-bold leading-snug text-(--tg-cream)/90", compact ? "text-[1.35cqw]" : "text-[1.6cqw]")}>Ogni tavolo preme il bottone contro un rivale: chi contro chi si scopre al reveal.</p>
              </div>
            )}
          </TvPanel>
          {done ? (
            <TvWhy text={reveal.explain} compact={compact} className="h-full" />
          ) : (
            <TvPanel tone="lime" className="flex min-h-0 items-center justify-center gap-[1.2cqw]">
              <Doubloon className={compact ? "h-[6.5cqw] w-[6.5cqw] text-[2.6cqw]" : "h-[7.5cqw] w-[7.5cqw] text-[3cqw]"}>+{view.prize}</Doubloon>
              <div>
                <p className={clsx("tg-title leading-none text-(--tg-gold-hi)", compact ? "text-[2.2cqw]" : "text-[2.6cqw]")}>a duello vinto</p>
                <p className="mt-[0.4cqw] text-[1.2cqw] font-bold text-(--tg-cream)/80">chi perde non perde nulla</p>
              </div>
            </TvPanel>
          )}
        </div>
      </div>
    </TvFrame>
  );
}

export const bottoneDelCaosUi = defineUi(Player, Tv);
