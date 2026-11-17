import type { HostId, VisualQuality } from "../../arena-contract";
import { CHARACTER_FILES, MOUTH_VARIANT } from "@/features/giramente/three/characters";
import { investigatoreUrl } from "@/features/three/characters/investigatore";

/**
 * PERSONAGGI ESISTENTI nell'arena di TAVOLI IN GUERRA! — `HostId` → modello GLB. Nessun file duplicato:
 *  - professore, regina, palmino, investigatore: i GLB del sito in `public/models/` (stesse varianti scelte altrove);
 *  - don-patrizio, zafira: i GLB di GIRAMENTE! (`public/models/giramente/`, variante della bocca di GIRAMENTE!);
 *  - nek, ciccio, franca, piroletto, minu, chicca, bumbaru (+ Bumbarino), mordicchio, mammusss, rumpo: ottimizzati da
 *    `REFERENCE/MODELLI-3D/*_PARLANTE.glb` in `public/models/tig/` (vedi docs/tavoli-in-guerra/3D.md).
 * Tutti: rig Mixamo, clip Idle_3, Walking, Running, Talk_Passionately, Talk_with_Hands_Open; morph jawOpen, mouthO,
 * mouthE, blink, browsUp (Mammusss anche snakeOpen). La variante "-low" (texture più piccole) si usa in qualità low.
 */

export interface HostModel {
  /** nome da mostrare (anteprime, ritratto 2D) */
  name: string;
  /** ruolo nello show (dal PDF; le corrispondenze segnate restano da confermare) */
  role: string;
  /** file in qualità alta (la -low si ricava) */
  url: string;
  /** statura in scena (m): il modello viene portato a questa altezza, piedi sul palco */
  height: number;
  /** correzione orizzontale del modello nelle sue unità (Mordicchio è spostato di ~12 cm) */
  offsetX: number;
  /** chiusura massima delle palpebre */
  blinkMax: number;
  /** sopracciglia ferme (Franca: sono dietro la montatura degli occhiali) */
  noBrows?: boolean;
  /** seconda bocca (Mammusss: il serpente-proboscide, morph snakeOpen) */
  snake?: boolean;
  /** passeggero nella pancia (Bumbaru porta Bumbarino agganciato all'osso Spine2) */
  passenger?: "bumbarino";
  idleRate: number;
  talkRate: number;
  /** colore del ritratto 2D */
  tint: string;
}

const tig = (id: string) => `/models/tig/${id}.glb`;

