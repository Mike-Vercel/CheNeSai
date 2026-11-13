import type { PublicState, WheelKind } from "@/lib/giramente/types";

/**
 * Regia di GIRAMENTE!: dal confronto tra lo stato pubblico precedente e il nuovo decide quali battute
 * (id BASE: la variante la sceglie la coda delle voci, vedi pickVariant in lib/giramente/lines.ts)
 * dicono Don Patrizio e Zafira e quali effetti suonano. Pura (testata in tests/unit/giramente-director.test.ts).
 * La regia non comanda MAI il gioco: lo stato del server avanza senza aspettare voci o animazioni.
 */
export interface Cue {
  line: string;
  competitorId?: string | null;
  points?: number | null;
  roundNo?: number | null;
}

export type Sfx = "spin" | "correct" | "wrong" | "bonus" | "jolly" | "penalty" | "finale" | "victory" | "leaderboard" | "roundStart" | "question" | "reveal" | "join" | "pause";

export interface Direction {
  cues: Cue[];
  sfx: Sfx[];
  /** nuova fase: si scartano le battute vecchie ancora in coda */
  replace: boolean;
}

/**
 * `welcomed`: chi gestisce ha appena visto l'intro di «Nuova partita» (Don Patrizio ha già dato il benvenuto):
 * all'apertura della sala d'attesa niente secondo «Benvenuti», solo l'invito ad entrare.
 */
export function direct(prev: PublicState | null, next: PublicState, opts: { welcomed?: boolean } = {}): Direction {
  const out: Direction = { cues: [], sfx: [], replace: false };
  if (!prev) {
    if (next.phase === "LOBBY" && next.status === "open") out.cues.push(...(opts.welcomed ? [] : [{ line: "benvenuti" }]), { line: "sala-attesa" });
    return out;
  }
  if (prev.roomId !== next.roomId) return out;
  const newEvent = next.event && next.event.at !== prev.event?.at ? next.event : null;
  const phaseChanged = prev.phase !== next.phase || prev.roundNo !== next.roundNo || prev.turn?.playId !== next.turn?.playId || prev.stage !== next.stage;
  out.replace = phaseChanged;
  const team = next.mode === "teams";

  if (newEvent?.kind === "pause") {
    out.cues.push({ line: "pausa" });
    out.sfx.push("pause");
  }
  if (newEvent?.kind === "resume") out.cues.push({ line: "ripresa" });
  if (newEvent?.kind === "joined" && next.phase === "LOBBY") out.sfx.push("join");
  if (newEvent?.kind === "occhio" && newEvent.data?.public) out.cues.push({ line: "zafira-usa-occhio" });
  if (newEvent?.kind === "jolly_power") out.cues.push({ line: newEvent.data?.power === "occhio" ? "zafira-occhio" : "zafira-scudo" }, { line: "zafira-uscita" });

  if (!phaseChanged) return out;
  const turn = next.turn;
  switch (next.phase) {
    case "INTRO":
      out.cues.push({ line: "inizio-partita" }, { line: "presentazione" });
      out.sfx.push("roundStart");
      break;
    case "ROUND_INTRO":
      out.sfx.push(next.roundNo === 5 || next.stage === "tiebreak" ? "finale" : "roundStart");
      out.cues.push({ line: next.stage === "tiebreak" ? "spareggio" : `manche-${next.roundNo}` });
      break;
    case "CHOICE":
      if (turn) out.cues.push({ line: team ? "turno-squadra" : "turno-giocatore", competitorId: turn.competitorId }, { line: "scegli" });
      break;
    case "SPIN":
      if (prev.phase === "CHOICE" && turn?.risk) out.cues.push({ line: turn.risk === "rosso" ? "scelta-rosso" : "scelta-verde" }, { line: "gira" });
      else if (turn) out.cues.push({ line: team ? "turno-squadra" : "turno-giocatore", competitorId: turn.competitorId }, { line: "gira" });
      break;
    case "SPINNING":
      out.sfx.push("spin");
      break;
    case "WHEEL_RESULT": {
      if (prev.phase !== "SPINNING") break;
      const sector = turn?.sector as WheelKind | null;
      if (!sector) break;
      if (sector === "jolly") {
        out.sfx.push("jolly");
        out.cues.push({ line: "settore-jolly" });
        out.cues.push({ line: "zafira-ingresso" }, { line: turn?.jolly?.duplicate ? "zafira-doppione" : "zafira-offerta" });
      } else {
        if (sector === "bonus") out.sfx.push("bonus");
        out.cues.push({ line: `settore-${sector}` });
      }
      break;
    }
    case "QUESTION":
      out.sfx.push("question");
      out.cues.push({ line: "domanda" });
      break;
    case "TURN_RESULT": {
      const r = next.result;
      if (!r) break;
      if (r.correct) {
        out.sfx.push(r.lines.some((l) => /Bonus|lampo/i.test(l.label)) ? "bonus" : "correct");
        out.cues.push({ line: "giusta" });
        if (r.lines.some((l) => /Bonus|lampo/i.test(l.label))) out.cues.push({ line: "bonus-preso" });
        else if (!team && r.delta > 0) out.cues.push({ line: "punti-giocatore", competitorId: r.competitorId, points: r.delta });
      } else if (r.shieldUsed) {
        out.sfx.push("wrong");
        out.cues.push({ line: "zafira-usa-scudo" });
      } else if (r.delta < 0 || r.lines.some((l) => /Penalità/.test(l.label))) {
        out.sfx.push("penalty");
        out.cues.push({ line: "penalita" });
      } else {
        out.sfx.push("wrong");
        out.cues.push({ line: r.timeout ? "tempo-scaduto" : "sbagliata" });
      }
      break;
    }
    case "TURN_READY":
      out.cues.push({ line: "passa-telefono" });
      break;
    case "PLAY":
      if (prev.phase === "TURN_READY") break;
      if (next.stage === "tabellone") out.cues.push({ line: "tabellone" });
      else if (next.stagePlay?.simultaneous) out.cues.push({ line: "tutti-insieme" });
      out.sfx.push("question");
      break;
    case "REVEAL":
      out.sfx.push("reveal");
      out.cues.push({ line: "rivelazione" });
      break;
    case "ROUND_RESULTS":
      out.sfx.push("leaderboard");
      out.cues.push({ line: "classifica" });
      if (next.roundNo === 4) out.cues.push({ line: "zafira-scadenza" });
      break;
    case "FINAL": {
      out.sfx.push("victory");
      const w = next.competitors.find((c) => c.id === next.winners[0]);
      out.cues.push({ line: "vincitore" });
      if (w && next.winners.length === 1) out.cues.push({ line: "vincitore-nome", competitorId: w.id, points: w.score });
      out.cues.push({ line: "saluti" });
      break;
    }
  }
  return out;
}
