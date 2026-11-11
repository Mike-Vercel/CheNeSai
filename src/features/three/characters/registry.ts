"use client";

import { lazy, type ComponentType } from "react";
import type { Presenter } from "@/lib/game-engine/types";
import type { CharacterModelProps } from "./types";

/** Modelli 3D procedurali caricati su richiesta (chunk separati). */
export const CHARACTER_MODELS_PROCEDURAL: Record<Presenter, ComponentType<CharacterModelProps>> = {
  professore: lazy(() => import("./professore/ProfessoreModel").then((m) => ({ default: m.ProfessoreModel }))),
  regina: lazy(() => import("./regina/ReginaModel").then((m) => ({ default: m.ReginaModel }))),
  palmino: lazy(() => import("./palmino/PalminoModel").then((m) => ({ default: m.PalminoModel }))),
};

/**
 * Modelli usati da intro e schermate TV: i GLB riggati (public/models/*.glb) quando sono attivi,
 * con il procedurale come riserva se il file non si carica (vedi host-auto.tsx e glb-host.tsx).
 */
export const CHARACTER_MODELS: Record<Presenter, ComponentType<CharacterModelProps>> = {
  professore: lazy(() => import("./host-auto").then((m) => ({ default: m.ProfessoreAuto }))),
  regina: lazy(() => import("./host-auto").then((m) => ({ default: m.ReginaAuto }))),
  palmino: lazy(() => import("./host-auto").then((m) => ({ default: m.PalminoAuto }))),
};

/**
 * Altezza visibile dei modelli (metri, dall'origine alla sommità). Valori
 * dichiarati dai moduli (PROFESSORE_HEIGHT, REGINA_HEIGHT, PALMINO_HEIGHT),
 * ripetuti qui per non caricare i modelli solo per leggerli.
 */
export const CHARACTER_HEIGHTS: Record<Presenter, number> = {
  professore: 1.8,
  regina: 1.85,
  palmino: 1.6,
};
