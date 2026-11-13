import { PUZZLE_KIND_LABEL, WHEEL_LABEL } from "@/lib/giramente/rules";
import type { PublicState } from "@/lib/giramente/types";
import type { LedContent } from "./three/studio/led-texture";

/**
 * Dallo stato PUBBLICO della partita a ciò che serve allo studio 3D (pure, testate in tests/unit/giramente-studio.test.ts):
 * chiave della fase, inizio della fase secondo il server, contenuto dello schermo LED.
 */
const nameOf = (s: PublicState, id: string | null | undefined): string => s.competitors.find((c) => c.id === id)?.name ?? "";

const STAGE_TITLE: Record<string, string> = { falsa: "LA FALSA PISTA", collegamento: "IL COLLEGAMENTO", tabellone: "IL TABELLONE SEGRETO", tiebreak: "SPAREGGIO" };

export function cueKey(s: PublicState): string {
  return `${s.phase}|${s.roundNo}|${s.turn?.playId ?? ""}|${s.stage ?? ""}|${s.tiebreakNo}|${s.stagePlay?.turnNo ?? ""}`;
}

/**
 * Inizio della fase secondo il server (per chi entra o si ricollega a metà): giro, timer della fase o ultimo evento.
 * NaN se lo stato non lo dice (la regia usa allora l'ora in cui vede la fase).
 */
export function serverPhaseStart(s: PublicState): number {
  if (s.phase === "SPINNING" && s.wheel.spin) return Date.parse(s.wheel.spin.startedAt);
  const cands = [s.phaseTimer.startedAt, s.question?.timer.startedAt ?? null, s.stagePlay?.timer.startedAt ?? null, s.event?.at ?? null].map((v) => (v ? Date.parse(v) : NaN)).filter((v) => Number.isFinite(v));
  return cands.length ? Math.max(...cands) : NaN;
}

/** Contenuto dello schermo LED: SOLO dati pubblici (mai codici, mai soluzioni prima della rivelazione). */
export function ledFor(s: PublicState): LedContent {
  const who = nameOf(s, s.turn?.competitorId).toUpperCase();
  switch (s.phase) {
    case "LOBBY":
      return { kind: "logo" };
    case "INTRO":
      return { kind: "logo", sub: "Ecco i concorrenti!" };
    case "ROUND_INTRO":
      if (s.stage === "tiebreak") return { kind: "title", over: "PARITÀ AL PRIMO POSTO", title: "SPAREGGIO!", tone: "red" };
      return { kind: "title", over: `MANCHE ${s.roundNo} DI 5`, title: s.roundName ?? "GIRAMENTE!", tone: s.roundNo === 5 ? "red" : "green" };
    case "CHOICE":
      return { kind: "title", over: who ? `TOCCA A ${who}` : undefined, title: "VERDE O ROSSO?", tone: "green" };
    case "SPIN":
      return { kind: "title", over: who || undefined, title: "GIRA LA RUOTA!", tone: "green" };
    case "SPINNING":
      return { kind: "title", over: who || undefined, title: "LA RUOTA GIRA…", tone: "white" };
    case "WHEEL_RESULT": {
      const k = s.turn?.sector;
      if (!k) return { kind: "logo" };
      return { kind: "title", over: "ESITO DELLA RUOTA", title: WHEEL_LABEL[k].toUpperCase(), tone: k === "jolly" || k === "colpo" ? "red" : k === "bonus" ? "gold" : "green" };
    }
    case "QUESTION": {
      const k = s.turn?.sector;
      const label = k ? WHEEL_LABEL[k] : s.question?.kind ? PUZZLE_KIND_LABEL[s.question.kind] : (s.roundName ?? "");
      return { kind: "title", over: s.roundName ?? undefined, title: label.toUpperCase(), tone: "green", sub: s.question ? `In palio: ${s.question.pointsAtStake} punti` : undefined };
    }
    case "TURN_RESULT": {
      const r = s.result;
      if (!r) return { kind: "logo" };
      const delta = r.delta > 0 ? `+${r.delta} punti` : r.delta < 0 ? `${r.delta} punti` : "0 punti";
      return { kind: "title", over: nameOf(s, r.competitorId).toUpperCase(), title: r.correct ? "GIUSTO!" : r.timeout ? "TEMPO SCADUTO" : "SBAGLIATO", tone: r.correct ? "green" : "red", sub: delta };
    }
    case "TURN_READY":
      return { kind: "title", over: STAGE_TITLE[s.stagePlay?.stage ?? ""], title: `TOCCA A ${nameOf(s, s.stagePlay?.competitorId).toUpperCase()}`, tone: "green" };
    case "PLAY": {
      const sp = s.stagePlay;
      if (sp?.common?.tabellone) return { kind: "board", category: sp.common.tabellone.category, rows: sp.common.tabellone.rows, solved: false };
      return { kind: "title", over: s.roundName ?? undefined, title: STAGE_TITLE[sp?.stage ?? ""] ?? "GIRAMENTE!", tone: "green", sub: sp?.simultaneous ? "Tutti insieme!" : sp?.competitorId ? `Gioca ${nameOf(s, sp.competitorId)}` : undefined };
    }
    case "REVEAL": {
      const r = s.reveal;
      if (r?.board) return { kind: "board", category: r.board.category, rows: r.board.rows, solved: true };
      if (r?.stage === "tiebreak" && r.tiebreakWinner) return { kind: "title", over: "VINCE LO SPAREGGIO", title: nameOf(s, r.tiebreakWinner).toUpperCase(), tone: "gold" };
      return { kind: "title", over: STAGE_TITLE[r?.stage ?? ""], title: "ECCO COM'È ANDATA", tone: "white" };
    }
    case "ROUND_RESULTS":
      return { kind: "standings", rows: s.standings.slice(0, 4).map((st) => ({ name: nameOf(s, st.competitorId), score: st.score })) };
    case "FINAL": {
      const w = s.competitors.filter((c) => s.winners.includes(c.id));
      return { kind: "winner", names: w.map((c) => c.name), score: w[0]?.score ?? null };
    }
    default:
      return { kind: "logo" };
  }
}
