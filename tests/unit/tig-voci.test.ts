import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { directVoice } from "@/features/tig/voice-director";
import { fillVoiceText, isVoiceFile, pickLine } from "@/lib/tig/voices/fill";
import { VOICE_CATEGORIES, VOICE_VARS, type VoiceFile } from "@/lib/tig/voices/schema";
import type { PublicTeam, TigPublicState } from "@/lib/tig/types";

/**
 * Catalogo vocale VERO (content/tig/voci) + regia delle voci: ogni file è leggibile, le variabili sono quelle
 * ammesse, il testo riempito non lascia graffe né nomi degli utenti, e la regia trova sempre qualcuno che parla.
 */
const DIR = path.join(process.cwd(), "content", "tig", "voci");
const files: VoiceFile[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as VoiceFile);

describe("TAVOLI IN GUERRA! · catalogo vocale", () => {
  it("24 personaggi, file validi, id unici, categorie e variabili ammesse", () => {
    expect(files.length).toBeGreaterThanOrEqual(24);
    const ids = new Set<string>();
    for (const f of files) {
      expect(isVoiceFile(f), f.character?.id).toBe(true);
      for (const l of f.lines) {
        expect(ids.has(l.id), l.id).toBe(false);
        ids.add(l.id);
        expect(Object.keys(VOICE_CATEGORIES)).toContain(l.scene);
        for (const v of l.vars) expect(VOICE_VARS).toContain(v);
      }
    }
    for (const id of ["professor-smoke", "victor", "zafira", "don-patrizio", "regina"]) expect(files.some((f) => f.character.id === id), id).toBe(true);
  });

  it("variabili sostituite senza lasciare graffe (tavoli, mascotte, punti, manche, minigioco)", () => {
    const vars = { tavoloA: 3, tavoloB: 7, mascotA: 2, mascotB: null, punti: 120, manche: 2, minigioco: "MEMORIA LAMPO", secondi: 10, posizione: 2 };
    let n = 0;
    for (const f of files)
      for (const l of f.lines) {
        const t = fillVoiceText(l.text, vars);
        expect(t, l.id).not.toMatch(/[{}]/);
        n++;
      }
    expect(n).toBeGreaterThan(2000);
  });

  it("la regia delle voci trova una battuta per ogni momento della serata", () => {
    const team = (id: string, tableNo: number, rank: number): PublicTeam => ({ teamId: id, tableNo, name: `Squadra ${tableNo}`, approved: true, color: "#ff0000", mascotSlot: tableNo, mascotLevel: 1, score: 100 * (4 - rank), rank, delta: null, energy: 0, chaosProgress: 0, online: true, members: 2, shield: false, caosUsed: false, wins: 0 });
    const base: TigPublicState = { eventId: "e", version: 1, secretRev: 0, serverNow: new Date().toISOString(), status: "open", closeReason: null, state: "LOBBY_OPEN", pausedFrom: null, venue: "Pub", accessMode: "qr", lateJoin: false, manche: null, timer: null, teams: [team("a", 1, 1), team("b", 2, 2), team("c", 3, 3)], pendingTeams: 0, game: null, spotlight: null, caosWindow: false, hideScores: false, awards: null, event: null, plan: [], breakEndsAt: null, chaosThresholds: { level2: 60, level3: 150 } };
    const step = (patch: Partial<TigPublicState>, prev: TigPublicState) => ({ ...prev, ...patch, version: prev.version + 1 });
    const s1 = step({ state: "INTRO" }, base);
    const s2 = step({ state: "ROUND_INTRO", manche: { no: 1, title: "CHI PARTE MALE...", tagline: "", gameIndex: 0, gamesTotal: 4 } }, s1);
    const game = { id: "g1", code: "prova-rapida", title: "PROVA RAPIDA", rule: "", input: "team" as const, kind: "regular" as const, mancheNo: 1, slotNo: 1, participants: ["a", "b", "c"], startsAt: "", deadlineAt: "", timerMs: 30000, stage: "rule" as const, view: null, submittedTeamIds: [], reveal: null, outcome: null, winnerTeamId: null, betEnabled: false };
    const s3 = step({ state: "GAME_ACTIVE", game }, s2);
    const s4 = step({ state: "GAME_RESULTS", game: { ...game, stage: "reveal", outcome: { outcomes: [{ teamId: "a", points: 110, chaos: 0, correct: true, accuracy: 1, label: "" }] } } }, s3);
    const s5 = step({ state: "LEADERBOARD", teams: [team("a", 1, 2), team("b", 2, 1), team("c", 3, 3)] }, s4);
    const caos = { ...game, id: "g2", kind: "caos" as const, participants: ["a", "c"] };
    const s6 = step({ state: "GAME_ACTIVE", game: caos }, s5);
    const s7 = step({ state: "FINAL" }, s6);
    const s8 = step({ state: "AWARDS", awards: { order: ["c", "a", "b"] } }, s7);
    const chain = [base, s1, s2, s3, s4, s5, s6, s7, s8];
    const categories: string[] = [];
    for (let i = 1; i < chain.length; i++) {
      const { cues } = directVoice(chain[i - 1], chain[i]);
      for (const c of cues) {
        categories.push(c.category);
        const found = files.some((f) => pickLine(f, c.category, c.vars, []) !== null);
        expect(found, c.category).toBe(true);
      }
    }
    expect(categories).toEqual(expect.arrayContaining(["APERTURA", "INIZIO_MANCHE", "MINIGIOCO_PRESENTAZIONE", "RISPOSTA_CORRETTA", "SORPASSO", "BOTTONE_CAOS", "FINALE", "PREMIAZIONE", "VITTORIA"]));
    // il sorpasso usa i numeri dei tavoli, mai i nomi
    const sorpasso = directVoice(s4, s5).cues.find((c) => c.category === "SORPASSO")!;
    expect(sorpasso.vars).toMatchObject({ tavoloA: 2, tavoloB: 1 });
    expect(JSON.stringify(sorpasso.vars)).not.toContain("Squadra");
    // l'allarme caos interrompe
    expect(directVoice(s5, s6).cues[0]).toMatchObject({ category: "BOTTONE_CAOS", interrupt: true });
  });
});
