"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { ART_H, ART_W, type SceneItem } from "@/lib/tig/games/components/art";
import { captionAt, poseAt, type Clip, type DettaglioReveal, type DettaglioSubmission, type DettaglioView } from "@/lib/tig/games/mechanics/solo-un-dettaglio";
import type { PlayerGameProps, TvGameProps } from "../ui-contract";
import { defineUi } from "../kit/define";
import { Icon } from "../kit/icons";
import { ChoiceList } from "../kit/inputs";
import { SceneArt, SceneIcon } from "../kit/scene";
import { canEdit, elapsedOf, Explain, Eyebrow, MyOutcome, Panel, PlayerFrame, SubmitBar, TvExplain, TvFrame, TvOption, TvPanel, useClock, useSubmit } from "../kit/ui";
import { secsTo, TvBigWait, useFrameClock } from "./m5-kit";

type P = PlayerGameProps<DettaglioView, null, DettaglioSubmission, DettaglioReveal>;
type T = TvGameProps<DettaglioView, DettaglioReveal>;

const ITEM_PX = 150;
/** gli oggetti della clip sono un po' più grandi di quelli di Memoria lampo: si leggono anche dal fondo del locale */
const CLIP_SCALE = 1.3;

function ItemAt({ kind, tone, label, x, y, s, r, o = 1 }: { kind: SceneItem["kind"]; tone: SceneItem["tone"]; label?: string; x: number; y: number; s: number; r: number; o?: number }) {
  const k = (s * ITEM_PX * CLIP_SCALE * (label ? 1.12 : 1)) / 100;
  return (
    <g opacity={o} transform={`translate(${(x / 100) * ART_W} ${(y / 100) * ART_H}) rotate(${r}) scale(${k}) translate(-50 -50)`}>
      <SceneIcon kind={kind} tone={tone ?? "white"} label={label} />
    </g>
  );
}

/**
 * La clip: sfondo del kit, oggetti fermi e oggetti animati alla posa dell'istante `t` (ms dall'inizio della clip).
 * Stesso istante → stesso fotogramma su ogni schermo. `focus` disegna il cerchio del reveal; `zoom` ingrandisce
 * attorno al cerchio (telefono: il dettaglio si legge anche su uno schermo piccolo).
 */
