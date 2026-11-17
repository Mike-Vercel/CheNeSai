// TAVOLI IN GUERRA! — prepara la musica di sottofondo (brani creati con Suno, prompt in docs/tavoli-in-guerra/musica-suno.txt).
//
//   node scripts/tig/musica.mjs                         → legge REFERENCE/GIOCHI/TAVOLI_IN_GUERRA/MUSICA
//   node scripts/tig/musica.mjs <cartella> [--kbps=160]
//
// - accetta solo i nomi previsti (sigla, lobby, prova, manche-1..5, ... , gioco-NN-codice) in mp3/wav/m4a/flac;
// - volume uniforme in due passate (ffmpeg loudnorm, -17 LUFS, picco -1,5 dB) così ogni brano sta sotto la voce allo
//   stesso modo; mp3 stereo 44,1 kHz; i brani oltre 4 minuti si accorciano con dissolvenza finale;
// - scrive public/audio/tig/musica/<nome>.mp3 (mai tocca gli originali) e rigenera src/features/tig/music-files.ts.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const SRC = args.find((a) => !a.startsWith("--")) ?? join(ROOT, "REFERENCE", "GIOCHI", "TAVOLI_IN_GUERRA", "MUSICA");
const KBPS = Number((args.find((a) => a.startsWith("--kbps=")) ?? "--kbps=160").split("=")[1]);
const OUT = join(ROOT, "public", "audio", "tig", "musica");
const MAX_SEC = 240;

const SHOW = ["sigla", "sigla-strumentale", "lobby", "apertura", "manche-1", "manche-2", "manche-3", "manche-4", "manche-5", "prova", "ultimi-secondi", "reveal", "classifica", "allarme-caos", "duello-caos", "evoluzione", "pausa", "finale", "premiazione", "saluti"];
const OK_NAME = (n) => SHOW.includes(n) || /^gioco-\d{2}-[a-z0-9-]+$/.test(n);

function ffmpeg(argv) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", ...argv], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`ffmpeg non trovato: ${r.error.message}`);
  return r;
}

function measure(file) {
  const r = ffmpeg(["-i", file, "-t", String(MAX_SEC), "-af", "loudnorm=I=-17:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"]);
  const m = /\{[\s\S]*?"input_i"[\s\S]*?\}/.exec(r.stderr);
  if (!m) throw new Error(`misura non riuscita: ${basename(file)}`);
  return JSON.parse(m[0]);
}

if (!existsSync(SRC)) {
  console.error(`Cartella dei brani non trovata: ${SRC}`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const inputs = readdirSync(SRC).filter((f) => /\.(mp3|wav|m4a|flac)$/i.test(f));
const skipped = [];
let done = 0;
for (const f of inputs) {
  const name = basename(f, extname(f)).toLowerCase();
  if (!OK_NAME(name)) {
    skipped.push(f);
    continue;
  }
  const src = join(SRC, f);
  const m = measure(src);
  const dur = Number(/Duration: (\d+):(\d+):(\d+\.\d+)/.exec(ffmpeg(["-i", src]).stderr)?.slice(1).reduce((s, v, i) => s + Number(v) * [3600, 60, 1][i], 0) ?? 0);
  const fade = dur > MAX_SEC ? `,afade=t=out:st=${MAX_SEC - 3}:d=3` : "";
  const ln = `loudnorm=I=-17:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const out = join(OUT, `${name}.mp3`);
  const r = ffmpeg(["-y", "-i", src, "-t", String(MAX_SEC), "-af", `${ln}${fade}`, "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", `${KBPS}k`, out]);
  if (r.status !== 0) {
    console.error(`× ${f}: ${r.stderr.split("\n").slice(-3).join(" ")}`);
    continue;
  }
  done++;
  console.log(`✓ ${name}.mp3 (${Math.round(Math.min(dur, MAX_SEC))} s, da ${Number(m.input_i).toFixed(1)} LUFS a -17)`);
}

const files = readdirSync(OUT)
  .filter((f) => f.endsWith(".mp3"))
  .map((f) => basename(f, ".mp3"))
  .filter(OK_NAME)
  .sort();
writeFileSync(
  join(ROOT, "src", "features", "tig", "music-files.ts"),
  `/**\n * TAVOLI IN GUERRA! — brani presenti in \`public/audio/tig/musica/\` (nome senza estensione).\n * FILE GENERATO da \`node scripts/tig/musica.mjs\` (non modificarlo a mano): così la TV chiede solo i brani che esistono,\n * senza richieste a vuoto. Vuoto = nessuna musica di sottofondo (restano voci ed effetti).\n */\nexport const TIG_MUSIC_FILES: readonly string[] = ${JSON.stringify(files, null, 2).replace(/\n/g, "\n")};\n`,
);
console.log(`\n${done} brani preparati in public/audio/tig/musica, ${files.length} in elenco.`);
if (skipped.length) console.log(`Saltati (nome non previsto, rinominali come nel file dei prompt): ${skipped.join(", ")}`);
