import { describe, expect, it } from "vitest";
import { MECHANIC_EXTRAS, MECHANICS, mechanicByCode } from "@/lib/tig/games";
import { loadVariants } from "@/lib/tig/games/content-core";
import type { AcceptedSubmission, MechanicDef, PhaseCtx, TeamRef } from "@/lib/tig/games/contract";
import { summaryOf } from "@/lib/tig/games/extras";
import { NUOVE_MANCHE_3 } from "@/lib/tig/games/mechanics/manche-3";
import { UI_MANCHE_3 } from "@/features/tig/games/manche-3";
import { CONTENUTI_MANCHE_3 } from "../../content/tig/minigiochi/manche-3";

/**
 * MANCHE 3 «IL PUB DECIDE!» — meccaniche nuove (34, 36, 37, 38, 40, 41, 43, 44, 45, 46, 47, 48).
 * Le proprietà comuni (vista pubblica senza soluzioni, determinismo, limiti…) sono già in tig-giochi.test.ts:
 * qui le regole di punteggio di ciascuna, l'equità (un voto per tavolo / percentuale) e la completezza.
 */

const CONTENT = loadVariants();

function team(n: number, members: number, captain = 0): TeamRef {
  const ids = Array.from({ length: members }, (_, i) => `t${n}m${i}`);
  return { teamId: `t${n}`, tableNo: n, members: ids, captainId: ids[captain] ?? null };
}

function makeCtx(def: MechanicDef, teams: TeamRef[] = [team(1, 3), team(2, 2), team(3, 5)], seed = "test-seed"): PhaseCtx {
  return { gameInstanceId: "gi", startsAt: 1_000_000, deadlineAt: 1_000_000 + def.timerSec * 1000, teams, participants: teams.map((t) => t.teamId), seed };
}

function sub<S>(teamId: string, payload: S, elapsedMs = 5000, memberId = `${teamId}m0`): AcceptedSubmission<S> {
  return { teamId, memberId, elapsedMs, payload };
}

function m<C = unknown, S = unknown>(code: string): MechanicDef<C, S> {
  const d = mechanicByCode(code);
  if (!d) throw new Error(code);
  return d as unknown as MechanicDef<C, S>;
}

function variants<C>(code: string): C[] {
  return CONTENT[code] as unknown as C[];
}

function first<C>(code: string): C {
  return variants<C>(code)[0];
}

const byTeam = (out: { outcomes: { teamId: string; points: number }[] }) => Object.fromEntries(out.outcomes.map((o) => [o.teamId, o.points]));
const labelOf = (out: { outcomes: { teamId: string; label: string }[] }, id: string) => out.outcomes.find((o) => o.teamId === id)!.label;

const CODES = [
  ["chi-ha-votato-cosa", 34],
  ["il-capitano-ci-conosce", 36],
  ["quanto-siete-prevedibili", 37],
] as const;

