"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { TrappolaReveal, TrappolaSubmission, TrappolaView } from "@/lib/tig/games/mechanics/la-trappola";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { PhoneChip, Step, TablePicker, TrapGlyph, TvChip } from "./m2/kit";

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
              {!mine.armed ? <span className="text-white/60">a vuoto (c&apos;era già una trappola)</span> : mine.sprung ? <span className="text-[#c6ff3d]">scattata: −{view.penalty} a loro</span> : <span className="text-white/70">disinnescata</span>}
            </p>
          ) : (
            <p className="text-base font-extrabold text-white/70">Nessuna trappola armata.</p>
          )}
          {onMe ? (
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-white/80">
              Contro di voi «{reveal.traps[onMe.trap].name}» dal tavolo <PhoneChip tableNo={table.get(onMe.from) ?? 0} />: {onMe.sprung ? <span className="text-[#ff8c97]">scattata</span> : <span className="text-[#c6ff3d]">disinnescata</span>}
            </p>
          ) : (
            <p className="text-sm font-bold text-white/70">Nessuno vi ha teso una trappola.</p>
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
      <Step n={2} title={`La trappola da armare (−${view.penalty} se la sbagliano)`} done={trap !== null}>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Trappola da armare">
          {view.traps.map((tr, i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={trap === i}
              disabled={!editable}
              onClick={() => setTrap(i)}
              className={clsx("flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2 text-center transition-transform active:scale-95", trap === i ? "tg-picked border-[#ff3b4e] text-white" : "border-white/12 bg-white/[0.04] text-white/85")}
            >
              <TrapGlyph className={clsx("h-6 w-6", trap === i ? "text-[#ff3b4e]" : "text-white/60")} />
              <span className="text-sm font-extrabold leading-tight">{tr.name}</span>
            </button>
          ))}
        </div>
        <p className="text-sm font-semibold text-white/65">Scegliete quella che, secondo voi, il bersaglio sbaglierà. Su ogni tavolo vale una sola trappola: la prima armata.</p>
      </Step>
      <Step n={3} title={`Disinnescate tutte e tre (+${view.defusePoints} l'una)`} icon="shield" done={done === view.traps.length}>
        <p className="text-sm font-semibold text-white/65">Non sapete quale vi hanno armato contro: rispondete a tutte.</p>
        {view.traps.map((tr, i) => (
          <div key={i} className={clsx("flex flex-col gap-2 rounded-2xl border border-white/10 p-3", defuse[i] && "border-[#c6ff3d]/40")}>
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[#9aa4b2]">
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
  const many = pl.length > 8;
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Su ogni tavolo vale solo la prima trappola armata" : `Ogni tavolo arma una trappola contro un rivale e disinnesca tutte e tre: +${view.defusePoints} l'una`}>
      <div className="flex h-full min-h-0 flex-col gap-[1.2cqw]">
        <div className="grid grid-cols-3 gap-[1.2cqw]">
          {view.traps.map((tr, i) => {
            const sol = done ? reveal.traps[i].solutionId : null;
            return (
              <TvPanel key={i} className="tg-rise flex flex-col gap-[0.6cqw]">
                <p className="flex items-center gap-[0.6cqw] text-[1.2cqw] font-extrabold uppercase tracking-[0.16em] text-[#ff3b4e]">
                  <TrapGlyph className="h-[1.8cqw] w-[1.8cqw]" /> {tr.name}
                </p>
                <p className="text-[1.55cqw] font-extrabold leading-tight">{tr.prompt}</p>
                <div className="flex flex-col gap-[0.4cqw]">
                  {tr.options.map((o, j) => (
                    <TvOption key={o.id} size="sm" index={j} text={o.text} state={sol ? (o.id === sol ? "right" : "dim") : "idle"} />
                  ))}
                </div>
              </TvPanel>
            );
          })}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[1.4fr_1fr] gap-[1.2cqw]">
          <TvPanel tone="red" className="flex min-h-0 flex-col gap-[0.5cqw] overflow-hidden">
            <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-[#ff3b4e]">Trappole armate</p>
            {done ? (
              <div className={clsx("grid min-h-0 gap-[0.35cqw] overflow-hidden", many ? "grid-cols-3" : "grid-cols-2")}>
                {pl.length === 0 && <p className="text-[1.5cqw] font-bold text-white/60">Nessuna trappola.</p>}
                {pl.map((x, i) => (
                  <div key={x.from} className="tg-rise flex items-center gap-[0.5cqw] rounded-[0.7cqw] bg-white/[0.05] px-[0.6cqw] py-[0.3cqw]" style={{ animationDelay: `${i * 70}ms` }}>
                    <TvChip teams={p.teams} id={x.from} size={many ? 1.8 : 2.3} />
                    <TrapGlyph className={clsx("h-[1.4cqw] w-[1.4cqw]", x.sprung ? "text-[#ff3b4e]" : "text-white/40")} />
                    <TvChip teams={p.teams} id={x.to} size={many ? 1.8 : 2.3} />
                    <span className={clsx("ml-auto truncate text-right font-extrabold", many ? "text-[0.95cqw]" : "text-[1.15cqw]")}>
                      {!x.armed ? <span className="text-white/45">a vuoto</span> : x.sprung ? <span className="text-[#ff8c97]">scattata −{view.penalty}</span> : <span className="text-[#c6ff3d]">disinnescata</span>}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[1.5cqw] font-bold leading-snug text-white/80">Chi intrappola chi resta segreto. Se il bersaglio sbaglia proprio la trappola armata contro di lui: −{view.penalty}. Su ogni tavolo vale una sola trappola, la prima.</p>
            )}
          </TvPanel>
          {done ? (
            <TvExplain text={reveal.explain} />
          ) : (
            <TvPanel className="flex flex-col items-center justify-center gap-[0.6cqw] text-center">
              <Icon name="shield" className="h-[4cqw] w-[4cqw] text-[#c6ff3d]" />
              <p className="tg-display text-[2.4cqw]">+{view.defusePoints} a trappola disinnescata</p>
              <p className="text-[1.2cqw] font-bold text-white/70">fino a +{view.defusePoints * view.traps.length}</p>
            </TvPanel>
          )}
        </div>
      </div>
    </TvFrame>
  );
}

export const laTrappolaUi = defineUi(Player, Tv);
