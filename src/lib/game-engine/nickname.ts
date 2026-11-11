/**
 * Normalizzazione e filtro dei nickname.
 * - display: il nickname mostrato (spazi compattati, caratteri ammessi)
 * - key: chiave di unicità (minuscolo, senza accenti, senza separatori, con
 *   le sostituzioni "leet" più comuni) per impedire doppioni come "Mario" / "M a r i o".
 */

const ALLOWED = /^[\p{L}\p{N} ._'\-!]+$/u;

// Lista volutamente essenziale di termini offensivi (IT + EN). Il confronto
// avviene sulla chiave normalizzata, quindi intercetta anche spaziature e leet.
const BLOCKED_ROOTS = [
  "cazz", "minchi", "stronz", "vaffanc", "fancul", "troia", "puttan", "zoccol", "coglion", "merda",
  "bastard", "frocio", "froci", "ricchion", "terron", "mongolo", "handicappat",
  "porcodio", "diocane", "dioporco", "madonnaputt", "porcamadonna", "bocchin", "pompin", "sborr", "fottut",
  "culatton", "lesbicacc", "nazist", "hitler",
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "whore", "slut", "pussy",
];
// Nota: radici come "negr", "rape", "dick" sono escluse di proposito perché
// colpirebbero cognomi e parole comuni (Negri, Negroni, Raperonzolo, Dickens).

const RESERVED = ["admin", "regia", "professore", "regina", "palmino", "quizzone", "chenesai", "sistema", "staff"];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s", "!": "i" };

export function cleanNickname(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function nicknameKey(display: string): string {
  const base = display
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  let out = "";
  for (const ch of base) {
    const mapped = LEET[ch] ?? ch;
    if (/[a-z0-9]/.test(mapped)) out += mapped;
  }
  // compatta lettere ripetute ("ciaooo" ~ "ciao") solo per il confronto
  return out.replace(/(.)\1{2,}/g, "$1$1");
}

export type NicknameIssue = "too_short" | "too_long" | "invalid_chars" | "inappropriate" | "reserved";

export function validateNickname(
  raw: string,
  opts: { minLength: number; maxLength: number },
): { ok: true; display: string; key: string } | { ok: false; issue: NicknameIssue; message: string } {
  const display = cleanNickname(raw);
  const chars = [...display].length;
  if (chars < opts.minLength) return { ok: false, issue: "too_short", message: `Il nickname deve avere almeno ${opts.minLength} caratteri` };
  if (chars > opts.maxLength) return { ok: false, issue: "too_long", message: `Il nickname può avere al massimo ${opts.maxLength} caratteri` };
  if (!ALLOWED.test(display)) return { ok: false, issue: "invalid_chars", message: "Usa solo lettere, numeri, spazi e . _ - ' !" };
  const key = nicknameKey(display);
  if (key.length < Math.min(2, opts.minLength)) return { ok: false, issue: "invalid_chars", message: "Il nickname deve contenere lettere o numeri" };
  if (BLOCKED_ROOTS.some((w) => key.includes(w))) return { ok: false, issue: "inappropriate", message: "Questo nickname non è consentito: scegline un altro" };
  if (RESERVED.includes(key)) return { ok: false, issue: "reserved", message: "Questo nickname è riservato" };
  return { ok: true, display, key };
}
