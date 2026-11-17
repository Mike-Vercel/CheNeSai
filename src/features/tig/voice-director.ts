import type { HostId } from "./arena-contract";
import type { VoiceVars } from "@/lib/tig/voices/fill";
import type { VoiceCategory } from "@/lib/tig/voices/schema";
import type { TigPublicState } from "@/lib/tig/types";

/**
 * REGIA DELLE VOCI (pura, testabile): dal cambio di stato della serata → battute da dire (categoria + personaggio
 * + variabili) ed effetti. Ruoli dal PDF: il Professore (Professor Smoke) apre e conduce le prove lampo; Victor
 * (l'Investigatore) il grande inganno; Zafira bonus, rischi e Caos; Don Patrizio finale e classifica; Regina
 * raccordo e cambi di posizione. Se il personaggio non ha battute per la categoria se ne cerca un altro.
 * Le variabili sono SOLO numeri di tavolo, slot di mascotte, punti, manche e titoli dal registro: mai nomi scritti dagli utenti.
 */
export interface VoiceCue {
  category: VoiceCategory;
  /** personaggi in ordine di preferenza */
  hosts: HostId[];
  vars: VoiceVars;
  /** interrompe ciò che si sta dicendo (Allarme Caos, pausa) */
  interrupt?: boolean;
}

export type TigSfx = "roundStart" | "question" | "reveal" | "correct" | "wrong" | "leaderboard" | "alarm" | "evolve" | "fanfare" | "victory" | "pause" | "join" | "shield";

const MANCHE_HOST: Record<number, HostId[]> = {
  1: ["professore", "regina", "don-patrizio"],
  2: ["zafira", "regina", "don-patrizio"],
  3: ["regina", "palmino", "don-patrizio"],
  4: ["investigatore", "zafira", "don-patrizio"],
  5: ["don-patrizio", "zafira", "regina"],
};
const RACCORDO: HostId[] = ["regina", "don-patrizio", "zafira", "professore"];
const RISCHI: HostId[] = ["zafira", "don-patrizio", "regina"];
const FINALE: HostId[] = ["don-patrizio", "regina", "zafira"];
/** ospiti che commentano ogni tanto (a rotazione, per non ripetere sempre la stessa voce) */
const OSPITI: HostId[] = ["palmino", "nek", "ciccio", "franca", "piroletto", "minu", "chicca", "bumbaru", "mordicchio", "mammusss", "rumpo"];
const guest = (n: number): HostId[] => [OSPITI[((n % OSPITI.length) + OSPITI.length) % OSPITI.length], ...RACCORDO];

function teamVars(state: TigPublicState, a: string | null | undefined, b?: string | null): VoiceVars {
  const ta = state.teams.find((t) => t.teamId === a);
  const tb = b ? state.teams.find((t) => t.teamId === b) : undefined;
  return { tavoloA: ta?.tableNo ?? null, mascotA: ta?.mascotSlot ?? null, tavoloB: tb?.tableNo ?? null, mascotB: tb?.mascotSlot ?? null };
}

const leader = (s: TigPublicState) => s.teams.find((t) => t.rank === 1 && s.teams.filter((x) => x.rank === 1).length === 1) ?? null;

