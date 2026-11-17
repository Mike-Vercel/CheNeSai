/**
 * TAVOLI IN GUERRA! — livello 3D (contratto: `src/features/tig/arena-contract.ts`).
 *
 *  - `TigArena`: l'arena (TV, sotto l'HUD di telefono/PC, menu). 3D caricato a richiesta, 2D SVG/CSS di riserva.
 *  - `TigMascot`: una mascotte (scheda squadra, voto, premiazione).
 *  - `detectVisualQuality`: "high" | "low" | "2d" per il dispositivo (?q= per forzare).
 * Anteprima: `/preview/tig/arena`. Documentazione: `docs/tavoli-in-guerra/3D.md`.
 * Nessun import di three.js da qui: i moduli 3D si scaricano solo quando servono.
 */
import type { TigVisuals } from "../arena-contract";
import { TigArena } from "./TigArena";
import { TigMascot } from "./TigMascot";
import { detectVisualQuality } from "./quality";

export { TigArena, TigMascot, detectVisualQuality };
export { prefersReducedMotion, loadQualityPref, saveQualityPref, type QualityPref } from "./quality";
export { preloadTigArena } from "./preload";
export { HOST_MODELS, HOST_IDS, hostModelUrl, hostModelFiles, type HostModel } from "./characters/host-models";
export { podLayout, podSpacing, podScale, uDepth, columnHeight, scoreScale, hostMarks, type ArenaLayout, type PodPlacement } from "./arena/layout";
export { normalizeSafeArea, type FrameWindow } from "./arena/camera-math";
export { directArena, mascotActionFor, awardsRevealed, awardsRevealAt, type ArenaDirection, type Mood, type ShotKind } from "./arena/director";
export { MASCOTS, MASCOT_SLOT_COUNT, mascotInfo, mascotLabel, mascotModelUrl, listMascots, type MascotSlotInfo } from "../mascots/registry";
export { TIG as TIG_PALETTE, TIG_FONT_VAR } from "./palette";

/** Verifica a compile-time che le esportazioni rispettino il contratto `TigVisuals`. */
const _contract: TigVisuals = { TigArena, TigMascot, detectVisualQuality };
void _contract;
