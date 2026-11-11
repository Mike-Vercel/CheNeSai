import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { autoTick } from "@/lib/server/engine";
import { getAdminLiveState } from "@/lib/server/admin-live";
import { buildPublicState } from "@/lib/server/public-state";
import { updateSessionSettings } from "@/lib/server/cms/sessions";
import { authenticatePlayer, joinSession, submitAnswer, type PlayerAuth } from "@/lib/server/players";
import { AUTO_BREATH_MS, AUTO_INTRO_MS, AUTO_MIN_PHASE_MS, AUTO_TIMER_MARGIN_MS, AUTO_WAIT_REASONS } from "@/lib/game-engine/autoplay";
import type { GameCommand } from "@/lib/game-engine/types";
import { buildPublishedSession, cleanupSession, cmd, TEST_ACTOR, type Fixture } from "../support/fixtures";

// risposte aperte subito dopo MOSTRA RISPOSTE (niente attesa per la lettura)
process.env.QZ_OPTIONS_READ_DELAY = "0";

const sql = getSql();
const created: string[] = [];

interface AutoRow {
  phase: string;
  version: number;
  auto_mode: boolean | null;
  auto_next_at: Date | null;
  auto_command: string | null;
  auto_version: number | null;
  auto_waiting: string | null;
  phase_started_at: Date;
}

async function autoRow(sessionId: string): Promise<AutoRow> {
  const [r] = await sql<AutoRow[]>`
    select phase, version, auto_mode, auto_next_at, auto_command, auto_version, auto_waiting, phase_started_at
    from game_state where session_id = ${sessionId}`;
  return r;
}

/** Porta "adesso" l'orario del passo in programma (come se il presentatore avesse già finito di parlare). */
async function makeDue(sessionId: string) {
  await sql`update game_state set auto_next_at = clock_timestamp() - interval '50 milliseconds' where session_id = ${sessionId} and auto_next_at is not null`;
}

/** Un passo automatico: deve essere in programma, si rende dovuto e lo si esegue con il tick. */
async function step(sessionId: string): Promise<GameCommand> {
  const before = await autoRow(sessionId);
  expect(before.auto_command, `nessun passo in programma in ${before.phase} (${before.auto_waiting ?? ""})`).not.toBeNull();
  await makeDue(sessionId);
  const r = await autoTick(sessionId);
  expect(r.advanced, `passo ${before.auto_command} da ${before.phase}: ${r.waiting ?? ""}`).toBe(true);
  const after = await autoRow(sessionId);
  expect(after.version).toBe(before.version + 1);
  return r.command!;
}

afterAll(async () => {
  for (const id of created) await cleanupSession(id);
  await sql`delete from question_bank where 'test-automatico' = any(tags)`;
  await sql.end();
});

