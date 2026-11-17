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
  ["pub-contro-tavolo", 38],
  ["parola-che-gira", 40],
  ["indovina-il-preferito", 41],
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

// ---------------------------------------------------------------------------
// 38 · Pub contro tavolo
// ---------------------------------------------------------------------------

describe("38 Pub contro tavolo", () => {
  type C = { questions: { id: string; options: { id: string }[] }[]; solution: { answers: Record<string, string> } };
  const def = m<C, { picks: Record<string, string> }>("pub-contro-tavolo");
  const c = first<C>("pub-contro-tavolo");
  /** risposte con le prime `n` giuste e le altre sbagliate */
  const picks = (n: number) => Object.fromEntries(c.questions.map((q, i) => [q.id, i < n ? c.solution.answers[q.id] : q.options.find((o) => o.id !== c.solution.answers[q.id])!.id]));
  const champOf = (ctx: PhaseCtx) => (def.publicView(c, ctx) as { champion: { teamId: string } }).champion.teamId;

  it("20 a risposta per tutti; +40 allo sfidante solo se supera la media dei rivali", () => {
    const ctx = makeCtx(def, [team(1, 2), team(2, 6), team(3, 3)]);
    const champ = champOf(ctx);
    const rivals = ctx.teams.map((t) => t.teamId).filter((id) => id !== champ);
    const win = def.score({ content: c, ctx, submissions: [sub(champ, { picks: picks(4) }), sub(rivals[0], { picks: picks(2) }), sub(rivals[1], { picks: picks(3) })] });
    expect(byTeam(win)).toEqual({ [champ]: 120, [rivals[0]]: 40, [rivals[1]]: 60 });
    expect(summaryOf<{ beaten: boolean; rivalsAvg: number }>(win)).toMatchObject({ beaten: true, rivalsAvg: 2.5 });
    // pari alla media non basta: serve superarla
    const tie = def.score({ content: c, ctx, submissions: [sub(champ, { picks: picks(3) }), sub(rivals[0], { picks: picks(2) }), sub(rivals[1], { picks: picks(4) })] });
    expect(byTeam(tie)[champ]).toBe(60);
    expect(summaryOf<{ beaten: boolean }>(tie)!.beaten).toBe(false);
    // il pub che resiste prende solo Energia Caos, mai punti tolti allo sfidante
    for (const o of tie.outcomes) expect(o.points).toBeGreaterThanOrEqual(0);
    expect(tie.outcomes.find((o) => o.teamId === rivals[0])!.chaos).toBe(2);
  });

  it("sfidante estratto col seme: stabile, uguale in vista e nel punteggio; senza rivali basta 3 su 5", () => {
    const ctx = makeCtx(def, [team(1, 2), team(2, 2), team(3, 2), team(4, 2)], "seme-x");
    expect(champOf(ctx)).toBe(champOf({ ...ctx }));
    const seen = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((s) => champOf({ ...ctx, seed: s })));
    expect(seen.size).toBeGreaterThan(1);
    const solo = makeCtx(def, [team(9, 3)]);
    expect(byTeam(def.score({ content: c, ctx: solo, submissions: [sub("t9", { picks: picks(3) })] })).t9).toBe(100);
    expect(byTeam(def.score({ content: c, ctx: solo, submissions: [sub("t9", { picks: picks(2) })] })).t9).toBe(40);
  });

  it("ogni variante ha 5 domande con risposta e nota", () => {
    for (const v of variants<C & { solution: { notes: Record<string, string> } }>("pub-contro-tavolo")) {
      expect(v.questions).toHaveLength(5);
      for (const q of v.questions) {
        expect(q.options.map((o) => o.id)).toContain(v.solution.answers[q.id]);
        expect(v.solution.notes[q.id]?.length).toBeGreaterThan(5);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 40 · Parola che gira
// ---------------------------------------------------------------------------

/** Le regole scritte nei contenuti, tradotte in controlli sulle lettere (per verificare ogni eliminazione). */
function rulePredicate(text: string): (w: string) => boolean {
  const t = text.toLowerCase();
  const vowel = (ch: string | undefined) => !!ch && "aeiou".includes(ch);
  const double = (w: string) => /(.)\1/.test(w);
  let r: RegExpMatchArray | null;
  if ((r = t.match(/una doppia oppure che finiscono con la lettera ([a-z])/))) {
    const l = r[1];
    return (w) => double(w) || w.endsWith(l);
  }
  if ((r = t.match(/contengono la lettera ([a-z]) oppure la lettera ([a-z])/))) {
    const [a, b] = [r[1], r[2]];
    return (w) => w.includes(a) || w.includes(b);
  }
  if (t.includes("iniziano e finiscono con la stessa lettera")) return (w) => w[0] === w[w.length - 1];
  if (t.includes("iniziano e finiscono con una vocale")) return (w) => vowel(w[0]) && vowel(w[w.length - 1]);
  if (t.includes("solo due vocali")) return (w) => [...w].filter((ch) => vowel(ch)).length === 2;
  if ((r = t.match(/finiscono con la lettera ([a-z])/))) {
    const l = r[1];
    return (w) => w.endsWith(l);
  }
  if ((r = t.match(/iniziano con la lettera ([a-z])/))) {
    const l = r[1];
    return (w) => w.startsWith(l);
  }
  if (t.includes("iniziano con una vocale")) return (w) => vowel(w[0]);
  if ((r = t.match(/contengono la lettera ([a-z])/))) {
    const l = r[1];
    return (w) => w.includes(l);
  }
  if (t.includes("una doppia")) return double;
  if ((r = t.match(/meno di (\d+) lettere/))) {
    const n = Number(r[1]);
    return (w) => w.length < n;
  }
  if ((r = t.match(/più di (\d+) lettere/))) {
    const n = Number(r[1]);
    return (w) => w.length > n;
  }
  if ((r = t.match(/di (\d+) lettere o più/))) {
    const n = Number(r[1]);
    return (w) => w.length >= n;
  }
  if ((r = t.match(/esattamente (\d+) lettere/))) {
    const n = Number(r[1]);
    return (w) => w.length === n;
  }
  throw new Error(`regola non riconosciuta: ${text}`);
}

describe("40 Parola che gira", () => {
  type C = { id: string; words: { id: string; text: string }[]; rules: { text: string; removes: string[] }[]; solution: { wordId: string } };
  const def = m<C, { word: string; survivor: string }>("parola-che-gira");
  const c = first<C>("parola-che-gira");

  it("ogni regola toglie esattamente le parole dichiarate e sopravvive solo la soluzione (controllo sulle lettere)", () => {
    for (const v of variants<C>("parola-che-gira")) {
      let left = v.words.slice();
      for (const rule of v.rules) {
        const p = rulePredicate(rule.text);
        const gone = left.filter((w) => p(w.text.toLowerCase())).map((w) => w.id);
        expect(gone.sort(), `${v.id}: ${rule.text}`).toEqual(rule.removes.slice().sort());
        left = left.filter((w) => !gone.includes(w.id));
      }
      expect(left.map((w) => w.id), v.id).toEqual([v.solution.wordId]);
    }
  });

  it("+30 per la parola unica, +70 per la sopravvissuta; un voto per tavolo", () => {
    const [w1, w2] = c.words.map((w) => w.id);
    const ok = c.solution.wordId;
    const ko = c.words.find((w) => w.id !== ok)!.id;
    const ctx = makeCtx(def, [team(1, 8), team(2, 2), team(3, 2)]);
    const out = def.score({ content: c, ctx, submissions: [sub("t1", { word: w1, survivor: ok }), sub("t2", { word: w2, survivor: ok }), sub("t3", { word: w2, survivor: ko })] });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 70, t3: 0 });
    const s = summaryOf<{ proposals: Record<string, number>; unique: string[] }>(out)!;
    expect(s.proposals[w2]).toBe(2);
    expect(s.unique).toEqual([w1]);
  });

  it("nessun testo libero: la vista pubblica contiene solo parole della lista e regole", () => {
    const v = def.publicView(c, makeCtx(def)) as { words: { id: string; text: string }[]; rules: unknown[] };
    expect(v.words.map((w) => w.text)).toEqual(c.words.map((w) => w.text));
    expect(v.rules.every((r) => typeof r === "string")).toBe(true);
    expect(def.submissionSchema.safeParse({ word: "Parola libera con spazi", survivor: c.solution.wordId }).success).toBe(false);
    // parole fuori lista: invio ignorato
    const out = def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { word: "inventata", survivor: c.solution.wordId })] });
    expect(byTeam(out).t1).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 41 · Indovina il preferito
// ---------------------------------------------------------------------------

describe("41 Indovina il preferito", () => {
  type C = { scenarios: { id: string }[] };
  const def = m<C, { vote: string; favorite: string; last: string }>("indovina-il-preferito");
  const c = first<C>("indovina-il-preferito");
  const [a, b, cc, d] = c.scenarios.map((s) => s.id);

  it("preferito del pubblico +70, meno votato +30 (un voto per tavolo, parità a pari merito)", () => {
    const ctx = makeCtx(def, [team(1, 8), team(2, 2), team(3, 2), team(4, 2)]);
    // voti: a, a, b, d → preferito a; meno votato c (zero voti)
    const out = def.score({
      content: c,
      ctx,
      submissions: [sub("t1", { vote: a, favorite: a, last: cc }), sub("t2", { vote: a, favorite: a, last: b }), sub("t3", { vote: b, favorite: b, last: cc }), sub("t4", { vote: d, favorite: d, last: a })],
    });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 70, t3: 30, t4: 0 });
    expect(summaryOf<{ winners: string[]; losers: string[] }>(out)).toMatchObject({ winners: [a], losers: [cc] });
  });

  it("preferito e meno votato devono essere diversi", () => {
    expect(def.submissionSchema.safeParse({ vote: a, favorite: b, last: b }).success).toBe(false);
    expect(def.submissionSchema.safeParse({ vote: a, favorite: b, last: a }).success).toBe(true);
  });
});
