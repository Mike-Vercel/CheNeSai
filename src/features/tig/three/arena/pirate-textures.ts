import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping } from "three";
import { TIG, inkOn } from "../palette";
import { canvasTex } from "./textures";

/**
 * TEXTURE DELLA TAVERNA DEL MOLO, disegnate in codice (nessuna immagine presa dal web): tavole del molo, rosa dei
 * venti dipinta sul ponte, faccia del doblone, stendardi delle ciurme, fronde di palma, fumo. Tutto deterministico
 * (stesso disegno a ogni caricamento: niente Math.random).
 */

/** Generatore pseudo-casuale deterministico (stesso seme → stessa sequenza). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, k: number, a = 1): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgba(${f(r)},${f(g)},${f(b)},${a})`;
}

// ------------------------------------------------------------------ tavole del molo
/**
 * Tavole di legno del molo (si ripete): 8 tavole per riquadro, toni diversi, venature, giunte sfalsate, chiodi,
 * fessure scure. Colore (sRGB) per il pavimento Phong: le lanterne lo scaldano, la luna lo raffredda.
 */
export function plankTexture(size = 1024): CanvasTexture {
  const t = canvasTex(size, size, (ctx, w, h) => {
    const rnd = seeded(7);
    const n = 8;
    const pw = h / n;
    ctx.fillStyle = "#1a0f08";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const y = i * pw;
      // giunte sfalsate: ogni tavola ha 1–2 tagli in punti diversi
      const cuts = [0, w * (0.25 + rnd() * 0.5)];
      if (rnd() > 0.5) cuts.push(w * (0.75 + rnd() * 0.2));
      cuts.push(w);
      cuts.sort((a, b) => a - b);
      for (let k = 0; k < cuts.length - 1; k++) {
        const x0 = cuts[k] + 2;
        const x1 = cuts[k + 1] - 2;
        const tone = 0.78 + rnd() * 0.42;
        const base = rnd() > 0.5 ? "#6e4a2c" : "#5c3d24";
        const g = ctx.createLinearGradient(0, y, 0, y + pw);
        g.addColorStop(0, shade(base, tone * 1.08));
        g.addColorStop(0.5, shade(base, tone));
        g.addColorStop(1, shade(base, tone * 0.82));
        ctx.fillStyle = g;
        ctx.fillRect(x0, y + 2, x1 - x0, pw - 4);
        // venature: linee ondulate sottili
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y + 2, x1 - x0, pw - 4);
        ctx.clip();
        for (let v = 0; v < 9; v++) {
          const vy = y + 6 + rnd() * (pw - 12);
          const amp = 1.5 + rnd() * 3;
          const freq = 0.004 + rnd() * 0.01;
          const ph = rnd() * 10;
          ctx.strokeStyle = rnd() > 0.5 ? "rgba(30,16,6,0.32)" : "rgba(150,105,60,0.18)";
          ctx.lineWidth = 0.8 + rnd() * 1.4;
          ctx.beginPath();
          for (let x = x0; x <= x1; x += 8) {
            const yy = vy + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1 + ph) * amp * 0.3;
            if (x === x0) ctx.moveTo(x, yy);
            else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
        // nodi del legno
        if (rnd() > 0.6) {
          const kx = x0 + rnd() * (x1 - x0);
          const ky = y + pw * (0.3 + rnd() * 0.4);
          const rg = ctx.createRadialGradient(kx, ky, 0, kx, ky, 9 + rnd() * 8);
          rg.addColorStop(0, "rgba(25,12,4,0.55)");
          rg.addColorStop(1, "rgba(25,12,4,0)");
          ctx.fillStyle = rg;
          ctx.fillRect(kx - 20, ky - 20, 40, 40);
        }
        ctx.restore();
        // chiodi alle giunte
        ctx.fillStyle = "rgba(20,14,10,0.85)";
        for (const nx of [x0 + 10, x1 - 10]) {
          for (const ny of [y + pw * 0.28, y + pw * 0.72]) {
            ctx.beginPath();
            ctx.arc(nx, ny, 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  });
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------------ rosa dei venti sul ponte
/**
 * Disegno al centro del molo (emissivo tenue: vernice dorata consumata che prende la luce): rosa dei venti, cerchi
 * della bussola con le tacche, sentieri tratteggiati da mappa verso le postazioni. Fuori dal disegno: trasparente.
 */
export function deckDecal(): CanvasTexture {
  return canvasTex(2048, 2048, (ctx, w) => {
    const c = w / 2;
    ctx.clearRect(0, 0, w, w);
    const gold = (a: number) => `rgba(242,177,52,${a})`;
    const cream = (a: number) => `rgba(241,226,191,${a})`;
    const ring = (r: number, wdt: number, color: string, dash: number[] = []) => {
      ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.lineWidth = wdt;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    };
    ring(560, 6, gold(0.55));
    ring(585, 2, gold(0.35));
    ring(760, 3, cream(0.22), [22, 16]);
    ring(930, 4, gold(0.22));
    // tacche della bussola
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      const long = i % 8 === 0;
      ctx.strokeStyle = long ? gold(0.6) : cream(0.25);
      ctx.lineWidth = long ? 5 : 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 592, c + Math.sin(a) * 592);
      ctx.lineTo(c + Math.cos(a) * (long ? 650 : 616), c + Math.sin(a) * (long ? 650 : 616));
      ctx.stroke();
    }
    // sentieri tratteggiati da mappa (ritorti come rotte)
    ctx.setLineDash([16, 14]);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      ctx.strokeStyle = cream(0.2);
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let r = 660; r < 1000; r += 20) {
        const aa = a + Math.sin(r * 0.012 + i) * 0.06;
        const x = c + Math.cos(aa) * r;
        const y = c + Math.sin(aa) * r;
        if (r === 660) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // grande rosa dei venti (sotto il ponte di comando si vedono le punte)
    const star = (r1: number, r2: number, k: number, rot: number, fillA: string, fillB: string) => {
      for (let i = 0; i < k; i++) {
        const a = rot + (i / k) * Math.PI * 2;
        const al = a - Math.PI / k;
        const ar = a + Math.PI / k;
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.lineTo(c + Math.cos(al) * r2, c + Math.sin(al) * r2);
        ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
        ctx.closePath();
        ctx.fillStyle = fillA;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.lineTo(c + Math.cos(ar) * r2, c + Math.sin(ar) * r2);
        ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
        ctx.closePath();
        ctx.fillStyle = fillB;
        ctx.fill();
      }
    };
    star(540, 120, 8, Math.PI / 8, gold(0.1), gold(0.2));
    star(860, 150, 4, -Math.PI / 2, gold(0.16), gold(0.32));
  });
}

// ------------------------------------------------------------------ piano del ponte di comando
/** Piano del ponte di comando: tavole a raggiera, bordo d'ottone, rosa dei venti e scritta circolare dipinta. */
export function commandDeckTexture(family: string): CanvasTexture {
  return canvasTex(1024, 1024, (ctx, w) => {
    const c = w / 2;
    const rnd = seeded(11);
    ctx.fillStyle = "#24160c";
    ctx.fillRect(0, 0, w, w);
    // tavole parallele (come un ponte di nave)
    const n = 14;
    const pw = w / n;
    for (let i = 0; i < n; i++) {
      const tone = 0.8 + rnd() * 0.35;
      ctx.fillStyle = shade("#6b4628", tone);
      ctx.fillRect(i * pw + 2, 0, pw - 4, w);
      for (let v = 0; v < 6; v++) {
        ctx.strokeStyle = "rgba(30,16,6,0.28)";
        ctx.lineWidth = 1 + rnd();
        const vx = i * pw + 6 + rnd() * (pw - 12);
        ctx.beginPath();
        for (let y = 0; y <= w; y += 16) ctx.lineTo(vx + Math.sin(y * 0.01 + v) * 2.5, y);
        ctx.stroke();
      }
    }
    // vignettatura verso il bordo (il centro è più consumato e chiaro)
    const vg = ctx.createRadialGradient(c, c, w * 0.1, c, c, w * 0.52);
    vg.addColorStop(0, "rgba(255,220,160,0.12)");
    vg.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, w);
    // rosa dei venti dipinta
    ctx.save();
    ctx.translate(c, c);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 150 : 250;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a + side * 0.2) * 46, Math.sin(a + side * 0.2) * 46);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.closePath();
        ctx.fillStyle = side < 0 ? "rgba(242,177,52,0.55)" : "rgba(138,90,43,0.75)";
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(242,177,52,0.6)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(c, c, 300, 0, Math.PI * 2);
    ctx.stroke();
    // scritta circolare
    const text = "TAVERNA DEI PIRATI · OGNI TAVOLO È UNA CIURMA · ";
    ctx.save();
    ctx.translate(c, c);
    ctx.font = `400 40px ${family}`;
    ctx.fillStyle = "rgba(246,234,210,0.6)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const full = text + text;
    const step = (Math.PI * 2) / full.length;
    for (let i = 0; i < full.length; i++) {
      ctx.save();
      ctx.rotate(i * step);
      ctx.translate(0, -372);
      ctx.fillText(full[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  });
}

// ------------------------------------------------------------------ doblone
/**
 * Faccia del doblone (oro: la luce la fanno il materiale metallico e l'ambiente): bordo con le perline, croce a
 * gigli stilizzata (generica, da moneta antica), stella al centro. Usata per il tappo delle pile, i dobloni che
 * piovono e il medaglione segnaposto delle mascotte.
 */
export function coinFaceTexture(): CanvasTexture {
  const t = canvasTex(512, 512, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c * 0.8, c * 0.7, 20, c, c, c);
    g.addColorStop(0, "#ffe7a3");
    g.addColorStop(0.55, "#e9b13f");
    g.addColorStop(1, "#a8701c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
    // bordo rialzato con le perline
    ctx.strokeStyle = "#8a5a12";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(c, c, c - 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ffe08a";
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * (c - 44), c + Math.sin(a) * (c - 44), 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(120,74,16,0.85)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(c, c, c - 66, 0, Math.PI * 2);
    ctx.stroke();
    // croce stilizzata a bracci svasati
    ctx.save();
    ctx.translate(c, c);
    ctx.fillStyle = "rgba(140,88,20,0.75)";
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-18, -26);
      ctx.lineTo(18, -26);
      ctx.lineTo(44, -150);
      ctx.quadraticCurveTo(0, -128, -44, -150);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#ffeaa8";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 22 : 52;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  t.anisotropy = 4;
  return t;
}

// ------------------------------------------------------------------ stendardi delle ciurme
export const BANNER_CELL = { w: 256, h: 384 } as const;
export const BANNER_COLS = 4;

export function bannerAtlasSize(n: number) {
  const rows = Math.max(1, Math.ceil(n / BANNER_COLS));
  return { w: BANNER_CELL.w * BANNER_COLS, h: BANNER_CELL.h * rows, rows };
}

/**
 * Stendardo della ciurma (una cella per tavolo): tela nel colore della squadra con l'orlo a coda di rondine,
 * bordatura chiara, al centro un tondo di pergamena col numero del tavolo e sotto due ossa incrociate stilizzate
 * (simpatiche, mai macabre). Tavolo offline: colori spenti.
 */
export function drawBanners(canvas: HTMLCanvasElement, teams: { tableNo: number; color: string; online: boolean }[], numFamily: string) {
  const { w, h } = bannerAtlasSize(teams.length);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  teams.forEach((t, i) => {
    const x = (i % BANNER_COLS) * BANNER_CELL.w;
    const y = Math.floor(i / BANNER_COLS) * BANNER_CELL.h;
    const cw = BANNER_CELL.w;
    const chh = BANNER_CELL.h;
    const col = t.online ? t.color : "#5b5f63";
    ctx.save();
    ctx.translate(x, y);
    // sagoma con la coda di rondine
    ctx.beginPath();
    ctx.moveTo(8, 4);
    ctx.lineTo(cw - 8, 4);
    ctx.lineTo(cw - 8, chh - 8);
    ctx.lineTo(cw / 2, chh - 70);
    ctx.lineTo(8, chh - 8);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, cw, 0);
    g.addColorStop(0, shade(col, 0.72));
    g.addColorStop(0.5, shade(col, 1.0));
    g.addColorStop(1, shade(col, 0.7));
    ctx.fillStyle = g;
    ctx.fill();
    // trama della tela
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    for (let k = 0; k < chh; k += 6) {
      ctx.beginPath();
      ctx.moveTo(0, k);
      ctx.lineTo(cw, k);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // bordatura
    ctx.strokeStyle = "rgba(246,234,210,0.85)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(18, 14);
    ctx.lineTo(cw - 18, 14);
    ctx.lineTo(cw - 18, chh - 30);
    ctx.lineTo(cw / 2, chh - 88);
    ctx.lineTo(18, chh - 30);
    ctx.closePath();
    ctx.stroke();
    // tondo di pergamena col numero
    const cx = cw / 2;
    const cy = 128;
    ctx.fillStyle = TIG.parchment;
    ctx.beginPath();
    ctx.arc(cx, cy, 82, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = TIG.burnt;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = TIG.inkText;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `900 ${t.tableNo >= 10 ? 92 : 112}px ${numFamily}`;
    ctx.fillText(String(t.tableNo), cx, cy + 6);
    // ossa incrociate stilizzate
    ctx.save();
    ctx.translate(cx, 262);
    ctx.fillStyle = inkOn(col) === "#1b1410" ? "rgba(27,20,16,0.75)" : "rgba(246,234,210,0.85)";
    for (const r of [-0.55, 0.55]) {
      ctx.save();
      ctx.rotate(r);
      ctx.beginPath();
      ctx.roundRect(-60, -7, 120, 14, 7);
      ctx.fill();
      for (const sx of [-60, 60]) {
        for (const sy of [-8, 8]) {
          ctx.beginPath();
          ctx.arc(sx, sy, 10, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
  });
}

// ------------------------------------------------------------------ palme, fumo
/** Fronda di palma (alfa): foglioline ai due lati di una costola leggermente curva. */
export function frondTexture(): CanvasTexture {
  const t = canvasTex(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const rnd = seeded(5);
    ctx.strokeStyle = "#1d2a1c";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(4, h / 2);
    ctx.quadraticCurveTo(w * 0.5, h / 2 - 6, w - 4, h / 2 + 4);
    ctx.stroke();
    for (let i = 0; i < 26; i++) {
      const u = i / 26;
      const x = 10 + u * (w - 20);
      const y = h / 2 - 3 * Math.sin(u * Math.PI);
      const len = (1 - u * 0.7) * (h * 0.46) * (0.8 + rnd() * 0.3);
      for (const s of [-1, 1]) {
        ctx.fillStyle = rnd() > 0.5 ? "#203522" : "#17281a";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 10, y + s * len * 0.5, x + 18, y + s * len);
        ctx.lineTo(x + 8, y + s * len * 0.9);
        ctx.closePath();
        ctx.fill();
      }
    }
  });
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  return t;
}

/** Sbuffo di fumo (cannoni): nuvola morbida grigia, alfa. */
export function smokeTexture(): CanvasTexture {
  return canvasTex(128, 128, (ctx, w) => {
    ctx.clearRect(0, 0, w, w);
    const rnd = seeded(9);
    for (let i = 0; i < 9; i++) {
      const x = w / 2 + (rnd() - 0.5) * 40;
      const y = w / 2 + (rnd() - 0.5) * 40;
      const r = 26 + rnd() * 22;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(200,205,210,0.5)");
      g.addColorStop(1, "rgba(200,205,210,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, w);
    }
  });
}
