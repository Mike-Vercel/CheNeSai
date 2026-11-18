"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type { CacciaReveal, CacciaSubmission, CacciaView } from "@/lib/tig/games/mechanics/caccia-alla-capolista";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { BigToggle, ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { PhoneChip, Step, TvChip, tvCompact, TvLabel, tvLongPrompt, tvPromptSize, TvWhy } from "./m2/kit";

type P = PlayerGameProps<CacciaView, null, CacciaSubmission, CacciaReveal>;
type T = TvGameProps<CacciaView, CacciaReveal>;
type Mode = CacciaSubmission["mode"];

function LeaderBanner({ view, me }: { view: CacciaView; me: boolean }) {
  return (
    <Panel tone={me ? "lime" : undefined} className="flex items-center gap-3">
      <Icon name="crown" className="h-10 w-10 shrink-0 text-(--tg-gold) drop-shadow-[0_0_10px_rgba(242,177,52,.55)]" />
      <div className="min-w-0 flex-1">
        <Eyebrow>{view.leaders.length > 1 ? "Capoliste a pari merito" : "La capolista"}</Eyebrow>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-lg font-extrabold">
          {view.leaders.map((l) => (
            <PhoneChip key={l.teamId} tableNo={l.tableNo} tone="amber" />
          ))}
          {me && <span className="text-(--tg-gold)">siete voi</span>}
        </p>
        {view.drawn && <p className="mt-1 text-xs font-semibold text-(--tg-cream)/60">Classifica in parità: capolista estratta a sorte.</p>}
      </div>
    </Panel>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const amLeader = view.leaders.some((l) => l.teamId === p.myTeam.teamId);
  const [mode, setMode] = useState<Mode | null>(amLeader ? "passo" : null);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const ready = !!mode && !!picked;
  const submit = () => ready && p.canSubmit && send({ mode: mode!, optionId: picked! });
  const table = new Map([...view.leaders, ...view.others].map((x) => [x.teamId, x.tableNo]));

  if (p.stage === "reveal" && reveal) {
    const s = reveal.summary;
    const mine = s?.hunts.find((h) => h.teamId === p.myTeam.teamId);
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        {s && (
          <Panel className="flex flex-col gap-2">
            <Eyebrow>La caccia</Eyebrow>
            {amLeader ? (
              <p className="text-lg font-extrabold leading-snug">
                {s.hunts.length ? `${s.hunts.length} tavol${s.hunts.length === 1 ? "o vi ha" : "i vi hanno"} dato la caccia: ${s.hunts.filter((h) => !h.won).length} respint${s.hunts.filter((h) => !h.won).length === 1 ? "o" : "i"}.` : "Nessuno vi ha dato la caccia: il trono ha fatto paura."}
              </p>
            ) : mine ? (
              <p className="flex items-center gap-2 text-lg font-extrabold">
                <Icon name="target" className="h-5 w-5 text-(--tg-red-hi)" /> {mine.won ? <span className="text-(--tg-gold)">Capolista battuta</span> : <span className="text-(--tg-red-hi)">La capolista ha retto</span>}
              </p>
            ) : (
              <p className="text-lg font-extrabold">Avete passato la mano.</p>
            )}
            <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-(--tg-cream)/70">
              Cacciatori: {s.hunts.length ? s.hunts.map((h) => <PhoneChip key={h.teamId} tableNo={table.get(h.teamId) ?? 0} tone={h.won ? "lime" : "ice"} />) : "nessuno"}
            </p>
          </Panel>
        )}
        <Panel className="flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-snug">{reveal.prompt}</p>
          <ChoiceList options={view.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  const label = amLeader ? "Difendi" : mode === "caccia" ? "Caccia!" : mode === "passo" ? "Passo e rispondo" : "Invia";
  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={ready} pending={pending} error={error} onSubmit={submit} label={label} hint={!mode ? "Prima: caccia o passo?" : !picked ? "Poi la risposta: conta anche la velocità" : undefined} />}
    >
      <LeaderBanner view={view} me={amLeader} />
      {amLeader ? (
        <Panel className="text-base font-bold leading-snug text-(--tg-cream)/85">
          Difendete il trono: risposta giusta +{view.points.leaderBase}, più +{view.points.leaderPerHunter} per ogni cacciatore che battete in velocità (massimo +{view.points.leaderCap}). Nessuno può togliervi punti.
        </Panel>
      ) : (
        <Step n={1} title="Caccia o passo?" icon="target" done={!!mode}>
          <BigToggle<Mode>
            label="Caccia o passo"
            value={mode}
            onChange={setMode}
            disabled={!editable}
            options={[
              { id: "caccia", title: "Caccia", sub: `Più rapidi della capolista: +${view.points.win}. Giusti ma battuti: +${view.points.beaten}`, tone: "red", icon: "target" },
              { id: "passo", title: "Passo", sub: `Risposta giusta: +${view.points.pass}, senza duello`, tone: "lime", icon: "shield" },
            ]}
          />
        </Step>
      )}
      <Step n={amLeader ? 1 : 2} title="L'enigma (uguale per tutti)" done={!!picked}>
        <p className="text-lg font-extrabold leading-snug">{view.prompt}</p>
        <ChoiceList options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
      </Step>
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const done = p.stage === "reveal" && reveal;
  const s = done ? reveal.summary : null;
  const compact = tvCompact(p.teams);
  const legend: [string, string][] = [
    ["Caccia riuscita", `+${view.points.win}`],
    ["Giusti ma battuti", `+${view.points.beaten}`],
    ["Passo, giusto", `+${view.points.pass}`],
    ["Capolista", `fino a +${view.points.leaderCap}`],
  ];
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Vince la caccia chi è giusto e più rapido della capolista" : "Caccia +40 se battete la capolista · passo +20 · la capolista difende: +10 a cacciatore respinto"}>
      <div className="grid h-full grid-cols-[1.35fr_1fr] gap-[1.6cqw]">
        <TvPanel className={clsx("flex min-h-0 flex-col", compact ? "gap-[0.7cqw] py-[1.3cqw]" : "gap-[1cqw]")}>
          <TvLabel className="text-(--tg-cream)/75">L&apos;enigma · uguale per tutti</TvLabel>
          <p className={clsx("font-extrabold leading-tight", tvPromptSize(view.prompt, compact))}>{view.prompt}</p>
          <div className="grid grid-cols-2 gap-[0.7cqw]">
            {view.options.map((o, i) => (
              <TvOption key={o.id} size={compact || tvLongPrompt(view.prompt) ? "sm" : "md"} index={i} text={o.text} state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
            ))}
          </div>
          {done && <TvWhy text={reveal.explain} compact={compact} className="mt-auto" />}
        </TvPanel>
        <TvPanel tone="lime" className={clsx("flex min-h-0 flex-col items-center overflow-hidden", compact ? "gap-[0.5cqw] py-[1.2cqw]" : "gap-[0.8cqw]")}>
          <Icon name="crown" className={clsx("shrink-0 text-(--tg-gold) drop-shadow-[0_0_1.2cqw_rgba(242,177,52,.6)]", compact ? "h-[3.6cqw] w-[3.6cqw]" : "h-[5.2cqw] w-[5.2cqw]")} />
          <p className={clsx("tg-title shrink-0 leading-none text-(--tg-gold-hi)", compact ? "text-[2.6cqw]" : "text-[3.2cqw]")}>{view.leaders.length > 1 ? "Le capoliste" : "La capolista"}</p>
          <div className="flex shrink-0 flex-wrap justify-center gap-[0.8cqw]">
            {view.leaders.map((l) => (
              <TvChip key={l.teamId} teams={p.teams} id={l.teamId} size={compact ? 4 : 5.2} />
            ))}
          </div>
          {view.drawn && <p className="shrink-0 text-[1.1cqw] font-bold text-(--tg-cream)/70">Classifica in parità: estratta a sorte</p>}
          {s ? (
            <div className="flex min-h-0 w-full flex-col gap-[0.5cqw] overflow-hidden">
              <TvLabel className="text-(--tg-red-hi)" icon={<Icon name="target" className="h-[1.4cqw] w-[1.4cqw]" />}>
                I cacciatori
              </TvLabel>
              {s.hunts.length === 0 && <p className="text-[1.5cqw] font-bold text-(--tg-cream)/75">Nessuno ha osato.</p>}
              <div className="flex flex-wrap gap-[0.5cqw]">
                {s.hunts.map((h, i) => (
                  <div key={h.teamId} className={clsx("tg-rise flex items-center gap-[0.4cqw] rounded-[0.8cqw] px-[0.5cqw] py-[0.3cqw]", h.won ? "bg-(--tg-gold)/18 ring-[0.12cqw] ring-(--tg-gold)/60" : "bg-(--tg-cream)/[0.06]")} style={{ animationDelay: `${i * 90}ms` }}>
                    <TvChip teams={p.teams} id={h.teamId} size={compact ? 2.2 : 2.6} />
                    <span className={clsx("tg-num leading-none", compact ? "text-[1.1cqw]" : "text-[1.3cqw]", h.won ? "text-(--tg-gold-hi)" : "text-(--tg-cream)/60")}>{h.won ? "presa +40" : "respinto"}</span>
                  </div>
                ))}
              </div>
              {s.passed.length > 0 && (
                <p className="mt-[0.2cqw] flex flex-wrap items-center gap-[0.4cqw] text-[1.15cqw] font-bold text-(--tg-cream)/75">
                  Hanno passato: {s.passed.map((id) => <TvChip key={id} teams={p.teams} id={id} size={2.1} />)}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-auto grid w-full grid-cols-2 gap-[0.6cqw] text-center">
              {legend.map(([k, v]) => (
                <div key={k} className={clsx("rounded-[0.8cqw] border-[0.1cqw] border-(--tg-brass)/30 bg-(--tg-night)/50 px-[0.6cqw]", compact ? "py-[0.35cqw]" : "py-[0.55cqw]")}>
                  <p className={clsx("tg-num leading-tight text-(--tg-gold-hi)", compact ? "text-[1.9cqw]" : "text-[2.3cqw]")}>{v}</p>
                  <p className="text-[0.95cqw] font-extrabold uppercase tracking-wide text-(--tg-cream)/75">{k}</p>
                </div>
              ))}
            </div>
          )}
        </TvPanel>
      </div>
    </TvFrame>
  );
}

export const cacciaAllaCapolistaUi = defineUi(Player, Tv);
