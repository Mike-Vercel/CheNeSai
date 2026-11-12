#!/usr/bin/env node
/**
 * PSYCO – voce narrante, colonna sonora ed effetti: da REFERENCE (mai sovrascritta) a public/audio/psyco.
 *
 *   npm run psyco:voci                                   (cerca ./REFERENCE)
 *   npm run psyco:voci -- --ref ../QUIZZONE/REFERENCE    (da un worktree)
 *   npm run psyco:voci -- --genera                       (prima crea i file che mancano in REFERENCE, vedi sotto)
 *   npm run psyco:voci -- --solo-mancanti                (prepara solo i file che mancano in public/audio/psyco)
 *
 * Voci:    REFERENCE/GIOCHI/PSYCO/AUDIO/NARRATORE/<id>.mp3   → public/audio/psyco/<id>.mp3
 * Musica:  REFERENCE/GIOCHI/PSYCO/COLONNE_SONORE/PSYCO.mp3   → public/audio/psyco/tema.mp3
 * Effetti: REFERENCE/GIOCHI/PSYCO/AUDIO/EFFETTI/<nome>.mp3   → public/audio/psyco/<nome>.mp3
 * (vecchi percorsi REFERENCE/AUDIO/PSYCO e REFERENCE/COLONNE_SONORE_GIOCHI ancora accettati)
 *
 * --genera (solo i file che NON esistono già: gli originali non vengono mai sovrascritti):
 *  - le battute dell'Investigatore al telefono e «tocca-al-prossimo» con ElevenLabs (voce
 *    ELEVENLABS_VOICE_INVESTIGATORE, chiave ELEVENLABS_API_KEY da .env.local, mai stampata), modello
 *    eleven_v3 con i tag audio ([whispers]…), ripiego su eleven_multilingual_v2 senza tag. Si ferma se
 *    i caratteri da generare superano 3.000;
 *  - gli effetti della chiamata (squillo vintage, squillo breve, notifica, riattacca) sintetizzati con
 *    ffmpeg (nessun costo).
 *
 * Con ffmpeg disponibile: volume normalizzato (loudnorm EBU R128: voci -16 LUFS, musica -20 LUFS),
 * mp3 128 kbps, musica con dissolvenza in entrata/uscita (si ripete in loop senza scatti); la voce
 * dell'Investigatore AL TELEFONO passa da un filtro «cornetta» (banda 300–3400 Hz).
 * Senza ffmpeg: copia semplice. Gli id attesi sono in src/features/psyco/narrator.ts (VOICE_LINES).
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const refArg = args.indexOf("--ref");
const REF = path.resolve(refArg >= 0 ? args[refArg + 1] : "REFERENCE");
const OUT = path.resolve("public/audio/psyco");
const ONLY_MISSING = args.includes("--solo-mancanti");
// percorsi attuali (REFERENCE organizzata per gioco, vedi REFERENCE/LEGGIMI.md), con ripiego sui vecchi
const firstExisting = (...p) => p.find((x) => existsSync(x)) ?? p[0];
const VOICES = firstExisting(path.join(REF, "GIOCHI", "PSYCO", "AUDIO", "NARRATORE"), path.join(REF, "AUDIO", "PSYCO"));
const EFFECTS = path.join(REF, "GIOCHI", "PSYCO", "AUDIO", "EFFETTI");
const MUSIC = firstExisting(path.join(REF, "GIOCHI", "PSYCO", "COLONNE_SONORE", "PSYCO.mp3"), path.join(REF, "COLONNE_SONORE_GIOCHI", "PSYCO.mp3"));

// id attesi, letti dal narratore (unica fonte)
const src = readFileSync(path.resolve("src/features/psyco/narrator.ts"), "utf8");
const block = src.slice(src.indexOf("export const VOICE_LINES"), src.indexOf("} as const;"));
const expected = [...block.matchAll(/^\s+"?([a-z0-9-]+)"?:/gm)].map((m) => m[1]);

/**
 * Battute da generare con ElevenLabs (testo con i tag audio di eleven_v3; il sottotitolo nel gioco è
 * quello di VOICE_LINES, senza tag). Documentate in docs/psyco/VOCI.md.
 */
