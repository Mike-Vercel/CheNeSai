import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UI_MANCHE_4 } from "@/features/tig/games/manche-4";
import { MECHANIC_EXTRAS, mechanicByCode } from "@/lib/tig/games";
import { loadVariants } from "@/lib/tig/games/content-core";
import type { AcceptedSubmission, MechanicDef, MemberCtx, PhaseCtx, TeamRef } from "@/lib/tig/games/contract";
import { summaryOf } from "@/lib/tig/games/extras";
import { FORBIDDEN_PUBLIC_KEYS } from "@/lib/tig/games/mechanics/_shared";
import { isBuyer, pairsOf, remainingAfter, seatsOf, TELLTALE_ID } from "@/lib/tig/games/mechanics/_m4";
import { tamperedFields, type ArchivioContent } from "@/lib/tig/games/mechanics/archivio-manomesso";
import { ROUND2_AT_MS, type CambiaContent } from "@/lib/tig/games/mechanics/chi-cambia-versione";
import type { CompraContent } from "@/lib/tig/games/mechanics/compra-un-indizio";
import { DOPPIO_PAYOFF, type DoppioContent, type DoppioSummary } from "@/lib/tig/games/mechanics/doppio-gioco";
import { consistentCulprits, type FiduciaContent, type FiduciaSummary } from "@/lib/tig/games/mechanics/fiducia-cieca";
import type { TestimoneContent, TestimoneMemberView } from "@/lib/tig/games/mechanics/il-testimone";
import { lieTarget, type BugiaContent, type BugiaMemberView } from "@/lib/tig/games/mechanics/la-bugia-piu-credibile";
import { bancoMove, FRASE_PAYOFF, type FraseContent, type FraseMemberView } from "@/lib/tig/games/mechanics/la-frase-a-meta";
import { NUOVE_MANCHE_4 } from "@/lib/tig/games/mechanics/manche-4";
import { cheapestSure, type NegozioContent } from "@/lib/tig/games/mechanics/negozio-di-sospetti";
import { ULTIMO_POINTS, type UltimoContent } from "@/lib/tig/games/mechanics/ultimo-indizio";

/**
 * MANCHE 4 «IL GRANDE INGANNO» — test delle 12 meccaniche aggiunte (50, 52, 53, 55–58, 60–64). Le proprietà
 * comuni (vista pubblica senza soluzioni, determinismo, invii doppi, tetti) le verifica già
 * tests/unit/tig-giochi.test.ts su tutte le meccaniche registrate; qui: contenuti, regole specifiche,
 * giro/coppie da 1 a 12 tavoli e schermate disegnate in tutte le fasi (rendering statico, niente browser).
 */

const CONTENT = loadVariants();
const CODES = NUOVE_MANCHE_4.map((m) => m.def.code);

function team(n: number, members: number): TeamRef {
  return { teamId: `t${n}`, tableNo: n, members: Array.from({ length: members }, (_, i) => `t${n}m${i}`), captainId: `t${n}m0` };
}

function teamsN(n: number): TeamRef[] {
  return Array.from({ length: n }, (_, i) => team(i + 1, 1 + (i % 4)));
}

function makeCtx(def: MechanicDef, teams: TeamRef[] = [team(1, 3), team(2, 2), team(3, 5)], seed = "test-seed"): PhaseCtx {
  return { gameInstanceId: "gi", startsAt: 1_000_000, deadlineAt: 1_000_000 + def.timerSec * 1000, teams, participants: teams.map((t) => t.teamId), seed };
}

function memberCtx(ctx: PhaseCtx, t: TeamRef, i = 0): MemberCtx {
  return { ...ctx, teamId: t.teamId, memberId: t.members[i], memberIndex: i };
}

function sub<S>(teamId: string, payload: S, elapsedMs = 5000, memberId = `${teamId}m0`): AcceptedSubmission<S> {
  return { teamId, memberId, elapsedMs, payload };
}

function variants<C>(code: string): C[] {
  return CONTENT[code] as unknown as C[];
}

