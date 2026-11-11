import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

/** Gradiente radiale morbido (aloni, ombre di contatto). Solo client. */
export function createRadialTexture(stops: readonly [number, string][], size = 256): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [o, c] of stops) grad.addColorStop(o, c);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Gradiente lineare orizzontale (nastri, pannelli). */
export function createLinearTexture(stops: readonly [number, string][], w = 512, h = 64, vertical = false): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (g) {
    const grad = vertical ? g.createLinearGradient(0, 0, 0, h) : g.createLinearGradient(0, 0, w, 0);
    for (const [o, c] of stops) grad.addColorStop(o, c);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

type Drawable = CanvasImageSource & { width: number; height: number };

/** Box blur separabile sull'alfa (in place). */
function blurAlpha(a: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(a.length);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += a[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc * norm;
      acc += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      a[y * w + x] = acc * norm;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
}

/**
 * Maschera d'alone per un ritaglio: alfa ridotta a bassa risoluzione, sfocata e "gonfiata".
 * `pad` = margine (frazione della dimensione) attorno all'immagine, come il piano dell'alone.
 */
export function createGlowMask(image: Drawable, pad: number, size = 160): CanvasTexture | null {
  const iw = image.width;
  const ih = image.height;
  if (!iw || !ih) return null;
  const scale = size / Math.max(iw, ih);
  const w = Math.round(iw * scale * (1 + 2 * pad));
  const h = Math.round(ih * scale * (1 + 2 * pad));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) return null;
  const ox = (w - iw * scale) / 2;
  const oy = (h - ih * scale) / 2;
  g.drawImage(image, ox, oy, iw * scale, ih * scale);
  const data = g.getImageData(0, 0, w, h);
  const a = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = data.data[i * 4 + 3] / 255;
  const r = Math.max(2, Math.round(size * 0.025));
  blurAlpha(a, w, h, r);
  blurAlpha(a, w, h, r);
  for (let i = 0; i < w * h; i++) {
    // dilatazione morbida: l'alone esce dalla sagoma
    const v = Math.min(1, a[i] * 1.8);
    const s = v * v * (3 - 2 * v);
    data.data[i * 4] = 255;
    data.data[i * 4 + 1] = 255;
    data.data[i * 4 + 2] = 255;
    data.data[i * 4 + 3] = Math.round(s * 255);
  }
  g.putImageData(data, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.minFilter = LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}
