"use client";

import { createContext, useContext, type RefObject } from "react";
import type { Speaker } from "../timeline";

/**
 * Orologio della scena, aggiornato una volta per frame (priorità negativa)
 * da `IntroClockDriver` e letto dagli altri `useFrame` senza allocazioni.
 *  - t: tempo di STORIA in secondi, bloccato a [0, durata] (si ferma durante le regole)
 *  - e: tempo trascorso NON bloccato (animazioni "idle" che continuano nel frame finale)
 */
export interface IntroClock {
  t: number;
  e: number;
  /** Delta del frame (s), limitato per evitare salti dopo un tab in background. */
  dt: number;
  reducedMotion: boolean;
  lowPower: boolean;
  /** Pixel per unità-mondo a distanza 1 (per gl_PointSize degli shader a punti). */
  pointScale: number;
  /** Chi parla secondo il copione (didascalia o regola in corso). */
  speaker: Speaker | null;
  /** Peso 0..1 dell'inquadratura stretta su chi parla (vedi rules.ts → speakerZoom). */
  zoom: number;
  /** Tempo di storia NON bloccato alla durata (per effetti che continuano nel frame finale). */
  s: number;
  /** Regola in corso (indice) o -1. Durante le regole `t` (tempo di storia) resta fermo. */
  rule: number;
  /** Presentatori GLB che entrano a piedi (il loro podio resta fermo, le luci seguono loro). */
  walking: { professore: boolean; regina: boolean };
}

export const IntroClockContext = createContext<RefObject<IntroClock> | null>(null);

export function useIntroClock(): RefObject<IntroClock> {
  const ctx = useContext(IntroClockContext);
  if (!ctx) throw new Error("useIntroClock fuori da IntroClockContext");
  return ctx;
}

/** Segnala alla scena che un presentatore entra a piedi (GLB): podio fermo, luci che seguono lui/lei. */
export function setHostWalking(clock: RefObject<IntroClock>, who: "professore" | "regina", on: boolean) {
  clock.current.walking[who] = on;
}
