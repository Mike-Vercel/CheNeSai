import type { CharacterAction, CharacterWho, VisualQuality } from "./types";

/**
 * I personaggi 3D di GIRAMENTE!: DonTrallà (presentatore, file RAPPRESENTANTE*.glb) e Zafira (la Jolly,
 * file JOLLY*.glb). Stesso rig Mixamo dei personaggi di CHE NE SAI?! e PSYCO (scheletro "SmartRigArmature",
 * 66 ossa mixamorig:*), clip Idle_3, Talk_Passionately, Talk_with_Hands_Open, Walking, Running.
 *
 * BOCCA — due varianti per personaggio, da scegliere (UNICO PUNTO: BOCCA_DEFAULT qui sotto, oppure senza
 * toccare il codice NEXT_PUBLIC_QZ_BOCCA_DONTRALLA / NEXT_PUBLIC_QZ_BOCCA_ZAFIRA = a | b, serve una nuova build):
 *  - "a" = il file _PARLANTE dell'utente (bocca preparata da lui in Blender);
 *  - "b" = il file senza bocca + la nostra bocca (src/features/three/tools/blender_add_mouth.py con
 *          mouth_dontralla.json / mouth_zafira.json), come Palmino, la Regina e l'Investigatore B.
 * Confronto: /preview/giramente (sezione Personaggi, "A | B").
 */
export type MouthVariant = "a" | "b";

const BOCCA_DEFAULT: Record<CharacterWho, MouthVariant> = { dontralla: "a", zafira: "a" };

function envVariant(v: string | undefined, fallback: MouthVariant): MouthVariant {
  return v === "a" || v === "b" ? v : fallback;
}

/** Variante attiva (letta in chiaro: Next sostituisce le NEXT_PUBLIC_* in build). */
export const MOUTH_VARIANT: Record<CharacterWho, MouthVariant> = {
  dontralla: envVariant(process.env.NEXT_PUBLIC_QZ_BOCCA_DONTRALLA, BOCCA_DEFAULT.dontralla),
  zafira: envVariant(process.env.NEXT_PUBLIC_QZ_BOCCA_ZAFIRA, BOCCA_DEFAULT.zafira),
};

export const CHARACTER_FILES: Record<CharacterWho, Record<MouthVariant, string>> = {
  dontralla: { a: "/models/giramente/dontralla.glb", b: "/models/giramente/dontralla-b.glb" },
  zafira: { a: "/models/giramente/zafira.glb", b: "/models/giramente/zafira-b.glb" },
};

export const CHARACTER_INFO: Record<CharacterWho, { name: string; role: string; blinkMax: number; talkRate: number; idleRate: number }> = {
  dontralla: { name: "DonTrallà", role: "il presentatore", blinkMax: 1, talkRate: 1, idleRate: 1 },
  zafira: { name: "Zafira", role: "la Jolly", blinkMax: 0.95, talkRate: 1.08, idleRate: 1.05 },
};

/** File del personaggio per la qualità (le "-low" hanno texture a 1024 e normal map a 512). */
export function characterUrl(who: CharacterWho, quality: VisualQuality, variant: MouthVariant = MOUTH_VARIANT[who], src?: string): string {
  const base = src ?? CHARACTER_FILES[who][variant];
  return quality === "high" ? base : base.replace(/\.glb$/, "-low.glb");
}

/**
 * Come ogni azione viene resa: clip VERE del file oppure movimento PROCEDURALE (rotazioni additive sulle ossa,
 * sopra la clip di riposo o di parlata). Documentato anche in docs/giramente/PERSONAGGI.md.
 */
export const ACTION_PLAN: Record<CharacterAction, { base: "Idle_3" | "Talk_with_Hands_Open" | "Walking"; procedural: string | null }> = {
  idle: { base: "Idle_3", procedural: null },
  saluto: { base: "Idle_3", procedural: "saluto con la mano destra (braccio alzato, avambraccio che oscilla)" },
  presentazione: { base: "Talk_with_Hands_Open", procedural: null },
  indica: { base: "Idle_3", procedural: "braccio teso verso la ruota, busto e testa girati" },
  applauso: { base: "Idle_3", procedural: "braccia avanti, mani che battono (3 Hz) con un piccolo rimbalzo" },
  risata: { base: "Idle_3", procedural: "testa indietro, spalle che sussultano, mani sulla pancia, bocca a scatti" },
  sorpresa: { base: "Idle_3", procedural: "busto all'indietro, braccia aperte, sopracciglia su e bocca aperta" },
  delusione: { base: "Idle_3", procedural: "spalle e testa giù, piccolo «no» con la testa" },
  pensiero: { base: "Idle_3", procedural: "mano al mento, testa inclinata, altra mano sulla pancia" },
  vittoria: { base: "Idle_3", procedural: "braccia in alto che pompano, piccolo saltello" },
  ingresso: { base: "Walking", procedural: "spostamento della radice: entra camminando di lato e si gira verso il pubblico" },
  uscita: { base: "Walking", procedural: "spostamento della radice: si gira ed esce camminando di lato" },
};
