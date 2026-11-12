import { describe, expect, it } from "vitest";
import { cuesFor, startCues, timerWarning, VOICE_IDS, VOICE_LINES } from "@/features/psyco/narrator";
import type { PsycoPublicState, PublicRound } from "@/lib/psyco/types";

const round = (o: Partial<PublicRound> = {}): PublicRound => ({
  no: 1,
  psycoId: "p",
  psycoNickname: "Mike",
  ruleMode: "auto",
  difficulty: null,
  members: [],
  seen: [],
  ready: [],
  timer: { totalMs: 90_000, startedAt: null, pausedAt: null, pausedMs: 0 },
  attempts: 0,
  candidatesShown: 0,
  proposed: [],
  passed: [],
  proposalsCount: 0,
  vote: null,
  outcome: null,
  endedAt: null,
  elapsedMs: null,
  revealedRule: null,
  ...o,
});
let v = 1;
const st = (phase: PsycoPublicState["phase"], r: PublicRound | null = round(), extra: Partial<PsycoPublicState> = {}): PsycoPublicState => ({
  roomId: "r",
  code: "ABCDEF",
  mode: "personal",
  status: "open",
  phase,
  version: v++,
  secretRev: 0,
  serverNow: new Date().toISOString(),
  settings: { timerMs: 90_000, ruleMode: "auto", psycoPick: "auto" },
  minPlayers: 3,
  hostParticipantId: null,
  hostOnline: true,
  displayOnline: false,
  participants: [],
  activeCount: 3,
  round: r,
  history: [],
  event: null,
  ...extra,
});

describe("PSYCO – narratore: momenti → clip", () => {
  it("34 clip, ognuno col suo sottotitolo", () => {
    expect(VOICE_IDS).toHaveLength(34);
    for (const id of VOICE_IDS) expect(VOICE_LINES[id].length).toBeGreaterThan(3);
  });
  it("benvenuto in sala d'attesa, ruoli, scelta, regola, via", () => {
    expect(cuesFor(null, st("LOBBY", null))).toEqual(["benvenuti", "lobby-attesa"]);
    expect(cuesFor(st("LOBBY", null), st("ROLE_REVEAL"))).toEqual(["ruoli-assegnati"]);
    expect(cuesFor(st("ROLE_REVEAL"), st("DIFFICULTY_VOTE"))).toEqual(["tutti-visto", "psyco-non-guardare", "scegliete-difficolta"]);
    expect(cuesFor(st("ROLE_REVEAL"), st("RULE_PROPOSALS"))).toEqual(["tutti-visto", "psyco-non-guardare", "scrivete-regole"]);
    expect(cuesFor(st("DIFFICULTY_VOTE"), st("RULE_VOTE", round({ candidatesShown: 1 })))).toEqual(["votate-regola"]);
    expect(cuesFor(st("RULE_VOTE", round({ candidatesShown: 1 })), st("RULE_VOTE", round({ candidatesShown: 2 })))).toEqual(["nuova-regola"]);
    expect(cuesFor(st("RULE_VOTE"), st("RULE_CONFIRMED"))).toEqual(["regola-scelta", "pronti"]);
    expect(cuesFor(st("RULE_CONFIRMED"), st("PLAYING"))).toEqual(["countdown"]);
    expect(startCues(st("PLAYING", round({ timer: { totalMs: null, startedAt: null, pausedAt: null, pausedMs: 0 } })))).toEqual(["via", "senza-tempo"]);
  });
  it("verifica, esiti, nuova manche, fine partita", () => {
    expect(cuesFor(st("PLAYING"), st("GUESS_VOTE"))).toEqual(["ho-capito", "votate-risposta"]);
    expect(cuesFor(st("GUESS_VOTE"), st("PLAYING", round(), { event: { kind: "guess_wrong", at: "2026-11-12T10:00:00Z" } }))).toEqual(["risposta-sbagliata"]);
    expect(cuesFor(st("GUESS_VOTE"), st("ROUND_END", round({ outcome: "guessed" })))).toEqual(["risposta-giusta", "ecco-la-regola", "vince-psyco"]);
    expect(cuesFor(st("PLAYING"), st("ROUND_END", round({ outcome: "time_up" })))).toEqual(["tempo-scaduto", "ecco-la-regola", "vince-gruppo"]);
    expect(cuesFor(st("ROUND_END"), st("ROLE_REVEAL", round({ no: 2 })))).toEqual(["nuova-manche", "ruoli-assegnati"]);
    expect(cuesFor(st("ROUND_END"), st("ROUND_END", round(), { status: "closed" }))).toEqual(["fine-partita"]);
  });
  it("pausa e ripresa", () => {
    const started = new Date(Date.now() - 10_000).toISOString();
    const a = st("PLAYING", round({ timer: { totalMs: 90_000, startedAt: started, pausedAt: null, pausedMs: 0 } }));
    const b = st("PLAYING", round({ timer: { totalMs: 90_000, startedAt: started, pausedAt: new Date().toISOString(), pausedMs: 0 } }));
    expect(cuesFor(a, b)).toEqual(["pausa"]);
    expect(cuesFor(b, { ...a, version: v++ })).toEqual(["ripresa"]);
  });
  it("avvisi del timer solo se la durata li supera, una volta sola, mai in pausa", () => {
    const now = Date.parse("2026-11-12T20:00:00Z");
    const mk = (total: number, elapsed: number, paused = false) =>
      st("PLAYING", round({ timer: { totalMs: total, startedAt: new Date(now - elapsed).toISOString(), pausedAt: paused ? new Date(now).toISOString() : null, pausedMs: 0 } }));
    const said = new Set<string>();
    expect(timerWarning(mk(120_000, 60_500), now, said)).toBe("un-minuto");
    expect(timerWarning(mk(120_000, 60_600), now, said)).toBeNull(); // già detto
    expect(timerWarning(mk(45_000, 15_500), now, new Set())).toBe("trenta-secondi"); // niente «un minuto» in 45 s
    expect(timerWarning(mk(45_000, 0), now, new Set())).toBeNull();
    expect(timerWarning(mk(90_000, 80_500, true), now, new Set())).toBeNull();
    expect(timerWarning(mk(90_000, 80_500), now, new Set())).toBe("dieci-secondi");
  });
});
