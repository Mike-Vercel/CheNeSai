#!/usr/bin/env node
/**
 * Aggiorna la struttura del database online (Supabase "che-ne-sai") con le migrazioni nuove.
 * Da lanciare PRIMA di pubblicare codice che le usa:  npm run deploy:migrate
 * Legge la password del database da .env.production.local (creato da deploy:setup, escluso da git).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const FILE = ".env.production.local";
if (!existsSync(FILE)) {
  console.error(`Manca ${FILE}: lancia prima "npm run deploy:setup".`);
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(FILE, "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const { SUPABASE_DB_PASSWORD: pw, SUPABASE_PROJECT_REF: ref } = env;
if (!pw || !ref) {
  console.error(`In ${FILE} mancano SUPABASE_DB_PASSWORD o SUPABASE_PROJECT_REF.`);
  process.exit(1);
}

const run = (args) => {
  const r = spawnSync("npx", ["supabase", ...args], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error("\n✖ Aggiornamento non riuscito (vedi sopra). Il sito online non è stato toccato.");
    process.exit(r.status ?? 1);
  }
};

console.log("Collego il progetto Supabase online…");
run(["link", "--project-ref", ref, "--password", pw, "--yes"]);
console.log("Applico le migrazioni nuove…");
run(["db", "push", "--linked", "--password", pw, "--include-all", "--yes"]);
console.log("\n✔ Database online aggiornato. Ora si può pubblicare il codice nuovo.");
