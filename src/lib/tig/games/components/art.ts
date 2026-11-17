import { z } from "zod";
import { rngFrom } from "./rng";

/**
 * Grafica ORIGINALE disegnata in codice (niente foto, niente media protetti).
 * Qui solo i dati puri (nomi delle icone, sagome, nuvole di oggetti); il disegno è in src/features/tig/games/kit.
 */

/** Icone delle scene (Memoria lampo): disegnate come SVG in `kit/icons.tsx`. */
export const ICON_KINDS = [
  "tazza",
  "telefono",
  "laptop",
  "pianta",
  "lampada",
  "orologio",
  "libro",
  "occhiali",
  "chiavi",
  "ombrello",
  "zaino",
  "cuffie",
  "pizza",
  "scarpe",
  "portafoglio",
  "poster",
  "candela",
  "postit",
  "borraccia",
  "valigia",
  "biglietto",
  "calendario",
  "torta",
  "monitor",
  "gatto",
  "palloncino",
] as const;
export type IconKind = (typeof ICON_KINDS)[number];

/** Icone che mostrano un testo (`label`): ora dell'orologio, schermo, post-it, poster, data, biglietto… */
export const LABEL_KINDS: readonly IconKind[] = [
  "tazza",
  "telefono",
  "laptop",
  "orologio",
  "postit",
  "poster",
  "calendario",
  "biglietto",
  "torta",
  "monitor",
  "valigia",
  "libro",
  "pizza",
  "palloncino",
];

/** Toni d'accento (mai l'unico indizio: le domande non chiedono colori). */
export const TONES = ["lime", "red", "white", "amber", "cyan", "violet"] as const;
export type Tone = (typeof TONES)[number];

/** Ambienti delle scene (sfondo disegnato in `kit/scene.tsx`). */
export const SCENE_BACKDROPS = ["soggiorno", "ufficio", "cucina", "camera", "stazione", "festa"] as const;

export const sceneItemSchema = z.object({
  kind: z.enum(ICON_KINDS),
  /** centro in percentuale della tela 16:9 */
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  /** 1 = 120 px su tela da 1600 */
  scale: z.number().min(0.4).max(2.5).default(1),
  rot: z.number().min(-45).max(45).default(0),
  tone: z.enum(TONES).default("white"),
  /** testo scritto sull'oggetto (ora dell'orologio, post-it, poster…) */
  label: z.string().max(18).optional(),
}).refine((i) => !i.label || LABEL_KINDS.includes(i.kind), { message: "questa icona non mostra testi" });
export type SceneItem = z.infer<typeof sceneItemSchema>;

export const sceneSchema = z.object({
  backdrop: z.enum(SCENE_BACKDROPS),
  items: z.array(sceneItemSchema).min(6).max(24),
});
export type Scene = z.infer<typeof sceneSchema>;

// ---------------------------------------------------------------------------
// Sagome a un solo contorno (La cifra improbabile): poligoni in un riquadro 0..10
// ---------------------------------------------------------------------------

type Pt = [number, number];

function ngon(n: number, r: number, cx = 5, cy = 5, phase = 0): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });
}

function star(points: number, ro: number, ri: number): Pt[] {
  return Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? ro : ri;
    const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    return [5 + r * Math.cos(a), 5 + r * Math.sin(a)] as Pt;
  });
}

export const GLYPHS = {
  moneta: ngon(14, 4.6),
  postit: [
    [1, 1],
    [9, 1],
    [9, 6.6],
    [6.6, 9],
    [1, 9],
  ] as Pt[],
  biglietto: [
    [0.5, 2.5],
    [9.5, 2.5],
    [9.5, 4.2],
    [8.7, 5],
    [9.5, 5.8],
    [9.5, 7.5],
    [0.5, 7.5],
    [0.5, 5.8],
    [1.3, 5],
    [0.5, 4.2],
  ] as Pt[],
  candelina: [
    [3.3, 9.6],
    [3.3, 4.1],
    [4.4, 4.1],
    [3.9, 2.7],
    [5, 0.3],
    [6.1, 2.7],
    [5.6, 4.1],
    [6.7, 4.1],
    [6.7, 9.6],
  ] as Pt[],
  cuore: [
    [5, 9],
    [1.2, 5.2],
    [0.8, 3.4],
    [1.6, 1.8],
    [3.2, 1.3],
    [5, 2.6],
    [6.8, 1.3],
    [8.4, 1.8],
    [9.2, 3.4],
    [8.8, 5.2],
  ] as Pt[],
  stella: star(5, 4.8, 2),
  notifica: [
    [1, 2],
    [9, 2],
    [9.6, 2.6],
    [9.6, 6.4],
    [9, 7],
    [4, 7],
    [2, 9],
    [2.4, 7],
    [1, 7],
    [0.4, 6.4],
    [0.4, 2.6],
  ] as Pt[],
  goccia: [
    [5, 0.6],
    [7.4, 4.4],
    [8, 6.2],
    [7.3, 8.1],
    [5, 9.4],
    [2.7, 8.1],
    [2, 6.2],
    [2.6, 4.4],
  ] as Pt[],
} as const;
export type GlyphKind = keyof typeof GLYPHS;
export const GLYPH_KINDS = Object.keys(GLYPHS) as GlyphKind[];

