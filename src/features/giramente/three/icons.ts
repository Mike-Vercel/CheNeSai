import type { WheelKind } from "./types";

/**
 * Icone degli spicchi, disegnate da noi (riquadro 24×24, stesso tracciato per il canvas della ruota 3D
 * tramite Path2D e per la ruota 2D in SVG). Abbinamento come nel mockup approvato:
 * lente = Intruso, barre = Sequenza, lampadina = Indizi, quadro = Prospettiva, puzzle = Mistero,
 * stella = Jolly, monete = Bonus, fulmine = Colpo di scena.
 */
export interface IconPart {
  d: string;
  /** true = pieno, false = solo contorno (spessore relativo al riquadro 24) */
  fill: boolean;
}

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

export const WHEEL_ICONS: Record<WheelKind, IconPart[]> = {
  intruso: [
    { d: "M16.5 10a6.5 6.5 0 1 1-13 0a6.5 6.5 0 1 1 13 0Z", fill: false },
    { d: "M14.8 14.8L21 21", fill: false },
  ],
  sequenza: [{ d: "M3 15h4.4v6H3Z M9.8 10h4.4v11H9.8Z M16.6 4H21v17h-4.4Z", fill: true }],
  indizi: [
    { d: "M12 4.5a5.6 5.6 0 0 0-3.4 10c.6.5.9 1.1.9 1.8v.4h5v-.4c0-.7.3-1.3.9-1.8A5.6 5.6 0 0 0 12 4.5Z", fill: false },
    { d: "M9.6 19.4h4.8 M10.6 22h2.8", fill: false },
    { d: "M12 .8v1.4 M3.6 4.2l1 1 M20.4 4.2l-1 1 M1.6 10.2H3 M21 10.2h1.4", fill: false },
  ],
  prospettiva: [
    { d: "M2.5 4.5h19v15h-19Z", fill: false },
    { d: "M2.5 17l5.5-5.5 4.5 4.5 3-3 6 6", fill: false },
    { d: "M18.4 8.6a1.9 1.9 0 1 1-3.8 0a1.9 1.9 0 1 1 3.8 0Z", fill: true },
  ],
  mistero: [{ d: "M4 7h4a2.2 2.2 0 1 1 4 0h4v4a2.2 2.2 0 1 1 0 4v4h-4a2.2 2.2 0 1 0-4 0H4v-4a2.2 2.2 0 1 0 0-4Z", fill: false }],
  jolly: [{ d: starPath(12, 12.6, 10.4, 4.3), fill: true }],
  bonus: [
    { d: "M5 6.5a7 2.6 0 1 0 14 0a7 2.6 0 1 0-14 0Z", fill: false },
    { d: "M5 6.5v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4", fill: false },
    { d: "M5 10.5v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4", fill: false },
    { d: "M5 14.5v3.5c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-3.5", fill: false },
  ],
  colpo: [{ d: "M13.6 1.5L3.8 13.8h6.6L8.6 22.5 20.2 9.4h-6.7L15.6 1.5Z", fill: true }],
};

/** Spessore del tratto nel riquadro 24. */
export const ICON_STROKE = 2.1;
