import { TIG, inkOn } from "../palette";
import type { LedMode } from "./director";

/**
 * CONTENUTI DELLO SCHERMO LED (halo sospeso sopra il palco), disegnati su canvas. Solo dati pubblici: titoli,
 * classifica, sfide. La griglia dei pixel, la scansione e il lampeggio dell'allarme li fa lo shader (ledMaterial):
 * il canvas si ridisegna solo quando cambia il contenuto (o ~20 volte al secondo mentre la classifica scorre).
 */

export interface LedTeam {
  teamId: string;
  tableNo: number;
  name: string;
  color: string;
  /** punteggio mostrato (animato) */
  score: number;
  rank: number;
  /** posto sul podio (1..3, a parità decide l'ordine di classifica), 0 = fuori dal podio */
  place: number;
  /** riga mostrata (animata, 0 = prima) */
  row: number;
  level: 1 | 2 | 3;
}

export interface LedContent {
  mode: LedMode;
  title: string | null;
  subtitle: string | null;
  mancheNo: number | null;
  /** tutte le squadre (classifica, premiazione) */
  teams: LedTeam[];
  /** squadre dello spotlight (sfida, evoluzione, allarme) */
  focus: LedTeam[];
  /** premiazione: posti svelati (0..3, dal 3° al 1°) */
  awardsShown: number;
  /** fondo scala delle barre */
  scale: number;
}

/** Misure del canvas: proporzioni della parte dello schermo con i contenuti (arco 130°, raggio 5,4 m, alto 3,4 m). */
export const LED_CANVAS = { w: 2048, h: 600 } as const;

type Tone = "amber" | "cyan" | "alarm" | "gold" | "white" | "chaos" | "chill";
const TONES: Record<Tone, { fill: string; glow: string }> = {
  amber: { fill: "#ffe2bf", glow: TIG.amber },
  cyan: { fill: "#d6fbff", glow: TIG.cyan },
  alarm: { fill: "#ffd0d6", glow: TIG.alarm },
  gold: { fill: "#fff0c2", glow: TIG.gold },
  white: { fill: "#f6f8fb", glow: "#9fdcff" },
  chaos: { fill: "#f0dcff", glow: TIG.chaos },
  chill: { fill: "#dfe6ff", glow: TIG.chill },
};

function fit(ctx: CanvasRenderingContext2D, text: string, family: string, weight: string, max: number, maxW: number, min = 22): number {
  let size = max;
  for (; size > min; size -= 4) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  return size;
}

