import { describe, expect, it } from "vitest";
import { CATALOG_ROWS } from "@/lib/tig/games/catalog";
import { loadVariants } from "@/lib/tig/games/content-core";
import type { AcceptedSubmission, MechanicDef, PhaseCtx, TeamRef } from "@/lib/tig/games/contract";
import { MECHANIC_EXTRAS, mechanicByCode } from "@/lib/tig/games";
import { NUOVE_MANCHE_1 } from "@/lib/tig/games/mechanics/manche-1";
import { CONTENUTI_MANCHE_1 } from "../../content/tig/minigiochi/manche-1";
import { UI_MANCHE_1 } from "@/features/tig/games/manche-1";
import { expectedAt, tokenKey, violations, type Pattern, type Token } from "@/lib/tig/games/mechanics/la-sequenza-sporca";
import { CUT } from "@/lib/tig/games/mechanics/titoli-tagliati";

/**
 * TAVOLI IN GUERRA! — test delle meccaniche nuove della MANCHE 1 (le proprietà comuni a tutte le meccaniche
 * sono già in tig-giochi.test.ts: qui le regole specifiche e i controlli editoriali dei contenuti).
 */

const CONTENT = loadVariants();

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

function m<C = unknown, S = unknown>(code: string): MechanicDef<C, S> {
  const d = mechanicByCode(code);
  if (!d) throw new Error(code);
  return d as unknown as MechanicDef<C, S>;
}

const byTeam = (out: { outcomes: { teamId: string; points: number }[] }) => Object.fromEntries(out.outcomes.map((o) => [o.teamId, o.points]));

function deepStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => deepStrings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => deepStrings(x, out));
  return out;
}

type Choice = { id: string; difficulty?: string; options: { id: string; text: string }[]; solution: { optionId: string } };

// ---------------------------------------------------------------------------
// Registro della manche
// ---------------------------------------------------------------------------

