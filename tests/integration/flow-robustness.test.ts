import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getSql } from "@/lib/database/db";
import { AUTO_MIN_PHASE_MS } from "@/lib/game-engine/autoplay";
import { updateSessionSettings } from "@/lib/server/cms/sessions";
import { autoTick, closeAnswersIfAllAnswered, reportTvSpeech, TV_SPEECH_CAP_MS, watchdogTick } from "@/lib/server/engine";
import { authenticatePlayer, joinSession, submitAnswer, type PlayerAuth } from "@/lib/server/players";
import { buildPublicState } from "@/lib/server/public-state";
import { ensureClip, planClip, TtsError, type VoiceConfig } from "@/lib/server/tts";
import { buildPublishedSession, cleanupSession, cmd, TEST_ACTOR, type Fixture } from "../support/fixtures";

/**
 * Partita che scorre senza tagli, silenzi né blocchi:
 * - il TV dice quando sta parlando / ha finito (tv_presence): il passo aspetta e poi si anticipa;
 * - tutti hanno risposto → risposte chiuse subito;
 * - ElevenLabs appeso → i comandi finiscono lo stesso in fretta e la clip rinuncia entro la scadenza;
 * - passo automatico in ritardo → la rete di sicurezza lo esegue.
 */
const sql = getSql();
const created: string[] = [];
const realReadDelay = process.env.QZ_OPTIONS_READ_DELAY;

async function row(sessionId: string) {
  const [r] = await sql<{ phase: string; version: number; auto_next_at: Date | null; auto_version: number | null }[]>`
    select phase, version, auto_next_at, auto_version from game_state where session_id = ${sessionId}`;
  return r;
}

async function autoSession(): Promise<{ fx: Fixture; players: PlayerAuth[] }> {
  const fx = await buildPublishedSession({ isTest: true });
  created.push(fx.sessionId);
  await updateSessionSettings(fx.sessionId, { advanceMode: "auto" }, TEST_ACTOR);
  await cmd(fx.sessionId, "OPEN_LOBBY");
  const players: PlayerAuth[] = [];
  for (const n of ["Anna", "Bruno"]) {
    const j = await joinSession({ code: fx.code, nickname: n }, { ip: `10.4.0.${players.length + 1}`, deviceToken: null });
    players.push(await authenticatePlayer(sql, fx.code, j.participantToken));
  }
  return { fx, players };
}

beforeAll(() => {
  process.env.QZ_OPTIONS_READ_DELAY = "0";
});

afterEach(() => {
  process.env.QZ_OPTIONS_READ_DELAY = "0";
});

afterAll(async () => {
  process.env.QZ_OPTIONS_READ_DELAY = realReadDelay;
  vi.restoreAllMocks();
  for (const id of created) await cleanupSession(id);
  await sql`delete from question_bank where 'test-automatico' = any(tags)`;
  await sql.end();
});

describe("il TV guida lo scorrimento (tv_presence)", () => {
  let fx: Fixture;

  beforeAll(async () => {
    ({ fx } = await autoSession());
    await cmd(fx.sessionId, "START_ROUND");
  });

  it("finché il TV parla il passo aspetta; oltre il tetto si va avanti comunque", async () => {
    const r = await row(fx.sessionId);
    expect(r.phase).toBe("ROUND_INTRO");
    expect(await reportTvSpeech(fx.sessionId, r.version, true)).toBeNull();
    await sql`update game_state set auto_next_at = clock_timestamp() - interval '1 second' where session_id = ${fx.sessionId}`;
    expect((await autoTick(fx.sessionId)).advanced).toBe(false); // il presentatore sta ancora parlando
    await sql`update game_state set auto_next_at = clock_timestamp() - make_interval(secs => ${TV_SPEECH_CAP_MS / 1000 + 1}) where session_id = ${fx.sessionId}`;
    const t = await autoTick(fx.sessionId);
    expect(t.advanced).toBe(true); // TV muto da troppo: non si resta fermi
    expect((await row(fx.sessionId)).phase).toBe("QUESTION_VISIBLE");
  });

  it("domanda letta: le risposte compaiono subito (passo anticipato), non all'orario stimato", async () => {
    const r = await row(fx.sessionId);
    expect(r.phase).toBe("QUESTION_VISIBLE");
    await reportTvSpeech(fx.sessionId, r.version, true);
    // la lettura è durata più della durata minima; la stima del server diceva ancora 5 s
    await sql`
      update game_state set phase_started_at = clock_timestamp() - make_interval(secs => ${AUTO_MIN_PHASE_MS.QUESTION_VISIBLE! / 1000 + 0.5}),
        auto_next_at = clock_timestamp() + interval '5 seconds'
      where session_id = ${fx.sessionId}`;
    const t0 = Date.now();
    const t = await reportTvSpeech(fx.sessionId, r.version, false);
    expect(t?.advanced).toBe(true);
    expect(Date.now() - t0).toBeLessThan(3000);
    expect((await row(fx.sessionId)).phase).toBe("OPTIONS_VISIBLE");
  });

  it("risposte aperte: il TV che ha finito non taglia il tempo dei giocatori", async () => {
    const r = await row(fx.sessionId);
    const t = await reportTvSpeech(fx.sessionId, r.version, false);
    expect(t?.advanced).toBe(false);
    expect((await row(fx.sessionId)).phase).toBe("OPTIONS_VISIBLE");
  });

  it("TV chiuso da tempo: nessuna attesa", async () => {
    const r = await row(fx.sessionId);
    await reportTvSpeech(fx.sessionId, r.version, true);
    await sql`update tv_presence set seen_at = now() - interval '1 minute' where session_id = ${fx.sessionId}`;
    await sql`update game_state set auto_next_at = clock_timestamp() - interval '1 second' where session_id = ${fx.sessionId}`;
    expect((await autoTick(fx.sessionId)).advanced).toBe(true);
  });
});

