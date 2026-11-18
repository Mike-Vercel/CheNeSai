import { z } from "zod";
import { ICON_KINDS, LABEL_KINDS, TONES } from "../../components/art";

/**
 * Disegni ORIGINALI in codice per la manche 1 (Pixel killer, Un secondo prima, Non è quello che sembra, Feed):
 * forme semplici (rettangoli, ellissi, poligoni, linee, testi) e le icone del kit (`components/art`).
 * Qui solo i DATI e la geometria pura (nessun React): il disegno è in src/features/tig/games/mechanics/m1/art.tsx.
 * Coordinate in unità della tela (`w`×`h`, di solito 160×90 per il 16:9 o 100×100 per il quadrato).
 */

/**
 * Tavolozza: nomi → colori (gli stessi su server e client; il rasterizzatore li media). Accordata allo stile
 * TAVERNA DEI PIRATI: interni caldi (intonaco e legno scuro alla luce delle lanterne), mare caraibico, colori
 * pieni ma senza neon. I nomi restano quelli dei contenuti.
 */
export const PALETTE = {
  notte: "#07131a",
  acciaio: "#271a10",
  grafite: "#36281c",
  bianco: "#f6ead2",
  panna: "#f3e6c8",
  lime: "#e2bf4f",
  rosso: "#e0443b",
  ambra: "#f2a52b",
  ciano: "#62d9cc",
  viola: "#c4a6ff",
  cielo: "#86c6e8",
  cielo2: "#c4e3ef",
  tramonto: "#f08a56",
  mare: "#1d6f86",
  mare2: "#2a9bb0",
  sabbia: "#e8c98a",
  prato: "#5aa548",
  prato2: "#2f6e2c",
  legno: "#a0683a",
  legno2: "#6a4223",
  marrone: "#4a2f1b",
  arancio: "#f39432",
  rosa: "#f08fa8",
  giallo: "#f9d65a",
  verde: "#43b764",
  blu: "#3f63c9",
  grigio: "#9b9282",
  grigio2: "#4c4438",
  nero: "#140e09",
  pelle: "#f1c19a",
  rosso2: "#a12a22",
  neve: "#fffaf0",
} as const;
export type ColorName = keyof typeof PALETTE;
export const COLOR_NAMES = Object.keys(PALETTE) as ColorName[];
export const colorSchema = z.enum(COLOR_NAMES as [ColorName, ...ColorName[]]);
const color = colorSchema;

const num = z.number().min(-400).max(400);
const pos = z.number().min(0.1).max(400);
const opacity = z.number().min(0).max(1).optional();
const rot = z.number().min(-360).max(360).optional();

export const shapeSchema = z.discriminatedUnion("k", [
  /** rettangolo (x,y = angolo in alto a sinistra), raggio d'angolo facoltativo, rotazione attorno al centro */
  z.object({ k: z.literal("rect"), x: num, y: num, w: pos, h: pos, r: z.number().min(0).max(200).optional(), c: color, rot, o: opacity }),
  /** ellisse (x,y = centro) */
  z.object({ k: z.literal("ell"), x: num, y: num, rx: pos, ry: pos, c: color, rot, o: opacity }),
  /** poligono: coppie x,y in fila */
  z.object({ k: z.literal("poly"), p: z.array(num).min(6).max(80), c: color, o: opacity }),
  /** segmento con spessore */
  z.object({ k: z.literal("line"), x1: num, y1: num, x2: num, y2: num, w: pos, c: color, o: opacity }),
  /** icona del kit (riquadro di lato `s`, centrata in x,y), con testo facoltativo */
  z.object({
    k: z.literal("icon"),
    kind: z.enum(ICON_KINDS),
    x: num,
    y: num,
    s: pos,
    rot,
    tone: z.enum(TONES).default("white"),
    label: z.string().max(18).optional(),
    /** specchiata in orizzontale (es. il manico della tazza a sinistra) */
    flip: z.boolean().optional(),
  }),
  /** testo (x,y = punto d'ancoraggio sulla linea di base centrale) */
  z.object({ k: z.literal("text"), x: num, y: num, t: z.string().min(1).max(28), size: pos, c: color, anchor: z.enum(["start", "middle", "end"]).optional(), o: opacity }),
]);
export type Shape = z.infer<typeof shapeSchema>;
export type ShapeInput = z.input<typeof shapeSchema>;

export const artSchema = z
  .object({
    w: z.number().min(40).max(200),
    h: z.number().min(40).max(200),
    bg: color,
    shapes: z.array(shapeSchema).min(1).max(90),
  })
  .superRefine((a, ctx) => {
    a.shapes.forEach((s, i) => {
      if (s.k === "icon" && s.label && !LABEL_KINDS.includes(s.kind)) ctx.addIssue({ code: "custom", message: `l'icona ${s.kind} non mostra testi`, path: ["shapes", i] });
      if (s.k === "icon" && s.label && s.flip) ctx.addIssue({ code: "custom", message: "un'icona specchiata non può avere testo (si leggerebbe al contrario)", path: ["shapes", i] });
    });
  });
