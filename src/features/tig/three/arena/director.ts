import type { ArenaPhase, ArenaSpotlight, ArenaTeam, MascotProps } from "../../arena-contract";

/**
 * REGIA DELL'ARENA (pura, testata): dalla fase, dal tempo trascorso nella fase e dall'evento in primo piano
 * (spotlight) decide inquadratura, atmosfera delle luci, contenuto del LED, gesto dei presentatori e azione delle
 * mascotte. Non comanda MAI il gioco: legge solo lo stato pubblico. Chi si collega a metà fase vede subito il punto
 * giusto (il tempo trascorso arriva dall'orologio allineato al server).
 */

export type Mood = "lobby" | "intro" | "manche" | "game" | "reveal" | "leaderboard" | "chaos" | "duel" | "evolve" | "break" | "final" | "awards";

export type ShotKind =
  /** gru altissima: tutta l'arena dall'alto (apertura) */
  | "establish"
  /** campo largo: tutte le torri, il palco e lo schermo */
  | "wide"
  /** torri + palco, schermo solo in parte (durante le prove, sotto l'HUD) */
  | "arena"
  /** i presentatori sul palco */
  | "stage"
  /** lo schermo LED con il palco sotto */
  | "led"
  /** alcune torri (duello, attacco, caos) */
  | "pods"
  /** una torre da vicino (evoluzione, vincitore) */
  | "pod"
  /** il podio della premiazione sul palco */
  | "podium";

export interface ShotSpec {
  kind: ShotKind;
  /** torri del soggetto (pods/pod) */
  teamIds: string[];
  /** gradi: 0 = di fronte, + = camera verso +X */
  yaw: number;
  /** gradi: + = dall'alto */
  pitch: number;
  fov: number;
  /** oscillazione lenta (gradi di yaw, periodo in secondi) */
  orbit: { amp: number; period: number } | null;
  /** secondi di smorzamento verso questa inquadratura (0 = stacco netto) */
  ease: number;
  /** scossa di camera 0..1 (allarme) — ignorata con movimento ridotto */
  shake: number;
  /** nelle inquadrature delle torri: tieni in quadro anche lo schermo LED (allarme, VS) */
  withLed: boolean;
}

export type HostAction = "idle" | "talk" | "saluto" | "presenta" | "indica" | "applauso" | "sorpresa" | "pensiero" | "vittoria";

export type LedMode = "ambient" | "logo" | "manche" | "title" | "leaderboard" | "alarm" | "vs" | "evolve" | "break" | "final" | "awards";

export interface ArenaDirection {
  shot: ShotSpec;
  mood: Mood;
  led: LedMode;
  hostAction: HostAction;
}

/** Durata (ms) degli effetti di uno spotlight dentro una fase "normale" (attacco durante una prova, ecc.). */
export const SPOT_MS: Record<ArenaSpotlight["kind"], number> = {
  duel: 6000,
  chaos: 6000,
  evolve: 5200,
  winner: 6000,
  sabotage: 4800,
  attack: 4800,
  shield: 3600,
};

/** Premiazione: istanti (ms dall'inizio del podio) in cui si svelano 3°, 2° e 1° posto (dal basso verso l'alto). */
export const AWARDS_REVEAL_MS = [1600, 4800, 8200] as const;
/** Premiazione: prima si svelano, dall'ultimo, i tavoli fuori dal podio, uno ogni AWARDS_STEP_MS; poi il podio. */
export const AWARDS_STEP_MS = 1200;

/** Ms dall'inizio della premiazione in cui comincia il podio (dopo i tavoli fuori dal podio). */
export function awardsPodiumOffset(teamCount: number): number {
  return Math.max(0, teamCount - 3) * AWARDS_STEP_MS;
}

/** Quanti posti del podio sono svelati (0..3) dopo `elapsedMs` dall'inizio della premiazione. */
export function awardsRevealed(elapsedMs: number, teamCount = 3): number {
  const off = awardsPodiumOffset(teamCount);
  let n = 0;
  for (const t of AWARDS_REVEAL_MS) if (elapsedMs >= off + t) n++;
  return n;
}