function glow(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tone: Tone, size: number, family: string, weight = "900", align: CanvasTextAlign = "center", track = 0) {
  const t = TONES[tone];
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (track) (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${track}px`;
  ctx.save();
  ctx.shadowColor = t.glow;
  ctx.shadowBlur = size * 0.32;
  ctx.fillStyle = t.glow;
  ctx.globalAlpha = 0.6;
  ctx.fillText(text, x, y);
  ctx.restore();
  ctx.lineWidth = Math.max(3, size * 0.05);
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = t.fill;
  ctx.fillText(text, x, y);
  if (track) (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";
}

function clip(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  let s = text;
  while (ctx.measureText(s).width > maxW && s.length > 2) s = `${s.slice(0, -2)}…`;
  return s;
}

function background(ctx: CanvasRenderingContext2D, w: number, h: number, a: string, b: string, intensity = 1) {
  ctx.fillStyle = "#020306";
  ctx.fillRect(0, 0, w, h);
  const g1 = ctx.createRadialGradient(w * 0.08, h * 0.5, 0, w * 0.08, h * 0.5, w * 0.5);
  g1.addColorStop(0, hexA(a, 0.34 * intensity));
  g1.addColorStop(1, hexA(a, 0));
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);
  const g2 = ctx.createRadialGradient(w * 0.92, h * 0.5, 0, w * 0.92, h * 0.5, w * 0.5);
  g2.addColorStop(0, hexA(b, 0.3 * intensity));
  g2.addColorStop(1, hexA(b, 0));
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);
  // griglia tattica tenue
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(255,255,255,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Cornice a "staffe" agli angoli (mirino tattico). */
function brackets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, len = 46, lw = 6) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (const [cx, cy, sx, sy] of [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ] as const) {
    ctx.moveTo(cx + sx * len, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * len);
  }
  ctx.stroke();
  ctx.restore();
}

function hazard(ctx: CanvasRenderingContext2D, w: number, h: number, band: number) {
  ctx.save();
  for (const y0 of [0, h - band]) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, w, band);
    ctx.clip();
    ctx.fillStyle = "#120206";
    ctx.fillRect(0, y0, w, band);
    ctx.fillStyle = TIG.alarm;
    for (let x = -band * 2; x < w + band * 2; x += band * 1.4) {
      ctx.beginPath();
      ctx.moveTo(x, y0 + band);
      ctx.lineTo(x + band * 0.7, y0 + band);
      ctx.lineTo(x + band * 1.4, y0);
      ctx.lineTo(x + band * 0.7, y0);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ schermate
function drawLogo(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, sub: string | null, title: string | null) {
  background(ctx, w, h, TIG.amber, TIG.cyan);
  const line = "TAVOLI IN GUERRA";
  const size = fit(ctx, `${line}!`, fam, "900", 250, w * 0.72);
  ctx.save();
  ctx.translate(w / 2, h * 0.43);
  ctx.font = `900 ${size}px ${fam}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const full = ctx.measureText(`${line}!`).width;
  const bang = ctx.measureText("!").width;
  // alone ambra
  ctx.shadowColor = TIG.amber;
  ctx.shadowBlur = 70;
  ctx.fillStyle = "rgba(255,138,31,0.45)";
  ctx.fillText(`${line}!`, 0, 0);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#000";
  ctx.strokeText(`${line}!`, 0, 0);
  const grad = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.48, "#e9eef4");
  grad.addColorStop(0.56, "#8b97a6");
  grad.addColorStop(1, "#f2f5f8");
  ctx.fillStyle = grad;
  ctx.textAlign = "left";
  ctx.fillText(line, -full / 2, 0);
  ctx.fillStyle = TIG.amber;
  ctx.fillText("!", full / 2 - bang, 0);
  ctx.restore();
  // filo tattico sotto il titolo
  ctx.fillStyle = hexA(TIG.amber, 0.85);
  ctx.fillRect(w * 0.22, h * 0.66, w * 0.56, 4);
  ctx.fillStyle = hexA(TIG.cyan, 0.7);
  ctx.fillRect(w * 0.47, h * 0.66 - 3, w * 0.06, 10);
  // il nome del gioco è già la riga grande: un titolo uguale non si ripete sotto
  if (title && title.replace(/[^A-Z]/gi, "").toUpperCase() === "TAVOLIINGUERRA") title = null;
  const tag = (title ?? sub ?? "OGNI TAVOLO CONTA").toUpperCase();
  glow(ctx, tag, w / 2, h * 0.78, "white", fit(ctx, tag, fam, "800", 70, w * 0.62), fam, "800", "center", 6);
  if (title && sub) glow(ctx, sub.toUpperCase(), w / 2, h * 0.91, "cyan", fit(ctx, sub.toUpperCase(), fam, "700", 40, w * 0.6), fam, "700");
  brackets(ctx, w * 0.12, h * 0.1, w * 0.76, h * 0.8, hexA(TIG.cyan, 0.5));
}

/**
 * Schermo "d'ambiente": quando l'HUD della pagina occupa il centro (prova in corso, risultati, QR) il LED non mostra
 * testo, così niente si sovrappone ai pannelli. Restano luce, griglia e un equalizzatore tenue nei colori del gioco.
 */
function drawAmbient(ctx: CanvasRenderingContext2D, w: number, h: number) {
  background(ctx, w, h, TIG.amber, TIG.cyan, 0.8);
  const n = 48;
  const gap = w / n;
  for (let i = 0; i < n; i++) {
    const k = Math.abs(Math.sin(i * 1.7) * 0.6 + Math.sin(i * 0.37) * 0.4);
    const bh = h * (0.08 + 0.3 * k);
    ctx.fillStyle = hexA(i < n / 2 ? TIG.amber : TIG.cyan, 0.16 + 0.14 * k);
    ctx.fillRect(i * gap + gap * 0.18, h / 2 - bh / 2, gap * 0.64, bh);
  }
  ctx.fillStyle = hexA(TIG.amber, 0.35);
  ctx.fillRect(w * 0.3, h * 0.88, w * 0.4, 3);
  brackets(ctx, w * 0.12, h * 0.1, w * 0.76, h * 0.8, hexA(TIG.cyan, 0.3));
}

