import type { VoiceCategory, VoiceFile, VoiceLine, VoiceVar } from "./schema";

/**
 * TAVOLI IN GUERRA! — battute: scelta casuale per categoria (niente ripetizioni ravvicinate) e variabili.
 * Regola di sicurezza: la voce NON pronuncia mai i nomi scritti dagli utenti. Le squadre sono «il tavolo N»;
 * le mascotte hanno un nome CURATO (finché non è definito: «la mascotte del tavolo N»).
 */

/** Nomi curati delle 12 mascotte: arrivano con i modelli definitivi. Nessun nome inventato qui. */
export const MASCOT_NAMES: Record<number, string | null> = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null, 8: null, 9: null, 10: null, 11: null, 12: null };

export interface VoiceVars {
  tavoloA?: number | null;
  tavoloB?: number | null;
  /** slot della mascotte del tavolo A/B (per il nome curato) */
  mascotA?: number | null;
  mascotB?: number | null;
  punti?: number | null;
  manche?: number | null;
  /** titolo CURATO del minigioco (dal registro, mai testo degli utenti) */
  minigioco?: string | null;
  secondi?: number | null;
  posizione?: number | null;
}

const tavolo = (n: number | null | undefined) => (n ? `il tavolo ${n}` : "un tavolo");
/** Nome curato (senza articolo); finché non c'è: «Mascotte N» (lo slot), o «la mascotte del tavolo N». */
function mascotte(slot: number | null | undefined, table: number | null | undefined): string {
  const name = slot ? MASCOT_NAMES[slot] : null;
  if (name) return name;
  if (slot) return `Mascotte ${slot}`;
  return table ? `la mascotte del tavolo ${table}` : "la mascotte";
}
/** Titolo del registro in forma leggibile («MEMORIA LAMPO» → «Memoria Lampo»). */
export function readableTitle(t: string): string {
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s'(«-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());
}

/**
 * Convenzioni del catalogo vocale: {TAVOLO_A} ha già l'articolo («il tavolo 3»); {MANCHE} e {POSIZIONE} sono numeri
 * («la manche 2», «in posizione 3»); {PUNTI}/{SECONDI} numeri seguiti dalla parola; {MINIGIOCO} il titolo curato.
 */
export function varValue(v: VoiceVar, vars: VoiceVars): string {
  switch (v) {
    case "TAVOLO_A":
      return tavolo(vars.tavoloA);
    case "TAVOLO_B":
      return tavolo(vars.tavoloB);
    case "MASCOTTE_A":
      return mascotte(vars.mascotA, vars.tavoloA);
    case "MASCOTTE_B":
      return mascotte(vars.mascotB, vars.tavoloB);
    case "PUNTI":
      return String(Math.max(0, Math.round(vars.punti ?? 0)));
    case "MANCHE":
      return String(vars.manche ?? "");
    case "MINIGIOCO":
      return vars.minigioco ? readableTitle(vars.minigioco) : "la prossima prova";
    case "SECONDI":
      return String(Math.max(0, Math.round(vars.secondi ?? 0)));
    case "POSIZIONE":
      return String(vars.posizione ?? "");
  }
}

/** Sostituisce le variabili ammesse; le graffe sconosciute spariscono (mai testo grezzo). */
export function fillVoiceText(text: string, vars: VoiceVars): string {
  const filled = text.replace(/\{([A-Z_]+)\}/g, (_, name: string) => {
    if (["TAVOLO_A", "TAVOLO_B", "MASCOTTE_A", "MASCOTTE_B", "PUNTI", "MANCHE", "MINIGIOCO", "SECONDI", "POSIZIONE"].includes(name)) return varValue(name as VoiceVar, vars);
    return "";
  });
  // inizio frase con la maiuscola anche se comincia con una variabile («il tavolo 3…» → «Il tavolo 3…»)
  return filled.replace(/\s{2,}/g, " ").trim().replace(/^(\p{Ll})/u, (c) => c.toUpperCase());
}

/** La battuta ha tutte le variabili che le servono? (es. niente {TAVOLO_B} senza un secondo tavolo) */
export function lineFits(line: VoiceLine, vars: VoiceVars): boolean {
  for (const v of line.vars) {
    if ((v === "TAVOLO_A" || v === "MASCOTTE_A") && !vars.tavoloA) return false;
    if ((v === "TAVOLO_B" || v === "MASCOTTE_B") && !vars.tavoloB) return false;
    if (v === "PUNTI" && typeof vars.punti !== "number") return false;
    if (v === "MANCHE" && !vars.manche) return false;
    if (v === "MINIGIOCO" && !vars.minigioco) return false;
    if (v === "SECONDI" && typeof vars.secondi !== "number") return false;
    if (v === "POSIZIONE" && !vars.posizione) return false;
  }
  return true;
}

/**
 * Battuta a caso tra quelle del personaggio per la categoria, evitando le ultime usate nella serata
 * (`recent`) e quelle che richiedono variabili mancanti. null = il personaggio non ha battute adatte.
 */
export function pickLine(file: VoiceFile | undefined, category: VoiceCategory, vars: VoiceVars, recent: readonly string[], rnd: () => number = Math.random): VoiceLine | null {
  if (!file) return null;
  const pool = file.lines.filter((l) => l.scene === category && lineFits(l, vars));
  if (!pool.length) return null;
  const fresh = pool.filter((l) => !recent.includes(l.id));
  const list = fresh.length ? fresh : pool;
  return list[Math.floor(rnd() * list.length) % list.length];
}

/** Controllo leggero della forma di un file del catalogo (i file arrivano da altri rami). */
export function isVoiceFile(x: unknown): x is VoiceFile {
  const f = x as VoiceFile;
  return !!f && typeof f === "object" && !!f.character && typeof f.character.id === "string" && typeof f.character.name === "string" && Array.isArray(f.lines);
}