/**
 * Ms dall'inizio della premiazione in cui si svela il tavolo in posizione `pos` (1 = primo) su `teamCount`:
 * lo stesso calendario per l'arena (podio 3D) e per l'HUD della TV (classifica finale), così niente anticipa il vincitore.
 */
export function awardsRevealAt(pos: number, teamCount: number): number {
  if (pos <= 3) return awardsPodiumOffset(teamCount) + AWARDS_REVEAL_MS[Math.max(0, 3 - pos)];
  return (teamCount - pos) * AWARDS_STEP_MS;
}

/** Lo spotlight è ancora "in scena" (la fase dedicata lo tiene acceso per tutta la sua durata). */
export function spotlightLive(phase: ArenaPhase, spot: ArenaSpotlight | null, ageMs: number): boolean {
  if (!spot || spot.teamIds.length === 0) return false;
  if ((phase === "duel" && spot.kind === "duel") || (phase === "chaos" && spot.kind === "chaos") || (phase === "evolve" && spot.kind === "evolve")) return true;
  return ageMs >= 0 && ageMs < SPOT_MS[spot.kind];
}

const shot = (kind: ShotKind, over: Partial<ShotSpec> = {}): ShotSpec => ({
  kind,
  teamIds: [],
  yaw: 0,
  pitch: 14,
  fov: 38,
  orbit: null,
  ease: 1.4,
  shake: 0,
  withLed: false,
  ...over,
});

export interface DirectInput {
  phase: ArenaPhase;
  /** ms dall'inizio della fase */
  elapsedMs: number;
  spotlight: ArenaSpotlight | null;
  /** ms da quando è comparso lo spotlight corrente (eventId) */
  spotAgeMs: number;
  speaking: boolean;
  hostCount: number;
  /** squadre in gara (calendario della premiazione) */
  teamCount?: number;
}

