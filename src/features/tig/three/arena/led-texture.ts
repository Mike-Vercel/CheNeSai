import { TIG, inkOn } from "../palette";
import type { LedMode } from "./director";
import { seeded } from "./pirate-textures";

/**
 * CONTENUTI DELLA GRANDE VELA (edizione pirati: la tela tesa sul pennone fa da "schermo"), DIPINTI su canvas. Solo
 * dati pubblici: titoli, classifica, sfide. Tela di lino con i ferzi cuciti e le macchie del mare, testi in inchiostro
 * scuro (titoli col carattere del gioco, numeri ed etichette con quello dei numeri: leggibili da lontano), rosso
 * ocra e oro come accenti; nell'ALLARME la vela diventa rossa. Il canvas si ridisegna solo quando cambia il contenuto
 * (o ~20 volte al secondo mentre la classifica scorre); vento e luce delle lanterne li fa lo shader (sailMaterial).
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

/** Misure del canvas: proporzioni della vela (≈ 11,9 × 4,3 m). */
export const LED_CANVAS = { w: 2048, h: 740 } as const;

/** Nome del gioco sul logo della vela (senza punto esclamativo) e motto di riserva sotto il nome. */
export const GAME_NAME = "TAVERNA DEI PIRATI";
export const GAME_MOTTO = "OGNI TAVOLO È UNA CIURMA";

/**
 * Il titolo passato dalla pagina è il nome del gioco (nuovo o vecchio)? Allora sotto il logo non si ripete.
 * Confronto sulle sole lettere, senza maiuscole/minuscole né punteggiatura.
 */
export function isGameName(title: string | null | undefined): boolean {
  const k = (title ?? "").replace(/[^A-Z]/gi, "").toUpperCase();
  return k === "TAVERNADEIPIRATI" || k === "LATAVERNADEIPIRATI" || k === "TAVOLIINGUERRA";
}

/** Colonne della classifica sulla vela: 1 fino a 6 squadre, 2 fino a 16, poi 3 (24 tavoli = 3 × 8 righe). */
export function ledLeaderboardCols(n: number): 1 | 2 | 3 {
  return n <= 6 ? 1 : n <= 16 ? 2 : 3;
}

// ------------------------------------------------------------------ colori della pittura
const INK = "#21160e";
const INK_SOFT = "rgba(33,22,14,0.55)";
const OCHRE = "#9a2e1c";
const CREAM = "#f6ead2";

function fit(ctx: CanvasRenderingContext2D, text: string, family: string, weight: string, max: number, maxW: number, min = 22): number {
  let size = max;
  for (; size > min; size -= 4) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  return size;
}

function clip(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  let s = text;
  while (ctx.measureText(s).width > maxW && s.length > 2) s = `${s.slice(0, -2)}…`;
  return s;
}

