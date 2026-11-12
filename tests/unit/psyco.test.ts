import { describe, expect, it } from "vitest";
import { CATEGORY_HINTS, pickHint } from "@/lib/psyco/hints";
import {
  checkHintText,
  checkNickname,
  checkRuleText,
  countdownMs,
  formatClock,
  isExpired,
  isRoomCode,
  normalizeRoomCode,
  pickPsyco,
  remainingMs,
  resolvePlurality,
  resolveYesNo,
  timerFromParts,
} from "@/lib/psyco/logic";
import { actionSchema, callsOf, createRoomSchema, RULE_CATEGORIES, settingsSchema, type PublicTimer } from "@/lib/psyco/types";
import rules from "../../content/psyco/regole.json";

describe("PSYCO – timer libero (minuti e secondi)", () => {
  it("accetta durate qualsiasi, non solo 3/5/10", () => {
    expect(timerFromParts(1, 30, false)).toEqual({ ok: true, ms: 90_000 });
    expect(timerFromParts("4", "25", false)).toEqual({ ok: true, ms: 265_000 });
    expect(timerFromParts(7, 45, false)).toEqual({ ok: true, ms: 465_000 });
    expect(timerFromParts(12, 10, false)).toEqual({ ok: true, ms: 730_000 });
    expect(timerFromParts(30, 0, false)).toEqual({ ok: true, ms: 1_800_000 });
    expect(timerFromParts(0, 45, false)).toEqual({ ok: true, ms: 45_000 });
  });
  it("senza limite di tempo", () => {
    expect(timerFromParts(0, 0, true)).toEqual({ ok: true, ms: null });
    expect(settingsSchema.safeParse({ timerMs: null, ruleMode: "free", psycoPick: "auto" }).success).toBe(true);
  });
  it("valida minuti ≥ 0, secondi 0–59, durata > 0", () => {
    expect(timerFromParts(-1, 0, false).ok).toBe(false);
    expect(timerFromParts(1, 60, false).ok).toBe(false);
    expect(timerFromParts(1.5, 0, false).ok).toBe(false);
    expect(timerFromParts(0, 0, false).ok).toBe(false);
    expect(timerFromParts("abc", 0, false).ok).toBe(false);
  });
  it("formato del cronometro", () => {
    expect(formatClock(90_000)).toBe("01:30");
    expect(formatClock(730_000)).toBe("12:10");
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatClock(400)).toBe("00:01");
  });
});

describe("PSYCO – tempo con riferimento al server", () => {
  const start = Date.parse("2026-11-12T20:00:00Z");
  const timer = (o: Partial<PublicTimer> = {}): PublicTimer => ({ totalMs: 90_000, startedAt: new Date(start).toISOString(), pausedAt: null, pausedMs: 0, ...o });
  it("conto alla rovescia prima del via, poi tempo che scende", () => {
    expect(countdownMs(timer(), start - 3000)).toBe(3000);
    expect(remainingMs(timer(), start - 3000)).toBe(90_000);
    expect(remainingMs(timer(), start + 30_000)).toBe(60_000);
  });
  it("pausa: il tempo si ferma; ripresa: si tolgono i ms di pausa", () => {
    const paused = timer({ pausedAt: new Date(start + 30_000).toISOString() });
    expect(remainingMs(paused, start + 90_000)).toBe(60_000);
    expect(isExpired(paused, start + 500_000)).toBe(false);
    const resumed = timer({ pausedMs: 60_000 });
    expect(remainingMs(resumed, start + 90_000)).toBe(60_000);
  });
  it("scadenza solo con il timer attivo", () => {
    expect(isExpired(timer(), start + 90_000)).toBe(true);
    expect(isExpired(timer({ totalMs: null }), start + 9_000_000)).toBe(false);
    expect(remainingMs(timer({ totalMs: null }), start)).toBeNull();
  });
});

describe("PSYCO – rotazione equa dello PSYCO", () => {
  it("con 5 giocatori tutti fanno lo PSYCO prima di ricominciare", () => {
    const ps = ["Sara", "Mike", "Luca", "Giulia", "Marco"].map((id, seat) => ({ id, psycoCount: 0, lastPsycoRound: null as number | null, seat }));
    const seen: string[] = [];
    for (let round = 1; round <= 10; round++) {
      const id = pickPsyco(ps)!;
      seen.push(id);
      const p = ps.find((x) => x.id === id)!;
      p.psycoCount++;
      p.lastPsycoRound = round;
    }
    expect(new Set(seen.slice(0, 5)).size).toBe(5);
    expect(new Set(seen.slice(5, 10)).size).toBe(5);
  });
  it("chi entra dopo (0 volte) ha la precedenza", () => {
    expect(pickPsyco([{ id: "a", psycoCount: 2, lastPsycoRound: 1, seat: 1 }, { id: "nuovo", psycoCount: 0, lastPsycoRound: null, seat: 9 }])).toBe("nuovo");
  });
});

