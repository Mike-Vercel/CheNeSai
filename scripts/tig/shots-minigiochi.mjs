/**
 * Screenshot dell'anteprima dei minigiochi (telefono 390×844, PC 1440×900, TV 1920×1080; play e reveal).
 * Uso: node scripts/tig/shots-minigiochi.mjs <cartella> [--base=http://localhost:4980] [--force] [codice…]
 * Usa Chrome di sistema (channel "chrome"); salta i file già presenti salvo --force.
 */
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--") && (a.includes("/") || a.includes("\\")));
if (!out) throw new Error("manca la cartella di uscita");
const base = (args.find((a) => a.startsWith("--base=")) ?? "--base=http://localhost:4980").slice(7);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--") && a !== out);
mkdirSync(out, { recursive: true });

// codice → secondi trascorsi [TV, giocatore] per uno stato «play» significativo
const TIMES = {
  "memoria-lampo": [2, 12],
  "screenshot-traditore": [5, 5],
  "tempo-fantasma": [8, 8],
  "ordine-nel-caos": [5, 5],
  "cifra-improbabile": [2, 10],
  "indizio-dopo-indizio": [20, 20],
  "scegli-il-bersaglio": [10, 10],
  "scudo-rapido": [10, 10],
  "asta-al-buio": [10, 10],
  "doppio-rischio": [10, 10],
  "prevedi-la-maggioranza": [10, 10],
  sincronizzati: [5, 5],
  "dilemma-pubblico": [10, 10],
  "catena-di-codici": [10, 10],
  "credici-o-no": [10, 10],
  "tre-versioni": [10, 10],
  "la-contraddizione": [10, 10],
  "alibi-impossibile": [10, 10],
  "puntata-nascosta": [5, 20],
  "soglia-di-rischio": [10, 10],
  "sicuro-o-rischio": [10, 10],
};
const SURFACES = { tv: [1920, 1080], phone: [390, 844], pc: [1440, 900] };
const codes = Object.keys(TIMES).filter((c) => !only.length || only.includes(c));

const browser = await chromium.launch({ channel: "chrome" });
let n = 0;
for (const [surface, [w, h]] of Object.entries(SURFACES)) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const code of codes) {
    for (const stage of ["play", "reveal"]) {
      const file = join(out, `${code}-${surface}-${stage}.png`);
      if (!force && existsSync(file)) continue;
      const t = TIMES[code][surface === "tv" ? 0 : 1];
      await page.goto(`${base}/preview/tig/giochi?view=${surface}&m=${code}&stage=${stage}&t=${t}&freeze=1`, { waitUntil: "networkidle" });
      await page.waitForTimeout(900);
      await page.screenshot({ path: file });
      n++;
    }
  }
  await page.close();
}
await browser.close();
console.log(`${n} screenshot salvati in ${out}`);
