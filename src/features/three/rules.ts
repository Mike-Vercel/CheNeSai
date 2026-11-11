"use client";

import { useEffect, useMemo, useState } from "react";
import { CAPTIONS, INTRO_DURATION_S, T, type Speaker } from "./timeline";
import { INTRO_SPEECH } from "@/features/game/speech";
import { formatPoints } from "@/features/game/lines";

/**
 * SPIEGAZIONE DELLE REGOLE (dopo la presentazione, prima del 3·2·1).
 *
 * Voci registrate opzionali in public/audio/regole/regola-01.mp3 … regola-10.mp3.
 * La durata di ogni battuta = durata della clip + 0.6 s; senza clip si stima dal testo
 * (~14 caratteri/s, minimo 2.5 s). Le durate si leggono dai metadati all'avvio (attesa
 * massima 1.5 s, poi si usano le stime) e la timeline resta una funzione pura del tempo
 * trascorso: una TV che ricarica riprende dal punto giusto.
 *
 * Nel tempo "di storia" il segmento è una pausa: la storia si ferma a T.rulesStart,
 * le regole scorrono con un orologio proprio, poi la storia riparte (countdown, finale).
 */

export type RuleIcon = "book" | "phone" | "timer" | "points" | "multi" | "gift" | "vote" | "trophy" | "fair" | "go";

export interface RuleLine {
  file: string;
  who: Speaker;
  text: string;
  title: string;
  /** Testo della scheda: {correct} e {wrong} sono sostituiti dai punti reali. */
  body: string;
  icon: RuleIcon;
}

export const RULES: readonly RuleLine[] = [
  { file: "regola-01.mp3", who: "professore", text: "Prima di cominciare, ecco le regole. Sono semplici, promesso!", title: "LE REGOLE", body: "In 30 secondi", icon: "book" },
  { file: "regola-02.mp3", who: "regina", text: "Le domande compaiono qui sullo schermo. Voi rispondete dal vostro telefono, toccando la risposta giusta.", title: "COME SI GIOCA", body: "Rispondi dal telefono", icon: "phone" },
  { file: "regola-03.mp3", who: "professore", text: "Avete pochi secondi: tenete d'occhio il timer! E attenzione, una volta confermata, la risposta non si cambia.", title: "TEMPO", body: "Occhio al timer · niente ripensamenti", icon: "timer" },
  { file: "regola-04.mp3", who: "regina", text: "Risposta giusta? Guadagnate punti. Risposta sbagliata? Ne perdete un po'. Quindi niente risposte a caso!", title: "PUNTI", body: "Giusta +{correct} · Sbagliata −{wrong}", icon: "points" },
  { file: "regola-05.mp3", who: "professore", text: "Occhio: alcune domande hanno più risposte giuste. Per fare punti pieni dovete selezionare tutte le molteplici risposte corrette!", title: "PIÙ RISPOSTE", body: "Selezionale tutte", icon: "multi" },
  { file: "regola-06.mp3", who: "palmino", text: "E poi ci sono io! Ogni tanto arrivo con una sorpresa: punti doppi, sfide lampo, super bonus… e chissà cos'altro!", title: "SORPRESE DI PALMINO", body: "Punti doppi · Sfida lampo · Super bonus", icon: "gift" },
  { file: "regola-07.mp3", who: "regina", text: "In certi momenti sarete voi a scegliere la categoria: votate dal telefono, vince la più votata.", title: "SCEGLI LA CATEGORIA", body: "Vota dal telefono", icon: "vote" },
  { file: "regola-08.mp3", who: "professore", text: "Dopo ogni round arriva la classifica. E i vostri punti contano anche per la classifica del mese!", title: "CLASSIFICA", body: "Ogni round + classifica del mese", icon: "trophy" },
  { file: "regola-09.mp3", who: "regina", text: "Un telefono a testa e niente ricerche su internet: qui vince chi ne sa davvero!", title: "FAIR PLAY", body: "Un telefono a testa · niente internet", icon: "fair" },
  { file: "regola-10.mp3", who: "palmino", text: "Tutto chiaro? Allora… che la sfida abbia inizio!", title: "PRONTI?", body: "Si parte!", icon: "go" },
];

