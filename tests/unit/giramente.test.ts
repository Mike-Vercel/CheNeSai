import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyFloor,
  boardLayout,
  BOARD_ROW_MAX,
  canRevealLetter,
  checkNickname,
  computeStandings,
  estimateMinutes,
  FINALE_WHEEL,
  finalePoints,
  hiddenLetters,
  initialLetters,
  letterCounts,
  letterKey,
  maskBoard,
  matchAnswer,
  matchPhrase,
  MAX_THEORETICAL,
  normalizeAnswer,
  planSpin,
  puzzleKindFor,
  resolveTiebreak,
  restAngle,
  scoreWheelTurn,
  segmentAtAngle,
  spinAngleAt,
  STANDARD_WHEEL,
  tabellonePoints,
  tiedLeaders,
  wheelStake,
} from "@/lib/giramente/rules";
import { DEFAULT_SETTINGS, ROUNDS } from "@/lib/giramente/types";

describe("GIRAMENTE! – punteggi", () => {
  it("manche 1: VERDE +150/0, ROSSO +300/−100", () => {
    expect(scoreWheelTurn({ roundNo: 1, risk: "verde", correct: true, bonus: false, lampo: false, jolly: null }).lines).toEqual([{ kind: "award", label: "Risposta giusta in VERDE", delta: 150 }]);
    expect(scoreWheelTurn({ roundNo: 1, risk: "verde", correct: false, bonus: false, lampo: false, jolly: null }).lines).toEqual([]);
    expect(scoreWheelTurn({ roundNo: 1, risk: "rosso", correct: true, bonus: false, lampo: false, jolly: null }).lines[0].delta).toBe(300);
    expect(scoreWheelTurn({ roundNo: 1, risk: "rosso", correct: false, bonus: false, lampo: false, jolly: null }).lines).toEqual([{ kind: "penalty", label: "Penalità del ROSSO", delta: -100 }]);
  });
  it("manche 3: VERDE +200/0, ROSSO +400/−150; bonus e lampo +100 solo se giusta", () => {
    const ok = scoreWheelTurn({ roundNo: 3, risk: "rosso", correct: true, bonus: true, lampo: true, jolly: null });
    expect(ok.lines.map((l) => l.delta)).toEqual([400, 100, 100]);
    const ko = scoreWheelTurn({ roundNo: 3, risk: "rosso", correct: false, bonus: true, lampo: true, jolly: null });
    expect(ko.lines.map((l) => l.delta)).toEqual([-150]);
    expect(scoreWheelTurn({ roundNo: 3, risk: "verde", correct: true, bonus: false, lampo: false, jolly: null }).lines[0].delta).toBe(200);
  });
  it("SCUDO: annulla solo la penalità del ROSSO, non dà punti; inutile in VERDE o se giusta", () => {
    const s = scoreWheelTurn({ roundNo: 3, risk: "rosso", correct: false, bonus: false, lampo: false, jolly: "scudo" });
    expect(s.shieldUsed).toBe(true);
    expect(s.lines.reduce((a, l) => a + l.delta, 0)).toBe(0);
    expect(scoreWheelTurn({ roundNo: 3, risk: "verde", correct: false, bonus: false, lampo: false, jolly: "scudo" }).shieldUsed).toBe(false);
    expect(scoreWheelTurn({ roundNo: 3, risk: "rosso", correct: true, bonus: false, lampo: false, jolly: "scudo" }).shieldUsed).toBe(false);
    expect(scoreWheelTurn({ roundNo: 1, risk: "rosso", correct: false, bonus: false, lampo: false, jolly: "occhio" }).lines[0].delta).toBe(-100);
  });
  it("il punteggio non scende mai sotto zero", () => {
    expect(applyFloor(50, -100)).toEqual({ score: 0, applied: -50 });
    expect(applyFloor(0, -150)).toEqual({ score: 0, applied: 0 });
    expect(applyFloor(500, -150)).toEqual({ score: 350, applied: -150 });
  });
  it("finale 600/400/200, tabellone 250 → minimo 100, posta in gioco", () => {
    expect([1, 2, 3].map(finalePoints)).toEqual([600, 400, 200]);
    expect(tabellonePoints(0, 0)).toBe(250);
    expect(tabellonePoints(2, 1)).toBe(150);
    expect(tabellonePoints(4, 1)).toBe(100);
    expect(wheelStake(1, "rosso", true, false)).toBe(400);
    expect(wheelStake(3, "verde", false, true)).toBe(300);
  });
  it("massimo teorico senza bonus: 2.200 (300 + 400 + 400 + 500 + 600)", () => {
    expect(300 + 400 + 400 + 250 + 250 + 600).toBe(MAX_THEORETICAL);
    expect(ROUNDS).toHaveLength(5);
  });
});

