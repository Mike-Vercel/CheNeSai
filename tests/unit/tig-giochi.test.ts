import { describe, expect, it } from "vitest";
import { CATALOG, MECHANIC_EXTRAS, MECHANICS, mechanicByCode } from "@/lib/tig/games";
import { CATALOG_ROWS } from "@/lib/tig/games/catalog";
import { loadVariants } from "@/lib/tig/games/content-core";
import type { AcceptedSubmission, MechanicDef, PhaseCtx, TeamRef } from "@/lib/tig/games/contract";
import { FORBIDDEN_PUBLIC_KEYS } from "@/lib/tig/games/mechanics/_shared";
import { summaryOf } from "@/lib/tig/games/extras";
import { betLimit, capBet, resolveSealedBid } from "@/lib/tig/games/components/bid";
import { clueIndexAt, cluePoints } from "@/lib/tig/games/components/clues";
import { fragmentsFor } from "@/lib/tig/games/components/coop";
import { proximityPoints, stopPoints } from "@/lib/tig/games/components/estimate";
import { duelWinner, ring, ringColors } from "@/lib/tig/games/components/pairing";
import { correctPositions, reorderPoints } from "@/lib/tig/games/components/reorder";
import { seededShuffle, shuffleNotIdentity } from "@/lib/tig/games/components/rng";
import { speedBonus } from "@/lib/tig/games/components/scoring";
import { impossibleSteps } from "@/lib/tig/games/components/timeline";
import { agreementShare, percentages, pubTally } from "@/lib/tig/games/components/vote";

// ---------------------------------------------------------------------------
// Supporto
// ---------------------------------------------------------------------------

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

function first<C = Record<string, unknown>>(code: string): C {
  return variants<C>(code)[0];
}

function m<C = unknown, S = unknown>(code: string): MechanicDef<C, S> {
  const d = mechanicByCode(code);
  if (!d) throw new Error(code);
  return d as unknown as MechanicDef<C, S>;
}

/** Elenco di tutte le chiavi presenti (in profondità). */
function deepKeys(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => deepKeys(x, out));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      out.push(k);
      deepKeys(x, out);
    }
  }
  return out;
}

function deepStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => deepStrings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => deepStrings(x, out));
  return out;
}

const byTeam = (out: { outcomes: { teamId: string; points: number }[] }) => Object.fromEntries(out.outcomes.map((o) => [o.teamId, o.points]));

// ---------------------------------------------------------------------------
// Catalogo e registro
// ---------------------------------------------------------------------------

describe("TIG minigiochi · catalogo", () => {
  it("ha 80 voci uniche, 16 per manche, con i dati del PDF", () => {
    expect(CATALOG).toHaveLength(80);
    expect(new Set(CATALOG.map((c) => c.number)).size).toBe(80);
    expect(new Set(CATALOG.map((c) => c.code)).size).toBe(80);
    for (const c of CATALOG) {
      expect(c.code).toMatch(/^[a-z0-9-]+$/);
      expect(c.manche).toBe(Math.ceil(c.number / 16));
      expect(c.description.length).toBeGreaterThan(20);
      expect(c.pointsRule.length).toBeGreaterThan(5);
      expect(c.timerSec).toBeGreaterThanOrEqual(25);
      expect(["team", "vote", "coop", "duel", "pub"]).toContain(c.input);
    }
    expect(CATALOG_ROWS.map((r) => r[0])).toEqual(Array.from({ length: 80 }, (_, i) => i + 1));
  });

  it("lo stato è onesto: «implementata» solo per le meccaniche nel registro", () => {
    const implemented = new Set(MECHANICS.map((d) => d.code));
    for (const c of CATALOG) expect(c.status === "implementata").toBe(implemented.has(c.code));
    expect(CATALOG.filter((c) => c.status === "implementata")).toHaveLength(MECHANICS.length);
  });

  it("copre tutte e 5 le manche (almeno 5/4/4/4/3) con ~20 meccaniche", () => {
    expect(MECHANICS.length).toBeGreaterThanOrEqual(20);
    const per = [1, 2, 3, 4, 5].map((n) => MECHANICS.filter((d) => d.manche === n).length);
    expect(per[0]).toBeGreaterThanOrEqual(5);
    expect(per[1]).toBeGreaterThanOrEqual(4);
    expect(per[2]).toBeGreaterThanOrEqual(4);
    expect(per[3]).toBeGreaterThanOrEqual(4);
    expect(per[4]).toBeGreaterThanOrEqual(3);
    // varietà: non solo decisioni di squadra
    expect(new Set(MECHANICS.map((d) => d.input)).size).toBe(5);
  });

  it("ogni definizione combacia col catalogo, regola ≤ 140 caratteri, estensioni presenti", () => {
    for (const d of MECHANICS) {
      const c = CATALOG.find((x) => x.code === d.code)!;
      expect(c, d.code).toBeTruthy();
      expect(d.number).toBe(c.number);
      expect(d.manche).toBe(c.manche);
      expect(d.rule.length, d.code).toBeLessThanOrEqual(140);
      expect(MECHANIC_EXTRAS[d.code]?.demoSubmissions, d.code).toBeTypeOf("function");
    }
  });
});

