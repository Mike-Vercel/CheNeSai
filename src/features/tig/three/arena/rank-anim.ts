import type { ArenaTeam } from "../../arena-contract";
import { smoothDamp } from "./camera-math";
import { columnHeight, scoreScale } from "./layout";

/**
 * ANIMAZIONE DI PUNTEGGI E CLASSIFICA (pura, testata): i numeri arrivano dal server a scatti, a schermo salgono e
 * scendono in modo morbido. Per ogni squadra: punteggio mostrato (conta su/giù), altezza della torre, riga in
 * classifica (le righe scivolano quando cambia la posizione). Nessuna allocazione per fotogramma dopo il primo.
 */

export interface TeamAnim {
  teamId: string;
  /** punteggio mostrato (decimale; a schermo si arrotonda) */
  score: number;
  scoreVel: { v: number };
  /** altezza della colonna (m) */
  height: number;
  heightVel: { v: number };
  /** riga della classifica mostrata (0 = primo; decimale durante lo scivolamento) */
  row: number;
  rowVel: { v: number };
  /** 0..1 Energia Caos mostrata */
  chaos: number;
  chaosVel: { v: number };
  /** ultimo punteggio vero visto e istante (s) dell'ultimo cambio: serve al lampo «+40» */
  lastTarget: number;
  delta: number;
  deltaAge: number;
}

/** Tempi di assestamento (s): il conteggio dei punti è più lento della torre, così si legge. */
export const SCORE_SMOOTH = 0.55;
export const HEIGHT_SMOOTH = 0.45;
export const ROW_SMOOTH = 0.35;
export const CHAOS_SMOOTH = 0.6;

/** Ordine di classifica: posizione (rank) crescente, a parità il tavolo più basso. */
export function rankOrder<T extends Pick<ArenaTeam, "rank" | "tableNo" | "score">>(teams: readonly T[]): T[] {
  return [...teams].sort((a, b) => a.rank - b.rank || b.score - a.score || a.tableNo - b.tableNo);
}

/** Ordine dei tavoli (posizione fissa sull'arco). */
export function tableOrder<T extends Pick<ArenaTeam, "tableNo" | "teamId">>(teams: readonly T[]): T[] {
  return [...teams].sort((a, b) => a.tableNo - b.tableNo || (a.teamId < b.teamId ? -1 : 1));
}

export class RankAnimator {
  private map = new Map<string, TeamAnim>();
  /** fondo scala smorzato (non salta quando cambia il primo) */
  scale = 300;
  private scaleVel = { v: 0 };
  /** quante righe della classifica sono in movimento o quanti numeri contano */
  busy = false;

  get(teamId: string): TeamAnim | undefined {
    return this.map.get(teamId);
  }

  /**
   * Un passo dell'animazione verso lo stato vero. `snap` = salta subito (primo fotogramma, movimento ridotto).
   * Restituisce true se qualcosa si sta ancora muovendo.
   */
  step(teams: readonly ArenaTeam[], dt: number, snap = false): boolean {
    let maxScore = 0;
    for (const t of teams) maxScore = Math.max(maxScore, t.score);
    const targetScale = scoreScale(maxScore);
    this.scale = snap ? targetScale : smoothDamp(this.scale, targetScale, this.scaleVel, 0.8, dt);
    const order = rankOrder(teams);
    let moving = Math.abs(this.scale - targetScale) > 0.5;
    for (let i = 0; i < order.length; i++) {
      const t = order[i];
      let a = this.map.get(t.teamId);
      const h = columnHeight(t.score, this.scale);
      if (!a) {
        a = {
          teamId: t.teamId,
          score: t.score,
          scoreVel: { v: 0 },
          height: h,
          heightVel: { v: 0 },
          row: i,
          rowVel: { v: 0 },
          chaos: t.chaosProgress,
          chaosVel: { v: 0 },
          lastTarget: t.score,
          delta: 0,
          deltaAge: 99,
        };
        this.map.set(t.teamId, a);
      }
      if (t.score !== a.lastTarget) {
        a.delta = t.score - a.lastTarget;
        a.deltaAge = 0;
        a.lastTarget = t.score;
      } else a.deltaAge += dt;
      if (snap) {
        a.score = t.score;
        a.height = h;
        a.row = i;
        a.chaos = t.chaosProgress;
        a.scoreVel.v = a.heightVel.v = a.rowVel.v = a.chaosVel.v = 0;
        continue;
      }
      a.score = smoothDamp(a.score, t.score, a.scoreVel, SCORE_SMOOTH, dt);
      a.height = smoothDamp(a.height, h, a.heightVel, HEIGHT_SMOOTH, dt);
      a.row = smoothDamp(a.row, i, a.rowVel, ROW_SMOOTH, dt);
      a.chaos = smoothDamp(a.chaos, Math.min(1, Math.max(0, t.chaosProgress)), a.chaosVel, CHAOS_SMOOTH, dt);
      if (Math.abs(a.score - t.score) > 0.4 || Math.abs(a.height - h) > 0.002 || Math.abs(a.row - i) > 0.002 || Math.abs(a.chaosVel.v) > 0.001) moving = true;
      if (a.deltaAge < 2.4) moving = true;
    }
    // squadre uscite: via dalla mappa
    if (this.map.size > teams.length) {
      const ids = new Set(teams.map((t) => t.teamId));
      for (const id of [...this.map.keys()]) if (!ids.has(id)) this.map.delete(id);
    }
    this.busy = moving;
    return moving;
  }
}

/** Punteggio da mostrare (intero, separatore italiano). */
export function formatScore(v: number): string {
  return Math.max(0, Math.round(v)).toLocaleString("it-IT");
}

/** Cifre del punteggio per le torri (max 5, senza separatori): «1240» → [1,2,4,0]. */
export function scoreDigits(v: number, max = 5): number[] {
  const s = String(Math.min(10 ** max - 1, Math.max(0, Math.round(v))));
  return s.split("").map((c) => c.charCodeAt(0) - 48);
}

/**
 * Lampo del cambio di punti sopra la torre («+40» / «−20»): opacità 0..1 dall'età del cambio (s).
 * Sale in fretta, resta ~1,4 s, poi sfuma.
 */
export function deltaFlash(age: number): number {
  if (age < 0) return 0;
  if (age < 0.15) return age / 0.15;
  if (age < 1.6) return 1;
  if (age < 2.4) return 1 - (age - 1.6) / 0.8;
  return 0;
}