export function directArena(inp: DirectInput): ArenaDirection {
  const t = Math.max(0, inp.elapsedMs);
  const talk = (a: HostAction): HostAction => (inp.speaking ? "talk" : a);
  const spot = inp.spotlight;
  const live = spotlightLive(inp.phase, spot, inp.spotAgeMs);
  const ids = live && spot ? spot.teamIds : [];
  const noHosts = inp.hostCount === 0;

  switch (inp.phase) {
    case "lobby":
      return {
        shot: shot("wide", { pitch: 10, orbit: { amp: 9, period: 46 }, ease: 2 }),
        mood: "lobby",
        led: "logo",
        hostAction: talk(t % 15_000 < 2600 ? "saluto" : "idle"),
      };
    case "intro":
      if (t < 3800) return { shot: shot("establish", { yaw: -18, pitch: 30, fov: 40, orbit: { amp: 10, period: 22 }, ease: t < 200 ? 0 : 2.4 }), mood: "intro", led: "logo", hostAction: "idle" };
      if (t < 6500 || noHosts) return { shot: shot("led", { pitch: 9, fov: 36, ease: 2.6 }), mood: "intro", led: "logo", hostAction: talk("saluto") };
      return { shot: shot("stage", { yaw: 8, pitch: 6, fov: 32, orbit: { amp: 3, period: 18 }, ease: 2 }), mood: "intro", led: "logo", hostAction: talk("presenta") };
    case "manche-intro":
      if (t < 900) return { shot: shot("wide", { pitch: 18, ease: 0.6 }), mood: "manche", led: "manche", hostAction: "idle" };
      if (t < 5200 || noHosts) return { shot: shot("led", { pitch: 7, fov: 34, ease: 1.8 }), mood: "manche", led: "manche", hostAction: talk("indica") };
      return { shot: shot("stage", { yaw: -10, pitch: 5, fov: 32, orbit: { amp: 2, period: 16 }, ease: 1.4 }), mood: "manche", led: "manche", hostAction: talk("presenta") };
    case "game":
      if (ids.length) return spotOverlay(spot!, inp, "game", "title");
      return { shot: shot("arena", { pitch: 10, fov: 38, orbit: { amp: 3.5, period: 34 }, ease: 2 }), mood: "game", led: "title", hostAction: talk(t % 20_000 > 16_000 ? "pensiero" : "idle") };
    case "reveal":
      if (ids.length) return spotOverlay(spot!, inp, "reveal", "title");
      if (t < 2400) return { shot: shot("led", { pitch: 8, fov: 34, ease: 0.9 }), mood: "reveal", led: "title", hostAction: talk("sorpresa") };
      return { shot: shot("arena", { pitch: 10, fov: 38, orbit: { amp: 5, period: 26 }, ease: 1.6 }), mood: "reveal", led: "title", hostAction: talk("idle") };
    case "leaderboard":
      if (ids.length) return spotOverlay(spot!, inp, "leaderboard", "leaderboard");
      return {
        shot: shot("wide", { pitch: 8, fov: 38, orbit: { amp: 5, period: 28 }, ease: 1.6 }),
        mood: "leaderboard",
        led: "leaderboard",
        hostAction: talk(t > 800 && t < 3400 ? "indica" : "idle"),
      };
    case "chaos":
      if (t < 2600 || !ids.length) return { shot: shot("led", { pitch: 8, fov: 36, ease: 0.5, shake: 1 }), mood: "chaos", led: "alarm", hostAction: talk("sorpresa") };
      return { shot: shot("pods", { teamIds: ids, pitch: 12, fov: 36, orbit: { amp: 6, period: 9 }, ease: 1.1, shake: 0.35, withLed: true }), mood: "chaos", led: "alarm", hostAction: talk("indica") };
    case "duel":
      if (t < 2400 || !ids.length) return { shot: shot("led", { pitch: 8, fov: 34, ease: 0.8 }), mood: "duel", led: "vs", hostAction: talk("indica") };
      return { shot: shot("pods", { teamIds: ids, pitch: 11, fov: 34, orbit: { amp: 8, period: 12 }, ease: 1.3, withLed: true }), mood: "duel", led: "vs", hostAction: talk("idle") };
    case "evolve":
      if (!ids.length) return { shot: shot("wide", { pitch: 15, ease: 1.4 }), mood: "evolve", led: "evolve", hostAction: talk("idle") };
      if (t < 600) return { shot: shot("pods", { teamIds: ids, pitch: 14, fov: 36, ease: 0.8 }), mood: "evolve", led: "evolve", hostAction: talk("sorpresa") };
      return { shot: shot("pod", { teamIds: ids, pitch: 14, fov: 32, orbit: { amp: 16, period: 14 }, ease: 1.5 }), mood: "evolve", led: "evolve", hostAction: talk(t > 1800 ? "applauso" : "sorpresa") };
    case "break":
      return { shot: shot("wide", { pitch: 10, fov: 40, orbit: { amp: 18, period: 70 }, ease: 2.5 }), mood: "break", led: "break", hostAction: talk("idle") };
    case "final":
      if (ids.length) return spotOverlay(spot!, inp, "final", "final");
      if (t < 5000) return { shot: shot("led", { pitch: 8, fov: 34, ease: 2.2 }), mood: "final", led: "final", hostAction: talk("idle") };
      return { shot: shot("arena", { pitch: 12, fov: 36, orbit: { amp: 4, period: 30 }, ease: 2.4 }), mood: "final", led: "final", hostAction: talk("pensiero") };
    case "awards": {
      const shown = awardsRevealed(t, inp.teamCount);
      // prima del podio (tavoli fuori dal podio svelati dall'HUD) la camera resta sullo schermo
      const off = awardsPodiumOffset(inp.teamCount ?? 3);
      if (t < off + 1400) return { shot: shot("led", { pitch: 8, fov: 34, ease: 1.2 }), mood: "awards", led: "awards", hostAction: talk("presenta") };
      return {
        shot: shot("podium", { pitch: t > off + 10_500 ? 7 : 9, fov: 34, orbit: shown >= 3 ? { amp: 14, period: 16 } : { amp: 3, period: 18 }, ease: 1.8, withLed: t < off + 10_500 }),
        mood: "awards",
        led: "awards",
        hostAction: talk(shown >= 3 ? "applauso" : shown > 0 ? "presenta" : "idle"),
      };
    }
  }
}

