import type { BoardCell } from "../types";

/**
 * Contenuti dello SCHERMO LED di fondo dello studio, disegnati su canvas (nessun file). Solo dati PUBBLICI
 * (mai codici della partita, mai soluzioni prima della rivelazione): la vista LIVE resta pulita.
 */
export type LedTone = "green" | "red" | "gold" | "white";

export type LedContent =
  | { kind: "logo"; sub?: string }
  | { kind: "title"; over?: string; title: string; tone: LedTone; sub?: string }
  | { kind: "board"; category: string; rows: BoardCell[][]; solved: boolean }
  | { kind: "standings"; rows: { name: string; score: number }[] }
  | { kind: "winner"; names: string[]; score: number | null };

export const LED_SIZE = { w: 2048, h: 786 } as const;

const TONE: Record<LedTone, { fill: string; glow: string }> = {
  green: { fill: "#b6ff9e", glow: "#39ff14" },
  red: { fill: "#ffc2c8", glow: "#ff253a" },
  gold: { fill: "#ffe69a", glow: "#f5c542" },
  white: { fill: "#f4f6f7", glow: "#9fe8ff" },
};

function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, weight: string, max: number, maxW: number): number {
  let size = max;
  for (; size > 24; size -= 6) {
    ctx.font = `italic ${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxW) break;
  }
  return size;
}

function glowText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tone: LedTone, size: number, family: string, weight = "900") {
  const t = TONE[tone];
  ctx.font = `italic ${weight} ${size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.shadowColor = t.glow;
  ctx.shadowBlur = size * 0.35;
  ctx.fillStyle = t.glow;
  ctx.globalAlpha = 0.55;
  ctx.fillText(text, x, y);
  ctx.restore();
  // contorno scuro + riempimento chiaro (leggibile da lontano)
  ctx.lineWidth = Math.max(4, size * 0.06);
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = t.fill;
  ctx.fillText(text, x, y);
}

function background(ctx: CanvasRenderingContext2D, w: number, h: number, accent: LedTone) {
  ctx.fillStyle = "#020405";
  ctx.fillRect(0, 0, w, h);
  // bagliori verdi a sinistra, rossi a destra (identità del gioco), più l'accento del momento al centro
  const g1 = ctx.createRadialGradient(0, h * 0.5, 0, 0, h * 0.5, w * 0.55);
  g1.addColorStop(0, "rgba(57,255,20,0.32)");
  g1.addColorStop(1, "rgba(57,255,20,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);
  const g2 = ctx.createRadialGradient(w, h * 0.5, 0, w, h * 0.5, w * 0.55);
  g2.addColorStop(0, "rgba(255,37,58,0.32)");
  g2.addColorStop(1, "rgba(255,37,58,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);
  const c = TONE[accent].glow;
  const g3 = ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, h * 0.9);
  g3.addColorStop(0, `${c}40`);
  g3.addColorStop(1, `${c}00`);
  ctx.fillStyle = g3;
  ctx.fillRect(0, 0, w, h);
  // raggi diagonali (come lo sfondo del mockup)
  ctx.save();
  ctx.globalAlpha = 0.09;
  for (let i = -8; i < 26; i++) {
    ctx.fillStyle = i % 2 ? "#39ff14" : "#ff253a";
    ctx.beginPath();
    const x = i * 110;
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 26, 0);
    ctx.lineTo(x + 26 - h * 0.45, h);
    ctx.lineTo(x - h * 0.45, h);
    ctx.fill();
  }
  ctx.restore();
}

/** Griglia di "pixel" LED sopra tutto: righe e colonne scure sottili, si legge come uno schermo vero. */
function ledMask(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  for (let x = 0; x < w; x += 6) ctx.fillRect(x, 0, 1.5, h);
  for (let y = 0; y < h; y += 6) ctx.fillRect(0, y, w, 1.5);
  // vignettatura
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawLogo(ctx: CanvasRenderingContext2D, w: number, h: number, family: string, sub?: string) {
  const size = fitFont(ctx, "GIRAMENTE!", family, "900", 250, w * 0.66);
  ctx.save();
  ctx.translate(w / 2, h * 0.43);
  ctx.transform(1, 0, -0.12, 1, 0, 0);
  ctx.font = `italic 900 ${size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#39ff14";
  ctx.shadowBlur = 60;
  ctx.fillStyle = "rgba(57,255,20,0.55)";
  ctx.fillText("GIRAMENTE!", 0, 0);
  ctx.shadowBlur = 0;
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#000";
  ctx.strokeText("GIRAMENTE!", 0, 0);
  const grad = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.45, "#e8ecef");
  grad.addColorStop(0.6, "#9aa4ab");
  grad.addColorStop(1, "#f4f6f7");
  ctx.fillStyle = grad;
  ctx.fillText("GIRAMENTE", -ctx.measureText("!").width / 2, 0);
  ctx.restore();
  // il punto esclamativo verde
  ctx.save();
  ctx.translate(w / 2, h * 0.43);
  ctx.transform(1, 0, -0.12, 1, 0, 0);
  ctx.font = `italic 900 ${size}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const full = ctx.measureText("GIRAMENTE!").width;
  const bang = ctx.measureText("!").width;
  ctx.fillStyle = "#39ff14";
  ctx.fillText("!", full / 2 - bang, 0);
  ctx.restore();
  // fascia bianca con lo slogan
  const tag = sub ?? "La ruota gira. La mente decide.";
  ctx.save();
  ctx.translate(w / 2, h * 0.76);
  ctx.rotate(-0.025);
  ctx.font = `italic 800 64px ${family}`;
  const tw = ctx.measureText(tag).width + 70;
  ctx.fillStyle = "#f4f6f7";
  ctx.fillRect(-tw / 2, -46, tw, 92);
  ctx.fillStyle = "#080b0d";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tag, 0, 4);
  ctx.restore();
}

function drawBoard(ctx: CanvasRenderingContext2D, w: number, h: number, family: string, c: Extract<LedContent, { kind: "board" }>) {
  glowText(ctx, "IL TABELLONE SEGRETO", w / 2, 70, "green", 64, family, "800");
  const rows = c.rows.length ? c.rows : [[]];
  const maxLen = Math.max(1, ...rows.map((r) => r.length));
  const top = 130;
  const bottom = h - 100;
  const cellW = Math.min((w * 0.9) / maxLen, ((bottom - top) / rows.length) * 0.82);
  const cellH = cellW / 0.82;
  const gap = cellW * 0.1;
  const totalH = rows.length * cellH;
  let y = top + (bottom - top - totalH) / 2;
  for (const row of rows) {
    let x = (w - row.length * cellW) / 2;
    for (const cell of row) {
      const cx = x + gap / 2;
      const cy = y + gap / 2;
      const cw = cellW - gap;
      const ch = cellH - gap;
      if (cell.kind === "letter") {
        const on = !!cell.char;
        ctx.fillStyle = on ? "#eef2f4" : "#10161a";
        ctx.strokeStyle = on ? "#39ff14" : "rgba(57,255,20,0.45)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cw, ch, 8);
        ctx.fill();
        ctx.stroke();
        if (on) {
          ctx.font = `italic 900 ${Math.floor(ch * 0.72)}px ${family}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#080b0d";
          ctx.fillText(cell.char!, cx + cw / 2, cy + ch / 2 + 2);
        }
      } else if (cell.kind === "punct") {
        ctx.font = `italic 900 ${Math.floor(ch * 0.72)}px ${family}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#f4f6f7";
        ctx.fillText(cell.char, cx + cw / 2, cy + ch / 2);
      }
      x += cellW;
    }
    y += cellH;
  }
  ctx.font = `italic 800 52px ${family}`;
  ctx.textAlign = "center";
  ctx.fillStyle = c.solved ? "#b6ff9e" : "#f4f6f7";
  ctx.fillText(c.category.toUpperCase(), w / 2, h - 52);
}

function drawStandings(ctx: CanvasRenderingContext2D, w: number, h: number, family: string, rows: { name: string; score: number }[]) {
  glowText(ctx, "CLASSIFICA", w / 2, 92, "gold", 110, family);
  const list = rows.slice(0, 4);
  const top = 190;
  const rowH = Math.min(130, (h - top - 40) / Math.max(1, list.length));
  const medal = ["#f5c542", "#d7dde1", "#d08a4b", "#20262b"];
  list.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2;
    const x0 = w * 0.2;
    const x1 = w * 0.8;
    ctx.fillStyle = i === 0 ? "rgba(245,197,66,0.16)" : "rgba(255,255,255,0.06)";
    ctx.strokeStyle = i === 0 ? "rgba(245,197,66,0.8)" : "rgba(255,255,255,0.18)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x0, y - rowH * 0.4, x1 - x0, rowH * 0.8, rowH * 0.4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = medal[i];
    ctx.beginPath();
    ctx.arc(x0 + rowH * 0.42, y, rowH * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1204";
    ctx.font = `italic 900 ${Math.floor(rowH * 0.42)}px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), x0 + rowH * 0.42, y + 2);
    ctx.fillStyle = "#f4f6f7";
    ctx.textAlign = "left";
    ctx.font = `italic 800 ${Math.floor(rowH * 0.46)}px ${family}`;
    let name = r.name;
    while (ctx.measureText(name).width > (x1 - x0) * 0.55 && name.length > 3) name = `${name.slice(0, -2)}…`;
    ctx.fillText(name, x0 + rowH * 0.9, y + 2);
    ctx.textAlign = "right";
    ctx.fillStyle = i === 0 ? "#ffe69a" : "#f4f6f7";
    ctx.fillText(r.score.toLocaleString("it-IT"), x1 - rowH * 0.4, y + 2);
  });
}

/** Ridisegna lo schermo LED. `family` = famiglia del carattere del gioco (già caricata dalla pagina). */
export function drawLed(canvas: HTMLCanvasElement, content: LedContent, family: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const accent: LedTone = content.kind === "title" ? content.tone : content.kind === "winner" || content.kind === "standings" ? "gold" : "green";
  background(ctx, w, h, accent);
  switch (content.kind) {
    case "logo":
      drawLogo(ctx, w, h, family, content.sub);
      break;
    case "title": {
      // titoli compatti al centro: restano nel quadro anche quando l'HUD copre un lato dello schermo
      if (content.over) glowText(ctx, content.over, w / 2, h * 0.22, "white", fitFont(ctx, content.over, family, "800", 64, w * 0.6), family, "800");
      const size = fitFont(ctx, content.title, family, "900", 200, w * 0.5);
      glowText(ctx, content.title, w / 2, h * 0.47, content.tone, size, family);
      if (content.sub) {
        const s = fitFont(ctx, content.sub, family, "800", 60, w * 0.6);
        glowText(ctx, content.sub, w / 2, h * 0.75, "white", s, family, "800");
      }
      break;
    }
    case "board":
      drawBoard(ctx, w, h, family, content);
      break;
    case "standings":
      drawStandings(ctx, w, h, family, content.rows);
      break;
    case "winner": {
      glowText(ctx, "VINCITORE!", w / 2, h * 0.3, "gold", fitFont(ctx, "VINCITORE!", family, "900", 250, w * 0.8), family);
      const names = content.names.join(" · ") || "—";
      glowText(ctx, names, w / 2, h * 0.63, "white", fitFont(ctx, names, family, "900", 150, w * 0.86), family);
      if (content.score !== null) glowText(ctx, `${content.score.toLocaleString("it-IT")} PUNTI`, w / 2, h * 0.85, "gold", 80, family, "800");
      break;
    }
  }
  ledMask(ctx, w, h);
}
