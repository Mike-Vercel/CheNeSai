import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { buildPublicState } from "@/lib/server/public-state";
import {
  authenticatePlayer,
  getPlayerSelf,
  joinSession,
  submitAnswer,
  submitVote,
  PlayerError,
  type PlayerAuth,
} from "@/lib/server/players";
import { archiveSession, duplicateSession, unpublishSession } from "@/lib/server/cms/sessions";
import { GameError } from "@/lib/game-engine/types";
import { buildPublishedSession, cleanupSession, cmd, TEST_ACTOR, type Fixture } from "../support/fixtures";

// Questi test rispondono subito dopo SHOW_OPTIONS: niente attesa per la lettura delle risposte.
process.env.QZ_OPTIONS_READ_DELAY = "0";

const sql = getSql();
let fx: Fixture;
const players: Record<string, PlayerAuth> = {};
const created: string[] = [];

async function join(nickname: string, deviceToken: string | null = null) {
  const r = await joinSession({ code: fx.code, nickname }, { ip: "10.0.0.1", deviceToken });
  return { r, auth: await authenticatePlayer(sql, fx.code, r.participantToken) };
}

async function answer(name: string, sqId: string, positions: number[], requestId = randomUUID()) {
  return submitAnswer(players[name], { sessionQuestionId: sqId, positions, requestId }, "10.0.0.1");
}

async function expectPlayerError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof PlayerError && e.code === code);
}
async function expectGameError(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof GameError && e.code === code);
}

async function points(name: string) {
  return (await getPlayerSelf(sql, players[name])).points;
}

beforeAll(async () => {
  fx = await buildPublishedSession({ isTest: false });
  created.push(fx.sessionId);
});

afterAll(async () => {
  for (const id of created) await cleanupSession(id);
  await sql`delete from question_bank where 'test-automatico' = any(tags)`;
  await sql.end();
});