export const RULES_AUDIO_DIR = "/audio/regole/";
export const INTRO_CLIP_DIR = "/audio/intro/";

export interface RulesScoring {
  correct: number;
  wrong: number;
  noAnswer: number;
}

/** Valori di anteprima (quando non c'è una sessione). */
export const DEFAULT_SCORING: RulesScoring = { correct: 1000, wrong: 400, noAnswer: 0 };

/** Stesso formato del resto dell'app (separatore delle migliaia sempre: 1.000). */
const fmt = (n: number) => formatPoints(Math.abs(Math.round(n)));

export function ruleBody(rule: RuleLine, scoring: RulesScoring): string {
  return rule.body.replace("{correct}", fmt(scoring.correct)).replace("{wrong}", fmt(scoring.wrong));
}

export interface RulesSlot {
  index: number;
  /** Secondi dall'inizio del segmento. */
  from: number;
  to: number;
  /** true se esiste la clip registrata (altrimenti voce del browser). */
  clip: boolean;
}

/** Pausa del tempo di storia (la storia resta ferma a `at` per `dur` secondi). */
export interface StoryHold {
  at: number;
  dur: number;
  /** true = è il segmento regole. */
  rules?: boolean;
}

export interface IntroSchedule {
  /** Inizio del segmento regole nel tempo di STORIA. */
  rulesStart: number;
  /** Inizio del segmento regole nel tempo REALE (dopo eventuali pause precedenti). */
  rulesRealStart: number;
  rules: readonly RulesSlot[];
  rulesTotal: number;
  /** Pause del tempo di storia in ordine (battute registrate più lunghe del loro spazio + regole). */
  holds: readonly StoryHold[];
  /** Durata complessiva reale dell'intro (s). */
  total: number;
}

const GAP = 0.6;
/** Respiro dopo una battuta registrata della presentazione. */
const LINE_GAP = 0.4;

/** Stima della durata di una battuta senza clip. */
export function estimateLine(text: string): number {
  return Math.max(2.5, text.length / 14);
}

export interface ClipDurations {
  rules: readonly (number | null)[];
  intro: Readonly<Record<string, number | null>>;
}

/**
 * Timeline completa: se una battuta registrata della presentazione è più lunga del suo spazio,
 * la storia si ferma (sulla sua didascalia) finché la clip finisce + 0.4 s; poi le regole
 * (se attive); il countdown parte sempre dopo l'ultima voce. Deterministica: dipende solo
 * dalle durate dei file (uguali su tutte le TV).
 */
export function buildSchedule(enabled: boolean, durations: ClipDurations | null): IntroSchedule {
  const holds: StoryHold[] = [];
  for (const line of INTRO_SPEECH) {
    const d = durations?.intro[line.clip] ?? null;
    if (d === null) continue;
    // fine dello spazio della battuta: la sua didascalia (l'annunciatore non ne ha: fino all'ingresso)
    const cap = CAPTIONS.find((c) => c.id === line.clip);
    const end = line.clip === "annunciatore" ? T.entrance - 0.1 : cap?.to;
    if (end === undefined) continue;
    const holdAt = end - 0.05; // la didascalia resta a schermo durante la pausa
    const extra = line.at + d + LINE_GAP - holdAt;
    if (extra > 0.02) holds.push({ at: holdAt, dur: extra });
  }
  const rules: RulesSlot[] = [];
  let rulesTotal = 0;
  if (enabled) {
    let at = 0.4; // breve respiro dopo la presentazione
    RULES.forEach((r, i) => {
      const d = durations?.rules[i] ?? null;
      const len = d !== null ? d + GAP : estimateLine(r.text);
      rules.push({ index: i, from: at, to: at + len, clip: d !== null });
      at += len;
    });
    rulesTotal = at + 0.3;
    holds.push({ at: T.rulesStart, dur: rulesTotal, rules: true });
  }
  holds.sort((a, b) => a.at - b.at);
  let acc = 0;
  let rulesRealStart = T.rulesStart;
  for (const h of holds) {
    if (h.rules) rulesRealStart = h.at + acc;
    acc += h.dur;
  }
  return { rulesStart: T.rulesStart, rulesRealStart, rules, rulesTotal, holds, total: INTRO_DURATION_S + acc };
}

