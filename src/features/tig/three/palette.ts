/**
 * Identità visiva dell'arena di TAVOLI IN GUERRA!: "war room" notturna da pub. Nero inchiostro, acciaio, AMBRA
 * (il fuoco della sfida, le lampadine del pub) e CIANO tattico (le mappe, gli ologrammi); rosso solo per l'allarme,
 * oro solo per finale e premiazione, viola per l'Energia Caos. I colori delle squadre arrivano dal gioco.
 */
export const TIG = {
  ink: "#04060a",
  night: "#070b12",
  steel: "#141b24",
  steelHi: "#2a3644",
  amber: "#ff8a1f",
  amberHot: "#ffb04a",
  cyan: "#2de2ff",
  alarm: "#ff2340",
  gold: "#ffc94a",
  chaos: "#b452ff",
  chill: "#4a6bff",
  white: "#f3f6fa",
} as const;

/** Carattere del gioco: variabile CSS impostata dalle pagine (next/font), con riserve di sistema condensate. */
export const TIG_FONT_VAR = "--font-tig-display";
export const TIG_FONT_FALLBACK = `"Big Shoulders", "Barlow Condensed", "Arial Narrow", Impact, sans-serif`;

/** Famiglia del carattere letta dalla pagina (nel browser). */
export function readTigFont(): string {
  if (typeof document === "undefined") return TIG_FONT_FALLBACK;
  const v = getComputedStyle(document.documentElement).getPropertyValue(TIG_FONT_VAR).trim() || getComputedStyle(document.body).getPropertyValue(TIG_FONT_VAR).trim();
  const el = document.querySelector<HTMLElement>("[data-tig-font]");
  const w = el ? getComputedStyle(el).getPropertyValue(TIG_FONT_VAR).trim() : "";
  const fam = w || v;
  return fam ? `${fam}, ${TIG_FONT_FALLBACK}` : TIG_FONT_FALLBACK;
}

/** Colore leggibile (testo scuro o chiaro) sopra un colore di squadra. */
export function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#0a0d12" : "#ffffff";
}
