import type { ComponentType, RefObject } from "react";

/**
 * TAVOLI IN GUERRA! — CONTRATTO DELLA SCENA 3D («arena»).
 *
 * Il ramo 3D implementa questi componenti in `src/features/tig/three/` ed esporta da `src/features/tig/three/index.ts`
 * oggetti con ESATTAMENTE questi nomi e queste props; il ramo core li usa da `src/features/tig/visuals.tsx`
 * (che durante lo sviluppo può esportare versioni 2D di riserva con le stesse props).
 * Una sola arena per pagina, montata una volta e mai ricaricata tra le fasi.
 */

export type VisualQuality = "high" | "low" | "2d";

/** Slot delle 12 mascotte di TAVOLI IN GUERRA! (1–12). I dati veri arrivano con i modelli GLB. */
export type MascotSlot = number;
export type MascotLevel = 1 | 2 | 3;

/** Personaggi esistenti che possono condurre o commentare (modelli già nel progetto o in REFERENCE). */
export type HostId =
  | "professore" // «Professor Smoke» (corrispondenza DA CONFERMARE)
  | "regina"
  | "palmino"
  | "investigatore" // «Victor» (corrispondenza DA CONFERMARE)
  | "don-patrizio"
  | "zafira"
  | "nek"
  | "ciccio"
  | "franca"
  | "piroletto"
  | "minu"
  | "chicca"
  | "bumbaru"
  | "mordicchio"
  | "mammusss"
  | "rumpo";

export type ArenaPhase =
  | "lobby" //        tavoli che si riempiono, QR
  | "intro" //        apertura della serata
  | "manche-intro" // titolo della manche
  | "game" //         prova in corso (HUD sopra)
  | "reveal" //       soluzione ed esiti
  | "leaderboard" //  classifica animata
  | "chaos" //        ALLARME CAOS!
  | "duel" //         due tavoli a confronto
  | "evolve" //       una mascotte evolve
  | "break" //        pausa
  | "final" //        TUTTO O NIENTE!
  | "awards"; //      premiazione

export interface ArenaTeam {
  teamId: string;
  tableNo: number;
  /** nome già approvato dallo staff (solo testo a schermo, mai pronunciato) */
  name: string;
  color: string;
  mascotSlot: MascotSlot | null;
  mascotLevel: MascotLevel;
  score: number;
  /** posizione condivisa in caso di parità */
  rank: number;
  /** 0..1 verso il prossimo livello */
  chaosProgress: number;
  online: boolean;
}

export interface ArenaSpotlight {
  kind: "duel" | "chaos" | "evolve" | "winner" | "sabotage" | "attack" | "shield";
  teamIds: string[];
  /** id univoco dell'evento (per far partire l'animazione una volta sola) */
  eventId: string;
}

export interface ArenaHost {
  who: HostId;
  speaking: boolean;
  /** 0..1 apertura della bocca dalla voce (lip-sync) */
  mouthRef?: RefObject<number>;
}

export interface ArenaProps {
  phase: ArenaPhase;
  teams: ArenaTeam[];
  mancheNo: number | null;
  /** testo grande sul ledwall (titolo manche, nome della prova, «ALLARME CAOS!»…) */
  title: string | null;
  subtitle?: string | null;
  spotlight: ArenaSpotlight | null;
  hosts: ArenaHost[];
  /** orologio allineato al server (ms epoch) */
  now: () => number;
  quality: VisualQuality;
  /** area dello schermo lasciata libera dall'HUD (frazioni 0..1), per inquadrare dentro lo spazio visibile */
  safeArea?: { left: number; top: number; right: number; bottom: number };
  className?: string;
  onReady?: () => void;
}

export interface MascotProps {
  slot: MascotSlot | null;
  level: MascotLevel;
  color: string;
  action: "idle" | "cheer" | "sad" | "attack" | "hit" | "evolve" | "win";
  quality: VisualQuality;
  className?: string;
}

/** Esportazioni richieste a `src/features/tig/three/index.ts`. */
export interface TigVisuals {
  TigArena: ComponentType<ArenaProps>;
  /** mascotte singola (scheda squadra, voto mascotte sul telefono, premiazione) */
  TigMascot: ComponentType<MascotProps>;
  detectVisualQuality: () => VisualQuality;
}