export function directVoice(prev: TigPublicState | null, next: TigPublicState): { cues: VoiceCue[]; sfx: TigSfx[] } {
  const cues: VoiceCue[] = [];
  const sfx: TigSfx[] = [];
  if (!prev || prev.eventId !== next.eventId) return { cues, sfx };
  if (prev.version === next.version) return { cues, sfx };
  const entered = prev.state !== next.state ? next.state : null;
  const manche = next.manche?.no ?? null;
  const hostsFor = (n: number | null) => (n ? MANCHE_HOST[n] : RACCORDO);

  if (next.state === "PAUSED" && prev.state !== "PAUSED") {
    sfx.push("pause");
    cues.push({ category: "PAUSA", hosts: RACCORDO, vars: {}, interrupt: true });
    return { cues, sfx };
  }
  if (prev.teams.length < next.teams.length && (next.state === "LOBBY_OPEN" || next.state === "LOBBY_LOCKED")) {
    sfx.push("join");
    const added = next.teams.find((t) => !prev.teams.some((p) => p.teamId === t.teamId));
    if (added) cues.push({ category: "BENVENUTO_SQUADRE", hosts: RACCORDO, vars: teamVars(next, added.teamId) });
  }
  switch (entered) {
    case "INTRO":
      sfx.push("fanfare");
      cues.push({ category: "APERTURA", hosts: ["professore", "don-patrizio", "regina"], vars: {} });
      cues.push({ category: "MASCOTTE_PRESENTAZIONE", hosts: ["zafira", "regina"], vars: {} });
      break;
    case "ROUND_INTRO":
      sfx.push("roundStart");
      if (prev.state === "BREAK") cues.push({ category: "RIENTRO_PAUSA", hosts: RACCORDO, vars: {} });
      cues.push({ category: manche === 5 ? "ULTIMA_MANCHE" : "INIZIO_MANCHE", hosts: hostsFor(manche), vars: { manche } });
      if (manche === 5) cues.push({ category: "PUNTATA_RISCHIOSA", hosts: RISCHI, vars: {} });
      break;
    case "BREAK":
      sfx.push("pause");
      cues.push({ category: "PAUSA", hosts: RACCORDO, vars: {} });
      break;
    case "FINAL":
      sfx.push("fanfare");
      cues.push({ category: next.game?.kind === "tiebreak" ? "SUSPENSE" : "FINALE", hosts: FINALE, vars: {} });
      break;
    case "AWARDS": {
      sfx.push("victory");
      cues.push({ category: "PREMIAZIONE", hosts: FINALE, vars: {} });
      const win = next.awards?.order.at(-1);
      if (win) cues.push({ category: "VITTORIA", hosts: FINALE, vars: teamVars(next, win) });
      break;
    }
    case "COMPLETED":
      cues.push({ category: "SALUTO_FINALE", hosts: FINALE, vars: {} });
      break;
  }
  // nuova prova
  if (next.game && next.game.id !== prev.game?.id && next.state === "GAME_ACTIVE") {
    if (next.game.kind === "caos") {
      sfx.push("alarm");
      cues.push({ category: "BOTTONE_CAOS", hosts: RISCHI, vars: teamVars(next, next.game.participants[0], next.game.participants[1]), interrupt: true });
    } else if (next.game.kind === "tiebreak") {
      sfx.push("alarm");
      cues.push({ category: "PAREGGIO", hosts: FINALE, vars: teamVars(next, next.game.participants[0], next.game.participants[1]) });
    } else {
      sfx.push("question");
      cues.push({ category: "MINIGIOCO_PRESENTAZIONE", hosts: hostsFor(manche), vars: { minigioco: next.game.title, manche } });
    }
  }
  // esito della prova
  if (entered === "GAME_RESULTS" && next.game) {
    sfx.push("reveal");
    const outs = next.game.outcome?.outcomes ?? [];
    const anyCorrect = outs.some((o) => o.correct === true);
    sfx.push(anyCorrect ? "correct" : "wrong");
    if (next.game.kind === "caos" || next.game.kind === "tiebreak") {
      if (next.game.winnerTeamId) cues.push({ category: "DUELLO", hosts: RISCHI, vars: teamVars(next, next.game.winnerTeamId) });
    } else cues.push({ category: anyCorrect ? "RISPOSTA_CORRETTA" : "TEMPO_SCADUTO", hosts: RACCORDO, vars: {} });
  }
  // evoluzioni
  if (next.spotlight?.kind === "evolve" && next.spotlight.eventId !== prev.spotlight?.eventId) {
    sfx.push("evolve");
    const tid = next.spotlight.teamIds[0];
    cues.push({ category: (next.spotlight.level ?? 2) >= 3 ? "EVOLUZIONE_LIV3" : "EVOLUZIONE_LIV2", hosts: RISCHI, vars: teamVars(next, tid) });
  }
  if (next.spotlight?.kind === "shield" && next.spotlight.eventId !== prev.spotlight?.eventId) sfx.push("shield");
  // classifica: sorpasso in testa o chi chiude
  if (entered === "LEADERBOARD" && !next.hideScores) {
    sfx.push("leaderboard");
    const was = leader(prev);
    const now = leader(next);
    if (now && was && now.teamId !== was.teamId) cues.push({ category: "SORPASSO", hosts: RACCORDO, vars: teamVars(next, now.teamId, was.teamId) });
    else if (now && (next.manche?.gameIndex ?? 0) % 2 === 0) cues.push({ category: "IN_VANTAGGIO", hosts: ["don-patrizio", ...RACCORDO], vars: teamVars(next, now.teamId) });
    else cues.push({ category: (next.manche?.gameIndex ?? 0) % 3 === 1 ? "PROVOCAZIONE" : "ATMOSFERA", hosts: guest((next.manche?.no ?? 0) * 4 + (next.manche?.gameIndex ?? 0)), vars: {} });
    // chi chiude la classifica a fine manche: una battuta (mai umiliante, sempre «il tavolo N»)
    const last = [...next.teams].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))[0];
    if (last && next.teams.length > 2 && next.manche?.gameIndex === next.manche?.gamesTotal) cues.push({ category: "ULTIMA_IN_CLASSIFICA", hosts: RACCORDO, vars: teamVars(next, last.teamId) });
  }
  return { cues, sfx };
}