describe("GIRAMENTE! – normalizzazione delle risposte", () => {
  it("maiuscole, accenti, apostrofi, spazi e articolo iniziale", () => {
    expect(normalizeAnswer("  L'Àncora  ")).toBe("l ancora");
    expect(matchAnswer("l'orologio", "OROLOGIO")).toBe(true);
    expect(matchAnswer("Il Libro", "LIBRO")).toBe(true);
    expect(matchAnswer("caffe", "CAFFÈ")).toBe(true);
    expect(matchAnswer("perche", "PERCHÉ")).toBe(true);
    expect(matchAnswer("new york", "NEWYORK")).toBe(true);
  });
  it("varianti ammesse sì, risposte diverse no", () => {
    expect(matchAnswer("trentadue", "32", ["trentadue"])).toBe(true);
    expect(matchAnswer("33", "32", ["trentadue"])).toBe(false);
    expect(matchAnswer("cane", "PANE")).toBe(false);
    expect(matchAnswer("sesto", "SETTE")).toBe(false);
    expect(matchAnswer("", "LUCE")).toBe(false);
    expect(matchAnswer("luce solare", "LUCE")).toBe(false);
  });
  it("piccoli errori di battitura solo su parole lunghe senza cifre", () => {
    expect(matchAnswer("pinguno", "PINGUINO")).toBe(true);
    expect(matchAnswer("pngno", "PINGUINO")).toBe(false);
    expect(matchAnswer("luci", "LUCE")).toBe(false);
    expect(matchPhrase("chi dorme non piglia pesc", "CHI DORME NON PIGLIA PESCI")).toBe(true);
    expect(matchPhrase("chi dorme non prende pesci", "CHI DORME NON PIGLIA PESCI")).toBe(false);
    expect(matchPhrase("dorme non piglia pesci", "CHI DORME NON PIGLIA PESCI")).toBe(false);
  });
  it("nickname puliti (niente markup, invisibili, lunghezza)", () => {
    expect(checkNickname("  <b>Sara</b> ")).toEqual({ ok: true, value: "bSara/b" });
    expect(checkNickname("​").ok).toBe(false);
    expect(checkNickname("x".repeat(21)).ok).toBe(false);
  });
});

describe("GIRAMENTE! – tabellone segreto", () => {
  const phrase = "LA VITA È BELLA";
  it("maschera: solo le lettere scoperte, forma delle parole, spazi; la E scopre anche È", () => {
    const rows = maskBoard(phrase, ["A"]);
    const flat = rows.flat();
    expect(flat.filter((c) => c.kind === "letter").length).toBe(12);
    expect(flat.filter((c) => c.kind === "letter" && c.char).map((c) => (c as { char: string }).char)).toEqual(["A", "A", "A"]);
    expect(JSON.stringify(rows)).not.toMatch(/[LVITBÈ]/);
    const withE = maskBoard(phrase, ["E"]).flat();
    expect(withE.some((c) => c.kind === "letter" && c.char === "È")).toBe(true);
    expect(letterKey("È")).toBe("E");
  });
  it("righe di al massimo 12 caselle senza spezzare le parole; punteggiatura sempre visibile", () => {
    const rows = boardLayout("PRENDERE DUE PICCIONI CON UNA FAVA");
    for (const r of rows) expect(r.join(" ").length).toBeLessThanOrEqual(BOARD_ROW_MAX);
    expect(rows.flat().join(" ")).toBe("PRENDERE DUE PICCIONI CON UNA FAVA");
    const m = maskBoard("L'ACQUA, CHE BELLA!", []);
    expect(m.flat().filter((c) => c.kind === "punct").map((c) => (c as { char: string }).char)).toEqual(["'", ",", "!"]);
  });
  it("lettere iniziali: circa un quarto delle caselle, mai più della metà; svela lettera limitato", () => {
    for (let seed = 0; seed < 50; seed++) {
      let x = seed;
      const rnd = (n: number) => {
        x = (x * 1103515245 + 12345) % 2147483648;
        return x % n;
      };
      const init = initialLetters("CHI DORME NON PIGLIA PESCI", rnd);
      const counts = letterCounts("CHI DORME NON PIGLIA PESCI");
      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      const shown = init.reduce((a, k) => a + (counts.get(k) ?? 0), 0);
      expect(init.length).toBeGreaterThan(0);
      expect(shown).toBeLessThanOrEqual(total * 0.5);
    }
    expect(canRevealLetter("ABC DEF", [], 0)).toBe(true);
    expect(canRevealLetter("ABC DEF", [], 4)).toBe(false);
    expect(canRevealLetter("ABC", ["A"], 0)).toBe(false);
    expect(hiddenLetters("ABBA", ["A"])).toEqual(["B"]);
  });
});