/**
 * Ricampiona un poligono a `n` vertici equidistanti sul perimetro (partenza `offset` 0..1): tutte le sagome
 * hanno lo stesso numero di punti, così il tracciato non rivela il tipo contando i vertici. Gli spigoli
 * originali restano (ogni vertice originale viene incluso se cade vicino a un campione).
 */
function resample(poly: readonly Pt[], n: number, offset: number): Pt[] {
  const segs = poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return { p, q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) };
  });
  const per = segs.reduce((s, x) => s + x.len, 0);
  if (!(per > 0) || poly.length >= n) return poly.slice(0, n);
  // n − (vertici originali) punti aggiuntivi distribuiti in proporzione alla lunghezza dei lati
  const extra = n - poly.length;
  const out: Pt[] = [];
  let given = 0;
  segs.forEach((s, i) => {
    out.push(s.p);
    const want = i === segs.length - 1 ? extra - given : Math.round((s.len / per) * extra + (offset - 0.5) * 0.49);
    const k = Math.max(0, Math.min(want, extra - given));
    for (let j = 1; j <= k; j++) {
      const t = j / (k + 1);
      out.push([s.p[0] + (s.q[0] - s.p[0]) * t, s.p[1] + (s.q[1] - s.p[1]) * t]);
    }
    given += k;
  });
  // rotazione del punto di partenza
  const shift = Math.floor(offset * out.length) % out.length;
  return [...out.slice(shift), ...out.slice(0, shift)];
}

export const ART_W = 1600;
export const ART_H = 900;

/**
 * Nuvola di sagome in UN SOLO tracciato SVG (bersagli e intrusi mescolati, stesso colore: si distinguono
 * per forma). Nessun elenco di posizioni nella vista: il numero non si legge contando un array.
 */
export function scatterPath(opts: { count: number; glyph: GlyphKind; decoys: number; decoyGlyph: GlyphKind; seed: string; size?: number }): string {
  const rnd = rngFrom(`${opts.seed}:nuvola`);
  const size = opts.size ?? 46;
  const total = opts.count + opts.decoys;
  const kinds: GlyphKind[] = [...Array(opts.count).fill(opts.glyph), ...Array(opts.decoys).fill(opts.decoyGlyph)];
  // mescola i tipi così l'ordine nel tracciato non separa bersagli e intrusi
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const placed: Pt[] = [];
  const margin = 60;
  let minDist = size * 1.05;
  const parts: string[] = [];
  for (let k = 0; k < total; k++) {
    let p: Pt = [0, 0];
    let tries = 0;
    for (;;) {
      p = [margin + rnd() * (ART_W - 2 * margin), margin + rnd() * (ART_H - 2 * margin)];
      if (placed.every((q) => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 >= minDist * minDist)) break;
      if (++tries > 400) {
        minDist *= 0.92;
        tries = 0;
      }
    }
    placed.push(p);
    const s = (size / 10) * (0.85 + rnd() * 0.3);
    const a = (rnd() - 0.5) * 1.2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const pts = resample(GLYPHS[kinds[k]], 18, rnd()).map(([x, y]) => {
      const dx = (x - 5) * s;
      const dy = (y - 5) * s;
      return `${(p[0] + dx * cos - dy * sin).toFixed(1)} ${(p[1] + dx * sin + dy * cos).toFixed(1)}`;
    });
    parts.push(`M${pts.join("L")}Z`);
  }
  return parts.join("");
}
