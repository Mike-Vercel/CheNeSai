"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { FurtoReveal, FurtoSubmission, FurtoView } from "@/lib/tig/games/mechanics/furto-con-destrezza";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { Doubloon } from "../kit/ornaments";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { appliedTransfers, PhoneChip, Step, TablePicker, TvAnswers, tvCompact, TvLabel, TvVsRow, TvWhy } from "./m2/kit";

type P = PlayerGameProps<FurtoView, null, FurtoSubmission, FurtoReveal>;
type T = TvGameProps<FurtoView, FurtoReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const rivals = view.targets.filter((x) => x.teamId !== p.myTeam.teamId);
  const [target, setTarget] = useState<string | null>(rivals.length === 1 ? rivals[0].teamId : null);
  const [first, setFirst] = useState<string | null>(null);
  const [second, setSecond] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!target && !!first && !!second;
  const submit = () => ready && p.canSubmit && send({ targetId: target!, first: first!, second: second! });
  const table = new Map(view.targets.map((x) => [x.teamId, x.tableNo]));

  if (p.stage === "reveal" && reveal) {
    const mine = reveal.summary?.heists.find((h) => h.from === p.myTeam.teamId);
    const against = reveal.summary?.heists.filter((h) => h.to === p.myTeam.teamId && h.second) ?? [];
    // bottino davvero applicato dal gioco (dopo scudo e tetti), se l'esito lo riporta
    const loot = mine ? p.myOutcome?.transfers?.find((t) => t.toTeamId === mine.to) : undefined;
    const lootText = loot ? (loot.points > 0 ? `riuscito: bottino +${loot.points}` : `riuscito, ma ${loot.reason.toLowerCase()}`) : `riuscito (fino a ${view.steal})`;
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <Eyebrow>Il colpo</Eyebrow>
          {mine ? (
            <p className="flex flex-wrap items-center gap-2 text-lg font-extrabold">
              Contro il tavolo <PhoneChip tableNo={table.get(mine.to) ?? 0} tone="red" />
              <span className={mine.second ? "text-(--tg-gold)" : "text-(--tg-red-hi)"}>{mine.second ? lootText : mine.first ? "fallito al secondo indizio" : "fallito al primo indizio"}</span>
            </p>
          ) : (
            <p className="text-lg font-extrabold">Nessun colpo tentato.</p>
          )}
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-(--tg-cream)/75">
            {against.length ? (
              <>
                Vi hanno derubato: {against.map((h) => <PhoneChip key={h.from} tableNo={table.get(h.from) ?? 0} />)}
                <span>(scudo e tetti anti-valanga li applica il gioco)</span>
              </>
            ) : (
              "Nessun colpo riuscito contro di voi."
            )}
          </p>
        </Panel>
        {reveal.steps.map((s, i) => (
          <Panel key={i} className="flex flex-col gap-2">
            <Eyebrow>Indizio {i + 1}</Eyebrow>
            <p className="text-base font-extrabold leading-snug">{s.clue}</p>
            <ChoiceList options={view.steps[i].options} picked={sent ? [i === 0 ? first : second].filter((x): x is string => !!x) : []} onToggle={() => {}} keys={false} reveal={{ solution: [s.solutionId] }} />
          </Panel>
        ))}
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  const active = first ? 1 : 0;
  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Colpo!" hint={!target ? "Scegliete la vittima" : !first ? "Primo indizio" : !second ? "Secondo indizio: usate il risultato del primo" : undefined} />}
    >
      <Panel className="flex flex-col gap-1">
        <p className="tg-title text-[2rem] leading-none text-(--tg-gold)">{view.caper}</p>
        <p className="text-base font-semibold leading-snug text-(--tg-cream)/85">{view.scene}</p>
      </Panel>
      <Step n={1} title="La vittima" icon="target" done={!!target}>
        <TablePicker tables={rivals} value={target} onChange={setTarget} disabled={!editable} label="Tavolo da derubare" />
      </Step>
      <Step n={2} title="Primo indizio" done={!!first}>
        <p className="text-lg font-extrabold leading-snug">{view.steps[0].clue}</p>
        <ChoiceList options={view.steps[0].options} picked={first ? [first] : []} onToggle={(id) => editable && setFirst(id)} disabled={!editable} keys={active === 0} label="Primo indizio" />
      </Step>
      <Step n={3} title="Secondo indizio" done={!!second} className={clsx(!first && "opacity-60")}>
        {first ? (
          <>
            <p className="tg-rise text-lg font-extrabold leading-snug">{view.steps[1].clue}</p>
            <ChoiceList options={view.steps[1].options} picked={second ? [second] : []} onToggle={(id) => editable && setSecond(id)} disabled={!editable} keys={active === 1} onConfirm={submit} label="Secondo indizio" />
          </>
        ) : (
          <p className="flex items-center gap-2 text-base font-bold text-(--tg-cream)/60">
            <Icon name="lock" className="h-5 w-5" /> Si apre quando scegliete il primo: serve il suo risultato.
          </p>
        )}
      </Step>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const applied = appliedTransfers(p.outcome);
  const compact = tvCompact(p.teams);
  const heists = done ? (reveal.summary?.heists ?? []) : [];
  const two = heists.length > 6;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Colpo riuscito solo con tutti e due gli indizi giusti" : `Due indizi concatenati: tutti e due giusti, ${view.steal} punti rubati alla vittima`}>
      <div className="grid h-full grid-cols-[1.45fr_1fr] gap-[1.6cqw]">
        <TvPanel className={clsx("flex min-h-0 flex-col", compact ? "gap-[0.6cqw] py-[1.2cqw]" : "gap-[0.9cqw]")}>
          <div className="shrink-0">
            <p className={clsx("tg-title leading-none text-(--tg-gold)", compact ? "text-[2.4cqw]" : "text-[2.9cqw]")}>{view.caper}</p>
            <p className={clsx("mt-[0.3cqw] font-semibold leading-snug text-(--tg-cream)/85", compact ? "line-clamp-2 text-[1.25cqw]" : "text-[1.45cqw]")}>{view.scene}</p>
          </div>
          {(done ? reveal.steps : view.steps).map((s, i) => (
            <div key={i} className={clsx("flex flex-col", compact ? "gap-[0.35cqw]" : "gap-[0.5cqw]")}>
              <p className={clsx("font-extrabold leading-tight", compact ? "text-[1.4cqw]" : "text-[1.65cqw]")}>
                <span className="tg-coin mr-[0.6cqw] inline-grid h-[1.9cqw] w-[1.9cqw] align-[-0.3cqw] text-[1.1cqw]">{i + 1}</span>
                {s.clue}
              </p>
              <TvAnswers
                options={view.steps[i].options}
                solutionId={done ? (reveal.steps[i] as { solutionId: string }).solutionId : null}
                compact={compact}
                cols={compact && view.steps[i].options.every((o) => o.text.length <= 8) ? 4 : 2}
              />
            </div>
          ))}
        </TvPanel>
        <TvPanel tone="red" className={clsx("flex min-h-0 flex-col overflow-hidden", compact ? "gap-[0.5cqw] py-[1.2cqw]" : "gap-[0.6cqw]")}>
          <TvLabel className="text-(--tg-red-hi)" icon={<Icon name="coins" className="h-[1.6cqw] w-[1.6cqw]" />}>
            I colpi
          </TvLabel>
          {done ? (
            <>
              {heists.length ? (
                <div className={clsx("grid min-h-0 content-start gap-[0.4cqw] overflow-hidden", two ? "grid-cols-2" : "grid-cols-1")}>
                  {heists.map((h, i) => {
                    const tr = applied.find((a) => a.from === h.from && a.to === h.to);
                    const right = h.second ? (
                      tr ? (
                        tr.points > 0 ? <span className="tg-num text-(--tg-gold-hi)">ruba {tr.points}</span> : <span className="text-(--tg-cream)/75">{two ? "parato" : tr.reason}</span>
                      ) : (
                        <span className="tg-num text-(--tg-gold-hi)">riuscito</span>
                      )
                    ) : (
                      <span className="text-(--tg-cream)/55">{h.first ? (two ? "2° no" : "fallito al 2°") : "fallito"}</span>
                    );
                    return <TvVsRow key={h.from} teams={p.teams} a={h.from} b={h.to} icon="arrow" right={right} delay={i * 90} joiner="deruba" compact={two} />;
                  })}
                </div>
              ) : (
                <p className="text-[1.6cqw] font-bold text-(--tg-cream)/70">Nessun colpo tentato.</p>
              )}
              <TvWhy text={reveal.explain} compact={compact} className="mt-auto" />
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[0.8cqw] text-center">
              <Doubloon className={compact ? "h-[7.5cqw] w-[7.5cqw] text-[3.4cqw]" : "h-[10cqw] w-[10cqw] text-[4.6cqw]"} label={`${view.steal} punti a colpo`}>
                {view.steal}
              </Doubloon>
              <p className={clsx("tg-title leading-none text-(--tg-gold-hi)", compact ? "text-[2.2cqw]" : "text-[2.8cqw]")}>punti a colpo</p>
              <p className={clsx("max-w-[28cqw] font-bold leading-snug text-(--tg-cream)/80", compact ? "text-[1.2cqw]" : "text-[1.35cqw]")}>Un colpo per tavolo. Le vittime restano segrete fino al reveal. Lo scudo para il furto.</p>
            </div>
          )}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const furtoConDestrezzaUi = defineUi(Player, Tv);
