import type React from "react";

/**
 * CONTRATTO dei componenti visivi di GIRAMENTE! (ruota, personaggi, portale della Jolly, tabellone).
 * Oggi: versioni 2D in questa cartella. All'unione con il ramo della grafica 3D, `visuals.tsx`
 * esporterà gli stessi nomi con le stesse props da `./three`: il resto del gioco non cambia.
 */
export type WheelKind = "intruso" | "sequenza" | "indizi" | "prospettiva" | "mistero" | "jolly" | "bonus" | "colpo";

export interface WheelSegment {
  id: string;
  kind: WheelKind;
  label: string;
  color: string;
  textColor?: string;
}

/** Deciso dal SERVER: la ruota si ferma su `targetIndex` all'istante startedAt + durationMs (ora del server). */
export interface WheelSpinCommand {
  spinId: string;
  targetIndex: number;
  startedAt: number;
  durationMs: number;
}

export type VisualQuality = "high" | "low" | "2d";

export interface GiramenteWheelProps {
  segments: WheelSegment[];
  spin: WheelSpinCommand | null;
  restIndex?: number | null;
  /** ora del server (ms) */
  now: () => number;
  quality: VisualQuality;
  highlight?: boolean;
  onSpinEnd?: (spinId: string) => void;
  onTick?: () => void;
  showStand?: boolean;
  className?: string;
}

export type CharacterWho = "dontralla" | "zafira";
export type CharacterAction = "idle" | "saluto" | "presentazione" | "indica" | "applauso" | "risata" | "sorpresa" | "delusione" | "pensiero" | "vittoria" | "ingresso" | "uscita";

export interface GiramenteCharacterProps {
  who: CharacterWho;
  action: CharacterAction;
  speaking: boolean;
  /** apertura della bocca 0–1 (dall'analizzatore della voce) */
  mouthRef?: React.RefObject<number>;
  framing: "full" | "bust";
  quality: VisualQuality;
  onReady?: () => void;
  onFail?: (reason: string) => void;
  className?: string;
}

export interface JollyPortalProps {
  play: boolean;
  quality: VisualQuality;
  speaking: boolean;
  mouthRef?: React.RefObject<number>;
  onDone?: () => void;
  className?: string;
}

export type BoardCell = { kind: "letter"; char: string | null; justRevealed?: boolean } | { kind: "space" } | { kind: "punct"; char: string };

export interface SecretBoardProps {
  category: string;
  rows: BoardCell[][];
  solved?: boolean;
  quality: VisualQuality;
  className?: string;
}