function drawManche(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, c: LedContent) {
  background(ctx, w, h, TIG.amber, TIG.amber, 1.2);
  const over = c.mancheNo ? `MANCHE ${c.mancheNo}` : "MANCHE";
  // etichetta con le linee ai lati
  ctx.font = `800 64px ${fam}`;
  const ow = ctx.measureText(over).width;
  ctx.fillStyle = hexA(TIG.amber, 0.9);
  ctx.fillRect(w / 2 - ow / 2 - 260, h * 0.2 - 2, 220, 4);
  ctx.fillRect(w / 2 + ow / 2 + 40, h * 0.2 - 2, 220, 4);
  glow(ctx, over, w / 2, h * 0.2, "amber", 64, fam, "800", "center", 10);
  const title = (c.title ?? "SI COMINCIA").toUpperCase();
  glow(ctx, title, w / 2, h * 0.5, "white", fit(ctx, title, fam, "900", 230, w * 0.74), fam);
  if (c.subtitle) glow(ctx, c.subtitle.toUpperCase(), w / 2, h * 0.8, "amber", fit(ctx, c.subtitle.toUpperCase(), fam, "700", 60, w * 0.66), fam, "700");
  brackets(ctx, w * 0.1, h * 0.08, w * 0.8, h * 0.84, hexA(TIG.amber, 0.55));
}

function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, c: LedContent, tone: Tone, accentA: string, accentB: string, fallback: string) {
  background(ctx, w, h, accentA, accentB);
  const title = (c.title ?? fallback).toUpperCase();
  const sub = c.subtitle?.toUpperCase();
  if (c.mancheNo && c.mode === "title") glow(ctx, `MANCHE ${c.mancheNo}`, w / 2, h * 0.17, "cyan", 46, fam, "800", "center", 8);
  glow(ctx, title, w / 2, sub ? h * 0.46 : h * 0.52, tone, fit(ctx, title, fam, "900", 210, w * 0.72), fam);
  if (sub) glow(ctx, sub, w / 2, h * 0.76, "white", fit(ctx, sub, fam, "700", 64, w * 0.66), fam, "700");
  brackets(ctx, w * 0.12, h * 0.08, w * 0.76, h * 0.84, hexA(TONES[tone].glow, 0.5));
}

