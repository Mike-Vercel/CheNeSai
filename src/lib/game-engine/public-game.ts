import { z } from "zod";
import { DIFFICULTY_MIXES } from "./compose";

/**
 * Gioco libero: regole pure (senza database) per le partite create dal pubblico.
 * - quante domande e quanti round si possono scegliere
 * - username degli account host
 * - quota di partite per account
 */

/** Domande totali proposte nel wizard. */
export const PUBLIC_TOTAL_OPTIONS = [10, 15, 20, 30] as const;
export const PUBLIC_MAX_ROUNDS = 5;
/** Ogni round deve avere almeno queste domande. */
export const PUBLIC_MIN_PER_ROUND = 3;

/** Numero massimo di round per un totale di domande (ogni round ≥ 3 domande, al massimo 5 round). */
export function maxRoundsFor(total: number): number {
  return Math.max(1, Math.min(PUBLIC_MAX_ROUNDS, Math.floor(total / PUBLIC_MIN_PER_ROUND)));
}

/** Round proposti di default: circa 5 domande per round. */
export function defaultRoundsFor(total: number): number {
  return Math.min(maxRoundsFor(total), Math.max(1, Math.round(total / 5)));
}

export const publicGameSchema = z
  .object({
    totalQuestions: z
      .number()
      .int()
      .refine((n) => (PUBLIC_TOTAL_OPTIONS as readonly number[]).includes(n), { message: `Scegli tra ${PUBLIC_TOTAL_OPTIONS.join(", ")} domande` }),
    rounds: z.number().int().min(1).max(PUBLIC_MAX_ROUNDS),
    mix: z.enum(DIFFICULTY_MIXES).default("bilanciata"),
  })
  .superRefine((v, ctx) => {
    if (v.rounds > maxRoundsFor(v.totalQuestions)) {
      ctx.addIssue({
        code: "custom",
        path: ["rounds"],
        message: `Con ${v.totalQuestions} domande al massimo ${maxRoundsFor(v.totalQuestions)} round (almeno ${PUBLIC_MIN_PER_ROUND} domande per round)`,
      });
    }
  });
export type PublicGameOptions = z.output<typeof publicGameSchema>;

// ---------------------------------------------------------------------------
// Username degli account host
// ---------------------------------------------------------------------------
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Nomi riservati (sembrerebbero account ufficiali). */
const RESERVED = new Set([
  "admin",
  "administrator",
  "amministratore",
  "regia",
  "sistema",
  "system",
  "root",
  "staff",
  "supporto",
  "support",
  "moderatore",
  "professore",
  "regina",
  "palmino",
  "chenesai",
  "che_ne_sai",
  "che.ne.sai",
]);

export type UsernameIssue = "length" | "chars" | "dots" | "reserved";

export type UsernameCheck = { ok: true; username: string; key: string } | { ok: false; issue: UsernameIssue; message: string };

/** Chiave di unicità (senza distinzione maiuscole/minuscole), uguale all'indice lower(username) del database. */
export function usernameKey(u: string): string {
  return u.trim().toLowerCase();
}

/** 3–20 caratteri: lettere, numeri, underscore e punto (niente punto all'inizio, alla fine o doppio). */
export function validateUsername(raw: string): UsernameCheck {
  const u = (raw ?? "").trim();
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) {
    return { ok: false, issue: "length", message: `Lo username deve avere da ${USERNAME_MIN} a ${USERNAME_MAX} caratteri` };
  }
  if (!/^[A-Za-z0-9_.]+$/.test(u)) {
    return { ok: false, issue: "chars", message: "Solo lettere senza accenti, numeri, underscore (_) e punto (.)" };
  }
  if (u.startsWith(".") || u.endsWith(".") || u.includes("..")) {
    return { ok: false, issue: "dots", message: "Il punto non può stare all'inizio, alla fine o due volte di fila" };
  }
  if (RESERVED.has(usernameKey(u))) {
    return { ok: false, issue: "reserved", message: "Questo username è riservato: scegline un altro" };
  }
  return { ok: true, username: u, key: usernameKey(u) };
}

// ---------------------------------------------------------------------------
// Quota partite per account
// ---------------------------------------------------------------------------
export interface PublicGamesSettings {
  /** Interruttore generale "Gioco libero aperto al pubblico". */
  enabled: boolean;
  /** Partite per account (0 = illimitate). */
  gamesPerAccount: number;
  /** Giocatori massimi per partita libera (0 = illimitati, "finché regge"). */
  maxPlayers: number;
}

export const DEFAULT_PUBLIC_GAMES: PublicGamesSettings = { enabled: true, gamesPerAccount: 0, maxPlayers: 0 };

/** Limite da scrivere nelle impostazioni della partita: null = nessun limite. */
export function publicMaxPlayers(settings: Pick<PublicGamesSettings, "maxPlayers">): number | null {
  return settings.maxPlayers > 0 ? settings.maxPlayers : null;
}

export interface QuotaInfo {
  /** null = illimitate */
  limit: number | null;
  used: number;
  /** null = illimitate */
  remaining: number | null;
  canCreate: boolean;
}

/** Quota di un account: admin e super admin non hanno limiti; 0 nelle impostazioni = illimitate. */
export function computeQuota(settings: Pick<PublicGamesSettings, "gamesPerAccount">, used: number, isAdmin: boolean): QuotaInfo {
  const limit = isAdmin || settings.gamesPerAccount <= 0 ? null : settings.gamesPerAccount;
  const remaining = limit === null ? null : Math.max(0, limit - used);
  return { limit, used, remaining, canCreate: remaining === null || remaining > 0 };
}