export const NO_RULES: IntroSchedule = buildSchedule(false, null);

/** Tempo di storia: fermo durante le pause (battute lunghe, regole), poi riprende. */
export function storyTime(e: number, s: IntroSchedule): number {
  let acc = 0;
  for (const h of s.holds) {
    const start = h.at + acc;
    if (e < start) return e - acc;
    if (e < start + h.dur) return h.at;
    acc += h.dur;
  }
  return e - acc;
}

/** Istante REALE in cui la storia raggiunge `s` (somma delle pause precedenti). */
export function realTimeOf(s: number, sch: IntroSchedule): number {
  let acc = 0;
  for (const h of sch.holds) if (h.at < s) acc += h.dur;
  return s + acc;
}

/**
 * Peso 0..1 dell'inquadratura stretta su chi parla: sale in ~0.6 s all'inizio della battuta
 * (didascalia o regola) e scende alla fine, contando anche le pause per le clip lunghe.
 */
export function speakerZoom(e: number, sch: IntroSchedule, t: number): number {
  const ramp = (x: number) => {
    const k = Math.min(1, Math.max(0, x / 0.6));
    return k * k * (3 - 2 * k);
  };
  const r = rulesTime(e, sch);
  if (r >= 0) {
    for (const slot of sch.rules) if (r >= slot.from && r < slot.to) return ramp(r - slot.from) * ramp(slot.to - 0.2 - r);
    return 0;
  }
  // presentazione: niente stacco su chi parla (inquadratura larga / a tre), solo durante le regole
  void t;
  return 0;
}

/** Secondi dall'inizio del segmento regole, oppure -1 se fuori dal segmento. */
export function rulesTime(e: number, s: IntroSchedule): number {
  if (s.rulesTotal <= 0) return -1;
  const r = e - s.rulesRealStart;
  return r >= 0 && r < s.rulesTotal ? r : -1;
}

/** Indice della scheda/battuta in corso (o null). */
export function ruleAt(e: number, s: IntroSchedule): number | null {
  const r = rulesTime(e, s);
  if (r < 0) return null;
  for (const slot of s.rules) if (r >= slot.from && r < slot.to) return slot.index;
  return null;
}

// ------------------------------------------------------------------ durate delle clip
let durationsPromise: Promise<ClipDurations> | null = null;

function clipDuration(url: string): Promise<number | null> {
  return new Promise<number | null>((resolve) => {
    if (typeof Audio === "undefined") return resolve(null);
    const a = new Audio();
    a.preload = "metadata";
    const done = (v: number | null) => {
      a.onloadedmetadata = null;
      a.onerror = null;
      a.removeAttribute("src");
      resolve(v);
    };
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : null);
    a.onerror = () => done(null);
    a.src = url;
  });
}

/** Durate (s) delle clip registrate (intro + regole), null se il file manca. Una sola lettura per pagina. */
function loadDurations(): Promise<ClipDurations> {
  if (durationsPromise) return durationsPromise;
  durationsPromise = Promise.all([
    Promise.all(RULES.map((r) => clipDuration(`${RULES_AUDIO_DIR}${r.file}`))),
    Promise.all(INTRO_SPEECH.map((l) => clipDuration(`${INTRO_CLIP_DIR}${l.clip}.mp3`))),
  ]).then(([rules, intro]) => ({ rules, intro: Object.fromEntries(INTRO_SPEECH.map((l, i) => [l.clip, intro[i]])) }));
  return durationsPromise;
}

/**
 * Timeline dell'intro (pause per le battute registrate + regole). Parte con le stime e passa alle
 * durate reali se arrivano entro 1.5 s (poi resta sulle stime, per non far "saltare" la scena).
 */
export function useIntroSchedule(enabled: boolean): IntroSchedule {
  const [durations, setDurations] = useState<ClipDurations | null>(null);
  useEffect(() => {
    let alive = true;
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 1500));
    void Promise.race([loadDurations(), timeout]).then((d) => {
      if (alive && d) setDurations(d);
    });
    return () => {
      alive = false;
    };
  }, []);
  return useMemo(() => buildSchedule(enabled, durations), [enabled, durations]);
}
