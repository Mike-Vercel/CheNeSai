/**
 * Da che dispositivo l'host crea la partita?
 *
 * - "desktop": PC o portatile (anche col touchscreen: il puntatore principale è il mouse) → si va
 *   dritti al TV come sempre (finestra sull'altro schermo o schermo intero qui).
 * - "handheld": telefono o tablet → dopo «CREA PARTITA» si sceglie dove giocare: sul televisore
 *   (il telefono fa da telecomando) oppure tutto su questo telefono, in verticale.
 *
 * Regole (in ordine), robuste ai casi strani:
 *  1. Client Hints `navigator.userAgentData.mobile` quando c'è (Chrome/Edge Android): vale quello;
 *  2. puntatore principale "grosso" (dito) e niente hover → dispositivo a mano, purché il lato
 *     corto dello schermo non sia da monitor (≤ 1100 px: telefoni e tablet, non le smart TV
 *     touch o i grandi monitor touch);
 *  3. altrimenti desktop.
 */
export type DeviceKind = "handheld" | "desktop";

export interface DeviceSignals {
  /** navigator.userAgentData.mobile (undefined se il browser non lo dice) */
  uaMobile?: boolean;
  /** (pointer: coarse) */
  coarse: boolean;
  /** (hover: hover) */
  hover: boolean;
  /** misure dello schermo in px CSS */
  screenWidth: number;
  screenHeight: number;
}

export const HANDHELD_MAX_SHORT_SIDE = 1100;

export function decideDevice(s: DeviceSignals): DeviceKind {
  if (s.uaMobile === true) return "handheld";
  const short = Math.min(s.screenWidth || 0, s.screenHeight || 0);
  if (s.uaMobile === false && !(s.coarse && !s.hover)) return "desktop";
  if (s.coarse && !s.hover && short > 0 && short <= HANDHELD_MAX_SHORT_SIDE) return "handheld";
  return "desktop";
}

/** Segnali del browser corrente (solo client). */
export function readDeviceSignals(): DeviceSignals {
  const mq = (q: string) => {
    try {
      return window.matchMedia(q).matches;
    } catch {
      return false;
    }
  };
  const ua = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  return {
    uaMobile: typeof ua?.mobile === "boolean" ? ua.mobile : undefined,
    coarse: mq("(pointer: coarse)"),
    hover: mq("(hover: hover)"),
    screenWidth: window.screen?.width ?? window.innerWidth,
    screenHeight: window.screen?.height ?? window.innerHeight,
  };
}

export function detectDevice(): DeviceKind {
  if (typeof window === "undefined") return "desktop";
  return decideDevice(readDeviceSignals());
}