describe("tutti hanno risposto: risposte chiuse subito", () => {
  it("chiude solo quando ha risposto l'ultimo giocatore attivo (idempotente)", async () => {
    const { fx, players } = await autoSession();
    await cmd(fx.sessionId, "START_ROUND");
    await cmd(fx.sessionId, "SHOW_QUESTION");
    await cmd(fx.sessionId, "SHOW_OPTIONS");
    const s = (await buildPublicState(sql, fx.sessionId))!;
    const sq = s.question!.id;
    await submitAnswer(players[0], { sessionQuestionId: sq, positions: [0], requestId: randomUUID() }, null);
    expect(await closeAnswersIfAllAnswered(fx.sessionId, sq)).toBe(false);
    expect((await row(fx.sessionId)).phase).toBe("OPTIONS_VISIBLE");
    await submitAnswer(players[1], { sessionQuestionId: sq, positions: [1], requestId: randomUUID() }, null);
    expect(await closeAnswersIfAllAnswered(fx.sessionId, sq)).toBe(true);
    expect((await row(fx.sessionId)).phase).toBe("ANSWERS_LOCKED");
    // seconda chiamata (due risposte quasi insieme): nessun errore, nessun doppio comando
    expect(await closeAnswersIfAllAnswered(fx.sessionId, sq)).toBe(false);
    // in automatico la soluzione è subito in programma
    const after = await buildPublicState(sql, fx.sessionId);
    expect(after?.auto?.nextAt).toBeTruthy();
  });
});

describe("ElevenLabs appeso: niente blocchi", () => {
  let realKey: string | undefined;
  beforeAll(() => {
    realKey = process.env.ELEVENLABS_API_KEY;
    process.env.ELEVENLABS_API_KEY = "test-chiave-finta";
    const realFetch = globalThis.fetch;
    // ElevenLabs non risponde mai (rispetta solo l'interruzione)
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.startsWith("https://api.elevenlabs.io")) return realFetch(input, init);
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("interrotto"))));
    });
  });
  afterAll(() => {
    process.env.ELEVENLABS_API_KEY = realKey;
    vi.restoreAllMocks();
  });

  it("MOSTRA RISPOSTE, SOLUZIONE e PUNTI finiscono in fretta (nessuna voce sul percorso del comando)", async () => {
    delete process.env.QZ_OPTIONS_READ_DELAY; // la durata della lettura si calcola davvero
    const { fx } = await autoSession();
    await cmd(fx.sessionId, "START_ROUND");
    await cmd(fx.sessionId, "SHOW_QUESTION");
    for (const c of ["SHOW_OPTIONS", "REVEAL", "SCORE"] as const) {
      const t0 = Date.now();
      await cmd(fx.sessionId, c, c === "REVEAL" ? { force: true } : {});
      expect(Date.now() - t0, c).toBeLessThan(3000);
    }
    expect((await row(fx.sessionId)).phase).toBe("SCORE_REVEAL");
  });

  it("una clip rinuncia entro la sua scadenza (poi il TV mostra il sottotitolo)", async () => {
    const role = (r: string) => ({ voiceId: `test-appeso-${r}`, voiceName: null, stability: 0.5, similarity: 0.8, style: 0.3, speed: 1 });
    const cfg: VoiceConfig = {
      monthlyBudgetChars: 10_000_000,
      namesMode: "spliced",
      roles: { professore: role("p"), regina: role("r"), palmino: role("pa"), annunciatore: role("a") },
    };
    const plan = planClip(cfg, { who: "regina", text: `Battuta di prova ${randomUUID()}`, live: true })!;
    const t0 = Date.now();
    const e = await ensureClip(sql, plan, "live", cfg, { deadline: Date.now() + 3000 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(TtsError);
    expect(Date.now() - t0).toBeLessThan(6000);
  });
});

describe("rete di sicurezza: passo in ritardo eseguito da chi legge lo stato", () => {
  it("un passo dovuto da oltre 20 s parte alla prima lettura dello stato", async () => {
    const { fx } = await autoSession();
    await cmd(fx.sessionId, "START_ROUND");
    const before = await row(fx.sessionId);
    // ancora in tempo: nulla
    expect(watchdogTick(await buildPublicState(sql, fx.sessionId))).toBe(false);
    await sql`update game_state set auto_next_at = clock_timestamp() - interval '30 seconds' where session_id = ${fx.sessionId}`;
    expect(watchdogTick(await buildPublicState(sql, fx.sessionId))).toBe(true);
    for (let i = 0; i < 40 && (await row(fx.sessionId)).version === before.version; i++) await new Promise((r) => setTimeout(r, 100));
    expect((await row(fx.sessionId)).version).toBe(before.version + 1);
  });
});
