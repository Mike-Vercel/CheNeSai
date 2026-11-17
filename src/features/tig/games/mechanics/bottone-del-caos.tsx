"use client";

import { clsx } from "clsx";
import { useId, useState } from "react";
import type { CaosReveal, CaosSubmission, CaosView } from "@/lib/tig/games/mechanics/bottone-del-caos";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { PhoneChip, Step, TablePicker, TvChip } from "./m2/kit";

type P = PlayerGameProps<CaosView, null, CaosSubmission, CaosReveal>;
type T = TvGameProps<CaosView, CaosReveal>;

/** Il Bottone del Caos disegnato: pulsante rosso su base a strisce. */
function CaosButton({ className, pressed = false }: { className?: string; pressed?: boolean }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 90" className={className} role="img" aria-label="Bottone del Caos">
      <defs>
        <pattern id={`${uid}-s`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="12" fill="var(--tg-gold)" />
          <rect x="6" width="6" height="12" fill="var(--tg-ink)" />
        </pattern>
        <radialGradient id={`${uid}-l`} cx="40%" cy="30%" r="70%">
          <stop offset="0" stopColor="var(--tg-red-hi)" />
          <stop offset="1" stopColor="var(--tg-red)" />
        </radialGradient>
      </defs>
      <rect x="8" y="58" width="104" height="24" rx="6" fill={`url(#${uid}-s)`} stroke="var(--tg-ink)" strokeWidth="3" />
      <rect x="26" y={pressed ? 48 : 40} width="68" height="20" rx="6" fill="var(--tg-red-deep)" />
      <ellipse cx="60" cy={pressed ? 48 : 40} rx="34" ry="14" fill={`url(#${uid}-l)`} stroke="var(--tg-red-ink)" strokeWidth="2" />
      <ellipse cx="50" cy={pressed ? 44 : 36} rx="12" ry="4" fill="#fff" fillOpacity="0.35" />
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
  const many = (s?.duels.length ?? 0) > 6;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Più risposte giuste vince; a pari merito il più rapido. Chi perde: nessun malus" : `Allarme Caos! Tre domande uguali per tutti, duello vinto +${view.prize}`}>
      <div className="flex h-full min-h-0 flex-col gap-[1.2cqw]">
        <div className="grid grid-cols-3 gap-[1.2cqw]">
          {view.raffica.map((q, i) => {
            const sol = done ? reveal.raffica[i].solutionId : null;
            return (
              <TvPanel key={i} className="tg-rise flex flex-col gap-[0.6cqw]" tone={i === 1 ? "red" : undefined}>
                <p className="tg-num text-[2.4cqw] leading-none text-(--tg-red-hi)">{i + 1}</p>
                <p className="text-[1.6cqw] font-extrabold leading-tight">{q.prompt}</p>
                <div className="flex flex-col gap-[0.4cqw]">
                  {q.options.map((o, j) => (
                    <TvOption key={o.id} size="sm" index={j} text={o.text} state={sol ? (o.id === sol ? "right" : "dim") : "idle"} />
                  ))}
                </div>
              </TvPanel>
            );
          })}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[1.4fr_1fr] gap-[1.2cqw]">
          <TvPanel tone="red" className="flex min-h-0 flex-col gap-[0.5cqw] overflow-hidden">
            <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-red-hi)">Duelli del Caos</p>
            {s ? (
              <div className={clsx("grid min-h-0 gap-[0.35cqw] overflow-hidden", many ? "grid-cols-2" : "grid-cols-1")}>
                {s.duels.length === 0 && <p className="text-[1.5cqw] font-bold text-(--tg-cream)/60">Nessun duello.</p>}
                {s.duels.map((d, i) => (
                  <div key={`${d.a}${d.b}`} className="tg-rise flex items-center gap-[0.5cqw] rounded-[0.7cqw] bg-(--tg-cream)/[0.05] px-[0.6cqw] py-[0.3cqw]" style={{ animationDelay: `${i * 90}ms` }}>
                    <TvChip teams={p.teams} id={d.a} size={many ? 2 : 2.5} />
                    <span className="tg-num text-[1.4cqw] text-(--tg-cream)/80">
                      {s.hits[d.a] ?? 0}–{s.hits[d.b] ?? 0}
                    </span>
                    <TvChip teams={p.teams} id={d.b} size={many ? 2 : 2.5} />
                    <span className={clsx("ml-auto text-right font-extrabold", many ? "text-[1cqw]" : "text-[1.3cqw]")}>
                      {d.winner ? <span className="text-(--tg-gold)">vince il {p.teams.find((t) => t.teamId === d.winner)?.tableNo} · +{view.prize}</span> : <span className="text-(--tg-cream)/55">pari</span>}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center gap-[1.6cqw]">
                <CaosButton className="tg-pulse h-[10cqw] w-[13cqw] shrink-0" />
                <p className="text-[1.6cqw] font-bold leading-snug text-(--tg-cream)/85">Ogni tavolo preme il bottone contro un rivale: chi contro chi si scopre al reveal.</p>
              </div>
            )}
          </TvPanel>
          {done ? (
            <TvExplain text={reveal.explain} />
          ) : (
            <TvPanel className="flex flex-col items-center justify-center gap-[0.4cqw] text-center">
              <Icon name="bolt" className="h-[3.6cqw] w-[3.6cqw] text-(--tg-gold)" />
              <p className="tg-num text-[5cqw] leading-none text-(--tg-gold)">+{view.prize}</p>
              <p className="tg-display text-[1.8cqw]">a duello vinto · nessun malus</p>
            </TvPanel>
          )}
        </div>
      </div>
    </TvFrame>
  );
}

export const bottoneDelCaosUi = defineUi(Player, Tv);
