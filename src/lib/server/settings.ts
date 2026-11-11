import type { Db } from "@/lib/database/db";
import type { SessionSettings } from "@/lib/validation/schemas";
import { DEFAULT_TEAM_SETTINGS, type TeamSettings } from "@/lib/game-engine/teams";
import { DEFAULT_PUBLIC_GAMES, type PublicGamesSettings } from "@/lib/game-engine/public-game";

export interface GlobalSettings {
  scoring: { correctPoints: number; wrongPenalty: number; noAnswerPenalty: number; allowNegative: boolean };
  timing: { defaultDurationSeconds: number; answerGraceMs: number; defaultVoteSeconds: number };
  players: { nicknameMaxLength: number; nicknameMinLength: number };
  leaderboard: { monthlyAggregation: "sum_points" | "placement_points"; placementPoints: number[] };
  events: { autoEventsEnabled: boolean };
  /** Gioco libero (partite create dal pubblico con un account host). */
  publicGames: PublicGamesSettings;
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  scoring: { correctPoints: 1000, wrongPenalty: 400, noAnswerPenalty: 0, allowNegative: true },
  timing: { defaultDurationSeconds: 15, answerGraceMs: 300, defaultVoteSeconds: 15 },
  players: { nicknameMaxLength: 16, nicknameMinLength: 2 },
  leaderboard: { monthlyAggregation: "sum_points", placementPoints: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] },
  events: { autoEventsEnabled: true },
  publicGames: { ...DEFAULT_PUBLIC_GAMES },
};

export async function loadGlobalSettings(db: Db): Promise<GlobalSettings> {
  const rows = await db<{ key: string; value: Record<string, unknown> }[]>`select key, value from application_settings`;
  const out: GlobalSettings = structuredClone(DEFAULT_SETTINGS);
  for (const r of rows) {
    if (r.key in out) {
      const k = r.key as keyof GlobalSettings;
      Object.assign(out[k], r.value);
    }
  }
  return out;
}

/** Impostazioni effettive di una sessione (sessione > globali). */
export interface EffectiveSessionSettings {
  correctPoints: number;
  wrongPenalty: number;
  noAnswerPenalty: number;
  durationSeconds: number;
  allowNegative: boolean;
  joinLocked: boolean;
  allowLateJoin: boolean;
  nicknameMaxLength: number;
  nicknameMinLength: number;
  autoEvents: boolean;
  palminoPool: string[];
  answerGraceMs: number;
  teams: TeamSettings;
  /** Giocatori massimi (null = nessun limite; usato dalle partite libere). */
  maxPlayers: number | null;
  /** Ruota di Palmino (ogni tanto sceglie la categoria della domanda successiva): partite libere sì, serate no di default. */
  palminoWheel: boolean;
}

export const DEFAULT_PALMINO_POOL = ["double-points", "no-penalty", "lightning", "super-bonus", "impossible-comeback"];

export function effectiveSettings(global: GlobalSettings, session: SessionSettings | null | undefined): EffectiveSessionSettings {
  const s = session ?? {};
  return {
    correctPoints: s.correctPoints ?? global.scoring.correctPoints,
    wrongPenalty: s.wrongPenalty ?? global.scoring.wrongPenalty,
    noAnswerPenalty: s.noAnswerPenalty ?? global.scoring.noAnswerPenalty,
    durationSeconds: s.durationSeconds ?? global.timing.defaultDurationSeconds,
    allowNegative: s.allowNegative ?? global.scoring.allowNegative,
    joinLocked: s.joinLocked ?? false,
    allowLateJoin: s.allowLateJoin ?? true,
    nicknameMaxLength: s.nicknameMaxLength ?? global.players.nicknameMaxLength,
    nicknameMinLength: global.players.nicknameMinLength,
    autoEvents: (s.autoEvents ?? true) && global.events.autoEventsEnabled,
    palminoPool: s.palminoPool && s.palminoPool.length > 0 ? s.palminoPool : DEFAULT_PALMINO_POOL,
    answerGraceMs: global.timing.answerGraceMs,
    teams: teamSettingsOf(s),
    maxPlayers: s.maxPlayers ?? null,
    palminoWheel: s.palminoWheel ?? false,
  };
}

/** Impostazioni squadre di una sessione (predefinito: individuale). */
export function teamSettingsOf(session: SessionSettings | null | undefined): TeamSettings {
  const t = session?.teams;
  return {
    mode: t?.mode ?? DEFAULT_TEAM_SETTINGS.mode,
    selfSelect: t?.selfSelect ?? DEFAULT_TEAM_SETTINGS.selfSelect,
    aggregation: t?.aggregation ?? DEFAULT_TEAM_SETTINGS.aggregation,
  };
}
