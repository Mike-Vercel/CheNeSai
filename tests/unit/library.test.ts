import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { directShow, type DirectorHistory } from "@/lib/show/director";
import { showLinesForPhase } from "@/lib/show/moments";
import {
  curatedVoiceText,
  levelAllowed,
  nextNoAnswerStreak,
  noAnswerEvent,
  normalizeCaps,
  PALMINO_ACCENT_TAG,
  pickMomentLines,
  pickWheelLines,
  renderTemplate,
  revealChoice,
  tagsAllow,
  timeLineDue,
  timeLineStartMs,
  type NoAnswerPlayer,
} from "@/lib/show/library";
import { podiumLines, podiumPlan, speechFor } from "@/features/game/script";
import { DEFAULT_DIRECTOR_CONFIG, type DialogueTemplate, type DirectorConfig, type ShowEvent, type ShowEventType } from "@/lib/show/types";
import type { PublicShowLine, PublicState } from "@/lib/game-engine/types";

const file = JSON.parse(readFileSync(join(process.cwd(), "content", "show", "libreria-ufficiale.json"), "utf8")) as { lines: (DialogueTemplate & { scene?: { key: string; step: number }; cooldownSec: number })[] };
/** La libreria ufficiale come la carica il server. */
const OFFICIAL: DialogueTemplate[] = file.lines.map((l) => ({
  id: l.id,
  character: l.character,
  event: l.event,
  text: l.text,
  tone: "ufficiale",
  intensity: 2,
  priority: 60,
  weight: l.weight,
  cooldownSec: l.cooldownSec,
  animation: l.animation,
  enabled: true,
  level: l.level,
  origin: "ufficiale",
  tags: l.tags,
  sceneKey: l.scene?.key ?? null,
  sceneStep: l.scene?.step ?? null,
}));
const byEvent = (e: ShowEventType) => OFFICIAL.filter((t) => t.event === e);
const empty = (): DirectorHistory => ({ lastUsed: new Map(), mentionsThisRound: new Map() });
const cfg = (patch: Partial<DirectorConfig> = {}): DirectorConfig => ({ ...DEFAULT_DIRECTOR_CONFIG, banterPercent: 0, ...patch });

