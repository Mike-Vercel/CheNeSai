import { describe, expect, it } from "vitest";
import { MECHANIC_EXTRAS, mechanicByCode } from "@/lib/tig/games";
import { loadVariants } from "@/lib/tig/games/content-core";
import type { AcceptedSubmission, MechanicDef, PhaseCtx, TeamRef } from "@/lib/tig/games/contract";
import { summaryOf } from "@/lib/tig/games/extras";
import { candidatesFor } from "@/lib/tig/games/mechanics/duello-silenzioso";
import { NUOVE_MANCHE_5 } from "@/lib/tig/games/mechanics/manche-5";
import { fingerprint } from "@/lib/tig/games/mechanics/m5-shared";
import { allPaths } from "@/lib/tig/games/mechanics/punto-di-rottura";
import { COUNTDOWN_MS, poseAt } from "@/lib/tig/games/mechanics/solo-un-dettaglio";
import { dealCards } from "@/lib/tig/games/mechanics/tre-carte-un-destino";

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
    expect(NUOVE_MANCHE_5).toHaveLength(13);
    expect(NUOVE_MANCHE_5.map((x) => x.def.number).sort((a, b) => a - b)).toEqual([66, 67, 68, 70, 72, 73, 74, 75, 76, 77, 78, 79, 80]);
    for (const x of NUOVE_MANCHE_5) {
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

// ---------------------------------------------------------------------------
// Regole specifiche
// ---------------------------------------------------------------------------

type Opt = { id: string };
const wrongOf = (options: Opt[], ok: string) => options.find((o) => o.id !== ok)!.id;
const four = () => [team(1, 2), team(2, 2), team(3, 2), team(4, 2)];

describe("TIG manche 5 · regole", () => {
  it("66 Ultima chiamata: +40 a risposta e +40 con 3 su 3; chiamate aperte a tempo; la velocità fa solo da spareggio", () => {
    type C = { calls: { id: string; options: Opt[] }[]; solution: { answers: Record<string, string> } };
    const def = m<C, { answers: Record<string, string> }>("ultima-chiamata");
    const c = first<C>("ultima-chiamata");
    const right = c.solution.answers;
    const one = c.calls[0].id;
    const oneWrong = { ...right, [one]: wrongOf(c.calls[0].options, right[one]) };
    const ctx = makeCtx(def as MechanicDef, four());
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { answers: right }, 50000), sub("t2", { answers: right }, 35000), sub("t3", { answers: oneWrong }, 34000), sub("t4", { answers: {} }, 33000)] });
    expect(byTeam(out)).toEqual({ t1: 160, t2: 160, t3: 80, t4: 0 });
    const acc = Object.fromEntries(out.outcomes.map((o) => [o.teamId, o.accuracy!]));
    expect(acc.t2).toBeGreaterThan(acc.t1);
    expect(acc.t1).toBeGreaterThan(0.95);
    expect(summaryOf<{ ranking: { teamId: string }[] }>(out)!.ranking.map((r) => r.teamId)).toEqual(["t2", "t1", "t3", "t4"]);
    const at = MECHANIC_EXTRAS["ultima-chiamata"].publicViewAt!;
    const open = (ms: number) => (at(c, ctx, ms) as { calls: { prompt: string | null }[] }).calls.filter((x) => x.prompt).length;
    expect([open(1000), open(16000), open(31000)]).toEqual([1, 2, 3]);
  });

  it("67 La cassa chiusa: +30 per serratura, +30 se si apre tutta", () => {
    type C = { locks: { id: string }[]; solution: { codes: Record<string, string> } };
    const def = m<C, { codes: Record<string, string> }>("la-cassa-chiusa");
    const c = first<C>("la-cassa-chiusa");
    const codes = c.solution.codes;
    const [l1, l2] = c.locks.map((l) => l.id);
    const out = def.score({
      content: c,
      ctx: makeCtx(def as MechanicDef, four()),
      submissions: [sub("t1", { codes }), sub("t2", { codes: { ...codes, [l2]: "999" } }), sub("t3", { codes: { [l1]: codes[l1] } }), sub("t4", { codes: {} })],
    });
    expect(byTeam(out)).toEqual({ t1: 120, t2: 60, t3: 30, t4: 0 });
  });

  it("68 Solo un dettaglio: la clip parte solo durante la proiezione, la domanda solo dopo; +100 e rapidità dalla fine della clip", () => {
    type C = { clipMs: number; options: Opt[]; solution: { optionId: string }; clip: { actors: { track: { at: number; x: number; y: number }[] }[] } };
    const def = m<C, { optionId: string }>("solo-un-dettaglio");
    for (const c of variants<C>("solo-un-dettaglio")) {
      const ctx = makeCtx(def as MechanicDef);
      const at = MECHANIC_EXTRAS["solo-un-dettaglio"].publicViewAt!;
      const end = COUNTDOWN_MS + c.clipMs;
      const during = at(c, ctx, end - 1) as { clip: unknown; prompt: string | null; options: unknown };
      const after = at(c, ctx, end) as { clip: unknown; alt: unknown; prompt: string | null };
      expect(during.clip).not.toBeNull();
      expect(during.prompt).toBeNull();
      expect(during.options).toBeNull();
      expect(after.clip).toBeNull();
      expect(after.alt).toBeNull();
      expect(after.prompt).not.toBeNull();
      expect(end).toBeLessThan(def.timerSec * 1000 - 25000);
    }
    const c = first<C>("solo-un-dettaglio");
    const end = COUNTDOWN_MS + c.clipMs;
    const ok = c.solution.optionId;
    const out = def.score({ content: c, ctx: makeCtx(def as MechanicDef), submissions: [sub("t1", { optionId: ok }, end), sub("t2", { optionId: ok }, 50000), sub("t3", { optionId: wrongOf(c.options, ok) }, end)] });
    expect(byTeam(out)).toEqual({ t1: 120, t2: 100, t3: 0 });
    // animazione: posa interpolata, fuori dai fotogrammi l'oggetto non c'è
    const track = [{ at: 1000, x: 0, y: 50 }, { at: 3000, x: 100, y: 50 }];
    expect(poseAt({ track }, 500)).toBeNull();
    expect(poseAt({ track }, 2000)!.x).toBeCloseTo(50, 5);
    expect(poseAt({ track }, 3000)!.x).toBe(100);
    expect(poseAt({ track }, 3001)).toBeNull();
  });

  it("70 Punto di rottura: ottimo 120, percorso valido 60, rottura o percorso inesistente 0; ottimo unico in ogni variante", () => {
    type C = { tree: never[]; resources: never[]; solution: { path: string[] } };
    const def = m<C, { path: string[] }>("punto-di-rottura");
    for (const c of variants<C>("punto-di-rottura")) {
      const all = allPaths(c);
      const valid = all.filter((p) => p.valid);
      const best = Math.max(...valid.map((p) => p.gain));
      expect(valid.filter((p) => p.gain === best).map((p) => p.path)).toEqual([c.solution.path]);
      expect(all.length - valid.length).toBeGreaterThanOrEqual(3);
    }
    const c = first<C>("punto-di-rottura");
    const all = allPaths(c);
    const okPath = c.solution.path;
    const validOther = all.find((p) => p.valid && p.path.join() !== okPath.join())!.path;
    const broken = all.find((p) => !p.valid)!.path;
    const out = def.score({
      content: c,
      ctx: makeCtx(def as MechanicDef, four()),
      submissions: [sub("t1", { path: okPath }), sub("t2", { path: validOther }), sub("t3", { path: broken }), sub("t4", { path: ["x", "y", "z"] })],
    });
    expect(byTeam(out)).toEqual({ t1: 120, t2: 60, t3: 0, t4: 0 });
  });

  it("72 Duello silenzioso: coppie dal seme (trio se dispari), primo giusto +100, entro 3 s pareggio +60, mai punti persi", () => {
    type C = { digits: number; rows: never[]; solution: { pin: string } };
    const def = m<C, { pin: string }>("duello-silenzioso");
    for (const c of variants<C>("duello-silenzioso")) expect(candidatesFor(c.digits, c.rows)).toEqual([c.solution.pin]);
    const c = first<C>("duello-silenzioso");
    const pin = c.solution.pin;
    const bad = pin.split("").reverse().join("");
    // due tavoli: il primo giusto vince; giusti a 2 s di distanza: pareggio valido
    const two = makeCtx(def as MechanicDef, [team(1, 2), team(2, 2)]);
    expect(byTeam(def.score({ content: c, ctx: two, submissions: [sub("t1", { pin }, 20000), sub("t2", { pin }, 30000)] }))).toEqual({ t1: 100, t2: 0 });
    expect(byTeam(def.score({ content: c, ctx: two, submissions: [sub("t1", { pin }, 20000), sub("t2", { pin }, 22000)] }))).toEqual({ t1: 60, t2: 60 });
    expect(byTeam(def.score({ content: c, ctx: two, submissions: [sub("t1", { pin: bad }, 10000), sub("t2", { pin }, 60000)] }))).toEqual({ t1: 0, t2: 100 });
    // cinque tavoli: due coppie e un trio, ognuno in un solo gruppo
    const five = makeCtx(def as MechanicDef, [team(1, 2), team(2, 2), team(3, 2), team(4, 2), team(5, 2)]);
    const groups = (def.publicView(c, five) as { groups: { teamId: string }[][] }).groups;
    expect(groups.map((g) => g.length).sort()).toEqual([2, 3]);
    expect(groups.flat().map((t) => t.teamId).sort()).toEqual(["t1", "t2", "t3", "t4", "t5"]);
    const out = def.score({ content: c, ctx: five, submissions: five.teams.map((t, i) => sub(t.teamId, { pin }, 10000 + i * 5000)) });
    for (const o of out.outcomes) expect([0, 60, 100]).toContain(o.points);
    expect(out.outcomes.filter((o) => o.points === 100)).toHaveLength(2);
  });

  it("73 L'imboscata: ogni tavolo è bersaglio una volta; difesa +60+rischio; difesa caduta = furto del rischio e +20 all'avversario", () => {
    type C = { traps: { id: string; options: Opt[] }[]; solution: { answers: Record<string, string> } };
    type S = { trap: string; stake: 0 | 20 | 40; answers: Record<string, string> };
    const def = m<C, S>("l-imboscata");
    const c = first<C>("l-imboscata");
    const ctx = makeCtx(def as MechanicDef, four());
    const links = (def.publicView(c, ctx) as { links: { teamId: string; targetId: string; attackerId: string }[] }).links;
    expect(new Set(links.map((l) => l.targetId)).size).toBe(4);
    for (const l of links) expect(l.targetId).not.toBe(l.teamId);
    const right = c.solution.answers;
    const [trap0] = c.traps;
    const wrong = { ...right, [trap0.id]: wrongOf(trap0.options, right[trap0.id]) };
    // tutti scelgono la prima trappola; t1 la sbaglia e rischia 40, gli altri rispondono giusto e rischiano 20
    const subs = ctx.teams.map((t) => sub(t.teamId, { trap: trap0.id, stake: (t.teamId === "t1" ? 40 : 20) as 0 | 20 | 40, answers: t.teamId === "t1" ? wrong : right }));
    const out = def.score({ content: c, ctx, submissions: subs });
    const attackerOfT1 = links.find((l) => l.teamId === "t1")!.attackerId;
    const pts = byTeam(out);
    expect(pts.t1).toBe(0);
    expect(pts[attackerOfT1]).toBe(80 + 20);
    const tr = out.outcomes.find((o) => o.teamId === attackerOfT1)!.transfers!;
    expect(tr).toEqual([{ toTeamId: "t1", points: 40, reason: "Imboscata riuscita" }]);
    for (const id of ["t2", "t3", "t4"].filter((x) => x !== attackerOfT1)) expect(pts[id]).toBe(80);
    // un tavolo solo: niente avversario, la trappola la sceglie la casa e il rischio perso va perso
    const solo = makeCtx(def as MechanicDef, [team(9, 2)]);
    const allWrong = Object.fromEntries(c.traps.map((t) => [t.id, wrongOf(t.options, right[t.id])]));
    expect(byTeam(def.score({ content: c, ctx: solo, submissions: [sub("t9", { trap: trap0.id, stake: 40, answers: allWrong })] })).t9).toBe(-40);
  });

  it("74 Tre carte: mazzo dal seme con impronta mostrata prima; facce solo dopo la girata; giusta = ricompensa della carta", () => {
    type C = { cards: { id: string; reward: number; options: Opt[] }[]; solution: { answers: Record<string, string> } };
    const def = m<C, { slot: "A" | "B" | "C"; optionId: string }>("tre-carte-un-destino");
    const c = first<C>("tre-carte-un-destino");
    const ctx = makeCtx(def as MechanicDef);
    const at = MECHANIC_EXTRAS["tre-carte-un-destino"].publicViewAt!;
    expect((at(c, ctx, 5000) as { faces: unknown }).faces).toBeNull();
    expect((at(c, ctx, 12000) as { faces: unknown[] }).faces).toHaveLength(3);
    const deal = dealCards(
      c.cards.map((k) => k.id),
      `${ctx.seed}:carte`,
    );
    const cardA = c.cards.find((k) => k.id === deal.A)!;
    const cardB = c.cards.find((k) => k.id === deal.B)!;
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { slot: "A", optionId: c.solution.answers[cardA.id] }), sub("t2", { slot: "B", optionId: wrongOf(cardB.options, c.solution.answers[cardB.id]) })] });
    expect(byTeam(out)).toEqual({ t1: cardA.reward, t2: 0, t3: 0 });
    const s = summaryOf<{ draw: string; deckPrint: string }>(out)!;
    expect(fingerprint(s.draw)).toBe(s.deckPrint);
    expect((def.publicView(c, ctx) as { deckPrint: string }).deckPrint).toBe(s.deckPrint);
  });

  it("75 Il mercato finale: un indizio al massimo 50; giusta +120 − spesa, sbagliata −spesa; mai oltre il 25% del saldo", () => {
    type C = { options: Opt[]; hints: { id: string; price: number }[]; solution: { optionId: string } };
    const def = m<C, { buy: string | null; optionId: string }>("il-mercato-finale");
    const base = first<C>("il-mercato-finale");
    for (const v of variants<C>("il-mercato-finale")) for (const h of v.hints) expect(h.price).toBeLessThanOrEqual(50);
    const ok = base.solution.optionId;
    const ko = wrongOf(base.options, ok);
    const dear = base.hints.slice().sort((a, b) => b.price - a.price)[0];
    const c = { ...base, balances: { t1: 1000, t2: 1000, t3: 100, t4: 1000 } };
    const out = def.score({
      content: c,
      ctx: makeCtx(def as MechanicDef, four()),
      submissions: [sub("t1", { buy: dear.id, optionId: ok }), sub("t2", { buy: dear.id, optionId: ko }), sub("t3", { buy: dear.id, optionId: ko }), sub("t4", { buy: null, optionId: ok })],
    });
    expect(byTeam(out)).toEqual({ t1: 120 - dear.price, t2: -dear.price, t3: -Math.min(dear.price, 25), t4: 120 });
    const mv = def.memberView!(c, { ...makeCtx(def as MechanicDef, four()), teamId: "t3", memberId: "t3m0", memberIndex: 0 }) as { maxSpend: number };
    expect(mv.maxSpend).toBe(25);
    expect(JSON.stringify(def.publicView(c, makeCtx(def as MechanicDef)))).not.toContain("balances");
  });

  it("76 Il filo rosso: +30 a tessera, +60 se il filo è completo", () => {
    type C = { slots: { id: string; options: Opt[] }[]; solution: { answers: Record<string, string> } };
    const def = m<C, { answers: Record<string, string> }>("il-filo-rosso");
    const c = first<C>("il-filo-rosso");
    const right = c.solution.answers;
    const s0 = c.slots[0];
    const s1 = c.slots[1];
    const out = def.score({
      content: c,
      ctx: makeCtx(def as MechanicDef, four()),
      submissions: [
        sub("t1", { answers: right }),
        sub("t2", { answers: { ...right, [s0.id]: wrongOf(s0.options, right[s0.id]) } }),
        sub("t3", { answers: { ...right, [s0.id]: wrongOf(s0.options, right[s0.id]), [s1.id]: wrongOf(s1.options, right[s1.id]) } }),
        sub("t4", { answers: {} }),
      ],
    });
    expect(byTeam(out)).toEqual({ t1: 150, t2: 60, t3: 30, t4: 0 });
  });

  it("77 Classifica buia: prudenza +50; rischio +160 o −25% del proprio saldo (max 100); domanda dopo 15 s; solo il proprio saldo", () => {
    type C = { options: Opt[]; solution: { optionId: string } };
    const def = m<C, { choice: "prudenza" } | { choice: "rischio"; optionId: string }>("classifica-buia");
    const base = first<C>("classifica-buia");
    const ok = base.solution.optionId;
    const ko = wrongOf(base.options, ok);
    const c = { ...base, balances: { t1: 900, t2: 900, t3: 200, t4: 0 } };
    const ctx = makeCtx(def as MechanicDef, four());
    const out = def.score({
      content: c,
      ctx,
      submissions: [sub("t1", { choice: "prudenza" as const }), sub("t2", { choice: "rischio" as const, optionId: ok }), sub("t3", { choice: "rischio" as const, optionId: ko }), sub("t4", { choice: "rischio" as const, optionId: ko })],
    });
    expect(byTeam(out)).toEqual({ t1: 50, t2: 160, t3: -50, t4: 0 });
    expect(out.outcomes.find((o) => o.teamId === "t1")!.correct).toBeNull();
    const mv = (id: string) => def.memberView!(c, { ...ctx, teamId: id, memberId: `${id}m0`, memberIndex: 0 }) as { balance: number; loss: number };
    expect(mv("t1")).toEqual({ balance: 900, loss: 100 });
    expect(mv("t3")).toEqual({ balance: 200, loss: 50 });
    const at = MECHANIC_EXTRAS["classifica-buia"].publicViewAt!;
    expect((at(c, ctx, 14000) as { prompt: string | null }).prompt).toBeNull();
    expect((at(c, ctx, 15000) as { prompt: string | null }).prompt).not.toBeNull();
    expect(JSON.stringify(def.publicView(c, ctx))).not.toContain("balances");
  });

  it("78 La penultima mossa: +60 / −30 a colpo, la difesa annulla il −30 dove è giocata; l'ultima arriva dopo 20 s", () => {
    type C = { rounds: { id: string; options: Opt[] }[]; solution: { answers: Record<string, string> } };
    const def = m<C, { shield: "penultima" | "ultima"; answers: Record<string, string> }>("la-penultima-mossa");
    const c = first<C>("la-penultima-mossa");
    const [r1, r2] = c.rounds;
    const right = c.solution.answers;
    const w1 = { ...right, [r1.id]: wrongOf(r1.options, right[r1.id]) };
    const bothWrong = { [r1.id]: wrongOf(r1.options, right[r1.id]), [r2.id]: wrongOf(r2.options, right[r2.id]) };
    const out = def.score({
      content: c,
      ctx: makeCtx(def as MechanicDef, four()),
      submissions: [sub("t1", { shield: "ultima" as const, answers: right }), sub("t2", { shield: "penultima" as const, answers: w1 }), sub("t3", { shield: "ultima" as const, answers: w1 }), sub("t4", { shield: "ultima" as const, answers: bothWrong })],
    });
    expect(byTeam(out)).toEqual({ t1: 120, t2: 60, t3: 30, t4: -30 });
    const at = MECHANIC_EXTRAS["la-penultima-mossa"].publicViewAt!;
    const ctx = makeCtx(def as MechanicDef);
    expect((at(c, ctx, 19000) as { rounds: { prompt: string | null }[] }).rounds[1].prompt).toBeNull();
    expect((at(c, ctx, 20000) as { rounds: { prompt: string | null }[] }).rounds[1].prompt).not.toBeNull();
  });

  it("79 Falso finale: la classifica finta resta visibile, la prova bonus parte dopo 7 s; +100 più rapidità, mai punti persi", () => {
    type C = { options: Opt[]; solution: { optionId: string } };
    const def = m<C, { optionId: string }>("falso-finale");
    const c = first<C>("falso-finale");
    const ctx = makeCtx(def as MechanicDef);
    const at = MECHANIC_EXTRAS["falso-finale"].publicViewAt!;
    const before = at(c, ctx, 6000) as { board: unknown; prompt: string | null; twist: string | null };
    expect(before.board).not.toBeNull();
    expect(before.prompt).toBeNull();
    expect(before.twist).toBeNull();
    expect((at(c, ctx, 7000) as { prompt: string | null }).prompt).not.toBeNull();
    const ok = c.solution.optionId;
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { optionId: ok }, 7000), sub("t2", { optionId: ok }, 60000), sub("t3", { optionId: wrongOf(c.options, ok) }, 8000)] });
    expect(byTeam(out)).toEqual({ t1: 120, t2: 100, t3: 0 });
  });

  it("80 L'ultima decisione: sicuro 100/0, rischio 240 o −25% del saldo; enigma dopo la scelta; esiti dal fondo alla vetta", () => {
    type C = { options: Opt[]; solution: { optionId: string } };
    const def = m<C, { choice: "sicuro" | "rischio"; optionId: string }>("l-ultima-decisione");
    const base = first<C>("l-ultima-decisione");
    const ok = base.solution.optionId;
    const ko = wrongOf(base.options, ok);
    const c = { ...base, balances: { t1: 600, t2: 600, t3: 600, t4: 2000 } };
    const ctx = makeCtx(def as MechanicDef, four());
    const out = def.score({
      content: c,
      ctx,
      submissions: [sub("t1", { choice: "sicuro" as const, optionId: ok }), sub("t2", { choice: "sicuro" as const, optionId: ko }), sub("t3", { choice: "rischio" as const, optionId: ok }), sub("t4", { choice: "rischio" as const, optionId: ko })],
    });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 0, t3: 240, t4: -250 });
    expect(summaryOf<{ ladder: { teamId: string }[] }>(out)!.ladder.map((x) => x.teamId)).toEqual(["t4", "t2", "t1", "t3"]);
    expect((def.memberView!(c, { ...ctx, teamId: "t1", memberId: "t1m0", memberIndex: 0 }) as { stake: number }).stake).toBe(150);
    const at = MECHANIC_EXTRAS["l-ultima-decisione"].publicViewAt!;
    expect((at(c, ctx, 14000) as { prompt: string | null }).prompt).toBeNull();
    expect((at(c, ctx, 15000) as { prompt: string | null }).prompt).not.toBeNull();
  });
});