const GENERATE = {
  "tocca-al-prossimo": "[serious] Tocca al prossimo giocatore. [whispers] Gli altri… non guardate lo schermo.",
  "investigatore-1": "[whispers] Pronto? … [low voice] Sì, sono io. Non posso parlare a lungo. Ti ho mandato un messaggio. [whispers] Leggilo… e non farti vedere.",
  "investigatore-2": "[mysterious] Ascolta bene, Psyco. Le risposte non mentono mai… ma vanno lette. [whispers] Ti ho scritto tutto.",
  "investigatore-3": "[whispers] Non dire il mio nome ad alta voce. [serious] Controlla i messaggi: lì c'è quello che ti serve.",
  "investigatore-4": "[sighs] Ho seguito la pista per te. Non è molto… ma è qualcosa. [whispers] Ti ho appena scritto.",
  "investigatore-5": "[serious] Sono io. Niente domande. Ti ho mandato un messaggio: [whispers] leggilo, prima che sia tardi.",
  "investigatore-fine": "[whispers] Era l'ultima volta che rispondo. [mysterious] Da qui in poi… sei solo.",
};
/** Voce «al telefono»: filtro cornetta sulla copia del sito (l'originale resta pulito). */
const PHONE_VOICE = /^investigatore-/;
const CHAR_LIMIT = 3000;

/**
 * Effetti della chiamata, sintetizzati (aevalsrc di ffmpeg): squillo da telefono a campanello
 * (440+480 Hz con trillo a 22 Hz, doppio «drin» ogni 3 s, in loop), notifica a due note, riattacca
 * (clic + tre toni di occupato a 425 Hz, quello dei telefoni italiani).
 */
const RING = "(0.5*sin(2*PI*440*t)+0.5*sin(2*PI*480*t)+0.18*sin(2*PI*960*t))*(0.62+0.38*sin(2*PI*22*t))";
const EFFECT_SYNTH = {
  squillo: { d: 3, expr: `(between(mod(t\\,3)\\,0\\,0.42)+between(mod(t\\,3)\\,0.62\\,1.04))*${RING.replace(/,/g, "\\,")}*0.42` },
  "squillo-breve": { d: 1.25, expr: `(between(t\\,0\\,0.42)+between(t\\,0.62\\,1.04))*${RING.replace(/,/g, "\\,")}*0.4` },
  notifica: { d: 0.4, expr: "(between(t\\,0\\,0.1)*sin(2*PI*880*t)+between(t\\,0.12\\,0.26)*sin(2*PI*1320*t))*0.45*exp(-3*t)" },
  riattacca: {
    d: 1.4,
    expr: "between(t\\,0\\,0.03)*(random(1)*2-1)*0.5+(between(t\\,0.25\\,0.45)+between(t\\,0.65\\,0.85)+between(t\\,1.05\\,1.25))*sin(2*PI*425*t)*0.32",
  },
};

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

