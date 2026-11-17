import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

  it("ogni meccanica regge da 1 a 12 tavoli e nel duello del Caos (2 tavoli, 45 s)", () => {
    for (const code of CODES) {
      const def = m(code);
      const extras = MECHANIC_EXTRAS[code];
      for (const n of [1, 2, 3, 7, 12]) {
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
    for (let n = 1; n <= 12; n++) {
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
  it("le 12 meccaniche della manche 2 da fare sono tutte registrate", () => {
    expect(CODES.slice().sort()).toEqual(
      ["taglia-il-tempo", "contrattacco", "caccia-alla-capolista", "furto-con-destrezza", "scegli-il-terreno", "la-trappola", "il-patto-di-60-secondi", "la-sfida-incrociata", "bottone-del-caos", "scambio-di-posta", "falso-vantaggio", "ultima-parola"].sort(),
    );
  });

  it("25 Scegli il terreno: +50 a turno, al secondo turno la categoria appena giocata non vale", () => {
    type C = { terreni: { options: { id: string }[] }[]; solution: { terreni: string[] } };
    const def = m<C, { first: number; firstAnswer: string; second: number; secondAnswer: string }>("scegli-il-terreno");
    const c = first<C>("scegli-il-terreno");
    const s = c.solution.terreni;
    const ko = (i: number) => c.terreni[i].options.find((o) => o.id !== s[i])!.id;
    const ctx = makeCtx(def as MechanicDef, [team(1), team(2), team(3), team(4)]);
    const out = def.score({
      content: c,
      ctx,
      submissions: [
        sub("t1", { first: 0, firstAnswer: s[0], second: 2, secondAnswer: s[2] }),
        sub("t2", { first: 1, firstAnswer: s[1], second: 0, secondAnswer: ko(0) }),
        sub("t3", { first: 1, firstAnswer: s[1], second: 1, secondAnswer: s[1] }), // stessa categoria di fila: il 2° turno non vale
        sub("t4", { first: 0, firstAnswer: ko(0), second: 1, secondAnswer: s[1] }),
      ],
    });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 50, t3: 50, t4: 50 });
    expect(summaryOf<{ picks: { first: number[]; second: number[] } }>(out)!.picks).toEqual({ first: [2, 2, 0], second: [1, 1, 1] });
  });

  it("31 Falso vantaggio: SUBITO paga il valore coperto, ENIGMA il suo solo se risolto; valori dal seme, mai in vista", async () => {
    const { prizesOf, SUBITO_VALUES, ENIGMA_VALUES } = await import("@/lib/tig/games/mechanics/falso-vantaggio");
    type C = { options: { id: string }[]; solution: { optionId: string } };
    const def = m<C, { busta: "subito" } | { busta: "enigma"; optionId: string }>("falso-vantaggio");
    const c = first<C>("falso-vantaggio");
    const ko = c.options.find((o) => o.id !== c.solution.optionId)!.id;
    const seen = { s: new Set<number>(), e: new Set<number>() };
    for (let i = 0; i < 60; i++) {
      const ctx = makeCtx(def as MechanicDef, [team(1), team(2), team(3)], `buste-${i}`);
      const prizes = prizesOf(ctx);
      seen.s.add(prizes.subito);
      seen.e.add(prizes.enigma);
      const out = def.score({ content: c, ctx, submissions: [sub("t1", { busta: "subito" }), sub("t2", { busta: "enigma", optionId: c.solution.optionId }), sub("t3", { busta: "enigma", optionId: ko })] });
      expect(byTeam(out)).toEqual({ t1: prizes.subito, t2: prizes.enigma, t3: 0 });
      const view = JSON.stringify(def.publicView(c, ctx));
      expect(view).not.toContain("prizes");
      const rev = def.reveal(c, out) as { subitoPrize: number; enigmaPrize: number };
      expect([rev.subitoPrize, rev.enigmaPrize]).toEqual([prizes.subito, prizes.enigma]);
    }
    expect([...seen.s].sort((a, b) => a - b)).toEqual([...SUBITO_VALUES]);
    expect([...seen.e].sort((a, b) => a - b)).toEqual([...ENIGMA_VALUES]);
  });

  it("32 Ultima parola: da 120 col primo pezzo a 40 con la frase intera; i pezzi futuri non partono", () => {
    type C = { chunks: string[]; options: { id: string }[]; solution: { optionId: string } };
    const def = m<C, { optionId: string }>("ultima-parola");
    const c = first<C>("ultima-parola");
    const ok = c.solution.optionId;
    const ko = c.options.find((o) => o.id !== ok)!.id;
    const ctx = makeCtx(def as MechanicDef, [team(1), team(2), team(3)]);
    const dur = def.timerSec * 1000;
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { optionId: ok }, 500), sub("t2", { optionId: ok }, dur - 500), sub("t3", { optionId: ko }, 500)] });
    expect(byTeam(out)).toEqual({ t1: 120, t2: 40, t3: 0 });
    const at = MECHANIC_EXTRAS["ultima-parola"].publicViewAt!;
    const early = at(c, ctx, 0) as { chunks: (string | null)[] };
    expect(early.chunks.filter(Boolean)).toHaveLength(1);
    for (const later of c.chunks.slice(1)) expect(JSON.stringify(early)).not.toContain(later);
    const late = at(c, ctx, dur) as { chunks: (string | null)[] };
    expect(late.chunks.filter(Boolean)).toHaveLength(c.chunks.length);
    // nel duello di 45 s o in una prova più corta i pezzi restano nei tre quarti del tempo
    const short = makeCtx(def as MechanicDef, [team(1)], "corta", 30_000);
    expect((at(c, short, 22_600) as { chunks: unknown[] }).chunks.filter(Boolean)).toHaveLength(c.chunks.length);
  });

  it("18 Taglia il tempo: lampo giusto = taglio di 3 s al bersaglio (una volta sola), fuori tempo vale 0", () => {
    type C = { lampo: { options: { id: string }[] }; sfida: { options: { id: string }[] }; solution: { lampo: string; sfida: string } };
    const def = m<C, { lampo: string; targetId: string; sfida: string }>("taglia-il-tempo");
    const c = first<C>("taglia-il-tempo");
    const { lampo: L, sfida: S } = c.solution;
    const badL = c.lampo.options.find((o) => o.id !== L)!.id;
    const ctx = makeCtx(def as MechanicDef, [team(1), team(2), team(3), team(4)]);
    const dur = def.timerSec * 1000;
    const out = def.score({
      content: c,
      ctx,
      submissions: [
        sub("t1", { lampo: L, targetId: "t2", sfida: S }, 5000), // taglia t2 per primo
        sub("t3", { lampo: L, targetId: "t2", sfida: S }, 6000), // taglio a vuoto: t2 è già tagliato
        sub("t2", { lampo: L, targetId: "t4", sfida: S }, dur - 2000), // in tempo, ma tagliato: fuori
        sub("t4", { lampo: badL, targetId: "t1", sfida: S }, dur - 2000), // tagliato da t2? sì: anche lui fuori
      ],
    });
    const s = summaryOf<{ cuts: { from: string; to: string; applied: boolean }[]; knockedOut: string[] }>(out)!;
    expect(s.cuts).toEqual([
      { from: "t1", to: "t2", applied: true },
      { from: "t2", to: "t4", applied: true },
      { from: "t3", to: "t2", applied: false },
    ]);
    expect(s.knockedOut.sort()).toEqual(["t2", "t4"]);
    const pts = byTeam(out);
    expect(pts.t2).toBe(0);
    expect(pts.t4).toBe(0);
    expect(pts.t1).toBeGreaterThan(100);
    expect(pts.t1).toBeLessThanOrEqual(120);
    // tagliato ma rapido: valido, con 3 secondi in più sul bonus velocità
    const fast = def.score({ content: c, ctx, submissions: [sub("t1", { lampo: L, targetId: "t2", sfida: S }, 1000), sub("t2", { lampo: badL, targetId: "t1", sfida: S }, 1000)] });
    expect(byTeam(fast).t2).toBeLessThan(byTeam(fast).t1);
    expect(byTeam(fast).t2).toBeGreaterThanOrEqual(100);
    // duello del Caos (45 s): la zona taglio segue la durata vera della prova
    const caos = makeCtx(def as MechanicDef, [team(1), team(2)], "caos", 45_000);
    const late = def.score({ content: c, ctx: caos, submissions: [sub("t1", { lampo: L, targetId: "x", sfida: S }, 1000), sub("t2", { lampo: badL, targetId: "x", sfida: S }, 43_000)] });
    expect(byTeam(late).t2).toBe(0);
  });

  it("20 Contrattacco: giro di attacchi (uno a testa), colpo giusto = furto di 20, rivincita sicura +20 o piena +40", () => {
    type C = { colpo: { options: { id: string }[] }; sicura: { options: { id: string }[] }; piena: { options: { id: string }[] }; solution: { colpo: string; sicura: string; piena: string } };
    const def = m<C, { colpo: string; rivincita: "sicura" | "piena"; risposta: string }>("contrattacco");
    const c = first<C>("contrattacco");
    const sol = c.solution;
    const koColpo = c.colpo.options.find((o) => o.id !== sol.colpo)!.id;
    const koPiena = c.piena.options.find((o) => o.id !== sol.piena)!.id;
    const ctx = makeCtx(def as MechanicDef, [team(1), team(2), team(3)]);
    const ring = (def.publicView(c, ctx) as { ring: { from: { teamId: string }; to: { teamId: string } }[] }).ring;
    expect(ring).toHaveLength(3);
    expect(new Set(ring.map((l) => l.to.teamId)).size).toBe(3);
    const targetOf = (id: string) => ring.find((l) => l.from.teamId === id)!.to.teamId;
    const out = def.score({
      content: c,
      ctx,
      submissions: [
        sub("t1", { colpo: sol.colpo, rivincita: "piena", risposta: sol.piena }),
        sub("t2", { colpo: koColpo, rivincita: "sicura", risposta: sol.sicura }),
        sub("t3", { colpo: sol.colpo, rivincita: "piena", risposta: koPiena }),
      ],
    });
    expect(byTeam(out)).toEqual({ t1: 40, t2: 20, t3: 0 });
    expect(transfersOf(out).sort((a, b) => (a.from < b.from ? -1 : 1))).toEqual([
      { from: "t1", to: targetOf("t1"), points: 20 },
      { from: "t3", to: targetOf("t3"), points: 20 },
    ]);
    // un tavolo solo: niente attacchi, solo rivincita
    const solo = def.score({ content: c, ctx: makeCtx(def as MechanicDef, [team(5)]), submissions: [sub("t5", { colpo: sol.colpo, rivincita: "sicura", risposta: sol.sicura })] });
    expect(byTeam(solo).t5).toBe(20);
    expect(transfersOf(solo)).toEqual([]);
  });

  it("26 La trappola: +20 a trappola disinnescata, −30 se il bersaglio sbaglia quella armata, una sola trappola per tavolo", () => {
    type C = { traps: { options: { id: string }[] }[]; solution: { traps: string[] } };
    const def = m<C, { targetId: string; trap: number; defuse: string[] }>("la-trappola");
    const c = first<C>("la-trappola");
    const right = c.solution.traps;
    const wrong = (i: number) => c.traps[i].options.find((o) => o.id !== right[i])!.id;
    const ctx = makeCtx(def as MechanicDef, [team(1), team(2), team(3), team(4)]);
    const out = def.score({
      content: c,
      ctx,
      submissions: [
        sub("t1", { targetId: "t2", trap: 1, defuse: right }, 2000), // prima trappola su t2, che sbaglia la 1: scatta
        sub("t3", { targetId: "t2", trap: 0, defuse: [right[0], wrong(1), right[2]] }, 3000), // seconda su t2: a vuoto
        sub("t2", { targetId: "t1", trap: 2, defuse: [right[0], wrong(1), right[2]] }, 4000), // t1 ha risposto giusto: disinnescata
        sub("t4", { targetId: "t3", trap: 1, defuse: [wrong(0), wrong(1), wrong(2)] }, 5000), // t3 sbaglia la 1: scatta
      ],
    });
    expect(byTeam(out)).toEqual({ t1: 60, t2: 40, t3: 40, t4: 0 });
    expect(transfersOf(out)).toEqual([
      { from: "t1", to: "t2", points: -30 },
      { from: "t4", to: "t3", points: -30 },
    ]);
    const pl = summaryOf<{ placements: { from: string; armed: boolean; sprung: boolean }[] }>(out)!.placements;
    expect(pl.find((x) => x.from === "t3")).toMatchObject({ armed: false, sprung: false });
    // chi non risponde non disinnesca: la trappola armata scatta
    const absent = def.score({ content: c, ctx, submissions: [sub("t1", { targetId: "t4", trap: 0, defuse: right })] });
    expect(transfersOf(absent)).toEqual([{ from: "t1", to: "t4", points: -30 }]);
  });

  it("27 Il patto di 60 secondi: indizi divisi tra i tavoli del patto (mai in TV), tutti giusti +100, a metà +40", () => {
    type C = { clues: string[]; solution: { code: string } };
    const def = m<C, { digits: string }>("il-patto-di-60-secondi");
    const c = first<C>("il-patto-di-60-secondi");
    const code = c.solution.code;
    const wrong = code.slice(0, 5) + String((Number(code[5]) + 1) % 10);
    const teams = [team(1), team(2), team(3), team(4), team(5)];
    const ctx = makeCtx(def as MechanicDef, teams, "patto");
    const view = def.publicView(c, ctx) as { pacts: { teamId: string }[][] };
    expect(view.pacts.map((g) => g.length).sort()).toEqual([2, 3]);
    for (const clue of c.clues) expect(JSON.stringify(view)).not.toContain(clue);
    // ogni patto copre tutte e sei le cifre, senza doppioni
    for (const g of view.pacts) {
      const pos = g.flatMap((t, i) => (def.memberView!(c, { ...ctx, teamId: t.teamId, memberId: `${t.teamId}m0`, memberIndex: i }) as { clues: { pos: number }[] }).clues.map((x) => x.pos));
      expect(pos.sort()).toEqual([0, 1, 2, 3, 4, 5]);
    }
    const [pair, trio] = [view.pacts.find((g) => g.length === 2)!, view.pacts.find((g) => g.length === 3)!];
    const out = def.score({
      content: c,
      ctx,
      submissions: [
        sub(pair[0].teamId, { digits: code }),
        sub(pair[1].teamId, { digits: code }),
        sub(trio[0].teamId, { digits: code }),
        sub(trio[1].teamId, { digits: wrong }),
      ],
    });
    const pts = byTeam(out);
    expect(pts[pair[0].teamId]).toBe(100);
    expect(pts[pair[1].teamId]).toBe(100);
    expect(pts[trio[0].teamId]).toBe(40);
    expect(pts[trio[1].teamId]).toBe(0);
    expect(pts[trio[2].teamId]).toBe(0);
    // un tavolo da solo vede tutti gli indizi
    const solo = makeCtx(def as MechanicDef, [team(9)]);
    expect((def.memberView!(c, { ...solo, teamId: "t9", memberId: "t9m0", memberIndex: 0 }) as { clues: unknown[] }).clues).toHaveLength(6);
  });

  it("28 La sfida incrociata: griglie a soluzione unica, la speculare vale uguale, +60 valida e +40 al più rapido", async () => {
    const { countSolutions, isValidGrid, mirrorGrid } = await import("@/lib/tig/games/mechanics/la-sfida-incrociata");
    type C = { givens: string; solution: { grid: string } };
    const def = m<C, { cells: string }>("la-sfida-incrociata");
    for (const v of CONTENT["la-sfida-incrociata"] as unknown as C[]) {
      expect(countSolutions(v.givens)).toBe(1);
      expect(isValidGrid(v.solution.grid)).toBe(true);
      expect(isValidGrid(mirrorGrid(v.solution.grid))).toBe(true);
      expect(countSolutions(mirrorGrid(v.givens))).toBe(1);
    }
    const c = first<C>("la-sfida-incrociata");
    const ctx = makeCtx(def as MechanicDef, [team(1), team(2), team(3)], "griglia");
    const pairs = (def.publicView(c, ctx) as { pairs: { a: { teamId: string }; b: { teamId: string } | null }[] }).pairs;
    const duo = pairs.find((p) => p.b)!;
    const solo = pairs.find((p) => !p.b)!.a.teamId;
    const g = c.solution.grid;
    const out = def.score({
      content: c,
      ctx,
      submissions: [
        sub(duo.a.teamId, { cells: g }, 20_000),
        sub(duo.b!.teamId, { cells: mirrorGrid(g) }, 15_000), // speculare e più rapido
        sub(solo, { cells: g }, 30_000), // sopra il tempo mediano (20 s)
      ],
    });
    const pts = byTeam(out);
    expect(pts[duo.b!.teamId]).toBe(100);
    expect(pts[duo.a.teamId]).toBe(60);
    expect(pts[solo]).toBe(60);
    // chi copia la griglia dritta avendo quella speculare sbaglia
    const copy = def.score({ content: c, ctx, submissions: [sub(duo.b!.teamId, { cells: g }, 1000)] });
    expect(mirrorGrid(g)).not.toBe(g);
    expect(byTeam(copy)[duo.b!.teamId]).toBe(0);
  });

  it("29 Bottone del Caos: più giuste vince, a pari merito il più rapido, +50 a duello (tetto 100), mai negativi", async () => {
    const { caosWinner } = await import("@/lib/tig/games/mechanics/bottone-del-caos");
    type C = { raffica: { options: { id: string }[] }[]; solution: { raffica: string[] } };
    const def = m<C, { targetId: string; raffica: string[] }>("bottone-del-caos");
    const c = first<C>("bottone-del-caos");
    const r = c.solution.raffica;
    const two = (i: number) => r.map((x, k) => (k === i ? c.raffica[k].options.find((o) => o.id !== x)!.id : x));
    // duello del Caos: due tavoli, il bersaglio è obbligato, i punti indicano lo stesso vincitore del motore
    const caos = makeCtx(def as MechanicDef, [team(1), team(2)], "caos", 45_000);
    let out = def.score({ content: c, ctx: caos, submissions: [sub("t1", { targetId: "x", raffica: two(0) }, 3000), sub("t2", { targetId: "y", raffica: r }, 9000)] });
    expect(byTeam(out)).toEqual({ t1: 0, t2: 50 });
    out = def.score({ content: c, ctx: caos, submissions: [sub("t1", { targetId: "t2", raffica: r }, 3000), sub("t2", { targetId: "t1", raffica: r }, 9000)] });
    expect(byTeam(out)).toEqual({ t1: 50, t2: 0 });
    expect(caosWinner({ id: "a", hits: 0, ms: 1 }, { id: "b", hits: 0, ms: 2 })).toBeNull();
    expect(caosWinner({ id: "a", hits: 2, ms: 5 }, { id: "b", hits: 2, ms: 5 })).toBeNull();
    // prova normale: tre tavoli premono tutti contro t1, che vince entrambi i duelli: tetto 100
    const ctx = makeCtx(def as MechanicDef, [team(1), team(2), team(3), team(4)]);
    out = def.score({
      content: c,
      ctx,
      submissions: [sub("t1", { targetId: "t2", raffica: r }, 1000), sub("t2", { targetId: "t1", raffica: r }, 4000), sub("t3", { targetId: "t1", raffica: two(1) }, 500), sub("t4", { targetId: "t1", raffica: two(2) }, 800)],
    });
    expect(byTeam(out).t1).toBe(100);
    for (const o of out.outcomes) expect(o.points).toBeGreaterThanOrEqual(0);
    expect(summaryOf<{ duels: unknown[] }>(out)!.duels).toHaveLength(3);
  });

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

