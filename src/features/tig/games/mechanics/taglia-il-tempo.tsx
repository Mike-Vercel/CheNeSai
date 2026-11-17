"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { TagliaReveal, TagliaSubmission, TagliaView } from "@/lib/tig/games/mechanics/taglia-il-tempo";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, secondsLeft, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";
import { PhoneChip, Scissors, Step, TablePicker, TvChip } from "./m2/kit";

type P = PlayerGameProps<TagliaView, null, TagliaSubmission, TagliaReveal>;
type T = TvGameProps<TagliaView, TagliaReveal>;

function Player(p: P) {
  const { view, reveal } = p;
  const rivals = view.targets.filter((x) => x.teamId !== p.myTeam.teamId);
  const [lampo, setLampo] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(rivals.length === 1 ? rivals[0].teamId : null);
  const [sfida, setSfida] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const t = useClock(p.now, p.stage === "play");
  const left = secondsLeft(p.deadlineAt, t);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!lampo && !!target && !!sfida;
  const submit = () => ready && p.canSubmit && send({ lampo: lampo!, targetId: target!, sfida: sfida! });
  const table = new Map(view.targets.map((x) => [x.teamId, x.tableNo]));
  const cutSec = Math.round(view.cutMs / 1000);

  if (p.stage === "reveal" && reveal) {
    const cuts = reveal.summary?.cuts ?? [];
    const mine = cuts.find((c) => c.from === p.myTeam.teamId);
    const onMe = cuts.find((c) => c.to === p.myTeam.teamId && c.applied);
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2">
          <Eyebrow className="flex items-center gap-2">
            <Scissors className="h-4 w-4" /> Le forbici
          </Eyebrow>
          <p className="flex flex-wrap items-center gap-2 text-base font-extrabold">
            {mine ? (
              <>
                Avete tagliato il tavolo <PhoneChip tableNo={table.get(mine.to) ?? 0} tone="red" /> {mine.applied ? <span className="text-[#c6ff3d]">a segno</span> : <span className="text-white/60">a vuoto (già tagliato)</span>}
              </>
            ) : (
              <span className="text-white/70">Lampo sbagliato: niente forbici.</span>
            )}
          </p>
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-white/75">
            {onMe ? (
              <>
                Vi ha tagliato il tavolo <PhoneChip tableNo={table.get(onMe.from) ?? 0} /> : la vostra sfida scadeva {cutSec} secondi prima.
              </>
            ) : (
              "Nessuno vi ha tagliato il tempo."
            )}
          </p>
        </Panel>
        <Panel className="flex flex-col gap-2">
          <Eyebrow>Lampo</Eyebrow>
          <p className="text-base font-extrabold leading-snug">{reveal.lampo.prompt}</p>
          <ChoiceList options={view.lampo.options} picked={sent && lampo ? [lampo] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.lampo.solutionId] }} />
        </Panel>
        <Panel className="flex flex-col gap-2">
          <Eyebrow>Sfida</Eyebrow>
          <p className="text-base font-extrabold leading-snug">{reveal.sfida.prompt}</p>
          <ChoiceList options={view.sfida.options} picked={sent && sfida ? [sfida] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.sfida.solutionId] }} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  const active = !lampo ? 0 : 1;
  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label="Taglia e rispondi" hint={!lampo ? "Prima il lampo" : !target ? "Chi tagliate?" : !sfida ? "Poi la sfida" : undefined} />}
    >
      {p.stage === "play" && !p.submitted && left <= cutSec + 5 && (
        <div role="alert" className="tg-stripes-red tg-pulse flex items-center gap-2 rounded-xl border border-[#ff3b4e]/70 px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-[#ff8c97]">
          <Scissors className="h-5 w-5" /> Zona taglio: se vi hanno tagliato, gli ultimi {cutSec} secondi non valgono
        </div>
      )}
      <Step n={1} title="Prova lampo" icon="bolt" done={!!lampo}>
        <p className="text-lg font-extrabold leading-snug">{view.lampo.prompt}</p>
        <ChoiceList options={view.lampo.options} picked={lampo ? [lampo] : []} onToggle={(id) => editable && setLampo(id)} disabled={!editable} keys={active === 0} label="Prova lampo" />
      </Step>
      <Step n={2} title={`Chi tagliate (−${cutSec} s)?`} done={!!target}>
        <TablePicker tables={rivals} value={target} onChange={setTarget} disabled={!editable} label="Tavolo a cui tagliare il tempo" />
        <p className="text-sm font-semibold text-white/65">Le forbici funzionano solo se il lampo è giusto. Un taglio a testa: se il tavolo è già stato tagliato, il vostro va a vuoto.</p>
      </Step>
      <Step n={3} title="La sfida (uguale per tutti)" done={!!sfida}>
        <p className="text-lg font-extrabold leading-snug">{view.sfida.prompt}</p>
        <ChoiceList options={view.sfida.options} picked={sfida ? [sfida] : []} onToggle={(id) => editable && setSfida(id)} disabled={!editable} keys={active === 1} onConfirm={submit} label="La sfida" />
      </Step>
    </PlayerFrame>
  );
}