function drawLeaderboard(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, c: LedContent) {
  background(ctx, w, h, TIG.gold, TIG.amber, 0.8);
  const teams = c.teams;
  const n = teams.length;
  const cols = n <= 6 ? 1 : 2;
  const perCol = cols === 1 ? Math.max(1, n) : Math.ceil(Math.min(n, 20) / 2);
  const header = (c.title ?? "CLASSIFICA").toUpperCase();
  glow(ctx, header, w / 2, 56, "gold", fit(ctx, header, fam, "900", 74, w * 0.5), fam, "900", "center", 6);
  const top = 108;
  const bottom = h - 26;
  const rowH = Math.min(cols === 1 ? 82 : 78, (bottom - top) / perCol);
  // tutto dentro il 75% centrale: ai bordi lo schermo curvo scorcia troppo
  const colW = cols === 1 ? w * 0.56 : w * 0.33;
  const gap = w * 0.03;
  const x0s = cols === 1 ? [(w - colW) / 2] : [w / 2 - gap / 2 - colW, w / 2 + gap / 2];
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top - 4, w, bottom - top + 8);
  ctx.clip();
  for (const t of teams) {
    const r = t.row;
    if (r > perCol * cols - 0.5 + 0.6) continue;
    const col = Math.min(cols - 1, Math.floor(Math.max(0, r) / perCol + 1e-6));
    const ri = r - col * perCol;
    const x = x0s[col];
    const y = top + ri * rowH;
    const hgt = rowH * 0.8;
    const first = t.rank === 1;
    // fondo della riga
    ctx.fillStyle = first ? "rgba(255,201,74,0.16)" : "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.roundRect(x, y, colW, hgt, 10);
    ctx.fill();
    // barra del punteggio (colore della squadra)
    const bw = Math.max(0, Math.min(1, t.score / Math.max(1, c.scale))) * (colW - hgt * 3.1);
    const bx = x + hgt * 2.05;
    const grad = ctx.createLinearGradient(bx, 0, bx + Math.max(1, bw), 0);
    grad.addColorStop(0, hexA(t.color, 0.25));
    grad.addColorStop(1, hexA(t.color, 0.85));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(bx, y + hgt * 0.14, Math.max(4, bw), hgt * 0.72, 6);
    ctx.fill();
    // posizione
    ctx.fillStyle = first ? TIG.gold : "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.roundRect(x, y, hgt * 0.95, hgt, 10);
    ctx.fill();
    ctx.font = `900 ${Math.floor(hgt * 0.6)}px ${fam}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = first ? "#1a1204" : "#f3f6fa";
    ctx.fillText(String(t.rank), x + hgt * 0.475, y + hgt / 2 + 2);
    // numero del tavolo nel colore della squadra
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.roundRect(x + hgt * 1.02, y + hgt * 0.12, hgt * 0.92, hgt * 0.76, 8);
    ctx.fill();
    ctx.fillStyle = inkOn(t.color);
    ctx.font = `900 ${Math.floor(hgt * 0.5)}px ${fam}`;
    ctx.fillText(String(t.tableNo), x + hgt * 1.48, y + hgt / 2 + 2);
    // nome
    ctx.textAlign = "left";
    ctx.font = `800 ${Math.floor(hgt * 0.5)}px ${fam}`;
    ctx.fillStyle = "#f6f8fb";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    const name = clip(ctx, t.name.toUpperCase(), colW - hgt * 4.4);
    ctx.strokeText(name, x + hgt * 2.2, y + hgt / 2 + 2);
    ctx.fillText(name, x + hgt * 2.2, y + hgt / 2 + 2);
    // punteggio
    ctx.textAlign = "right";
    ctx.font = `900 ${Math.floor(hgt * 0.56)}px ${fam}`;
    ctx.fillStyle = first ? "#ffe9a8" : "#ffffff";
    ctx.fillText(Math.round(t.score).toLocaleString("it-IT"), x + colW - hgt * 0.25, y + hgt / 2 + 2);
  }
  ctx.restore();
}

function drawAlarm(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, c: LedContent) {
  background(ctx, w, h, TIG.alarm, TIG.alarm, 1.4);
  hazard(ctx, w, h, 54);
  const title = (c.title ?? "ALLARME CAOS!").toUpperCase();
  const size = fit(ctx, title, fam, "900", 230, w * 0.78);
  // sdoppiamento ciano/rosso (glitch fermo, il lampeggio lo fa lo shader)
  ctx.save();
  ctx.font = `900 ${size}px ${fam}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = TIG.cyan;
  ctx.fillText(title, w / 2 - 9, h * 0.47 - 3);
  ctx.fillStyle = TIG.alarm;
  ctx.fillText(title, w / 2 + 9, h * 0.47 + 3);
  ctx.restore();
  glow(ctx, title, w / 2, h * 0.47, "alarm", size, fam);
  const who = c.focus.length >= 2 ? `TAVOLO ${c.focus[0].tableNo}  ⚡  TAVOLO ${c.focus[1].tableNo}` : c.focus.length === 1 ? `TAVOLO ${c.focus[0].tableNo}` : null;
  const sub = (c.subtitle ?? who ?? "SFIDA SPECIALE · 45 SECONDI").toUpperCase();
  glow(ctx, sub, w / 2, h * 0.76, "white", fit(ctx, sub, fam, "800", 64, w * 0.7), fam, "800", "center", 4);
}