describe("voce delle battute curate: maiuscole → audio tag, testo dell'utente a schermo", () => {
  it("le MAIUSCOLE diventano minuscole per la sintesi (sigle e nomi propri a posto)", () => {
    expect(normalizeCaps("MINCHIA… E CI HAI PURE PENSATO!")).toBe("Minchia… e ci hai pure pensato!");
    expect(normalizeCaps("PALMINO! PORTAMI UN BICCHIERE D'ACQUA.")).toBe("Palmino! Portami un bicchiere d'acqua.");
    expect(normalizeCaps("E QUESTO CU È, EINSTEIN?!")).toBe("E questo cu è, Einstein?!");
    expect(normalizeCaps("patrimonio dell'UNESCO!")).toBe("patrimonio dell'UNESCO!");
    // i segnaposto non si toccano
    expect(normalizeCaps("MIIII, {nome_primo}! MA CU SI', EINSTEIN?!")).toBe("Miiii, {nome_primo}! Ma cu si', Einstein?!");
  });

  it("urlata = [shouts]; esclamazione dentro una frase = [excited]; Palmino con l'accento siciliano", () => {
    const t = (text: string, character: DialogueTemplate["character"], event: ShowEventType) => ({ text, character, event, tags: [] as string[] });
    expect(curatedVoiceText(t("MA COME SI FA A SBAGLIARE UNA COSA DEL GENERE?!", "professore", "LOSE_PATIENCE"))).toBe("[shouts] Ma come si fa a sbagliare una cosa del genere?!");
    expect(curatedVoiceText(t("AMOOOORE, {nome_giocatore}! Ti sei addormentato?!", "regina", "PLAYER_NO_ANSWER"))).toMatch(/^\[excited\] Amoooore, \{nome_giocatore\}!/);
    expect(curatedVoiceText(t("MIIII, CHE FIGURA!", "palmino", "FILLER"), { palminoAccent: true })).toBe(`${PALMINO_ACCENT_TAG} [shouts] Miiii, che figura!`);
    expect(curatedVoiceText(t("MIIII, CHE FIGURA!", "palmino", "FILLER"), { palminoAccent: false })).toBe("[shouts] Miiii, che figura!");
    // tag scelto a mano
    expect(curatedVoiceText({ text: "No… ditemi che non è vero…", character: "regina", event: "LOSE_PATIENCE", tags: ["voce:whispers"] })).toBe("[whispers] No… ditemi che non è vero…");
  });

  it("a schermo resta il testo dell'utente (con il nome vero); le battute di sempre non cambiano", () => {
    const official = OFFICIAL.find((t) => t.id === "uff-palmino-nomi-53")!;
    const r = renderTemplate(official, { nome_primo: "Gigi" }, { palminoAccent: true })!;
    expect(r.display).toBe("MIIII, Gigi! MA CU SI', EINSTEIN?!");
    // urlata ma in un momento bello (nuovo primo): entusiasmo
    expect(r.text).toBe(`${PALMINO_ACCENT_TAG} [excited] Miiii, Gigi! Ma cu si', Einstein?!`);
    expect(r.live).toBe(true);
    const fixed = renderTemplate(OFFICIAL.find((t) => t.id === "uff-professore-sbaglia-14")!, {})!;
    expect(fixed.live).toBe(false);
    const base = renderTemplate({ text: "[excited] Bravo {nome}!", character: "regina", event: "ONLY_ONE_CORRECT", tags: [], origin: undefined }, { nome: "Ugo" });
    expect(base).toEqual({ text: "[excited] Bravo Ugo!", live: true });
  });
});

describe("livello di comicità e condizioni", () => {
  it("leggero < sarcastico < irriverente", () => {
    expect(levelAllowed("irriverente", "sarcastico")).toBe(false);
    expect(levelAllowed("sarcastico", "irriverente")).toBe(true);
    expect(levelAllowed(undefined, "leggero")).toBe(true);
  });

  it("con il livello leggero non escono mai parolacce né battute sarcastiche", () => {
    for (let i = 0; i < 40; i++) {
      const lines = pickMomentLines({
        templates: OFFICIAL,
        event: { type: "ANSWER_WRONG", facts: { players: 5, answered: 5, right: 1, difficulty: 3, fourOptions: true } },
        render: (t) => renderTemplate(t, {}),
        comedyLevel: "leggero",
        ctx: { group: 4 },
        lastUsed: new Map(),
        nowMs: 0,
        seed: `s${i}`,
        scenes: false,
      });
      for (const l of lines) {
        const t = OFFICIAL.find((x) => x.id === l.templateId)!;
        expect(t.level).toBe("leggero");
        expect(l.display).not.toMatch(/minchia/i);
      }
    }
  });

  it("timer30, squadre, tutti, gruppo, non_finale", () => {
    expect(tagsAllow(["timer30"], { timerSeconds: 20 })).toBe(false);
    expect(tagsAllow(["timer30"], { timerSeconds: 30 })).toBe(true);
    expect(tagsAllow(["squadre"], { mode: "individual" })).toBe(false);
    expect(tagsAllow(["squadre"], { mode: "teams" })).toBe(true);
    expect(tagsAllow(["tutti"], { everyone: false })).toBe(false);
    expect(tagsAllow(["gruppo"], { group: 1 })).toBe(false);
    expect(tagsAllow(["gruppo"], { group: 3 })).toBe(true);
    expect(tagsAllow(["non_finale"], { moment: { lastOfRound: true, lastOfGame: true } })).toBe(false);
  });
});