// ---------------------------------------------------------------------------
// Contenuti
// ---------------------------------------------------------------------------

describe("TIG minigiochi · contenuti", () => {
  it("almeno 6 varianti valide per meccanica, id unici", () => {
    for (const d of MECHANICS) {
      const vs = CONTENT[d.code];
      expect(vs.length, d.code).toBeGreaterThanOrEqual(6);
      expect(new Set(vs.map((v) => v.id)).size, d.code).toBe(vs.length);
      for (const v of vs) expect(d.contentSchema.safeParse(v).success, `${d.code}/${v.id}`).toBe(true);
    }
  });

  it("gli alibi sono validati dai vincoli: esattamente la tappa della soluzione è impossibile", () => {
    for (const c of variants<{ id: string; steps: never[]; places: never[]; legs: never[]; solution: { stepId: string } }>("alibi-impossibile")) {
      const issues = impossibleSteps(c.steps, c.places, c.legs);
      expect(issues.map((i) => i.stepId), c.id).toEqual([c.solution.stepId]);
    }
  });

  it("niente emoji nei testi (grafica disegnata, accessibile)", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const d of MECHANICS) for (const v of CONTENT[d.code]) for (const s of deepStrings(v)) expect(emoji.test(s), `${d.code}/${v.id}: ${s}`).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Proprietà comuni a tutte le meccaniche
// ---------------------------------------------------------------------------

describe.each(MECHANICS.map((d) => [d.code, d] as const))("TIG meccanica %s", (code, def) => {
  const extras = MECHANIC_EXTRAS[code];
  const vs = CONTENT[code];

  it("la vista pubblica non contiene mai soluzione né spiegazione (controllo profondo)", () => {
    for (const c of vs) {
      for (const seed of ["s1", "s2", "s3"]) {
        const ctx = makeCtx(def, undefined, seed);
        const views = [def.publicView(c, ctx)];
        if (extras.publicViewAt) views.push(extras.publicViewAt(c, ctx, 0), extras.publicViewAt(c, ctx, 30_000), extras.publicViewAt(c, ctx, def.timerSec * 1000));
        for (const view of views) {
          const keys = deepKeys(view);
          for (const k of FORBIDDEN_PUBLIC_KEYS) expect(keys, `${c.id} contiene «${k}»`).not.toContain(k);
          const explain = (c as { explain?: string }).explain;
          if (explain) expect(JSON.stringify(view)).not.toContain(explain);
        }
      }
    }
  });

  it("score è deterministico e non dipende dall'ordine degli invii", () => {
    for (const c of vs) {
      const ctx = makeCtx(def);
      const subs = extras.demoSubmissions(c, ctx, "det");
      for (const s of subs) expect(def.submissionSchema.safeParse(s.payload).success, `${c.id}: ${JSON.stringify(s.payload)}`).toBe(true);
      const a = def.score({ content: c, ctx, submissions: subs });
      const b = def.score({ content: c, ctx, submissions: subs.map((x) => ({ ...x })) });
      const r = def.score({ content: c, ctx, submissions: seededShuffle(subs, "ordine") });
      expect(b).toEqual(a);
      expect(r).toEqual(a);
    }
  });

  it("nessun invio: tutti i tavoli a 0 punti e 0 Energia Caos", () => {
    const c = vs[0];
    const ctx = makeCtx(def);
    const out = def.score({ content: c, ctx, submissions: [] });
    expect(out.outcomes.map((o) => o.teamId).sort()).toEqual(ctx.teams.map((t) => t.teamId).sort());
    for (const o of out.outcomes) {
      expect(o.points).toBe(0);
      expect(o.chaos).toBe(0);
    }
  });

  it("punti proposti entro i limiti del PDF, Energia Caos intera ≥ 0, esiti leggibili", () => {
    for (const c of vs) {
      const ctx = makeCtx(def);
      const out = def.score({ content: c, ctx, submissions: extras.demoSubmissions(c, ctx, "lim") });
      for (const o of out.outcomes) {
        expect(o.points, `${c.id}`).toBeLessThanOrEqual(240);
        expect(o.points, `${c.id}`).toBeGreaterThanOrEqual(-250);
        expect(Number.isInteger(o.points)).toBe(true);
        expect(Number.isInteger(o.chaos) && o.chaos >= 0 && o.chaos <= 4).toBe(true);
        if (o.accuracy !== null) expect(o.accuracy >= 0 && o.accuracy <= 1).toBe(true);
        expect(o.label.length).toBeGreaterThan(0);
        for (const t of o.transfers ?? []) expect(Math.abs(t.points)).toBeLessThanOrEqual(40);
      }
      const rev = def.reveal(c, out) as Record<string, unknown>;
      expect(rev.explain, c.id).toBe((c as unknown as { explain: string }).explain);
    }
  });

  it("invii in più dello stesso tavolo/membro sono ignorati (vale il primo)", () => {
    const c = vs[0];
    const ctx = makeCtx(def);
    const subs = extras.demoSubmissions(c, ctx, "dup");
    const base = def.score({ content: c, ctx, submissions: subs });
    // ogni invio ripetuto più tardi con il payload di un altro tavolo/membro
    const extra = subs.map((s, i) => ({ ...s, elapsedMs: s.elapsedMs + 1000, payload: subs[(i + 1) % subs.length].payload }));
    const again = def.score({ content: c, ctx, submissions: [...subs, ...extra] });
    expect(again.outcomes).toEqual(base.outcomes);
  });

  it("tavoli estranei alla prova non entrano negli esiti", () => {
    const c = vs[0];
    const ctx = makeCtx(def);
    const subs = extras.demoSubmissions(c, ctx, "intrusi");
    const out = def.score({ content: c, ctx, submissions: [...subs, ...subs.map((s) => ({ ...s, teamId: "intruso", memberId: "x" }))] });
    expect(out.outcomes.some((o) => o.teamId === "intruso")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Componenti base
// ---------------------------------------------------------------------------

describe("TIG componenti base", () => {
  it("bonus velocità tra 0 e 20, lineare", () => {
    expect(speedBonus(0, 30000)).toBe(20);
    expect(speedBonus(15000, 30000)).toBe(10);
    expect(speedBonus(40000, 30000)).toBe(0);
    expect(speedBonus(-5, 30000)).toBe(20);
  });
  it("riordino: 20 a posizione + 20 se perfetto", () => {
    expect(reorderPoints(4, 4)).toBe(100);
    expect(reorderPoints(2, 4)).toBe(40);
    expect(reorderPoints(0, 4)).toBe(0);
    expect(correctPositions(["a", "b", "c", "d"], ["a", "c", "b", "d"])).toBe(2);
    for (let i = 0; i < 50; i++) expect(shuffleNotIdentity(["a", "b", "c", "d"], `s${i}`)).not.toEqual(["a", "b", "c", "d"]);
  });
  it("stima e tempo: vicinanza con tetto 100", () => {
    expect(proximityPoints(100, 100).points).toBe(100);
    expect(proximityPoints(110, 100).points).toBe(80);
    expect(proximityPoints(150, 100).points).toBe(0);
    expect(proximityPoints(10, 100).points).toBe(0);
    expect(stopPoints(0).points).toBe(100);
    expect(stopPoints(-1500).points).toBe(50);
    expect(stopPoints(4000).points).toBe(0);
  });
  it("indizi 100/70/40", () => {
    const sch = [0, 15000, 30000];
    expect(cluePoints(clueIndexAt(0, sch))).toBe(100);
    expect(cluePoints(clueIndexAt(14999, sch))).toBe(100);
    expect(cluePoints(clueIndexAt(15000, sch))).toBe(70);
    expect(cluePoints(clueIndexAt(44000, sch))).toBe(40);
  });
  it("offerta sigillata e puntata: un solo vincitore, tetto min(25% saldo, 250)", () => {
    expect(resolveSealedBid([{ teamId: "a", tableNo: 2, amount: 40, elapsedMs: 900 }, { teamId: "b", tableNo: 1, amount: 40, elapsedMs: 500 }])?.teamId).toBe("b");
    expect(resolveSealedBid([{ teamId: "a", tableNo: 2, amount: 40, elapsedMs: 500 }, { teamId: "b", tableNo: 1, amount: 40, elapsedMs: 500 }])?.teamId).toBe("b");
    expect(resolveSealedBid([{ teamId: "a", tableNo: 1, amount: 0, elapsedMs: 1 }])).toBeNull();
    expect(betLimit(400)).toBe(100);
    expect(betLimit(5000)).toBe(250);
    expect(betLimit(null)).toBe(250);
    expect(betLimit(0)).toBe(0);
    expect(capBet(999, 400)).toBe(100);
    expect(capBet(-3, 400)).toBe(0);
  });
  it("voto: percentuale sui membri attivi, un voto per tavolo nel locale", () => {
    expect(agreementShare(["a", "a"], 2).share).toBe(1);
    expect(agreementShare(["a", "a", "a", "a", "a", "a", "a", "a"], 8).share).toBe(1);
    expect(agreementShare(["a", "a", "a", "b"], 4).share).toBe(0.75);
    expect(agreementShare(["a", "a", "a", "a", "a", "a", "b", "c"], 8).share).toBe(0.75);
    expect(agreementShare(["a", "a"], 4).share).toBe(0.5); // chi non vota è disaccordo
    const t = pubTally(new Map([["t1", "x"], ["t2", "y"], ["t3", "x"]]), ["x", "y"]);
    expect(t.winners).toEqual(["x"]);
    expect(percentages({ x: 1, y: 1, z: 1 }, ["x", "y", "z"])).toEqual({ x: 34, y: 33, z: 33 });
  });
  it("giro dei tavoli: ognuno parla al successivo, mai lo stesso caso del vicino", () => {
    for (let n = 1; n <= 12; n++) {
      const ids = Array.from({ length: n }, (_, i) => `t${i}`);
      const r = ring(ids, "seme");
      expect(new Set(r.map((l) => l.tellsTo)).size).toBe(n > 1 ? n : 1);
      const colors = ringColors(n, 3);
      for (let i = 0; i < n && n > 1; i++) expect(colors[i]).not.toBe(colors[(i + 1) % n]);
    }
    expect(duelWinner({ teamId: "a", tableNo: 1, correct: true, elapsedMs: 900 }, { teamId: "b", tableNo: 2, correct: true, elapsedMs: 400 })).toBe("b");
    expect(duelWinner({ teamId: "a", tableNo: 1, correct: true, elapsedMs: 900 }, { teamId: "b", tableNo: 2, correct: false, elapsedMs: 400 })).toBe("a");
    expect(duelWinner(null, null)).toBeNull();
  });
  it("frammenti cooperativi: tutte le posizioni coperte con 1–8 telefoni, carico diviso", () => {
    for (let n = 1; n <= 8; n++) {
      const all = new Set<number>();
      for (let i = 0; i < n; i++) {
        const f = fragmentsFor(i, n, 6);
        expect(f.length).toBeLessThanOrEqual(Math.ceil(6 / Math.min(n, 6)));
        f.forEach((p) => all.add(p));
      }
      expect(all.size).toBe(6);
    }
  });
});

// ---------------------------------------------------------------------------
// Regole specifiche
// ---------------------------------------------------------------------------

describe("TIG regole specifiche", () => {
  it("01 Memoria lampo: punti per dettagli giusti; la scena sparisce dopo 8 s con publicViewAt", () => {
    const def = m<{ questions: { id: string; options: { id: string }[] }[]; solution: Record<string, string[]> }, { answers: Record<string, string[]> }>("memoria-lampo");
    const c = first<{ questions: { id: string; options: { id: string }[] }[]; solution: Record<string, string[]> }>("memoria-lampo");
    const ctx = makeCtx(def as MechanicDef);
    const right = c.solution;
    const twoOfThree = { ...right, [c.questions[2].id]: right[c.questions[2].id].slice(0, 1).concat(c.questions[2].options.find((o) => !right[c.questions[2].id].includes(o.id))!.id) };
    const out = def.score({ content: c as never, ctx, submissions: [sub("t1", { answers: right }), sub("t2", { answers: twoOfThree })] });
    expect(byTeam(out)).toMatchObject({ t1: 100, t2: 67, t3: 0 });
    const at = MECHANIC_EXTRAS["memoria-lampo"].publicViewAt!;
    expect((at(c, ctx, 1000) as { scene: unknown }).scene).not.toBeNull();
    expect((at(c, ctx, 9000) as { scene: unknown }).scene).toBeNull();
  });

  it("03 Screenshot traditore: giusto subito 120, giusto alla fine 100, sbagliato 0", () => {
    const def = m("screenshot-traditore");
    const c = first<{ solution: { regionId: string } }>("screenshot-traditore");
    const ctx = makeCtx(def);
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { regionId: c.solution.regionId }, 0), sub("t2", { regionId: c.solution.regionId }, 30000), sub("t3", { regionId: "non-esiste" }, 100)] });
    expect(byTeam(out)).toEqual({ t1: 120, t2: 100, t3: 0 });
  });

  it("04 Tempo fantasma: scarto dal bersaglio misurato sul server", () => {
    const def = m("tempo-fantasma");
    const c = first<{ targetSec: number }>("tempo-fantasma");
    const ctx = makeCtx(def);
    const at = 3000 + c.targetSec * 1000;
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { stop: true }, at), sub("t2", { stop: true }, at + 1500), sub("t3", { stop: true }, 1000)] });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 50, t3: 0 });
    expect(out.outcomes.find((o) => o.teamId === "t3")!.label).toBe("Partenza anticipata");
  });

  it("05 Ordine nel caos: la vista non parte mai dall'ordine giusto; perfetto 100, due scambiati 40", () => {
    const def = m("ordine-nel-caos");
    for (const c of variants<{ solution: { order: string[] } }>("ordine-nel-caos")) {
      for (const seed of ["a", "b", "c", "d", "e"]) {
        const v = def.publicView(c, makeCtx(def, undefined, seed)) as { items: { id: string }[] };
        expect(v.items.map((i) => i.id)).not.toEqual(c.solution.order);
      }
    }
    const c = first<{ solution: { order: string[] } }>("ordine-nel-caos");
    const o = c.solution.order;
    const out = def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { order: o }), sub("t2", { order: [o[1], o[0], o[2], o[3]] }), sub("t3", { order: [o[0], o[0], o[1], o[2]] })] });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 40, t3: 0 });
  });

  it("11 La cifra improbabile: nessun numero leggibile, sagome indistinguibili per numero di vertici", () => {
    const def = m("cifra-improbabile");
    for (const c of variants<{ id: string; decoys: number; solution: { count: number } }>("cifra-improbabile")) {
      const v = def.publicView(c, makeCtx(def)) as { art: { d: string } };
      const parts = v.art.d.split("M").filter(Boolean);
      expect(parts.length).toBe(c.solution.count + c.decoys);
      const vertexCounts = new Set(parts.map((p) => p.split("L").length));
      expect(vertexCounts.size, c.id).toBe(1);
      expect(deepStrings(v)).not.toContain(String(c.solution.count));
    }
    const c = first<{ solution: { count: number } }>("cifra-improbabile");
    const n = c.solution.count;
    const out = def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { guess: n }), sub("t2", { guess: Math.round(n * 1.1) }), sub("t3", { guess: n * 2 })] });
    expect(out.outcomes.find((o) => o.teamId === "t1")!.points).toBe(100);
    expect(out.outcomes.find((o) => o.teamId === "t2")!.points).toBeGreaterThanOrEqual(78);
    expect(out.outcomes.find((o) => o.teamId === "t3")!.points).toBe(0);
  });

  it("15 Indizio dopo indizio: 100/70/40 secondo l'orario del server; con publicViewAt gli indizi futuri non partono", () => {
    const def = m("indizio-dopo-indizio");
    const c = first<{ solution: { optionId: string }; options: { id: string }[] }>("indizio-dopo-indizio");
    const ok = c.solution.optionId;
    const out = def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { optionId: ok }, 5000), sub("t2", { optionId: ok }, 20000), sub("t3", { optionId: ok }, 40000)] });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 70, t3: 40 });
    const wrong = c.options.find((o) => o.id !== ok)!.id;
    expect(byTeam(def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { optionId: wrong }, 1000)] })).t1).toBe(0);
    const at = MECHANIC_EXTRAS["indizio-dopo-indizio"].publicViewAt!;
    expect((at(c, makeCtx(def), 1000) as { clues: (string | null)[] }).clues.filter(Boolean)).toHaveLength(1);
    expect((at(c, makeCtx(def), 16000) as { clues: (string | null)[] }).clues.filter(Boolean)).toHaveLength(2);
  });

  it("17 Scegli il bersaglio: duello +40 al più rapido tra i giusti, coppie contate una volta, tetto 80, mai negativi", () => {
    const def = m("scegli-il-bersaglio");
    const c = first<{ solution: { optionId: string }; options: { id: string }[] }>("scegli-il-bersaglio");
    const ok = c.solution.optionId;
    const ko = c.options.find((o) => o.id !== ok)!.id;
    const two = makeCtx(def, [team(1, 2), team(2, 6)]);
    // testa a testa: entrambi giusti, vince il più rapido; A→B e B→A è un duello solo
    let out = def.score({ content: c, ctx: two, submissions: [sub("t1", { targetId: "t2", optionId: ok }, 9000), sub("t2", { targetId: "t1", optionId: ok }, 4000)] });
    expect(byTeam(out)).toEqual({ t1: 0, t2: 40 });
    expect(summaryOf<{ duels: unknown[] }>(out)!.duels).toHaveLength(1);
    // tre tavoli sfidano tutti t1, che risponde giusto per primo: vince 2 duelli ma il tetto è 80
    const ctx4 = makeCtx(def, [team(1, 2), team(2, 3), team(3, 4), team(4, 2)]);
    out = def.score({
      content: c,
      ctx: ctx4,
      submissions: [sub("t1", { targetId: "t2", optionId: ok }, 1000), sub("t2", { targetId: "t1", optionId: ok }, 5000), sub("t3", { targetId: "t1", optionId: ko }, 2000), sub("t4", { targetId: "t1", optionId: ok }, 3000)],
    });
    expect(byTeam(out).t1).toBe(80);
    for (const o of out.outcomes) expect(o.points).toBeGreaterThanOrEqual(0);
  });

  it("19 Scudo rapido: nessun punto, lo scudo è l'esito corretto (effetto dichiarato al runtime)", () => {
    const def = m("scudo-rapido");
    const c = first<{ solution: { code: string } }>("scudo-rapido");
    const out = def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { digits: c.solution.code }), sub("t2", { digits: c.solution.code === "0000" ? "1111" : "0000".slice(0, c.solution.code.length) })] });
    expect(out.outcomes.find((o) => o.teamId === "t1")).toMatchObject({ points: 0, correct: true, label: "SCUDO ATTIVO" });
    expect(out.outcomes.find((o) => o.teamId === "t2")!.correct).toBe(false);
    expect(MECHANIC_EXTRAS["scudo-rapido"].effect?.kind).toBe("scudo");
  });

  it("23 Asta al buio: vince l'offerta più alta e paga solo lei; parità al più rapido; offerte oltre il tetto ridotte", () => {
    const def = m("asta-al-buio");
    const c = first<{ cap: number; solution: { value: number } }>("asta-al-buio");
    const out = def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { amount: 30 }, 4000), sub("t2", { amount: 30 }, 2000), sub("t3", { amount: 10 }, 1000)] });
    expect(byTeam(out)).toEqual({ t1: 0, t2: c.solution.value - 30, t3: 0 });
    const capped = def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { amount: 999 })] });
    expect(byTeam(capped).t1).toBe(c.solution.value - c.cap);
    for (const v of variants<{ cap: number; solution: { value: number } }>("asta-al-buio")) expect(v.solution.value - v.cap).toBeGreaterThanOrEqual(-40);
  });

  it("24 Doppio rischio: NORMALE 100/0, ALTA 160/−40", () => {
    const def = m("doppio-rischio");
    const c = first<{ solution: { optionId: string }; options: { id: string }[] }>("doppio-rischio");
    const ok = c.solution.optionId;
    const ko = c.options.find((o) => o.id !== ok)!.id;
    const out = def.score({ content: c, ctx: makeCtx(def, [team(1, 2), team(2, 2), team(3, 2), team(4, 2)]), submissions: [sub("t1", { rate: "normale", optionId: ok }), sub("t2", { rate: "normale", optionId: ko }), sub("t3", { rate: "alta", optionId: ok }), sub("t4", { rate: "alta", optionId: ko })] });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 0, t3: 160, t4: -40 });
  });

  it("33 Prevedi la maggioranza: un voto per tavolo, in parità valgono tutte le opzioni a pari merito", () => {
    const def = m("prevedi-la-maggioranza");
    const c = first<{ options: { id: string }[] }>("prevedi-la-maggioranza");
    const [x, y] = c.options.map((o) => o.id);
    // il tavolo da 8 non conta più di quello da 2
    const ctx = makeCtx(def, [team(1, 8), team(2, 2), team(3, 2)]);
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { vote: x, guess: x }), sub("t2", { vote: y, guess: y }), sub("t3", { vote: y, guess: x })] });
    expect(byTeam(out)).toEqual({ t1: 0, t2: 100, t3: 0 });
    const tie = def.score({ content: c, ctx: makeCtx(def, [team(1, 2), team(2, 2)]), submissions: [sub("t1", { vote: x, guess: x }), sub("t2", { vote: y, guess: y })] });
    expect(byTeam(tie)).toEqual({ t1: 100, t2: 100 });
  });

  it("35 Sincronizzati: normalizzato (2 su 2 = 8 su 8; 3 su 4 = 6 su 8), voti doppi e estranei ignorati", () => {
    const def = m("sincronizzati");
    const c = first<{ options: { id: string }[] }>("sincronizzati");
    const [a, b, d] = c.options.map((o) => o.id);
    const small = team(1, 2);
    const big = team(2, 8);
    const four = team(3, 4);
    const ctx = makeCtx(def, [small, big, four]);
    const votes = [
      ...small.members.map((mm) => sub(small.teamId, { optionId: a }, 3000, mm)),
      ...big.members.map((mm, i) => sub(big.teamId, { optionId: i < 6 ? b : d }, 3000, mm)),
      ...four.members.map((mm, i) => sub(four.teamId, { optionId: i < 3 ? d : a }, 3000, mm)),
      sub(small.teamId, { optionId: d }, 9000, small.members[0]), // secondo voto dello stesso membro: ignorato
      sub(small.teamId, { optionId: d }, 2000, "telefono-non-registrato"), // estraneo: ignorato
    ];
    const out = def.score({ content: c, ctx, submissions: votes });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 75, t3: 75 });
    // stesso accordo totale con 2 o 8 membri → stessi punti
    const allBig = def.score({ content: c, ctx: makeCtx(def, [big]), submissions: big.members.map((mm) => sub(big.teamId, { optionId: a }, 1000, mm)) });
    expect(byTeam(allBig).t2).toBe(100);
    // l'ordine delle opzioni cambia da telefono a telefono, l'insieme no
    const mv = (id: string, idx: number) => (def.memberView!(c, { ...ctx, teamId: big.teamId, memberId: id, memberIndex: idx }) as { options: { id: string }[] }).options.map((o) => o.id);
    const orders = big.members.map((id, i) => mv(id, i).join(","));
    expect(new Set(orders).size).toBeGreaterThan(1);
    for (const o of orders) expect(o.split(",").sort()).toEqual(c.options.map((x) => x.id).sort());
    // un solo telefono: 50 fissi
    const solo = def.score({ content: c, ctx: makeCtx(def, [team(5, 1)]), submissions: [sub("t5", { optionId: a }, 100, "t5m0")] });
    expect(byTeam(solo).t5).toBe(50);
  });

  it("39 Il dilemma pubblico: paga secondo la matrice, solo i tavoli che hanno scelto contano", () => {
    const def = m("dilemma-pubblico");
    const c = first<{ matrix: { threshold: number; reached: { coop: number; compete: number }; missed: { coop: number; compete: number } } }>("dilemma-pubblico");
    const teams = [team(1, 2), team(2, 2), team(3, 2), team(4, 2)];
    const allCoop = def.score({ content: c, ctx: makeCtx(def, teams), submissions: teams.map((t) => sub(t.teamId, { choice: "coopera" as const })) });
    for (const o of allCoop.outcomes) expect(o.points).toBe(c.matrix.reached.coop);
    const allComp = def.score({ content: c, ctx: makeCtx(def, teams), submissions: teams.map((t) => sub(t.teamId, { choice: "compete" as const })) });
    for (const o of allComp.outcomes) expect(o.points).toBe(c.matrix.missed.compete);
    const s = summaryOf<{ total: number; reached: boolean }>(allComp)!;
    expect(s).toMatchObject({ total: 4, reached: false });
  });

  it("42 Catena di codici: stessi punti con 2 o 8 telefoni; frammenti divisi sui telefoni attivi", () => {
    const def = m("catena-di-codici");
    const c = first<{ solution: { code: string }; clues: string[] }>("catena-di-codici");
    const ctx = makeCtx(def, [team(1, 2), team(2, 8), team(3, 1)]);
    const wrong2 = c.solution.code.slice(0, 4) + ((Number(c.solution.code[4]) + 1) % 10) + ((Number(c.solution.code[5]) + 1) % 10);
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { digits: c.solution.code }), sub("t2", { digits: c.solution.code }), sub("t3", { digits: wrong2 })] });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 100, t3: 60 });
    const frags = (teamId: string, n: number) =>
      Array.from({ length: n }, (_, i) => (def.memberView!(c, { ...ctx, teamId, memberId: `${teamId}m${i}`, memberIndex: i }) as { fragments: { pos: number }[] }).fragments.map((f) => f.pos));
    expect(frags("t3", 1)[0]).toEqual([0, 1, 2, 3, 4, 5]);
    expect(frags("t1", 2).map((f) => f.length)).toEqual([3, 3]);
    expect(new Set(frags("t2", 8).flat()).size).toBe(6);
  });

  it("49 Credici o no: matrice verità/bluff × fiducia, chi suggerisce non conosce il proprio caso, tetto 100", () => {
    const def = m("credici-o-no");
    type CC = { cases: { id: string; options: { id: string }[] }[]; solution: { cases: Record<string, { optionId: string }> } };
    const c = first<CC>("credici-o-no");
    const teams = [team(1, 2), team(2, 3), team(3, 4)];
    const ctx = makeCtx(def, teams);
    const mv = (t: TeamRef) => def.memberView!(c, { ...ctx, teamId: t.teamId, memberId: t.members[0], memberIndex: 0 }) as { myCase: { id: string; options: { id: string }[] }; tellsTo: { teamId: string; case: { id: string }; truthId: string } | null; hearsFrom: { teamId: string } | null };
    const views = Object.fromEntries(teams.map((t) => [t.teamId, mv(t)]));
    for (const t of teams) {
      const v = views[t.teamId];
      expect(v.tellsTo).not.toBeNull();
      expect(v.tellsTo!.case.id).not.toBe(v.myCase.id);
      expect(v.tellsTo!.truthId).toBe(c.solution.cases[v.tellsTo!.case.id].optionId);
      expect(JSON.stringify(v.myCase)).not.toContain("truth");
    }
    // tutti onesti, tutti si fidano → ognuno +50 (ricevuto) +20 (alleanza) = 70
    const honestTrust = teams.map((t) => sub(t.teamId, { tip: views[t.teamId].tellsTo!.truthId, trust: true }));
    expect(Object.values(byTeam(def.score({ content: c, ctx, submissions: honestTrust })))).toEqual([70, 70, 70]);
    // tutti bluffano e tutti si fidano → ognuno +40 (bluff riuscito) e 0 come ricevente
    const bluff = (t: TeamRef) => views[t.teamId].tellsTo!.case.id && c.cases.find((k) => k.id === views[t.teamId].tellsTo!.case.id)!.options.find((o) => o.id !== views[t.teamId].tellsTo!.truthId)!.id;
    const bluffTrust = teams.map((t) => sub(t.teamId, { tip: bluff(t), trust: true }));
    expect(Object.values(byTeam(def.score({ content: c, ctx, submissions: bluffTrust })))).toEqual([40, 40, 40]);
    // tutti bluffano, nessuno si fida e tutti risolvono da soli → 40 + 50 = 90 (chi suggerisce 0)
    const bluffDoubt = teams.map((t) => sub(t.teamId, { tip: bluff(t), trust: false, answer: c.solution.cases[views[t.teamId].myCase.id].optionId }));
    expect(Object.values(byTeam(def.score({ content: c, ctx, submissions: bluffDoubt })))).toEqual([90, 90, 90]);
    // un tavolo solo: risolve da solo, 50
    const solo = makeCtx(def, [team(9, 2)]);
    const soloCase = (def.memberView!(c, { ...solo, teamId: "t9", memberId: "t9m0", memberIndex: 0 }) as { myCase: { id: string } }).myCase.id;
    expect(byTeam(def.score({ content: c, ctx: solo, submissions: [sub("t9", { tip: c.solution.cases[soloCase].optionId, trust: false, answer: c.solution.cases[soloCase].optionId })] })).t9).toBe(50);
  });

  it("51/54/59: scelte giuste e coppie senza ordine", () => {
    const tv = m("tre-versioni");
    const c1 = first<{ solution: { versionId: string } }>("tre-versioni");
    expect(byTeam(tv.score({ content: c1, ctx: makeCtx(tv), submissions: [sub("t1", { versionId: c1.solution.versionId })] })).t1).toBe(100);
    const lc = m("la-contraddizione");
    const c2 = first<{ solution: { pair: [string, string] } }>("la-contraddizione");
    const [p, q] = c2.solution.pair;
    expect(byTeam(lc.score({ content: c2, ctx: makeCtx(lc), submissions: [sub("t1", { pair: [q, p] }), sub("t2", { pair: [p, p] })] }))).toMatchObject({ t1: 100, t2: 0 });
    const al = m("alibi-impossibile");
    const c3 = first<{ solution: { stepId: string } }>("alibi-impossibile");
    expect(byTeam(al.score({ content: c3, ctx: makeCtx(al), submissions: [sub("t1", { stepId: c3.solution.stepId })] })).t1).toBe(100);
  });

  it("65 Puntata nascosta: ± puntata, tetto sul saldo iniettato o 250, vista privata col massimo", () => {
    const def = m("puntata-nascosta");
    const base = first<{ solution: { optionId: string }; options: { id: string }[] }>("puntata-nascosta");
    const ok = base.solution.optionId;
    const ko = base.options.find((o) => o.id !== ok)!.id;
    const c = { ...base, balances: { t1: 400, t2: 2000 } };
    const out = def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { bet: 300, optionId: ok }), sub("t2", { bet: 300, optionId: ko }), sub("t3", { bet: 900, optionId: ok })] });
    expect(byTeam(out)).toEqual({ t1: 100, t2: -250, t3: 250 });
    const mv = def.memberView!(c, { ...makeCtx(def), teamId: "t1", memberId: "t1m0", memberIndex: 0 }) as { maxBet: number };
    expect(mv.maxBet).toBe(100);
    const at = MECHANIC_EXTRAS["puntata-nascosta"].publicViewAt!;
    expect((at(c, makeCtx(def), 2000) as { prompt: string | null }).prompt).toBeNull();
    expect((at(c, makeCtx(def), 16000) as { prompt: string | null }).prompt).not.toBeNull();
    expect(JSON.stringify(def.publicView(c, makeCtx(def)))).not.toContain("balances");
  });

  it("69 Soglia di rischio: +20 a risposta, bonus solo se la soglia è raggiunta", () => {
    const def = m("soglia-di-rischio");
    const c = first<{ questions: { id: string; options: { id: string }[] }[]; solution: { answers: Record<string, string> } }>("soglia-di-rischio");
    const right = c.solution.answers;
    const oneWrong = { ...right, [c.questions[0].id]: c.questions[0].options.find((o) => o.id !== right[c.questions[0].id])!.id };
    const out = def.score({
      content: c,
      ctx: makeCtx(def, [team(1, 2), team(2, 2), team(3, 2), team(4, 2)]),
      submissions: [sub("t1", { declared: 3, answers: right }), sub("t2", { declared: 3, answers: oneWrong }), sub("t3", { declared: 2, answers: oneWrong }), sub("t4", { declared: 0, answers: right })],
    });
    expect(byTeam(out)).toEqual({ t1: 160, t2: 40, t3: 90, t4: 60 });
  });

  it("71 Sicuro o rischio: 100 o 240, sbagliare vale 0", () => {
    const def = m("sicuro-o-rischio");
    const c = first<{ solution: { safe: string; risky: number } }>("sicuro-o-rischio");
    const out = def.score({
      content: c,
      ctx: makeCtx(def, [team(1, 2), team(2, 2), team(3, 2), team(4, 2)]),
      submissions: [sub("t1", { branch: "sicuro", optionId: c.solution.safe }), sub("t2", { branch: "rischio", number: c.solution.risky }), sub("t3", { branch: "rischio", number: c.solution.risky + 1 }), sub("t4", { branch: "sicuro", optionId: "zzz" })],
    });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 240, t3: 0, t4: 0 });
  });
});
