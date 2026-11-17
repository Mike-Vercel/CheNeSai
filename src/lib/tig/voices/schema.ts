/**
 * TAVOLI IN GUERRA! — FORMATO DEL CATALOGO VOCALE.
 *
 * Fonte: un file JSON per personaggio in `content/tig/voci/<characterId>.json` (forma `VoiceFile`).
 * Da qui uno script genera `TAVOLI_IN_GUERRA_FRASI_COMPLETE.txt` (consultabile senza software) e
 * `TAVOLI_IN_GUERRA_PERSONAGGI.md`; il gioco legge lo stesso JSON (scelta casuale per categoria, niente
 * ripetizioni ravvicinate, variabili sostituite, sottotitoli, fallback se manca l'audio registrato).
 *
 * Regola di sicurezza: la voce NON pronuncia mai i nomi scritti dagli utenti. Per riferirsi a una squadra si
 * usano solo `{TAVOLO_A}`/`{TAVOLO_B}` (es. «il tavolo 3») e `{MASCOTTE_A}`/`{MASCOTTE_B}` (nome curato della mascotte).
 */

export type Sex = "MASCHIO" | "FEMMINA" | "DA CONFERMARE";

/** Le 40 situazioni richieste (codice stabile → descrizione). */
export const VOICE_CATEGORIES = {
  APERTURA: "Apertura della serata",
  BENVENUTO_SQUADRE: "Benvenuto delle squadre",
  MASCOTTE_PRESENTAZIONE: "Presentazione delle mascotte",
  INIZIO_MANCHE: "Inizio delle manche",
  MINIGIOCO_PRESENTAZIONE: "Presentazione dei minigiochi",
  REGOLE: "Spiegazione delle regole",
  COUNTDOWN: "Countdown",
  ULTIMI_SECONDI: "Ultimi secondi",
  RISPOSTA_CORRETTA: "Risposta corretta",
  RISPOSTA_SBAGLIATA: "Risposta sbagliata",
  TEMPO_SCADUTO: "Scadenza del tempo",
  IN_VANTAGGIO: "Squadra in vantaggio",
  ULTIMA_IN_CLASSIFICA: "Squadra ultima in classifica",
  GRANDE_RECUPERO: "Grande recupero",
  SORPASSO: "Sorpasso",
  DUELLO: "Duello",
  SABOTAGGIO: "Sabotaggio",
  FURTO_PUNTI: "Furto di punti",
  ALLEANZA: "Alleanza",
  TRADIMENTO: "Tradimento",
  BLUFF_RIUSCITO: "Bluff riuscito",
  BLUFF_SCOPERTO: "Bluff scoperto",
  BOTTONE_CAOS: "Attivazione del Bottone del Caos",
  EVOLUZIONE_LIV2: "Evoluzione della mascotte al livello 2",
  EVOLUZIONE_LIV3: "Evoluzione della mascotte al livello 3",
  SUSPENSE: "Momenti di suspense",
  BATTUTA_SQUADRE: "Battute contro le squadre",
  PROVOCAZIONE: "Provocazioni ironiche",
  REAZIONE_SORPRESA: "Reazioni a risultati sorprendenti",
  PAUSA: "Pausa",
  RIENTRO_PAUSA: "Rientro dalla pausa",
  ULTIMA_MANCHE: "Ultima manche",
  PUNTATA_RISCHIOSA: "Puntata rischiosa",
  FINALE: "Finale",
  PREMIAZIONE: "Premiazione",
  VITTORIA: "Vittoria",
  SCONFITTA: "Sconfitta",
  PAREGGIO: "Pareggio",
  SALUTO_FINALE: "Saluto finale",
  ATMOSFERA: "Frasi casuali per mantenere viva l'atmosfera",
} as const;
export type VoiceCategory = keyof typeof VOICE_CATEGORIES;

/** Variabili ammesse nel testo (tra graffe). Nessun nome scritto dagli utenti. */
export const VOICE_VARS = ["TAVOLO_A", "TAVOLO_B", "MASCOTTE_A", "MASCOTTE_B", "PUNTI", "MANCHE", "MINIGIOCO", "SECONDI", "POSIZIONE"] as const;
export type VoiceVar = (typeof VOICE_VARS)[number];

export interface VoiceCharacter {
  /** slug stabile, es. "don-patrizio" */
  id: string;
  /** nome ESATTO del personaggio */
  name: string;
  sex: Sex;
  /** tipologia della voce, es. "MASCHILE, PROFONDA, TEATRALE, IRONICA" */
  voice: string;
  personality: string;
  role: string;
  /** "presentatore" = ≥120 frasi; "ospite" = ≥60; "mascotte" = ≥100 (solo quando definita) */
  tier: "presentatore" | "ospite" | "mascotte";
  /** modello 3D nel progetto (file in REFERENCE o in public), oppure null */
  model: string | null;
  /** campi ancora da confermare col proprietario (es. ["personalità", "corrispondenza col modello"]) */
  toConfirm: string[];
}

export interface VoiceLine {
  /** ID univoco, es. "DP_INTRO_001" (prefisso del personaggio + categoria breve + progressivo) */
  id: string;
  scene: VoiceCategory;
  /** tono emotivo, es. "ENERGICO", "PROVOCATORIO" */
  tone: string;
  /** durata indicativa, es. "5-7 SECONDI" */
  duration: string;
  /** testo completo da pronunciare (italiano, senza audio tag) */
  text: string;
  /** variabili usate nel testo */
  vars: VoiceVar[];
}

export interface VoiceFile {
  character: VoiceCharacter;
  lines: VoiceLine[];
}
