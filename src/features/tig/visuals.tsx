/**
 * TAVOLI IN GUERRA! — punto d'ingresso della scena («arena») e della mascotte per le pagine del gioco.
 * Implementazione vera in `./three` (3D caricato a richiesta, con riserva 2D SVG/CSS integrata),
 * con le props del contratto `./arena-contract`.
 */
export * from "./three";
export type { ArenaProps, MascotProps, VisualQuality } from "./arena-contract";
