import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { buildPublicState } from "@/lib/server/public-state";
import { authenticatePlayer, joinSession, PlayerError, submitAnswer, type PlayerAuth } from "@/lib/server/players";
import { loadRoundStandingRows } from "@/lib/server/round-standings";
import { skipIntroIfUnanimous, voteIntroSkip } from "@/lib/server/intro-skip";
import { setDisplayMode } from "@/lib/server/display-mode";
import { authorizePlayerLine, PLAYER_TTS_RATE } from "@/lib/server/player-voice";
import { FIXED_POOLS, speechFor } from "@/features/game/script";
import { buildPublishedSession, cleanupSession, cmd, type Fixture } from "../support/fixtures";

process.env.QZ_OPTIONS_READ_DELAY = "0";

const sql = getSql();
const created: string[] = [];

afterAll(async () => {
  for (const id of created) await cleanupSession(id);
  await sql`delete from question_bank where 'test-automatico' = any(tags)`;
  await sql.end();
});

async function join(fx: Fixture, nickname: string, ip = "10.0.9.1"): Promise<PlayerAuth> {
  const j = await joinSession({ code: fx.code, nickname }, { ip, deviceToken: null });
  return authenticatePlayer(sql, fx.code, j.participantToken);
}

async function answer(fx: Fixture, p: PlayerAuth, sq: string, positions: number[]) {
  await submitAnswer(p, { sessionQuestionId: sq, positions, requestId: crypto.randomUUID() }, "10.0.9.1");
}

async function phase(sessionId: string): Promise<string> {
  const [r] = await sql<{ phase: string }[]>`select phase::text as phase from game_state where session_id = ${sessionId}`;
  return r.phase;
}

describe("classifica del round (punti fatti nel round)", () => {
  let fx: Fixture;
  let anna: PlayerAuth;
  let bruno: PlayerAuth;

  beforeAll(async () => {
    fx = await buildPublishedSession();
    created.push(fx.sessionId);
    await cmd(fx.sessionId, "OPEN_LOBBY");
    anna = await join(fx, "Anna");
    bruno = await join(fx, "Bruno");
    await cmd(fx.sessionId, "START_ROUND");
  });

  async function play(sq: string, a: number[], b: number[]) {
    await cmd(fx.sessionId, "SHOW_QUESTION");
    await cmd(fx.sessionId, "SHOW_OPTIONS");
    await answer(fx, anna, sq, a);
    await answer(fx, bruno, sq, b);
    // tutti hanno risposto: le risposte si chiudono da sole
    if ((await phase(fx.sessionId)) === "OPTIONS_VISIBLE") await cmd(fx.sessionId, "CLOSE_ANSWERS");
    await cmd(fx.sessionId, "REVEAL");
    return cmd(fx.sessionId, "SCORE");
  }

  it("a metà round niente classifica del round; all'ultima domanda sì, con i punti del round e il totale", async () => {
    const r1 = await play(fx.sessionQuestions.q1, [1], [0]);
    expect(r1.state.roundLeaderboard ?? null).toBeNull();
    await play(fx.sessionQuestions.q2, [0, 2], [0, 2]);
    const r3 = await play(fx.sessionQuestions.q3, [0], [1]);
    const rl = r3.state.roundLeaderboard!;
    expect(rl).not.toBeNull();
    const rows = await loadRoundStandingRows(sql, fx.sessionId, fx.rounds.standardId);
    const sums = await sql<{ participant_id: string; s: number }[]>`
      select se.participant_id, sum(se.delta)::int as s from score_events se join session_questions sq on sq.id = se.session_question_id
      where sq.round_id = ${fx.rounds.standardId} group by se.participant_id`;
    for (const s of sums) expect(rows.find((r) => r.participantId === s.participant_id)?.points).toBe(s.s);
    // primo round: punti del round = totale
    for (const e of rl) expect(e.points).toBe(e.total);
    expect(rl[0].nickname).toBe("Bruno");
    // la voce annuncia il vincitore del ROUND
    const lines = speechFor(r3.state, { phase: "ANSWER_REVEAL" }, { readOptions: true });
    expect(lines.map((l) => l.text).join(" ")).toMatch(/Bruno/);
  });

  it("nella classifica generale i punti del round restano quelli del round (le rettifiche manuali no)", async () => {
    const lbState = (await cmd(fx.sessionId, "SHOW_LEADERBOARD")).state;
    expect(lbState.phase).toBe("LEADERBOARD");
    const before = new Map(lbState.roundLeaderboard!.map((r) => [r.participantId, r.points]));
    await cmd(fx.sessionId, "ADJUST_SCORE", { participantId: anna.participantId, delta: 500, reason: "test" });
    const after = (await buildPublicState(sql, fx.sessionId))!;
    const annaRound = after.roundLeaderboard!.find((r) => r.participantId === anna.participantId)!;
    expect(annaRound.points).toBe(before.get(anna.participantId));
    expect(annaRound.total).toBe(after.leaderboard!.find((e) => e.participantId === anna.participantId)!.points);
  });
});

