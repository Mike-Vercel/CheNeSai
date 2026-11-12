/**
 * PSYCO – indizi dell'Investigatore («CHIAMA L'INVESTIGATORE»). Logica pura, usata SOLO dal server
 * (l'indizio scelto va allo PSYCO dalla sua vista privata, mai nello stato pubblico). Testata in
 * tests/unit/psyco.test.ts.
 *
 * Ogni chiamata dà un indizio PIÙ CHIARO del precedente (livello 1 → 3), mai la regola esplicita:
 *  - regole dell'archivio: i 3 indizi scritti a mano per la regola (psyco_rules.hint_1/2/3);
 *  - regole libere: alla chiamata 1 l'indizio scritto dal gruppo (se c'è), altrimenti gli indizi
 *    generici della categoria scelta nella proposta, in ultima istanza quelli di «Altro».
 */
import type { RuleCategory } from "./types";

export const HINT_LEVELS = 3;

/** Indizi generici graduati per categoria (scritti a mano, tono noir). */
export const CATEGORY_HINTS: Record<RuleCategory, [string, string, string]> = {
  parole: [
    "Ascolta le parole, una per una. Ce n'è qualcuna che torna troppo spesso… o che manca del tutto.",
    "Non è il significato. È la scelta delle parole: alcune sono obbligatorie, altre vietate.",
    "Ripeti a mente le ultime risposte. C'è una parola, o un tipo di parola, che fa da filo conduttore.",
  ],
  lettere: [
    "Non ascoltare il senso delle risposte. Ascolta i suoni.",
    "Fai attenzione alle lettere: come cominciano le parole, come finiscono.",
    "Prendi la prima e l'ultima lettera di ogni risposta e mettile in fila. Lo schema è lì.",
  ],
  gesti: [
    "Smetti di ascoltare. Guarda. Il corpo dice quello che le parole nascondono.",
    "C'è un gesto, una posizione, un movimento che si ripete: prima, durante o dopo la risposta.",
    "Mani, testa, occhi, postura: tienili d'occhio mentre rispondono. Uno di questi fa sempre la stessa cosa.",
  ],
  persone: [
    "Chi risponde è davvero chi dice di essere?",
    "Le risposte non appartengono a chi le dice. Qualcuno recita una parte, o parla al posto di un altro.",
    "Guarda le persone intorno a chi risponde: chi parla, per conto di chi, e nei panni di chi.",
  ],
  verita: [
    "Tu li conosci. Le risposte somigliano davvero a loro?",
    "Qualcuno mente. Forse non sempre. Ma le bugie hanno una logica.",
    "Fai domande di cui conosci già la risposta. Poi cerca che cosa decide quando dicono il falso.",
  ],
  numeri: [
    "Prendi carta e penna, almeno nella testa. Qui c'è qualcosa da contare.",
    "Conta: le parole, le risposte, le persone, le volte. Un numero tiene in piedi tutto.",
    "Conta le parole di ogni risposta e mettile accanto a quelle delle tue domande. I numeri non mentono.",
  ],
  altro: [
    "Non fermarti alle parole. Guarda tutto: il tono, i gesti, l'ordine in cui parlano.",
    "Fai la stessa domanda a persone diverse. Quello che non cambia è la regola.",
    "Fai una domanda facilissima e osserva tutto: prima, durante e dopo la risposta. Lì c'è lo schema.",
  ],
};

export type HintSource = "rule" | "custom" | "category" | "generic";

export interface HintInput {
  /** 1…3 (numero della chiamata nella manche) */
  level: number;
  /** regola dell'archivio: i suoi tre indizi (null se l'admin non li ha scritti) */
  ruleHints?: (string | null | undefined)[] | null;
  /** regola libera: indizio scritto dal gruppo nella proposta vincente */
  customHint?: string | null;
  /** regola libera: categoria scelta nella proposta vincente */
  category?: RuleCategory | null;
}

/** Indizio per la chiamata `level`: sempre un testo (mai vuoto), con la sua origine. */
export function pickHint(i: HintInput): { text: string; source: HintSource; level: number } {
  const level = Math.min(HINT_LEVELS, Math.max(1, Math.floor(i.level)));
  const own = i.ruleHints?.[level - 1]?.trim();
  if (own) return { text: own, source: "rule", level };
  if (level === 1 && i.customHint?.trim()) return { text: i.customHint.trim(), source: "custom", level };
  if (i.category && i.category !== "altro") return { text: CATEGORY_HINTS[i.category][level - 1], source: "category", level };
  return { text: CATEGORY_HINTS.altro[level - 1], source: i.category === "altro" ? "category" : "generic", level };
}