describe("PSYCO – votazioni (maggioranza, parità, mai bloccate)", () => {
  it("sì/no a maggioranza degli aventi diritto, anche in anticipo", () => {
    expect(resolveYesNo(2, 0, 3, false)).toBe("yes");
    expect(resolveYesNo(1, 0, 3, false)).toBeNull();
    expect(resolveYesNo(0, 2, 3, false)).toBe("no");
    expect(resolveYesNo(2, 2, 4, true)).toBe("tie");
    expect(resolveYesNo(1, 0, 4, true)).toBe("yes"); // chiusa dall'host con i voti espressi
    expect(resolveYesNo(0, 0, 4, true)).toBe("tie");
  });
  it("pluralità con spareggio", () => {
    expect(resolvePlurality({ a: 2, b: 1 }, ["a", "b", "c"], 3, false)).toEqual({ winner: "a" });
    expect(resolvePlurality({ a: 1, b: 1 }, ["a", "b", "c"], 4, false)).toBeNull();
    expect(resolvePlurality({ a: 1, b: 1, c: 1 }, ["a", "b", "c"], 3, true)).toEqual({ tie: ["a", "b", "c"] });
    expect(resolvePlurality({}, ["a", "b"], 3, true)).toEqual({ tie: ["a", "b"] });
  });
});

describe("PSYCO – input degli utenti", () => {
  it("nickname: obbligatorio, max 20, niente caratteri invisibili o markup", () => {
    expect(checkNickname("  Sara  ")).toEqual({ ok: true, value: "Sara" });
    expect(checkNickname("")).toMatchObject({ ok: false });
    expect(checkNickname("a".repeat(21))).toMatchObject({ ok: false });
    expect(checkNickname("<b>Mike</b>")).toEqual({ ok: true, value: "bMike/b" });
    expect(checkNickname("Lu​ca")).toEqual({ ok: true, value: "Lu ca" });
  });
  it("regola libera: campo vuoto, troppo corta o troppo lunga", () => {
    expect(checkRuleText("   ").ok).toBe(false);
    expect(checkRuleText("corta").ok).toBe(false);
    expect(checkRuleText("x".repeat(281)).ok).toBe(false);
    expect(checkRuleText("Ogni risposta\ncontiene   un colore")).toEqual({ ok: true, value: "Ogni risposta contiene un colore" });
  });
  it("codici stanza", () => {
    expect(normalizeRoomCode(" ab-c2 3d ")).toBe("ABC23D");
    expect(isRoomCode("ABC23D")).toBe(true);
    expect(isRoomCode("ABC10D")).toBe(false); // 1 e 0 esclusi
    expect(isRoomCode("ABCDE")).toBe(false);
  });
  it("azioni validate", () => {
    expect(actionSchema.safeParse({ action: "vote", ballot: "candidate#1", choice: "yes" }).success).toBe(true);
    expect(actionSchema.safeParse({ action: "boom" }).success).toBe(false);
    expect(actionSchema.safeParse({ action: "kick", participantId: "x" }).success).toBe(false);
  });
});

describe("PSYCO – archivio delle regole", () => {
  it("almeno 50 regole, ripartite tra facile, media e difficile, senza doppioni", () => {
    expect(rules.length).toBeGreaterThanOrEqual(50);
    const by = (d: string) => rules.filter((r) => r.difficulty === d).length;
    expect(by("facile")).toBeGreaterThanOrEqual(15);
    expect(by("media")).toBeGreaterThanOrEqual(15);
    expect(by("difficile")).toBeGreaterThanOrEqual(15);
    expect(new Set(rules.map((r) => r.slug)).size).toBe(rules.length);
    expect(new Set(rules.map((r) => r.description)).size).toBe(rules.length);
    for (const r of rules) {
      expect(r.title.length).toBeGreaterThan(1);
      expect(r.description.length).toBeGreaterThan(10);
      expect(r.description.length).toBeLessThanOrEqual(400);
    }
  });
});

