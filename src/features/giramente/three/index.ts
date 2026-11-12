/**
 * GIRAMENTE! — livello visivo (ruota 3D/2D, DonTrallà e Zafira, portale della Jolly, Tabellone Segreto).
 * Contratto usato dalla logica di gioco: tipi, costanti e funzioni pure si importano anche dal server;
 * i componenti 3D sono caricati a richiesta (lazy.tsx). Anteprima: /preview/giramente.
 */
export type {
  WheelKind,
  WheelSegment,
  WheelSpinCommand,
  VisualQuality,
  GiramenteWheelProps,
  CharacterWho,
  CharacterAction,
  GiramenteCharacterProps,
  JollyPortalProps,
  BoardCell,
  SecretBoardProps,
} from "./types";
export { WHEEL_SEGMENTS_STANDARD, WHEEL_SEGMENTS_FINALE, WHEEL_KIND_LABEL, GIRAMENTE_PALETTE, SEGMENT_COLORS } from "./segments";
export { GiramenteWheel, GiramenteCharacter, JollyPortal } from "./lazy";
export { default as SecretBoard } from "./SecretBoard";
export { detectVisualQuality, prefersReducedMotion } from "./quality";
export { planSpin, spinAngleAt, segmentAtAngle, restAngle, spinDone } from "./wheel-math";
export { layoutBoard, maskPhrase, letterBase } from "./board-layout";
export { createAnalyserMouth, levelToMouth } from "./mouth";
export { MOUTH_VARIANT, CHARACTER_INFO, ACTION_PLAN } from "./characters";