describe("scorrimento automatico (tick lato server)", () => {
  let fx: Fixture;
  const players: Record<string, PlayerAuth> = {};

  beforeAll(async () => {
    fx = await buildPublishedSession({ isTest: true });
    created.push(fx.sessionId);
    // l'impostazione si sceglie anche dopo la pubblicazione (non è una regola di punteggio)
    await updateSessionSettings(fx.sessionId, { advanceMode: "auto" }, TEST_ACTOR);
  });

  it("in lobby aspetta la regia, poi l'intro programma INIZIA ROUND a fine sigla e regole", async () => {
    await cmd(fx.sessionId, "OPEN_LOBBY");
    let r = await autoRow(fx.sessionId);
    expect(r.auto_mode).toBeNull(); // nessuna scelta in diretta: vale l'impostazione della serata
    expect(r.auto_command).toBeNull();
    expect(r.auto_waiting).toBe(AUTO_WAIT_REASONS.lobby);
    // il tick non fa nulla
    expect((await autoTick(fx.sessionId)).advanced).toBe(false);

    for (const n of ["Anna", "Bruno"]) {
      const j = await joinSession({ code: fx.code, nickname: n }, { ip: "10.0.0.3", deviceToken: null });
      players[n.toLowerCase()] = await authenticatePlayer(sql, fx.code, j.participantToken);
    }

    const res = await cmd(fx.sessionId, "START_INTRO");
    r = await autoRow(fx.sessionId);
    expect(r.phase).toBe("INTRO");
    expect(r.auto_command).toBe("START_ROUND");
    expect(r.auto_version).toBe(r.version);
    expect(r.auto_next_at!.getTime() - r.phase_started_at.getTime()).toBeGreaterThanOrEqual(AUTO_INTRO_MS);
    // lo stato pubblico (TV) conosce solo l'orario e la versione
    expect(res.state.auto).toEqual({ nextAt: r.auto_next_at!.toISOString(), version: r.version });
    const pub = await buildPublicState(sql, fx.sessionId);
    expect(pub?.auto?.version).toBe(r.version);

    // non ancora dovuto: il tick non esegue niente
    const t = await autoTick(fx.sessionId);
    expect(t.advanced).toBe(false);
    expect(t.nextAt).toBe(r.auto_next_at!.toISOString());
    expect((await autoRow(fx.sessionId)).version).toBe(r.version);
  });

  it("molti client insieme: il passo dovuto viene eseguito una volta sola", async () => {
    const before = await autoRow(fx.sessionId);
    await makeDue(fx.sessionId);
    const results = await Promise.all(Array.from({ length: 6 }, () => autoTick(fx.sessionId)));
    expect(results.filter((x) => x.advanced)).toHaveLength(1);
    const after = await autoRow(fx.sessionId);
    expect(after.phase).toBe("ROUND_INTRO");
    expect(after.version).toBe(before.version + 1);
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from game_events where session_id = ${fx.sessionId} and command = 'START_ROUND'`;
    expect(n).toBe(1);
    // il passo è registrato come "regia automatica" nel log di regia
    const [audit] = await sql<{ actor_email: string }[]>`
      select actor_email from admin_audit_logs where session_id = ${fx.sessionId} and action = 'live.start_round'`;
    expect(audit.actor_email).toBe("regia automatica");
  });

  it("domanda: aspetta la lettura, il timer intero, poi soluzione e punti", async () => {
    expect(await step(fx.sessionId)).toBe("SHOW_QUESTION");
    let r = await autoRow(fx.sessionId);
    expect(r.auto_command).toBe("SHOW_OPTIONS");
    expect(r.auto_next_at!.getTime() - r.phase_started_at.getTime()).toBeGreaterThanOrEqual(AUTO_MIN_PHASE_MS.QUESTION_VISIBLE! + AUTO_BREATH_MS);

    expect(await step(fx.sessionId)).toBe("SHOW_OPTIONS");
    r = await autoRow(fx.sessionId);
    expect(r.auto_command).toBe("REVEAL");
    const [q] = await sql<{ answers_close_at: Date }[]>`
      select sq.answers_close_at from game_state gs join session_questions sq on sq.id = gs.current_session_question_id
      where gs.session_id = ${fx.sessionId}`;
    // il timer delle risposte scorre per intero
    expect(r.auto_next_at!.getTime()).toBeGreaterThanOrEqual(q.answers_close_at.getTime() + AUTO_TIMER_MARGIN_MS);

    // una risposta durante il timer (comando "laterale" dei bot incluso) non sposta il passo
    await submitAnswer(players.anna, { sessionQuestionId: fx.sessionQuestions.q1, positions: [0], requestId: crypto.randomUUID() }, "10.0.0.3");
    await cmd(fx.sessionId, "SIM_ADD_BOTS", { count: 2 });
    await cmd(fx.sessionId, "SIM_BOTS_ANSWER");
    const r2 = await autoRow(fx.sessionId);
    expect(r2.auto_command).toBe("REVEAL");
    expect(r2.auto_version).toBe(r2.version);
    expect(Math.abs(r2.auto_next_at!.getTime() - r.auto_next_at!.getTime())).toBeLessThan(5);

    expect(await step(fx.sessionId)).toBe("REVEAL");
    expect(await step(fx.sessionId)).toBe("SCORE");
    r = await autoRow(fx.sessionId);
    expect(r.phase).toBe("SCORE_REVEAL");
    // a metà round niente classifica: si passa alla domanda successiva
    expect(r.auto_command).toBe("SHOW_QUESTION");
  });

  it("la regia vince sempre: comando manuale, pausa, ripresa, passaggio a manuale e ritorno", async () => {
    // comando manuale in automatico: il piano riparte dalla nuova fase
    await cmd(fx.sessionId, "SHOW_QUESTION");
    let r = await autoRow(fx.sessionId);
    expect(r.phase).toBe("QUESTION_VISIBLE");
    expect(r.auto_command).toBe("SHOW_OPTIONS");

    // pausa: l'automatico si ferma
    await cmd(fx.sessionId, "PAUSE");
    r = await autoRow(fx.sessionId);
    expect(r.auto_command).toBeNull();
    expect(r.auto_waiting).toBe(AUTO_WAIT_REASONS.paused);
    await sql`update game_state set auto_next_at = clock_timestamp() - interval '1 second' where session_id = ${fx.sessionId}`;
    expect((await autoTick(fx.sessionId)).advanced).toBe(false);
    expect((await autoRow(fx.sessionId)).phase).toBe("PAUSED");

    // ripresa: si riprogramma il passo
    await cmd(fx.sessionId, "RESUME");
    r = await autoRow(fx.sessionId);
    expect(r.phase).toBe("QUESTION_VISIBLE");
    expect(r.auto_command).toBe("SHOW_OPTIONS");

    // manuale: il passo in programma viene annullato e il tick non fa più nulla
    await cmd(fx.sessionId, "SET_AUTOPLAY", { autoplay: false });
    r = await autoRow(fx.sessionId);
    expect(r.auto_mode).toBe(false);
    expect(r.auto_command).toBeNull();
    expect(r.auto_next_at).toBeNull();
    expect((await buildPublicState(sql, fx.sessionId))?.auto).toBeNull();
    expect((await autoTick(fx.sessionId)).advanced).toBe(false);
    expect((await autoRow(fx.sessionId)).phase).toBe("QUESTION_VISIBLE");
    // la regia lavora a mano come sempre
    await cmd(fx.sessionId, "SHOW_OPTIONS");
    r = await autoRow(fx.sessionId);
    expect(r.auto_command).toBeNull();

    // di nuovo automatico a fase in corso: un attimo di respiro, poi riprende da dove siamo
    await cmd(fx.sessionId, "SET_AUTOPLAY", { autoplay: true });
    r = await autoRow(fx.sessionId);
    expect(r.auto_mode).toBe(true);
    expect(r.auto_command).toBe("REVEAL");
    const live = await getAdminLiveState(fx.sessionId);
    expect(live?.autoplay).toMatchObject({ enabled: true, sessionMode: "auto", overridden: true, command: "REVEAL", waiting: null });
  });

  it("va da sola fino al podio con la stessa sequenza della regia", async () => {
    const seq: GameCommand[] = [];
    for (let i = 0; i < 60; i++) {
      const r = await autoRow(fx.sessionId);
      if (r.phase === "FINISHED") break;
      seq.push(await step(fx.sessionId));
    }
    expect(seq).toEqual([
      // fine della domanda 2 del primo round
      "REVEAL",
      "SCORE",
      // domanda 3 (ultima del round) e classifica di fine round
      "SHOW_QUESTION",
      "SHOW_OPTIONS",
      "REVEAL",
      "SCORE",
      "SHOW_LEADERBOARD",
      // round con votazione della categoria
      "START_ROUND",
      "START_VOTE",
      "CLOSE_VOTE",
      "SHOW_QUESTION",
      "SHOW_OPTIONS",
      "REVEAL",
      "SCORE",
      "SHOW_LEADERBOARD",
      // finale
      "START_ROUND",
      "SHOW_QUESTION",
      "SHOW_OPTIONS",
      "REVEAL",
      "SCORE",
      "SHOW_LEADERBOARD",
      "FINISH",
    ]);
    const r = await autoRow(fx.sessionId);
    expect(r.phase).toBe("FINISHED");
    expect(r.auto_command).toBeNull();
    expect((await autoTick(fx.sessionId)).advanced).toBe(false);
  });
});

describe("scorrimento automatico: decisioni della regia", () => {
  let fx: Fixture;

  beforeAll(async () => {
    fx = await buildPublishedSession({ isTest: false });
    created.push(fx.sessionId);
    // parità nella votazione: decide la regia
    await sql`update game_rounds set vote_tie_break = 'admin' where id = ${fx.rounds.voteId}`;
  });

  it("serata manuale: nessun passo in programma", async () => {
    await cmd(fx.sessionId, "OPEN_LOBBY");
    await cmd(fx.sessionId, "START_ROUND");
    const r = await autoRow(fx.sessionId);
    expect(r.auto_command).toBeNull();
    expect(r.auto_waiting).toBeNull();
    expect((await buildPublicState(sql, fx.sessionId))?.auto).toBeNull();
    expect((await autoTick(fx.sessionId)).advanced).toBe(false);
  });

  it("in una serata vera la soluzione non arriva prima della fine del timer", async () => {
    await cmd(fx.sessionId, "SET_AUTOPLAY", { autoplay: true });
    expect(await step(fx.sessionId)).toBe("SHOW_QUESTION");
    expect(await step(fx.sessionId)).toBe("SHOW_OPTIONS");
    // forzare l'orario prima della scadenza non basta: il motore rifiuta e l'automatico si ferma con un messaggio
    await makeDue(fx.sessionId);
    const t = await autoTick(fx.sessionId);
    expect(t.advanced).toBe(false);
    expect(t.waiting).toMatch(/RIVELA SOLUZIONE non riuscito/);
    const r = await autoRow(fx.sessionId);
    expect(r.phase).toBe("OPTIONS_VISIBLE");
    expect(r.auto_waiting).toMatch(/non riuscito/);
    // la regia chiude a mano: il piano riparte
    await cmd(fx.sessionId, "CLOSE_ANSWERS");
    const r2 = await autoRow(fx.sessionId);
    expect(r2.auto_command).toBe("REVEAL");
    expect(r2.auto_waiting).toBeNull();
  });

  it("parità nella votazione con 'Decide la regia': si ferma e aspetta la scelta", async () => {
    // si salta al round con la votazione
    await cmd(fx.sessionId, "REVEAL");
    await cmd(fx.sessionId, "SCORE");
    await cmd(fx.sessionId, "START_ROUND", { roundId: fx.rounds.voteId });
    expect(await step(fx.sessionId)).toBe("START_VOTE");
    // nessun voto: tutte le categorie a pari merito
    await makeDue(fx.sessionId);
    const t = await autoTick(fx.sessionId);
    expect(t.advanced).toBe(false);
    expect(t.waiting).toMatch(/parità nella votazione/);
    const live = await getAdminLiveState(fx.sessionId);
    expect(live?.autoplay.waiting).toMatch(/parità/);
    expect(live?.autoplay.command).toBeNull();
    // la regia sceglie: l'automatico riparte
    await cmd(fx.sessionId, "CLOSE_VOTE", { adminChoice: fx.voteOptions[1].id });
    const r = await autoRow(fx.sessionId);
    expect(r.phase).toBe("CATEGORY_RESULT");
    expect(r.auto_command).toBe("SHOW_QUESTION");
    expect(r.auto_waiting).toBeNull();
  });
});
