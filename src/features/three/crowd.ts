import { T, WALK, clamp } from "./timeline";

/**
 * Momenti in cui il pubblico applaude (tempo di storia, in secondi): pop del titolo,
 * ingresso dei personaggi, fine di ogni battuta della presentazione, fine delle regole, SI GIOCA.
 * Gli stessi istanti pilotano l'animazione del pubblico (3D e 2D) e il suono (intro-audio).
 */
export const CROWD_BEATS: readonly { at: number; cheer: boolean; dur: number }[] = [
  { at: T.title + 0.3, cheer: true, dur: 2.8 },
  { at: WALK.profTo, cheer: false, dur: 2.4 },
  { at: T.palminoDrop + 0.4, cheer: true, dur: 2.8 },
  { at: T.lineProf - 0.15, cheer: false, dur: 1.8 },
  { at: T.lineRegina - 0.15, cheer: false, dur: 1.8 },
  { at: T.linePalmino - 0.15, cheer: false, dur: 1.8 },
  { at: T.rulesStart + 0.05, cheer: false, dur: 2.2 },
  { at: T.end, cheer: true, dur: 3.4 },
];

/** Eccitazione del pubblico: `clap` 0..1 (applauso), `cheer` 0..1 (braccia al cielo). */
export function crowdLevel(t: number): { clap: number; cheer: number } {
  let clap = 0;
  let cheer = 0;
  for (const b of CROWD_BEATS) {
    const d = t - b.at;
    if (d < -0.1 || d > b.dur) continue;
    const env = clamp((d + 0.1) / 0.25) * clamp((b.dur - d) / 0.6);
    clap = Math.max(clap, env);
    if (b.cheer) cheer = Math.max(cheer, env * clamp(1 - d / (b.dur * 0.75)));
  }
  // frame finale: il pubblico resta caldo
  if (t >= T.end) clap = Math.max(clap, 0.55);
  return { clap, cheer };
}
