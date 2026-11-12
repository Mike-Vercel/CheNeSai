import type { RefObject } from "react";

/**
 * GIRAMENTE! — contratto del livello visivo (ruota, personaggi, portale della Jolly, Tabellone Segreto).
 * La logica di gioco (server, stanze, punteggi) vive altrove e usa SOLO questi tipi: qui niente regole.
 */

/** Le otto caselle della ruota (manche 1 e 3) e le quattro categorie del Giro Decisivo. */
export type WheelKind = "intruso" | "sequenza" | "indizi" | "prospettiva" | "mistero" | "jolly" | "bonus" | "colpo";

export interface WheelSegment {
  id: string;
  kind: WheelKind;
  label: string;
  /** colore dello spicchio (verde / rosso / avorio, mai arcobaleno) */
  color: string;
  /** colore di scritta e icona (predefinito: bianco con contorno scuro) */
  textColor?: string;
}

/** Comando di giro deciso dal SERVER: a startedAt + durationMs la ruota è ferma su targetIndex. */
export interface WheelSpinCommand {
  spinId: string;
  targetIndex: number;
  /** istante di partenza (ms epoch, orologio del server) */
  startedAt: number;
  durationMs: number;
}

/** "high" = 3D completo, "low" = 3D leggero (dpr basso, niente ombre, modelli -low), "2d" = SVG/CSS. */
export type VisualQuality = "high" | "low" | "2d";

export interface GiramenteWheelProps {
  /** 8 spicchi (manche 5: 4 categorie ripetute due volte) */
  segments: WheelSegment[];
  /** null = ferma (sull'ultimo risultato se restIndex è dato) */
  spin: WheelSpinCommand | null;
  /** spicchio sotto il puntatore quando non gira */
  restIndex?: number | null;
  /** orologio allineato al server (ms epoch) */
  now: () => number;
  quality: VisualQuality;
  /** evidenzia lo spicchio vincente a giro finito */
  highlight?: boolean;
  onSpinEnd?: (spinId: string) => void;
  /** a ogni scatto del puntatore (per il suono); al massimo uno ogni ~45 ms */
  onTick?: () => void;
  /** supporto con la base GIRAMENTE! (default true) */
  showStand?: boolean;
  className?: string;
}

export type CharacterWho = "dontralla" | "zafira";

export type CharacterAction =
  | "idle"
  | "saluto"
  | "presentazione"
  | "indica"
  | "applauso"
  | "risata"
  | "sorpresa"
  | "delusione"
  | "pensiero"
  | "vittoria"
  | "ingresso"
  | "uscita";

export interface GiramenteCharacterProps {
  who: CharacterWho;
  /** il controller mappa l'azione sulle clip disponibili (o su un movimento procedurale dichiarato) */
  action: CharacterAction;
  speaking: boolean;
  /** 0..1 apertura bocca (lip-sync dall'audio); se assente e speaking, bocca simulata */
  mouthRef?: RefObject<number>;
  framing: "full" | "bust";
  quality: VisualQuality;
  onReady?: () => void;
  onFail?: (reason: string) => void;
  className?: string;
  /**
   * Facoltativo (fuori contratto minimo): da che parte dello SCHERMO sta la ruota, per «indica».
   * Predefinito "left".
   */
  pointSide?: "left" | "right";
  /** Facoltativo, solo anteprime: file GLB esplicito (confronto delle varianti A/B della bocca). */
  src?: string;
}

export interface JollyPortalProps {
  /** true = parte l'ingresso; false = Zafira esce, il portale si chiude e poi si smonta (onDone) */
  play: boolean;
  quality: VisualQuality;
  speaking: boolean;
  mouthRef?: React.RefObject<number>;
  /** a uscita finita (dopo play=false) — il chiamante può smontare */
  onDone?: () => void;
  /** Facoltativo: Zafira è entrata ed è ferma davanti al portale (si possono mostrare i vantaggi). */
  onEntered?: () => void;
  className?: string;
  /** Facoltativo, solo anteprime: file GLB esplicito di Zafira. */
  src?: string;
}

export type BoardCell = { kind: "letter"; char: string | null; justRevealed?: boolean } | { kind: "space" } | { kind: "punct"; char: string };

export interface SecretBoardProps {
  category: string;
  rows: BoardCell[][];
  solved?: boolean;
  quality: VisualQuality;
  className?: string;
}
