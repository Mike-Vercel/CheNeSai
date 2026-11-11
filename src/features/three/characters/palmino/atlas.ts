import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, type Texture } from "three";

/**
 * Atlante procedurale di Palmino (generato a runtime su canvas, nessun file da scaricare).
 *
 * Un solo materiale per tutto il corpo: il colore viene dai vertex color, mentre
 * l'atlante decide la "finitura" tramite le UV:
 *  - colonna sinistra (u 0..0.5): corteccia fibrosa (colore + rugosità + bump)
 *  - celle piatte bianche (u 0.5..1, v 0.5..1): ognuna con una rugosità diversa
 *  - cella logo (u 0.5..0.75, v 0..0.25): cerchio rosa con palma gialla
 */

export type UV = readonly [number, number];

const CELL = 0.125;
const cell = (col: number, row: number): UV => [0.5 + CELL * (col + 0.5), 1 - CELL * (row + 0.5)];

/** Celle piatte (colore bianco → conta solo il vertex color). */
export const PATCH = {
  cloth: cell(0, 0), // tessuto pantaloncini, rugosità 0.66
  satin: cell(1, 0), // guanti, laccio, lingua
  gloss: cell(2, 0), // lenti / montatura, quasi a specchio
  enamel: cell(3, 0), // denti
  mouth: cell(0, 1), // interno bocca, opaco
  barkFlat: cell(1, 1), // corteccia senza fibre (labbra, dettagli piccoli)
} as const;

const PATCH_ROUGHNESS: Record<keyof typeof PATCH, number> = {
  cloth: 0.86,
  satin: 0.48,
  gloss: 0.1,
  enamel: 0.24,
  mouth: 0.72,
  barkFlat: 0.62,
};

/** Rettangolo UV della cella logo: [u0, v0, u1, v1]. */
export const LOGO_RECT = [0.5, 0.0, 0.75, 0.25] as const;

/** Rettangolo UV della cella lente (vetro scuro + occhi dietro): [u0, v0, u1, v1]. */
export const LENS_RECT = [0.75, 0.0, 1.0, 0.25] as const;

/** Mappa della corteccia: u 0.01..0.49 (giro del tronco), v 0..1 (altezza 0..1.45 m). */
export const BARK_U0 = 0.01;
export const BARK_U1 = 0.49;
export const BARK_HEIGHT = 1.45;

export const BARK_FLAT_COLOR = "#a46d2e";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Palmino: canvas 2D non disponibile");
  return [canvas, ctx];
}