function teamBlock(ctx: CanvasRenderingContext2D, x: number, y: number, bw: number, bh: number, t: LedTeam, fam: string, side: "left" | "right") {
  const g = ctx.createLinearGradient(side === "left" ? x : x + bw, 0, side === "left" ? x + bw : x, 0);
  g.addColorStop(0, hexA(t.color, 0.75));
  g.addColorStop(1, hexA(t.color, 0.05));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(side === "left" ? x : x + bw, y);
  ctx.lineTo(side === "left" ? x + bw : x + bw * 0.08, y);
  ctx.lineTo(side === "left" ? x + bw * 0.92 : x, y + bh);
  ctx.lineTo(side === "left" ? x : x + bw, y + bh);
  ctx.closePath();
  ctx.fill();
  const cx = side === "left" ? x + bw * 0.42 : x + bw * 0.58;
  glow(ctx, `TAVOLO ${t.tableNo}`, cx, y + bh * 0.3, "white", 92, fam, "900");
  ctx.font = `800 64px ${fam}`;
  const name = clip(ctx, t.name.toUpperCase(), bw * 0.8);
  glow(ctx, name, cx, y + bh * 0.62, "white", fit(ctx, name, fam, "800", 64, bw * 0.8), fam, "800");
  ctx.font = `900 54px ${fam}`;
  glow(ctx, `${Math.round(t.score).toLocaleString("it-IT")} PT`, cx, y + bh * 0.86, "gold", 54, fam, "900");
}

function drawVs(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, c: LedContent) {
  const a = c.focus[0];
  const b = c.focus[1];
  background(ctx, w, h, a?.color ?? TIG.amber, b?.color ?? TIG.cyan, 1.1);
  const head = (c.title ?? "SFIDA").toUpperCase();
  glow(ctx, head, w / 2, 58, "amber", fit(ctx, head, fam, "900", 70, w * 0.5), fam, "900", "center", 8);
  const bw = w * 0.36;
  const by = 110;
  const bh = h - by - 34;
  if (a) teamBlock(ctx, w * 0.1, by, bw, bh, a, fam, "left");
  if (b) teamBlock(ctx, w * 0.9 - bw, by, bw, bh, b, fam, "right");
  // VS con il fulmine
  ctx.save();
  ctx.translate(w / 2, h * 0.56);
  ctx.fillStyle = TIG.amber;
  ctx.beginPath();
  ctx.moveTo(-30, -150);
  ctx.lineTo(42, -150);
  ctx.lineTo(4, -20);
  ctx.lineTo(54, -20);
  ctx.lineTo(-40, 160);
  ctx.lineTo(-6, 18);
  ctx.lineTo(-58, 18);
  ctx.closePath();
  ctx.globalAlpha = 0.28;
  ctx.fill();
  ctx.restore();
  glow(ctx, "VS", w / 2, h * 0.56, "amber", 200, fam, "900");
  if (c.subtitle) glow(ctx, c.subtitle.toUpperCase(), w / 2, h - 40, "white", fit(ctx, c.subtitle.toUpperCase(), fam, "700", 40, w * 0.3), fam, "700");
}

function drawEvolve(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, c: LedContent) {
  const t = c.focus[0];
  background(ctx, w, h, TIG.chaos, t?.color ?? TIG.chaos, 1.3);
  const title = (c.title ?? "EVOLUZIONE!").toUpperCase();
  glow(ctx, title, w / 2, h * 0.4, "chaos", fit(ctx, title, fam, "900", 220, w * 0.7), fam);
  const lvl = t ? (t.level >= 3 ? "LIVELLO 3 · LEGGENDARIA" : t.level === 2 ? "LIVELLO 2 · POTENZIATA" : "LIVELLO 1") : "";
  const sub = (c.subtitle ?? (t ? `TAVOLO ${t.tableNo} · ${lvl}` : "ENERGIA CAOS AL MASSIMO")).toUpperCase();
  glow(ctx, sub, w / 2, h * 0.74, "white", fit(ctx, sub, fam, "800", 68, w * 0.7), fam, "800", "center", 4);
  brackets(ctx, w * 0.12, h * 0.08, w * 0.76, h * 0.84, hexA(TIG.chaos, 0.6));
}

