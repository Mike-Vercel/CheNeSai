import type { TigPublicState } from "@/lib/tig/types";
import type { ArenaHost, ArenaPhase, ArenaTeam, HostId } from "./arena-contract";

/**
 * Dallo stato della serata alle props dell'arena (stesse per la versione 2D e per il 3D del ramo dedicato).
 */
export function arenaPhase(s: TigPublicState): ArenaPhase {
  const st = s.state === "PAUSED" ? (s.pausedFrom ?? "LOBBY_OPEN") : s.state;
  switch (st) {
    case "DRAFT":
    case "LOBBY_OPEN":
    case "LOBBY_LOCKED":
      return "lobby";
    case "INTRO":
      return "intro";
    case "ROUND_INTRO":
      return s.manche?.no === 5 ? "final" : "manche-intro";
    case "GAME_ACTIVE":
      if (s.game?.kind === "caos") return s.game.stage === "rule" ? "chaos" : "duel";
      if (s.game?.kind === "tiebreak") return "duel";
      return "game";
    case "GAME_RESULTS":
      return s.spotlight?.kind === "evolve" ? "evolve" : "reveal";
    case "LEADERBOARD":
      return "leaderboard";
    case "BREAK":
      return "break";
    case "FINAL":
      return "final";
    case "AWARDS":
    case "COMPLETED":
      return "awards";
    default:
      return "lobby";
  }
}

export function arenaTeams(s: TigPublicState): ArenaTeam[] {
  return s.teams.map((t) => ({
    teamId: t.teamId,
    tableNo: t.tableNo,
    name: t.name,
    color: t.color,
    mascotSlot: t.mascotSlot,
    mascotLevel: t.mascotLevel,
    score: t.score ?? 0,
    rank: t.rank ?? 0,
    chaosProgress: t.chaosProgress,
    online: t.online,
  }));
}

/** Testo grande del ledwall per la fase. */
export function arenaTitle(s: TigPublicState): { title: string | null; subtitle: string | null } {
  const st = s.state === "PAUSED" ? "PAUSED" : s.state;
  switch (st) {
    case "PAUSED":
      return { title: "PAUSA", subtitle: "Si riprende tra poco" };
    case "DRAFT":
    case "LOBBY_OPEN":
    case "LOBBY_LOCKED":
      return { title: "TAVERNA DEI PIRATI", subtitle: s.venue };
    case "INTRO":
      return { title: "TAVERNA DEI PIRATI", subtitle: "Si comincia" };
    case "ROUND_INTRO":
      return { title: s.manche?.title ?? null, subtitle: s.manche?.tagline ?? null };
    case "GAME_ACTIVE":
      if (s.game?.kind === "caos") return { title: "ALLARME CAOS!", subtitle: null };
      if (s.game?.kind === "tiebreak") return { title: "SPAREGGIO", subtitle: null };
      return { title: s.game?.title ?? null, subtitle: null };
    case "GAME_RESULTS":
      return { title: s.spotlight?.kind === "evolve" ? "EVOLUZIONE!" : "RISULTATI", subtitle: null };
    case "LEADERBOARD":
      return { title: s.hideScores ? "CLASSIFICA BUIA" : "CLASSIFICA", subtitle: null };
    case "BREAK":
      return { title: "PAUSA", subtitle: "Ordini, respiro, strategia" };
    case "FINAL":
      return { title: "TUTTO O NIENTE!", subtitle: null };
    case "AWARDS":
    case "COMPLETED":
      return { title: "PREMIAZIONE", subtitle: null };
    default:
      return { title: null, subtitle: null };
  }
}

/** Chi conduce in scena in quella fase (ruoli dal PDF). */
export function arenaHostsFor(s: TigPublicState, speaking: HostId | null, mouthRef?: ArenaHost["mouthRef"]): ArenaHost[] {
  const m = s.manche?.no ?? 0;
  const base: HostId = s.game?.kind === "caos" ? "zafira" : s.state === "FINAL" || s.state === "AWARDS" || m === 5 ? "don-patrizio" : m === 4 ? "investigatore" : m === 1 || s.state === "INTRO" ? "professore" : m === 2 ? "zafira" : "regina";
  const who = speaking ?? base;
  return [{ who, speaking: !!speaking, mouthRef: speaking ? mouthRef : undefined }];
}