describe("TIG manche 3 · registro e contenuti", () => {
  it.each(CODES)("%s (n. %i) è registrata con UI, contenuti e almeno 10 varianti", (code, n) => {
    const d = mechanicByCode(code)!;
    expect(d, code).toBeTruthy();
    expect(d.number).toBe(n);
    expect(d.manche).toBe(3);
    expect(NUOVE_MANCHE_3.some((x) => x.def.code === code)).toBe(true);
    expect(UI_MANCHE_3[code]?.Player).toBeTypeOf("function");
    expect(UI_MANCHE_3[code]?.Tv).toBeTypeOf("function");
    expect(CONTENUTI_MANCHE_3[code]?.length).toBeGreaterThanOrEqual(10);
    const vs = CONTENT[code];
    expect(vs.length).toBeGreaterThanOrEqual(10);
    // difficoltà miste, chiavi stabili
    const diffs = new Set(vs.map((v) => (v as { difficulty?: string }).difficulty));
    expect(diffs.has("facile") && diffs.has("media") && diffs.has("difficile"), code).toBe(true);
    for (const v of vs) expect(v.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    expect(MECHANIC_EXTRAS[code]?.demoSubmissions).toBeTypeOf("function");
  });

  it("le varianti non finiscono nel bundle del browser (niente `variants` nelle definizioni)", () => {
    for (const x of NUOVE_MANCHE_3) expect((x.def as { variants?: unknown }).variants).toBeUndefined();
  });

  it("le meccaniche del registro sono tutte della manche 3", () => {
    for (const x of NUOVE_MANCHE_3) expect(MECHANICS.find((d) => d.code === x.def.code)?.manche).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 34 · Chi ha votato cosa?
// ---------------------------------------------------------------------------

describe("34 Chi ha votato cosa?", () => {
  type C = { questions: [{ options: { id: string }[] }, { options: { id: string }[] }] };
  const def = m<C, { vote: [string, string]; guess: [string, string] }>("chi-ha-votato-cosa");
  const c = first<C>("chi-ha-votato-cosa");
  const [a1, a2] = c.questions[0].options.map((o) => o.id);
  const [b1, b2] = c.questions[1].options.map((o) => o.id);

  it("coppia giusta 100, mezza coppia 30, due metà senza coppia 60; un voto per tavolo", () => {
    // voti: (a1,b1) ×2, (a2,b2) ×1 → coppia vincente a1+b1; per domanda vincono a1 e b1
    const ctx = makeCtx(def, [team(1, 8), team(2, 2), team(3, 2), team(4, 2)]);
    const out = def.score({
      content: c,
      ctx,
      submissions: [sub("t1", { vote: [a2, b2], guess: [a1, b1] }), sub("t2", { vote: [a1, b1], guess: [a1, b2] }), sub("t3", { vote: [a1, b1], guess: [a2, b2] }), sub("t4", { vote: [a1, b1], guess: [a2, b1] })],
    });
    // coppie: a1+b1 = 3, a2+b2 = 1 → vince a1+b1 (il tavolo da 8 conta come quello da 2)
    expect(byTeam(out)).toEqual({ t1: 100, t2: 30, t3: 0, t4: 30 });
    const s = summaryOf<{ winners: string[]; tables: number; combos: { key: string; n: number }[] }>(out)!;
    expect(s.winners).toEqual([`${a1}+${b1}`]);
    expect(s.tables).toBe(4);
    expect(s.combos.reduce((x, k) => x + k.n, 0)).toBe(4);
    // due metà giuste ma coppia sbagliata: 60
    const ctx5 = makeCtx(def, [1, 2, 3, 4, 5].map((n) => team(n, 2)));
    const votes: [string, string][] = [
      [a1, b2],
      [a1, b2],
      [a2, b1],
      [a2, b1],
      [a1, b1],
    ];
    const out5 = def.score({ content: c, ctx: ctx5, submissions: votes.map((v, i) => sub(`t${i + 1}`, { vote: v, guess: i === 4 ? [a1, b1] : v })) });
    expect(byTeam(out5)).toEqual({ t1: 100, t2: 100, t3: 100, t4: 100, t5: 60 });
  });

  it("parità tra coppie: valgono tutte quelle a pari merito", () => {
    const ctx = makeCtx(def, [team(1, 2), team(2, 2)]);
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { vote: [a1, b1], guess: [a1, b1] }), sub("t2", { vote: [a2, b2], guess: [a2, b2] })] });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 100 });
  });

  it("invii con risposte inesistenti non contano", () => {
    const out = def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { vote: ["zzz", b1], guess: [a1, b1] })] });
    expect(byTeam(out).t1).toBe(0);
    expect(labelOf(out, "t1")).toBe("Nessuna risposta");
  });
});

// ---------------------------------------------------------------------------
// 36 · Il capitano ci conosce?
// ---------------------------------------------------------------------------

