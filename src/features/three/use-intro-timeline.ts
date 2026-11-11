"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { FLASHES, captionAt, countdownAt, phaseAt, type CaptionId, type IntroPhase, type Speaker } from "./timeline";
import { INTRO_CLIP_DIR, NO_RULES, RULES, RULES_AUDIO_DIR, realTimeOf, ruleAt, rulesTime, storyTime, type IntroSchedule } from "./rules";
import { INTRO_SPEECH } from "@/features/game/speech";
import { crowdLevel } from "./crowd";

function crowdState(t: number): 0 | 1 | 2 {
  const { clap, cheer } = crowdLevel(t);
  return cheer > 0.3 ? 2 : clap > 0.3 ? 1 : 0;
}

export interface IntroTimelineState {
  phase: IntroPhase;
  caption: CaptionId | null;
  countdown: number | null;
  /** Indice del lampo attivo (FLASHES) o -1. */
  flash: number;
  /** Scheda delle regole in corso (indice in RULES) o null. */
  rule: number | null;
  /** Chi sta parlando secondo il copione (didascalia o regola). */
  speaker: Speaker | null;
  /** Pubblico: 0 calmo, 1 applaude, 2 ovazione (per il fallback 2D). */
  crowd: 0 | 1 | 2;
  /** Tempo di storia (s) arrotondato a 0.1 s: per UI non critiche. */
  coarseT: number;
  /** Battuta parlata in corso (sottotitoli karaoke) o null. */
  line: SpokenLine | null;
  /** Secondi dall'inizio della battuta, a passi di 50 ms (per evidenziare la parola). */
  lineT: number;
}

export interface SpokenLine {
  /** Chiave stabile (nome della clip). */
  key: string;
  who: Speaker;
  text: string;
  /** URL della clip registrata (i tempi parola sono in `<clip>.words.json`). */
  clip: string;
  /** Durata prevista della battuta (s), per il ripiego senza tempi parola. */
  dur: number;
}

const lineCache = new Map<string, SpokenLine>();
function spoken(key: string, who: Speaker, text: string, clip: string, dur: number): SpokenLine {
  const k = `${key}|${dur.toFixed(2)}`;
  let l = lineCache.get(k);
  if (!l) {
    l = { key, who, text, clip, dur };
    lineCache.set(k, l);
  }
  return l;
}

/** Battuta in corso: una regola (nel suo orologio) o una battuta registrata della presentazione. */
function lineAt(e: number, t: number, rule: number | null, schedule: IntroSchedule, captionId: CaptionId | null): { line: SpokenLine; start: number } | null {
  if (rule !== null) {
    const slot = schedule.rules.find((s) => s.index === rule);
    if (!slot) return null;
    const r = RULES[rule];
    const dur = slot.to - slot.from - (slot.clip ? 0.6 : 0);
    return { line: spoken(r.file.replace(/\.mp3$/, ""), r.who, r.text, `${RULES_AUDIO_DIR}${r.file}`, dur), start: schedule.rulesRealStart + slot.from };
  }
  if (!captionId) return null;
  const sp = INTRO_SPEECH.find((l) => l.clip === captionId && l.clipWho !== null);
  const cap = captionAt(t);
  if (!sp || !cap || !sp.clipWho) return null;
  const start = realTimeOf(sp.at, schedule);
  if (e < start) return null;
  const dur = realTimeOf(cap.to, schedule) - start;
  return { line: spoken(sp.clip, sp.clipWho, sp.line.text, `${INTRO_CLIP_DIR}${sp.clip}.mp3`, dur), start };
}

function compute(elapsedMs: number, schedule: IntroSchedule): IntroTimelineState {
  const e = Math.max(0, elapsedMs) / 1000;
  const t = storyTime(e, schedule);
  const rule = ruleAt(e, schedule);
  const inRules = rulesTime(e, schedule) >= 0;
  let flash = -1;
  for (let i = 0; i < FLASHES.length; i++) {
    const d = t - FLASHES[i].at;
    if (d >= 0 && d < 0.55) flash = i;
  }
  const caption = inRules ? null : captionAt(t);
  return {
    phase: inRules ? "rules" : phaseAt(t),
    caption: caption?.id ?? null,
    countdown: countdownAt(t),
    flash,
    rule,
    speaker: rule !== null ? RULES[rule].who : (caption?.speaker ?? null),
    crowd: crowdState(t),
    coarseT: Math.floor(t * 10) / 10,
    ...(() => {
      const l = lineAt(e, t, rule, schedule, caption?.id ?? null);
      return { line: l?.line ?? null, lineT: l ? Math.floor((e - l.start) * 20) / 20 : 0 };
    })(),
  };
}

function same(a: IntroTimelineState, b: IntroTimelineState, withCoarse: boolean) {
  return (
    a.phase === b.phase &&
    a.caption === b.caption &&
    a.countdown === b.countdown &&
    a.flash === b.flash &&
    a.rule === b.rule &&
    a.speaker === b.speaker &&
    a.crowd === b.crowd &&
    a.line === b.line &&
    a.lineT === b.lineT &&
    (!withCoarse || a.coarseT === b.coarseT)
  );
}

/**
 * Stato "discreto" della timeline per il DOM (didascalie, regole, countdown, fallback 2D).
 * Il tempo deriva SOLO da `now() - startedAtMs`; il re-render avviene solo quando
 * cambia qualcosa di visibile. Chiama `onFinished` una sola volta per startedAtMs.
 */
export function useIntroTimeline(opts: {
  startedAtMs: number;
  now: () => number;
  onFinished?: () => void;
  trackCoarse?: boolean;
  schedule?: IntroSchedule;
}): IntroTimelineState {
  const { startedAtMs, now, onFinished, trackCoarse = false, schedule = NO_RULES } = opts;
  const [state, setState] = useState<IntroTimelineState>(() => compute(now() - startedAtMs, schedule));
  const readNow = useEffectEvent(() => now());
  const fireFinished = useEffectEvent(() => onFinished?.());

  useEffect(() => {
    let raf = 0;
    let finished = false;
    let last: IntroTimelineState | null = null;
    const totalMs = schedule.total * 1000;
    const tick = () => {
      const elapsed = readNow() - startedAtMs;
      const next = compute(elapsed, schedule);
      if (!last || !same(last, next, trackCoarse)) {
        last = next;
        setState(next);
      }
      if (!finished && elapsed >= totalMs) {
        finished = true;
        fireFinished();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // rAF si ferma con la scheda in background: un timer garantisce comunque onFinished
    const iv = window.setInterval(() => {
      if (!finished && readNow() - startedAtMs >= totalMs) {
        finished = true;
        fireFinished();
      }
    }, 500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(iv);
    };
  }, [startedAtMs, trackCoarse, schedule]);

  return state;
}
