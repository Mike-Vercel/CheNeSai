import type { Phase, Stage, WheelKind } from "@/lib/giramente/types";
import type { CharacterAction } from "../types";
import type { MarkId } from "./studio-layout";

/**
 * REGIA DELLO STUDIO 3D (pura, testata in tests/unit/giramente-studio.test.ts): dalla fase pubblica e dal tempo
 * trascorso dall'inizio della fase decide inquadratura, azione e posizione di Don Patrizio, luci, Zafira in scena.
 * Non comanda MAI il gioco: legge solo lo stato pubblico (chi si ricollega a metà fase vede subito il punto giusto,
 * perché il tempo trascorso arriva dall'orologio del server).
 */

export type ShotId = "wide" | "duo" | "spin" | "wheel" | "sector" | "presenter" | "presenterFull" | "jolly" | "board" | "standings" | "winner" | "establish" | "host" | "title";

/** Atmosfera delle luci (coni, colori, lampadine). */
export type Mood = "idle" | "tension" | "spin" | "correct" | "wrong" | "jolly" | "colpo" | "reveal" | "standings" | "victory";

export interface StudioCue {
  phase: Phase;
  /** cambia a ogni nuova fase / turno / prova: la regia della fase riparte da zero */
  key: string;
  /** inizio della fase secondo il server (ms; NaN = ignoto: vale l'ora in cui la regia vede la fase) */
  since: number;
  sector: WheelKind | null;
  /** esito del turno (TURN_RESULT) */
  correct: boolean | null;
  stage: Stage | null;
  /** durata del giro in corso (SPINNING) */
  spinMs: number | null;
  /** Giro Decisivo o spareggio (luci più "da finale") */
  finale: boolean;
}

export interface StudioDirection {
  shot: ShotId;
  /** secondi di "smorzamento" verso la nuova inquadratura: 0 = stacco netto */
  ease: number;
  action: CharacterAction;
  mark: MarkId;
  mood: Mood;
  /** Zafira è in scena (portale aperto) */
  zafira: boolean;
}

/** Ingresso camminando di Don Patrizio all'inizio della partita (ms). */
export const WALK_IN_MS = 3200;
/** Durata della «spinta» all'inizio del giro (ms): poi si gode il giro. */
export const PUSH_MS = 1100;

/** Fasi in cui la ruota è protagonista (lo studio la tiene libera dall'interfaccia). */
export const WHEEL_FOCUS_PHASES: ReadonlySet<Phase> = new Set<Phase>(["SPIN", "SPINNING", "WHEEL_RESULT"]);

/**
 * Inizio effettivo della fase: al primo fotogramma (ingresso o ricollegamento a metà fase) quello del server;
 * ai cambi di fase visti dal vivo l'ora del cambio (il giro usa sempre l'inizio del server, come la ruota).
 */
export function effectiveSince(cue: StudioCue, prev: { key: string; since: number } | null, nowMs: number): number {
  if (prev && prev.key === cue.key) return prev.since;
  const server = Number.isFinite(cue.since) && cue.since <= nowMs + 2000 ? cue.since : NaN;
  if (!prev || cue.phase === "SPINNING") return Number.isFinite(server) ? server : nowMs;
  return nowMs;
}

