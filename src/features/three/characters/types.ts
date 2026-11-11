import type { RefObject } from "react";
import type { ThreeElements } from "@react-three/fiber";

/**
 * Contratto comune dei personaggi 3D procedurali (Il Professore, La Regina,
 * Palmino). Ogni modello è costruito in codice (img2threejs) a partire
 * dalle illustrazioni ufficiali ed espone le stesse animazioni.
 */
export type CharacterAnimation = "idle" | "intro" | "talk" | "wave" | "celebrate" | "surprised" | "point";

export interface CharacterModelProps extends Omit<ThreeElements["group"], "ref"> {
  /** Animazione corrente; il cambio deve avvenire con una transizione morbida (~0.3 s). */
  animation?: CharacterAnimation;
  /**
   * Apertura della bocca 0..1 pilotata dalla voce (lip-sync). Quando > 0
   * il personaggio "parla" anche se l'animazione è idle.
   */
  mouthOpen?: number;
  /**
   * Come `mouthOpen` ma letto a ogni frame (ha la precedenza): il TV lo usa per non rifare il
   * render di React a ogni frame mentre il personaggio parla.
   */
  mouthRef?: RefObject<number>;
  /** Ritmo delle animazioni (1 = normale). */
  speed?: number;
  /** Qualità ridotta (meno segmenti) per TV/PC poco potenti. */
  lowPower?: boolean;
}

/**
 * Convenzioni di scena per tutti i modelli:
 * - unità in metri, asse Y in alto, il personaggio guarda verso +Z
 * - origine ai piedi (Palmino) oppure alla base del busto (presentatori
 *   inquadrati fino alla vita, come nelle illustrazioni)
 * - altezza visibile ~1.7–1.9 (presentatori, fino alla testa) e ~1.6 (Palmino, fino alle foglie)
 */
export const CHARACTER_UNITS = "meters" as const;