function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(255,255,255,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * Scritta "dipinta": un'ombra appena spostata (la vernice ha spessore), poi il colore. Con `outline` un filo scuro
 * attorno (per i testi chiari sulla tela rossa o per l'oro).
 */
function paint(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, family: string, color: string, opts: { weight?: string; align?: CanvasTextAlign; outline?: string; track?: number } = {}) {
  const { weight = "400", align = "center", outline, track = 0 } = opts;
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  const ls = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if (track) ls.letterSpacing = `${track}px`;
  ctx.save();
  ctx.fillStyle = "rgba(20,12,6,0.22)";
  ctx.fillText(text, x + size * 0.025, y + size * 0.035);
  ctx.restore();
  if (outline) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(4, size * 0.08);
    ctx.strokeStyle = outline;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  if (track) ls.letterSpacing = "0px";
}

// ------------------------------------------------------------------ la tela
type ClothTone = "linen" | "red" | "night" | "gold";

/**
 * Tela della vela: lino caldo più chiaro al centro, ferzi verticali cuciti (cuciture e punti), macchie di salsedine,
 * orlo più scuro (la "guaina"), una fila di matafioni in alto. Toni: lino, rossa (allarme), notte (pausa), dorata.
 */
function cloth(ctx: CanvasRenderingContext2D, w: number, h: number, tone: ClothTone = "linen") {
  const pal: Record<ClothTone, [string, string, string]> = {
    linen: ["#f4e8cc", "#e6d4ab", "#c4ab7c"],
    red: ["#b43424", "#8f2219", "#5a120c"],
    night: ["#cfc7b4", "#b3ab98", "#857d6c"],
    gold: ["#f7e4b0", "#e9cc86", "#c49a4c"],
  };
  const [hi, mid, lo] = pal[tone];
  const g = ctx.createRadialGradient(w * 0.5, h * 0.62, h * 0.1, w * 0.5, h * 0.55, w * 0.62);
  g.addColorStop(0, hi);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // ferzi: cuciture verticali con i punti
  const panels = 10;
  for (let i = 1; i < panels; i++) {
    const x = (i / panels) * w;
    ctx.fillStyle = "rgba(60,40,20,0.12)";
    ctx.fillRect(x - 3, 0, 6, h);
    ctx.fillStyle = "rgba(255,250,235,0.18)";
    ctx.fillRect(x + 3, 0, 2, h);
    ctx.fillStyle = "rgba(60,40,20,0.25)";
    for (let y = 8; y < h; y += 18) ctx.fillRect(x - 1, y, 2, 7);
  }
  // macchie di salsedine e d'uso
  const rnd = seeded(tone === "red" ? 41 : 17);
  for (let i = 0; i < 9; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 60 + rnd() * 160;
    const sg = ctx.createRadialGradient(x, y, 0, x, y, r);
    sg.addColorStop(0, tone === "red" ? "rgba(40,6,4,0.12)" : "rgba(120,90,50,0.1)");
    sg.addColorStop(1, "rgba(120,90,50,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // orlo (guaina) e matafioni
  ctx.strokeStyle = tone === "red" ? "rgba(30,4,2,0.45)" : "rgba(80,55,28,0.35)";
  ctx.lineWidth = 22;
  ctx.strokeRect(11, 11, w - 22, h - 22);
  ctx.fillStyle = tone === "red" ? "rgba(30,4,2,0.5)" : "rgba(80,55,28,0.45)";
  for (let x = 60; x < w - 40; x += 92) {
    ctx.beginPath();
    ctx.arc(x, 46, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ disegnini (generici, originali)
/** Rosa dei venti: punte a due toni (lato in luce e lato in ombra), anello. `hex` + `alpha` = colore della pittura. */
function compassRose(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hex: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.55 : r;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a + side * 0.24) * r * 0.2, Math.sin(a + side * 0.24) * r * 0.2);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      ctx.closePath();
      ctx.fillStyle = hexA(hex, side < 0 ? alpha : alpha * 0.5);
      ctx.fill();
    }
  }
  ctx.lineWidth = Math.max(2, r * 0.03);
  ctx.strokeStyle = hexA(hex, alpha);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function swords(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  for (const r of [-0.62, 0.62]) {
    ctx.save();
    ctx.rotate(r);
    // lama ricurva + elsa
    ctx.beginPath();
    ctx.moveTo(-4 * s, -46 * s);
    ctx.quadraticCurveTo(10 * s, -10 * s, 3 * s, 40 * s);
    ctx.lineTo(-4 * s, 40 * s);
    ctx.quadraticCurveTo(2 * s, -10 * s, -10 * s, -44 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-14 * s, 38 * s, 22 * s, 6 * s);
    ctx.fillRect(-4 * s, 44 * s, 6 * s, 14 * s);
    ctx.restore();
  }
  ctx.restore();
}

function skull(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, hole: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -6 * s, 30 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-18 * s, 10 * s, 36 * s, 20 * s);
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(-11 * s, -6 * s, 8 * s, 0, Math.PI * 2);
  ctx.arc(11 * s, -6 * s, 8 * s, 0, Math.PI * 2);
  ctx.fill();
  // sorriso simpatico
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = hole;
  ctx.beginPath();
  ctx.arc(0, 12 * s, 10 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function coin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, "#ffeaa8");
  g.addColorStop(0.6, "#e5aa36");
  g.addColorStop(1, "#9b6716");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7a4f10";
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.stroke();
}

/** Sigillo di ceralacca con un numero (posizione in classifica). */
function seal(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, num: string, fam: string, gold = false) {
  ctx.save();
  if (gold) coin(ctx, x, y, r);
  else {
    ctx.fillStyle = "#8e1f18";
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr = r * (i % 2 ? 0.92 : 1.02);
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(60,8,4,0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.74, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.font = `900 ${Math.floor(r * 1.05)}px ${fam}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = gold ? "#4a2c06" : CREAM;
  ctx.fillText(num, x, y + r * 0.06);
  ctx.restore();
}

/** Bandierina della ciurma (coda di rondine) col numero del tavolo. */
function pennant(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, num: string, fam: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w * 0.82, y + h / 2);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(33,22,14,0.55)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "rgba(33,22,14,0.8)";
  ctx.fillRect(x - 5, y - 6, 5, h + 12);
  ctx.font = `900 ${Math.floor(h * 0.62)}px ${fam}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = inkOn(color);
  ctx.fillText(num, x + w * 0.42, y + h / 2 + 2);
  ctx.restore();
}

/** Nave stilizzata di profilo (scafo, albero, vela nel colore della squadra). `flip` = guarda a sinistra. */
function ship(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, sail: string, flip: boolean) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = "#3a2414";
  ctx.beginPath();
  ctx.moveTo(-120 * s, 0);
  ctx.lineTo(130 * s, 0);
  ctx.lineTo(100 * s, 42 * s);
  ctx.lineTo(-96 * s, 42 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-120 * s, -26 * s, 44 * s, 28 * s);
  ctx.fillStyle = "#2a190d";
  ctx.fillRect(-6 * s, -170 * s, 8 * s, 172 * s);
  ctx.fillStyle = sail;
  ctx.beginPath();
  ctx.moveTo(-70 * s, -150 * s);
  ctx.quadraticCurveTo(0, -120 * s, 70 * s, -150 * s);
  ctx.lineTo(80 * s, -40 * s);
  ctx.quadraticCurveTo(0, -10 * s, -80 * s, -40 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(33,22,14,0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();
  // onde sotto
  ctx.strokeStyle = "rgba(15,59,74,0.6)";
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  for (let k = -150; k <= 150; k += 30) ctx.arc(k * s, 52 * s, 15 * s, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ schermate
function drawLogo(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, num: string, sub: string | null, title: string | null) {
  cloth(ctx, w, h);
  compassRose(ctx, w * 0.5, h * 0.47, h * 0.62, INK, 0.1);
  swords(ctx, w * 0.5, h * 0.16, 0.95, OCHRE);
  const line = GAME_NAME;
  const size = fit(ctx, line, fam, "400", 250, w * 0.8);
  paint(ctx, line, w / 2, h * 0.47, size, fam, INK);
  ctx.fillStyle = OCHRE;
  ctx.fillRect(w * 0.26, h * 0.67, w * 0.48, 5);
  // il nome del gioco è già la riga grande: un titolo uguale non si ripete sotto
  if (isGameName(title)) title = null;
  const tag = (title ?? sub ?? GAME_MOTTO).toUpperCase();
  paint(ctx, tag, w / 2, h * 0.79, fit(ctx, tag, num, "700", 66, w * 0.66), num, INK, { weight: "700", track: 4 });
  if (title && sub) paint(ctx, sub.toUpperCase(), w / 2, h * 0.91, fit(ctx, sub.toUpperCase(), num, "700", 38, w * 0.6), num, OCHRE, { weight: "700" });
}

/** Vela "d'ambiente": quando l'HUD della pagina occupa il centro (prova, risultati, QR) la vela non porta testo. */
function drawAmbient(ctx: CanvasRenderingContext2D, w: number, h: number) {
  cloth(ctx, w, h);
  compassRose(ctx, w * 0.5, h * 0.54, h * 0.4, INK, 0.2);
  skull(ctx, w * 0.5, h * 0.54, 1.3, "rgba(33,22,14,0.22)", "rgba(244,232,204,0.6)");
}

function drawManche(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, num: string, c: LedContent) {
  cloth(ctx, w, h);
  const over = c.mancheNo ? `MANCHE ${c.mancheNo}` : "MANCHE";
  ctx.font = `700 60px ${num}`;
  const ow = ctx.measureText(over).width + 40;
  ctx.fillStyle = OCHRE;
  ctx.fillRect(w / 2 - ow / 2 - 230, h * 0.2 - 2, 200, 5);
  ctx.fillRect(w / 2 + ow / 2 + 30, h * 0.2 - 2, 200, 5);
  paint(ctx, over, w / 2, h * 0.2, 60, num, OCHRE, { weight: "700", track: 10 });
  const title = (c.title ?? "SI COMINCIA").toUpperCase();
  paint(ctx, title, w / 2, h * 0.5, fit(ctx, title, fam, "400", 230, w * 0.8), fam, INK);
  if (c.subtitle) paint(ctx, c.subtitle.toUpperCase(), w / 2, h * 0.8, fit(ctx, c.subtitle.toUpperCase(), num, "700", 58, w * 0.72), num, INK_SOFT, { weight: "700" });
}

function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, num: string, c: LedContent, tone: ClothTone, color: string, fallback: string) {
  cloth(ctx, w, h, tone);
  const title = (c.title ?? fallback).toUpperCase();
  const sub = c.subtitle?.toUpperCase();
  if (c.mancheNo && c.mode === "title") paint(ctx, `MANCHE ${c.mancheNo}`, w / 2, h * 0.17, 46, num, OCHRE, { weight: "700", track: 8 });
  paint(ctx, title, w / 2, sub ? h * 0.47 : h * 0.53, fit(ctx, title, fam, "400", 220, w * 0.8), fam, color);
  if (sub) paint(ctx, sub, w / 2, h * 0.78, fit(ctx, sub, num, "700", 60, w * 0.72), num, tone === "night" ? "#2b2a34" : INK_SOFT, { weight: "700" });
}

/**
 * Classifica come una MAPPA DEL TESORO: ogni riga è una rotta tratteggiata che parte dalla bandierina della ciurma
 * e si allunga coi punti fino a una pila di dobloni; posizioni nei sigilli di ceralacca (il primo è un doblone).
 */
function drawLeaderboard(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, num: string, c: LedContent) {
  cloth(ctx, w, h);
  compassRose(ctx, w * 0.93, h * 0.17, 70, INK, 0.35);
  const teams = c.teams;
  const n = teams.length;
  const cols = ledLeaderboardCols(n);
  const perCol = Math.max(1, Math.ceil(Math.min(n, 24) / cols));
  const header = (c.title ?? "CLASSIFICA").toUpperCase();
  paint(ctx, header, w / 2, 74, fit(ctx, header, fam, "400", 96, w * 0.5), fam, INK);
  const top = 140;
  const bottom = h - 34;
  const rowH = Math.min(cols === 1 ? 96 : 92, (bottom - top) / perCol);
  const gap = cols === 3 ? w * 0.016 : w * 0.035;
  const colW = cols === 1 ? w * 0.6 : cols === 2 ? w * 0.4 : (w * 0.8 - gap * 2) / 3;
  const x0s = cols === 1 ? [(w - colW) / 2] : cols === 2 ? [w / 2 - gap / 2 - colW, w / 2 + gap / 2] : [w / 2 - colW * 1.5 - gap, w / 2 - colW / 2, w / 2 + colW / 2 + gap];
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top - 6, w, bottom - top + 12);
  ctx.clip();
  for (const t of teams) {
    const r = t.row;
    if (r > perCol * cols - 0.5 + 0.6) continue;
    const col = Math.min(cols - 1, Math.floor(Math.max(0, r) / perCol + 1e-6));
    const ri = r - col * perCol;
    const x = x0s[col];
    const y = top + ri * rowH;
    const hgt = rowH * 0.82;
    const cy = y + hgt / 2;
    const first = t.rank === 1;
    // riga: fascia di pergamena più chiara
    ctx.fillStyle = first ? "rgba(242,177,52,0.22)" : "rgba(255,248,230,0.32)";
    ctx.beginPath();
    ctx.roundRect(x, y, colW, hgt, 12);
    ctx.fill();
    // posizione nel sigillo (il primo: un doblone)
    seal(ctx, x + hgt * 0.5, cy, hgt * 0.42, String(t.rank), num, first);
    // bandierina col numero del tavolo
    pennant(ctx, x + hgt * 1.08, y + hgt * 0.16, hgt * 1.0, hgt * 0.68, t.color, String(t.tableNo), num);
    // nome
    const nx = x + hgt * 2.3;
    ctx.font = `700 ${Math.floor(hgt * 0.44)}px ${num}`;
    const nameW = colW - hgt * 2.3 - hgt * 2.6;
    const name = clip(ctx, t.name.toUpperCase(), nameW);
    paint(ctx, name, nx, cy - hgt * 0.13, Math.floor(hgt * 0.44), num, INK, { weight: "700", align: "left" });
    // rotta tratteggiata proporzionale ai punti, con la X del tesoro per chi guida
    const routeW = Math.max(0, Math.min(1, t.score / Math.max(1, c.scale))) * nameW;
    ctx.save();
    ctx.setLineDash([12, 9]);
    ctx.strokeStyle = first ? OCHRE : "rgba(33,22,14,0.55)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(nx, cy + hgt * 0.27);
    ctx.lineTo(nx + Math.max(8, routeW), cy + hgt * 0.27);
    ctx.stroke();
    ctx.restore();
    if (first && routeW > 20) {
      ctx.strokeStyle = OCHRE;
      ctx.lineWidth = 6;
      const ex = nx + routeW + 14;
      const ey = cy + hgt * 0.27;
      ctx.beginPath();
      ctx.moveTo(ex - 10, ey - 10);
      ctx.lineTo(ex + 10, ey + 10);
      ctx.moveTo(ex + 10, ey - 10);
      ctx.lineTo(ex - 10, ey + 10);
      ctx.stroke();
    }
    // punteggio con il doblone
    const sx = x + colW - hgt * 0.32;
    coin(ctx, sx - hgt * 0.22, cy, hgt * 0.2);
    paint(ctx, Math.round(t.score).toLocaleString("it-IT"), sx - hgt * 0.55, cy + 2, Math.floor(hgt * 0.52), num, first ? OCHRE : INK, { weight: "900", align: "right" });
  }
  ctx.restore();
}

function drawAlarm(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, num: string, c: LedContent) {
  cloth(ctx, w, h, "red");
  skull(ctx, w * 0.12, h * 0.5, 1.6, "rgba(246,234,210,0.85)", "#8f2219");
  skull(ctx, w * 0.88, h * 0.5, 1.6, "rgba(246,234,210,0.85)", "#8f2219");
  const title = (c.title ?? "ALLARME CAOS!").toUpperCase();
  paint(ctx, title, w / 2, h * 0.45, fit(ctx, title, fam, "400", 240, w * 0.68), fam, CREAM, { outline: "rgba(40,6,3,0.9)" });
  const who = c.focus.length >= 2 ? `TAVOLO ${c.focus[0].tableNo}  ⚔  TAVOLO ${c.focus[1].tableNo}` : c.focus.length === 1 ? `TAVOLO ${c.focus[0].tableNo}` : null;
  const sub = (c.subtitle ?? who ?? "SFIDA SPECIALE · 45 SECONDI").toUpperCase();
  paint(ctx, sub, w / 2, h * 0.78, fit(ctx, sub, num, "900", 64, w * 0.66), num, CREAM, { weight: "900", outline: "rgba(40,6,3,0.85)", track: 3 });
}

function drawVs(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, num: string, c: LedContent) {
  const a = c.focus[0];
  const b = c.focus[1];
  cloth(ctx, w, h);
  const head = (c.title ?? "SFIDA").toUpperCase();
  paint(ctx, head, w / 2, 76, fit(ctx, head, fam, "400", 92, w * 0.5), fam, INK);
  const side = (t: LedTeam | undefined, cx: number, flip: boolean) => {
    if (!t) return;
    ship(ctx, cx, h * 0.5, 1.15, t.color, flip);
    paint(ctx, `TAVOLO ${t.tableNo}`, cx, h * 0.72, 64, num, INK, { weight: "900" });
    ctx.font = `700 50px ${num}`;
    const name = clip(ctx, t.name.toUpperCase(), w * 0.34);
    paint(ctx, name, cx, h * 0.82, fit(ctx, name, num, "700", 50, w * 0.34), num, INK_SOFT, { weight: "700" });
    paint(ctx, `${Math.round(t.score).toLocaleString("it-IT")} PT`, cx, h * 0.92, 44, num, OCHRE, { weight: "900" });
  };
  side(a, w * 0.25, false);
  side(b, w * 0.75, true);
  swords(ctx, w / 2, h * 0.42, 1.5, "rgba(33,22,14,0.75)");
  paint(ctx, "VS", w / 2, h * 0.66, 180, fam, OCHRE);
  if (c.subtitle) paint(ctx, c.subtitle.toUpperCase(), w / 2, h - 40, fit(ctx, c.subtitle.toUpperCase(), num, "700", 36, w * 0.3), num, INK_SOFT, { weight: "700" });
}

function drawEvolve(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, num: string, c: LedContent) {
  const t = c.focus[0];
  cloth(ctx, w, h, "gold");
  // raggi d'oro dal centro (il bagliore del forziere)
  ctx.save();
  ctx.translate(w / 2, h * 0.5);
  for (let i = 0; i < 24; i++) {
    ctx.rotate((Math.PI * 2) / 24);
    ctx.fillStyle = i % 2 ? "rgba(255,240,190,0.28)" : "rgba(185,130,31,0.12)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, -60);
    ctx.lineTo(w, 60);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const title = (c.title ?? "EVOLUZIONE!").toUpperCase();
  paint(ctx, title, w / 2, h * 0.42, fit(ctx, title, fam, "400", 230, w * 0.74), fam, "#5a3a08", { outline: "rgba(255,240,200,0.7)" });
  const lvl = t ? (t.level >= 3 ? "LIVELLO 3 · LEGGENDARIA" : t.level === 2 ? "LIVELLO 2 · POTENZIATA" : "LIVELLO 1") : "";
  const sub = (c.subtitle ?? (t ? `TAVOLO ${t.tableNo} · ${lvl}` : "ENERGIA CAOS AL MASSIMO")).toUpperCase();
  paint(ctx, sub, w / 2, h * 0.76, fit(ctx, sub, num, "900", 64, w * 0.72), num, INK, { weight: "900", track: 3 });
}

function drawAwards(ctx: CanvasRenderingContext2D, w: number, h: number, fam: string, num: string, c: LedContent) {
  cloth(ctx, w, h, "gold");
  const head = (c.title ?? "PREMIAZIONE").toUpperCase();
  paint(ctx, head, w / 2, 80, fit(ctx, head, fam, "400", 100, w * 0.5), fam, INK);
  const podium = [2, 1, 3]; // da sinistra: 2°, 1°, 3°
  const frac: Record<number, number> = { 1: 1, 2: 0.82, 3: 0.68 };
  const colW = w * 0.22;
  const baseY = h - 28;
  const maxH = h - 170;
  podium.forEach((place, i) => {
    const x = w / 2 + (i - 1) * colW * 1.12 - colW / 2;
    const shown = c.awardsShown >= 4 - place;
    const team = c.teams.find((t) => t.place === place) ?? null;
    const ph = maxH * frac[place];
    const y = baseY - ph;
    // cassa di legno con le cerchiature
    const g = ctx.createLinearGradient(0, y, 0, baseY);
    g.addColorStop(0, "#8a5a32");
    g.addColorStop(1, "#5a3a1e");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, colW, ph);
    ctx.fillStyle = "rgba(30,18,8,0.35)";
    for (let k = 1; k < 4; k++) ctx.fillRect(x, y + (ph * k) / 4, colW, 4);
    ctx.fillStyle = "#2a2420";
    ctx.fillRect(x, y, colW, 10);
    ctx.fillRect(x, baseY - 10, colW, 10);
    if (shown && team) {
      ctx.fillStyle = team.color;
      ctx.fillRect(x + 12, y + 16, colW - 24, 18);
    }
    paint(ctx, `${place}°`, x + colW / 2, y + 74, place === 1 ? 96 : 80, num, place === 1 ? TIG.goldLight : CREAM, { weight: "900", outline: "rgba(20,12,6,0.85)" });
    if (shown && team) {
      const name = team.name.toUpperCase();
      ctx.font = `900 54px ${num}`;
      const size = fit(ctx, name, num, "900", 56, colW * 0.92, 28);
      paint(ctx, clip(ctx, name, colW * 0.94), x + colW / 2, y - 64, size, num, INK, { weight: "900" });
      paint(ctx, `TAVOLO ${team.tableNo}`, x + colW / 2, y - 22, 36, num, OCHRE, { weight: "700" });
      if (ph > 300) paint(ctx, `${Math.round(team.score).toLocaleString("it-IT")} PT`, x + colW / 2, baseY - 52, 48, num, CREAM, { weight: "900", outline: "rgba(20,12,6,0.85)" });
    } else {
      paint(ctx, "?", x + colW / 2, y + ph * 0.58, 120, fam, CREAM, { outline: "rgba(20,12,6,0.8)" });
    }
  });
  // dobloni sparsi
  const rnd = seeded(5);
  for (let i = 0; i < 14; i++) coin(ctx, 120 + rnd() * (w - 240), h * 0.25 + rnd() * h * 0.55, 14 + rnd() * 10);
}

/** Ridipinge la vela. `family` = carattere dei titoli, `numFamily` = carattere di numeri ed etichette. */
export function drawLed(canvas: HTMLCanvasElement, c: LedContent, family: string, numFamily: string = family) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.save();
  // il disegno è pensato su 2048×740: con un canvas diverso si scala
  ctx.scale(w / LED_CANVAS.w, h / LED_CANVAS.h);
  const W = LED_CANVAS.w;
  const H = LED_CANVAS.h;
  switch (c.mode) {
    case "logo":
      drawLogo(ctx, W, H, family, numFamily, c.subtitle, c.title);
      break;
    case "ambient":
      drawAmbient(ctx, W, H);
      break;
    case "manche":
      drawManche(ctx, W, H, family, numFamily, c);
      break;
    case "title":
      drawTitle(ctx, W, H, family, numFamily, c, "linen", INK, "IN GIOCO");
      break;
    case "leaderboard":
      drawLeaderboard(ctx, W, H, family, numFamily, c);
      break;
    case "alarm":
      drawAlarm(ctx, W, H, family, numFamily, c);
      break;
    case "vs":
      drawVs(ctx, W, H, family, numFamily, c);
      break;
    case "evolve":
      drawEvolve(ctx, W, H, family, numFamily, c);
      break;
    case "break":
      drawTitle(ctx, W, H, family, numFamily, { ...c, title: c.title ?? "PAUSA", subtitle: c.subtitle ?? "SI RIPARTE TRA POCO" }, "night", "#1d2a3a", "PAUSA");
      break;
    case "final":
      drawTitle(ctx, W, H, family, numFamily, { ...c, title: c.title ?? "TUTTO O NIENTE!" }, "linen", OCHRE, "TUTTO O NIENTE!");
      break;
    case "awards":
      drawAwards(ctx, W, H, family, numFamily, c);
      break;
  }
  ctx.restore();
}

