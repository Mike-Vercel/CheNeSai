import type { Presenter } from "@/lib/game-engine/types";
import { T as INTRO_T } from "@/features/three/timeline";
import type { SpokenLine } from "./script";

/**
 * Il copione delle transizioni (speechFor) vive in ./script: funzioni pure
 * condivise col server, che pre-genera e pre-riscalda le stesse battute.
 */
export { speechFor, type SpokenLine, type TtsRole } from "./script";

/**
 * Battute dell'intro, sincronizzate con la timeline (secondi, da T in features/three/timeline).
 * `clip` = nome del file registrato opzionale in public/audio/intro/<clip>.mp3 (es. ElevenLabs):
 * se esiste si usa quello (lip-sync reale), altrimenti la voce del browser legge `line`.
 * `clipWho` = chi muove la bocca durante la clip (null = annunciatore fuori campo).
 * Lo "strillo" dell'annunciatore è scritto allungato come lo vuole l'utente.
 */
export interface IntroSpeechLine {
  at: number;
  clip: "annunciatore" | "benvenuti" | "professore" | "regina" | "palmino";
  clipWho: Presenter | null;
  line: SpokenLine & { who: Presenter };
}

export const INTRO_SPEECH: IntroSpeechLine[] = [
  { at: INTRO_T.title + 0.15, clip: "annunciatore", clipWho: null, line: { who: "professore", text: "Cheeeee ne saaaaai?!" } },
  { at: INTRO_T.welcome, clip: "benvenuti", clipWho: "professore", line: { who: "professore", text: "Benvenuti su Che ne sai!" } },
  { at: INTRO_T.lineProf, clip: "professore", clipWho: "professore", line: { who: "professore", text: "Siete pronti a mettervi alla prova?" } },
  { at: INTRO_T.lineRegina, clip: "regina", clipWho: "regina", line: { who: "regina", text: "Solo i migliori arriveranno in cima!" } },
  { at: INTRO_T.linePalmino, clip: "palmino", clipWho: "palmino", line: { who: "palmino", text: "E attenti alle sorprese!" } },
];
// Il conto alla rovescia "3, 2, 1" non viene letto: è scandito dai beep (intro-audio.ts).