describe("GIRAMENTE! – ruota", () => {
  it("8 spicchi standard (con Jolly, Bonus, Colpo) e finale con 4 categorie ×2", () => {
    expect(STANDARD_WHEEL).toHaveLength(8);
    expect(new Set(STANDARD_WHEEL).size).toBe(8);
    expect(FINALE_WHEEL).toHaveLength(8);
    expect(FINALE_WHEEL.some((k) => ["jolly", "bonus", "colpo", "mistero"].includes(k))).toBe(false);
  });
  it("il giro si ferma SEMPRE sullo spicchio deciso dal server, per ogni spinId", () => {
    for (let i = 0; i < 200; i++) {
      const target = i % 8;
      const spin = { spinId: `spin-${i}-${i * 7}`, targetIndex: target, startedAt: 1000, durationMs: 6000 };
      const end = spinAngleAt(spin, 8, 1000 + 6000);
      expect(segmentAtAngle(end, 8)).toBe(target);
      // anche partendo da un angolo qualsiasi (ruota già ferma altrove)
      const from = restAngle((i * 3) % 8, 8);
      expect(segmentAtAngle(spinAngleAt(spin, 8, 99_999, from), 8)).toBe(target);
      expect(planSpin(spin.spinId, target, 8).turns).toBeGreaterThanOrEqual(5);
    }
  });
  it("chi arriva a metà giro ricostruisce lo stesso angolo dal tempo trascorso; l'angolo cresce sempre", () => {
    const spin = { spinId: "abc", targetIndex: 3, startedAt: 0, durationMs: 6000 };
    let prev = -1;
    for (let t = 0; t <= 6000; t += 100) {
      const a = spinAngleAt(spin, 8, t);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
    expect(spinAngleAt(spin, 8, 3000)).toBe(spinAngleAt(spin, 8, 3000));
  });
  it("gli spicchi speciali assegnano comunque una prova compatibile", () => {
    for (const s of ["jolly", "bonus", "colpo", "mistero"] as const) expect(["intruso", "sequenza", "indizi", "prospettiva"]).toContain(puzzleKindFor(s, () => 2));
    expect(puzzleKindFor("indizi", () => 0)).toBe("indizi");
  });
});

describe("GIRAMENTE! – classifica e spareggio", () => {
  it("posizioni condivise a parità, ordinamento stabile per posto", () => {
    const s = computeStandings([
      { id: "a", score: 300, seat: 2 },
      { id: "b", score: 500, seat: 3 },
      { id: "c", score: 300, seat: 1 },
      { id: "d", score: 0, seat: 4 },
    ]);
    expect(s.map((x) => [x.competitorId, x.position])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 2],
      ["d", 4],
    ]);
    expect(tiedLeaders(s)).toEqual([]);
    expect(tiedLeaders(computeStandings([{ id: "a", score: 9, seat: 1 }, { id: "b", score: 9, seat: 2 }]))).toEqual(["a", "b"]);
  });
  it("spareggio: più punti vince; parità o tutti a zero → nuovo enigma; dal 3° spareggio conta il tempo", () => {
    expect(resolveTiebreak([{ competitorId: "a", points: 600, elapsedMs: 9000 }, { competitorId: "b", points: 400, elapsedMs: 1000 }], 1)).toBe("a");
    expect(resolveTiebreak([{ competitorId: "a", points: 0, elapsedMs: null }, { competitorId: "b", points: 0, elapsedMs: null }], 1)).toBeNull();
    expect(resolveTiebreak([{ competitorId: "a", points: 400, elapsedMs: 9000 }, { competitorId: "b", points: 400, elapsedMs: 1000 }], 1)).toBeNull();
    expect(resolveTiebreak([{ competitorId: "a", points: 400, elapsedMs: 9000 }, { competitorId: "b", points: 400, elapsedMs: 1000 }], 3)).toBe("b");
  });
});

describe("GIRAMENTE! – durata stimata", () => {
  it("cresce con i concorrenti; con un solo telefono è più lunga", () => {
    const a = estimateMinutes(2, "personal", "individual", DEFAULT_SETTINGS);
    const b = estimateMinutes(8, "personal", "individual", DEFAULT_SETTINGS);
    const c = estimateMinutes(8, "shared", "individual", DEFAULT_SETTINGS);
    expect(b.min).toBeGreaterThan(a.min);
    expect(c.min).toBeGreaterThan(b.min);
    expect(a.min).toBeGreaterThanOrEqual(10);
    expect(estimateMinutes(4, "personal", "individual", DEFAULT_SETTINGS).max).toBeLessThanOrEqual(45);
  });
});

