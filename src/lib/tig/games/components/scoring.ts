import type { TeamOutcome } from "../contract";

/**
 * Economia dei punti (PDF §04 e PIANO §3). Le meccaniche PROPONGONO punti entro questi limiti;
 * il runtime applica poi i tetti globali (saldo ≥ 0, perdite da azioni altrui ≤ 80 per manche, scudi).
 */
export const POINTS = {
  /** minigioco standard risolto */
  standard: 100,
  /** bonus velocità massimo, solo su prova identica per tutti */
  speedMax: 20,
  /** indizi progressivi: 1°, 2°, 3° indizio */
  clues: [100, 70, 40] as const,
  /** duello / attacco vinto */
  duelWin: 40,
  /** Bottone del Caos */
  chaosButton: 50,
  /** trasferimenti o penalità verso altri tavoli */
  transferMax: 40,
  /** puntata finale: quota massima del saldo e tetto assoluto */
  betShare: 0.25,
  betCap: 250,
  /** scelta finale prudente / rischiosa */
  finalSafe: 100,
  finalRisk: 240,
} as const;

/** Energia Caos proposta (separata dai punti, mai negativa). */
export const CHAOS = {
  /** invio puntuale */
  partecipa: 1,
  /** esito pieno (risposta esatta, accordo totale…) */
  centro: 1,
  /** rischio scelto (ramo alto, puntata, offerta) */
  rischio: 1,
  /** sfida accettata o duello giocato */
  sfida: 1,
} as const;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Bonus velocità lineare: `max` all'istante 0, 0 a fine finestra. Intero, mai negativo.
 * Va usato solo per risposte corrette e su contenuto identico per tutti i tavoli.
 */
export function speedBonus(elapsedMs: number, windowMs: number, max: number = POINTS.speedMax): number {
  if (!(windowMs > 0)) return 0;
  const left = 1 - clamp(elapsedMs, 0, windowMs) / windowMs;
  return Math.round(max * left);
}

/** Esito di un tavolo con valori predefiniti prudenti. */
export function outcome(teamId: string, o: Partial<Omit<TeamOutcome, "teamId">> = {}): TeamOutcome {
  return {
    teamId,
    points: o.points ?? 0,
    chaos: Math.max(0, o.chaos ?? 0),
    correct: o.correct ?? null,
    accuracy: o.accuracy ?? null,
    label: o.label ?? "",
    ...(o.transfers && o.transfers.length ? { transfers: o.transfers } : {}),
  };
}

/** Tavolo che non ha inviato nulla in tempo. */
export function noAnswer(teamId: string, label = "Nessuna risposta"): TeamOutcome {
  return outcome(teamId, { points: 0, chaos: 0, correct: null, accuracy: 0, label });
}

/** Punteggio «giusto/sbagliato» standard con bonus velocità facoltativo. */
export function rightWrong(
  teamId: string,
  correct: boolean,
  opts: { elapsedMs?: number; windowMs?: number; speed?: boolean; okLabel?: string; koLabel?: string } = {},
): TeamOutcome {
  const bonus = correct && opts.speed && opts.windowMs ? speedBonus(opts.elapsedMs ?? 0, opts.windowMs) : 0;
  return outcome(teamId, {
    points: correct ? POINTS.standard + bonus : 0,
    chaos: CHAOS.partecipa + (correct ? CHAOS.centro : 0),
    correct,
    accuracy: correct ? 1 : 0,
    label: correct ? (opts.okLabel ?? (bonus ? `Esatto · +${bonus} velocità` : "Esatto")) : (opts.koLabel ?? "Sbagliato"),
  });
}
