/**
 * Stima una tantum dei caratteri ElevenLabs per pre-generare la libreria ufficiale:
 * frasi fisse (senza nomi) + parti fisse delle battute con i nomi ("nomi salvati").
 *
 *   npx tsx scripts/libreria-costo.ts [--level leggero|sarcastico|irriverente] [--no-accent] [--print]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitByNames } from "@/features/game/name-segments";
import { levelAllowed, renderTemplate } from "@/lib/show/library";
import type { ComedyLevel, DialogueTemplate } from "@/lib/show/types";

const args = process.argv.slice(2);
const level = (args[args.indexOf("--level") + 1] as ComedyLevel | undefined) ?? "irriverente";
const accent = !args.includes("--no-accent");
const file = JSON.parse(readFileSync(join(process.cwd(), "content", "show", "libreria-ufficiale.json"), "utf8")) as { lines: DialogueTemplate[] };

let fixedChars = 0;
let fixedLines = 0;
const segments = new Map<string, number>();
// con le varianti per genere (femminile, neutra): testi diversi, clip diverse
const rows = file.lines.flatMap((l) => [l, ...[l.textF, l.textN].filter((x): x is string => !!x).map((text) => ({ ...l, text }))]);
for (const raw of rows) {
  const t = { ...raw, origin: "ufficiale" as const };
  if (!levelAllowed(t.level, args.includes("--level") ? level : "irriverente")) continue;
  const ph = [...t.text.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]);
  const r = renderTemplate(t, Object.fromEntries(ph.map((k) => [k, "Gigi"])), { palminoAccent: accent });
  if (!r) continue;
  if (args.includes("--print")) console.log(`${t.character.padEnd(10)} ${r.text}`);
  if (ph.length === 0) {
    fixedChars += r.text.length;
    fixedLines++;
    continue;
  }
  for (const s of splitByNames(r.text, ["Gigi"]) ?? []) if (s.kind === "fixed") segments.set(`${t.character}|${s.text}`, s.text.length);
}
const segChars = [...segments.values()].reduce((a, b) => a + b, 0);
console.log(`livello ${level}, accento ${accent ? "sì" : "no"}`);
console.log(`frasi fisse: ${fixedLines} (${fixedChars} caratteri)`);
console.log(`parti fisse delle battute con i nomi: ${segments.size} (${segChars} caratteri)`);
console.log(`totale una tantum: ${fixedChars + segChars} caratteri`);
