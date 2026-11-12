import { ICON_STROKE, WHEEL_ICONS } from "./icons";
import type { WheelSegment } from "./types";

/**
 * Disegno del disco della ruota su canvas (spicchi, separatori, icone, scritte ad arco), come in ruota.js
 * dell'utente ma con lo stile di GIRAMENTE!: verde / rosso / avorio, separatori in acciaio, icona al centro
 * dello spicchio e nome della casella lungo il bordo. Lo spicchio i occupa gli angoli canvas [i·s, (i+1)·s].
 */

export const DEFAULT_WHEEL_FONT = '"Arial Narrow", Impact, "Arial Black", sans-serif';

/** Raggi (frazioni del raggio del disco). */
export const DISC_LAYOUT = {
  hub: 0.27,
  icon: 0.53,
  iconSize: 0.25,
  text: 0.835,
  textMax: 0.105,
} as const;

function shade(hex: string, f: number): string {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
  const b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
}

export function segmentTextColor(seg: WheelSegment): string {
  return seg.textColor ?? (isLight(seg.color) ? "#15191C" : "#F4F6F7");
}

/** Testo lungo l'arco, centrato sull'angolo `mid`, lettere dritte verso l'esterno. */
function arcText(ctx: CanvasRenderingContext2D, text: string, c: number, r: number, mid: number, size: number, font: string, spacing: number) {
  ctx.font = `800 ${size}px ${font}`;
  const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let a = mid - total / r / 2;
  [...text].forEach((ch, i) => {
    const w = widths[i] - spacing;
    const ca = a + w / 2 / r;
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(ca + Math.PI / 2);
    ctx.strokeText(ch, 0, -r);
    ctx.fillText(ch, 0, -r);
    ctx.restore();
    a += widths[i] / r;
  });
}

function arcWidth(ctx: CanvasRenderingContext2D, text: string, size: number, font: string, spacing: number): number {
  ctx.font = `800 ${size}px ${font}`;
  return [...text].reduce((acc, ch) => acc + ctx.measureText(ch).width + spacing, 0) - spacing;
}

function drawIcon(ctx: CanvasRenderingContext2D, seg: WheelSegment, size: number, color: string, outline: string | null) {
  const parts = WHEEL_ICONS[seg.kind];
  const k = size / 24;
  ctx.save();
  ctx.translate(-size / 2, -size / 2);
  ctx.scale(k, k);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const pass of outline ? ["outline", "main"] : ["main"]) {
    for (const p of parts) {
      const path = new Path2D(p.d);
      if (pass === "outline") {
        ctx.strokeStyle = outline!;
        ctx.lineWidth = ICON_STROKE + 2.4;
        ctx.stroke(path);
        continue;
      }
      if (p.fill) {
        ctx.fillStyle = color;
        ctx.fill(path);
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = ICON_STROKE;
        ctx.stroke(path);
      }
    }
  }
  ctx.restore();
}

/** Disegna il disco su un canvas quadrato (lato `size`). */
export function drawWheelDisc(canvas: HTMLCanvasElement, segments: WheelSegment[], font: string = DEFAULT_WHEEL_FONT) {
  const size = canvas.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const c = size / 2;
  const rad = size / 2;
  const n = Math.max(1, segments.length);
  const step = (Math.PI * 2) / n;
  ctx.clearRect(0, 0, size, size);

  // spicchi: più chiari verso il centro, più scuri sul bordo
  segments.forEach((seg, i) => {
    const a0 = i * step;
    const g = ctx.createRadialGradient(c, c, rad * 0.2, c, c, rad);
    g.addColorStop(0, shade(seg.color, 1.18));
    g.addColorStop(0.7, seg.color);
    g.addColorStop(1, shade(seg.color, 0.62));
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, rad, a0, a0 + step);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
  });

  // ombra interna sul bordo (profondità sotto il cerchione)
  const rim = ctx.createRadialGradient(c, c, rad * 0.9, c, c, rad);
  rim.addColorStop(0, "rgba(0,0,0,0)");
  rim.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(c, c, rad, 0, Math.PI * 2);
  ctx.fill();

  // separatori in acciaio (ombra scura + filo chiaro)
  for (let i = 0; i < n; i++) {
    const a = i * step;
    const x = Math.cos(a);
    const y = Math.sin(a);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = size * 0.012;
    ctx.beginPath();
    ctx.moveTo(c + x * rad * DISC_LAYOUT.hub, c + y * rad * DISC_LAYOUT.hub);
    ctx.lineTo(c + x * rad, c + y * rad);
    ctx.stroke();
    ctx.strokeStyle = "#cfd6db";
    ctx.lineWidth = size * 0.0055;
    ctx.stroke();
  }

  // icone e scritte
  segments.forEach((seg, i) => {
    const mid = (i + 0.5) * step;
    const color = segmentTextColor(seg);
    const light = isLight(seg.color);
    const outline = light ? null : "rgba(0,0,0,0.55)";
    // icona: in piedi verso l'esterno dello spicchio
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(mid + Math.PI / 2);
    ctx.translate(0, -rad * DISC_LAYOUT.icon);
    ctx.shadowColor = light ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.5)";
    ctx.shadowBlur = size * 0.008;
    drawIcon(ctx, seg, rad * DISC_LAYOUT.iconSize, color, outline);
    ctx.restore();

    // nome lungo l'arco, rimpicciolito se lungo; su due righe se così viene più grande
    const label = String(seg.label ?? "").toLocaleUpperCase("it-IT");
    if (!label) return;
    const spacing = size * 0.002;
    const rText = rad * DISC_LAYOUT.text;
    const avail = (r: number) => r * step * 0.84;
    const maxSize = rad * DISC_LAYOUT.textMax;
    const fit = (text: string, r: number, max: number) => {
      let s = max;
      while (s > 10 && arcWidth(ctx, text, s, font, spacing) > avail(r)) s -= 2;
      return s;
    };
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.fillStyle = color;
    ctx.strokeStyle = light ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.7)";
    let size1 = fit(label, rText, maxSize);
    const words = label.split(" ");
    if (words.length > 1 && size1 < maxSize * 0.75) {
      let best: { lines: [string, string]; size: number } | null = null;
      for (let k = 1; k < words.length; k++) {
        const lines: [string, string] = [words.slice(0, k).join(" "), words.slice(k).join(" ")];
        const s2 = Math.min(fit(lines[0], rText + maxSize * 0.42, maxSize * 0.8), fit(lines[1], rText - maxSize * 0.5, maxSize * 0.8));
        if (!best || s2 > best.size) best = { lines, size: s2 };
      }
      if (best && best.size > size1) {
        ctx.lineWidth = best.size * 0.16;
        arcText(ctx, best.lines[0], c, rText + best.size * 0.5, mid, best.size, font, spacing);
        arcText(ctx, best.lines[1], c, rText - best.size * 0.55, mid, best.size, font, spacing);
        return;
      }
    }
    size1 = Math.max(10, size1);
    ctx.lineWidth = size1 * 0.16;
    arcText(ctx, label, c, rText, mid, size1, font, spacing);
  });
}