// ---------------------------------------------------------------------------
// --genera: crea in REFERENCE solo i file che mancano
// ---------------------------------------------------------------------------
async function generate() {
  // .env.local (chiave e voce): letto qui, mai stampato
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  mkdirSync(VOICES, { recursive: true });
  mkdirSync(EFFECTS, { recursive: true });

  if (hasFfmpeg) {
    for (const [name, fx] of Object.entries(EFFECT_SYNTH)) {
      const to = path.join(EFFECTS, `${name}.mp3`);
      if (existsSync(to)) continue;
      const r = spawnSync(
        "ffmpeg",
        ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `aevalsrc=${fx.expr}:s=44100:d=${fx.d}`, "-af", "afade=t=in:d=0.005", "-ac", "2", "-b:a", "128k", to],
        { stdio: "inherit", windowsHide: true },
      );
      console.log(r.status === 0 ? `Effetto creato: ${name}.mp3` : `Effetto NON creato: ${name}`);
    }
  } else console.warn("ffmpeg non trovato: effetti non creati (il gioco li sintetizza al volo)");

  const todo = Object.entries(GENERATE).filter(([id]) => !existsSync(path.join(VOICES, `${id}.mp3`)));
  if (todo.length === 0) {
    console.log("Voci dell'Investigatore: già tutte presenti, nessuna chiamata a ElevenLabs.");
    return;
  }
  const chars = todo.reduce((n, [, t]) => n + t.length, 0);
  console.log(`Voci da generare: ${todo.length} (${chars} caratteri)`);
  if (chars > CHAR_LIMIT) throw new Error(`Troppi caratteri (${chars} > ${CHAR_LIMIT}): mi fermo.`);
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_INVESTIGATORE;
  if (!key || !voice) throw new Error("Mancano ELEVENLABS_API_KEY o ELEVENLABS_VOICE_INVESTIGATORE in .env.local");

  let billed = 0;
  for (const [id, tagged] of todo) {
    let model = "eleven_v3";
    let res = await tts(key, voice, model, tagged, { stability: 0.5, similarity_boost: 0.8 });
    if (!res.ok && [400, 404, 422].includes(res.status)) {
      // modello v3 non disponibile per l'account/la voce: multilingual v2, senza tag audio
      model = "eleven_multilingual_v2";
      res = await tts(key, voice, model, tagged.replace(/\[[^\]]+\]\s*/g, ""), { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true });
    }
    if (!res.ok) throw new Error(`ElevenLabs ${res.status} per ${id}: ${(await res.text()).slice(0, 200)}`);
    const cost = Number(res.headers.get("character-cost") ?? res.headers.get("x-character-count") ?? tagged.length);
    billed += cost;
    writeFileSync(path.join(VOICES, `${id}.mp3`), Buffer.from(await res.arrayBuffer()));
    console.log(`Voce creata: ${id}.mp3 (${model}, ${cost} caratteri)`);
  }
  console.log(`Caratteri addebitati in totale: ${billed}`);
}

function tts(key, voice, model, text, settings) {
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: model, voice_settings: settings }),
    signal: AbortSignal.timeout(60_000),
  });
}

if (args.includes("--genera")) await generate();

// ---------------------------------------------------------------------------
// Copie ottimizzate per il sito
// ---------------------------------------------------------------------------
const skip = (to) => ONLY_MISSING && existsSync(to);

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
    ok++;
    if (skip(to)) continue;
    const filters = PHONE_VOICE.test(id) ? "highpass=f=300,lowpass=f=3400,acompressor=threshold=-18dB:ratio=3,loudnorm=I=-16:TP=-1.5:LRA=11" : "loudnorm=I=-16:TP=-1.5:LRA=11";
    if (!(hasFfmpeg && ffmpeg(from, to, filters))) copyFileSync(from, to);
  }
  const extra = [...files].filter((f) => !expected.includes(f.replace(/\.mp3$/i, "").toLowerCase()));
  if (extra.length) console.warn(`File non usati dal narratore: ${extra.join(", ")}`);
}
console.log(`Voci: ${ok}/${expected.length} pronte in public/audio/psyco${hasFfmpeg ? " (normalizzate)" : " (copiate, ffmpeg non trovato)"}`);
if (missing.length) console.warn(`Mancano (il gioco mostra solo il sottotitolo): ${missing.join(", ")}`);

if (existsSync(EFFECTS)) {
  const fx = readdirSync(EFFECTS).filter((f) => f.toLowerCase().endsWith(".mp3"));
  for (const f of fx) {
    const to = path.join(OUT, f.toLowerCase());
    if (!skip(to)) copyFileSync(path.join(EFFECTS, f), to);
  }
  console.log(`Effetti: ${fx.length} pronti in public/audio/psyco (${fx.join(", ")})`);
}

if (existsSync(MUSIC)) {
  const to = path.join(OUT, "tema.mp3");
  if (!skip(to)) {
    const d = duration(MUSIC);
    const fadeOut = d > 6 ? `,afade=t=out:st=${(d - 2.5).toFixed(2)}:d=2.5` : "";
    if (!(hasFfmpeg && ffmpeg(MUSIC, to, `loudnorm=I=-20:TP=-2:LRA=11,afade=t=in:st=0:d=1.5${fadeOut}`))) copyFileSync(MUSIC, to);
    console.log(`Colonna sonora: public/audio/psyco/tema.mp3${d ? ` (${Math.round(d)} s)` : ""}`);
  }
} else {
  console.warn(`Colonna sonora non trovata: ${MUSIC}`);
}