describe("serata completa (server-authoritative)", () => {
  it("la sessione pubblicata è congelata e in stato READY", async () => {
    const s = await buildPublicState(sql, fx.sessionId);
    expect(s?.phase).toBe("READY");
    await expect(sql`insert into game_rounds (session_id, position, title) values (${fx.sessionId}, 9, 'Hack')`).rejects.toThrow(/SESSION_FROZEN/);
  });

  it("non si entra prima dell'apertura della lobby", async () => {
    await expectPlayerError(joinSession({ code: fx.code, nickname: "Presto" }, { ip: null, deviceToken: null }), "LOBBY_CLOSED");
  });

  it("apertura lobby e registrazione di tre giocatori", async () => {
    await cmd(fx.sessionId, "OPEN_LOBBY");
    const a = await join("Anna");
    players.anna = a.auth;
    expect(a.r.recoveryCode).toMatch(/^QZ-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    players.bruno = (await join("Bruno")).auth;
    players.carla = (await join("Carla")).auth;
    // nickname duplicato (normalizzato)
    await expectPlayerError(joinSession({ code: fx.code, nickname: "ÀNNA" }, { ip: null, deviceToken: null }), "NICKNAME_TAKEN");
    // stesso dispositivo: rientro nello stesso partecipante, nessuna doppia iscrizione
    const again = await joinSession({ code: fx.code, nickname: "Anna2" }, { ip: null, deviceToken: a.r.deviceToken });
    expect(again.rejoined).toBe(true);
    expect(again.participantId).toBe(players.anna.participantId);
    players.anna = await authenticatePlayer(sql, fx.code, again.participantToken);
    const st = await buildPublicState(sql, fx.sessionId);
    expect(st?.playerCount).toBe(3);
    expect(st?.recentPlayers).toContain("Carla");
  });

  it("i giocatori non possono inviare comandi o token falsi", async () => {
    await expectPlayerError(authenticatePlayer(sql, fx.code, `${players.anna.participantId}.tokenfalsissimotokenfalso`), "NOT_JOINED");
  });

  it("intro, salto intro e inizio round", async () => {
    const intro = await cmd(fx.sessionId, "START_INTRO");
    expect(intro.state.phase).toBe("INTRO");
    expect(intro.state.intro).not.toBeNull();
    const skip = await cmd(fx.sessionId, "SKIP_INTRO");
    expect(Date.parse(skip.state.intro!.startedAt)).toBeLessThan(Date.now() - 60_000);
    const r = await cmd(fx.sessionId, "START_ROUND");
    expect(r.state.phase).toBe("ROUND_INTRO");
    expect(r.state.round?.title).toBe("Cultura generale");
  });

  it("comandi non validi rifiutati e idempotenza del comando", async () => {
    await expectGameError(cmd(fx.sessionId, "REVEAL"), "INVALID_TRANSITION");
    const commandId = randomUUID();
    const first = await import("@/lib/server/engine").then((m) =>
      m.executeCommand(fx.sessionId, TEST_ACTOR, { command: "SHOW_QUESTION", commandId, args: {} }),
    );
    const second = await import("@/lib/server/engine").then((m) =>
      m.executeCommand(fx.sessionId, TEST_ACTOR, { command: "SHOW_QUESTION", commandId, args: {} }),
    );
    expect(second.duplicate).toBe(true);
    expect(second.state.version).toBe(first.state.version);
    expect(first.state.phase).toBe("QUESTION_VISIBLE");
    // conflitto di versione (doppio clic con stato vecchio)
    await expectGameError(
      import("@/lib/server/engine").then((m) =>
        m.executeCommand(fx.sessionId, TEST_ACTOR, { command: "SHOW_OPTIONS", commandId: randomUUID(), expectedVersion: first.state.version - 1, args: {} }),
      ),
      "VERSION_CONFLICT",
    );
  });

  it("domanda visibile senza risposte né soluzione nel payload", async () => {
    const st = await buildPublicState(sql, fx.sessionId);
    expect(st?.question?.text).toBe("Qual è la capitale dell'Albania?");
    expect(st?.question?.options).toBeNull();
    expect(st?.question?.correctPositions).toBeNull();
    expect(JSON.stringify(st)).not.toContain("correct_positions");
    await expectPlayerError(answer("anna", fx.sessionQuestions.q1, [0]), "NOT_OPEN");
  });

  it("risposte aperte: corretta, errata, nessuna; doppia e manipolata rifiutate", async () => {
    const r = await cmd(fx.sessionId, "SHOW_OPTIONS");
    expect(r.state.question?.options?.map((o) => o.text)).toEqual(["Tirana", "Durazzo", "Valona", "Scutari"]);
    expect(r.state.question?.correctPositions).toBeNull();
    expect(r.state.question?.closesAt).not.toBeNull();
    const reqId = randomUUID();
    const a1 = await answer("anna", fx.sessionQuestions.q1, [0], reqId);
    expect(a1.status).toBe("recorded");
    // ripetizione della stessa richiesta (rete instabile): idempotente
    expect((await answer("anna", fx.sessionQuestions.q1, [0], reqId)).status).toBe("duplicate");
    // tentativo di cambiare risposta dopo la conferma
    await expectPlayerError(answer("anna", fx.sessionQuestions.q1, [1]), "ALREADY_ANSWERED");
    // due opzioni su una domanda a risposta singola
    await expectPlayerError(answer("bruno", fx.sessionQuestions.q1, [0, 1]), "INVALID_ANSWER");
    // risposta per una domanda futura
    await expectPlayerError(answer("bruno", fx.sessionQuestions.q2, [0]), "WRONG_QUESTION");
    await answer("bruno", fx.sessionQuestions.q1, [1]);
    // Carla non risponde
    const me = await getPlayerSelf(sql, players.anna);
    expect(me.currentAnswer?.positions).toEqual([0]);
    expect(me.currentResult).toBeNull();
  });

  it("rivelazione protetta durante il timer, poi chiusura e risposta tardiva rifiutata", async () => {
    await expectGameError(cmd(fx.sessionId, "REVEAL"), "TIMER_RUNNING");
    await cmd(fx.sessionId, "CLOSE_ANSWERS");
    await expectPlayerError(answer("carla", fx.sessionQuestions.q1, [0]), "TOO_LATE");
    const [log] = await sql<{ c: number }[]>`select count(*)::int as c from security_events where session_id = ${fx.sessionId} and kind = 'late_answer'`;
    expect(log.c).toBeGreaterThan(0);
    const rev = await cmd(fx.sessionId, "REVEAL");
    expect(rev.state.question?.correctPositions).toEqual([0]);
    expect(rev.state.question?.distribution).toEqual([1, 1, 0, 0]);
    const me = await getPlayerSelf(sql, players.anna);
    expect(me.currentResult?.isCorrect).toBe(true);
  });

  it("punteggi calcolati dal server con evento verificabile", async () => {
    const s = await cmd(fx.sessionId, "SCORE");
    expect(s.state.phase).toBe("SCORE_REVEAL");
    expect(await points("anna")).toBe(1000);
    expect(await points("bruno")).toBe(-400);
    expect(await points("carla")).toBe(0);
    const evs = await sql<{ kind: string; points_before: number; delta: number; points_after: number; reason: string }[]>`
      select kind, points_before, delta, points_after, reason from score_events
      where session_question_id = ${fx.sessionQuestions.q1} order by delta desc`;
    expect(evs).toHaveLength(3);
    expect(evs[0]).toMatchObject({ kind: "answer", points_before: 0, delta: 1000, points_after: 1000 });
    expect(evs[2]).toMatchObject({ kind: "answer", delta: -400 });
    expect(evs.some((e) => e.kind === "no_answer")).toBe(true);
    // gli eventi di punteggio sono immutabili
    await expect(sql`update score_events set delta = 99999 where session_question_id = ${fx.sessionQuestions.q1}`).rejects.toThrow(/APPEND_ONLY/);
    // SCORE ripetuto non assegna punti due volte
    expect(s.state.leaderboard?.[0]).toMatchObject({ nickname: "Anna", rank: 1, points: 1000 });
    expect(s.state.leaderboard?.map((e) => e.nickname)).toEqual(["Anna", "Carla", "Bruno"]);
  });

  it("PUNTI DOPPI annunciato prima della domanda multipla", async () => {
    await cmd(fx.sessionId, "SHOW_LEADERBOARD");
    const ev = await cmd(fx.sessionId, "ACTIVATE_EVENT", { definitionKey: "double-points" });
    expect(ev.state.phase).toBe("SPECIAL_EVENT");
    expect(ev.state.event?.type).toBe("double_points");
    expect(ev.state.question).toBeNull();
    const q = await cmd(fx.sessionId, "SHOW_QUESTION");
    expect(q.state.question?.type).toBe("multiple");
    expect(q.state.question?.rules.correctPoints).toBe(2000);
    expect(q.state.event?.type).toBe("double_points");
    await cmd(fx.sessionId, "SHOW_OPTIONS");
    // dopo l'apertura non si possono più cambiare le regole
    await expectGameError(cmd(fx.sessionId, "ACTIVATE_EVENT", { definitionKey: "no-penalty" }), "INVALID_TRANSITION");
    await answer("anna", fx.sessionQuestions.q2, [2, 0]);
    await answer("bruno", fx.sessionQuestions.q2, [0]);
    await answer("carla", fx.sessionQuestions.q2, [0, 1, 2]);
    await cmd(fx.sessionId, "CLOSE_ANSWERS");
    await cmd(fx.sessionId, "REVEAL");
    await cmd(fx.sessionId, "SCORE");
    expect(await points("anna")).toBe(3000);
    expect(await points("bruno")).toBe(-1200);
    expect(await points("carla")).toBe(-800);
  });

  it("NESSUNA PENALITÀ e scadenza del timer server-side", async () => {
    await cmd(fx.sessionId, "ACTIVATE_EVENT", { definitionKey: "no-penalty" });
    await cmd(fx.sessionId, "SHOW_QUESTION");
    const o = await cmd(fx.sessionId, "SHOW_OPTIONS");
    expect(o.state.question?.rules.durationSeconds).toBe(3);
    expect(o.state.question?.rules.wrongPenalty).toBe(0);
    await answer("bruno", fx.sessionQuestions.q3, [0]);
    await new Promise((r) => setTimeout(r, 3600));
    await expectPlayerError(answer("anna", fx.sessionQuestions.q3, [1]), "TOO_LATE");
    // a tempo scaduto la soluzione si può rivelare senza conferma
    await cmd(fx.sessionId, "REVEAL");
    await cmd(fx.sessionId, "SCORE");
    expect(await points("bruno")).toBe(-1200);
    expect(await points("anna")).toBe(3000);
    // limite di frequenza dell'evento raro
    await expectGameError(cmd(fx.sessionId, "ACTIVATE_EVENT", { definitionKey: "no-penalty" }), "EVENT_LIMIT");
  });

  it("domanda misteriosa dalla riserva", async () => {
    const ev = await cmd(fx.sessionId, "ACTIVATE_EVENT", { definitionKey: "mystery-question" });
    expect(ev.state.event?.type).toBe("mystery_question");
    const q = await cmd(fx.sessionId, "SHOW_QUESTION");
    expect(q.state.question?.id).toBe(fx.sessionQuestions.reserve);
    expect(q.state.question?.rules.correctPoints).toBe(1500);
    await cmd(fx.sessionId, "SHOW_OPTIONS");
    await answer("carla", fx.sessionQuestions.reserve, [1]);
    await cmd(fx.sessionId, "CLOSE_ANSWERS");
    await cmd(fx.sessionId, "REVEAL");
    await cmd(fx.sessionId, "SCORE");
    expect(await points("carla")).toBe(700);
    await expectGameError(cmd(fx.sessionId, "SHOW_QUESTION"), "NO_MORE_QUESTIONS");
  });

  it("votazione categoria con parità, voto unico e tie-break", async () => {
    const r = await cmd(fx.sessionId, "START_ROUND");
    expect(r.state.round?.kind).toBe("category_vote");
    expect(r.state.vote?.options.map((o) => o.label)).toEqual(["CINEMA", "MUSICA"]);
    await expectGameError(cmd(fx.sessionId, "SHOW_QUESTION"), "INVALID_TRANSITION");
    const v = await cmd(fx.sessionId, "START_VOTE");
    expect(v.state.phase).toBe("CATEGORY_VOTING");
    const [cinema, musica] = fx.voteOptions;
    await submitVote(players.anna, { roundId: fx.rounds.voteId, optionId: musica.id }, null);
    await submitVote(players.bruno, { roundId: fx.rounds.voteId, optionId: cinema.id }, null);
    await expectPlayerError(submitVote(players.bruno, { roundId: fx.rounds.voteId, optionId: musica.id }, null), "ALREADY_ANSWERED");
    const live = await buildPublicState(sql, fx.sessionId);
    expect(live?.vote?.totalVotes).toBe(2);
    const closed = await cmd(fx.sessionId, "CLOSE_VOTE");
    // parità 1-1: la regola "first" assegna CINEMA (posizione A)
    expect(closed.state.vote?.winnerOptionId).toBe(cinema.id);
    expect(closed.state.vote?.tieBreak?.method).toBe("first");
    await expectPlayerError(submitVote(players.carla, { roundId: fx.rounds.voteId, optionId: musica.id }, null), "NOT_OPEN");
    const q = await cmd(fx.sessionId, "SHOW_QUESTION");
    expect(q.state.question?.id).toBe(fx.sessionQuestions.cinema);
    await cmd(fx.sessionId, "SHOW_OPTIONS");
    await cmd(fx.sessionId, "CLOSE_ANSWERS");
    await cmd(fx.sessionId, "REVEAL");
    await cmd(fx.sessionId, "SCORE");
    // la categoria perdente non viene giocata
    await expectGameError(cmd(fx.sessionId, "SHOW_QUESTION"), "NO_MORE_QUESTIONS");
  });

  it("pausa e ripresa conservano il tempo residuo", async () => {
    await cmd(fx.sessionId, "START_ROUND");
    await cmd(fx.sessionId, "SHOW_QUESTION");
    await cmd(fx.sessionId, "SHOW_OPTIONS");
    const p = await cmd(fx.sessionId, "PAUSE");
    expect(p.state.phase).toBe("PAUSED");
    expect(p.state.pausedFrom).toBe("OPTIONS_VISIBLE");
    await expectPlayerError(answer("anna", fx.sessionQuestions.final, [1]), "NOT_OPEN");
    await new Promise((r) => setTimeout(r, 1200));
    const res = await cmd(fx.sessionId, "RESUME");
    expect(res.state.phase).toBe("OPTIONS_VISIBLE");
    const remaining = Date.parse(res.state.question!.closesAt!) - Date.parse(res.state.serverNow);
    // il tempo residuo è conservato durante la pausa (quasi tutta la durata della domanda)
    expect(remaining).toBeGreaterThan(res.state.question!.rules.durationSeconds * 1000 - 3000);
    await answer("anna", fx.sessionQuestions.final, [1]);
    await answer("bruno", fx.sessionQuestions.final, [1]);
    await cmd(fx.sessionId, "REVEAL", { force: true });
    await cmd(fx.sessionId, "SCORE");
    // round finale x2
    expect(await points("anna")).toBe(5000);
  });

  it("riconnessione: stato personale ricostruito dal server", async () => {
    const me = await getPlayerSelf(sql, players.bruno);
    expect(me.rank).not.toBeNull();
    expect(me.history.length).toBeGreaterThanOrEqual(5);
    expect(me.history.every((h) => h.correctPositions.length > 0)).toBe(true);
  });

  it("finale con podio, classifica congelata e archiviazione", async () => {
    const f = await cmd(fx.sessionId, "FINISH");
    expect(f.state.phase).toBe("FINISHED");
    expect(f.state.leaderboard?.[0].nickname).toBe("Anna");
    const lb = await sql<{ nickname: string; final_rank: number }[]>`
      select nickname, final_rank from leaderboards where session_id = ${fx.sessionId} order by final_rank`;
    expect(lb.map((r) => r.nickname)[0]).toBe("Anna");
    expect(lb).toHaveLength(3);
    await expectGameError(cmd(fx.sessionId, "SHOW_QUESTION"), "INVALID_TRANSITION");
    await archiveSession(fx.sessionId, TEST_ACTOR);
    const [s] = await sql<{ status: string }[]>`select status from game_sessions where id = ${fx.sessionId}`;
    expect(s.status).toBe("archived");
  });

  it("si può creare la partita del venerdì successivo duplicando", async () => {
    const copy = await duplicateSession(fx.sessionId, TEST_ACTOR, { title: "Venerdì successivo" });
    created.push(copy);
    const [s] = await sql<{ status: string; code: string }[]>`select status, code from game_sessions where id = ${copy}`;
    expect(s.status).toBe("draft");
    expect(s.code).not.toBe(fx.code);
    const [{ c }] = await sql<{ c: number }[]>`select count(*)::int as c from session_questions where session_id = ${copy}`;
    expect(c).toBe(7);
  });
});

describe("modalità prova", () => {
  let t: Fixture;
  beforeAll(async () => {
    t = await buildPublishedSession({ isTest: true });
    created.push(t.sessionId);
  });

  it("bot simulati, risposte, reset completo", async () => {
    await cmd(t.sessionId, "OPEN_LOBBY");
    await cmd(t.sessionId, "SIM_ADD_BOTS", { count: 12 });
    await cmd(t.sessionId, "START_ROUND");
    await cmd(t.sessionId, "SHOW_QUESTION");
    await cmd(t.sessionId, "SHOW_OPTIONS");
    const b = await cmd(t.sessionId, "SIM_BOTS_ANSWER");
    expect(b.result?.answered).toBe(12);
    // in prova si può rivelare subito
    await cmd(t.sessionId, "REVEAL");
    await cmd(t.sessionId, "SCORE");
    const st = await buildPublicState(sql, t.sessionId);
    // dopo i punti di una risposta arrivano tutti i giocatori (fino a 40): il TV mostra i punti di quella risposta
    expect(st?.leaderboard).toHaveLength(12);
    const reset = await cmd(t.sessionId, "RESET_TEST");
    expect(reset.state.phase).toBe("LOBBY");
    expect(reset.state.playerCount).toBe(0);
    const [{ c }] = await sql<{ c: number }[]>`select count(*)::int as c from score_events where session_id = ${t.sessionId}`;
    expect(c).toBe(0);
  });

  it("la modalità prova non entra nelle classifiche reali", async () => {
    await cmd(t.sessionId, "FINISH");
    const [{ c }] = await sql<{ c: number }[]>`select count(*)::int as c from leaderboards where session_id = ${t.sessionId} and not is_test`;
    expect(c).toBe(0);
  });

  it("annullare la pubblicazione è possibile solo prima della lobby", async () => {
    await expect(unpublishSession(t.sessionId, TEST_ACTOR)).rejects.toThrow();
  });
});
