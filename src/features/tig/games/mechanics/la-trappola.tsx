"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { TrappolaReveal, TrappolaSubmission, TrappolaView } from "@/lib/tig/games/mechanics/la-trappola";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { ChoiceList } from "../kit/inputs";
import { Doubloon } from "../kit/ornaments";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvPanel, useSubmit } from "../kit/ui";
import { PhoneChip, Step, TablePicker, TrapGlyph, TvAnswers, TvChip, tvCompact, TvLabel, TvWhy } from "./m2/kit";

type P = PlayerGameProps<TrappolaView, null, TrappolaSubmission, TrappolaReveal>;
type T = TvGameProps<TrappolaView, TrappolaReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const rivals = view.targets.filter((x) => x.teamId !== p.myTeam.teamId);
  const [target, setTarget] = useState<string | null>(rivals.length === 1 ? rivals[0].teamId : null);
  const [trap, setTrap] = useState<number | null>(null);
  const [defuse, setDefuse] = useState<(string | null)[]>(() => view.traps.map(() => null));
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const done = defuse.filter(Boolean).length;
  const ready = !!target && trap !== null && done === view.traps.length;
  const submit = () => ready && p.canSubmit && send({ targetId: target!, trap: trap!, defuse: defuse as string[] });
  const table = new Map(view.targets.map((x) => [x.teamId, x.tableNo]));
  const nextOpen = defuse.findIndex((d) => !d);

  if (p.stage === "reveal" && reveal) {
    const pl = reveal.summary?.placements ?? [];
    const mine = pl.find((x) => x.from === p.myTeam.teamId);
    const onMe = pl.find((x) => x.to === p.myTeam.teamId && x.armed);
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <Eyebrow className="flex items-center gap-2">
            <TrapGlyph className="h-4 w-4" /> Trappole
          </Eyebrow>
          {mine ? (
            <p className="flex flex-wrap items-center gap-2 text-base font-extrabold">
              «{reveal.traps[mine.trap].name}» sul tavolo <PhoneChip tableNo={table.get(mine.to) ?? 0} tone="red" />
              {!mine.armed ? <span className="text-(--tg-cream)/60">a vuoto (c&apos;era già una trappola)</span> : mine.sprung ? <span className="text-(--tg-gold)">scattata: −{view.penalty} a loro</span> : <span className="text-(--tg-cream)/70">disinnescata</span>}
            </p>
          ) : (
            <p className="text-base font-extrabold text-(--tg-cream)/70">Nessuna trappola armata.</p>
          )}
          {onMe ? (
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-(--tg-cream)/80">
              Contro di voi «{reveal.traps[onMe.trap].name}» dal tavolo <PhoneChip tableNo={table.get(onMe.from) ?? 0} />
              <span className="whitespace-nowrap">
                <span aria-hidden className="text-(--tg-cream)/45">·</span> {onMe.sprung ? <span className="text-(--tg-red-hi)">scattata</span> : <span className="text-(--tg-gold)">disinnescata</span>}
              </span>
            </p>
          ) : (
            <p className="text-sm font-bold text-(--tg-cream)/70">Nessuno vi ha teso una trappola.</p>
          )}
        </Panel>
        {reveal.traps.map((tr, i) => (
          <Panel key={i} className="flex flex-col gap-2">
            <Eyebrow>
              {i + 1} · {tr.name}
            </Eyebrow>
            <p className="text-base font-extrabold leading-snug">{tr.prompt}</p>
            <ChoiceList options={view.traps[i].options} picked={sent && defuse[i] ? [defuse[i]!] : []} onToggle={() => {}} keys={false} reveal={{ solution: [tr.solutionId] }} />
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
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Arma e disinnesca" hint={!target ? "Chi intrappolate?" : trap === null ? "Quale trappola armate?" : done < view.traps.length ? `Disinnescate tutte e tre (${done}/${view.traps.length})` : undefined} />}
    >
      <Step n={1} title="Il bersaglio" icon="target" done={!!target}>
        <TablePicker tables={rivals} value={target} onChange={setTarget} disabled={!editable} label="Tavolo da intrappolare" />
      </Step>
      <Step n={2} title={`Trappola da armare · −${view.penalty}`} done={trap !== null}>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Trappola da armare">
          {view.traps.map((tr, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={trap === i}
              disabled={!editable}
              onClick={() => setTrap(i)}
              className={clsx("flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2 text-center transition-transform active:scale-95", trap === i ? "tg-picked border-(--tg-red-hi) text-(--tg-cream)" : "border-(--tg-cream)/12 bg-(--tg-cream)/[0.04] text-(--tg-cream)/85")}
            >
              <TrapGlyph className={clsx("h-6 w-6", trap === i ? "text-(--tg-red-hi)" : "text-(--tg-cream)/60")} />
              <span className="text-sm font-extrabold leading-tight">{tr.name}</span>
            </button>
          ))}
        </div>
        <p className="text-sm font-semibold text-(--tg-cream)/65">Scegliete quella che, secondo voi, il bersaglio sbaglierà. Su ogni tavolo vale una sola trappola: la prima armata.</p>
      </Step>
      <Step n={3} title={`Disinnesco · +${view.defusePoints} l'una`} icon="shield" done={done === view.traps.length}>
        <p className="text-sm font-semibold text-(--tg-cream)/65">Non sapete quale vi hanno armato contro: rispondete a tutte.</p>
        {view.traps.map((tr, i) => (
          <div key={i} className={clsx("flex flex-col gap-2 rounded-2xl border border-(--tg-cream)/10 p-3", defuse[i] && "border-(--tg-gold)/40")}>
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-(--tg-mute)">
              <TrapGlyph className="h-4 w-4" /> {tr.name}
            </p>
            <p className="text-base font-extrabold leading-snug">{tr.prompt}</p>
            <ChoiceList
              options={tr.options}
              picked={defuse[i] ? [defuse[i]!] : []}
              onToggle={(id) => editable && setDefuse((d) => d.map((x, k) => (k === i ? id : x)))}
              disabled={!editable}
              keys={nextOpen === i}
              onConfirm={nextOpen === -1 ? submit : null}
              label={tr.name}
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
  const pl = done ? (reveal.summary?.placements ?? []) : [];
  const compact = tvCompact(p.teams);
  const many = pl.length > 6;
  const four = pl.length > 9;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Su ogni tavolo vale solo la prima trappola armata" : `Ogni tavolo arma una trappola contro un rivale e disinnesca tutte e tre: +${view.defusePoints} l'una`}>
      <div className="flex h-full min-h-0 flex-col gap-[1.1cqw]">
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[1.2cqw]">
          {view.traps.map((tr, i) => {
            const sol = done ? reveal.traps[i].solutionId : null;
            return (
              <TvPanel key={i} className={clsx("tg-rise flex min-h-0 flex-col", compact ? "gap-[0.4cqw] py-[1.1cqw]" : "gap-[0.6cqw]")}>
                <TvLabel className="text-(--tg-red-hi)" icon={<TrapGlyph className="h-[1.9cqw] w-[1.9cqw]" />}>
                  {tr.name}
                </TvLabel>
                <p className={clsx("font-extrabold leading-tight", tr.prompt.length > 100 ? (compact ? "text-[1.2cqw]" : "text-[1.4cqw]") : compact ? "text-[1.3cqw]" : "text-[1.55cqw]")}>{tr.prompt}</p>
                <TvAnswers options={tr.options} solutionId={sol} compact={compact} className="mt-auto" />
              </TvPanel>
            );
          })}
        </div>
        <div className={clsx("grid shrink-0 gap-[1.2cqw]", done ? (four ? "grid-cols-[1.6fr_1fr]" : many ? "grid-cols-[1.25fr_1fr]" : "grid-cols-[1fr_1.5fr]") : "grid-cols-[1.4fr_1fr]", done ? (compact ? "h-[13cqw]" : "h-[14.5cqw]") : compact ? "h-[8.6cqw]" : "h-[11cqw]")}>
          <TvPanel tone="red" className={clsx("flex min-h-0 flex-col overflow-hidden", compact ? "gap-[0.4cqw] py-[1cqw]" : "gap-[0.5cqw] py-[1.3cqw]")}>
            <TvLabel className="text-(--tg-red-hi)" icon={<TrapGlyph className="h-[1.6cqw] w-[1.6cqw]" />}>
              Trappole armate
            </TvLabel>
            {done ? (
              <div className={clsx("grid min-h-0 content-start gap-[0.3cqw] overflow-hidden", four ? "grid-cols-4" : many ? "grid-cols-3" : "grid-cols-2")}>
                {pl.length === 0 && <p className="text-[1.5cqw] font-bold text-(--tg-cream)/70">Nessuna trappola.</p>}
                {pl.map((x, i) => (
                  <div key={x.from} className={clsx("tg-rise flex items-center rounded-[0.7cqw] bg-(--tg-cream)/[0.06]", many ? "gap-[0.3cqw] px-[0.4cqw] py-[0.2cqw]" : "gap-[0.5cqw] px-[0.6cqw] py-[0.3cqw]")} style={{ animationDelay: `${i * 70}ms` }}>
                    <TvChip teams={p.teams} id={x.from} size={many ? 2 : 2.5} />
                    <TrapGlyph className={clsx("shrink-0", many ? "h-[1.2cqw] w-[1.2cqw]" : "h-[1.5cqw] w-[1.5cqw]", x.sprung ? "text-(--tg-red-hi)" : "text-(--tg-cream)/40")} />
                    <TvChip teams={p.teams} id={x.to} size={many ? 2 : 2.5} />
                    <span className={clsx("tg-num ml-auto truncate text-right leading-tight", many ? "text-[0.95cqw]" : "text-[1.2cqw]")}>
                      {!x.armed ? <span className="text-(--tg-cream)/50">a vuoto</span> : x.sprung ? <span className="text-(--tg-red-hi)">−{view.penalty}</span> : <span className="text-(--tg-gold-hi)">salvo</span>}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={clsx("font-bold leading-snug text-(--tg-cream)/85", compact ? "text-[1.3cqw]" : "text-[1.4cqw]")}>
                Chi intrappola chi resta segreto. Se il bersaglio sbaglia proprio la trappola armata contro di lui: −{view.penalty}. Su ogni tavolo vale una sola trappola, la prima.
              </p>
            )}
          </TvPanel>
          {done ? (
            <TvWhy text={reveal.explain} compact={compact} className="h-full" />
          ) : (
            <TvPanel tone="lime" className="flex min-h-0 items-center justify-center gap-[1.2cqw]">
              <Doubloon className={compact ? "h-[5.2cqw] w-[5.2cqw] text-[2.1cqw]" : "h-[6.2cqw] w-[6.2cqw] text-[2.5cqw]"}>+{view.defusePoints}</Doubloon>
              <div>
                <p className={clsx("tg-title leading-none text-(--tg-gold-hi)", compact ? "text-[2.2cqw]" : "text-[2.6cqw]")}>a trappola disinnescata</p>
                <p className="mt-[0.4cqw] text-[1.2cqw] font-bold text-(--tg-cream)/80">fino a +{view.defusePoints * view.traps.length} se le disinnescate tutte</p>
              </div>
            </TvPanel>
          )}
        </div>
      </div>
    </TvFrame>
  );
}

export const laTrappolaUi = defineUi(Player, Tv);
