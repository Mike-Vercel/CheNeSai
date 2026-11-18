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

/**
 * Riquadro della scritta di ogni icona del kit (stessi valori di kit/scene.tsx, nel quadrato 100×100). La scritta la
 * disegniamo noi e la facciamo stare SEMPRE nel riquadro (`textLength`): col Grenze, più largo del vecchio carattere,
 * quella del kit usciva dai bordi (FRAGILE sulla valigia). Sulle scritte si basano le domande: devono leggersi.
 */
const LABEL_BOX: Partial<Record<SceneItem["kind"], { x: number; y: number; w: number; max: number; lines?: 2; light?: boolean }>> = {
  tazza: { x: 44, y: 56, w: 42, max: 18 },
  telefono: { x: 50, y: 48, w: 32, max: 15, lines: 2 },
  laptop: { x: 50, y: 41, w: 54, max: 16, lines: 2 },
  orologio: { x: 50, y: 52, w: 52, max: 26, light: true },
  libro: { x: 54, y: 46, w: 36, max: 16, lines: 2 },
  pizza: { x: 50, y: 57, w: 66, max: 18, lines: 2, light: true },
  poster: { x: 50, y: 50, w: 62, max: 20, lines: 2 },
  postit: { x: 48, y: 46, w: 62, max: 20, lines: 2 },
  valigia: { x: 35, y: 73, w: 52, max: 15 },
  biglietto: { x: 38, y: 50, w: 58, max: 17, lines: 2 },
  calendario: { x: 50, y: 62, w: 60, max: 22, lines: 2 },
  torta: { x: 50, y: 70, w: 64, max: 20, light: true },
  monitor: { x: 50, y: 40, w: 66, max: 18, lines: 2 },
  palloncino: { x: 50, y: 38, w: 40, max: 22 },
};

/** larghezza media di una lettera maiuscola del Grenze nero, in em: con `SIZE_EM` più piccolo la scritta è più alta e,
 *  se serve, `textLength` la stringe un poco in larghezza (più leggibile di una scritta minuscola) */
const GLYPH_EM = 0.62;
const SIZE_EM = 0.52;

function FitLabel({ kind, text }: { kind: SceneItem["kind"]; text: string }) {
  const b = LABEL_BOX[kind];
  if (!b) return null;
  let rows = [text];
  if (b.lines === 2 && text.length > 9 && text.includes(" ")) {
    const mid = text.length / 2;
    let cut = -1;
    for (let i = 0; i < text.length; i++) if (text[i] === " " && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
    rows = [text.slice(0, cut), text.slice(cut + 1)];
  }
  const longest = Math.max(...rows.map((r) => r.length));
  const fs = Math.max(8, Math.min(b.max * 1.15, b.w / (longest * SIZE_EM)));
  return (
    <>
      {rows.map((r, i) => {
        const tight = r.length * GLYPH_EM * fs > b.w * 0.9;
        return (
          <text
            key={i}
            x={b.x}
            y={b.y - (rows.length - 1) * fs * 0.55 + i * fs * 1.08}
            fill={b.light ? "var(--tg-cream)" : "var(--tg-ink)"}
            fontSize={fs}
            fontWeight={800}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontFamily: "var(--tg-display)" }}
            {...(tight ? { textLength: b.w, lengthAdjust: "spacingAndGlyphs" as const } : {})}
          >
            {r}
          </text>
        );
      })}
    </>
  );
}

function ItemAt({ kind, tone, label, x, y, s, r, o = 1 }: { kind: SceneItem["kind"]; tone: SceneItem["tone"]; label?: string; x: number; y: number; s: number; r: number; o?: number }) {
  const k = (s * ITEM_PX * CLIP_SCALE * (label ? 1.12 : 1)) / 100;
  return (
    <g opacity={o} transform={`translate(${(x / 100) * ART_W} ${(y / 100) * ART_H}) rotate(${r}) scale(${k}) translate(-50 -50)`}>
      {/* « » = l'icona del kit nella versione «con scritta» (es. l'orologio senza lancette), ma la scritta è nostra */}
      <SceneIcon kind={kind} tone={tone ?? "white"} label={label ? " " : undefined} />
      {label && <FitLabel kind={kind} text={label} />}
    </g>
  );
}

/** margini del cerchio dal bordo della scena (in % di larghezza e di altezza: c'è anche l'anello scuro attorno) */
const RING_MX = 1.6;
const RING_MY = 2.4;

/**
 * Raggio del cerchio del reveal in % della larghezza della scena: quello del contenuto (in scala con gli oggetti), ma
 * stretto quanto serve perché il cerchio stia tutto nella scena anche quando il dettaglio è vicino a un bordo.
 */
function ringRadius(f: { x: number; y: number; r: number }): number {
  const k = ART_H / ART_W;
  return Math.max(4, Math.min(f.r * CLIP_SCALE, f.x - RING_MX, 100 - f.x - RING_MX, (f.y - RING_MY) * k, (100 - f.y - RING_MY) * k));
}

/**
 * La clip: sfondo del kit, oggetti fermi e oggetti animati alla posa dell'istante `t` (ms dall'inizio della clip).
 * Stesso istante → stesso fotogramma su ogni schermo. `focus` disegna il cerchio del reveal; `zoom` ingrandisce
 * attorno al cerchio (telefono: il dettaglio si legge anche su uno schermo piccolo).
 */
export function ClipStage({ clip, t, alt, focus, caption = true, zoom = 1, className }: { clip: Clip; t: number; alt: string; focus?: { x: number; y: number; r: number } | null; caption?: boolean; zoom?: number; className?: string }) {
  const text = caption ? captionAt(clip, t) : null;
  const ring = focus ? ringRadius(focus) : 0;
  // ingrandimento centrato sul dettaglio, senza mai mostrare il fuori-scena né tagliare il cerchio
  const z = focus && zoom > 1 ? Math.max(1, Math.min(zoom, 50 / (ring + RING_MX), 50 / ((ring * ART_W) / ART_H + RING_MY))) : 1;
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
              <circle cx={(focus.x / 100) * ART_W} cy={(focus.y / 100) * ART_H} r={(ring / 100) * ART_W} fill="none" stroke="var(--tg-gold)" strokeWidth={10} strokeDasharray="28 16" />
              <circle cx={(focus.x / 100) * ART_W} cy={(focus.y / 100) * ART_H} r={(ring / 100) * ART_W + 14} fill="none" stroke="var(--tg-ink)" strokeOpacity={0.6} strokeWidth={6} />
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
          <ClipStage clip={reveal.clip} t={reveal.focus.at} alt={reveal.alt} focus={reveal.focus} caption={false} zoom={1.8} className="w-full rounded-xl" />
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
          {/* titolo della clip nel carattere dei titoli (senza «»: nel Pirata One sembrano due frecce) */}
          <p className="tg-title text-3xl leading-tight">{view.heading}</p>
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
            <ClipStage clip={reveal.clip} t={reveal.focus.at} alt={reveal.alt} focus={reveal.focus} caption={false} zoom={1.4} className="max-h-full w-full rounded-[1cqw]" />
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
