#!/usr/bin/env node
/**
 * PSYCO – voce narrante e colonna sonora: da REFERENCE (mai modificata) a public/audio/psyco.
 *
 *   npm run psyco:voci                       (cerca ./REFERENCE)
 *   npm run psyco:voci -- --ref ../QUIZZONE/REFERENCE
 *
 * Voci:   REFERENCE/GIOCHI/PSYCO/AUDIO/NARRATORE/<id>.mp3   → public/audio/psyco/<id>.mp3
 * Musica: REFERENCE/GIOCHI/PSYCO/COLONNE_SONORE/PSYCO.mp3  → public/audio/psyco/tema.mp3
 * (vecchi percorsi REFERENCE/AUDIO/PSYCO e REFERENCE/COLONNE_SONORE_GIOCHI ancora accettati)
 *
 * Con ffmpeg disponibile: volume normalizzato (loudnorm EBU R128: voci -16 LUFS, musica -20 LUFS),
 * mp3 128 kbps, musica con dissolvenza in entrata/uscita (si ripete in loop senza scatti).
 * Senza ffmpeg: copia semplice. Gli id attesi sono in src/features/psyco/narrator.ts (VOICE_LINES).
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const refArg = args.indexOf("--ref");
const REF = path.resolve(refArg >= 0 ? args[refArg + 1] : "REFERENCE");
const OUT = path.resolve("public/audio/psyco");
// percorsi attuali (REFERENCE organizzata per gioco, vedi REFERENCE/LEGGIMI.md), con ripiego sui vecchi
const firstExisting = (...p) => p.find((x) => existsSync(x)) ?? p[0];
const VOICES = firstExisting(path.join(REF, "GIOCHI", "PSYCO", "AUDIO", "NARRATORE"), path.join(REF, "AUDIO", "PSYCO"));
const MUSIC = firstExisting(path.join(REF, "GIOCHI", "PSYCO", "COLONNE_SONORE", "PSYCO.mp3"), path.join(REF, "COLONNE_SONORE_GIOCHI", "PSYCO.mp3"));

// id attesi, letti dal narratore (unica fonte)
const src = readFileSync(path.resolve("src/features/psyco/narrator.ts"), "utf8");
const block = src.slice(src.indexOf("export const VOICE_LINES"), src.indexOf("} as const;"));
const expected = [...block.matchAll(/^\s+"?([a-z-]+)"?:/gm)].map((m) => m[1]);

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
mkdirSync(OUT, { recursive: true });

function ffmpeg(input, output, filters) {
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", input, "-af", filters, "-ac", "2", "-ar", "44100", "-b:a", "128k", output], {
    stdio: "inherit",
    windowsHide: true,
  });
  return r.status === 0;
}

function duration(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { encoding: "utf8" });
  return Number(r.stdout?.trim()) || 0;
}

let ok = 0;
const missing = [];
if (!existsSync(VOICES)) {
  console.warn(`Cartella delle voci non trovata: ${VOICES}`);
} else {
  const files = new Set(readdirSync(VOICES).filter((f) => f.toLowerCase().endsWith(".mp3")));
  for (const id of expected) {
    const file = [...files].find((f) => f.toLowerCase() === `${id}.mp3`);
    if (!file) {
      missing.push(id);
      continue;
    }
    const from = path.join(VOICES, file);
    const to = path.join(OUT, `${id}.mp3`);
    if (!(hasFfmpeg && ffmpeg(from, to, "loudnorm=I=-16:TP=-1.5:LRA=11"))) copyFileSync(from, to);
    ok++;
  }
  const extra = [...files].filter((f) => !expected.includes(f.replace(/\.mp3$/i, "").toLowerCase()));
  if (extra.length) console.warn(`File non usati dal narratore: ${extra.join(", ")}`);
}
console.log(`Voci: ${ok}/${expected.length} pronte in public/audio/psyco${hasFfmpeg ? " (normalizzate)" : " (copiate, ffmpeg non trovato)"}`);
if (missing.length) console.warn(`Mancano (il gioco mostra solo il sottotitolo): ${missing.join(", ")}`);

if (existsSync(MUSIC)) {
  const to = path.join(OUT, "tema.mp3");
  const d = duration(MUSIC);
  const fadeOut = d > 6 ? `,afade=t=out:st=${(d - 2.5).toFixed(2)}:d=2.5` : "";
  if (!(hasFfmpeg && ffmpeg(MUSIC, to, `loudnorm=I=-20:TP=-2:LRA=11,afade=t=in:st=0:d=1.5${fadeOut}`))) copyFileSync(MUSIC, to);
  console.log(`Colonna sonora: public/audio/psyco/tema.mp3${d ? ` (${Math.round(d)} s)` : ""}`);
} else {
  console.warn(`Colonna sonora non trovata: ${MUSIC}`);
}