describe("TIG manche 1 · registro", () => {
  const codes = NUOVE_MANCHE_1.map((x) => x.def.code);

  it("ogni meccanica nuova combacia col catalogo (numero, manche 1, ingresso, timer) e ha schermate e contenuti", () => {
    for (const mod of NUOVE_MANCHE_1) {
      const row = CATALOG_ROWS.find((r) => r[1] === mod.def.code)!;
      expect(row, mod.def.code).toBeTruthy();
      expect(mod.def.number).toBe(row[0]);
      expect(mod.def.manche).toBe(1);
      expect(mod.def.input).toBe(row[4]);
      expect(mod.def.timerSec).toBe(row[5]);
      expect(mod.def.oneDeviceOk).toBe(true);
      expect(UI_MANCHE_1[mod.def.code], mod.def.code).toBeTruthy();
      expect(CONTENUTI_MANCHE_1[mod.def.code], mod.def.code).toBeTruthy();
    }
    expect(Object.keys(UI_MANCHE_1).sort()).toEqual([...codes].sort());
    expect(Object.keys(CONTENUTI_MANCHE_1).sort()).toEqual([...codes].sort());
  });

  it("almeno 10 varianti per meccanica, con tutte e tre le difficoltà", () => {
    for (const code of codes) {
      const vs = variants<{ difficulty?: string }>(code);
      expect(vs.length, code).toBeGreaterThanOrEqual(10);
      expect(new Set(vs.map((v) => v.difficulty)), code).toEqual(new Set(["facile", "media", "difficile"]));
    }
  });

  it("le definizioni non portano contenuti (niente varianti nel bundle del browser)", () => {
    for (const mod of NUOVE_MANCHE_1) expect((mod.def as unknown as { variants?: unknown }).variants, mod.def.code).toBeUndefined();
  });

  it("i tavoli nei testi sono solo «il tavolo N» (niente nomi di squadra inventati)", () => {
    for (const code of codes) for (const v of variants(code)) for (const s of deepStrings(v)) expect(/\bsquadra «/.test(s), `${code}: ${s}`).toBe(false);
  });

  it("scelte a risposta singola: la soluzione non è mai nella stessa posizione per tutti i semi (opzioni mescolate)", () => {
    for (const code of codes) {
      const def = m(code);
      const first = variants<Choice>(code)[0];
      if (!first.options || !first.solution?.optionId) continue;
      const positions = new Set(["a", "b", "c", "d", "e", "f"].map((seed) => (def.publicView(first, makeCtx(def, undefined, seed)) as { options: { id: string }[] }).options.findIndex((o) => o.id === first.solution.optionId)));
      expect(positions.size, code).toBeGreaterThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Regole specifiche
// ---------------------------------------------------------------------------

describe("TIG manche 1 · regole", () => {
  it("07 Titoli tagliati: 100 al finale coerente, 0 agli altri; il titolo arriva diviso al buco", () => {
    const def = m("titoli-tagliati");
    for (const c of variants<Choice & { headline: string }>("titoli-tagliati")) {
      expect(c.headline.split(CUT)).toHaveLength(2);
      const v = def.publicView(c, makeCtx(def)) as { headline: string[] };
      expect(v.headline).toHaveLength(2);
      expect(JSON.stringify(v)).not.toContain(CUT);
    }
    const c = variants<Choice>("titoli-tagliati")[0];
    const ko = c.options.find((o) => o.id !== c.solution.optionId)!.id;
    const out = def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { optionId: c.solution.optionId }, 29000), sub("t2", { optionId: ko }, 1000)] });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 0, t3: 0 });
    expect(out.outcomes.find((o) => o.teamId === "t3")!.label).toBe("Nessuna risposta");
  });

  it("09 La sequenza sporca: ogni fila viola la sua regola in un solo punto, quello della soluzione", () => {
    for (const c of variants<{ id: string; pattern: Pattern; items: Token[]; solution: { index: number } }>("la-sequenza-sporca")) {
      expect(violations(c.pattern, c.items), c.id).toEqual([c.solution.index]);
      const exp = expectedAt(c.pattern, c.solution.index);
      expect(tokenKey(exp), c.id).not.toBe(tokenKey(c.items[c.solution.index]));
    }
    const def = m("la-sequenza-sporca");
    const c = variants<{ solution: { index: number } }>("la-sequenza-sporca")[0];
    const out = def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { index: c.solution.index }), sub("t2", { index: (c.solution.index + 1) % 6 })] });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 0, t3: 0 });
  });

  it("09 regole della sequenza: aritmetica, raddoppio, somma dei due, dado, orari, lettere, frecce, alternanza", () => {
    const keys = (p: Pattern, n: number) => Array.from({ length: n }, (_, i) => tokenKey(expectedAt(p, i)));
    expect(keys({ k: "arit", start: 3, step: 4 }, 4)).toEqual(["n:3", "n:7", "n:11", "n:15"]);
    expect(keys({ k: "geo", start: 3, ratio: 2 }, 4)).toEqual(["n:3", "n:6", "n:12", "n:24"]);
    expect(keys({ k: "fib", a: 1, b: 2 }, 6)).toEqual(["n:1", "n:2", "n:3", "n:5", "n:8", "n:13"]);
    expect(keys({ k: "dado", start: 5, step: 1 }, 4)).toEqual(["d:5", "d:6", "d:1", "d:2"]);
    expect(keys({ k: "ore", start: "23:30", step: 45 }, 3)).toEqual(["h:23:30", "h:00:15", "h:01:00"]);
    expect(keys({ k: "lettere", start: "X", step: 2 }, 3)).toEqual(["l:X", "l:Z", "l:B"]);
    expect(keys({ k: "giro", s: "freccia", start: 270, step: 90 }, 3)).toEqual(["s:freccia:270", "s:freccia:0", "s:freccia:90"]);
    expect(keys({ k: "alterna", a: { k: "arit", start: 1, step: 1 }, b: { k: "lati", start: 3, step: 1 } }, 4)).toEqual(["n:1", "p:3", "n:2", "p:4"]);
  });

  it("14 Effetto domino e 16 Sotto la superficie: 100 alla risposta della chiave, mai bonus velocità", () => {
    for (const code of ["effetto-domino", "sotto-la-superficie"]) {
      const def = m(code);
      const c = variants<Choice>(code)[0];
      const out = def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { optionId: c.solution.optionId }, 0), sub("t2", { optionId: c.solution.optionId }, 34000), sub("t3", { optionId: "nessuna" }, 100)] });
      expect(byTeam(out), code).toEqual({ t1: 100, t2: 100, t3: 0 });
    }
  });

  it("16 Sotto la superficie: il messaggio da interpretare esiste ed è l'ultimo o quasi (contesto prima)", () => {
    for (const c of variants<{ id: string; chat: { messages: { id: string }[] }; targetId: string }>("sotto-la-superficie")) {
      const idx = c.chat.messages.findIndex((x) => x.id === c.targetId);
      expect(idx, c.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("le estensioni ci sono per tutte (invii finti validi)", () => {
    for (const mod of NUOVE_MANCHE_1) {
      const ex = MECHANIC_EXTRAS[mod.def.code];
      const c = variants(mod.def.code)[0];
      const subs = ex.demoSubmissions(c, makeCtx(mod.def), "x");
      expect(subs.length, mod.def.code).toBeGreaterThan(0);
      for (const s of subs) expect(mod.def.submissionSchema.safeParse(s.payload).success, mod.def.code).toBe(true);
    }
  });
});
