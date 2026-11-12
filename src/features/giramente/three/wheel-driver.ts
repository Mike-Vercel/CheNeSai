import type { WheelSpinCommand } from "./types";
import { ACTIVATION_BLEND_MS, activationOffset, pegIndex, planSpin, restAngle, spinAngleAt, spinDone, spinSpeedAt, type SpinPlan } from "./wheel-math";

/**
 * Stato locale di una ruota a schermo (comune a 3D e 2D, senza React): a ogni fotogramma riceve il comando
 * del server e l'ora del server e restituisce l'angolo da mostrare, gli scatti del puntatore e la fine del giro.
 * L'angolo è quello deterministico di wheel-math (uguale per tutti); l'unico stato locale è il raccordo dei
 * primi ACTIVATION_BLEND_MS per chi stava mostrando un altro spicchio.
 */
export interface WheelFrame {
  angle: number;
  /** rad/s (0 da ferma) */
  speed: number;
  spinning: boolean;
  /** un separatore è passato sotto il puntatore in questo fotogramma (per lo scatto visivo) */
  pegChanged: boolean;
  /** come pegChanged ma al massimo uno ogni TICK_MIN_GAP_MS (per il suono / onTick) */
  ticked: boolean;
  /** spinId appena concluso (una sola volta per giro) */
  ended: string | null;
  /** spicchio sotto il puntatore a ruota ferma (null mentre gira o se ignoto) */
  restingOn: number | null;
}

/** Minimo intervallo tra due onTick (suono): oltre ~22 scatti al secondo diventa un ronzio. */
export const TICK_MIN_GAP_MS = 45;

/**
 * Giri già conclusi in questa pagina: onSpinEnd parte UNA volta per spinId anche se la ruota si rimonta
 * (es. 2D mostrata mentre si scarica il 3D, poi il 3D). Tenuti solo gli ultimi 64.
 */
const endedInPage: string[] = [];
function markEnded(id: string): boolean {
  if (endedInPage.includes(id)) return false;
  endedInPage.push(id);
  if (endedInPage.length > 64) endedInPage.shift();
  return true;
}

export class WheelDriver {
  private plan: SpinPlan | null = null;
  private planKey = "";
  private shownAtStart: number | null = null;
  private angle: number | null = null;
  private peg: number | null = null;
  private lastTickAt = -Infinity;
  private restingOn: number | null = null;

  update(spin: WheelSpinCommand | null, restIndex: number | null | undefined, n: number, t: number): WheelFrame {
    let ticked = false;
    let ended: string | null = null;
    let speed = 0;
    let spinning = false;
    if (spin) {
      const key = `${spin.spinId}|${spin.targetIndex}|${spin.startedAt}|${spin.durationMs}|${n}`;
      if (key !== this.planKey) {
        this.planKey = key;
        this.plan = planSpin(spin, n);
        // raccordo solo se questo client stava già mostrando la ruota a inizio giro
        this.shownAtStart = this.angle !== null && t - spin.startedAt < ACTIVATION_BLEND_MS ? this.angle : null;
        this.peg = null;
      }
      const plan = this.plan!;
      const a = spinAngleAt(plan, t) + activationOffset(plan, this.shownAtStart, t);
      if (spinDone(plan, t)) {
        this.restingOn = plan.targetIndex;
        if (markEnded(plan.spinId)) ended = plan.spinId;
      } else {
        spinning = t >= plan.startedAt;
        this.restingOn = null;
        speed = spinSpeedAt(plan, t);
      }
      this.angle = a;
    } else {
      this.planKey = "";
      this.plan = null;
      if (restIndex !== null && restIndex !== undefined && Number.isFinite(restIndex)) {
        this.angle = restAngle(restIndex, n);
        this.restingOn = ((Math.round(restIndex) % n) + n) % n;
      } else if (this.angle === null) {
        this.angle = restAngle(0, n);
        this.restingOn = null;
      }
    }
    const angle = this.angle!;
    const peg = pegIndex(angle, n);
    const pegChanged = spinning && this.peg !== null && peg !== this.peg;
    if (pegChanged && t - this.lastTickAt >= TICK_MIN_GAP_MS) {
      ticked = true;
      this.lastTickAt = t;
    }
    this.peg = peg;
    return { angle, speed, spinning, pegChanged, ticked, ended, restingOn: this.restingOn };
  }
}
