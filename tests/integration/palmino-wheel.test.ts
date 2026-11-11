import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { composeAndCreateSession } from "@/lib/server/cms/compose";
import { addQuestionsToRound, createRound, createSession, duplicateSession, getSessionDetail, publishSession, unpublishSession } from "@/lib/server/cms/sessions";
import { autoCommandId, executeCommand } from "@/lib/server/engine";
import { buildPublicState } from "@/lib/server/public-state";
import { getAdminLiveState } from "@/lib/server/admin-live";
import { GameError } from "@/lib/game-engine/types";
import type { StoredPalminoWheel } from "@/lib/game-engine/palmino-wheel";
import { sessionLines } from "@/lib/server/tts-pregen";
import { palminoWheelResultLine } from "@/features/game/script";
import { cleanupSession, cmd, makeQuestion, TEST_ACTOR } from "../support/fixtures";

/**
 * Ruota di Palmino contro il database locale: archivio isolato (tag univoco), un account host vero
 * (Supabase Auth locale) per lo storico per account, una partita libera reale (non di prova: il
 * trigger registra le domande giocate) e una serata di prova della regia (azzeramento).
 */
const sql = getSql();
const TAG = `ruota-${randomUUID().slice(0, 8)}`;
const CATS = ["Cinema", "Musica", "Sport", "Storia", "Geografia", "Scienza", "Arte", "Cucina", "Natura", "Fumetti"];
const created: string[] = [];
let hostId = "";
/** domande dell'archivio di prova già "viste" dall'host (in una sua partita precedente) */
const seenByHost = new Set<string>();
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

beforeAll(async () => {
  const ids: { id: string; cat: string; i: number }[] = [];
  for (let i = 0; i < 60; i++) {
    const cat = CATS[i % CATS.length];
    const id = await makeQuestion(`Ruota ${TAG} n. ${i}?`, ["Uno", "Due", "Tre", "Quattro"], [i % 4], { category: cat, difficulty: (i % 5) + 1, tags: ["test-automatico", TAG] });
    ids.push({ id, cat, i });
  }
  const email = `ruota-${randomUUID().slice(0, 8)}@test.chenesai.local`;
  const r = await auth.auth.admin.createUser({ email, password: `Pw-${randomUUID()}`, email_confirm: true });
  if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
  hostId = r.data.user.id;
  await sql`insert into host_profiles (user_id, username) values (${hostId}, ${`ruota_${randomUUID().slice(0, 8)}`})`;
  // l'host ha già visto TUTTE le domande di Sport e Arte (registro per account): la ruota le evita
  const old = await sql<{ id: string }[]>`
    insert into game_sessions (title, code, host_user_id, status) values ('Partita vecchia', ${`R${randomUUID().slice(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, "X")}`}, ${hostId}, 'finished')
    returning id`;
  created.push(old[0].id);
  for (const q of ids.filter((x) => x.cat === "Sport" || x.cat === "Arte")) {
    await sql`insert into question_plays (question_id, session_id, session_question_id, host_user_id) values (${q.id}, ${old[0].id}, ${randomUUID()}, ${hostId})`;
    seenByHost.add(q.id);
  }
});

afterAll(async () => {
  for (const id of created) await cleanupSession(id).catch(() => undefined);
  await sql`delete from question_plays where host_user_id = ${hostId}`.catch(() => undefined);
  await sql`delete from question_bank where ${TAG} = any(tags)`;
  if (hostId) await auth.auth.admin.deleteUser(hostId);
  await sql.end();
});

async function roundsOf(sessionId: string) {
  return sql<{ id: string; position: number; palmino_wheel: StoredPalminoWheel | null; wheel_spun_at: Date | null }[]>`
    select id, position, palmino_wheel, wheel_spun_at from game_rounds where session_id = ${sessionId} order by position`;
}

