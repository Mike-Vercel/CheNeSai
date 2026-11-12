#!/usr/bin/env node
/**
 * PSYCO – genera le istruzioni SQL del seme delle regole da content/psyco/regole.json.
 *
 *   node scripts/psyco/regole-sql.mjs > /tmp/seed.sql            (insert delle regole)
 *   node scripts/psyco/regole-sql.mjs --indizi > /tmp/indizi.sql (update degli indizi dell'Investigatore)
 *
 * Il risultato va incollato in una NUOVA migrazione (mai modificare quelle già applicate):
 *  - insert: `on conflict (slug) do nothing` → idempotente e non sovrascrive le modifiche del pannello;
 *  - indizi: aggiornano SOLO le regole il cui testo è ancora quello originale e che non hanno indizi
 *    (le righe modificate dal pannello admin restano come sono). Rieseguiti non cambiano nulla.
 */
import { readFileSync } from "node:fs";

const rules = JSON.parse(readFileSync(new URL("../../content/psyco/regole.json", import.meta.url), "utf8"));
const q = (s) => (s == null ? "null" : `$r$${String(s)}$r$`);

if (process.argv.includes("--indizi")) {
  const rows = rules
    .filter((r) => Array.isArray(r.hints) && r.hints.length === 3)
    .map(
      (r) =>
        `update public.psyco_rules set hint_1 = ${q(r.hints[0])}, hint_2 = ${q(r.hints[1])}, hint_3 = ${q(r.hints[2])}\n` +
        `  where slug = ${q(r.slug)} and description = ${q(r.description)} and hint_1 is null and hint_2 is null and hint_3 is null;`,
    );
  process.stdout.write(`${rows.join("\n")}\n`);
} else {
  const rows = rules.map(
    (r) => `  (${q(r.slug)}, ${q(r.title)}, ${q(r.description)}, ${q(r.difficulty)}, ${q(r.instructions)}, ${q(r.example)})`,
  );
  process.stdout.write(
    `insert into public.psyco_rules (slug, title, description, difficulty, instructions, example) values\n${rows.join(",\n")}\non conflict (slug) do nothing;\n`,
  );
}
