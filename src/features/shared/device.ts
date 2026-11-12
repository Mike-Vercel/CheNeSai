"use client";

import { useSyncExternalStore } from "react";
import { detectDevice, type DeviceKind } from "@/features/gioca/device-mode";

/**
 * Dispositivo e impaginazione dello show (riutilizzabili da tutti i giochi).
 *
 * - `useDeviceKind`: PC/portatile ("desktop") o telefono/tablet ("handheld"), vedi device-mode.ts;
 * - `useShowLayout`: lo show interattivo va in ORIZZONTALE (le schermate 16:9 del TV, con i
 *   presentatori a lato) quando la finestra è larga e alta abbastanza (PC, tablet in orizzontale);
 *   altrimenti in VERTICALE (telefono, finestra stretta). Cambia da solo se si ridimensiona la finestra.
 */
export { useDeviceKind } from "@/features/gioca/use-device";
export type { DeviceKind };

export type ShowLayout = "landscape" | "portrait";

/** Rapporto minimo larghezza/altezza per lo show orizzontale. */
export const LANDSCAPE_MIN_RATIO = 1.2;
/** Misure minime (px CSS) della finestra per lo show orizzontale: sotto, le scritte del TV sarebbero troppo piccole. */
export const LANDSCAPE_MIN_WIDTH = 900;
export const LANDSCAPE_MIN_HEIGHT = 520;

export function decideShowLayout(w: number, h: number): ShowLayout {
  if (!w || !h) return "portrait";
  return w / h >= LANDSCAPE_MIN_RATIO && w >= LANDSCAPE_MIN_WIDTH && h >= LANDSCAPE_MIN_HEIGHT ? "landscape" : "portrait";
}

function subscribe(cb: () => void) {
  window.addEventListener("resize", cb);
  window.addEventListener("orientationchange", cb);
  return () => {
    window.removeEventListener("resize", cb);
    window.removeEventListener("orientationchange", cb);
  };
}

const layoutNow = (): ShowLayout => decideShowLayout(window.innerWidth, window.innerHeight);

export function useShowLayout(): ShowLayout {
  return useSyncExternalStore(subscribe, layoutNow, () => "portrait" as const);
}

/** Mostrare i suggerimenti dei tasti (1–4, Invio)? Solo dove c'è una tastiera vera: PC e portatili. */
export function useKeyHints(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => detectDevice() === "desktop",
    () => false,
  );
}
