import { FULL_WINDOW, type FrameWindow } from "./studio-camera";

/**
 * La "finestra" dello studio: l'elemento dell'interfaccia (HUD) che resta libero per la scena 3D. La pagina lo
 * registra (ref), lo studio lo misura e inquadra ruota e presentatore lì dentro. Nessun React: un solo valore
 * condiviso tra l'HUD e il canvas (che vive in un altro albero di rendering).
 */
let windowEl: HTMLElement | null = null;

export function setStudioWindow(el: HTMLElement | null) {
  windowEl = el;
}

/**
 * Rettangolo della finestra in frazioni del canvas. Il canvas è fisso sullo schermo: la finestra si misura come se
 * la pagina non fosse scorsa (sul telefono il contenuto scorre SOPRA la scena, l'inquadratura resta ferma).
 */
export function readStudioWindow(canvas: HTMLElement): FrameWindow {
  const el = windowEl;
  if (!el || !el.isConnected) return FULL_WINDOW;
  const c = canvas.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (c.width < 2 || c.height < 2 || r.width < 2 || r.height < 2) return FULL_WINDOW;
  const sy = typeof window === "undefined" ? 0 : window.scrollY;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const win = {
    x0: clamp((r.left - c.left) / c.width),
    x1: clamp((r.right - c.left) / c.width),
    y0: clamp((r.top + sy - c.top) / c.height),
    y1: clamp((r.bottom + sy - c.top) / c.height),
  };
  if (win.x1 - win.x0 < 0.08 || win.y1 - win.y0 < 0.08) return FULL_WINDOW;
  return win;
}
