/**
 * Identità visiva dell'arena di TAVOLI IN GUERRA! — EDIZIONE PIRATI (originale): «LA TAVERNA DEL MOLO», un porto
 * caraibico di notte. Luce CALDA delle lanterne e delle torce contro il FREDDO della notte di mare; ORO dei dobloni
 * per punti, vincitori e premiazione; turchese caraibico come accento freddo; rosso bandiera solo per allarme e Caos;
 * verde-acqua "fuoco fatuo" per l'Energia Caos. Legno, ottone, pergamena e corda come materiali. I colori delle
 * squadre (le bandiere delle ciurme) arrivano dal gioco.
 *
 * I nomi delle chiavi storiche restano (amber, cyan, alarm, gold, chaos, chill…) perché tutto il livello 3D li usa:
 * cambia il valore, non il ruolo.
 */
export const TIG = {
  /** notte di mare (fondo) */
  ink: "#07131a",
  night: "#0b1f2a",
  /** mare profondo */
  sea: "#0f3b4a",
  /** legni: scuro e cornici */
  steel: "#3b2414",
  steelHi: "#5a3a22",
  wood: "#5a3a22",
  woodDark: "#3b2414",
  /** ottone (cerchiature, targhe) */
  brass: "#c9a24a",
  /** luce delle lanterne e delle torce (fuoco) */
  amber: "#ff9a3c",
  amberHot: "#ffd56b",
  /** turchese caraibico (accento freddo) */
  cyan: "#1fb5a8",
  /** rosso bandiera: allarme, Caos, errori */
  alarm: "#c8312b",
  /** oro dei dobloni */
  gold: "#f2b134",
  goldLight: "#ffd56b",
  /** Energia Caos: fuoco fatuo verde-acqua */
  chaos: "#3de8c2",
  /** chiaro di luna (pausa, controluce freddo) */
  chill: "#8fb4ff",
  moon: "#dfe8ff",
  /** pergamena: pannelli, mappe */
  parchment: "#f1e2bf",
  parchmentShade: "#d9c08a",
  burnt: "#8a5a2b",
  /** inchiostro su pergamena · testo su fondo scuro */
  inkText: "#1b1410",
  white: "#f6ead2",
} as const;

/** Carattere dei TITOLI: variabile CSS impostata dalle pagine (next/font, es. «Pirata One»), con riserve di sistema. */
export const TIG_FONT_VAR = "--font-tig-display";
export const TIG_FONT_FALLBACK = `"Pirata One", "Big Shoulders", Georgia, "Times New Roman", serif`;
/** Carattere di NUMERI, punteggi ed etichette (leggibilissimo da 5 metri): variabile facoltativa, se manca un serif robusto. */
export const TIG_NUM_FONT_VAR = "--font-tig-num";
export const TIG_NUM_FONT_FALLBACK = `"Roboto Slab", "Rockwell", Georgia, "Times New Roman", serif`;

function readVar(name: string): string {
  if (typeof document === "undefined") return "";
  const el = document.querySelector<HTMLElement>("[data-tig-font]");
  const w = el ? getComputedStyle(el).getPropertyValue(name).trim() : "";
  return w || getComputedStyle(document.documentElement).getPropertyValue(name).trim() || getComputedStyle(document.body).getPropertyValue(name).trim();
}

/** Famiglia del carattere dei titoli letta dalla pagina (nel browser). */
export function readTigFont(): string {
  const fam = readVar(TIG_FONT_VAR);
  return fam ? `${fam}, ${TIG_FONT_FALLBACK}` : TIG_FONT_FALLBACK;
}

/** Famiglia del carattere dei numeri e delle etichette (nel browser). */
export function readTigNumFont(): string {
  const fam = readVar(TIG_NUM_FONT_VAR);
  return fam ? `${fam}, ${TIG_NUM_FONT_FALLBACK}` : TIG_NUM_FONT_FALLBACK;
}

/** Colore leggibile (testo scuro o chiaro) sopra un colore di squadra. */
export function inkOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1b1410" : "#fff6e6";
}
