import type { CharacterAnimation } from "./types";

/**
 * Gesti "una tantum" sul TV (durata in ms): le schermate chiedono un gesto per tutta la loro
 * durata (es. "point" per tutti i punti, "celebrate" per tutta la soluzione), ma il personaggio
 * lo fa UNA volta e poi torna a riposo o alla parlata. Senza questo restava col braccio alzato
 * finché la schermata non cambiava. Il ritorno è sfumato dal modello (~0.4 s).
 */
export const GESTURE_MS: Partial<Record<CharacterAnimation, number>> = {
  intro: 2200,
  wave: 2600,
  point: 1800,
  celebrate: 2800,
  surprised: 1600,
  // Ruota di Palmino: carica, colpo che lancia la ruota, accompagnamento (vedi palmino/animation.ts)
  spin: 1700,
};

/**
 * Animazione da dare al modello: il gesto richiesto finché non è stato fatto, poi riposo;
 * mentre il personaggio parla riposo e "indicare" diventano parlata.
 */
export function effectiveAnimation(requested: CharacterAnimation, gestureDone: boolean, talking: boolean): CharacterAnimation {
  const a: CharacterAnimation = GESTURE_MS[requested] && gestureDone ? "idle" : requested;
  return talking && (a === "idle" || a === "point") ? "talk" : a;
}