/** Porta la partita fino ai punti della domanda n (compresa), senza giocatori. */
async function playThrough(sessionId: string, n: number) {
  for (let i = 0; i < n; i++) {
    await cmd(sessionId, "SHOW_QUESTION");
    await cmd(sessionId, "SHOW_OPTIONS");
    await cmd(sessionId, "REVEAL", { force: true });
    await cmd(sessionId, "SCORE");
  }
}

describe("partita libera con la Ruota di Palmino", () => {
  let sessionId = "";
  let wheel: StoredPalminoWheel;
  let wheelRoundId = "";

  it("alla pubblicazione la ruota prende 6–8 categorie con domande vere, mai viste dall'host", async () => {
    const res = await composeAndCreateSession(sql, { rounds: 2, totalQuestions: 12, mix: "bilanciata", reserves: 0, isTest: false, title: `Ruota ${TAG}` }, { userId: hostId, email: null }, {
      onlyTag: TAG,
      hostUserId: hostId,
      settings: { advanceMode: "manual", palminoWheel: true },
    });
    sessionId = res.sessionId!;
    created.push(sessionId);
    await publishSession(sessionId, TEST_ACTOR, { palminoWheel: { onlyTag: TAG, force: [5] } });
    const rounds = await roundsOf(sessionId);
    expect(rounds[0].palmino_wheel).not.toBeNull();
    expect(rounds[1].palmino_wheel).toBeNull();
    wheel = rounds[0].palmino_wheel!;
    wheelRoundId = rounds[0].id;
    expect(wheel.number).toBe(5);
    expect(wheel.segments.length).toBeGreaterThanOrEqual(6);
    expect(wheel.segments.length).toBeLessThanOrEqual(8);
    expect(new Set(wheel.segments.map((s) => s.label)).size).toBe(wheel.segments.length);
    // candidate: riserve marcate, con la copia congelata, della categoria dello spicchio, mai viste dall'host
    const cands = await sql<{ id: string; question_id: string; is_reserve: boolean; category: string; snap: boolean }[]>`
      select sq.id, sq.question_id, sq.is_reserve, q.category, exists (select 1 from question_snapshots s where s.session_question_id = sq.id) as snap
      from session_questions sq join question_bank q on q.id = sq.question_id
      where sq.session_id = ${sessionId} and sq.wheel_candidate`;
    expect(cands).toHaveLength(wheel.segments.length);
    for (const c of cands) {
      expect(c.is_reserve).toBe(true);
      expect(c.snap).toBe(true);
      expect(seenByHost.has(c.question_id)).toBe(false);
      expect(wheel.segments.find((s) => s.sqId === c.id)?.label).toBe(c.category);
    }
    expect(wheel.segments.map((s) => s.label)).not.toContain("Sport");
    expect(wheel.segments.map((s) => s.label)).not.toContain("Arte");
    // nessuna candidata è già nella partita, nessuna domanda conta due volte
    const main = await sql<{ question_id: string }[]>`select question_id from session_questions where session_id = ${sessionId} and not wheel_candidate`;
    const mainIds = new Set(main.map((m) => m.question_id));
    expect(cands.filter((c) => mainIds.has(c.question_id))).toEqual([]);
    // per la regia e per gli schermi la partita ha sempre 12 domande
    const detail = await getSessionDetail(sql, sessionId);
    expect(detail!.questions).toBe(12);
    expect(detail!.roundsDetail.flatMap((r) => r.questions).filter((q) => q.wheelCandidate)).toEqual([]);
  });

  it("voci della serata: 'Tocca a… X!' per ogni spicchio, niente candidate né segnaposto da preparare", async () => {
    const lines = await sessionLines(sql, sessionId);
    const texts = new Set(lines.map((l) => l.text));
    for (const seg of wheel.segments) expect(texts.has(palminoWheelResultLine(seg.label).text)).toBe(true);
    const snaps = await sql<{ id: string; text: string }[]>`
      select sq.id, qs.text from session_questions sq join question_snapshots qs on qs.session_question_id = sq.id
      where sq.session_id = ${sessionId} and (sq.wheel_candidate or sq.id = ${wheel.slotSqId})`;
    for (const q of snaps) expect(lines.some((l) => l.text.includes(q.text))).toBe(false);
  });

  it("dopo i punti della 4ª domanda MOSTRA DOMANDA fa girare la ruota (una volta sola, anche con comandi insieme)", async () => {
    await cmd(sessionId, "OPEN_LOBBY");
    await cmd(sessionId, "START_ROUND");
    await playThrough(sessionId, 4);
    let st = await buildPublicState(sql, sessionId);
    expect(st!.phase).toBe("SCORE_REVEAL");
    const live = await getAdminLiveState(sessionId);
    expect(live!.next?.palminoWheel).toBe(true);
    // tre schermi/clic insieme sulla stessa versione: un solo giro, gli altri respinti o duplicati
    const version = st!.version;
    const shared = randomUUID();
    const outcomes = await Promise.allSettled([
      executeCommand(sessionId, TEST_ACTOR, { command: "SHOW_QUESTION", commandId: shared, expectedVersion: version, args: {} }),
      executeCommand(sessionId, TEST_ACTOR, { command: "SHOW_QUESTION", commandId: shared, expectedVersion: version, args: {} }),
      executeCommand(sessionId, TEST_ACTOR, { command: "SHOW_QUESTION", commandId: randomUUID(), expectedVersion: version, args: {} }),
    ]);
    const ok = outcomes.filter((o) => o.status === "fulfilled" && !o.value.duplicate);
    expect(ok).toHaveLength(1);
    for (const o of outcomes) if (o.status === "rejected") expect((o.reason as GameError).code).toBe("VERSION_CONFLICT");
    const [{ spins }] = await sql<{ spins: number }[]>`
      select count(*)::int as spins from game_events where session_id = ${sessionId} and command = 'SHOW_QUESTION' and to_phase = 'WHEEL_SPIN'`;
    expect(spins).toBe(1);

    st = await buildPublicState(sql, sessionId);
    expect(st!.phase).toBe("WHEEL_SPIN");
    expect(st!.question).toBeNull();
    expect(st!.wheel).toMatchObject({ kind: "palmino", questionNumber: 5 });
    expect(st!.wheel!.segments.map((s) => s.label)).toEqual(wheel.segments.map((s) => s.label));
    // nello stato pubblico mai gli id delle domande candidate
    expect(JSON.stringify(st!.wheel)).not.toMatch(new RegExp(wheel.segments.map((s) => s.sqId).join("|")));
    const spin = st!.wheel!.spin!;
    expect(Date.parse(spin.startedAt)).toBeGreaterThan(Date.parse(st!.serverNow));
    const winner = wheel.segments[spin.winnerIndex];
    // libreria ufficiale: una battuta "Durante la ruota" di un presentatore, saltabile, mai il risultato
    const wheelLines = st!.showLines ?? [];
    expect(wheelLines).toHaveLength(1);
    expect(wheelLines[0]).toMatchObject({ event: "WHEEL_SPIN", optional: true, live: false });
    expect(wheelLines[0].display).toBeTruthy();
    expect(wheelLines[0].text).not.toContain(winner.label);

    // la vincente ha preso il posto del segnaposto; il segnaposto è tornato una riserva
    const [w] = await sql<{ is_reserve: boolean; position: number }[]>`select is_reserve, position from session_questions where id = ${winner.sqId}`;
    const [slot] = await sql<{ is_reserve: boolean; position: number; shown_at: Date | null }[]>`select is_reserve, position, shown_at from session_questions where id = ${wheel.slotSqId}`;
    expect(w).toMatchObject({ is_reserve: false, position: wheel.slotPosition });
    expect(slot).toMatchObject({ is_reserve: true, position: winner.position, shown_at: null });

    // finché la ruota gira non si va avanti (salvo conferma esplicita)
    await expect(cmd(sessionId, "SHOW_QUESTION")).rejects.toMatchObject({ code: "WHEEL_SPINNING" });
  });

  it("a ruota ferma esce la domanda della categoria scelta, numerata e registrata nello storico dell'host", async () => {
    const st0 = (await buildPublicState(sql, sessionId))!;
    const spin = st0.wheel!.spin!;
    const winner = wheel.segments[spin.winnerIndex];
    // la ruota si è fermata (si anticipa l'orologio del giro)
    await sql`update game_rounds set wheel_spun_at = clock_timestamp() - interval '30 seconds' where id = ${wheelRoundId}`;
    await cmd(sessionId, "SHOW_QUESTION");
    const st = (await buildPublicState(sql, sessionId))!;
    expect(st.phase).toBe("QUESTION_VISIBLE");
    expect(st.question!.id).toBe(winner.sqId);
    expect(st.question!.category).toBe(winner.label);
    expect(st.question!.number).toBe(5);
    expect(st.question!.positionInRound).toBe(5);
    expect(st.question!.totalInRound).toBe(6);
    expect(st.totalQuestions).toBe(12);
    expect(st.wheel).toBeNull();
    const plays = await sql<{ session_question_id: string; host_user_id: string }[]>`select session_question_id, host_user_id from question_plays where session_id = ${sessionId}`;
    expect(plays.find((p) => p.session_question_id === winner.sqId)?.host_user_id).toBe(hostId);
    expect(plays.find((p) => p.session_question_id === wheel.slotSqId)).toBeUndefined();
    // le candidate perdenti restano riserve mai giocate (nessuna traccia nello storico)
    const losers = wheel.segments.filter((s) => s.sqId !== winner.sqId).map((s) => s.sqId);
    expect(plays.filter((p) => losers.includes(p.session_question_id))).toEqual([]);
    // e la partita prosegue normalmente fino alla fine del round
    await cmd(sessionId, "SHOW_OPTIONS");
    await cmd(sessionId, "REVEAL", { force: true });
    await cmd(sessionId, "SCORE");
    await cmd(sessionId, "SHOW_QUESTION");
    const st6 = (await buildPublicState(sql, sessionId))!;
    expect(st6.phase).toBe("QUESTION_VISIBLE");
    expect(st6.question!.number).toBe(6);
    // una sola ruota per round: già girata, non ricompare
    const [r] = await roundsOf(sessionId);
    expect(r.palmino_wheel!.winnerSqId).toBe(winner.sqId);
  });

  it("la copia della partita non porta con sé le candidate né lo scambio", async () => {
    const copy = await duplicateSession(sessionId, TEST_ACTOR, { isTest: true });
    created.push(copy);
    const rows = await sql<{ question_id: string; is_reserve: boolean; wheel_candidate: boolean }[]>`select question_id, is_reserve, wheel_candidate from session_questions where session_id = ${copy}`;
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => !r.is_reserve && !r.wheel_candidate)).toBe(true);
    const [orig] = await sql<{ question_id: string }[]>`select question_id from session_questions where id = ${wheel.slotSqId}`;
    expect(rows.map((r) => r.question_id)).toContain(orig.question_id);
  });
});

