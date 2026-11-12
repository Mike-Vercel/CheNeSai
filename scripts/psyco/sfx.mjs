#!/usr/bin/env node
/**
 * PSYCO – effetti sonori dell'introduzione 3D (passi, sedia, lampada, pioggia), generati UNA volta con
 * ElevenLabs Sound Effects (POST /v1/sound-generation) e salvati in public/audio/psyco/sfx/.
 *
 *   npm run psyco:sfx            (genera solo i file che mancano)
 *   npm run psyco:sfx -- --force (rigenera tutto: costa crediti)
 *
 * Chiave: ELEVENLABS_API_KEY in .env.local (mai stampata). Con ffmpeg: taglio del silenzio iniziale,
 * volume normalizzato, mp3 128 kbps. Origine e testi delle richieste: public/audio/psyco/sfx/LEGGIMI.md.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve("public/audio/psyco/sfx");
const force = process.argv.includes("--force");

/** id → richiesta (testo in inglese: il modello degli effetti lo capisce meglio). */
export const SFX = {
  passo: { text: "A single footstep of a leather dress shoe on an old wooden parquet floor in an empty quiet room, close, dry with a little room reverb. One step only.", duration: 0.7, influence: 0.6, loudnorm: -18 },
  sedia: { text: "An old wooden office chair creaking as a man sits down on it, leather cushion, quiet empty room.", duration: 1.6, influence: 0.5, loudnorm: -20 },
  lampada: { text: "The metal pull switch of an old desk lamp clicking on, a short click followed by the faint buzz of a filament bulb.", duration: 0.8, influence: 0.6, loudnorm: -20 },
  pioggia: { text: "Steady rain against a window heard from inside a dark quiet room, distant soft thunder, seamless ambience.", duration: 10, influence: 0.4, loudnorm: -30 },
};

function readKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  try {
    const m = readFileSync(".env.local", "utf8").match(/^ELEVENLABS_API_KEY=(.+)$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

async function main() {
  const key = readKey();
  if (!key) {
    console.error("ELEVENLABS_API_KEY mancante (.env.local)");
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  for (const [id, s] of Object.entries(SFX)) {
    const dst = path.join(OUT, `${id}.mp3`);
    if (existsSync(dst) && !force) {
      console.log(`= ${id}.mp3 (già presente)`);
      continue;
    }
    const res = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: s.text, duration_seconds: s.duration, prompt_influence: s.influence }),
    });
    if (!res.ok) {
      console.error(`! ${id}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    const raw = path.join(OUT, `${id}.raw.mp3`);
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    if (hasFfmpeg) {
      // via il silenzio iniziale (il passo deve cadere esattamente sul piede), volume uniforme
      const trim = id === "pioggia" ? "" : "silenceremove=start_periods=1:start_threshold=-45dB,";
      const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-af", `${trim}loudnorm=I=${s.loudnorm}:TP=-1.5:LRA=11`, "-ar", "44100", "-b:a", "128k", dst]);
      if (r.status === 0) rmSync(raw);
      else renameSync(raw, dst);
    } else {
      renameSync(raw, dst);
    }
    console.log(`+ ${id}.mp3`);
  }
}

void main();
