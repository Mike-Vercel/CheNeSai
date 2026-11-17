// TAVOLI IN GUERRA! — genera dal catalogo vocale (content/tig/voci/*.json, formato src/lib/tig/voices/schema.ts):
//   - TAVOLI_IN_GUERRA_FRASI_COMPLETE.txt  (tutte le frasi, consultabile senza software, per ElevenLabs & co.)
//   - TAVOLI_IN_GUERRA_PERSONAGGI.md       (nomi, sesso, personalità, voce, ruolo, cosa resta da confermare)
// e controlla il catalogo: ID unici, minimi per livello, variabili ammesse, niente doppioni.
// Uso: node scripts/tig/genera-frasi.mjs   (dalla cartella del progetto)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIR = join(ROOT, "content", "tig", "voci");
const VARS = ["TAVOLO_A", "TAVOLO_B", "MASCOTTE_A", "MASCOTTE_B", "PUNTI", "MANCHE", "MINIGIOCO", "SECONDI", "POSIZIONE"];
const MIN = { presentatore: 120, ospite: 60, mascotte: 100 };
// ordine di presentazione: prima i presentatori, poi gli altri esistenti, poi le mascotte
const TIER_ORDER = { presentatore: 0, ospite: 1, mascotte: 2 };

const schemaSrc = readFileSync(join(ROOT, "src", "lib", "tig", "voices", "schema.ts"), "utf8");
const CATEGORIES = Object.fromEntries(
  [...schemaSrc.matchAll(/^\s{2}([A-Z_0-9]+): "([^"]+)",$/gm)].map((m) => [m[1], m[2]]),
);

const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const all = files
  .map((f) => JSON.parse(readFileSync(join(DIR, f), "utf8")))
  .sort((a, b) => TIER_ORDER[a.character.tier] - TIER_ORDER[b.character.tier] || a.character.name.localeCompare(b.character.name, "it"));

const problems = [];
const seenIds = new Set();
const seenTexts = new Map();
const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\{[A-Z_]+\}/g, "").replace(/[^a-z0-9]+/g, " ").trim();
for (const { character: c, lines } of all) {
  if (lines.length < MIN[c.tier]) problems.push(`${c.name}: ${lines.length} frasi (minimo ${MIN[c.tier]})`);
  for (const l of lines) {
    if (seenIds.has(l.id)) problems.push(`ID doppio: ${l.id}`);
    seenIds.add(l.id);
    if (!CATEGORIES[l.scene]) problems.push(`${l.id}: scena sconosciuta ${l.scene}`);
    const used = [...l.text.matchAll(/\{([A-Z_]+)\}/g)].map((m) => m[1]);
    for (const v of used) if (!VARS.includes(v)) problems.push(`${l.id}: variabile non ammessa {${v}}`);
    if (/\[/.test(l.text)) problems.push(`${l.id}: parentesi quadre nel testo`);
    const k = norm(l.text);
    if (seenTexts.has(k)) problems.push(`${l.id}: testo uguale a ${seenTexts.get(k)}`);
    seenTexts.set(k, l.id);
  }
}

const today = new Date().toISOString().slice(0, 10);
const total = all.reduce((s, f) => s + f.lines.length, 0);
const sep = "=".repeat(60);
let txt = `TAVOLI IN GUERRA! — FRASI COMPLETE DEI PERSONAGGI\nGenerato il ${today} da content/tig/voci (${all.length} personaggi, ${total} frasi).\n\n`;
txt += `COME LEGGERLO\n- Ogni frase ha ID univoco, scena (situazione di gioco), tono, durata indicativa e testo completo.\n`;
txt += `- Le variabili tra graffe vengono sostituite dal gioco: {TAVOLO_A}/{TAVOLO_B} = "il tavolo 3", {MASCOTTE_A}/{MASCOTTE_B} = nome della mascotte,\n  {PUNTI}, {MANCHE}, {MINIGIOCO}, {SECONDI}, {POSIZIONE}. La voce NON pronuncia mai i nomi delle squadre scritti dai giocatori.\n`;
txt += `- Le frasi con variabili si generano al momento (voce sintetica); quelle senza variabili si possono registrare\n  e salvare come public/audio/tig/voci/<ID>.mp3.\n- "DA CONFERMARE" = dato non ancora definito dal proprietario.\n\n`;
txt += `LE 12 NUOVE MASCOTTE: nomi, sesso e personalità non sono ancora definiti. Le loro frasi (almeno 100 a testa)\nsi scriveranno quando arriveranno i modelli e i dati.\n\n`;
for (const { character: c, lines } of all) {
  txt += `${sep}\nPERSONAGGIO: ${c.name.toUpperCase()}\nSESSO: ${c.sex}\nVOCE: ${c.voice}\nRUOLO: ${c.role}\n`;
  if (c.toConfirm?.length) txt += `DA CONFERMARE: ${c.toConfirm.join("; ")}\n`;
  txt += `FRASI: ${lines.length}\n${sep}\n\n`;
  for (const l of lines) {
    txt += `ID: ${l.id}\nSCENA: ${CATEGORIES[l.scene] ?? l.scene} (${l.scene})\nTONO: ${l.tone}\nDURATA: ${l.duration}\n`;
    if (l.vars?.length) txt += `VARIABILI: ${l.vars.map((v) => `{${v}}`).join(", ")}\n`;
    txt += `FRASE:\n"${l.text}"\n\n`;
  }
}
writeFileSync(join(ROOT, "TAVOLI_IN_GUERRA_FRASI_COMPLETE.txt"), txt, "utf8");

let md = `# TAVOLI IN GUERRA! — Personaggi\n\nGenerato il ${today} da \`content/tig/voci\` (${all.length} personaggi, ${total} frasi).\n`;
md += `Corrispondenze e dati segnati "DA CONFERMARE" vanno verificati dal proprietario.\n\n`;
md += `| Personaggio | Sesso | Livello | Frasi | Modello 3D | Da confermare |\n|---|---|---|---|---|---|\n`;
for (const { character: c, lines } of all) md += `| ${c.name} | ${c.sex} | ${c.tier} | ${lines.length} | ${c.model ?? "—"} | ${(c.toConfirm ?? []).join("; ") || "—"} |\n`;
md += `| 12 nuove mascotte (slot 1–12) | DA DEFINIRE | mascotte | 0 (≥100 a testa quando definite) | in arrivo (GLB) | nomi, aspetto, sesso, personalità, voce |\n\n`;
for (const { character: c } of all) {
  md += `## ${c.name}\n\n- **Sesso:** ${c.sex}\n- **Voce:** ${c.voice}\n- **Ruolo nello show:** ${c.role}\n- **Modello 3D:** ${c.model ?? "nessuno nel progetto"}\n`;
  if (c.toConfirm?.length) md += `- **Da confermare:** ${c.toConfirm.join("; ")}\n`;
  md += `\n${c.personality}\n\n`;
}
writeFileSync(join(ROOT, "TAVOLI_IN_GUERRA_PERSONAGGI.md"), md, "utf8");

console.log(`${all.length} personaggi, ${total} frasi → TAVOLI_IN_GUERRA_FRASI_COMPLETE.txt, TAVOLI_IN_GUERRA_PERSONAGGI.md`);
if (problems.length) {
  console.log(`PROBLEMI (${problems.length}):\n- ${problems.slice(0, 60).join("\n- ")}`);
  process.exitCode = 1;
}
