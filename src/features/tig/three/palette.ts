/**
 * Identità visiva dell'arena di TAVERNA DEI PIRATI (ex TAVOLI IN GUERRA!; identificatori interni `tig`), stile
 * pirati originale: una taverna sul molo di un porto
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

/**
 * CARATTERI (tre variabili CSS impostate dalla pagina con next/font, come il kit della grafica 2D):
 *  - `--font-tig-display` («Pirata One»): SOLO titoli grandi e logo, MAI tutto maiuscolo (in maiuscolo il gotico si
 *    legge male) → passare i titoli da `displayCase`;
 *  - `--font-tig-num` («Grenze»): numeri, punteggi, timer, NOMI DELLE SQUADRE, etichette dei tavoli, sottotitoli e
 *    motti (leggibilissimo da 5 metri);
 *  - `--font-tig-body` («Manrope»): testi lunghi (qui non servono).
 */
export const TIG_FONT_VAR = "--font-tig-display";
export const TIG_FONT_FALLBACK = `"Pirata One", Georgia, "Times New Roman", serif`;
export const TIG_NUM_FONT_VAR = "--font-tig-num";
export const TIG_NUM_FONT_FALLBACK = `"Grenze", "Roboto Slab", Rockwell, Georgia, "Times New Roman", serif`;

/** Parole brevi che nei titoli restano minuscole (articoli, preposizioni, congiunzioni). */
const SMALL_WORDS = new Set(
  "a ad al allo ai agli alla alle col con da dal dallo dai dagli dalla dalle di del dello dei degli della delle e ed è i il in la le lo gli nel nello nei negli nella nelle o od per su sul sullo sui sugli sulla sulle tra fra un uno una".split(" "),
);

/**
 * Titolo per il carattere gotico (`--font-tig-display`): mai tutto maiuscolo. Se il testo arriva tutto in maiuscolo
 * («ALLARME CAOS!», «TUTTO O NIENTE!») diventa «Allarme Caos!», «Tutto o Niente!»; se ha già delle minuscole resta
 * com'è (chi l'ha scritto ha scelto le maiuscole giuste).
 */
export function displayCase(text: string): string {
  if (/[a-zà-ÿ]/.test(text)) return text;
  return text
    .split(/(\s+)/)
    .map((w, i) => {
      if (/^\s+$/.test(w)) return w;
      const lower = w.toLocaleLowerCase("it-IT");
      const bare = lower.replace(/[^a-zà-ÿ']/g, "");
      if (i > 0 && SMALL_WORDS.has(bare)) return lower;
      const k = lower.search(/[a-zà-ÿ]/);
      return k < 0 ? lower : lower.slice(0, k) + lower[k].toLocaleUpperCase("it-IT") + lower.slice(k + 1);
    })
    .join("");
}

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
