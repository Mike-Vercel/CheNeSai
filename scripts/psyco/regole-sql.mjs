#!/usr/bin/env node
/**
 * PSYCO – genera le istruzioni SQL del seme delle regole da content/psyco/regole.json.
 *
 *   node scripts/psyco/regole-sql.mjs > /tmp/seed.sql
 *
 * Il risultato va incollato in una NUOVA migrazione (mai modificare quelle già applicate):
 * `on conflict (slug) do nothing` → idempotente e non sovrascrive le modifiche fatte dal pannello.
 */
import { readFileSync } from "node:fs";

const rules = JSON.parse(readFileSync(new URL("../../content/psyco/regole.json", import.meta.url), "utf8"));
const q = (s) => (s == null ? "null" : `$r$${String(s)}$r$`);
const rows = rules.map(
  (r) => `  (${q(r.slug)}, ${q(r.title)}, ${q(r.description)}, ${q(r.difficulty)}, ${q(r.instructions)}, ${q(r.example)})`,
);
process.stdout.write(
  `insert into public.psyco_rules (slug, title, description, difficulty, instructions, example) values\n${rows.join(",\n")}\non conflict (slug) do nothing;\n`,
);