describe("36 Il capitano ci conosce?", () => {
  type C = { options: { id: string }[] };
  type S = { optionId?: string; guess?: string };
  const def = m<C, S>("il-capitano-ci-conosce");
  const c = first<C>("il-capitano-ci-conosce");
  const [x, y, z] = c.options.map((o) => o.id);

  it("previsione giusta 100, parità 60 se tra le pari, sbagliata 0; il capitano non vota", () => {
    const t1 = team(1, 4); // capitano + 3 compagni
    const t2 = team(2, 3); // capitano + 2 compagni in parità
    const t3 = team(3, 3);
    const ctx = makeCtx(def, [t1, t2, t3]);
    const out = def.score({
      content: c,
      ctx,
      submissions: [
        sub("t1", { guess: x, optionId: y }, 1000, "t1m0"), // il voto del capitano viene ignorato
        sub("t1", { optionId: x }, 1000, "t1m1"),
        sub("t1", { optionId: x }, 1000, "t1m2"),
        sub("t1", { optionId: y }, 1000, "t1m3"),
        sub("t2", { guess: y }, 1000, "t2m0"),
        sub("t2", { optionId: x }, 1000, "t2m1"),
        sub("t2", { optionId: y }, 1000, "t2m2"),
        sub("t3", { guess: z }, 1000, "t3m0"),
        sub("t3", { optionId: x }, 1000, "t3m1"),
        sub("t3", { optionId: x }, 1000, "t3m2"),
      ],
    });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 60, t3: 0 });
    const s = summaryOf<{ teams: { teamId: string; share: number; top: string[] }[] }>(out)!;
    expect(s.teams.find((r) => r.teamId === "t1")!.share).toBeCloseTo(2 / 3, 2);
    expect(s.teams.find((r) => r.teamId === "t2")!.top.sort()).toEqual([x, y].sort());
  });

  it("conta la quota, non quanti siete: 2 su 2 e 6 su 6 valgono uguale", () => {
    const small = team(1, 3);
    const big = team(2, 7);
    const ctx = makeCtx(def, [small, big]);
    const votes = [small, big].flatMap((t) => [sub(t.teamId, { guess: x }, 500, t.members[0]), ...t.members.slice(1).map((mm) => sub(t.teamId, { optionId: x }, 900, mm))]);
    expect(byTeam(def.score({ content: c, ctx, submissions: votes }))).toEqual({ t1: 100, t2: 100 });
  });

  it("previsioni di chi non è capitano ignorate; senza previsione 0; un solo telefono 50", () => {
    const t1 = team(1, 3);
    const ctx = makeCtx(def, [t1, team(2, 1)]);
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { guess: x }, 100, "t1m1"), sub("t1", { optionId: x }, 200, "t1m2"), sub("t2", { guess: y }, 100, "t2m0")] });
    expect(byTeam(out)).toEqual({ t1: 0, t2: 50 });
    expect(labelOf(out, "t1")).toBe("Il capitano non ha previsto");
  });

  it("il capitano assente dal registro: fa da capitano il primo membro; vista privata col ruolo", () => {
    const t1: TeamRef = { ...team(1, 3), captainId: null };
    const ctx = makeCtx(def, [t1]);
    const mv = (id: string, i: number) => def.memberView!(c, { ...ctx, teamId: "t1", memberId: id, memberIndex: i }) as { role: string; options: { id: string }[]; voters: number };
    expect(mv("t1m0", 0).role).toBe("capitano");
    expect(mv("t1m1", 1).role).toBe("giocatore");
    expect(mv("t1m1", 1).options.map((o) => o.id).sort()).toEqual(c.options.map((o) => o.id).sort());
    expect(mv("t1m0", 0).voters).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 37 · Quanto siete prevedibili
// ---------------------------------------------------------------------------

describe("37 Quanto siete prevedibili", () => {
  const def = m<unknown, { yes: boolean; percent: number }>("quanto-siete-prevedibili");
  const c = first<unknown>("quanto-siete-prevedibili");

  it("punti dalla distanza dalla percentuale reale (un voto per tavolo)", () => {
    // 3 sì su 4 tavoli = 75%
    const ctx = makeCtx(def, [team(1, 8), team(2, 2), team(3, 2), team(4, 1)]);
    const out = def.score({
      content: c,
      ctx,
      submissions: [sub("t1", { yes: true, percent: 75 }), sub("t2", { yes: true, percent: 77 }), sub("t3", { yes: true, percent: 55 }), sub("t4", { yes: false, percent: 0 })],
    });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 100, t3: 55, t4: 0 });
    expect(summaryOf<{ actual: number; yes: number; tables: number }>(out)).toMatchObject({ actual: 75, yes: 3, tables: 4 });
    expect(labelOf(out, "t3")).toBe("Scarto 20 punti");
  });

  it("i punti scendono con lo scarto e non sono mai negativi", () => {
    const ctx = makeCtx(def, [team(1, 2)]);
    const at = (p: number) => byTeam(def.score({ content: c, ctx, submissions: [sub("t1", { yes: true, percent: p })] })).t1;
    expect(at(100)).toBe(100);
    expect(at(98)).toBe(100);
    expect(at(90)).toBe(80);
    expect(at(0)).toBe(0);
  });
});