export type Art = z.infer<typeof artSchema>;
export type ArtInput = z.input<typeof artSchema>;

export function hexOf(c: ColorName): string {
  return PALETTE[c];
}

// ---------------------------------------------------------------------------
// Geometria: punto dentro una forma (per il rasterizzatore di Pixel killer)
// ---------------------------------------------------------------------------

function rotatePoint(px: number, py: number, cx: number, cy: number, deg: number): [number, number] {
  if (!deg) return [px, py];
  const a = (-deg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
}

function inPoly(px: number, py: number, p: readonly number[]): boolean {
  let inside = false;
  const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2];
    const yi = p[i * 2 + 1];
    const xj = p[j * 2];
    const yj = p[j * 2 + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi) inside = !inside;
  }
  return inside;
}

/** Il punto (px,py) cade dentro la forma? (testi e icone non sono rasterizzabili: sempre falso) */
export function shapeContains(s: Shape, px: number, py: number): boolean {
  switch (s.k) {
    case "rect": {
      const [x, y] = rotatePoint(px, py, s.x + s.w / 2, s.y + s.h / 2, s.rot ?? 0);
      if (x < s.x || x > s.x + s.w || y < s.y || y > s.y + s.h) return false;
      const r = Math.min(s.r ?? 0, s.w / 2, s.h / 2);
      if (r <= 0) return true;
      const cx = Math.min(Math.max(x, s.x + r), s.x + s.w - r);
      const cy = Math.min(Math.max(y, s.y + r), s.y + s.h - r);
      return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
    }
    case "ell": {
      const [x, y] = rotatePoint(px, py, s.x, s.y, s.rot ?? 0);
      return ((x - s.x) / s.rx) ** 2 + ((y - s.y) / s.ry) ** 2 <= 1;
    }
    case "poly":
      return inPoly(px, py, s.p);
    case "line": {
      const vx = s.x2 - s.x1;
      const vy = s.y2 - s.y1;
      const len2 = vx * vx + vy * vy || 1e-9;
      const t = Math.max(0, Math.min(1, ((px - s.x1) * vx + (py - s.y1) * vy) / len2));
      const dx = px - (s.x1 + t * vx);
      const dy = py - (s.y1 + t * vy);
      return dx * dx + dy * dy <= (s.w / 2) ** 2;
    }
    default:
      return false;
  }
}

function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Rasterizza un disegno (solo forme geometriche) su una griglia `cols`×`rows`: ogni cella è la media di
 * 3×3 campioni, quantizzata a 12 bit. Esito: una stringa di `cols*rows` colori da 3 cifre esadecimali
 * («rgb»), riga per riga. È tutto ciò che il telefono riceve prima del reveal: le forme restano sul server.
 */
export function rasterize(art: Art, cols: number, rows: number): string {
  const bg = rgbOf(hexOf(art.bg));
  const cw = art.w / cols;
  const ch = art.h / rows;
  const shapes = art.shapes.slice().reverse();
  const rgb = shapes.map((s) => rgbOf(hexOf((s as { c?: ColorName }).c ?? "bianco")));
  const alpha = shapes.map((s) => (s as { o?: number }).o ?? 1);
  let out = "";
  const SS = 3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let R = 0;
      let G = 0;
      let B = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (c + (sx + 0.5) / SS) * cw;
          const py = (r + (sy + 0.5) / SS) * ch;
          // dall'alto verso il basso: si compone con l'opacità fino alla prima forma piena
          let col: [number, number, number] = [0, 0, 0];
          let rest = 1;
          for (let i = 0; i < shapes.length && rest > 0.001; i++) {
            if (!shapeContains(shapes[i], px, py)) continue;
            const a = alpha[i];
            col = [col[0] + rgb[i][0] * a * rest, col[1] + rgb[i][1] * a * rest, col[2] + rgb[i][2] * a * rest];
            rest *= 1 - a;
          }
          if (rest > 0.001) col = [col[0] + bg[0] * rest, col[1] + bg[1] * rest, col[2] + bg[2] * rest];
          R += col[0];
          G += col[1];
          B += col[2];
        }
      }
      const n = SS * SS;
      out += [R, G, B].map((v) => Math.round(v / n / 17).toString(16)).join("");
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Icone di un disegno (per le condizioni di «Non è quello che sembra»)
// ---------------------------------------------------------------------------

export type IconShape = Extract<Shape, { k: "icon" }>;

export function iconsOf(art: Art, kind?: string): IconShape[] {
  return art.shapes.filter((s): s is IconShape => s.k === "icon" && (!kind || s.kind === kind));
}