describe("soluzione: la reazione segue l'esito vero", () => {
  const f = (answered: number, right: number, difficulty = 3) => ({ players: answered, answered, right, difficulty, fourOptions: true });
  it("nessuno giusto: 'tutti'; facilissima: sbagliata su domanda facile o perde la pazienza", () => {
    const none = revealChoice(f(4, 0), "q1")!;
    expect(["ANSWER_WRONG", "LOSE_PATIENCE"]).toContain(none.event.type);
    expect(none.ctx.everyone).toBe(true);
    const easy = revealChoice(f(4, 0, 1), "q2")!;
    expect(["EASY_WRONG", "LOSE_PATIENCE"]).toContain(easy.event.type);
    expect(revealChoice(f(5, 1, 1), "q3")!.event.type).toBe("EASY_WRONG");
    expect(revealChoice(f(5, 1), "q3")!.event.type).toBe("ANSWER_WRONG");
    expect(revealChoice(f(5, 4), "q4")!.event.type).toBe("ANSWER_CORRECT");
    // nessuna risposta: resta la battuta di sempre ("nessuno")
    expect(revealChoice(f(0, 0), "q5")).toBeNull();
  });

  it("perdere la pazienza solo quando nessuno indovina; con qualcuno giusto mai le battute 'tutti'", () => {
    for (let i = 0; i < 50; i++) {
      const c = revealChoice(f(6, 2), `x${i}`)!;
      expect(c.event.type).toBe("ANSWER_WRONG");
      const lines = pickMomentLines({ templates: OFFICIAL, event: c.event, render: (t) => renderTemplate(t, {}), comedyLevel: "irriverente", ctx: c.ctx, lastUsed: new Map(), nowMs: 0, seed: `x${i}` });
      for (const l of lines) expect(OFFICIAL.find((t) => t.id === l.templateId)!.tags).not.toContain("tutti");
    }
  });
});

