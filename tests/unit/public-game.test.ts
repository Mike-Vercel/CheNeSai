import { describe, expect, it } from "vitest";
import {
  computeQuota,
  DEFAULT_PUBLIC_GAMES,
  defaultRoundsFor,
  maxRoundsFor,
  PUBLIC_MIN_PER_ROUND,
  PUBLIC_TOTAL_OPTIONS,
  publicGameSchema,
  usernameKey,
  validateUsername,
} from "@/lib/game-engine/public-game";
import { composeQuestions, freshnessOf, poolStats, type ComposeCandidate } from "@/lib/game-engine/compose";
import { isLocalSupabaseUrl, safeNextPath } from "@/lib/auth/next-path";

describe("gioco libero: domande e round", () => {
  it("al massimo 5 round e almeno 3 domande per round", () => {
    expect(maxRoundsFor(10)).toBe(3);
    expect(maxRoundsFor(15)).toBe(5);
    expect(maxRoundsFor(20)).toBe(5);
    expect(maxRoundsFor(30)).toBe(5);
    expect(maxRoundsFor(3)).toBe(1);
    expect(maxRoundsFor(1)).toBe(1);
    for (const t of PUBLIC_TOTAL_OPTIONS) {
      expect(Math.floor(t / maxRoundsFor(t))).toBeGreaterThanOrEqual(PUBLIC_MIN_PER_ROUND);
      expect(defaultRoundsFor(t)).toBeLessThanOrEqual(maxRoundsFor(t));
    }
  });

  it("accetta solo i totali proposti e round coerenti", () => {
    expect(publicGameSchema.safeParse({ totalQuestions: 15, rounds: 3 }).success).toBe(true);
    expect(publicGameSchema.parse({ totalQuestions: 15, rounds: 3 }).mix).toBe("bilanciata");
    expect(publicGameSchema.safeParse({ totalQuestions: 12, rounds: 3 }).success).toBe(false);
    expect(publicGameSchema.safeParse({ totalQuestions: 10, rounds: 4 }).success).toBe(false);
    expect(publicGameSchema.safeParse({ totalQuestions: 30, rounds: 6 }).success).toBe(false);
    expect(publicGameSchema.safeParse({ totalQuestions: 30, rounds: 0 }).success).toBe(false);
    expect(publicGameSchema.safeParse({ totalQuestions: 20, rounds: 2, mix: "difficile" }).success).toBe(true);
    expect(publicGameSchema.safeParse({ totalQuestions: 20, rounds: 2, mix: "impossibile" }).success).toBe(false);
  });
});

describe("gioco libero: quota", () => {
  it("predefinito: partite illimitate", () => {
    expect(DEFAULT_PUBLIC_GAMES.gamesPerAccount).toBe(0);
    expect(computeQuota(DEFAULT_PUBLIC_GAMES, 50, false)).toEqual({ limit: null, used: 50, remaining: null, canCreate: true });
  });

  it("con un limite impostato dal super admin", () => {
    expect(computeQuota({ gamesPerAccount: 3 }, 0, false)).toMatchObject({ limit: 3, remaining: 3, canCreate: true });
    expect(computeQuota({ gamesPerAccount: 3 }, 2, false)).toMatchObject({ remaining: 1, canCreate: true });
    expect(computeQuota({ gamesPerAccount: 3 }, 3, false)).toMatchObject({ remaining: 0, canCreate: false });
    expect(computeQuota({ gamesPerAccount: 3 }, 9, false)).toMatchObject({ remaining: 0, canCreate: false });
  });

  it("admin e super admin senza limiti", () => {
    expect(computeQuota({ gamesPerAccount: 3 }, 10, true)).toMatchObject({ limit: null, remaining: null, canCreate: true });
  });
});

