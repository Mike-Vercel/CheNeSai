import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CATALOG_ROWS } from "@/lib/tig/games/catalog";
import { loadVariants } from "@/lib/tig/games/content-core";
import type { AcceptedSubmission, MechanicDef, PhaseCtx, TeamRef } from "@/lib/tig/games/contract";
import { MECHANIC_EXTRAS, mechanicByCode } from "@/lib/tig/games";
import { NUOVE_MANCHE_1 } from "@/lib/tig/games/mechanics/manche-1";
import { CONTENUTI_MANCHE_1 } from "../../content/tig/minigiochi/manche-1";
import { UI_MANCHE_1 } from "@/features/tig/games/manche-1";
import type { GameStage } from "@/features/tig/games/ui-contract";
import { expectedAt, tokenKey, violations, type Pattern, type Token } from "@/lib/tig/games/mechanics/la-sequenza-sporca";
import { CUT } from "@/lib/tig/games/mechanics/titoli-tagliati";
import { GRIDS, LEVEL_MS } from "@/lib/tig/games/mechanics/pixel-killer";
import { LEAD_MS, poseAt, posesAt, posesOf, type Clip, type FrameOption } from "@/lib/tig/games/mechanics/un-secondo-prima";
import { holds, type Condition } from "@/lib/tig/games/mechanics/non-e-quello-che-sembra";
import { SHOW_MS } from "@/lib/tig/games/mechanics/il-dettaglio-da-100";
import { FEED_END_MS, likesText } from "@/lib/tig/games/mechanics/feed-in-5-secondi";
import { compileLayer, compileMix, compileOne, SOUND_KINDS, type SoundKind, type SynthEvent } from "@/lib/tig/games/mechanics/m1/synth";
import { rasterize, type Art } from "@/lib/tig/games/mechanics/m1/draw";

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

// ---------------------------------------------------------------------------
// Regole delle meccaniche con media disegnati o sintetizzati
// ---------------------------------------------------------------------------

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