describe("serata della regia con la Ruota di Palmino (prova)", () => {
  let sessionId = "";

  async function build(settings: Record<string, unknown>) {
    const id = await createSession({ title: `Ruota regia ${TAG}`, isTest: true, settings }, TEST_ACTOR);
    created.push(id);
    const roundId = await createRound(id, { title: "Tutto e niente", kind: "standard", speedBonusMax: 0 }, TEST_ACTOR);
    const qs = (await sql<{ id: string }[]>`select id from question_bank where ${TAG} = any(tags) order by id limit 7`).map((q) => q.id);
    await addQuestionsToRound(roundId, qs, {}, TEST_ACTOR);
    return id;
  }

  it("spenta di default: nessun piano", async () => {
    const id = await build({});
    await publishSession(id, TEST_ACTOR, { palminoWheel: { onlyTag: TAG, force: [5] } });
    expect((await roundsOf(id)).every((r) => r.palmino_wheel === null)).toBe(true);
  });

  it("annullando la pubblicazione le candidate spariscono (si riscelgono alla prossima)", async () => {
    const id = await build({ palminoWheel: true });
    await publishSession(id, TEST_ACTOR, { palminoWheel: { onlyTag: TAG, force: [6] } });
    expect((await roundsOf(id))[0].palmino_wheel?.number).toBe(6);
    await unpublishSession(id, TEST_ACTOR);
    const [{ c }] = await sql<{ c: number }[]>`select count(*)::int as c from session_questions where session_id = ${id} and wheel_candidate`;
    expect(c).toBe(0);
    expect((await roundsOf(id))[0].palmino_wheel).toBeNull();
  });

  it("scorrimento automatico: dopo il giro il passo arriva solo a ruota ferma; l'azzeramento rimette tutto a posto", async () => {
    sessionId = await build({ palminoWheel: true });
    await publishSession(sessionId, TEST_ACTOR, { palminoWheel: { onlyTag: TAG, force: [5] } });
    const [round] = await roundsOf(sessionId);
    const plan = round.palmino_wheel!;
    await cmd(sessionId, "OPEN_LOBBY");
    await cmd(sessionId, "START_ROUND");
    await playThrough(sessionId, 4);
    await cmd(sessionId, "SET_AUTOPLAY", { autoplay: true });
    const before = (await buildPublicState(sql, sessionId))!;
    // il passo automatico in programma (MOSTRA DOMANDA) eseguito da due TV insieme: un solo giro
    await sql`update game_state set auto_next_at = clock_timestamp() - interval '1 second' where session_id = ${sessionId}`;
    const v = before.version;
    const tick = () => executeCommand(sessionId, { userId: null, email: "regia automatica" }, { command: "SHOW_QUESTION", commandId: autoCommandId(sessionId, v), expectedVersion: v, args: {} }, { auto: true });
    const res = await Promise.allSettled([tick(), tick()]);
    expect(res.filter((r) => r.status === "fulfilled" && !r.value.duplicate)).toHaveLength(1);
    const st = (await buildPublicState(sql, sessionId))!;
    expect(st.phase).toBe("WHEEL_SPIN");
    const [g] = await sql<{ auto_command: string; auto_next_at: Date }[]>`select auto_command, auto_next_at from game_state where session_id = ${sessionId}`;
    expect(g.auto_command).toBe("SHOW_QUESTION");
    expect(g.auto_next_at.getTime()).toBeGreaterThanOrEqual(Date.parse(st.wheel!.spin!.startedAt) + st.wheel!.spin!.durationMs);
    await cmd(sessionId, "SET_AUTOPLAY", { autoplay: false });

    await cmd(sessionId, "RESET_TEST");
    const [r] = await roundsOf(sessionId);
    expect(r.wheel_spun_at).toBeNull();
    expect(r.palmino_wheel!.winnerSqId).toBeUndefined();
    const [slot] = await sql<{ is_reserve: boolean; position: number }[]>`select is_reserve, position from session_questions where id = ${plan.slotSqId}`;
    expect(slot).toEqual({ is_reserve: false, position: plan.slotPosition });
    const cands = await sql<{ id: string; is_reserve: boolean; position: number }[]>`select id, is_reserve, position from session_questions where session_id = ${sessionId} and wheel_candidate`;
    for (const c of cands) expect(c).toEqual({ id: c.id, is_reserve: true, position: plan.segments.find((s) => s.sqId === c.id)!.position });
  });

  it("le candidate non diventano mai la domanda misteriosa", async () => {
    // serata appena azzerata: nessuna riserva "vera", solo le candidate della ruota
    await cmd(sessionId, "START_ROUND");
    await cmd(sessionId, "SHOW_QUESTION");
    await cmd(sessionId, "SHOW_OPTIONS");
    await cmd(sessionId, "REVEAL", { force: true });
    await cmd(sessionId, "SCORE");
    await expect(cmd(sessionId, "ACTIVATE_EVENT", { definitionKey: "mystery-question" })).rejects.toMatchObject({ code: "EVENT_NOT_ALLOWED" });
  });
});
