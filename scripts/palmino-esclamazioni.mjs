/**
 * Palmino: "Mamma mia" alternato con "Uuuh" e "Oh mamma" (richiesta dell'utente: troppo ripetitivo).
 * La scelta dipende dal testo maschile della battuta (stabile): la stessa esclamazione anche nelle
 * varianti femminile/neutra della stessa battuta. "MAMMA MIAAA!" (esultanza lunga) resta com'è.
 *
 *   node scripts/palmino-esclamazioni.mjs        # aggiorna MD, battute.json, varianti-genere.mjs
 *   node scripts/build-libreria-ufficiale.mjs    # poi rigenera content/show/libreria-ufficiale.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LOUD = ["MAMMA MIA", "UUUH", "OH MAMMA"];
const SOFT = ["Mamma mia", "Uuuh", "Oh mamma"];
const RX = /\b(MAMMA MIA|Mamma mia)(?![aA])/g;

function hash(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  return h;
}

/** Esclamazione per la battuta il cui testo maschile è `key`. */
export function alternate(text, key) {
  const i = hash(key) % 3;
  return text.replace(RX, (m) => (m === "MAMMA MIA" ? LOUD[i] : SOFT[i]));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  let n = 0;
  // 1. libreria ufficiale (testo dell'utente): solo le battute tra virgolette, chiave = testo stesso
  const mdPath = join(root, "content", "battute", "LIBRERIA-UFFICIALE.md");
  const md = readFileSync(mdPath, "utf8").replace(/"([^"\n]+)"/g, (m, inner) => {
    const out = alternate(inner, inner);
    if (out !== inner) n++;
    return `"${out}"`;
  });
  writeFileSync(mdPath, md, "utf8");
  // 2. varianti per genere della libreria ufficiale: chiave = testo maschile attuale (dal JSON)
  const off = JSON.parse(readFileSync(join(root, "content", "show", "libreria-ufficiale.json"), "utf8"));
  const baseText = new Map(off.lines.map((l) => [l.id, l.text]));
  // 3. libreria di sempre
  const basePath = join(root, "content", "show", "battute.json");
  const base = JSON.parse(readFileSync(basePath, "utf8"));
  for (const l of base.lines) {
    if (l.character !== "palmino") continue;
    baseText.set(l.id, l.text);
    for (const k of ["text", "textF", "textN"]) {
      if (typeof l[k] !== "string") continue;
      const out = alternate(l[k], l.text);
      if (out !== l[k]) {
        l[k] = out;
        n++;
      }
    }
  }
  writeFileSync(basePath, JSON.stringify(base, null, 2) + "\n", "utf8");
  // varianti (file sorgente): blocchi "id": { f: "...", n: "..." }
  const varPath = join(root, "scripts", "varianti-genere.mjs");
  const src = readFileSync(varPath, "utf8").replace(/"([a-z0-9-]+)": \{([^}]*)\}/g, (block, id, body) => {
    const key = baseText.get(id);
    if (!key) return block;
    const nb = body.replace(/(\s[fn]: )"([^"\n]+)"/g, (m, pre, inner) => {
      const out = alternate(inner, key);
      if (out !== inner) n++;
      return `${pre}"${out}"`;
    });
    return `"${id}": {${nb}}`;
  });
  writeFileSync(varPath, src, "utf8");
  console.log(`${n} testi cambiati`);
}