describe("TIG manche 1 · media disegnati e sintetizzati", () => {
  it("02 Pixel killer: 100/70/40 secondo l'orario del server; le forme vere non partono mai prima del reveal", () => {
    const def = m("pixel-killer");
    const at = MECHANIC_EXTRAS["pixel-killer"].publicViewAt!;
    for (const c of variants<Choice & { art: Art }>("pixel-killer")) {
      const ctx = makeCtx(def);
      for (const t of [0, 5000, 14000, 27000, 39000]) {
        const v = at(c, ctx, t) as { levels: ({ cols: number; rows: number; cells: string } | null)[] };
        expect(deepKeys(v), c.id).not.toContain("shapes");
        v.levels.forEach((l, i) => {
          if (l) expect(l.cells.length).toBe(GRIDS[i][0] * GRIDS[i][1] * 3);
        });
      }
      // all'inizio: livello aperto + il successivo, mai il più fine
      const v0 = at(c, ctx, 0) as { levels: unknown[] };
      expect(v0.levels.map((l) => l !== null)).toEqual([true, true, false]);
      const v1 = at(c, ctx, LEVEL_MS[1] + 1) as { levels: unknown[] };
      expect(v1.levels.every((l) => l !== null)).toBe(true);
      // i tre livelli sono davvero diversi (più quadretti = più dettagli)
      const l = GRIDS.map(([w, h]) => rasterize(c.art, w, h));
      expect(new Set(l).size).toBe(3);
    }
    const c = variants<Choice>("pixel-killer")[0];
    const ok = c.solution.optionId;
    const out = def.score({ content: c, ctx: makeCtx(def, [team(1, 2), team(2, 2), team(3, 2), team(4, 2)]), submissions: [sub("t1", { optionId: ok }, 5000), sub("t2", { optionId: ok }, 15000), sub("t3", { optionId: ok }, 30000), sub("t4", { optionId: c.options.find((o) => o.id !== ok)!.id }, 1000)] });
    expect(byTeam(out)).toEqual({ t1: 100, t2: 70, t3: 40, t4: 0 });
  });

  it("06 Un secondo prima: animazione coerente, tre fotogrammi diversi, tempo per rispondere dopo il fermo immagine", () => {
    const def = m("un-secondo-prima");
    for (const c of variants<{ id: string; clip: Clip; options: FrameOption[] }>("un-secondo-prima")) {
      const last = posesAt(c.clip, c.clip.durationMs);
      for (const a of c.clip.actors) expect(poseAt(c.clip, a.id, c.clip.durationMs + 5000), c.id).toEqual(last[a.id]);
      const frames = c.options.map((o) => JSON.stringify([posesOf(c.clip, o), o.extra ?? []]));
      expect(new Set(frames).size, c.id).toBe(3);
      expect(LEAD_MS + c.clip.durationMs, c.id).toBeLessThanOrEqual(def.timerSec * 1000 - 20000);
    }
    // interpolazione lineare a metà tra due fotogrammi chiave
    const clip = { keys: [{ t: 0, set: { a: { x: 0, y: 0 } } }, { t: 1000, set: { a: { x: 10, y: 20, rot: 90 } } }] };
    expect(poseAt(clip as never, "a", 500)).toMatchObject({ x: 5, y: 10, rot: 45, s: 1, o: 1 });
  });

  it("08 Non è quello che sembra: solo la soluzione rispetta tutta la descrizione; 100 + rapidità; immagini nell'ordine del contenuto", () => {
    const def = m("non-e-quello-che-sembra");
    const positions = new Set<number>();
    for (const c of variants<{ id: string; conditions: Condition[]; images: { id: string; art: Art }[]; solution: { imageId: string } }>("non-e-quello-che-sembra")) {
      for (const img of c.images) {
        const all = c.conditions.every((k) => holds(img.art, k) === true);
        expect(all, `${c.id}/${img.id}`).toBe(img.id === c.solution.imageId);
      }
      // la spiegazione dice «la prima», «la seconda»…: l'ordine sullo schermo è quello del contenuto, per ogni seme
      for (const seed of ["a", "b", "c", "d"]) {
        const v = def.publicView(c, makeCtx(def, undefined, seed)) as { images: { id: string }[] };
        expect(deepKeys(v)).not.toContain("conditions");
        expect(v.images.map((x) => x.id), c.id).toEqual(c.images.map((x) => x.id));
      }
      positions.add(c.images.findIndex((x) => x.id === c.solution.imageId));
    }
    // la posizione della risposta giusta cambia tra le varianti (prima, seconda e terza)
    expect(positions).toEqual(new Set([0, 1, 2]));
    const c = variants<{ images: { id: string }[]; solution: { imageId: string } }>("non-e-quello-che-sembra")[0];
    const ko = c.images.find((x) => x.id !== c.solution.imageId)!.id;
    const out = def.score({ content: c, ctx: makeCtx(def), submissions: [sub("t1", { imageId: c.solution.imageId }, 0), sub("t2", { imageId: c.solution.imageId }, 25000), sub("t3", { imageId: ko }, 100)] });
    expect(byTeam(out)).toEqual({ t1: 120, t2: 100, t3: 0 });
  });

  it("10 Il dettaglio da 100 e 13 Feed in 5 secondi: scena e post spariscono dalla vista allo scadere (publicViewAt)", () => {
    const d = m("il-dettaglio-da-100");
    const atD = MECHANIC_EXTRAS["il-dettaglio-da-100"].publicViewAt!;
    for (const c of variants("il-dettaglio-da-100")) {
      expect((atD(c, makeCtx(d), 1000) as { scene: unknown }).scene).not.toBeNull();
      const after = atD(c, makeCtx(d), SHOW_MS) as { scene: unknown; ticker: unknown; alt: unknown; prompt: string };
      expect([after.scene, after.ticker, after.alt]).toEqual([null, null, null]);
      expect(after.prompt.length).toBeGreaterThan(5);
    }
    const f = m("feed-in-5-secondi");
    const atF = MECHANIC_EXTRAS["feed-in-5-secondi"].publicViewAt!;
    for (const c of variants("feed-in-5-secondi")) {
      expect((atF(c, makeCtx(f), 2000) as { posts: unknown[] }).posts).toHaveLength(5);
      expect((atF(c, makeCtx(f), FEED_END_MS) as { posts: unknown }).posts).toBeNull();
    }
    expect(likesText(1204)).toBe("1.204");
    expect(likesText(87)).toBe("87");
    expect(likesText(1234567)).toBe("1.234.567");
  });

  it("12 Rumore di fondo: ai telefoni arriva solo il missaggio anonimo (niente nomi né volumi degli strati)", () => {
    const def = m("rumore-di-fondo");
    for (const c of variants<{ id: string; layers: { sound: string; gain: number }[] }>("rumore-di-fondo")) {
      const v = def.publicView(c, makeCtx(def)) as { mix: { d: number; ev: unknown[][] } };
      const keys = deepKeys(v);
      for (const k of ["layers", "gain", "sound", "solo"]) expect(keys, c.id).not.toContain(k);
      expect(v.mix.ev.length, c.id).toBeGreaterThan(5);
      for (const e of v.mix.ev) expect(typeof e[0] === "string" && e.slice(1).every((x) => typeof x === "number" && Number.isFinite(x)), c.id).toBe(true);
      expect(JSON.stringify(v.mix)).not.toMatch(new RegExp(SOUND_KINDS.join("|")));
    }
    // compilazione deterministica, ordinata per tempo, volumi normalizzati
    const a = compileMix([{ sound: "pioggia", gain: 0.5 }, { sound: "tuono", gain: 0.5 }], 6, "x");
    expect(compileMix([{ sound: "pioggia", gain: 0.5 }, { sound: "tuono", gain: 0.5 }], 6, "x")).toEqual(a);
    for (let i = 1; i < a.length; i++) expect(a[i][1]).toBeGreaterThanOrEqual(a[i - 1][1]);
    for (const e of a) expect(e[1] + e[2]).toBeLessThanOrEqual(6.05);
  });
});