// ---------------------------------------------------------------------------
// Archivio iniziale: ogni enigma completo, coerente e risolvibile con le regole del gioco
// ---------------------------------------------------------------------------
interface Data {
  ruota: { slug: string; kind: string; difficulty: string; prompt: string; clues: string[]; visual: string | null; options: string[]; answer: number; clue: string; explanation: string }[];
  falsa_pista: { slug: string; clues: string[]; false_index: number; solution: string; accepted: string[] }[];
  collegamento: { slug: string; words: string[]; extra_clue: string; solution: string; accepted: string[] }[];
  finale: { slug: string; kind: string; prompt: string; clues: string[]; solution: string; accepted: string[] }[];
  tabellone: { slug: string; category: string; phrase: string; hint: string; accepted: string[] }[];
}
const data = JSON.parse(readFileSync(path.join(process.cwd(), "content", "giramente", "enigmi.json"), "utf8")) as Data;

describe("GIRAMENTE! – archivio degli enigmi", () => {
  it("quantità sufficienti per più partite a 8 senza ripetizioni", () => {
    for (const k of ["intruso", "sequenza", "indizi", "prospettiva"]) for (const d of ["facile", "difficile"]) expect(data.ruota.filter((x) => x.kind === k && x.difficulty === d).length).toBeGreaterThanOrEqual(8);
    expect(data.falsa_pista.length).toBeGreaterThanOrEqual(20);
    expect(data.collegamento.length).toBeGreaterThanOrEqual(18);
    expect(data.finale.length).toBeGreaterThanOrEqual(24);
    expect(data.tabellone.length).toBeGreaterThanOrEqual(20);
    const slugs = [...data.ruota, ...data.falsa_pista, ...data.collegamento, ...data.finale, ...data.tabellone].map((x) => x.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]{3,80}$/);
  });
  it("ruota: 4 opzioni diverse, risposta valida, indizio extra (Occhio Furbo) che non svela la risposta", () => {
    for (const x of data.ruota) {
      expect(x.options, x.slug).toHaveLength(4);
      expect(new Set(x.options.map(normalizeAnswer)).size, x.slug).toBe(4);
      expect(x.answer, x.slug).toBeGreaterThanOrEqual(0);
      expect(x.answer, x.slug).toBeLessThanOrEqual(3);
      expect(x.clue.trim().length, x.slug).toBeGreaterThan(5);
      expect(normalizeAnswer(x.clue).split(" ").join(" ") === normalizeAnswer(x.options[x.answer]), x.slug).toBe(false);
      expect(x.prompt.length, x.slug).toBeLessThanOrEqual(400);
      if (x.visual) for (const line of x.visual.split("\n")) expect([...line].length, x.slug).toBeLessThanOrEqual(14);
    }
  });
  it("falsa pista, collegamento, finale: la propria soluzione è riconosciuta, varianti coerenti", () => {
    for (const x of data.falsa_pista) {
      expect(x.clues, x.slug).toHaveLength(4);
      expect(x.false_index).toBeGreaterThanOrEqual(0);
      expect(x.false_index).toBeLessThanOrEqual(3);
      expect(matchAnswer(x.solution.toLowerCase(), x.solution, x.accepted), x.slug).toBe(true);
      for (const a of x.accepted) expect(matchAnswer(a, x.solution, x.accepted), x.slug).toBe(true);
    }
    for (const x of data.collegamento) {
      expect(x.words, x.slug).toHaveLength(3);
      expect(x.extra_clue.length, x.slug).toBeGreaterThan(5);
      expect(matchAnswer(x.solution, x.solution, x.accepted), x.slug).toBe(true);
    }
    for (const x of data.finale) {
      expect(x.clues.length, x.slug).toBe(3);
      expect(matchAnswer(` ${x.solution.toLowerCase()} `, x.solution, x.accepted), x.slug).toBe(true);
    }
  });
  it("tabellone: frasi solo con caratteri ammessi, righe che stanno sul telefono, indizio senza parole della frase", () => {
    for (const x of data.tabellone) {
      expect(x.phrase, x.slug).toMatch(/^[A-ZÀÈÉÌÒÙ' ,!?]{10,34}$/);
      for (const w of x.phrase.split(" ")) expect([...w].length, x.slug).toBeLessThanOrEqual(12);
      expect(boardLayout(x.phrase).length, x.slug).toBeLessThanOrEqual(4);
      const words = new Set(normalizeAnswer(x.phrase).split(" ").filter((w) => w.length > 3));
      for (const w of normalizeAnswer(x.hint).split(" ")) expect(words.has(w), `${x.slug}: «${w}» nell'indizio`).toBe(false);
      expect(matchPhrase(x.phrase.toLowerCase(), x.phrase, x.accepted), x.slug).toBe(true);
    }
  });
});
