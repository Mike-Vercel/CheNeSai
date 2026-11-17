import { describe, expect, it } from "vitest";
import { CATALOG, MECHANIC_EXTRAS, mechanicByCode } from "@/lib/tig/games";
import { CATALOG_ROWS } from "@/lib/tig/games/catalog";
import { loadVariants } from "@/lib/tig/games/content-core";
import type { AcceptedSubmission, MechanicDef, PhaseCtx, TeamRef } from "@/lib/tig/games/contract";
import { summaryOf } from "@/lib/tig/games/extras";
import { NUOVE_MANCHE_2 } from "@/lib/tig/games/mechanics/manche-2";
import { groupsOf, median, ringOf } from "@/lib/tig/games/mechanics/m2/shared";
import { CONTENUTI_MANCHE_2 } from "../../content/tig/minigiochi/manche-2";
import { UI_MANCHE_2 } from "@/features/tig/games/manche-2";

/**
 * TAVOLI IN GUERRA! — test delle meccaniche nuove della MANCHE 2 «FREGALI TUTTI!».
 * Le proprietà comuni (vista senza soluzioni, determinismo, limiti…) le controlla già tests/unit/tig-giochi.test.ts
 * su tutte le meccaniche registrate; qui: registro, contenuti e regole specifiche di ciascuna.
 */

const CONTENT = loadVariants();
const CODES = NUOVE_MANCHE_2.map((m) => m.def.code);

function team(n: number, members = 2): TeamRef {
  return { teamId: `t${n}`, tableNo: n, members: Array.from({ length: members }, (_, i) => `t${n}m${i}`), captainId: `t${n}m0` };
}

function makeCtx(def: MechanicDef, teams: TeamRef[] = [team(1, 3), team(2, 2), team(3, 5)], seed = "m2-seed", durationMs?: number): PhaseCtx {
  return { gameInstanceId: "gi", startsAt: 1_000_000, deadlineAt: 1_000_000 + (durationMs ?? def.timerSec * 1000), teams, participants: teams.map((t) => t.teamId), seed };
}

function sub<S>(teamId: string, payload: S, elapsedMs = 5000, memberId = `${teamId}m0`): AcceptedSubmission<S> {
  return { teamId, memberId, elapsedMs, payload };
}

function m<C = unknown, S = unknown>(code: string): MechanicDef<C, S> {
  const d = mechanicByCode(code);
  if (!d) throw new Error(code);
  return d as unknown as MechanicDef<C, S>;
}

function first<C>(code: string): C {
  return CONTENT[code][0] as unknown as C;
}

const byTeam = (out: { outcomes: { teamId: string; points: number }[] }) => Object.fromEntries(out.outcomes.map((o) => [o.teamId, o.points]));
const transfersOf = (out: { outcomes: { teamId: string; transfers?: { toTeamId: string; points: number }[] }[] }) =>
  out.outcomes.flatMap((o) => (o.transfers ?? []).map((t) => ({ from: o.teamId, to: t.toTeamId, points: t.points })));

// ---------------------------------------------------------------------------
// Registro e contenuti
// ---------------------------------------------------------------------------

describe("TIG manche 2 · registro e contenuti", () => {
  it("ogni meccanica nuova è nel catalogo con numero, manche, ingresso e timer del PDF", () => {
    expect(CODES.length).toBeGreaterThan(0);
    for (const code of CODES) {
      const d = m(code);
      const row = CATALOG_ROWS.find((r) => r[1] === code)!;
      expect(row, code).toBeTruthy();
      expect(d.number).toBe(row[0]);
      expect(d.manche).toBe(2);
      expect(d.input, code).toBe(row[4]);
      expect(d.timerSec, code).toBe(row[5]);
      expect(CATALOG.find((c) => c.code === code)!.status).toBe("implementata");
      expect(UI_MANCHE_2[code], `${code}: manca la UI`).toBeTruthy();
      expect(CONTENUTI_MANCHE_2[code], `${code}: mancano i contenuti`).toBeTruthy();
    }
  });

  it("almeno 10 varianti valide per meccanica, id unici, difficoltà miste", () => {
    for (const code of CODES) {
      const vs = CONTENT[code] as unknown as { id: string; difficulty?: string }[];
      expect(vs.length, code).toBeGreaterThanOrEqual(10);
      expect(new Set(vs.map((v) => v.id)).size, code).toBe(vs.length);
      const diffs = new Set(vs.map((v) => v.difficulty));
      expect(diffs.size, `${code}: difficoltà`).toBeGreaterThanOrEqual(2);
      for (const d of diffs) expect(["facile", "media", "difficile"]).toContain(d);
    }
  });

  it("nessun tavolo nominato nei contenuti se non come «il tavolo N», niente emoji", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    const strings = (v: unknown, out: string[] = []): string[] => {
      if (typeof v === "string") out.push(v);
      else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
      else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
      return out;
    };
    for (const code of CODES) for (const s of strings(CONTENT[code])) expect(emoji.test(s), `${code}: ${s}`).toBe(false);
  });

  it("ogni meccanica regge da 1 a 24 tavoli e nel duello del Caos (2 tavoli, 45 s)", () => {
    for (const code of CODES) {
      const def = m(code);
      const extras = MECHANIC_EXTRAS[code];
      for (const n of [1, 2, 3, 7, 24]) {
        const teams = Array.from({ length: n }, (_, i) => team(i + 1, 1 + (i % 4)));
        for (const c of CONTENT[code]) {
          const ctx = makeCtx(def, teams, `s${n}`);
          def.publicView(c, ctx);
          const out = def.score({ content: c, ctx, submissions: extras.demoSubmissions(c, ctx, `d${n}`) });
          expect(out.outcomes.map((o) => o.teamId).sort()).toEqual(teams.map((t) => t.teamId).sort());
        }
      }
      // Caos: due tavoli, 45 s
      const caos = makeCtx(def, [team(4), team(9)], "caos", 45_000);
      const c = CONTENT[code][0];
      const out = def.score({ content: c, ctx: caos, submissions: extras.demoSubmissions(c, caos, "caos") });
      expect(out.outcomes).toHaveLength(2);
    }
  });
});