// ---------------------------------------------------------------------------
// Schermate: telefono/PC e TV in gioco, a risposte chiuse e al reveal (render lato server, ogni variante)
// ---------------------------------------------------------------------------

describe("TIG manche 1 · schermate", () => {
  const twelve = Array.from({ length: 12 }, (_, i) => team(i + 1, (i % 4) + 1));
  const tvTeams = twelve.map((t, i) => ({ teamId: t.teamId, tableNo: t.tableNo, name: `Squadra ${i + 1}`, color: "#c6ff3d", submitted: i % 2 === 0 }));

  it.each(Object.keys(UI_MANCHE_1))("%s: Player e Tv si disegnano in gioco, bloccate e al reveal, senza spiegazione prima del reveal", (code) => {
    const def = m(code);
    const ui = UI_MANCHE_1[code];
    const ex = MECHANIC_EXTRAS[code];
    for (const c of variants<{ explain: string }>(code)) {
      const ctx = makeCtx(def, twelve);
      const subs = ex.demoSubmissions(c, ctx, "render");
      const out = def.score({ content: c, ctx, submissions: subs });
      const rev = def.reveal(c, out);
      const me = twelve[0];
      const myOutcome = out.outcomes.find((o) => o.teamId === me.teamId) ?? null;
      const times = [0, 3000, 9000, def.timerSec * 1000 - 1000];
      for (const [stage, elapsed] of [...times.map((t) => ["play", t] as const), ["locked", def.timerSec * 1000] as const]) {
        const view = ex.publicViewAt ? ex.publicViewAt(c, ctx, elapsed) : def.publicView(c, ctx);
        const now = () => ctx.startsAt + elapsed;
        for (const captain of [true, false]) {
          const html = renderToStaticMarkup(
            createElement(ui.Player, { view, memberView: null, stage: stage as GameStage, deadlineAt: ctx.deadlineAt, now, canSubmit: captain, submitted: !captain, submit: async () => ({ ok: true }), myTeam: me, reveal: null, myOutcome: null }),
          );
          expect(html.length, `${code} ${stage} ${elapsed}`).toBeGreaterThan(200);
          expect(html, `${code}: spiegazione sul telefono prima del reveal`).not.toContain(c.explain.slice(0, 40));
        }
        const tv = renderToStaticMarkup(createElement(ui.Tv, { view, stage: stage as GameStage, deadlineAt: ctx.deadlineAt, now, teams: tvTeams, reveal: null, outcome: null }));
        expect(tv.length).toBeGreaterThan(200);
        expect(tv, `${code}: spiegazione in TV prima del reveal`).not.toContain(c.explain.slice(0, 40));
      }
      const full = def.publicView(c, ctx);
      const end = () => ctx.deadlineAt + 2000;
      const p = renderToStaticMarkup(createElement(ui.Player, { view: full, memberView: null, stage: "reveal", deadlineAt: ctx.deadlineAt, now: end, canSubmit: true, submitted: true, submit: async () => ({ ok: true }), myTeam: me, reveal: rev, myOutcome }));
      const tv = renderToStaticMarkup(createElement(ui.Tv, { view: full, stage: "reveal", deadlineAt: ctx.deadlineAt, now: end, teams: tvTeams, reveal: rev, outcome: out }));
      expect(p.length).toBeGreaterThan(200);
      expect(tv.length).toBeGreaterThan(200);
      // il «perché» si vede al reveal (React codifica gli apostrofi: si confronta un pezzo senza)
      const piece = c.explain.split(/['«»"]/)[0].slice(0, 30);
      expect(p, `${code}: manca il perché sul telefono`).toContain(piece);
    }
  });
});

// ---------------------------------------------------------------------------
// Rumore di fondo: volumi stimati senza ascoltare (mini sintetizzatore offline con gli stessi inviluppi e
// filtri del riproduttore Web Audio; volume «percepito» = passa-alto a 150 Hz + 90° percentile dell'RMS
// su finestre di 200 ms). Serve a garantire che «il più forte» sia davvero il più forte.
// ---------------------------------------------------------------------------

const SR = 16000;

function biquadCoeffs(type: number, f: number, q: number) {
  // RBJ: 0 passa-basso, 1 passa-banda (picco 0 dB), 2 passa-alto. In Web Audio il Q di LP/HP è in dB.
  const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
  const cos = Math.cos(w);
  const qq = type === 1 ? Math.max(0.05, q) : Math.pow(10, q / 20);
  const alpha = Math.sin(w) / (2 * qq);
  const b = type === 0 ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : type === 2 ? [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2] : [alpha, 0, -alpha];
  const a0 = 1 + alpha;
  return { b0: b[0] / a0, b1: b[1] / a0, b2: b[2] / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

function renderOffline(ev: readonly SynthEvent[], d: number): Float32Array {
  const out = new Float32Array(Math.ceil(d * SR) + SR);
  let seed = 12345;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (const e of ev) {
    const [kind, at, dur] = e;
    const n0 = Math.floor(at * SR);
    const n = Math.floor(dur * SR);
    const env = (i: number, peak: number, a: number, r: number) => {
      const t = i / SR;
      const att = Math.min(a, dur * 0.5);
      const rel = Math.min(r, dur - att);
      if (t < att) return (peak * t) / Math.max(1e-6, att);
      if (t > dur - rel) return (peak * (dur - t)) / Math.max(1e-6, rel);
      return peak;
    };
    if (kind === "t") {
      const [, , , wave, f0, f1, g, a, r, th, td] = e;
      let ph = 0;
      for (let i = 0; i < n; i++) {
        ph = (ph + (f0 + ((f1 - f0) * i) / n) / SR) % 1;
        const s = wave === 0 ? Math.sin(2 * Math.PI * ph) : wave === 1 ? (ph < 0.5 ? 1 : -1) : wave === 2 ? 2 * ph - 1 : 1 - 4 * Math.abs(ph - 0.5);
        const trem = th > 0 && td > 0 ? 1 - td / 2 + (td / 2) * Math.sin((2 * Math.PI * th * i) / SR) : 1;
        out[n0 + i] += s * env(i, g, a, r) * trem;
      }
    } else {
      const [, , , ft, f0, f1, q, g, a, r] = e;
      let [x1, x2, y1, y2] = [0, 0, 0, 0];
      let c = biquadCoeffs(ft, f0, q);
      for (let i = 0; i < n; i++) {
        if (i % 64 === 0) c = biquadCoeffs(ft, f0 + ((f1 - f0) * i) / n, q);
        const x = noise();
        const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
        [x2, x1, y2, y1] = [x1, x, y1, y];
        out[n0 + i] += y * env(i, g, a, r);
      }
    }
  }
  return out;
}

/** Volume percepito stimato, in dB. */
function loudnessDb(x: Float32Array): number {
  const c = biquadCoeffs(2, 150, 0);
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  const W = Math.round(SR * 0.2);
  const wins: number[] = [];
  let s = 0;
  let k = 0;
  for (const v of x) {
    const y = c.b0 * v + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    [x2, x1, y2, y1] = [x1, v, y1, y];
    s += y * y;
    if (++k === W) {
      wins.push(Math.sqrt(s / W));
      s = 0;
      k = 0;
    }
  }
  wins.sort((a, b) => a - b);
  return 20 * Math.log10(Math.max(1e-9, wins[Math.floor(wins.length * 0.9)] ?? 0));
}

describe("TIG manche 1 · Rumore di fondo, volumi stimati", () => {
  it("ogni suono, a pieno volume, sta intorno allo stesso livello percepito (correzione LOUDNESS)", () => {
    for (const k of SOUND_KINDS) {
      const db = loudnessDb(renderOffline(compileOne(k, 6, "verifica", 1), 6));
      expect(Math.abs(db + 14), `${k}: ${db.toFixed(1)} dB`).toBeLessThan(3);
    }
  });

  it("«dominante»: lo strato giusto si sente almeno 6 dB sopra gli altri; «estraneo»: i tre strati entro 4 dB", () => {
    for (const c of variants<{ id: string; mode: string; layers: { sound: SoundKind; gain: number }[]; options: { id: string; sound: SoundKind }[]; solution: { optionId: string } }>("rumore-di-fondo")) {
      const db = c.layers.map((_, i) => loudnessDb(renderOffline(compileLayer(c.layers, i, 6, c.id), 6)));
      if (c.mode === "dominante") {
        const right = c.options.find((o) => o.id === c.solution.optionId)!.sound;
        const k = c.layers.findIndex((l) => l.sound === right);
        for (let i = 0; i < db.length; i++) if (i !== k) expect(db[k] - db[i], `${c.id}: ${db.map((x) => x.toFixed(1)).join(" / ")}`).toBeGreaterThan(6);
      } else {
        expect(Math.max(...db) - Math.min(...db), `${c.id}: ${db.map((x) => x.toFixed(1)).join(" / ")}`).toBeLessThan(4);
      }
    }
  });
});
