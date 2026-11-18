"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { TagliaReveal, TagliaSubmission, TagliaView } from "@/lib/tig/games/mechanics/taglia-il-tempo";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, secondsLeft, SubmitBar, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";
import { PhoneChip, Scissors, Step, TablePicker, TvChip, tvCompact, TvLabel, tvLongPrompt, TvWhy } from "./m2/kit";

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
                Avete tagliato il tavolo <PhoneChip tableNo={table.get(mine.to) ?? 0} tone="red" /> {mine.applied ? <span className="text-(--tg-gold)">a segno</span> : <span className="text-(--tg-cream)/60">a vuoto (già tagliato)</span>}
              </>
            ) : (
              <span className="text-(--tg-cream)/70">Lampo sbagliato: niente forbici.</span>
            )}
          </p>
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-(--tg-cream)/75">
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
        <div role="alert" className="tg-stripes-red tg-pulse flex items-center gap-2 rounded-xl border border-(--tg-red-hi)/70 px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide text-(--tg-red-hi)">
          <Scissors className="h-5 w-5" /> Zona taglio: se vi hanno tagliato, gli ultimi {cutSec} secondi non valgono
        </div>
      )}
      <Step n={1} title="Prova lampo" icon="bolt" done={!!lampo}>
        <p className="text-lg font-extrabold leading-snug">{view.lampo.prompt}</p>
        <ChoiceList options={view.lampo.options} picked={lampo ? [lampo] : []} onToggle={(id) => editable && setLampo(id)} disabled={!editable} keys={active === 0} label="Prova lampo" />
      </Step>
      <Step n={2} title={`Chi tagliate (−${cutSec} s)?`} done={!!target}>
        <TablePicker tables={rivals} value={target} onChange={setTarget} disabled={!editable} label="Tavolo a cui tagliare il tempo" />
        <p className="text-sm font-semibold text-(--tg-cream)/65">Le forbici funzionano solo se il lampo è giusto. Un taglio a testa: se il tavolo è già stato tagliato, il vostro va a vuoto.</p>
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
      <div className="relative h-[3.2cqw] overflow-hidden rounded-[0.8cqw] border border-(--tg-cream)/15 bg-(--tg-cream)/[0.05]" role="img" aria-label={`Tempo trascorso, zona taglio negli ultimi ${Math.round(cutMs / 1000)} secondi`}>
        <div className="absolute inset-y-0 left-0 bg-(--tg-gold)/80" style={{ width: `${frac * 100}%`, transition: "width 200ms linear" }} />
        <div className={clsx("tg-stripes-red absolute inset-y-0 right-0 border-l-[0.25cqw] border-dashed border-(--tg-red-hi)", inZone && "tg-pulse")} style={{ width: `${zone}%` }} />
      </div>
      <div className="flex items-center justify-end gap-[0.5cqw] text-[1.2cqw] font-extrabold uppercase tracking-wide text-(--tg-red-hi)">
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
  const compact = tvCompact(p.teams);
  const two = cuts.length > 6;
  const cutSec = Math.round(view.cutMs / 1000);
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Taglio a segno = sfida scaduta 3 secondi prima per quel tavolo" : "Lampo giusto = forbici: 3 secondi in meno alla sfida di un tavolo a scelta"}>
      <div className="grid h-full grid-cols-[1.4fr_1fr] gap-[1.6cqw]">
        <div className="flex min-h-0 flex-col gap-[1cqw]">
          <TvPanel className={clsx("flex shrink-0 flex-col", compact ? "gap-[0.45cqw] py-[1.2cqw]" : "gap-[0.6cqw]")}>
            <TvLabel className="text-(--tg-gold)" icon={<Icon name="bolt" className="h-[1.5cqw] w-[1.5cqw]" />}>
              Prova lampo
            </TvLabel>
            <p className={clsx("font-extrabold leading-tight", compact ? "text-[1.55cqw]" : "text-[1.8cqw]")}>{view.lampo.prompt}</p>
            <div className="grid grid-cols-3 gap-[0.6cqw]">
              {view.lampo.options.map((o, i) => (
                <TvOption key={o.id} size="sm" index={i} text={o.text} state={done ? (o.id === reveal.lampo.solutionId ? "right" : "dim") : "idle"} />
              ))}
            </div>
          </TvPanel>
          <TvPanel className={clsx("flex min-h-0 flex-1 flex-col", compact ? "gap-[0.5cqw] py-[1.2cqw]" : "gap-[0.8cqw]")}>
            <TvLabel className="text-(--tg-cream)/75">La sfida · uguale per tutti</TvLabel>
            <p className={clsx("font-extrabold leading-tight", tvLongPrompt(view.sfida.prompt) ? (compact ? "text-[1.45cqw]" : "text-[1.8cqw]") : compact ? "text-[1.6cqw]" : "text-[2cqw]")}>{view.sfida.prompt}</p>
            <div className="grid grid-cols-2 gap-[0.6cqw]">
              {view.sfida.options.map((o, i) => (
                <TvOption key={o.id} size={compact || tvLongPrompt(view.sfida.prompt) ? "sm" : "md"} index={i} text={o.text} state={done ? (o.id === reveal.sfida.solutionId ? "right" : "dim") : "idle"} />
              ))}
            </div>
          </TvPanel>
        </div>
        <TvPanel tone="red" className={clsx("flex min-h-0 flex-col overflow-hidden", compact ? "gap-[0.6cqw] py-[1.2cqw]" : "gap-[0.8cqw]")}>
          <TvLabel className="text-(--tg-red-hi)" icon={<Scissors className="h-[1.6cqw] w-[1.6cqw]" />}>
            Le forbici
          </TvLabel>
          {done ? (
            <>
              <div className={clsx("grid min-h-0 content-start gap-[0.4cqw] overflow-hidden", two ? "grid-cols-2" : "grid-cols-1")}>
                {cuts.length === 0 && <p className="text-[1.6cqw] font-bold text-(--tg-cream)/70">Nessun taglio: lampo sbagliato per tutti.</p>}
                {cuts.map((c, i) => (
                  <div key={c.from} className={clsx("tg-rise flex items-center rounded-[0.8cqw] bg-(--tg-cream)/[0.06]", two ? "gap-[0.4cqw] px-[0.5cqw] py-[0.3cqw]" : "gap-[0.7cqw] px-[0.8cqw] py-[0.4cqw]")} style={{ animationDelay: `${i * 90}ms` }}>
                    <TvChip teams={p.teams} id={c.from} size={two ? 2.3 : 2.7} />
                    <Scissors className={clsx("shrink-0", two ? "h-[1.3cqw] w-[1.3cqw]" : "h-[1.7cqw] w-[1.7cqw]", c.applied ? "text-(--tg-red-hi)" : "text-(--tg-cream)/35")} />
                    <TvChip teams={p.teams} id={c.to} size={two ? 2.3 : 2.7} />
                    <span className={clsx("tg-num ml-auto text-right leading-tight", two ? "text-[1.05cqw]" : "text-[1.4cqw]")}>
                      {c.applied ? <span className="text-(--tg-red-hi)">−{cutSec} s{knocked.has(c.to) ? (two ? " · fuori!" : " · fuori tempo!") : ""}</span> : <span className="text-(--tg-cream)/55">a vuoto</span>}
                    </span>
                  </div>
                ))}
              </div>
              <TvWhy text={reveal.explain} compact={compact} className="mt-auto" />
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-[1cqw]">
              <div className="flex min-h-0 flex-1 items-center justify-center gap-[1cqw]">
                <Scissors className={clsx("shrink-0 -rotate-12 text-(--tg-red-hi) drop-shadow-[0_0.3cqw_0.6cqw_rgba(0,0,0,.6)]", compact ? "h-[5cqw] w-[5cqw]" : "h-[7cqw] w-[7cqw]")} />
                <p className={clsx("tg-num leading-none tracking-tight text-(--tg-red-hi) drop-shadow-[0_0.3cqw_0.6cqw_rgba(0,0,0,.6)]", compact ? "text-[6cqw]" : "text-[8cqw]")}>−{cutSec} s</p>
              </div>
              <p className={clsx("font-bold leading-snug text-(--tg-cream)/85", compact ? "text-[1.35cqw]" : "text-[1.6cqw]")}>Chi taglia chi resta segreto fino al reveal. Ogni tavolo può essere tagliato una volta sola.</p>
              <CutBar durationMs={view.durationMs} cutMs={view.cutMs} elapsed={elapsed} stage={p.stage} />
            </div>
          )}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const tagliaIlTempoUi = defineUi(Player, Tv);