export function directStudio(cue: StudioCue, elapsedMs: number, speaking: boolean): StudioDirection {
  const t = Math.max(0, elapsedMs);
  const talk = (fallback: CharacterAction): CharacterAction => (speaking ? "presentazione" : fallback);
  const base: StudioDirection = { shot: "duo", ease: 1.1, action: talk("idle"), mark: "home", mood: "idle", zafira: false };
  switch (cue.phase) {
    case "LOBBY":
      // attesa: inquadratura larga che "respira", il presentatore saluta ogni tanto
      return { ...base, shot: "wide", ease: 1.6, action: speaking ? "presentazione" : t % 14_000 < 2600 ? "saluto" : "idle" };
    case "INTRO":
      // si fa avanti al centro del palco, saluta il pubblico, poi torna accanto alla ruota
      if (t < WALK_IN_MS) return { ...base, shot: "presenterFull", ease: 0.9, action: "idle", mark: "center" };
      if (t < WALK_IN_MS + 2400) return { ...base, shot: "presenterFull", ease: 1.2, action: "saluto", mark: "center" };
      return { ...base, shot: "duo", ease: 1.4, action: talk("presentazione") };
    case "ROUND_INTRO":
      // stacco sul LED con il nome della manche, poi sul presentatore che la annuncia
      if (t < 2600) return { ...base, shot: "wide", ease: 0.9, action: talk("saluto"), mood: cue.finale ? "reveal" : "idle" };
      return { ...base, shot: "presenter", ease: 0.55, action: talk("presentazione"), mood: cue.finale ? "reveal" : "idle" };
    case "CHOICE":
      return { ...base, shot: "duo", ease: 1.1, action: talk("idle"), mood: "tension" };
    case "SPIN":
      // si avvicina alla ruota e la indica: «Gira!»
      return { ...base, shot: "spin", ease: 1.0, action: "indica", mark: "push", mood: "tension" };
    case "SPINNING": {
      const dur = cue.spinMs ?? 6000;
      // carrellata lenta verso la ruota per tutta la durata del giro: a ruota ferma la ruota riempie il quadro
      const ease = Math.max(0.8, (dur / 1000) * 0.26);
      if (t < PUSH_MS) return { ...base, shot: "wheel", ease, action: "spinta", mark: "push", mood: "spin" };
      return { ...base, shot: "wheel", ease, action: "pensiero", mark: "push", mood: "spin" };
    }
    case "WHEEL_RESULT": {
      const jolly = cue.sector === "jolly";
      const colpo = cue.sector === "colpo";
      const mood = jolly ? "jolly" : colpo ? "colpo" : "correct";
      // primo piano sullo spicchio vincente, poi la scena (con Zafira se è uscita la Jolly)
      if (t < 2400) return { ...base, shot: "sector", ease: 0.6, action: jolly || colpo ? "sorpresa" : "indica", mark: "home", mood, zafira: jolly };
      if (jolly) return { ...base, shot: "jolly", ease: 1.3, action: talk("indica"), mark: "home", mood, zafira: true };
      return { ...base, shot: "duo", ease: 1.2, action: talk(colpo ? "sorpresa" : "indica"), mark: "home", mood };
    }
    case "QUESTION":
      return { ...base, shot: "duo", ease: 1.2, action: talk("pensiero"), mood: "tension" };
    case "TURN_RESULT":
      if (cue.correct) return { ...base, shot: "presenter", ease: 0.55, action: t < 2800 ? "applauso" : talk("risata"), mood: "correct" };
      return { ...base, shot: "presenter", ease: 0.55, action: t < 3200 ? "delusione" : talk("idle"), mood: "wrong" };
    case "TURN_READY":
      return { ...base, shot: "presenterFull", ease: 1.0, action: talk("indica") };
    case "PLAY":
      if (cue.stage === "tabellone") return { ...base, shot: "board", ease: 1.3, action: talk("pensiero"), mood: "tension" };
      return { ...base, shot: "duo", ease: 1.2, action: talk("pensiero"), mood: "tension" };
    case "REVEAL":
      if (cue.stage === "tabellone") return { ...base, shot: "board", ease: 1.0, action: talk("presentazione"), mood: "reveal" };
      return { ...base, shot: "presenter", ease: 0.55, action: talk("presentazione"), mood: "reveal" };
    case "ROUND_RESULTS":
      return { ...base, shot: "standings", ease: 1.5, action: t < 3000 ? "applauso" : talk("idle"), mood: "standings" };
    case "FINAL":
      return { ...base, shot: "winner", ease: 1.4, action: speaking && t > 6000 ? "presentazione" : "vittoria", mark: "center", mood: "victory" };
    default:
      return base;
  }
}
