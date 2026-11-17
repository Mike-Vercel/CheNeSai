import { describe, expect, it } from "vitest";
import { MECHANIC_EXTRAS, mechanicByCode } from "@/lib/tig/games";
import { loadVariants } from "@/lib/tig/games/content-core";
import type { AcceptedSubmission, MechanicDef, PhaseCtx, TeamRef } from "@/lib/tig/games/contract";
import { IN_CORSO_MANCHE_5, NUOVE_MANCHE_5 } from "@/lib/tig/games/mechanics/manche-5";

/**
 * MANCHE 5 «TUTTO O NIENTE!» — test delle 13 meccaniche aggiunte (66–80). Le proprietà comuni (vista pubblica
 * senza soluzioni, determinismo, invii doppi, tetti) le verifica già tests/unit/tig-giochi.test.ts su tutte le
 * meccaniche registrate; qui: contenuti (almeno 10 varianti, difficoltà miste) e regole specifiche.
 */

const CONTENT = loadVariants();
const CODES = NUOVE_MANCHE_5.map((m) => m.def.code);

function team(n: number, members: number): TeamRef {
  return { teamId: `t${n}`, tableNo: n, members: Array.from({ length: members }, (_, i) => `t${n}m${i}`), captainId: `t${n}m0` };
}

function makeCtx(def: MechanicDef, teams: TeamRef[] = [team(1, 3), team(2, 2), team(3, 5)], seed = "test-seed"): PhaseCtx {
  return { gameInstanceId: "gi", startsAt: 1_000_000, deadlineAt: 1_000_000 + def.timerSec * 1000, teams, participants: teams.map((t) => t.teamId), seed };
}

function sub<S>(teamId: string, payload: S, elapsedMs = 5000, memberId = `${teamId}m0`): AcceptedSubmission<S> {
  return { teamId, memberId, elapsedMs, payload };
}

function variants<C = Record<string, unknown>>(code: string): C[] {
  return CONTENT[code] as unknown as C[];
}

function first<C = Record<string, unknown>>(code: string): C {
  return variants<C>(code)[0];
}

function m<C = unknown, S = unknown>(code: string): MechanicDef<C, S> {
  const d = mechanicByCode(code);
  if (!d) throw new Error(code);
  return d as unknown as MechanicDef<C, S>;
}

function deepStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => deepStrings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => deepStrings(x, out));
  return out;
}

const byTeam = (out: { outcomes: { teamId: string; points: number }[] }) => Object.fromEntries(out.outcomes.map((o) => [o.teamId, o.points]));

// ---------------------------------------------------------------------------
// Registro e contenuti
// ---------------------------------------------------------------------------

describe("TIG manche 5 · registro", () => {
  it("13 meccaniche nuove, numeri e codici del catalogo, tutte della manche 5", () => {
    const ALL = [...NUOVE_MANCHE_5, ...IN_CORSO_MANCHE_5];
    expect(ALL).toHaveLength(13);
    expect(ALL.map((x) => x.def.number).sort((a, b) => a - b)).toEqual([66, 67, 68, 70, 72, 73, 74, 75, 76, 77, 78, 79, 80]);
    for (const x of ALL) {
      expect(x.def.manche).toBe(5);
      expect(x.def.rule.length, x.def.code).toBeLessThanOrEqual(140);
    }
  });
});

describe.each(CODES.map((c) => [c] as const))("TIG manche 5 · contenuti di %s", (code) => {
  const def = mechanicByCode(code)!;
  const vs = variants<{ id: string; difficulty?: string; explain: string }>(code);

  it("almeno 10 varianti valide, id unici, difficoltà dichiarate e miste", () => {
    expect(vs.length).toBeGreaterThanOrEqual(10);
    expect(new Set(vs.map((v) => v.id)).size).toBe(vs.length);
    for (const v of vs) expect(def.contentSchema.safeParse(v).success, v.id).toBe(true);
    for (const v of vs) expect(["facile", "media", "difficile"], `${v.id}: difficoltà`).toContain(v.difficulty);
    expect(new Set(vs.map((v) => v.difficulty)).size, "facile, media e difficile").toBe(3);
  });

  it("niente emoji, testi puliti, spiegazione presente", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const v of vs) {
      for (const s of deepStrings(v)) {
        expect(emoji.test(s), `${v.id}: ${s}`).toBe(false);
        expect(s, `${v.id}: spazi doppi`).not.toMatch(/ {2}/);
      }
      expect(v.explain.length).toBeGreaterThan(20);
    }
  });

  it("i tavoli finti producono invii validi per ogni variante", () => {
    const extras = MECHANIC_EXTRAS[code];
    for (const v of vs) {
      const ctx = makeCtx(def);
      for (const s of extras.demoSubmissions(v, ctx, "demo")) expect(def.submissionSchema.safeParse(s.payload).success, `${v.id}`).toBe(true);
    }
  });
});

export { byTeam, first, m, makeCtx, sub, team, variants };
