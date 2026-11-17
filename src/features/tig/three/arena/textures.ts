import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace } from "three";
import { TIG } from "../palette";

/**
 * Texture disegnate in codice (nessun file da scaricare): bagliori, atlante delle cifre, disegno del pavimento
 * («mappa tattica»), decorazione del palco, fascia «MASCOTTE IN ARRIVO», ombra di contatto.
 */

export function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
}

/** Alone morbido (bagliori additivi, "bloom" finto). */
export function glowTexture(): CanvasTexture {
  return canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.22, "rgba(255,255,255,0.55)");
    g.addColorStop(0.55, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

/** Anello luminoso (pozze di luce, onde d'urto). */
export function ringTexture(): CanvasTexture {
  return canvasTex(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.72, "rgba(255,255,255,0.0)");
    g.addColorStop(0.86, "rgba(255,255,255,1)");
    g.addColorStop(0.93, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
}

/** Ombra morbida di contatto sotto i piedi. */
export function shadowTexture(): CanvasTexture {
  return canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,0.8)");
    g.addColorStop(0.5, "rgba(0,0,0,0.4)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

/** Glifi dell'atlante delle cifre: 0–9, «+», «−», «·». */
export const DIGIT_GLYPHS = "0123456789+-·";
export const DIGIT_CELLS = 16;

/** Atlante delle cifre (bianche con alone, si colorano nello shader). Una cella per glifo, 16 celle in riga. */
export function digitAtlas(family: string): CanvasTexture {
  const cw = 96;
  const ch = 128;
  const t = canvasTex(cw * DIGIT_CELLS, ch, (ctx) => {
    ctx.clearRect(0, 0, cw * DIGIT_CELLS, ch);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < DIGIT_GLYPHS.length; i++) {
      const g = DIGIT_GLYPHS[i] === "-" ? "−" : DIGIT_GLYPHS[i];
      const x = i * cw + cw / 2;
      ctx.font = `900 112px ${family}`;
      ctx.save();
      ctx.shadowColor = "rgba(255,255,255,0.9)";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(g, x, ch / 2 + 6);
      ctx.restore();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(g, x, ch / 2 + 6);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(g, x, ch / 2 + 6);
    }
  });
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/** Disegno sul pavimento: mappa tattica esagonale, anelli, tacche e raggi (ambra e ciano), tutto molto tenue. */
export function floorDecal(): CanvasTexture {
  return canvasTex(2048, 2048, (ctx, w) => {
    const c = w / 2;
    ctx.clearRect(0, 0, w, w);
    // griglia esagonale che sfuma verso i bordi
    const hexR = 34;
    const hh = Math.sqrt(3) * hexR;
    ctx.lineWidth = 1.6;
    for (let row = -32; row <= 32; row++) {
      for (let col = -24; col <= 24; col++) {
        const x = c + col * hexR * 1.5;
        const y = c + row * hh + (col % 2 ? hh / 2 : 0);
        const d = Math.hypot(x - c, y - c) / c;
        if (d > 1) continue;
        const a = 0.22 * Math.pow(1 - d, 1.3) + 0.03;
        ctx.strokeStyle = `rgba(45,226,255,${a})`;
        ctx.beginPath();
        for (let k = 0; k <= 6; k++) {
          const an = (k / 6) * Math.PI * 2;
          const px = x + Math.cos(an) * hexR * 0.92;
          const py = y + Math.sin(an) * hexR * 0.92;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    const ring = (r: number, wdt: number, color: string, alpha: number, dash: number[] = []) => {
      ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = wdt;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    };
    ring(330, 4, TIG.amber, 0.7);
    ring(352, 2, TIG.amber, 0.35, [18, 12]);
    ring(560, 3, TIG.cyan, 0.4);
    ring(700, 2, TIG.cyan, 0.22, [6, 10]);
    ring(930, 5, TIG.amber, 0.25);
    // tacche da bussola
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const long = i % 10 === 0;
      ctx.strokeStyle = long ? TIG.amber : TIG.cyan;
      ctx.globalAlpha = long ? 0.7 : 0.3;
      ctx.lineWidth = long ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 362, c + Math.sin(a) * 362);
      ctx.lineTo(c + Math.cos(a) * (long ? 410 : 384), c + Math.sin(a) * (long ? 410 : 384));
      ctx.stroke();
    }
    // raggi lunghi
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + Math.PI / 24;
      const g = ctx.createLinearGradient(c + Math.cos(a) * 420, c + Math.sin(a) * 420, c + Math.cos(a) * 1000, c + Math.sin(a) * 1000);
      g.addColorStop(0, "rgba(255,138,31,0.45)");
      g.addColorStop(1, "rgba(255,138,31,0)");
      ctx.strokeStyle = g;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 420, c + Math.sin(a) * 420);
      ctx.lineTo(c + Math.cos(a) * 1000, c + Math.sin(a) * 1000);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

/** Piano del palco: esagono con il marchio del gioco in cerchio e i segni dei presentatori. */
export function stageDecal(family: string): CanvasTexture {
  return canvasTex(1024, 1024, (ctx, w) => {
    const c = w / 2;
    ctx.clearRect(0, 0, w, w);
    const hex = (r: number) => {
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    };
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(255,138,31,0.85)";
    hex(470);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,138,31,0.35)";
    hex(440);
    ctx.stroke();
    ctx.strokeStyle = "rgba(45,226,255,0.25)";
    hex(300);
    ctx.stroke();
    // scritta circolare
    const text = "TAVERNA DEI PIRATI · OGNI TAVOLO È UNA CIURMA · ";
    ctx.save();
    ctx.translate(c, c);
    ctx.font = `800 38px ${family}`;
    ctx.fillStyle = "rgba(255,255,255,0.42)";
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
    // emblema centrale: tre esagoni intrecciati (i tavoli), non un'arma
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.translate(c + Math.cos(a) * 62, c + Math.sin(a) * 62);
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const b = (k / 6) * Math.PI * 2;
        const x = Math.cos(b) * 84;
        const y = Math.sin(b) * 84;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 5;
      ctx.strokeStyle = i === 0 ? "rgba(255,138,31,0.8)" : i === 1 ? "rgba(45,226,255,0.6)" : "rgba(255,255,255,0.5)";
      ctx.stroke();
      ctx.restore();
    }
  });
}

/** Fascia che gira attorno al segnaposto: «MASCOTTE IN ARRIVO ·» ripetuto (bianco, si colora nello shader). */
export function bandTexture(family: string): CanvasTexture {
  const t = canvasTex(1024, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = `800 40px ${family}`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    const unit = "MASCOTTE IN ARRIVO  ·  ";
    let x = 0;
    while (x < w) {
      ctx.fillText(unit, x, h / 2 + 2);
      x += ctx.measureText(unit).width;
    }
  });
  t.wrapS = RepeatWrapping;
  return t;
}

/** Strisce verticali per la colonna delle torri (emissive, si colorano nello shader). */
export function stripeTexture(): CanvasTexture {
  const t = canvasTex(64, 8, (ctx, w, h) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0.38, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,1)");
    g.addColorStop(0.62, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, false);
  t.wrapS = RepeatWrapping;
  return t;
}