describe("mancate risposte (PLAYER_NO_ANSWER)", () => {
  const P = (id: string, extra: Partial<NoAnswerPlayer> = {}): NoAnswerPlayer => ({
    id,
    nickname: id.toUpperCase(),
    inPlay: true,
    answered: true,
    connected: true,
    rank: 2,
    points: 1000,
    streak: 0,
    teamId: null,
    ...extra,
  });
  const base = { mode: "individual" as const, teams: [], lastMocked: new Map<string, number>(), nowMs: 1_000_000 };

  it("contatore: +1 da collegato, 0 quando risponde o da disconnesso (al rientro si riparte)", () => {
    expect(nextNoAnswerStreak(0, { answered: false, connected: true })).toBe(1);
    expect(nextNoAnswerStreak(2, { answered: false, connected: true })).toBe(3);
    expect(nextNoAnswerStreak(2, { answered: true, connected: true })).toBe(0);
    expect(nextNoAnswerStreak(2, { answered: false, connected: false })).toBe(0);
  });

  it("mai chi è disconnesso", () => {
    const ev = noAnswerEvent({ ...base, players: [P("a"), P("b"), P("c"), P("d", { answered: false, connected: false })], seed: "s" });
    expect(ev).toBeNull();
  });

  it("tanti non rispondono (almeno metà): una battuta per tutti, senza nomi", () => {
    const ev = noAnswerEvent({ ...base, players: [P("a"), P("b"), P("c", { answered: false }), P("d", { answered: false })], seed: "s" });
    expect(ev).toEqual({ type: "MANY_NO_ANSWER", count: 2 });
  });

  it("primo, ultimo e tre di fila: posizione verificata al momento", () => {
    const leader = noAnswerEvent({ ...base, players: [P("a", { rank: 1, answered: false }), P("b", { rank: 2 }), P("c", { rank: 3 })], seed: "s" });
    expect(leader).toMatchObject({ type: "NO_ANSWER_LEADER", who: { id: "a" } });
    const last = noAnswerEvent({ ...base, players: [P("a", { rank: 1 }), P("b", { rank: 2 }), P("c", { rank: 3, answered: false })], seed: "s" });
    expect(last).toMatchObject({ type: "NO_ANSWER_LAST", who: { id: "c" } });
    const three = noAnswerEvent({ ...base, players: [P("a", { rank: 1 }), P("b", { rank: 2, answered: false, streak: 3 }), P("c", { rank: 3 }), P("d", { rank: 4 })], seed: "s" });
    expect(three).toMatchObject({ type: "NO_ANSWER_STREAK", who: { id: "b" }, streak: 3 });
    // primo a pari merito: non è "il primo"
    const tie = noAnswerEvent({ ...base, players: [P("a", { rank: 1, answered: false }), P("b", { rank: 1 }), P("c", { rank: 3 })], seed: "s" });
    expect(tie?.type).not.toBe("NO_ANSWER_LEADER");
  });

  it("nomi alternati e pausa per giocatore", () => {
    const players = [P("a", { rank: 2, answered: false }), P("b", { rank: 2, answered: false }), P("c", { rank: 2 }), P("d", { rank: 2 }), P("e", { rank: 2 })];
    // uno dei due è appena stato nominato: tocca all'altro (situazione speciale per avere sempre l'evento)
    const lastMocked = new Map([["a", 900_000]]);
    const seeds = Array.from({ length: 30 }, (_, i) => `seed${i}`);
    const picked = seeds.map((seed) => noAnswerEvent({ ...base, lastMocked, players, seed })).filter((e) => e !== null);
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((e) => "who" in e && e.who.id === "b")).toBe(true);
    // entrambi nominati di recente: nessuno
    expect(noAnswerEvent({ ...base, lastMocked: new Map([["a", 900_000], ["b", 950_000]]), players, seed: "s" })).toBeNull();
  });

  it("squadre ('teams'): mai un singolo, solo la squadra intera", () => {
    const teams = [
      { id: "t1", name: "I Fenicotteri" },
      { id: "t2", name: "Gli Squali" },
    ];
    const players = [P("a", { teamId: "t1", answered: false }), P("b", { teamId: "t2" }), P("c", { teamId: "t2" }), P("d", { teamId: "t2" })];
    expect(noAnswerEvent({ ...base, mode: "teams", teams, players, seed: "s" })).toEqual({ type: "TEAM_NO_ANSWER", team: teams[0] });
    const partial = [P("a", { teamId: "t1", answered: false }), P("e", { teamId: "t1" }), P("b", { teamId: "t2" }), P("c", { teamId: "t2" })];
    expect(noAnswerEvent({ ...base, mode: "teams", teams, players: partial, seed: "s" })).toBeNull();
  });

  it("una sola battuta (o scenetta) per domanda, con il nome vero pronunciato", () => {
    const ev: ShowEvent = { type: "PLAYER_NO_ANSWER", who: { id: "p1", nickname: "Lalla" }, streak: 1 };
    const lines = directShow({ events: [ev], templates: OFFICIAL, history: empty(), config: cfg({ maxLines: 3 }), nowMs: 0, seed: "q9", lastSceneMs: null });
    expect(lines.length).toBeGreaterThan(0);
    const scene = lines[0].group;
    if (!scene) expect(lines).toHaveLength(1);
    else expect(lines.every((l) => l.group === scene)).toBe(true);
    expect(lines.some((l) => l.text.includes("Lalla"))).toBe(true);
    expect(lines.every((l) => !/\{[a-z_]+\}/.test(l.text) && !/\{[a-z_]+\}/.test(l.display ?? ""))).toBe(true);
    expect(lines.every((l) => l.optional)).toBe(true);
  });
});

