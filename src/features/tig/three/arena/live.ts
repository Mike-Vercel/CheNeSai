import type { ArenaSpotlight, ArenaTeam, MascotProps } from "../../arena-contract";
import type { ArenaDirection, Mood } from "./director";
import type { ArenaLayout } from "./layout";
import type { RankAnimator } from "./rank-anim";

/**
 * Stato condiviso dell'arena letto a ogni fotogramma (nessun render di React per le animazioni): regia, atmosfera,
 * classifica animata, cime delle torri. Scritto dal Director (prima di tutto il resto nel fotogramma).
 */
export interface ArenaLive {
  /** fase e suo inizio (ms, orologio del server) */
  phaseKey: string;
  phaseSince: number;
  /** spotlight corrente e suo inizio (ms) */
  spotKey: string;
  spotSince: number;
  elapsedMs: number;
  spotAgeMs: number;
  dir: ArenaDirection;
  mood: { mood: Mood; since: number };
  /** secondi di scena (si ferma con movimento ridotto) */
  t: number;
  ranks: RankAnimator;
  layout: ArenaLayout;
  /** squadre in ordine di tavolo (posizione fissa sull'arco) */
  teams: ArenaTeam[];
  spotlight: ArenaSpotlight | null;
  /** per ogni torre: x, quota della cima, z, yaw, scala della mascotte (MascotSwarm.ANCHOR_STRIDE = 5) */
  anchors: Float32Array;
  /** chi richiede 60 fps in questo momento */
  busy: { cam: boolean; scores: boolean; hosts: boolean; mascots: boolean; fx: boolean; led: boolean };
  /** il podio della premiazione è salito (0..1) */
  podium: number;
  /** squadre dei primi tre posti (premiazione) */
  podiumIds: string[];
  /** per ogni torre (ordine dei tavoli): azione, luminosità e scudo della mascotte, calcolati dalla regia */
  mascotActions: MascotProps["action"][];
  mascotDim: number[];
  mascotShield: boolean[];
}

/** Quota del piano superiore della base delle torri (la colonna parte da qui). */
export const BASE_H = 0.3;
/** Spessore del tappo in cima alla colonna. */
export const CAP_H = 0.07;
