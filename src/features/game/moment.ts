import type { PublicState } from "@/lib/game-engine/types";
import { rotatingPick, seededPick, type Rotation } from "./lines";

/**
 * Il "momento" della domanda corrente: è l'ultima del round? L'ultima della serata?
 * Funzioni PURE condivise da TV (copione, schermate) e server (regista, pre-riscaldamento):
 * stesso stato → stessa scelta delle battute, quindi stessa cache delle voci.
 *
 * Regola dello spettacolo: sull'ultima domanda (del round o della serata) nessuno dice
 * "la prossima domanda…"; sull'ultima della serata nessuno dice che il gioco continua
 * ("prossimo round", "c'è ancora tempo", "vi rifarete"…).
 */
export interface MomentContext {
  /** ultima domanda del round corrente */
  lastOfRound: boolean;
  /** ultima domanda della serata (ultima del round e nessun round dopo) */
  lastOfGame: boolean;
}

export const NO_MOMENT: MomentContext = { lastOfRound: false, lastOfGame: false };

/** Momento dalla domanda e dal round dello stato pubblico. */
export function questionMoment(s: Pick<PublicState, "question" | "round">): MomentContext {
  const q = s.question;
  if (!q || q.totalInRound <= 0) return NO_MOMENT;
  const lastOfRound = q.positionInRound >= q.totalInRound;
  const lastOfGame = lastOfRound && !!s.round && s.round.index >= s.round.total;
  return { lastOfRound, lastOfGame };
}

/**
 * Battute che parlano di una domanda successiva ("la prossima la scelgo più cattiva",
 * "alla prossima interrogo", "il prossimo quesito deciderà", "alziamo il livello"…).
 * "La prossima volta/serata/sfida" non conta (è un saluto, non una domanda).
 */
const NEXT_QUESTION = /\bprossim[ao]\b(?!\s+(?:volta|serata|sfida|settimana|round|manche|partita))|\bsuccessiv[ao]\b|\balziamo il livello\b/i;

/** Battute che danno per scontato che la partita continui (vietate sull'ultima domanda della serata). */
const GAME_GOES_ON =
  /\bprossim[ao]\s+(?:round|manche|partita)\b|\bancora tempo\b|\bserata è lunga\b|\bsi rifar[àa]|\bvi rifarete\b|\bripart(?:i|ite|e)\b|\bsi può solo salire\b|\bnon ha ancora detto l'ultima parola\b|\bpuò ancora cambiare\b|\bfino al prossimo\b|\bnon è finita\b/i;

export function mentionsNextQuestion(text: string): boolean {
  return NEXT_QUESTION.test(text);
}

export function assumesGameGoesOn(text: string): boolean {
  return GAME_GOES_ON.test(text);
}

/** La battuta si può dire in questo momento? */
export function lineFitsMoment(text: string, m: MomentContext): boolean {
  if ((m.lastOfRound || m.lastOfGame) && mentionsNextQuestion(text)) return false;
  if (m.lastOfGame && assumesGameGoesOn(text)) return false;
  return true;
}

/**
 * Scelta deterministica fra le battute adatte al momento. Se nessuna va bene si usa `fallback`
 * (o, in mancanza, la scelta normale: meglio una battuta che il silenzio).
 */
export function pickForMoment(list: readonly string[], seed: string, m: MomentContext, fallback?: string, rot?: Rotation): string {
  const ok = list.filter((t) => lineFitsMoment(t, m));
  if (ok.length > 0) return rot ? rotatingPick(ok, rot, ok[0]) : seededPick(ok, seed);
  return fallback ?? seededPick(list, seed);
}