describe("TIG manche 2 · pezzi comuni", () => {
  it("coppie deterministiche: tutti dentro una volta, dispari in terzetto o da solo", () => {
    for (let n = 1; n <= 24; n++) {
      const ids = Array.from({ length: n }, (_, i) => `t${i}`);
      const trio = groupsOf(ids, "x", "trio");
      const solo = groupsOf(ids, "x", "solo");
      expect(trio.flat().sort()).toEqual(ids.slice().sort());
      expect(solo.flat().sort()).toEqual(ids.slice().sort());
      expect(groupsOf(ids, "x", "trio")).toEqual(trio);
      if (n % 2 === 1 && n > 1) {
        expect(trio.some((g) => g.length === 3)).toBe(true);
        expect(solo.filter((g) => g.length === 1)).toHaveLength(1);
      }
      const ring = ringOf(ids, "y");
      expect(ring.length).toBe(n > 1 ? n : 0);
      expect(new Set(ring.map((l) => l.to)).size).toBe(ring.length);
      for (const l of ring) expect(l.to).not.toBe(l.from);
    }
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(3);
    expect(median([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Regole specifiche
// ---------------------------------------------------------------------------

describe("TIG manche 2 · regole", () => {
  it("21 Caccia alla capolista: caccia +40/+10, passo +20, capolista +20 e +10 a respinto (tetto 40), mai negativi", () => {
    type C = { options: { id: string }[]; solution: { optionId: string }; balances?: Record<string, number> };
    const def = m<C, { mode: "caccia" | "passo"; optionId: string }>("caccia-alla-capolista");
    const base = first<C>("caccia-alla-capolista");
    const ok = base.solution.optionId;
    const ko = base.options.find((o) => o.id !== ok)!.id;
    const teams = [team(1), team(2), team(3), team(4), team(5), team(6)];
    const c = { ...base, balances: { t1: 300, t2: 120, t3: 80, t4: 50, t5: 10, t6: 0 } };
    const ctx = makeCtx(def as MechanicDef, teams);
    const v = def.publicView(c, ctx) as { leaders: { teamId: string }[]; drawn: boolean };
    expect(v.leaders.map((l) => l.teamId)).toEqual(["t1"]);
    expect(v.drawn).toBe(false);
    expect(JSON.stringify(v)).not.toContain("300");
    const out = def.score({
      content: c,
      ctx,
      submissions: [
        sub("t1", { mode: "caccia", optionId: ok }, 6000), // capolista: la modalità non conta
        sub("t2", { mode: "caccia", optionId: ok }, 3000), // più rapido: caccia riuscita
        sub("t3", { mode: "caccia", optionId: ok }, 9000), // giusto ma battuto
        sub("t4", { mode: "caccia", optionId: ko }, 1000), // sbagliato
        sub("t5", { mode: "passo", optionId: ok }, 2000),
        sub("t6", { mode: "caccia", optionId: ok }, 7000), // battuto
      ],
    });
    expect(byTeam(out)).toEqual({ t1: 40, t2: 40, t3: 10, t4: 0, t5: 20, t6: 10 });
    expect(summaryOf<{ hunts: { teamId: string; won: boolean }[] }>(out)!.hunts.filter((h) => h.won).map((h) => h.teamId)).toEqual(["t2"]);
    for (const o of out.outcomes) expect(o.transfers ?? []).toHaveLength(0);
    // capolista sbagliata e lenta: nessuna ricompensa; il cacciatore giusto vince
    const out2 = def.score({ content: c, ctx, submissions: [sub("t1", { mode: "passo", optionId: ko }, 1000), sub("t2", { mode: "caccia", optionId: ok }, 9000)] });
    expect(byTeam(out2)).toMatchObject({ t1: 0, t2: 40 });
    // capoliste a pari merito: bisogna batterle entrambe
    const tie = { ...base, balances: { t1: 200, t2: 200, t3: 50 } };
    const ctx3 = makeCtx(def as MechanicDef, [team(1), team(2), team(3)]);
    expect((def.publicView(tie, ctx3) as { leaders: unknown[] }).leaders).toHaveLength(2);
    const out3 = def.score({ content: tie, ctx: ctx3, submissions: [sub("t1", { mode: "passo", optionId: ok }, 2000), sub("t2", { mode: "passo", optionId: ko }, 1000), sub("t3", { mode: "caccia", optionId: ok }, 4000)] });
    expect(byTeam(out3)).toEqual({ t1: 30, t2: 0, t3: 10 });
    // senza saldi: capolista estratta col seme, sempre la stessa
    const drawn = def.publicView(base, ctx) as { leaders: { teamId: string }[]; drawn: boolean };
    expect(drawn.drawn).toBe(true);
    expect(drawn.leaders).toHaveLength(1);
    expect((def.publicView(base, ctx) as { leaders: { teamId: string }[] }).leaders).toEqual(drawn.leaders);
  });

  it("22 Furto con destrezza: due indizi giusti = furto di 40 alla vittima, uno solo = niente, nessun punto proprio", () => {
    type C = { steps: { options: { id: string }[] }[]; solution: { first: string; second: string } };
    const def = m<C, { targetId: string; first: string; second: string }>("furto-con-destrezza");
    const c = first<C>("furto-con-destrezza");
    const { first: a, second: b } = c.solution;
    const wrongB = c.steps[1].options.find((o) => o.id !== b)!.id;
    const ctx = makeCtx(def as MechanicDef, [team(1), team(2), team(3)]);
    const out = def.score({
      content: c,
      ctx,
      submissions: [sub("t1", { targetId: "t3", first: a, second: b }), sub("t2", { targetId: "t3", first: a, second: wrongB }), sub("t3", { targetId: "t3", first: a, second: b })],
    });
    expect(byTeam(out)).toEqual({ t1: 0, t2: 0, t3: 0 });
    expect(transfersOf(out)).toEqual([{ from: "t1", to: "t3", points: 40 }]); // t3 ha puntato su sé stesso: nessuna vittima
    expect(out.outcomes.find((o) => o.teamId === "t1")!.correct).toBe(true);
    expect(out.outcomes.find((o) => o.teamId === "t2")!.correct).toBe(false);
    // due tavoli: la vittima è obbligata (anche nel duello del Caos)
    const two = makeCtx(def as MechanicDef, [team(1), team(2)]);
    const out2 = def.score({ content: c, ctx: two, submissions: [sub("t1", { targetId: "boh", first: a, second: b })] });
    expect(transfersOf(out2)).toEqual([{ from: "t1", to: "t2", points: 40 }]);
  });

  it("30 Scambio di posta: si gioca la posta più bassa, chi vince il duello la prende, dispari contro il banco", () => {
    type C = { options: { id: string }[]; solution: { optionId: string } };
    const def = m<C, { stake: number; optionId: string }>("scambio-di-posta");
    const c = first<C>("scambio-di-posta");
    const ok = c.solution.optionId;
    const ko = c.options.find((o) => o.id !== ok)!.id;
    const teams = [team(1), team(2), team(3), team(4), team(5)];
    const ctx = makeCtx(def as MechanicDef, teams, "posta");
    const pairs = (def.publicView(c, ctx) as { pairs: { teamId: string }[][] }).pairs;
    expect(pairs.flat()).toHaveLength(5);
    const solo = pairs.find((g) => g.length === 1)![0].teamId;
    const [p1, p2] = pairs.filter((g) => g.length === 2);
    const subs = [
      sub(p1[0].teamId, { stake: 40, optionId: ok }, 3000),
      sub(p1[1].teamId, { stake: 20, optionId: ok }, 6000), // più lento: perde la posta (la più bassa, 20)
      sub(p2[0].teamId, { stake: 0, optionId: ok }, 2000),
      sub(p2[1].teamId, { stake: 40, optionId: ko }, 1000), // posta 0: nessuno scambio
      sub(solo, { stake: 30, optionId: ok }, 2500), // contro il banco: tempo mediano delle giuste = 3000
    ];
    const out = def.score({ content: c, ctx, submissions: subs });
    const pts = byTeam(out);
    expect(pts[p1[0].teamId]).toBe(50);
    expect(pts[p1[1].teamId]).toBe(50);
    expect(pts[p2[0].teamId]).toBe(50);
    expect(pts[p2[1].teamId]).toBe(0);
    expect(pts[solo]).toBe(80);
    expect(transfersOf(out)).toEqual([{ from: p1[0].teamId, to: p1[1].teamId, points: 20 }]);
    // il banco non paga chi è oltre il tempo mediano
    const slow = def.score({ content: c, ctx, submissions: [...subs.filter((s) => s.teamId !== solo), sub(solo, { stake: 30, optionId: ok }, 9000)] });
    expect(byTeam(slow)[solo]).toBe(50);
    // chi non invia non acconsente: posta 0
    const absent = def.score({ content: c, ctx, submissions: [sub(p1[0].teamId, { stake: 40, optionId: ok })] });
    expect(transfersOf(absent)).toEqual([]);
  });
});
