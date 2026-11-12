#!/usr/bin/env node
/**
 * GIRAMENTE!: genera gli INSERT dell'archivio iniziale degli enigmi (content/giramente/enigmi.json)
 * e li scrive nella migrazione supabase/migrations/20261114090000_giramente.sql, dopo la riga
 * «-- @@SEED@@» (tutto ciò che segue viene rigenerato). Uso: node scripts/giramente/enigmi-sql.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const data = JSON.parse(readFileSync(path.join(root, "content", "giramente", "enigmi.json"), "utf8"));
const file = path.join(root, "supabase", "migrations", "20261114090000_giramente.sql");
const MARK = "-- @@SEED@@";

const q = (v) => {
  if (v === null || v === undefined) return "null";
  const s = String(v);
  if (s.includes("$g$")) throw new Error(`testo non valido: ${s}`);
  return `$g$${s}$g$`;
};
const j = (v) => (v === null || v === undefined ? "null" : `${q(JSON.stringify(v))}::jsonb`);
const n = (v) => (v === null || v === undefined ? "null" : String(Number(v)));

const cols = "slug, pool, kind, category, difficulty, prompt, clues, options, answer_index, solution, accepted, extra_clue, false_index, visual, explanation";
const rows = [];
const row = (r) =>
  `  (${[q(r.slug), q(r.pool), q(r.kind), q(r.category), q(r.difficulty), q(r.prompt ?? ""), j(r.clues ?? []), j(r.options), n(r.answer_index), q(r.solution), j(r.accepted ?? []), q(r.extra_clue), n(r.false_index), q(r.visual), q(r.explanation)].join(", ")})`;

for (const r of data.ruota) {
  rows.push(row({ ...r, pool: "ruota", options: r.options, answer_index: r.answer, solution: r.options[r.answer], extra_clue: r.clue, clues: r.clues ?? [] }));
}
for (const r of data.falsa_pista) {
  rows.push(row({ slug: r.slug, pool: "falsa_pista", kind: null, category: "indovinelli", difficulty: r.difficulty, prompt: "Tre indizi portano alla stessa soluzione, uno è una falsa pista.", clues: r.clues, solution: r.solution, accepted: r.accepted, false_index: r.false_index, explanation: r.explanation }));
}
for (const r of data.collegamento) {
  rows.push(row({ slug: r.slug, pool: "collegamento", kind: null, category: "collegamenti", difficulty: r.difficulty, prompt: "Qual è il concetto che unisce queste tre parole?", clues: r.words, solution: r.solution, accepted: r.accepted, extra_clue: r.extra_clue, explanation: r.explanation }));
}
for (const r of data.finale) {
  rows.push(row({ slug: r.slug, pool: "finale", kind: r.kind, category: r.category ?? "logica", difficulty: r.difficulty, prompt: r.prompt, clues: r.clues, visual: r.visual, solution: r.solution, accepted: r.accepted, explanation: r.explanation }));
}
for (const r of data.tabellone) {
  rows.push(row({ slug: r.slug, pool: "tabellone", kind: null, category: r.category, difficulty: r.difficulty, prompt: "", clues: [], solution: r.phrase, accepted: r.accepted, extra_clue: r.hint, explanation: null }));
}

const seed = `${MARK}\ninsert into public.giramente_puzzles (${cols}) values\n${rows.join(",\n")}\non conflict (slug) do nothing;\n`;
const sql = readFileSync(file, "utf8");
const at = sql.indexOf(MARK);
if (at < 0) throw new Error("segnaposto @@SEED@@ non trovato");
writeFileSync(file, sql.slice(0, at) + seed);
console.log(`GIRAMENTE: ${rows.length} enigmi scritti in ${path.relative(root, file)}`);