export const HOST_MODELS: Record<HostId, HostModel> = {
  professore: { name: "Il Professore", role: "Professor Smoke (da confermare): apre e lancia le prove lampo", url: "/models/professore.glb", height: 1.8, offsetX: 0, blinkMax: 1, idleRate: 1, talkRate: 1, tint: "#f0b54a" },
  regina: { name: "La Regina", role: "voce di raccordo, commenti sui cambi di posizione", url: "/models/regina.glb", height: 1.76, offsetX: 0, blinkMax: 0.8, idleRate: 1, talkRate: 1, tint: "#ff5fa2" },
  palmino: { name: "Palmino", role: "ospite", url: "/models/palmino.glb", height: 1.62, offsetX: 0, blinkMax: 1, idleRate: 1.15, talkRate: 1.25, tint: "#6bd36b" },
  investigatore: { name: "L'Investigatore", role: "Victor (da confermare): deduzioni e «Il grande inganno»", url: investigatoreUrl(), height: 1.82, offsetX: 0, blinkMax: 1, idleRate: 1, talkRate: 1, tint: "#c9a45a" },
  "don-patrizio": { name: "Don Patrizio", role: "guida la finale e la rivelazione della classifica", url: CHARACTER_FILES.dontralla[MOUTH_VARIANT.dontralla], height: 1.8, offsetX: 0, blinkMax: 1, idleRate: 1, talkRate: 1, tint: "#d94a3a" },
  zafira: { name: "Zafira", role: "annuncia bonus, rischi e occasioni speciali", url: CHARACTER_FILES.zafira[MOUTH_VARIANT.zafira], height: 1.74, offsetX: 0, blinkMax: 0.95, idleRate: 1.05, talkRate: 1.08, tint: "#3fd17a" },
  nek: { name: "Nek", role: "ospite", url: tig("nek"), height: 1.82, offsetX: 0, blinkMax: 1, idleRate: 1, talkRate: 1, tint: "#f2c230" },
  ciccio: { name: "Ciccio", role: "ospite", url: tig("ciccio"), height: 1.5, offsetX: 0, blinkMax: 1, idleRate: 1.05, talkRate: 1.1, tint: "#e2453a" },
  franca: { name: "Franca", role: "ospite", url: tig("franca"), height: 1.58, offsetX: 0, blinkMax: 1, noBrows: true, idleRate: 1, talkRate: 1.05, tint: "#8f5bd8" },
  piroletto: { name: "Piroletto", role: "ospite", url: tig("piroletto"), height: 1.9, offsetX: 0, blinkMax: 1, idleRate: 1, talkRate: 1.05, tint: "#ff4fb8" },
  minu: { name: "Minù", role: "ospite", url: tig("minu"), height: 1.8, offsetX: 0, blinkMax: 1, idleRate: 1, talkRate: 1, tint: "#d63131" },
  chicca: { name: "Chicca", role: "ospite", url: tig("chicca"), height: 1.55, offsetX: 0, blinkMax: 1, idleRate: 1, talkRate: 1.05, tint: "#d65bd2" },
  bumbaru: { name: "Bumbaru (con Bumbarino)", role: "ospite", url: tig("bumbaru"), height: 1.75, offsetX: 0, blinkMax: 1, passenger: "bumbarino", idleRate: 1, talkRate: 1, tint: "#f08a2c" },
  mordicchio: { name: "Mordicchio", role: "ospite", url: tig("mordicchio"), height: 1.5, offsetX: 0.12, blinkMax: 1, idleRate: 1.05, talkRate: 1.1, tint: "#d9673a" },
  mammusss: { name: "Mammusss", role: "ospite (due bocche: mammut e serpente)", url: tig("mammusss"), height: 1.9, offsetX: 0, blinkMax: 1, snake: true, idleRate: 0.95, talkRate: 1, tint: "#c23a4a" },
  rumpo: { name: "Rumpo", role: "ospite", url: tig("rumpo"), height: 1.7, offsetX: 0, blinkMax: 1, idleRate: 1, talkRate: 1, tint: "#ff7a2a" },
};

export const HOST_IDS = Object.keys(HOST_MODELS) as HostId[];

/** Bumbarino (passeggero nella pancia di Bumbaru): file e posto a sedere (da REFERENCE/MODELLI-3D/bumbaru.js). */
export const BUMBARINO = {
  url: tig("bumbarino"),
  /** metri, nelle unità di Bumbaru alto 1,7 m */
  seat: { centerX: 0, centerY: 0.61, frontZ: 0.36, bodyWidth: 0.56, clipY: 0.36 },
  /** corpo tondo di Bumbarino misurato sul suo file (sue unità) */
  body: { centerY: 0.78, halfWidth: 0.48, front: 0.45 },
} as const;

/** URL del file per la qualità ("-low" in low; il 2D non carica modelli). */
export function hostModelUrl(who: HostId, quality: VisualQuality): string {
  const base = HOST_MODELS[who].url;
  return quality === "high" ? base : base.replace(/\.glb$/, "-low.glb");
}

export function bumbarinoUrl(quality: VisualQuality): string {
  return quality === "high" ? BUMBARINO.url : BUMBARINO.url.replace(/\.glb$/, "-low.glb");
}

/** File da scaricare per un presentatore (Bumbaru porta anche Bumbarino). */
export function hostModelFiles(who: HostId, quality: VisualQuality): string[] {
  const out = [hostModelUrl(who, quality)];
  if (HOST_MODELS[who].passenger === "bumbarino") out.push(bumbarinoUrl(quality));
  return out;
}