const grey = (v: number) => {
  const c = Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgb(${c},${c},${c})`;
};

function drawPalmLogo(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const cx = x + s / 2;
  const cy = y + s / 2;
  ctx.fillStyle = "#ec3c8e";
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c92a74";
  ctx.lineWidth = s * 0.025;
  ctx.stroke();
  // palma gialla: tronco curvo + 6 foglie
  ctx.strokeStyle = "#f8ea1c";
  ctx.fillStyle = "#f8ea1c";
  ctx.lineCap = "round";
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.02, cy + s * 0.36);
  ctx.quadraticCurveTo(cx + s * 0.08, cy + s * 0.05, cx - s * 0.01, cy - s * 0.12);
  ctx.stroke();
  const top = { x: cx - s * 0.01, y: cy - s * 0.13 };
  const leaves = [-2.75, -2.2, -1.6, -1.0, -0.45, 0.1];
  for (const a of leaves) {
    ctx.save();
    ctx.translate(top.x, top.y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(s * 0.17, s * 0.02, s * 0.18, s * 0.055, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Lente degli occhiali (cella quadrata stirata su una lente ~2:1): vetro verde-nero più chiaro in
 * basso, occhi da cartone appena visibili dietro il vetro e due riflessi diagonali.
 * u = 0 è il lato del naso (la lente destra è specchiata nelle UV).
 */
function drawLens(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, s, s);
  ctx.clip();
  const base = ctx.createLinearGradient(0, y, 0, y + s);
  base.addColorStop(0, "#030806");
  base.addColorStop(0.55, "#0a1a13");
  base.addColorStop(1, "#24443a");
  ctx.fillStyle = base;
  ctx.fillRect(x, y, s, s);
  // occhi: ovali alti (in spazio lente ~2:1 → ellisse stretta nella cella)
  const ex = x + s * 0.47;
  const ey = y + s * 0.5;
  ctx.fillStyle = "rgba(205,225,215,0.2)";
  ctx.beginPath();
  ctx.ellipse(ex, ey, s * 0.15, s * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.beginPath();
  ctx.ellipse(ex - s * 0.02, ey + s * 0.04, s * 0.075, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(225,240,232,0.32)";
  ctx.beginPath();
  ctx.ellipse(ex + s * 0.01, ey - s * 0.06, s * 0.025, s * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();
  // riflessi: banda larga + banda sottile, dall'alto a destra verso il basso a sinistra
  ctx.translate(x + s / 2, y + s / 2);
  ctx.rotate(-0.95);
  const band = (off: number, w: number, a: number) => {
    const g = ctx.createLinearGradient(off - w, 0, off + w, 0);
    g.addColorStop(0, "rgba(220,245,235,0)");
    g.addColorStop(0.5, `rgba(220,245,235,${a})`);
    g.addColorStop(1, "rgba(220,245,235,0)");
    ctx.fillStyle = g;
    ctx.fillRect(off - w, -s, w * 2, s * 2);
  };
  band(s * 0.3, s * 0.07, 0.42);
  band(s * 0.44, s * 0.025, 0.5);
  ctx.restore();
  // bordo alto più chiaro (riflesso del cielo/luci)
  const top = ctx.createLinearGradient(0, y, 0, y + s * 0.18);
  top.addColorStop(0, "rgba(160,200,185,0.28)");
  top.addColorStop(1, "rgba(160,200,185,0)");
  ctx.fillStyle = top;
  ctx.fillRect(x, y, s, s * 0.18);
}

export interface PalminoAtlas {
  map: Texture;
  roughnessMap: Texture;
  bumpMap: Texture;
  dispose(): void;
}

export function createPalminoAtlas(lowPower: boolean): PalminoAtlas {
  const size = lowPower ? 512 : 1024;
  const half = size / 2;
  const rand = mulberry32(0x9a1e1b0);
  const [colorCanvas, color] = makeCanvas(size);
  const [roughCanvas, rough] = makeCanvas(size);
  const [bumpCanvas, bump] = makeCanvas(size);

  // fondo: bianco / rugosità media / bump neutro
  color.fillStyle = "#ffffff";
  color.fillRect(0, 0, size, size);
  rough.fillStyle = grey(0.6);
  rough.fillRect(0, 0, size, size);
  bump.fillStyle = grey(0.5);
  bump.fillRect(0, 0, size, size);

  // --- corteccia (colonna sinistra) ---
  color.fillStyle = "#a9712f";
  color.fillRect(0, 0, half, size);
  rough.fillStyle = grey(0.72);
  rough.fillRect(0, 0, half, size);
  // macchie larghe
  for (let i = 0; i < 70; i++) {
    const x = rand() * half;
    const y = rand() * size;
    const r = (0.03 + rand() * 0.09) * size;
    const g = color.createRadialGradient(x, y, 0, x, y, r);
    const tone = rand() < 0.5 ? "rgba(132,82,30," : "rgba(196,142,72,";
    g.addColorStop(0, `${tone}0.4)`);
    g.addColorStop(1, `${tone}0)`);
    color.fillStyle = g;
    color.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // fibre verticali
  const fibres = lowPower ? 500 : 1300;
  for (let i = 0; i < fibres; i++) {
    const x = rand() * half;
    const y = rand() * size;
    const len = (0.02 + rand() * 0.16) * size;
    const w = Math.max(1, (0.6 + rand() * 1.6) * (size / 1024));
    const dark = rand() < 0.62;
    const a = 0.08 + rand() * 0.16;
    color.fillStyle = dark ? `rgba(104,62,22,${a})` : `rgba(206,154,86,${a * 0.8})`;
    color.fillRect(x, y, w, len);
    rough.fillStyle = dark ? `rgba(225,225,225,${a})` : `rgba(140,140,140,${a})`;
    rough.fillRect(x, y, w, len);
    bump.fillStyle = dark ? `rgba(0,0,0,${a * 0.9})` : `rgba(255,255,255,${a * 0.7})`;
    bump.fillRect(x, y, w, len);
  }
  // tacche orizzontali leggere (anelli della palma)
  for (let i = 0; i < 90; i++) {
    const x = rand() * half;
    const y = rand() * size;
    const len = (0.02 + rand() * 0.06) * size;
    color.fillStyle = `rgba(96,58,22,${0.15 + rand() * 0.2})`;
    color.fillRect(x, y, len, Math.max(1, size / 700));
    bump.fillStyle = "rgba(0,0,0,0.35)";
    bump.fillRect(x, y, len, Math.max(1, size / 700));
  }

  // --- celle piatte ---
  const cellPx = size * CELL;
  for (const key of Object.keys(PATCH) as (keyof typeof PATCH)[]) {
    const [u, v] = PATCH[key];
    const px = u * size - cellPx / 2;
    const py = (1 - v) * size - cellPx / 2;
    color.fillStyle = key === "barkFlat" ? BARK_FLAT_COLOR : "#ffffff";
    color.fillRect(px, py, cellPx, cellPx);
    rough.fillStyle = grey(PATCH_ROUGHNESS[key]);
    rough.fillRect(px, py, cellPx, cellPx);
    bump.fillStyle = grey(0.5);
    bump.fillRect(px, py, cellPx, cellPx);
  }

  // --- logo ---
  const [lu0, lv0, lu1, lv1] = LOGO_RECT;
  const lx = lu0 * size;
  const ly = (1 - lv1) * size;
  const ls = (lu1 - lu0) * size;
  color.fillStyle = "#f3ec16";
  color.fillRect(lx, ly, ls, (lv1 - lv0) * size);
  drawPalmLogo(color, lx + ls * 0.02, ly + ls * 0.02, ls * 0.96);
  rough.fillStyle = grey(0.55);
  rough.fillRect(lx, ly, ls, ls);

  // --- lente ---
  {
    const [u0, , u1, v1] = LENS_RECT;
    const lx2 = u0 * size;
    const ly2 = (1 - v1) * size;
    const ls2 = (u1 - u0) * size;
    drawLens(color, lx2, ly2, ls2);
    rough.fillStyle = grey(0.07);
    rough.fillRect(lx2, ly2, ls2, ls2);
  }

  const tex = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const t = new CanvasTexture(canvas);
    if (srgb) t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.needsUpdate = true;
    return t;
  };
  const map = tex(colorCanvas, true);
  const roughnessMap = tex(roughCanvas, false);
  const bumpMap = tex(bumpCanvas, false);
  return {
    map,
    roughnessMap,
    bumpMap,
    dispose() {
      map.dispose();
      roughnessMap.dispose();
      bumpMap.dispose();
    },
  };
}