/** Evento in primo piano dentro una fase "normale": la camera va sulle torri coinvolte, poi torna. */
function spotOverlay(spot: ArenaSpotlight, inp: DirectInput, mood: Mood, led: LedMode): ArenaDirection {
  const ids = spot.teamIds;
  const single = ids.length === 1;
  const kind = single ? "pod" : "pods";
  const host: HostAction = inp.speaking ? "talk" : spot.kind === "winner" ? "applauso" : spot.kind === "shield" ? "idle" : "sorpresa";
  return {
    shot: shot(kind, { teamIds: ids, pitch: single ? 10 : 15, fov: single ? 32 : 36, orbit: { amp: single ? 10 : 5, period: 12 }, ease: 0.9, shake: spot.kind === "attack" || spot.kind === "sabotage" ? 0.25 : 0 }),
    mood: spot.kind === "winner" ? "awards" : spot.kind === "evolve" ? "evolve" : mood,
    led,
    hostAction: host,
  };
}

/**
 * Azione della mascotte di una squadra (procedurale sul segnaposto, clip sui modelli veri quando ci saranno).
 * Mai umiliazioni: «sad» solo per un attimo dopo un colpo subito o una perdita di punti.
 */
export function mascotActionFor(input: {
  team: Pick<ArenaTeam, "teamId" | "rank" | "online">;
  phase: ArenaPhase;
  elapsedMs: number;
  spotlight: ArenaSpotlight | null;
  spotAgeMs: number;
  /** ultimo cambio di punti e sua età (s) */
  delta: number;
  deltaAge: number;
  /** posti del podio svelati (premiazione) */
  podiumRank?: number | null;
  /** squadre in gara (calendario della premiazione) */
  teamCount?: number;
}): MascotProps["action"] {
  const { team, phase, spotlight: spot, spotAgeMs: age } = input;
  if (!team.online) return "idle";
  const live = spotlightLive(phase, spot, age);
  if (live && spot) {
    const i = spot.teamIds.indexOf(team.teamId);
    if (i >= 0) {
      switch (spot.kind) {
        case "attack":
        case "sabotage":
          if (i === 0) return age < 1800 ? "attack" : "cheer";
          // il colpo arriva quando la cometa tocca il bersaglio (SpotFx: FLY.end)
          return age > 1250 && age < 3000 ? "hit" : age >= 3000 && age < 4000 ? "sad" : "idle";
        case "shield":
          return age < 1600 ? "cheer" : "idle";
        case "winner":
          return "win";
        case "evolve":
          return age < 3200 ? "evolve" : "cheer";
        case "duel":
          return phase === "duel" ? (Math.floor(age / 2600) % 2 === i ? "attack" : "idle") : "idle";
        case "chaos":
          return age < 2600 ? "idle" : "attack";
      }
    }
  }
  if (phase === "awards" && input.podiumRank) {
    const shown = awardsRevealed(input.elapsedMs, input.teamCount);
    // dal basso: si svela il 3° (rank 3) per primo
    if (input.podiumRank >= 4 - shown) return input.podiumRank === 1 && shown >= 3 ? "win" : "cheer";
    return "idle";
  }
  if (input.deltaAge < 2.2 && input.delta !== 0 && (phase === "reveal" || phase === "leaderboard" || phase === "game" || phase === "final")) return input.delta > 0 ? "cheer" : "sad";
  if (phase === "leaderboard" && team.rank === 1 && input.elapsedMs < 4000) return "cheer";
  return "idle";
}
