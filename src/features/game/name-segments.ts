import { cleanSpeech, ttsText } from "./script";

/**
 * "Nomi salvati": una battuta con i nickname viene divisa in parti FISSE (uguali in ogni
 * serata: si pagano una volta e poi sono gratis) e parti con i NOMI (archiviate per voce e
 * riusate in tutte le serate). Il server genera solo le parti che mancano e unisce gli mp3.
 * Funzioni PURE: niente rete, niente database.
 *
 * Regole:
 * - i nomi sono i nickname (e i nomi delle squadre) ripuliti con cleanSpeech, esattamente come
 *   finiscono nel testo; ricerca a parola intera, senza distinzione di maiuscole, prima i nomi
 *   più lunghi ("Anna Maria" vince su "Anna"); mai dentro un audio tag;
 * - la punteggiatura attaccata al nome va con il nome ("Gigi," / "Gigi!"): intonazione giusta;
 * - nomi separati solo da congiunzioni o da una parola breve ("Anna, Bruno e Carla",
 *   "Anna, secondo Carla") formano un'unica parte con i nomi: suona più naturale; lo stesso
 *   per una parola isolata attaccata al nome ("Solo Gigi", "Talìa Gigi:") se la frase continua;
 * - una parte fissa con numeri (punti, secondi…) cambia a ogni serata: si divide alle fine
 *   delle frasi, così le frasi senza numeri restano riusabili (lo stacco cade su una pausa vera);
 * - gli audio tag iniziali vanno sulla prima parte fissa (porta l'interpretazione della
 *   battuta e si paga una volta); un tag subito prima di un nome resta sul nome;
 * - se le parti fisse sono troppo corte non conviene dividere: null (frase intera).
 */

export interface SpeechSegment {
  kind: "fixed" | "name";
  /** testo da sintetizzare (forma canonica ttsText) */
  text: string;
}