describe("salta intro a votazione", () => {
  let fx: Fixture;
  let a: PlayerAuth;
  let b: PlayerAuth;

  beforeAll(async () => {
    fx = await buildPublishedSession();
    created.push(fx.sessionId);
    await cmd(fx.sessionId, "OPEN_LOBBY");
    a = await join(fx, "Anna", "10.0.9.2");
    b = await join(fx, "Bruno", "10.0.9.2");
  });

  it("fuori dall'intro non si vota", async () => {
    await expect(voteIntroSkip(a, true)).rejects.toMatchObject({ code: "NOT_OPEN" });
  });

  it("voto, ritiro, ritardatario: si salta solo quando votano tutti (una volta sola)", async () => {
    await cmd(fx.sessionId, "START_INTRO");
    let r = await voteIntroSkip(a, true);
    expect(r).toMatchObject({ skipped: false, skip: { votes: 1, needed: 2, names: ["Anna"] } });
    expect((await buildPublicState(sql, fx.sessionId))!.introSkip).toMatchObject({ votes: 1, needed: 2 });
    r = await voteIntroSkip(a, false);
    expect(r.skip.votes).toBe(0);
    r = await voteIntroSkip(a, true);
    // ritardatario: entra a intro in corso e si aggiunge al conteggio
    const c = await join(fx, "Carla", "10.0.9.2");
    r = await voteIntroSkip(b, true);
    expect(r).toMatchObject({ skipped: false, skip: { votes: 2, needed: 3 } });
    expect(await phase(fx.sessionId)).toBe("INTRO");
    // l'ultimo voto fa partire il primo round
    r = await voteIntroSkip(c, true);
    expect(r.skipped).toBe(true);
    const st = (await buildPublicState(sql, fx.sessionId))!;
    expect(st.phase).toBe("ROUND_INTRO");
    expect(st.introSkipped).toBe(true);
    expect(st.introSkip ?? null).toBeNull();
    // idempotente: rifarlo non fa nulla
    expect(await skipIntroIfUnanimous(fx.sessionId)).toBe(false);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from game_events where session_id = ${fx.sessionId} and command = 'START_ROUND'`;
    expect(n).toBe(1);
    // la battuta del salto apre il primo round
    expect(FIXED_POOLS.introSkipped.texts).toContain(speechFor(st, { phase: "INTRO" }, { readOptions: true })[0].text);
  });

  it("voti contemporanei: un solo START_ROUND, anche in automatico", async () => {
    const fx2 = await buildPublishedSession();
    created.push(fx2.sessionId);
    await cmd(fx2.sessionId, "OPEN_LOBBY");
    const p = await Promise.all(["Uno", "Due", "Tre"].map((n) => join(fx2, n, "10.0.9.3")));
    await cmd(fx2.sessionId, "SET_AUTOPLAY", { autoplay: true });
    await cmd(fx2.sessionId, "START_INTRO");
    await voteIntroSkip(p[0], true);
    const rs = await Promise.all([voteIntroSkip(p[1], true), voteIntroSkip(p[2], true)]);
    expect(rs.filter((r) => r.skipped).length).toBeLessThanOrEqual(1);
    // se entrambi i voti hanno perso la corsa al lucchetto, un nuovo controllo lo fa partire
    await skipIntroIfUnanimous(fx2.sessionId);
    expect(await phase(fx2.sessionId)).toBe("ROUND_INTRO");
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from game_events where session_id = ${fx2.sessionId} and command = 'START_ROUND'`;
    expect(n).toBe(1);
    // in automatico il prossimo passo è già in programma dal nuovo stato
    const st = (await buildPublicState(sql, fx2.sessionId))!;
    expect(st.auto).not.toBeNull();
  });
});

describe("show sul telefono: modalità e voci per i giocatori", () => {
  let fx: Fixture;
  let anna: PlayerAuth;

  beforeAll(async () => {
    fx = await buildPublishedSession();
    created.push(fx.sessionId);
    await cmd(fx.sessionId, "OPEN_LOBBY");
    anna = await join(fx, "Anna", "10.0.9.4");
  });

  it("la modalità si cambia e arriva nello stato pubblico", async () => {
    expect((await buildPublicState(sql, fx.sessionId))!.displayMode).toBe("tv");
    expect(await setDisplayMode(fx.sessionId, "phone")).toBe(true);
    expect(await setDisplayMode(fx.sessionId, "phone")).toBe(false); // già così: nessuna scrittura
    expect((await buildPublicState(sql, fx.sessionId))!.displayMode).toBe("phone");
    await setDisplayMode(fx.sessionId, "tv");
    expect((await buildPublicState(sql, fx.sessionId))!.displayMode).toBe("tv");
  });

  it("voci ai telefoni: mai in modalità TV, mai testi arbitrari, solo le battute di adesso", async () => {
    await cmd(fx.sessionId, "START_ROUND");
    await cmd(fx.sessionId, "SHOW_QUESTION");
    const st = (await buildPublicState(sql, fx.sessionId))!;
    const line = speechFor(st, { phase: "ROUND_INTRO" }, { readOptions: true }).find((l) => !l.beforeCard)!;
    await expect(authorizePlayerLine(sql, anna, line.who, line.text)).rejects.toMatchObject({ code: "TV_MODE" });
    await setDisplayMode(fx.sessionId, "phone");
    await expect(authorizePlayerLine(sql, anna, line.who, line.text)).resolves.toMatchObject({ who: line.who, text: line.text });
    await expect(authorizePlayerLine(sql, anna, "professore", "Dimmi quello che voglio io")).rejects.toMatchObject({ code: "NOT_A_LINE" });
    // la soluzione non si può chiedere prima del tempo
    await expect(authorizePlayerLine(sql, anna, line.who, "[excited] La risposta giusta è… A, Tirana!")).rejects.toBeInstanceOf(PlayerError);
  });

  it("limite di richieste per telefono", async () => {
    const st = (await buildPublicState(sql, fx.sessionId))!;
    const line = speechFor(st, { phase: "ROUND_INTRO" }, { readOptions: true })[0];
    let limited = false;
    for (let i = 0; i < PLAYER_TTS_RATE.limit + 5; i++) {
      try {
        await authorizePlayerLine(sql, anna, line.who, line.text);
      } catch (e) {
        if (e instanceof PlayerError && e.code === "RATE_LIMITED") {
          limited = true;
          break;
        }
        throw e;
      }
    }
    expect(limited).toBe(true);
  }, 120_000);
});
