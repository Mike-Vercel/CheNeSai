/**
 * Elenco delle battute registrate dell'intro (presentazione + regole) con il testo mostrato a video.
 * Usato da scripts/intro-word-timings.py:  npx tsx scripts/intro-lines.ts  → JSON su stdout.
 */
import { INTRO_SPEECH } from "../src/features/game/speech";
import { INTRO_CLIP_DIR, RULES, RULES_AUDIO_DIR } from "../src/features/three/rules";

const lines = [
  ...INTRO_SPEECH.filter((l) => l.clipWho !== null).map((l) => ({ audio: `public${INTRO_CLIP_DIR}${l.clip}.mp3`, text: l.line.text })),
  ...RULES.map((r) => ({ audio: `public${RULES_AUDIO_DIR}${r.file}`, text: r.text })),
];
process.stdout.write(JSON.stringify(lines));