/** Sotto questi caratteri di parti fisse la frase si genera intera (dividere non conviene). */
export const MIN_FIXED_CHARS = 12;
/** Parti fisse "corte" fra due nomi (o in coda) che si uniscono ai nomi: massimo parole/lettere. */
const SHORT_LINK_WORDS = 2;
const SHORT_LINK_LETTERS = 12;
const SHORT_EDGE_WORDS = 1;
const SHORT_EDGE_LETTERS = 10;

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const TAG = /\[[^\]\n]{1,40}\]/g;
/** Punteggiatura che, attaccata al nome, ne fa parte. */
const TRAILING_PUNCT = /^[,.;:!?…»"'’)]+/u;

const letters = (s: string) => (s.match(/[\p{L}\p{N}]/gu) ?? []).length;
/** Il testo chiude una frase (punto, esclamativo, interrogativo, puntini)? */
const endsSentence = (s: string) => /[.!?…]["'’»)]*\s*$/u.test(s.replace(TAG, "").trimEnd());
const hasDigits = (s: string) => /\p{N}/u.test(s);
const words = (s: string) => (s.replace(TAG, " ").match(/[\p{L}\p{N}]+/gu) ?? []).length;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Forma parlata di un nickname (come la mettono nel testo copione e regista). */
export function spokenName(nickname: string): string {
  return cleanSpeech(nickname);
}

/** Nomi utilizzabili per la divisione: ripuliti, senza doppioni, almeno 2 lettere/cifre, dal più lungo. */
export function normalizeNames(nicknames: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of nicknames) {
    const s = spokenName(n);
    const k = s.toLocaleLowerCase("it-IT");
    if (letters(s) < 2 || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out.sort((a, b) => b.length - a.length);
}

interface Range {
  start: number;
  end: number;
}

/** Posizioni dei nomi nel testo (senza sovrapposizioni, mai dentro un audio tag). */
export function findNames(text: string, nicknames: readonly string[]): Range[] {
  const taken: Range[] = [...text.matchAll(TAG)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
  const found: Range[] = [];
  const overlaps = (r: Range) => taken.some((t) => r.start < t.end && t.start < r.end);
  for (const name of normalizeNames(nicknames)) {
    // confine di parola solo dove il nome comincia/finisce con una lettera o una cifra
    const pre = LETTER_OR_DIGIT.test([...name][0]) ? "(?<![\\p{L}\\p{N}])" : "";
    const post = LETTER_OR_DIGIT.test([...name].at(-1)!) ? "(?![\\p{L}\\p{N}])" : "";
    const re = new RegExp(`${pre}${escapeRe(name)}${post}`, "giu");
    for (const m of text.matchAll(re)) {
      const r = { start: m.index, end: m.index + m[0].length };
      if (overlaps(r)) continue;
      taken.push(r);
      found.push(r);
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

interface Piece {
  kind: "fixed" | "name";
  text: string;
}

/** Tag in testa / in coda a un pezzo di testo. */
function leadingTags(s: string): { tags: string; rest: string } {
  const m = /^\s*(?:\[[^\]\n]{1,40}\]\s*)+/.exec(s);
  return m ? { tags: m[0].trim(), rest: s.slice(m[0].length) } : { tags: "", rest: s };
}
function trailingTags(s: string): { tags: string; rest: string } {
  const m = /(?:\s*\[[^\]\n]{1,40}\])+\s*$/.exec(s);
  return m ? { tags: m[0].trim(), rest: s.slice(0, m.index) } : { tags: "", rest: s };
}

const join = (...parts: string[]) => parts.filter((p) => p.length > 0).join(" ");

/**
 * Divide una battuta in parti fisse e parti con i nomi.
 * Restituisce null se non c'è nessun nome o se dividere non conviene.
 */
export function splitByNames(text: string, nicknames: readonly string[]): SpeechSegment[] | null {
  const src = ttsText(text);
  const found = findNames(src, nicknames);
  if (found.length === 0) return null;

  // 1. pezzi alterni (fisso / nome), con la punteggiatura attaccata al nome
  let pieces: Piece[] = [];
  let at = 0;
  for (const r of found) {
    if (r.start < at) continue;
    if (r.start > at) pieces.push({ kind: "fixed", text: src.slice(at, r.start) });
    let end = r.end;
    const punct = TRAILING_PUNCT.exec(src.slice(end));
    if (punct) end += punct[0].length;
    pieces.push({ kind: "name", text: src.slice(r.start, end) });
    at = end;
  }
  if (at < src.length) pieces.push({ kind: "fixed", text: src.slice(at) });

  // 2. tag in coda a un pezzo fisso (es. "Al terzo posto… [excited] Bruno!") → vanno sul nome
  for (let i = 0; i < pieces.length - 1; i++) {
    if (pieces[i].kind !== "fixed" || pieces[i + 1].kind !== "name") continue;
    const t = trailingTags(pieces[i].text);
    if (!t.tags) continue;
    pieces[i] = { ...pieces[i], text: t.rest };
    pieces[i + 1] = { ...pieces[i + 1], text: `${t.tags} ${pieces[i + 1].text}` };
  }

  // 3. pezzi fissi senza parole (solo spazi/punteggiatura) o corti fra due nomi → uniti ai nomi
  const merged: Piece[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    const prev = merged[merged.length - 1];
    const next = pieces[i + 1];
    const isLink = p.kind === "fixed" && prev?.kind === "name" && next?.kind === "name" && words(p.text) <= SHORT_LINK_WORDS && letters(p.text) <= SHORT_LINK_LETTERS;
    const noWords = p.kind === "fixed" && words(p.text) === 0 && !leadingTags(p.text).tags;
    if (p.kind === "name" && prev?.kind === "name") {
      prev.text = `${prev.text.trimEnd()} ${p.text.trimStart()}`;
    } else if ((isLink || noWords) && prev?.kind === "name") {
      prev.text = `${prev.text}${p.text}`;
    } else if (noWords && next) {
      pieces[i + 1] = { ...next, text: `${p.text}${next.text}` };
    } else {
      merged.push({ ...p });
    }
  }
  pieces = merged;

  // 4. una parola isolata in coda o in apertura che continua la frase del nome ("Solo Gigi",
  //    "Gigi dietro") → unita al nome; una frase completa ("Attenzione!", "Applausi!") resta a sé
  const isShortEdge = (p: Piece | undefined) => !!p && p.kind === "fixed" && words(p.text) <= SHORT_EDGE_WORDS && letters(p.text) <= SHORT_EDGE_LETTERS;
  if (pieces.length >= 2 && isShortEdge(pieces[pieces.length - 1]) && pieces[pieces.length - 2].kind === "name" && !endsSentence(pieces[pieces.length - 2].text)) {
    const last = pieces.pop()!;
    pieces[pieces.length - 1].text = `${pieces[pieces.length - 1].text.trimEnd()} ${last.text.trimStart()}`;
  }
  if (pieces.length >= 2 && isShortEdge(pieces[0]) && pieces[1].kind === "name" && !leadingTags(pieces[0].text).tags && !endsSentence(pieces[0].text)) {
    const first = pieces.shift()!;
    pieces[0].text = `${first.text.trimEnd()} ${pieces[0].text.trimStart()}`;
  }

  // 5. tag iniziali della battuta: sulla prima parte fissa (il nome resta "neutro" e riusabile)
  if (pieces[0]?.kind === "name") {
    const lead = leadingTags(pieces[0].text);
    const firstFixed = pieces.findIndex((p) => p.kind === "fixed");
    if (lead.tags && firstFixed > 0) {
      pieces[0] = { ...pieces[0], text: lead.rest };
      pieces[firstFixed] = { ...pieces[firstFixed], text: join(lead.tags, pieces[firstFixed].text.trim()) };
    }
  }

  // 6. parti fisse con numeri: divise alle fine delle frasi (le frasi senza numeri restano riusabili)
  pieces = pieces.flatMap((p) => (p.kind === "fixed" && hasDigits(p.text) ? splitSentences(p.text).map((text) => ({ kind: "fixed" as const, text })) : [p]));

  const segments: SpeechSegment[] = pieces.map((p) => ({ kind: p.kind, text: ttsText(p.text) })).filter((s) => s.text.length > 0);
  // conviene dividere solo se c'è abbastanza testo fisso riusabile (senza numeri)
  const fixedChars = segments.filter((s) => s.kind === "fixed" && !hasDigits(s.text)).reduce((a, s) => a + s.text.replace(TAG, "").trim().length, 0);
  if (!segments.some((s) => s.kind === "name") || fixedChars < MIN_FIXED_CHARS) return null;
  // ogni parte deve avere qualcosa da dire (non solo tag o punteggiatura)
  if (segments.some((s) => words(s.text) === 0)) return null;
  return segments;
}

/**
 * Divide un testo alle fine delle frasi: punteggiatura forte seguita da spazio e da una
 * maiuscola o da un audio tag ("1200 punti. Sic transit…"); "perseverare... è" non si divide.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[.!?…]+["'’»)]*\s+(?=[\p{Lu}[])/gu;
  let at = 0;
  for (const m of text.matchAll(re)) {
    const end = m.index + m[0].length;
    out.push(text.slice(at, end));
    at = end;
  }
  out.push(text.slice(at));
  return out.filter((t) => t.trim().length > 0);
}

/** Varianti del nome da preparare in anticipo (le più frequenti nelle battute: "Gigi", "Gigi,", "Gigi!", "Gigi."). */
export function nameVariants(nickname: string): string[] {
  const n = spokenName(nickname);
  if (letters(n) < 2) return [];
  return [n, `${n},`, `${n}!`, `${n}.`];
}

/** Punteggiatura finale di una parte: decide quanto silenzio lasciare prima della successiva. */
export function segmentPause(text: string): "none" | "comma" | "stop" {
  const t = text.replace(TAG, "").trimEnd();
  if (/[.!?…]["'’»)]*$/u.test(t)) return "stop";
  if (/[,;:]["'’»)]*$/u.test(t)) return "comma";
  return "none";
}
