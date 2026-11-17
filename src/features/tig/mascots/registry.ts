import type { MascotLevel, MascotSlot } from "../arena-contract";

/**
 * TAVOLI IN GUERRA! — REGISTRO DELLE 12 MASCOTTE.
 *
 * Le 12 mascotte sono NUOVE e le fornirà il proprietario più avanti (modelli GLB). Qui NON si inventa niente:
 * nome, sesso, carattere e voce restano `null` finché non arrivano i dati veri. Fino ad allora ogni slot mostra un
 * SEGNAPOSTO dichiaratamente provvisorio (totem olografico con il numero dello slot e «MASCOTTE IN ARRIVO»).
 *
 * Come importare una mascotte vera: `docs/tavoli-in-guerra/3D.md` (sezione «Importare una mascotte»).
 * In breve: ottimizzare il GLB in `public/models/tig/mascotte/`, riempire lo slot (models, scale, yOffset, clips),
 * mettere `placeholder: false`. Livelli 2 e 3: GLB propri (facoltativi) oppure gli effetti generici del codice.
 */

/** Clip del GLB da usare per ogni azione (nome della clip nel file). Le azioni senza clip restano procedurali. */
export type MascotClipMap = Partial<Record<"idle" | "cheer" | "sad" | "attack" | "hit" | "evolve" | "win", string>>;

export interface MascotSlotInfo {
  slot: MascotSlot;
  /** nome della mascotte: null finché il proprietario non lo decide */
  name: string | null;
  /** sesso: null finché non è definito (serve alle voci) */
  sex: "m" | "f" | "n" | null;
  /** GLB per livello di evoluzione (URL in /public). Se manca il livello si usa il più vicino sotto + effetti. */
  models: Partial<Record<MascotLevel, string>>;
  /** fattore di scala del modello (1 = altezza normalizzata della mascotte sul tavolo) */
  scale: number;
  /** correzione verticale in metri (piedi sul piano del tavolo) */
  yOffset: number;
  /** variabile d'ambiente della voce ElevenLabs (mai il valore nel client): null finché non c'è */
  voiceEnv: string | null;
  /** clip del GLB per azione (facoltativo) */
  clips: MascotClipMap;
  /** true = nessun modello vero ancora: si mostra il segnaposto provvisorio */
  placeholder: boolean;
}

/** Numero di slot (mascotte) del gioco. */
export const MASCOT_SLOT_COUNT = 12;

function emptySlot(slot: MascotSlot): MascotSlotInfo {
  return { slot, name: null, sex: null, models: {}, scale: 1, yOffset: 0, voiceEnv: null, clips: {}, placeholder: true };
}

/**
 * I 12 slot. Per importare una mascotte si sostituisce SOLO la sua riga, ad esempio:
 *   3: { ...emptySlot(3), name: "…", sex: "f", models: { 1: "/models/tig/mascotte/m03.glb" }, scale: 1, yOffset: 0,
 *        voiceEnv: "ELEVENLABS_VOICE_TIG_M03", clips: { idle: "Idle", cheer: "Cheer" }, placeholder: false },
 */
export const MASCOTS: Readonly<Record<number, MascotSlotInfo>> = {
  1: emptySlot(1),
  2: emptySlot(2),
  3: emptySlot(3),
  4: emptySlot(4),
  5: emptySlot(5),
  6: emptySlot(6),
  7: emptySlot(7),
  8: emptySlot(8),
  9: emptySlot(9),
  10: emptySlot(10),
  11: emptySlot(11),
  12: emptySlot(12),
};

/** Informazioni dello slot (null se lo slot è nullo o fuori 1..12). */
export function mascotInfo(slot: MascotSlot | null | undefined): MascotSlotInfo | null {
  if (slot === null || slot === undefined || !Number.isInteger(slot)) return null;
  return MASCOTS[slot] ?? null;
}

/** Nome da mostrare: il nome vero se c'è, altrimenti «Mascotte N» (mai un nome inventato). */
export function mascotLabel(slot: MascotSlot | null | undefined): string {
  const info = mascotInfo(slot);
  if (!info) return "Mascotte";
  return info.name ?? `Mascotte ${info.slot}`;
}

/**
 * GLB da caricare per un livello: quello del livello se c'è, altrimenti il più vicino SOTTO (il livello in più lo
 * fanno gli effetti generici); null = nessun modello (segnaposto).
 */
export function mascotModelUrl(slot: MascotSlot | null | undefined, level: MascotLevel): string | null {
  if (previewModel && slot) return previewModel;
  const info = mascotInfo(slot);
  if (!info || info.placeholder) return null;
  for (let l = level; l >= 1; l--) {
    const url = info.models[l as MascotLevel];
    if (url) return url;
  }
  return null;
}

/**
 * SOLO ANTEPRIMA (`/preview/tig/arena?glb=/models/…glb`): usa un GLB qualsiasi al posto dei segnaposto per provare il
 * percorso delle mascotte vere (caricamento, altezza, azioni procedurali, effetti dei livelli). Mai nel gioco.
 */
let previewModel: string | null = null;
export function setPreviewMascotModel(url: string | null) {
  previewModel = url && /^\/models\/[\w/-]+\.glb$/.test(url) ? url : null;
}

/** Il GLB del livello ha già il suo aspetto evoluto (non servono gli effetti di quel livello sopra il modello). */
export function mascotHasLevelModel(slot: MascotSlot | null | undefined, level: MascotLevel): boolean {
  const info = mascotInfo(slot);
  return !!info && !info.placeholder && !!info.models[level];
}

/** Tutti gli slot in ordine (anteprime, voto della mascotte). */
export function listMascots(): MascotSlotInfo[] {
  return Array.from({ length: MASCOT_SLOT_COUNT }, (_, i) => MASCOTS[i + 1]);
}
