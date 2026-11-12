/**
 * Palmino in italiano (richiesta dell'utente): niente siciliano/dialetto nelle sue battute.
 * Regole di conversione (modifica minima, stessa comicità), usate una volta per aggiornare
 * content/battute/LIBRERIA-UFFICIALE.md, content/show/battute.json e scripts/varianti-genere.mjs,
 * e dai test per verificare che non resti dialetto.
 *
 *   node scripts/palmino-italiano.mjs          # applica ai file
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Frasi intere (prima di tutto, così il senso resta quello voluto). */
const PHRASES = [
  ["MA CHI T'ARRICAMPASTI A FARI?!", "MA PERCHÉ SEI VENUTO?!"],
  ["MA CU TI DETTI A PATENTI?!", "MA CHI TI HA DATO LA PATENTE?!"],
  ["E QUESTO CU È, EINSTEIN?!", "E QUESTO CHI È, EINSTEIN?!"],
  ["MA CU SI', EINSTEIN?!", "MA CHI SEI, EINSTEIN?!"],
  ["MA CHI MINCHIA TI CONSIGLIÒ STA RISPOSTA?!", "MA CHI TI HA CONSIGLIATO QUESTA RISPOSTA?!"],
  ["MA CHI MINCHIA NE SAAA?!", "MA CHE NE SAAA?!"],
  ["MA CHI MINCHIA SE L'ASPETTAVA?!", "MA CHI SE L'ASPETTAVA?!"],
  ["MINCHIA… E CI HAI PURE PENSATO!", "MAMMA MIA… E CI HAI PURE PENSATO!"],
  ["MINCHIA, MA L'HAI FATTO APPOSTA?!", "ACCIDENTI, MA L'HAI FATTO APPOSTA?!"],
  ["Minchia, abbiamo un premio Nobel!", "Accidenti, abbiamo un premio Nobel!"],
  ["AMUNÌÌÌ! CA MI SPUNTANO I DATTERI!", "DAI, DAI! CHE MI SPUNTANO I DATTERI!"],
  ["AMUNÌ, CA SI FA TARDU!", "FORZA, CHE SI FA TARDI!"],
  ["AMUNÌ, RISPONDI!", "FORZA, RISPONDI!"],
  ["AMUNÌÌÌ!", "DAI, DAI!"],
  ["SUGGERITO STA COSA", "SUGGERITO QUESTA COSA"],
  ["talìa cu c'è!", "guarda chi c'è!"],
  ["Talìa, talìa!", "Guarda, guarda!"],
  ["Talìa a {nome}!", "Guarda {nome}!"],
  ["'sti punti", "questi punti"],
  ['"MIIII" non è un\'esclamazione accademica', '"Mamma miaaa" non è un\'esclamazione accademica'],
];

const PLACEHOLDER = /\{[a-z_]+\}/g;
function shouted(text) {
  const letters = text.replace(PLACEHOLDER, "").replace(/\[[^\]]*\]/g, "").match(/\p{L}/gu) ?? [];
  return letters.length > 0 && letters.filter((c) => c !== c.toLowerCase()).length / letters.length >= 0.6;
}

/** Converte una battuta; restituisce il testo invariato se non c'è nulla da cambiare. */
export function toItalian(text) {
  let t = text;
  for (const [a, b] of PHRASES) t = t.split(a).join(b);
  const loud = shouted(t);
  // "MIIIIII!" (esultanza lunga) → "MAMMA MIAAA!"; gli altri "MIIII"/"Miii" → "Mamma mia"
  t = t.replace(/\bMI{5,}!/g, "MAMMA MIAAA!");
  t = t.replace(/\bMI{3,}\b|\bMii+\b/g, () => (loud ? "MAMMA MIA" : "Mamma mia"));
  t = t.replace(/\bMamma mia (Regina|Professore)\b/g, "Mamma mia, $1");
  t = t.replace(/\bTalìa\b/g, "Guarda").replace(/\btalìa\b/g, "guarda");
  t = t.replace(/\bMa cu sì(?![\p{L}])/gu, "Ma chi sei");
  t = t.replace(/PROFESSÒÒÒ/g, "PROFESSOREEE").replace(/PROFESSÒ/g, "PROFESSORE").replace(/Professò/g, "Professore").replace(/professò/g, "professore");
  t = t.replace(/REGÌ/g, "REGINA").replace(/Regì/g, "Regina");
  return t;
}

/** Restano tracce di siciliano? (per i test) */
export const DIALECT = /minchi|\bmi{3,}\b|amun[iì]|\bcu (si|sì|ti|è)(?![\p{L}])|talìa|professò|regì|arricampasti|patenti|tardu|\bca (mi|si)\b|\bsta (cosa|risposta)\b|'sti\b/iu;

// eseguito da solo: aggiorna i file
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const changes = [];
  // 1. testo dell'utente: solo le battute tra virgolette
  const mdPath = join(root, "content", "battute", "LIBRERIA-UFFICIALE.md");
  let md = readFileSync(mdPath, "utf8");
  md = md.replace(/"([^"\n]+)"/g, (m, inner) => {
    const out = toItalian(inner);
    if (out !== inner) changes.push(["md", inner, out]);
    return `"${out}"`;
  });
  writeFileSync(mdPath, md, "utf8");
  // 2. libreria di sempre
  const basePath = join(root, "content", "show", "battute.json");
  const base = JSON.parse(readFileSync(basePath, "utf8"));
  for (const l of base.lines) {
    for (const k of ["text", "textF", "textN"]) {
      if (typeof l[k] !== "string") continue;
      const out = toItalian(l[k]);
      if (out !== l[k]) {
        changes.push([`base ${l.id} ${k}`, l[k], out]);
        l[k] = out;
      }
    }
  }
  writeFileSync(basePath, JSON.stringify(base, null, 2) + "\n", "utf8");
  // 3. varianti per genere (stringhe del file)
  const varPath = join(root, "scripts", "varianti-genere.mjs");
  let src = readFileSync(varPath, "utf8");
  src = src.replace(/(\s[fn]: )"([^"\n]+)"/g, (m, pre, inner) => {
    const out = toItalian(inner);
    if (out !== inner) changes.push(["varianti", inner, out]);
    return `${pre}"${out}"`;
  });
  writeFileSync(varPath, src, "utf8");
  for (const [where, a, b] of changes) console.log(`${where}\n  - ${a}\n  + ${b}`);
  console.log(`${changes.length} testi cambiati`);
}