describe("PSYCO – chiamata all'Investigatore: indizi graduati", () => {
  it("ogni regola dell'archivio ha 3 indizi diversi, brevi, che non ripetono la regola", () => {
    for (const r of rules as { slug: string; description: string; hints?: string[] }[]) {
      expect(r.hints, r.slug).toHaveLength(3);
      expect(new Set(r.hints).size, r.slug).toBe(3);
      for (const h of r.hints!) {
        expect(h.length, r.slug).toBeGreaterThan(15);
        expect(h.length, r.slug).toBeLessThanOrEqual(200);
        expect(h, r.slug).not.toBe(r.description);
      }
    }
  });
  it("archivio: livello = numero della chiamata (1 → 3), mai oltre il 3", () => {
    const ruleHints = ["uno", "due", "tre"];
    expect(pickHint({ level: 1, ruleHints })).toEqual({ text: "uno", source: "rule", level: 1 });
    expect(pickHint({ level: 2, ruleHints })).toEqual({ text: "due", source: "rule", level: 2 });
    expect(pickHint({ level: 3, ruleHints })).toEqual({ text: "tre", source: "rule", level: 3 });
    expect(pickHint({ level: 9, ruleHints }).level).toBe(3);
    // indizio mancante (regola nuova dal pannello): ripiego generico, mai vuoto
    expect(pickHint({ level: 2, ruleHints: ["uno", null, "tre"] })).toEqual({ text: CATEGORY_HINTS.altro[1], source: "generic", level: 2 });
  });
  it("regole libere: chiamata 1 = indizio del gruppo, poi la categoria, in ultima istanza «Altro»", () => {
    expect(pickHint({ level: 1, customHint: "Guarda le mani", category: "gesti" })).toEqual({ text: "Guarda le mani", source: "custom", level: 1 });
    expect(pickHint({ level: 2, customHint: "Guarda le mani", category: "gesti" })).toEqual({ text: CATEGORY_HINTS.gesti[1], source: "category", level: 2 });
    expect(pickHint({ level: 1, category: "numeri" })).toEqual({ text: CATEGORY_HINTS.numeri[0], source: "category", level: 1 });
    expect(pickHint({ level: 3, category: "altro" })).toEqual({ text: CATEGORY_HINTS.altro[2], source: "category", level: 3 });
    expect(pickHint({ level: 1 })).toEqual({ text: CATEGORY_HINTS.altro[0], source: "generic", level: 1 });
    for (const c of RULE_CATEGORIES) expect(new Set(CATEGORY_HINTS[c]).size).toBe(3);
  });
  it("indizio scritto dai giocatori: facoltativo, pulito, 6–140 caratteri", () => {
    expect(checkHintText("")).toEqual({ ok: true, value: null });
    expect(checkHintText("   ")).toEqual({ ok: true, value: null });
    expect(checkHintText("ciao")).toMatchObject({ ok: false });
    expect(checkHintText("x".repeat(141))).toMatchObject({ ok: false });
    expect(checkHintText("<b>Guarda​ le\nmani</b>")).toEqual({ ok: true, value: "bGuarda le mani/b" });
  });
  it("impostazioni: chiamate 0–3 (predefinite 2 anche per le stanze vecchie), azione con requestId", () => {
    expect(settingsSchema.safeParse({ timerMs: 60_000, ruleMode: "auto", psycoPick: "auto", calls: 3 }).success).toBe(true);
    expect(settingsSchema.safeParse({ timerMs: 60_000, ruleMode: "auto", psycoPick: "auto", calls: 4 }).success).toBe(false);
    expect(callsOf({})).toBe(2);
    expect(callsOf({ calls: 0 })).toBe(0);
    expect(actionSchema.safeParse({ action: "call_investigator", requestId: "8b0f0c0e-3b8a-4c1e-9a55-2d5c0f3a9e11" }).success).toBe(true);
    expect(actionSchema.safeParse({ action: "call_investigator" }).success).toBe(false);
    expect(actionSchema.safeParse({ action: "propose", text: "Regola di prova lunga", category: "gesti", hint: "Guarda le mani" }).success).toBe(true);
    expect(actionSchema.safeParse({ action: "propose", text: "Regola di prova lunga", category: "boh" }).success).toBe(false);
    expect(createRoomSchema.safeParse({ mode: "personal", settings: { timerMs: null, ruleMode: "auto", psycoPick: "auto" }, screen: true }).success).toBe(true);
  });
});