function drawAwards(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, c: LedContent) {
  background(ctx, w, h, TIG.gold, TIG.gold, 1.1);
  const head = (c.title ?? "PREMIAZIONE").toUpperCase();
  glow(ctx, head, w / 2, 58, "gold", fit(ctx, head, fam, "900", 76, w * 0.5), fam, "900", "center", 8);
  const podium = [2, 1, 3]; // da sinistra: 2°, 1°, 3°
  const frac: Record<number, number> = { 1: 1, 2: 0.82, 3: 0.68 };
  const colW = w * 0.21;
  const baseY = h - 22;
  const maxH = h - 132;
  podium.forEach((place, i) => {
    const x = w / 2 + (i - 1) * colW * 1.1 - colW / 2;
    const shown = c.awardsShown >= 4 - place;
    const team = c.teams.find((t) => t.place === place) ?? null;
    const ph = maxH * frac[place];
    const y = baseY - ph;
    const g = ctx.createLinearGradient(0, y, 0, baseY);
    g.addColorStop(0, shown && team ? hexA(team.color, 0.7) : "rgba(255,255,255,0.1)");
    g.addColorStop(1, shown && team ? hexA(team.color, 0.18) : "rgba(255,255,255,0.03)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, colW, ph, 14);
    ctx.fill();
    ctx.strokeStyle = place === 1 ? TIG.gold : "rgba(255,255,255,0.4)";
    ctx.lineWidth = place === 1 ? 6 : 4;
    ctx.stroke();
    glow(ctx, `${place}°`, x + colW / 2, y + 62, place === 1 ? "gold" : "white", place === 1 ? 96 : 80, fam, "900");
    if (shown && team) {
      const name = team.name.toUpperCase();
      ctx.font = `900 54px ${fam}`;
      const size = fit(ctx, name, fam, "900", 58, colW * 0.9, 30);
      glow(ctx, clip(ctx, name, colW * 0.92), x + colW / 2, y + 138, place === 1 ? "gold" : "white", size, fam, "900");
      glow(ctx, `TAVOLO ${team.tableNo}`, x + colW / 2, y + 190, "white", 38, fam, "700");
      if (ph > 300) glow(ctx, `${Math.round(team.score).toLocaleString("it-IT")} PT`, x + colW / 2, baseY - 46, "white", 50, fam, "900");
    } else {
      glow(ctx, "?", x + colW / 2, y + ph * 0.58, "white", 110, fam, "900");
    }
  });
}

/** Ridisegna lo schermo. `family` = carattere del gioco (già caricato dalla pagina). */
export function drawLed(canvas: HTMLCanvasElement, c: LedContent, family: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.save();
  // il disegno è pensato su 2048×616: in qualità low il canvas è più piccolo e si scala
  ctx.scale(w / LED_CANVAS.w, h / LED_CANVAS.h);
  const W = LED_CANVAS.w;
  const H = LED_CANVAS.h;
  switch (c.mode) {
    case "logo":
      drawLogo(ctx, W, H, family, c.subtitle, c.title);
      break;
    case "ambient":
      drawAmbient(ctx, W, H);
      break;
    case "manche":
      drawManche(ctx, W, H, family, c);
      break;
    case "title":
      drawTitle(ctx, W, H, family, c, "white", TIG.cyan, TIG.amber, "IN GIOCO");
      break;
    case "leaderboard":
      drawLeaderboard(ctx, W, H, family, c);
      break;
    case "alarm":
      drawAlarm(ctx, W, H, family, c);
      break;
    case "vs":
      drawVs(ctx, W, H, family, c);
      break;
    case "evolve":
      drawEvolve(ctx, W, H, family, c);
      break;
    case "break":
      drawTitle(ctx, W, H, family, { ...c, title: c.title ?? "PAUSA", subtitle: c.subtitle ?? "SI RIPARTE TRA POCO" }, "chill", TIG.chill, TIG.cyan, "PAUSA");
      break;
    case "final":
      drawTitle(ctx, W, H, family, { ...c, title: c.title ?? "TUTTO O NIENTE!" }, "gold", TIG.gold, TIG.amber, "TUTTO O NIENTE!");
      break;
    case "awards":
      drawAwards(ctx, W, H, family, c);
      break;
  }
  ctx.restore();
}