/** Barra del tempo con la «zona taglio» negli ultimi secondi. */
function CutBar({ durationMs, cutMs, elapsed, stage }: { durationMs: number; cutMs: number; elapsed: number; stage: T["stage"] }) {
  const frac = stage === "play" ? Math.min(1, elapsed / durationMs) : 1;
  const zone = (cutMs / durationMs) * 100;
  const inZone = stage === "play" && durationMs - elapsed <= cutMs;
  return (
    <div className="flex flex-col gap-[0.6cqw]">
      <div className="relative h-[3.2cqw] overflow-hidden rounded-[0.8cqw] border border-white/15 bg-white/[0.05]" role="img" aria-label={`Tempo trascorso, zona taglio negli ultimi ${Math.round(cutMs / 1000)} secondi`}>
        <div className="absolute inset-y-0 left-0 bg-[#c6ff3d]/80" style={{ width: `${frac * 100}%`, transition: "width 200ms linear" }} />
        <div className={clsx("tg-stripes-red absolute inset-y-0 right-0 border-l-[0.25cqw] border-dashed border-[#ff3b4e]", inZone && "tg-pulse")} style={{ width: `${zone}%` }} />
      </div>
      <div className="flex items-center justify-end gap-[0.5cqw] text-[1.2cqw] font-extrabold uppercase tracking-wide text-[#ff8c97]">
        <Scissors className="h-[1.6cqw] w-[1.6cqw]" /> Zona taglio: ultimi {Math.round(cutMs / 1000)} s
      </div>
    </div>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const done = p.stage === "reveal" && reveal;
  const cuts = done ? (reveal.summary?.cuts ?? []) : [];
  const knocked = new Set(done ? (reveal.summary?.knockedOut ?? []) : []);
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Taglio a segno = sfida scaduta 3 secondi prima per quel tavolo" : "Lampo giusto = forbici: 3 secondi in meno alla sfida di un tavolo a scelta"}>
      <div className="grid h-full grid-cols-[1.4fr_1fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className="flex flex-col gap-[0.6cqw]">
            <p className="flex items-center gap-[0.6cqw] text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-[#c6ff3d]">
              <Icon name="bolt" className="h-[1.5cqw] w-[1.5cqw]" /> Prova lampo
            </p>
            <p className="text-[1.8cqw] font-extrabold leading-tight">{view.lampo.prompt}</p>
            <div className="grid grid-cols-3 gap-[0.6cqw]">
              {view.lampo.options.map((o, i) => (
                <TvOption key={o.id} size="sm" index={i} text={o.text} state={done ? (o.id === reveal.lampo.solutionId ? "right" : "dim") : "idle"} />
              ))}
            </div>
          </TvPanel>
          <TvPanel className="flex min-h-0 flex-1 flex-col gap-[0.8cqw]">
            <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-white/70">La sfida</p>
            <p className="text-[2cqw] font-extrabold leading-tight">{view.sfida.prompt}</p>
            <div className="grid grid-cols-2 gap-[0.6cqw]">
              {view.sfida.options.map((o, i) => (
                <TvOption key={o.id} index={i} text={o.text} state={done ? (o.id === reveal.sfida.solutionId ? "right" : "dim") : "idle"} />
              ))}
            </div>
          </TvPanel>
        </div>
        <TvPanel tone="red" className="flex min-h-0 flex-col gap-[0.8cqw] overflow-hidden">
          <p className="flex items-center gap-[0.6cqw] text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-[#ff3b4e]">
            <Scissors className="h-[1.6cqw] w-[1.6cqw]" /> Forbici
          </p>
          {done ? (
            <>
              <div className={clsx("grid min-h-0 gap-[0.4cqw] overflow-hidden", cuts.length > 6 ? "grid-cols-2" : "grid-cols-1")}>
                {cuts.length === 0 && <p className="text-[1.6cqw] font-bold text-white/60">Nessun taglio: lampo sbagliato per tutti.</p>}
                {cuts.map((c, i) => (
                  <div key={c.from} className="tg-rise flex items-center gap-[0.7cqw] rounded-[0.8cqw] bg-white/[0.05] px-[0.8cqw] py-[0.4cqw]" style={{ animationDelay: `${i * 90}ms` }}>
                    <TvChip teams={p.teams} id={c.from} size={cuts.length > 6 ? 2 : 2.6} />
                    <Scissors className="h-[1.7cqw] w-[1.7cqw] text-[#ff3b4e]" />
                    <TvChip teams={p.teams} id={c.to} size={cuts.length > 6 ? 2 : 2.6} />
                    <span className={clsx("ml-auto text-right font-extrabold", cuts.length > 6 ? "text-[1cqw]" : "text-[1.3cqw]")}>
                      {c.applied ? <span className="text-[#ff8c97]">−3 s{knocked.has(c.to) ? " · fuori tempo!" : ""}</span> : <span className="text-white/55">a vuoto</span>}
                    </span>
                  </div>
                ))}
              </div>
              <TvExplain text={reveal.explain} className="mt-auto" />
            </>
          ) : (
            <div className="flex flex-1 flex-col gap-[1.2cqw]">
              <div className="flex flex-1 items-center justify-center gap-[1.2cqw]">
                <Scissors className="h-[7cqw] w-[7cqw] -rotate-12 text-[#ff3b4e]" />
                <p className="tg-num text-[8cqw] leading-none text-[#ff3b4e]">−{Math.round(view.cutMs / 1000)} s</p>
              </div>
              <p className="text-[1.6cqw] font-bold leading-snug text-white/80">Chi taglia chi resta segreto fino al reveal. Ogni tavolo può essere tagliato una volta sola.</p>
              <CutBar durationMs={view.durationMs} cutMs={view.cutMs} elapsed={elapsed} stage={p.stage} />
            </div>
          )}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const tagliaIlTempoUi = defineUi(Player, Tv);