function m<C = unknown, S = unknown>(code: string): MechanicDef<C, S> {
  const d = mechanicByCode(code);
  if (!d) throw new Error(code);
  return d as unknown as MechanicDef<C, S>;
}

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

const byTeam = (out: { outcomes: { teamId: string; points: number }[] }) => Object.fromEntries(out.outcomes.map((o) => [o.teamId, o.points]));

// ---------------------------------------------------------------------------
// Registro e contenuti
// ---------------------------------------------------------------------------

describe("TIG manche 4 · registro e contenuti", () => {
  it("le 12 meccaniche nuove sono registrate col numero e l'ingresso del catalogo", () => {
    const expected: Record<string, [number, string]> = {
      "il-testimone": [50, "coop"],
      "archivio-manomesso": [52, "team"],
      "compra-un-indizio": [53, "team"],
      "fiducia-cieca": [55, "duel"],
      "la-bugia-piu-credibile": [56, "duel"],
      "doppio-gioco": [57, "duel"],
      "il-messaggio-interrotto": [58, "team"],
      "chi-cambia-versione": [60, "team"],
      "negozio-di-sospetti": [61, "team"],
      "la-finta-prova": [62, "team"],
      "la-frase-a-meta": [63, "duel"],
      "ultimo-indizio": [64, "team"],
    };
    expect(CODES.slice().sort()).toEqual(Object.keys(expected).sort());
    for (const [code, [number, input]] of Object.entries(expected)) {
      const d = m(code);
      expect(d.number, code).toBe(number);
      expect(d.input, code).toBe(input);
      expect(d.manche).toBe(4);
      expect(d.oneDeviceOk, code).toBe(true);
      expect(UI_MANCHE_4[code], `schermate di ${code}`).toBeTruthy();
    }
  });

  it("almeno 10 varianti per meccanica, id unici, tutte e tre le difficoltà", () => {
    for (const code of CODES) {
      const vs = variants<{ id: string; difficulty: string }>(code);
      expect(vs.length, code).toBeGreaterThanOrEqual(10);
      expect(new Set(vs.map((v) => v.id)).size, code).toBe(vs.length);
      expect([...new Set(vs.map((v) => v.difficulty))].sort(), `${code}: difficoltà`).toEqual(["difficile", "facile", "media"]);
    }
  });

  it("la vista pubblica conserva titolo e numero della meccanica (la cornice della TV li mostra)", () => {
    for (const code of CODES) {
      const def = m(code);
      const extras = MECHANIC_EXTRAS[code];
      const c = variants<unknown>(code)[0];
      const ctx = makeCtx(def);
      for (const v of [def.publicView(c, ctx), ...(extras.publicViewAt ? [extras.publicViewAt(c, ctx, 30_000)] : [])] as { title: string; number: number }[]) {
        expect(v.title, code).toBe(def.title);
        expect(v.number, code).toBe(def.number);
      }
    }
  });

  it("nessuna vista pubblica (anche a tempo) né privata contiene chiavi vietate, con 2 e con 12 tavoli", () => {
    for (const code of CODES) {
      const def = m(code);
      const extras = MECHANIC_EXTRAS[code];
      for (const c of variants<{ explain: string }>(code)) {
        for (const teams of [teamsN(2), teamsN(12)]) {
          const ctx = makeCtx(def, teams);
          const views: unknown[] = [def.publicView(c, ctx)];
          if (extras.publicViewAt) views.push(extras.publicViewAt(c, ctx, 0), extras.publicViewAt(c, ctx, 20_000), extras.publicViewAt(c, ctx, 50_000));
          for (const v of views) {
            const keys = deepKeys(v);
            for (const k of FORBIDDEN_PUBLIC_KEYS) expect(keys, `${code}: «${k}»`).not.toContain(k);
            expect(JSON.stringify(v)).not.toContain(c.explain);
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Aiuti comuni: giro e coppie da 1 a 12 tavoli
// ---------------------------------------------------------------------------

describe("TIG manche 4 · giro e coppie", () => {
  it("giro: ognuno parla al successivo, mai lo stesso caso del vicino (1–12 tavoli)", () => {
    const def = m("la-bugia-piu-credibile");
    for (let n = 1; n <= 12; n++) {
      const seats = seatsOf(makeCtx(def, teamsN(n)), 3);
      expect(seats).toHaveLength(n);
      if (n > 1) for (const s of seats) expect(seats.find((x) => x.teamId === s.tellsTo)!.color).not.toBe(s.color);
    }
  });
  it("coppie: tutti in una coppia, con numero dispari l'ultimo contro il banco", () => {
    const def = m("la-frase-a-meta");
    for (let n = 1; n <= 12; n++) {
      const pairs = pairsOf(makeCtx(def, teamsN(n)));
      const ids = pairs.flatMap((p) => [p.a.teamId, ...(p.b ? [p.b.teamId] : [])]);
      expect(new Set(ids).size).toBe(n);
      expect(pairs.filter((p) => !p.b).length).toBe(n % 2);
    }
  });
  it("chi compra per il tavolo: il capitano, o il primo telefono se il capitano non c'è", () => {
    const def = m("compra-un-indizio");
    const t = team(1, 3);
    const ctx = makeCtx(def, [t]);
    expect(isBuyer(memberCtx(ctx, t, 0))).toBe(true);
    expect(isBuyer(memberCtx(ctx, t, 1))).toBe(false);
    const noCap = { ...t, captainId: "assente" };
    const ctx2 = makeCtx(def, [noCap]);
    expect(isBuyer(memberCtx(ctx2, noCap, 0))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Regole specifiche
// ---------------------------------------------------------------------------

describe("TIG manche 4 · regole", () => {
  it("64 Ultimo indizio: 100/80/60/40 secondo l'indizio aperto al blocco; i sospettati calano fino a uno", () => {
    const def = m<UltimoContent, { optionId: string }>("ultimo-indizio");
    for (const c of variants<UltimoContent>("ultimo-indizio")) {
      const ids = c.suspects.map((s) => s.id);
      expect(remainingAfter(ids, c.clues.map((k) => k.clears)), c.id).toEqual([c.solution.optionId]);
    }
    const c = variants<UltimoContent>("ultimo-indizio")[0];
    const ctx = makeCtx(def as MechanicDef, [team(1, 1), team(2, 1), team(3, 1), team(4, 1)]);
    const ok = c.solution.optionId;
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { optionId: ok }, 5000), sub("t2", { optionId: ok }, 20000), sub("t3", { optionId: ok }, 59000), sub("t4", { optionId: c.suspects.find((s) => s.id !== ok)!.id }, 3000)] });
    expect(byTeam(out)).toEqual({ t1: ULTIMO_POINTS[0], t2: ULTIMO_POINTS[1], t3: ULTIMO_POINTS[3], t4: 0 });
    const at = MECHANIC_EXTRAS["ultimo-indizio"].publicViewAt!;
    expect((at(c, ctx, 1000) as { clues: (string | null)[] }).clues.filter(Boolean)).toHaveLength(1);
    expect((at(c, ctx, 31000) as { clues: (string | null)[] }).clues.filter(Boolean)).toHaveLength(3);
  });

  it("52 Archivio manomesso: la regola della maggioranza trova proprio il campo della soluzione", () => {
    for (const c of variants<ArchivioContent>("archivio-manomesso")) {
      const { tampered, witnesses } = tamperedFields(c.docs);
      expect(tampered, c.id).toEqual([c.solution.fieldId]);
      expect(witnesses.length, c.id).toBeGreaterThanOrEqual(2);
      for (const d of c.docs) for (const f of d.fields) expect(f.id).toMatch(/^[a-f][1-6]$/);
    }
  });

  it("53 Compra un indizio: 100 senza comprare, 80 comprando, 0 se sbagliata (mai negativo)", () => {
    const def = m<CompraContent, { optionId: string; bought: boolean }>("compra-un-indizio");
    const c = variants<CompraContent>("compra-un-indizio")[0];
    const ctx = makeCtx(def as MechanicDef);
    const ok = c.solution.optionId;
    const ko = c.suspects.find((s) => s.id !== ok)!.id;
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { optionId: ok, bought: false }), sub("t2", { optionId: ok, bought: true }), sub("t3", { optionId: ko, bought: true })] });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 80, t3: 0 });
    expect(summaryOf<{ bought: string[] }>(out)?.bought.sort()).toEqual(["t2", "t3"]);
    // il dettaglio arriva solo al telefono che compra
    const t = ctx.teams[0];
    expect((def.memberView!(c, memberCtx(ctx, t, 0)) as { extra: string | null }).extra).toBe(c.extra.text);
    expect((def.memberView!(c, memberCtx(ctx, t, 1)) as { extra: string | null }).extra).toBeNull();
    // metà dei casi si risolve anche senza comprare, l'altra metà no
    const free = variants<CompraContent>("compra-un-indizio").filter((v) => remainingAfter(v.suspects.map((s) => s.id), v.clues.map((k) => k.clears)).length === 1).length;
    expect(free).toBeGreaterThanOrEqual(3);
    expect(free).toBeLessThanOrEqual(7);
  });

  it("61 Negozio di sospetti: 100 meno la spesa, mai negativo; tutte le prove chiudono il caso", () => {
    const def = m<NegozioContent, { optionId: string; bought: string[] }>("negozio-di-sospetti");
    for (const c of variants<NegozioContent>("negozio-di-sospetti")) {
      expect(remainingAfter(c.suspects.map((s) => s.id), c.proofs.map((p) => p.clears)), c.id).toEqual([c.solution.optionId]);
      expect(cheapestSure(c).cost, c.id).toBeLessThanOrEqual(60);
    }
    const c = variants<NegozioContent>("negozio-di-sospetti")[0];
    const ctx = makeCtx(def as MechanicDef);
    const ok = c.solution.optionId;
    const all = c.proofs.map((p) => p.id);
    const cost = c.proofs.reduce((s, p) => s + p.price, 0);
    const out = def.score({
      content: c,
      ctx,
      submissions: [sub("t1", { optionId: ok, bought: [] }), sub("t2", { optionId: ok, bought: [...all, ...all, "inventata"] }), sub("t3", { optionId: c.suspects.find((s) => s.id !== ok)!.id, bought: all })],
    });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 100 - cost, t3: 0 });
  });

  it("60 Chi cambia versione: il 1° giro non parte dopo i 22 s e il 2° non parte prima", () => {
    const def = m<CambiaContent, { personId: string }>("chi-cambia-versione");
    const c = variants<CambiaContent>("chi-cambia-versione")[0];
    const ctx = makeCtx(def as MechanicDef);
    const at = MECHANIC_EXTRAS["chi-cambia-versione"].publicViewAt!;
    const v1 = at(c, ctx, 5000) as { first: (string | null)[]; second: (string | null)[]; evidence: string | null };
    const v2 = at(c, ctx, ROUND2_AT_MS + 1) as typeof v1;
    expect(v1.first.every(Boolean)).toBe(true);
    expect(v1.second.every((x) => x === null)).toBe(true);
    expect(v1.evidence).toBeNull();
    expect(v2.first.every((x) => x === null)).toBe(true);
    expect(v2.second.every(Boolean)).toBe(true);
    expect(v2.evidence).toBe(c.evidence);
  });

  it("55 Fiducia cieca: un solo colpevole possibile; da soli 100, fiducia 70 + 30 a chi suggerisce; catena e giro vuoto", () => {
    for (const c of variants<FiduciaContent>("fiducia-cieca")) {
      expect(consistentCulprits(c.people.map((p) => p.id), c.statements, c.liars), c.id).toEqual([c.solution.optionId]);
    }
    const def = m<FiduciaContent, { trust: boolean; answer?: string }>("fiducia-cieca");
    const c = variants<FiduciaContent>("fiducia-cieca")[0];
    const ctx = makeCtx(def as MechanicDef);
    const seats = seatsOf(ctx);
    const ok = c.solution.optionId;
    const [a, b, d] = seats.map((s) => s.teamId);
    // a risolve da solo; b (dopo a) si fida; d (dopo b) si fida → la risposta di a arriva fino a d.
    // a: 100 + 30 (b si è fidato di lui); b: 70 + 30 (d si è fidato di lui); d: 70
    const out = def.score({ content: c, ctx, submissions: [sub(a, { trust: false, answer: ok }), sub(b, { trust: true }), sub(d, { trust: true })] });
    expect(byTeam(out)).toEqual({ [a]: 100 + 30, [b]: 70 + 30, [d]: 70 });
    const links = summaryOf<FiduciaSummary>(out)!.links;
    expect(links.find((l) => l.teamId === d)!.sourceId).toBe(a);
    // tutti si fidano: nessuno ha risposto davvero
    const loop = def.score({ content: c, ctx, submissions: seats.map((s) => sub(s.teamId, { trust: true })) });
    expect(Object.values(byTeam(loop)).every((p) => p === 0)).toBe(true);
    // senza risposta propria e senza fiducia l'invio non è valido
    expect(def.submissionSchema.safeParse({ trust: false }).success).toBe(false);
  });

  it("57 Doppio gioco: vale la prova scelta dal tavolo precedente; rischiosa sbagliata −20; trappola +30, gioco pulito +10", () => {
    const def = m<DoppioContent, { give: "sicura" | "rischiosa"; sicura: string; rischiosa: string }>("doppio-gioco");
    const c = variants<DoppioContent>("doppio-gioco")[0];
    const teams = [team(1, 2), team(2, 2)];
    const ctx = makeCtx(def as MechanicDef, teams);
    const [x, y] = seatsOf(ctx).map((s) => s.teamId);
    const wrongR = c.rischiosa.options.find((o) => o.id !== c.solution.rischiosa)!.id;
    // x dà la rischiosa a y, che la sbaglia; y dà la sicura a x, che la risolve
    const out = def.score({ content: c, ctx, submissions: [sub(x, { give: "rischiosa", sicura: c.solution.sicura, rischiosa: c.solution.rischiosa }), sub(y, { give: "sicura", sicura: c.solution.sicura, rischiosa: wrongR })] });
    expect(byTeam(out)).toEqual({ [x]: DOPPIO_PAYOFF.sicura.giusta + DOPPIO_PAYOFF.scelta.trappola, [y]: DOPPIO_PAYOFF.rischiosa.sbagliata + DOPPIO_PAYOFF.scelta.pulito });
    expect(summaryOf<DoppioSummary>(out)!.links.find((l) => l.to === y)!.give).toBe("rischiosa");
  });

  it("56 La bugia più credibile: 30 a pezzo, 100 tutto; bugia valida solo con un pezzo cambiato; creduta +40", () => {
    const def = m<BugiaContent, { lie?: string[]; guess: string[] }>("la-bugia-piu-credibile");
    const c = variants<BugiaContent>("la-bugia-piu-credibile")[0];
    const teams = [team(1, 2), team(2, 2), team(3, 2)];
    const ctx = makeCtx(def as MechanicDef, teams);
    const mv = (t: TeamRef) => def.memberView!(c, memberCtx(ctx, t)) as BugiaMemberView;
    const views = teams.map(mv);
    // nessuno conosce la verità del proprio caso
    for (const v of views) expect(v.tellsTo!.case.id).not.toBe(v.myCase.id);
    const realOf = (caseId: string) => c.solution.cases[caseId].real;
    const caseOf = (id: string) => c.cases.find((k) => k.id === id)!;
    // t1 inganna il successivo sul pezzo 0; il successivo cade proprio lì
    const v1 = views[0];
    const target = v1.tellsTo!;
    const tReal = target.real;
    const fake = caseOf(target.case.id).parts[0].options.find((o) => o.id !== tReal[0])!.id;
    const lie = [fake, tReal[1], tReal[2]];
    expect(lieTarget(caseOf(target.case.id), tReal, lie)).toBe(0);
    expect(lieTarget(caseOf(target.case.id), tReal, tReal)).toBeNull();
    const subs = teams.map((t, i) => {
      const v = views[i];
      const myReal = realOf(v.myCase.id);
      const guess = t.teamId === target.teamId ? [fake, myReal[1], myReal[2]] : myReal;
      return sub(t.teamId, { lie: t.teamId === "t1" ? lie : v.tellsTo!.real.map((r, j) => (j === 2 ? caseOf(v.tellsTo!.case.id).parts[2].options.find((o) => o.id !== r)!.id : r)), guess });
    });
    const out = def.score({ content: c, ctx, submissions: subs });
    // t1: verità completa (100) + bugia creduta (40); il bersaglio: 2 pezzi su 3 (60), la sua bugia non attacca
    expect(byTeam(out)["t1"]).toBe(100 + 40);
    expect(byTeam(out)[target.teamId]).toBe(2 * 30);
    expect(out.outcomes.find((o) => o.teamId === target.teamId)!.label).toContain("ci siamo cascati");
  });

  it("63 La frase a metà: patto 70, inganno riuscito +30, ingannati vale l'ipotesi (40); il banco è deterministico", () => {
    const def = m<FraseContent, { move: "condividi" | "inganna"; guess: string }>("la-frase-a-meta");
    const c = variants<FraseContent>("la-frase-a-meta")[0];
    const teams = [team(1, 2), team(2, 2), team(3, 1)];
    const ctx = makeCtx(def as MechanicDef, teams);
    const [pair, solo] = pairsOf(ctx);
    const good = (t: string) => {
      const mv = def.memberView!(c, memberCtx(ctx, teams.find((x) => x.teamId === t)!)) as FraseMemberView;
      const s = c.sentences.find((x) => x.topic === mv.topic)!;
      const sol = c.solution.sentences[s.id];
      return mv.side === "inizio" ? sol.end : sol.start;
    };
    const a = pair.a.teamId;
    const b = pair.b!.teamId;
    const out = def.score({ content: c, ctx, submissions: [sub(a, { move: "inganna", guess: good(a) }), sub(b, { move: "condividi", guess: good(b) })] });
    expect(byTeam(out)[a]).toBe(FRASE_PAYOFF.patto + FRASE_PAYOFF.inganno);
    expect(byTeam(out)[b]).toBe(FRASE_PAYOFF.ipotesi);
    expect(solo.b).toBeNull();
    expect(bancoMove(ctx, solo.index)).toBe(bancoMove(ctx, solo.index));
    const both = def.score({ content: c, ctx, submissions: [sub(a, { move: "condividi", guess: "x" }), sub(b, { move: "condividi", guess: "x" })] });
    expect(byTeam(both)[a]).toBe(FRASE_PAYOFF.patto);
    expect(byTeam(both)[b]).toBe(FRASE_PAYOFF.patto);
  });

  it("50 Il testimone: testimonianze divise tra i telefoni senza buchi; risposta 80 + testimone 20", () => {
    const def = m<TestimoneContent, { witnessId: string; optionId: string }>("il-testimone");
    for (const c of variants<TestimoneContent>("il-testimone")) for (const w of c.witnesses) expect(w.id).not.toMatch(TELLTALE_ID);
    const c = variants<TestimoneContent>("il-testimone")[0];
    for (let phones = 1; phones <= 6; phones++) {
      const t = team(1, phones);
      const ctx = makeCtx(def as MechanicDef, [t]);
      const seen = new Set<string>();
      for (let i = 0; i < phones; i++) for (const w of (def.memberView!(c, memberCtx(ctx, t, i)) as TestimoneMemberView).mine) seen.add(w.id);
      expect(seen.size).toBe(3);
    }
    const ctx = makeCtx(def as MechanicDef);
    const ok = c.solution.optionId;
    const ko = c.options.find((o) => o.id !== ok)!.id;
    const wrongW = c.witnesses.find((w) => w.id !== c.solution.witnessId)!.id;
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { witnessId: c.solution.witnessId, optionId: ok }), sub("t2", { witnessId: wrongW, optionId: ok }), sub("t3", { witnessId: c.solution.witnessId, optionId: ko })] });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 80, t3: 20 });
  });
});