describe("gioco libero: username", () => {
  it("regole", () => {
    expect(validateUsername("mario_rossi")).toMatchObject({ ok: true, username: "mario_rossi", key: "mario_rossi" });
    expect(validateUsername("  Mario.R  ")).toMatchObject({ ok: true, username: "Mario.R", key: "mario.r" });
    expect(validateUsername("ab")).toMatchObject({ ok: false, issue: "length" });
    expect(validateUsername("a".repeat(21))).toMatchObject({ ok: false, issue: "length" });
    expect(validateUsername("mario rossi")).toMatchObject({ ok: false, issue: "chars" });
    expect(validateUsername("niccolò")).toMatchObject({ ok: false, issue: "chars" });
    expect(validateUsername("mario-r")).toMatchObject({ ok: false, issue: "chars" });
    expect(validateUsername(".mario")).toMatchObject({ ok: false, issue: "dots" });
    expect(validateUsername("mario.")).toMatchObject({ ok: false, issue: "dots" });
    expect(validateUsername("ma..rio")).toMatchObject({ ok: false, issue: "dots" });
    expect(validateUsername("Admin")).toMatchObject({ ok: false, issue: "reserved" });
    expect(validateUsername("REGIA")).toMatchObject({ ok: false, issue: "reserved" });
  });

  it("unicità senza distinzione di maiuscole", () => {
    expect(usernameKey("MarioRossi")).toBe(usernameKey("mariorossi"));
  });
});

describe("composizione: domande già viste dall'host", () => {
  const cand = (id: string, extra: Partial<ComposeCandidate> = {}): ComposeCandidate => ({ id, category: `C${id}`, difficulty: 3, lastPlayedAt: null, plannedElsewhere: false, ...extra });

  it("le domande già viste dall'host sono l'ultima scelta", () => {
    expect(freshnessOf({ lastPlayedAt: null, plannedElsewhere: false, seenByHost: true })).toBe("vista");
    expect(freshnessOf({ lastPlayedAt: "2026-01-01T00:00:00Z", plannedElsewhere: true, seenByHost: true })).toBe("vista");
    const candidates = [
      cand("a", { seenByHost: true }),
      cand("b", { seenByHost: true }),
      cand("c", { lastPlayedAt: "2026-01-01T00:00:00Z" }),
      cand("d"),
      cand("e", { plannedElsewhere: true }),
    ];
    const r = composeQuestions({ candidates, rounds: [{ count: 3 }], mix: "bilanciata", seed: 1 });
    const ids = r.rounds[0].map((p) => p.questionId).sort();
    expect(ids).toEqual(["c", "d", "e"]);
    expect(r.summary).toMatchObject({ fresh: 1, repeats: 1, planned: 1, seen: 0, missing: 0 });
  });

  it("prima le mai giocate tra quelle nuove per l'host, poi le viste se l'archivio non basta", () => {
    const candidates = [cand("a", { seenByHost: true }), cand("b"), cand("c", { lastPlayedAt: "2026-01-01T00:00:00Z" })];
    const r = composeQuestions({ candidates, rounds: [{ count: 3 }], mix: "bilanciata", seed: "x" });
    expect(r.rounds[0].map((p) => p.freshness).sort()).toEqual(["giocata", "nuova", "vista"]);
    expect(r.summary).toMatchObject({ fresh: 1, repeats: 1, seen: 1 });
    expect(poolStats(candidates)).toMatchObject({ usable: 3, fresh: 1, played: 1, seen: 1 });
  });
});

describe("percorsi di ritorno dopo l'accesso", () => {
  it("solo percorsi interni", () => {
    expect(safeNextPath("/gioca/partita/abc")).toBe("/gioca/partita/abc");
    expect(safeNextPath(null)).toBe("/gioca");
    expect(safeNextPath("https://evil.example")).toBe("/gioca");
    expect(safeNextPath("//evil.example")).toBe("/gioca");
    expect(safeNextPath("/\\evil.example")).toBe("/gioca");
    expect(safeNextPath("/admin")).toBe("/gioca");
    expect(safeNextPath("/api/admin/settings")).toBe("/gioca");
  });

  it("riconosce Supabase locale", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:55321")).toBe(true);
    expect(isLocalSupabaseUrl("https://abc.supabase.co")).toBe(false);
    expect(isLocalSupabaseUrl(undefined)).toBe(false);
  });
});
