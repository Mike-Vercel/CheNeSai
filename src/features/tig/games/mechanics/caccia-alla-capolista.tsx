"use client";

import { useState } from "react";
import type { CacciaReveal, CacciaSubmission, CacciaView } from "@/lib/tig/games/mechanics/caccia-alla-capolista";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { BigToggle, ChoiceList } from "../kit/inputs";
import { canEdit, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useSubmit } from "../kit/ui";
import { PhoneChip, Step, TvChip } from "./m2/kit";

type P = PlayerGameProps<CacciaView, null, CacciaSubmission, CacciaReveal>;
type T = TvGameProps<CacciaView, CacciaReveal>;
type Mode = CacciaSubmission["mode"];

function LeaderBanner({ view, me }: { view: CacciaView; me: boolean }) {
  return (
    <Panel tone={me ? "lime" : undefined} className="flex items-center gap-3">
      <Icon name="crown" className="h-10 w-10 shrink-0 text-(--tg-teal-hi)" />
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
  return (
    <TvFrame view={view} p={p} subtitle={done ? "Vince la caccia chi è giusto e più rapido della capolista" : "Caccia +40 se battete la capolista · passo +20 · la capolista difende: +10 a cacciatore respinto"}>
      <div className="grid h-full grid-cols-[1.35fr_1fr] gap-[1.6cqw]">
        <TvPanel className="flex min-h-0 flex-col gap-[1cqw]">
          <p className="text-[2.3cqw] font-extrabold leading-tight">{view.prompt}</p>
          <div className="grid grid-cols-2 gap-[0.7cqw]">
            {view.options.map((o, i) => (
              <TvOption key={o.id} index={i} text={o.text} state={done ? (o.id === reveal.solutionId ? "right" : "dim") : "idle"} />
            ))}
          </div>
          {done && <TvExplain text={reveal.explain} className="mt-auto" />}
        </TvPanel>
        <TvPanel tone="lime" className="flex min-h-0 flex-col items-center gap-[1cqw] overflow-hidden">
          <Icon name="crown" className="tg-pulse h-[6cqw] w-[6cqw] text-(--tg-teal-hi)" />
          <p className="tg-display text-[2.6cqw]">{view.leaders.length > 1 ? "Capoliste" : "Capolista"}</p>
          <div className="flex flex-wrap justify-center gap-[0.6cqw]">
            {view.leaders.map((l) => (
              <TvChip key={l.teamId} teams={p.teams} id={l.teamId} size={5} />
            ))}
          </div>
          {view.drawn && <p className="text-[1.1cqw] font-bold text-(--tg-cream)/60">Classifica in parità: estratta a sorte</p>}
          {s ? (
            <div className="flex w-full min-h-0 flex-col gap-[0.5cqw] overflow-hidden">
              <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em] text-(--tg-red-hi)">Cacciatori</p>
              {s.hunts.length === 0 && <p className="text-[1.5cqw] font-bold text-(--tg-cream)/70">Nessuno ha osato.</p>}
              <div className="flex flex-wrap gap-[0.5cqw]">
                {s.hunts.map((h, i) => (
                  <div key={h.teamId} className="tg-rise flex items-center gap-[0.5cqw] rounded-[0.8cqw] bg-(--tg-cream)/[0.06] px-[0.6cqw] py-[0.35cqw]" style={{ animationDelay: `${i * 90}ms` }}>
                    <TvChip teams={p.teams} id={h.teamId} size={2.4} />
                    <span className={h.won ? "text-[1.3cqw] font-extrabold text-(--tg-gold)" : "text-[1.3cqw] font-extrabold text-(--tg-cream)/60"}>{h.won ? "presa +40" : "respinto"}</span>
                  </div>
                ))}
              </div>
              {s.passed.length > 0 && (
                <p className="mt-[0.4cqw] flex flex-wrap items-center gap-[0.4cqw] text-[1.2cqw] font-bold text-(--tg-cream)/70">
                  Hanno passato: {s.passed.map((id) => <TvChip key={id} teams={p.teams} id={id} size={2} />)}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-auto grid w-full grid-cols-2 gap-[0.6cqw] text-center">
              {[
                ["Caccia riuscita", `+${view.points.win}`],
                ["Giusti ma battuti", `+${view.points.beaten}`],
                ["Passo, giusto", `+${view.points.pass}`],
                ["Capolista", `fino a +${view.points.leaderCap}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-[0.8cqw] bg-(--tg-cream)/[0.05] px-[0.6cqw] py-[0.5cqw]">
                  <p className="tg-num text-[2.4cqw] text-(--tg-gold)">{v}</p>
                  <p className="text-[1cqw] font-extrabold uppercase tracking-wide text-(--tg-cream)/70">{k}</p>
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