// ---------------------------------------------------------------------------
// Schermate: ogni Player e ogni Tv si disegnano senza errori in tutte le fasi, anche con 12 tavoli
// ---------------------------------------------------------------------------

describe.each(CODES.map((c) => [c] as const))("TIG manche 4 · schermate di %s", (code) => {
  const def = mechanicByCode(code)!;
  const extras = MECHANIC_EXTRAS[code];
  const ui = UI_MANCHE_4[code];

  it("telefono e TV in gioco (vari istanti), a tempo scaduto e al reveal, con 3 e con 12 tavoli, anche per chi non è capitano", () => {
    for (const teams of [[team(1, 3), team(2, 2), team(3, 5)], teamsN(12)]) {
      for (const c of variants<{ explain: string }>(code).slice(0, 3)) {
        const ctx = makeCtx(def, teams);
        const subs = extras.demoSubmissions(c, ctx, "ui");
        const out = def.score({ content: c, ctx, submissions: subs });
        const rev = def.reveal(c, out);
        const tvTeams = ctx.teams.map((t, i) => ({ teamId: t.teamId, tableNo: t.tableNo, name: `Squadra ${i + 1}`, color: "#c6ff3d", submitted: i > 0 }));
        for (const [mi, me] of [ctx.teams[0], ctx.teams[ctx.teams.length - 1]].entries()) {
          const mv = def.memberView ? def.memberView(c, memberCtx(ctx, me, mi === 0 ? 0 : me.members.length - 1)) : null;
          for (const at of [0, 10_000, 25_000, 50_000, def.timerSec * 1000 - 1000]) {
            const view = extras.publicViewAt ? extras.publicViewAt(c, ctx, at) : def.publicView(c, ctx);
            const now = () => ctx.startsAt + at;
            for (const [stage, captain] of [
              ["play", true],
              ["play", false],
              ["locked", true],
            ] as const) {
              const html = renderToStaticMarkup(createElement(ui.Player, { view, memberView: mv, stage, deadlineAt: ctx.deadlineAt, now, canSubmit: captain, submitted: false, submit: async () => ({ ok: true }), myTeam: me, reveal: null, myOutcome: null }));
              expect(html.length).toBeGreaterThan(100);
              expect(html).not.toContain(c.explain.slice(0, 40));
            }
            const tv = renderToStaticMarkup(createElement(ui.Tv, { view, stage: "play", deadlineAt: ctx.deadlineAt, now, teams: tvTeams, reveal: null, outcome: null }));
            expect(tv.length).toBeGreaterThan(100);
            expect(tv).not.toContain(c.explain.slice(0, 40));
          }
          const full = def.publicView(c, ctx);
          const end = () => ctx.deadlineAt;
          const myOutcome = out.outcomes.find((o) => o.teamId === me.teamId) ?? null;
          const p = renderToStaticMarkup(createElement(ui.Player, { view: full, memberView: mv, stage: "reveal", deadlineAt: ctx.deadlineAt, now: end, canSubmit: true, submitted: true, submit: async () => ({ ok: true }), myTeam: me, reveal: rev, myOutcome }));
          const tv = renderToStaticMarkup(createElement(ui.Tv, { view: full, stage: "reveal", deadlineAt: ctx.deadlineAt, now: end, teams: tvTeams, reveal: rev, outcome: out }));
          const text = p.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
          expect(text, "spiegazione al reveal").toContain(c.explain.slice(0, 30));
          expect(tv.length).toBeGreaterThan(100);
        }
      }
    }
  });
});