describe("scenette e variazione", () => {
  it("la scenetta si dice tutta, in ordine, con i personaggi giusti; mai a metà", () => {
    const comeback: ShowEvent = { type: "COMEBACK", who: { id: "x", nickname: "Tano" }, positions: 3 };
    const sceneOnly = byEvent("COMEBACK").filter((t) => t.sceneKey);
    const lines = directShow({ events: [comeback], templates: sceneOnly, history: empty(), config: cfg(), nowMs: 0, seed: "s", lastSceneMs: null });
    expect(lines.map((l) => l.who)).toEqual(["regina", "professore", "palmino"]);
    expect(new Set(lines.map((l) => l.group)).size).toBe(1);
    // una riga disattivata: niente scenetta
    const broken = sceneOnly.map((t, i) => (i === 1 ? { ...t, enabled: false } : t));
    expect(directShow({ events: [comeback], templates: broken, history: empty(), config: cfg(), nowMs: 0, seed: "s", lastSceneMs: null })).toHaveLength(0);
    // scenetta troppo vicina all'ultima: niente
    expect(directShow({ events: [comeback], templates: sceneOnly, history: empty(), config: cfg(), nowMs: 10_000, seed: "s", lastSceneMs: 0 })).toHaveLength(0);
  });

  it("niente ripetizioni nella serata (cooldown) e peso ridotto per le battute delle serate precedenti", () => {
    const ev: ShowEvent = { type: "ONLY_ONE_WRONG", who: { id: "p", nickname: "Ugo" } };
    const lastUsed = new Map(byEvent("ONLY_ONE_WRONG").map((t) => [t.id, 0]));
    expect(directShow({ events: [ev], templates: OFFICIAL, history: { lastUsed, mentionsThisRound: new Map() }, config: cfg(), nowMs: 60_000, seed: "s" })).toHaveLength(0);
    const elsewhere = new Set(byEvent("ONLY_ONE_WRONG").slice(1).map((t) => t.id));
    const picks = Array.from({ length: 200 }, (_, i) => directShow({ events: [ev], templates: OFFICIAL, history: empty(), config: cfg(), nowMs: 0, seed: `v${i}`, elsewhere })[0]?.templateId);
    const fresh = byEvent("ONLY_ONE_WRONG")[0].id;
    const share = picks.filter((id) => id === fresh).length / picks.length;
    // senza penalità sarebbe ~1/6
    expect(share).toBeGreaterThan(0.3);
  });
});

describe("vincitore SOLO al podio, dopo la rivelazione del nome", () => {
  it("il nome del vincitore esiste solo nell'evento GAME_WINNER, visibile solo nella fase FINISHED", () => {
    const line: PublicShowLine = { who: "palmino", text: "x Gigi", animation: null, event: "GAME_WINNER" };
    for (const phase of ["SCORE_REVEAL", "LEADERBOARD", "ANSWER_REVEAL", "ROUND_INTRO", "OPTIONS_VISIBLE"] as const) expect(showLinesForPhase(phase, [line])).toEqual([]);
    expect(showLinesForPhase("FINISHED", [line])).toEqual([line]);
    // i punti di una risposta non producono mai battute sul vincitore della serata
    const lines = directShow({
      events: [{ type: "ROUND_WINNER", leaders: [{ id: "a", nickname: "Anna" }], points: 100 }, { type: "LEADER_CHANGED", leader: { id: "a", nickname: "Anna" }, previous: { id: "b", nickname: "Bea" }, points: 10 }],
      templates: OFFICIAL,
      history: empty(),
      config: cfg(),
      nowMs: 0,
      seed: "s",
    });
    expect(lines.some((l) => l.event === "GAME_WINNER")).toBe(false);
  });

  it("al podio la battuta sul vincitore viene dopo il nome gridato col rullo, prima dei saluti", () => {
    const lb = [
      { nickname: "Anna", rank: 1, points: 900 },
      { nickname: "Bea", rank: 2, points: 500 },
      { nickname: "Ciro", rank: 3, points: 100 },
    ];
    const extra = [{ who: "regina" as const, text: "[excited] Amoooore, Anna! Hai vinto!", live: true, display: "AMOOOORE, Anna! HAI VINTO!" }];
    const plan = podiumPlan(lb, "s", extra);
    expect(plan.after).toEqual(extra);
    const order = podiumLines(lb, "s", extra).map((l) => l.text);
    const winnerShout = order.findIndex((t) => t.includes("Anna") && t.includes("Complimentoni"));
    const lib = order.indexOf(extra[0].text);
    expect(winnerShout).toBeGreaterThanOrEqual(0);
    expect(lib).toBeGreaterThan(winnerShout);
    expect(lib).toBeLessThan(order.length - 1);
    // nessun vincitore (classifica vuota): nessuna battuta
    expect(podiumPlan([], "s", extra).after).toEqual([]);
  });
});