// ---------------------------------------------------------------------------
// Schermate: ogni Player e ogni Tv si disegnano senza errori in tutte le fasi (rendering statico, niente browser)
// ---------------------------------------------------------------------------

describe.each(CODES.map((c) => [c] as const))("TIG manche 2 · schermate di %s", (code) => {
  it("telefono e TV si disegnano in gioco, a tempo scaduto e al reveal (capitano e no, 3 e 12 tavoli), senza spiegazione prima del reveal", () => {
    const def = m(code);
    const extras = MECHANIC_EXTRAS[code];
    const ui = UI_MANCHE_2[code];
    const colors = ["#6fe7ff", "#ffc24a", "#b49cff", "#ff6bd6", "#7cff4f", "#3d8bff"];
    for (const n of [3, 12]) {
      const teamsN = Array.from({ length: n }, (_, i) => team(i + 1, 1 + (i % 4)));
      for (const c of CONTENT[code].slice(0, 3)) {
        const ctx = makeCtx(def, teamsN, `ui-${n}`);
        const me = ctx.teams[0];
        const out = def.score({ content: c, ctx, submissions: extras.demoSubmissions(c, ctx, "ui") });
        const rev = def.reveal(c, out);
        const mv = def.memberView ? def.memberView(c, { ...ctx, teamId: me.teamId, memberId: me.members[0], memberIndex: 0 }) : null;
        const tvTeams = ctx.teams.map((t, i) => ({ teamId: t.teamId, tableNo: t.tableNo, name: `Squadra ${i + 1}`, color: colors[i % colors.length], submitted: i % 2 === 1 }));
        const dur = def.timerSec * 1000;
        const explain = (c as { explain?: string }).explain;
        for (const at of [0, Math.round(dur / 2), dur - 1000]) {
          const view = extras.publicViewAt ? extras.publicViewAt(c, ctx, at) : def.publicView(c, ctx);
          const now = () => ctx.startsAt + at;
          for (const [stage, captain, submitted] of [
            ["play", true, false],
            ["play", false, false],
            ["play", true, true],
            ["locked", true, false],
          ] as const) {
            const html = renderToStaticMarkup(createElement(ui.Player, { view, memberView: mv, stage, deadlineAt: ctx.deadlineAt, now, canSubmit: captain, submitted, submit: async () => ({ ok: true }), myTeam: me, reveal: null, myOutcome: null }));
            expect(html.length).toBeGreaterThan(200);
            if (explain) expect(html).not.toContain(explain.slice(0, 40));
          }
          for (const stage of ["play", "locked"] as const) {
            const tv = renderToStaticMarkup(createElement(ui.Tv, { view, stage, deadlineAt: ctx.deadlineAt, now, teams: tvTeams, reveal: null, outcome: null }));
            expect(tv.length).toBeGreaterThan(200);
            if (explain) expect(tv).not.toContain(explain.slice(0, 40));
          }
        }
        const full = def.publicView(c, ctx);
        const end = () => ctx.deadlineAt;
        const myOutcome = out.outcomes.find((o) => o.teamId === me.teamId) ?? null;
        const p = renderToStaticMarkup(createElement(ui.Player, { view: full, memberView: mv, stage: "reveal", deadlineAt: ctx.deadlineAt, now: end, canSubmit: true, submitted: true, submit: async () => ({ ok: true }), myTeam: me, reveal: rev, myOutcome }));
        const tv = renderToStaticMarkup(createElement(ui.Tv, { view: full, stage: "reveal", deadlineAt: ctx.deadlineAt, now: end, teams: tvTeams, reveal: rev, outcome: out }));
        expect(p.length).toBeGreaterThan(200);
        expect(tv.length).toBeGreaterThan(200);
        if (explain) expect(tv).toContain(explain.slice(0, 30).replace(/'/g, "&#x27;"));
      }
    }
  });
});
