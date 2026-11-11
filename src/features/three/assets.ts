/**
 * Asset dell'intro. Gli URL sono statici in /public.
 * `preloadIntroAssets()` va chiamata in lobby: scalda la cache HTTP (immagini, font)
 * e, se il modulo 3D è già caricato, anche le cache di drei (texture/typeface).
 */

export type CharacterId = "professore" | "regina" | "palmino";

export interface CharacterAsset {
  id: CharacterId;
  name: string;
  /** Texture principale (1024) e variante leggera (512, lowPower). */
  src: string;
  srcLow: string;
  /** Rapporto larghezza/altezza dell'immagine originale (mai distorcere). */
  aspect: number;
}

export const CHARACTERS: Record<CharacterId, CharacterAsset> = {
  professore: {
    id: "professore",
    name: "Il Professore",
    src: "/characters/professore-1024.webp",
    srcLow: "/characters/professore-512.webp",
    aspect: 961 / 1024,
  },
  regina: {
    id: "regina",
    name: "La Regina",
    src: "/characters/regina-1024.webp",
    srcLow: "/characters/regina-512.webp",
    aspect: 1023 / 953,
  },
  palmino: {
    id: "palmino",
    name: "Palmino",
    src: "/characters/palmino-1024.webp",
    srcLow: "/characters/palmino-512.webp",
    aspect: 881 / 1024,
  },
};

export const LOGO_FONT_URL = "/three/lilita-one.typeface.json";

/** Strati dell'emblema CHE NE SAI?! (generati da tools/logo_extract_front.py e tools/logo_wheel.py). */
export const BRAND_LAYERS = {
  front: "/brand/logo-front-1600.webp",
  frontLow: "/brand/logo-front-900.webp",
  wheel: "/brand/logo-wheel-1024.webp",
  wheelHd: "/brand/logo-wheel-2048.webp",
  rim: "/brand/logo-rim-1024.webp",
  rimBulbs: "/brand/logo-rim-bulbs-1024.webp",
} as const;
export const DISPLAY_FONT_TTF_URL = "/three/LilitaOne-Regular.ttf";

/** Stack font per le scritte DOM: usa --font-display se definita dall'app. */
export const DISPLAY_FONT_STACK = "var(--font-display, 'QZ Lilita One'), 'Lilita One', 'Arial Black', 'Segoe UI Black', sans-serif";

export const INTRO_FONT_FACE_CSS = `@font-face{font-family:'QZ Lilita One';src:url('${DISPLAY_FONT_TTF_URL}') format('truetype');font-weight:400;font-style:normal;font-display:swap;}`;

type DreiPreloader = (urls: string[], fontUrl: string) => void;
let dreiPreloader: DreiPreloader | null = null;
let pendingDrei: { urls: string[]; font: string } | null = null;

/** Registrato dal modulo della scena 3D quando viene caricato (evita di importare three in lobby). */
export function registerDreiPreloader(fn: DreiPreloader): void {
  dreiPreloader = fn;
  if (pendingDrei) {
    fn(pendingDrei.urls, pendingDrei.font);
    pendingDrei = null;
  }
}

const warmed = new Set<string>();

export function preloadIntroAssets(options: { lowPower?: boolean } = {}): void {
  if (typeof window === "undefined") return;
  const urls = Object.values(CHARACTERS).map((c) => (options.lowPower ? c.srcLow : c.src));
  const brand = [options.lowPower ? BRAND_LAYERS.frontLow : BRAND_LAYERS.front, options.lowPower ? BRAND_LAYERS.wheel : BRAND_LAYERS.wheelHd, BRAND_LAYERS.wheel, BRAND_LAYERS.rim, BRAND_LAYERS.rimBulbs];
  for (const url of [...urls, ...Object.values(CHARACTERS).map((c) => c.src), ...brand]) {
    if (warmed.has(url)) continue;
    warmed.add(url);
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
  for (const url of [LOGO_FONT_URL, DISPLAY_FONT_TTF_URL]) {
    if (warmed.has(url)) continue;
    warmed.add(url);
    fetch(url).catch(() => undefined);
  }
  if (dreiPreloader) dreiPreloader(urls, LOGO_FONT_URL);
  else pendingDrei = { urls, font: LOGO_FONT_URL };
}
