import type { WheelKind, WheelSegment } from "./types";

/**
 * Palette di GIRAMENTE! (brief §2) e spicchi della ruota. Modulo puro: si può importare anche dal server.
 */
export const GIRAMENTE_PALETTE = {
  nero: "#080B0D",
  verde: "#39FF14",
  rosso: "#FF253A",
  ghiaccio: "#F4F6F7",
  grafite: "#20262B",
  oro: "#E2B33C",
} as const;

/** Colori degli spicchi: verde e rosso più profondi del neon (si leggono le scritte bianche), avorio caldo. */
export const SEGMENT_COLORS = {
  verde: "#0E9A3E",
  rosso: "#D3142A",
  avorio: "#EFE7D2",
} as const;

/** Scritta e icona sugli spicchi avorio (sugli altri: bianco ghiaccio con contorno scuro). */
export const IVORY_TEXT = "#15191C";

const G = SEGMENT_COLORS.verde;
const R = SEGMENT_COLORS.rosso;
const A = SEGMENT_COLORS.avorio;

/** Nome della casella come lo legge il pubblico (anche per il 2D e l'accessibilità). */
export const WHEEL_KIND_LABEL: Record<WheelKind, string> = {
  intruso: "Intruso",
  sequenza: "Sequenza",
  indizi: "Indizi",
  prospettiva: "Prospettiva",
  mistero: "Mistero",
  jolly: "Jolly",
  bonus: "Bonus",
  colpo: "Colpo di scena",
};

const seg = (kind: WheelKind, color: string, id: string = kind): WheelSegment => ({
  id,
  kind,
  label: WHEEL_KIND_LABEL[kind],
  color,
  ...(color === A ? { textColor: IVORY_TEXT } : {}),
});

/**
 * Le 8 caselle del brief, nell'ordine del brief (indice 0 = INTRUSO … 7 = COLPO DI SCENA).
 * Colori alternati senza mai due spicchi uguali vicini: verde, avorio, rosso, verde, rosso, avorio, verde, rosso.
 */
export const WHEEL_SEGMENTS_STANDARD: WheelSegment[] = [
  seg("intruso", G),
  seg("sequenza", A),
  seg("indizi", R),
  seg("prospettiva", G),
  seg("mistero", R),
  seg("jolly", A),
  seg("bonus", G),
  seg("colpo", R),
];

/** Il Giro Decisivo (manche 5): Intruso, Sequenza, Indizi, Prospettiva ripetute due volte. */
export const WHEEL_SEGMENTS_FINALE: WheelSegment[] = [
  seg("intruso", G, "intruso-1"),
  seg("sequenza", A, "sequenza-1"),
  seg("indizi", R, "indizi-1"),
  seg("prospettiva", A, "prospettiva-1"),
  seg("intruso", G, "intruso-2"),
  seg("sequenza", A, "sequenza-2"),
  seg("indizi", R, "indizi-2"),
  seg("prospettiva", A, "prospettiva-2"),
];