export function ClipStage({ clip, t, alt, focus, caption = true, zoom = 1, className }: { clip: Clip; t: number; alt: string; focus?: { x: number; y: number; r: number } | null; caption?: boolean; zoom?: number; className?: string }) {
  const text = caption ? captionAt(clip, t) : null;
  // ingrandimento centrato sul dettaglio, senza mai mostrare il fuori-scena
  const z = focus && zoom > 1 ? zoom : 1;
  const tx = z > 1 && focus ? Math.min(0, Math.max(100 - 100 * z, 50 - z * focus.x)) : 0;
  const ty = z > 1 && focus ? Math.min(0, Math.max(100 - 100 * z, 50 - z * focus.y)) : 0;
  return (
    <div role="img" aria-label={alt} className={clsx("relative aspect-video overflow-hidden", className)}>
      <div className="absolute inset-0" style={z > 1 ? { transform: `translate(${tx}%, ${ty}%) scale(${z})`, transformOrigin: "0 0" } : undefined}>
        <SceneArt scene={{ backdrop: clip.backdrop, items: [] }} alt="" className="absolute inset-0 h-full w-full" />
        <svg viewBox={`0 0 ${ART_W} ${ART_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
          {clip.props.map((it, i) => (
            <ItemAt key={`p${i}`} kind={it.kind} tone={it.tone} label={it.label} x={it.x} y={it.y} s={it.scale ?? 1} r={it.rot ?? 0} />
          ))}
          {clip.actors.map((a, i) => {
            const pose = poseAt(a, t);
            if (!pose || pose.o <= 0.01) return null;
            return <ItemAt key={`a${i}`} kind={a.kind} tone={a.tone} label={a.label} x={pose.x} y={pose.y} s={pose.s} r={pose.r} o={pose.o} />;
          })}
          {focus && (
            <g>
              <circle cx={(focus.x / 100) * ART_W} cy={(focus.y / 100) * ART_H} r={(focus.r / 100) * ART_W * CLIP_SCALE} fill="none" stroke="var(--tg-gold)" strokeWidth={10} strokeDasharray="28 16" />
              <circle cx={(focus.x / 100) * ART_W} cy={(focus.y / 100) * ART_H} r={(focus.r / 100) * ART_W * CLIP_SCALE + 14} fill="none" stroke="var(--tg-ink)" strokeOpacity={0.6} strokeWidth={6} />
            </g>
          )}
        </svg>
      </div>
      {text && (
        <p className="absolute inset-x-[6%] bottom-[4%] rounded-[0.6em] bg-(--tg-night)/80 px-[0.8em] py-[0.35em] text-center text-[clamp(12px,2.2cqw,40px)] font-extrabold leading-tight text-(--tg-cream)">{text}</p>
      )}
    </div>
  );
}

function Player(p: P) {
  const { view, reveal } = p;
  const t = useClock(p.now, p.stage === "play");
  const elapsed = elapsedOf(view.durationMs, p.deadlineAt, t);
  const [picked, setPicked] = useState<string | null>(null);
  const { send, pending, error, sent } = useSubmit(p.submit);
  const editable = canEdit(p.stage, p.submitted);
  const clipEnd = view.countdownMs + view.clipMs;
  const submit = () => !!picked && p.canSubmit && send({ optionId: picked });

  if (p.stage === "reveal" && reveal) {
    return (
      <PlayerFrame view={view} p={p}>
        <MyOutcome outcome={p.myOutcome} />
        <Panel className="flex flex-col gap-2 p-2">
          <ClipStage clip={reveal.clip} t={reveal.focus.at} alt={reveal.alt} focus={reveal.focus} caption={false} zoom={2.2} className="w-full rounded-xl" />
          <p className="px-2 text-xs font-bold text-(--tg-cream)/60">Fermo immagine ingrandito: il dettaglio era qui.</p>
        </Panel>
        <Panel className="flex flex-col gap-2">
          <p className="text-lg font-extrabold leading-snug">{reveal.prompt}</p>
          <ChoiceList options={reveal.options} picked={sent && picked ? [picked] : []} onToggle={() => {}} keys={false} reveal={{ solution: [reveal.solutionId] }} />
        </Panel>
        <Explain text={reveal.explain} />
      </PlayerFrame>
    );
  }

  if (p.stage === "play" && elapsed < clipEnd) {
    const rolling = elapsed >= view.countdownMs;
    return (
      <PlayerFrame view={view} p={p}>
        <Panel tone="lime" className="tg-pop flex flex-col items-center gap-3 py-10 text-center">
          <Icon name="tv" className="h-16 w-16 text-(--tg-gold)" />
          <p className="tg-display text-5xl">{rolling ? "Guardate la TV" : "Si gira!"}</p>
          <p className="max-w-xs text-base font-semibold text-(--tg-cream)/80">«{view.heading}»: la clip passa una volta sola. Guardate tutto, anche quello che non sembra importante.</p>
          <p className="tg-num text-6xl text-(--tg-gold)" aria-live="polite">
            {rolling ? secsTo(clipEnd, elapsed) : secsTo(view.countdownMs, elapsed)}
          </p>
        </Panel>
        {view.alt && <p className="sr-only">{view.alt}</p>}
      </PlayerFrame>
    );
  }

  return (
    <PlayerFrame
      view={view}
      p={p}
      footer={<SubmitBar kbd="Invio" canSubmit={p.canSubmit} submitted={p.submitted} stage={p.stage} ready={!!picked} pending={pending} error={error} onSubmit={submit} label="Invia" hint="Più rispondete presto, più bonus (fino a +20)" />}
    >
      <Panel className="flex items-center gap-3 py-3">
        <Icon name="eye" className="h-8 w-8 shrink-0 text-(--tg-teal-hi)" />
        <div>
          <Eyebrow>La clip è finita</Eyebrow>
          <p className="tg-display text-2xl">«{view.heading}»</p>
        </div>
      </Panel>
      {view.prompt && view.options ? (
        <Panel className="tg-rise flex flex-col gap-3">
          <p className="text-xl font-extrabold leading-snug">{view.prompt}</p>
          <ChoiceList options={view.options} picked={picked ? [picked] : []} onToggle={(id) => editable && setPicked(id)} disabled={!editable} onConfirm={submit} />
        </Panel>
      ) : (
        <Panel className="py-8 text-center text-base font-bold text-(--tg-cream)/70">La domanda sta arrivando…</Panel>
      )}
    </PlayerFrame>
  );
}

function Tv(p: T) {
  const { view, reveal } = p;
  const playing = p.stage === "play";
  const clipEnd = view.countdownMs + view.clipMs;
  const t0 = useClock(p.now, playing);
  const coarse = elapsedOf(view.durationMs, p.deadlineAt, t0);
  const rolling = playing && coarse >= view.countdownMs - 300 && coarse < clipEnd + 300 && !!view.clip;
  const tf = useFrameClock(p.now, rolling);
  const elapsed = rolling ? elapsedOf(view.durationMs, p.deadlineAt, tf) : coarse;

  if (p.stage === "reveal" && reveal) {
    return (
      <TvFrame view={view} p={p} subtitle={`«${reveal.heading}» · fermo immagine sul dettaglio`}>
        <div className="grid h-full grid-cols-[1.25fr_1fr] gap-[1.4cqw]">
          <TvPanel className="tg-pop flex min-h-0 items-center justify-center p-[0.6cqw]">
            <ClipStage clip={reveal.clip} t={reveal.focus.at} alt={reveal.alt} focus={reveal.focus} caption={false} zoom={1.6} className="max-h-full w-full rounded-[1cqw]" />
          </TvPanel>
          <div className="flex min-h-0 flex-col gap-[1cqw]">
            <TvPanel className="tg-rise flex flex-col gap-[0.6cqw]">
              <p className="text-[1.7cqw] font-extrabold leading-tight">{reveal.prompt}</p>
              <div className="grid grid-cols-2 gap-[0.5cqw]">
                {reveal.options.map((o, i) => (
                  <TvOption key={o.id} index={i} text={o.text} size="sm" state={o.id === reveal.solutionId ? "right" : "dim"} />
                ))}
              </div>
            </TvPanel>
            <TvExplain text={reveal.explain} />
          </div>
        </div>
      </TvFrame>
    );
  }

  if (playing && elapsed < view.countdownMs) {
    return (
      <TvFrame view={view} p={{ ...p, teams: [] }} hideTimer subtitle={`«${view.heading}»: la clip passa una volta sola, uguale per tutti.`}>
        <TvBigWait icon="eye" kicker="Occhi sulla TV" title="Si gira tra" sub={secsTo(view.countdownMs, elapsed)} />
      </TvFrame>
    );
  }

  if (playing && elapsed < clipEnd && view.clip) {
    return (
      <TvFrame view={view} p={{ ...p, teams: [] }} hideTimer subtitle={`«${view.heading}» · una volta sola, poi sparisce`}>
        <div className="flex h-full items-center justify-center">
          <div className="relative h-full max-h-full aspect-video">
            <ClipStage clip={view.clip} t={elapsed - view.countdownMs} alt={view.alt ?? view.heading} className="h-full w-full rounded-[1.4cqw] border border-(--tg-cream)/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]" />
            <div className="tg-glass absolute left-[1.2cqw] top-[1.2cqw] flex items-center gap-[0.5cqw] rounded-full px-[1cqw] py-[0.4cqw]">
              <span className="tg-pulse h-[1cqw] w-[1cqw] rounded-full bg-(--tg-red)" />
              <span className="text-[1.1cqw] font-extrabold uppercase tracking-[0.2em]">In onda</span>
            </div>
            <div className="tg-glass tg-glass-lime absolute right-[1.2cqw] top-[1.2cqw] grid h-[5cqw] w-[5cqw] place-items-center rounded-full">
              <span className="tg-num text-[2.8cqw] text-(--tg-gold)">{secsTo(clipEnd, elapsed)}</span>
            </div>
          </div>
        </div>
      </TvFrame>
    );
  }

  return (
    <TvFrame view={view} p={p} subtitle={`«${view.heading}» è passata. Rispondete dal telefono: conta anche la rapidità.`}>
      {view.prompt && view.options ? (
        <div className="flex h-full flex-col justify-center gap-[1.4cqw]">
          <TvPanel className="tg-rise flex flex-col gap-[1cqw] p-[2.2cqw]">
            <p className="text-[1.1cqw] font-extrabold uppercase tracking-[0.25em] text-(--tg-teal-hi)">Solo un dettaglio</p>
            <p className="text-[2.8cqw] font-extrabold leading-tight">{view.prompt}</p>
          </TvPanel>
          <div className="grid grid-cols-2 gap-[1cqw]">
            {view.options.map((o, i) => (
              <TvOption key={o.id} index={i} text={o.text} />
            ))}
          </div>
        </div>
      ) : (
        <TvBigWait icon="eye" kicker="Clip finita" title="Arriva la domanda" />
      )}
    </TvFrame>
  );
}

export const soloUnDettaglioUi = defineUi(Player, Tv);