describe("copione del TV con la libreria", () => {
  it("alla soluzione la reazione della libreria prende il posto della battuta di sempre", () => {
    const reaction: PublicShowLine = { who: "palmino", text: "[shouts] Minchia…", animation: "surprised", event: "ANSWER_WRONG", live: false, optional: true, display: "MINCHIA…" };
    const s = {
      sessionId: "s",
      phase: "ANSWER_REVEAL",
      phaseStartedAt: "2026-11-11T20:00:00Z",
      playerCount: 3,
      showLines: [reaction],
      question: {
        id: "q",
        number: 1,
        positionInRound: 1,
        totalInRound: 5,
        type: "single",
        text: "Capitale?",
        presenter: "professore",
        media: null,
        options: [
          { position: 0, text: "A" },
          { position: 1, text: "B" },
        ],
        correctPositions: [0],
        distribution: [0, 3],
        rules: {},
      },
      round: { index: 1, total: 2 },
    } as unknown as PublicState;
    const lines = speechFor(s, { phase: "ANSWERS_LOCKED" }, { readOptions: false });
    const said = lines.find((l) => l.text === reaction.text);
    expect(said).toMatchObject({ who: "palmino", live: false, optional: true, display: "MINCHIA…" });
    expect(lines.filter((l) => l.who === "professore" && /Nessuno|Zero/.test(l.text))).toHaveLength(0);
  });
});

describe("tempo che scade (TV)", () => {
  it("parte negli ultimi secondi, in tempo per finire; mai se hanno risposto tutti o se parla qualcuno", () => {
    const start = timeLineStartMs("Il tempo scorre, signori. E purtroppo non accelera il vostro ragionamento.");
    expect(start).toBeGreaterThan(4000);
    expect(start).toBeLessThanOrEqual(10_000);
    expect(timeLineStartMs("TRE, DUE, UNO… CIAOOO!", ["countdown"])).toBe(3800);
    const p = { startAtMs: 6000, textMs: 4000, answered: 2, players: 5, voiceBusy: false };
    expect(timeLineDue({ ...p, remainingMs: 9000 })).toBe(false);
    expect(timeLineDue({ ...p, remainingMs: 5800 })).toBe(true);
    expect(timeLineDue({ ...p, remainingMs: 4200 })).toBe(false);
    expect(timeLineDue({ ...p, remainingMs: 5800, answered: 5 })).toBe(false);
    expect(timeLineDue({ ...p, remainingMs: 5800, voiceBusy: true })).toBe(false);
  });
});

describe("ruota (da collegare): pickWheelLines", () => {
  it("Palmino per primo, poi un altro presentatore; stesso seme → stesse battute", () => {
    const a = pickWheelLines({ templates: OFFICIAL, comedyLevel: "irriverente", seed: "round-1", max: 2 });
    const b = pickWheelLines({ templates: OFFICIAL, comedyLevel: "irriverente", seed: "round-1", max: 2 });
    expect(a).toEqual(b);
    expect(a[0].who).toBe("palmino");
    expect(a).toHaveLength(2);
    expect(a[1].who).not.toBe("palmino");
    expect(a.every((l) => l.event === "WHEEL_SPIN" && l.optional && l.display)).toBe(true);
    for (const l of pickWheelLines({ templates: OFFICIAL, comedyLevel: "leggero", seed: "r", max: 2 })) expect(OFFICIAL.find((t) => t.id === l.templateId)!.level).toBe("leggero");
  });
});
