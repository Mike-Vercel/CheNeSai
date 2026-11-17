import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { provaRapida } from "@/lib/tig/games/index";
import type { TigAction } from "@/lib/tig/types";
import type { TigUser } from "@/lib/server/tig/auth";
import { _testing, runAction, SYSTEM_ACTOR } from "@/lib/server/tig/engine";
import { TigError } from "@/lib/server/tig/errors";
import { closeAbandonedEvents, createEvent, exportCsv, getDisplayState, getEventView, joinEvent, listMyEvents, previewJoin } from "@/lib/server/tig/events";

/**
 * TAVOLI IN GUERRA! contro il database locale: account veri (Supabase Auth locale), serate vere, tutte le
 * transizioni passano dal motore. Le soluzioni si leggono dal database SOLO per giocare nei test e per
 * controllare che non arrivino mai nello stato pubblico.
 */
const sql = getSql();
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const users: string[] = [];

async function makeUser(label: string): Promise<TigUser> {
  const email = `tig-${label}-${randomUUID().slice(0, 8)}@test.chenesai.local`;
  const r = await auth.auth.admin.createUser({ email, password: `Pw-${randomUUID()}`, email_confirm: true });
  if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
  users.push(r.data.user.id);
  return { userId: r.data.user.id, ip: null, username: label };
}

afterAll(async () => {
  if (users.length) await sql`delete from tig_events where owner_user_id in ${sql(users)}`;
  for (const id of users) await auth.auth.admin.deleteUser(id).catch(() => undefined);
});

const act = (eventId: string, u: TigUser, a: TigAction) => runAction(eventId, { userId: u.userId, ip: null }, a);
const key = () => randomUUID();
async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof TigError && e.code === code);
}
const tables = async (eventId: string) => sql<{ id: string; table_no: number; qr_token: string; join_code: string }[]>`select id, table_no, qr_token, join_code from tig_tables where event_id = ${eventId} order by table_no`;
const ev = async (eventId: string) => (await sql<{ state: string; manche_no: number; game_index: number; current_game_id: string | null; phase_deadline_at: Date | null; paused_at: Date | null }[]>`select state, manche_no, game_index, current_game_id, phase_deadline_at, paused_at from tig_events where id = ${eventId}`)[0];
const teamsOf = async (eventId: string) => sql<{ id: string; table_no: number; score: number; energy: number; captain_member_id: string | null; mascot_slot: number | null; caos_used: boolean }[]>`select id, table_no, score, energy, captain_member_id, mascot_slot, caos_used from tig_teams where event_id = ${eventId} order by table_no`;
async function expire(eventId: string) {
  await sql`update tig_events set phase_deadline_at = now() - interval '1 second' where id = ${eventId} and phase_deadline_at is not null`;
  await sql`update tig_games set starts_at = least(starts_at, now() - interval '40 seconds'), deadline_at = now() - interval '3 seconds' where event_id = ${eventId} and status = 'active'`;
  await runAction(eventId, SYSTEM_ACTOR, { action: "tick" });
}
/** Porta la prova in corso alla fase di gioco (finita la regola a schermo). */
async function goPlay(eventId: string) {
  await sql`update tig_games set starts_at = now() - interval '1 second' where event_id = ${eventId} and status = 'active'`;
}
async function answerOf(gameId: string): Promise<number> {
  const [g] = await sql<{ content: { answer: number } }[]>`select content from tig_games where id = ${gameId}`;
  return g.content.answer;
}

interface Setup {
  eventId: string;
  owner: TigUser;
  captains: TigUser[];
  extra: TigUser[];
}

/** Serata con N tavoli, ognuno con il capitano (+ eventuali altri telefoni), squadre convalidate. */
async function setupEvent(n: number, opts: { extraPerTable?: number[]; start?: boolean; config?: Record<string, unknown> } = {}): Promise<Setup> {
  const owner = await makeUser("org");
  const { eventId } = await createEvent(owner, { venue: "Pub di prova", tables: n, durationMin: 115, ...(opts.config ?? {}) });
  await act(eventId, owner, { action: "open_lobby" });
  const tb = await tables(eventId);
  const captains: TigUser[] = [];
  const extra: TigUser[] = [];
  for (let i = 0; i < n; i++) {
    const c = await makeUser(`cap${i + 1}`);
    await joinEvent(c, { token: tb[i].qr_token, nickname: `Capitano ${i + 1}`, teamName: `Squadra ${i + 1}` });
    captains.push(c);
    for (let k = 0; k < (opts.extraPerTable?.[i] ?? 0); k++) {
      const u = await makeUser(`m${i + 1}x${k}`);
      await joinEvent(u, { token: tb[i].qr_token, nickname: `Amico ${i + 1}-${k}` });
      extra.push(u);
    }
  }
  for (const t of await teamsOf(eventId)) await act(eventId, owner, { action: "approve_team", teamId: t.id, approved: true });
  if (opts.start) {
    await act(eventId, owner, { action: "start" });
    await act(eventId, owner, { action: "skip" }); // INTRO → ROUND_INTRO
    await act(eventId, owner, { action: "skip" }); // ROUND_INTRO → GAME_ACTIVE
  }
  return { eventId, owner, captains, extra };
}

describe("TAVOLI IN GUERRA! · iscrizione", () => {
  it("due scansioni simultanee dello stesso QR creano UNA squadra; il secondo entra in quella", async () => {
    const owner = await makeUser("org");
    const { eventId } = await createEvent(owner, { venue: "Pub QR", tables: 3 });
    await act(eventId, owner, { action: "open_lobby" });
    const [t1] = await tables(eventId);
    const a = await makeUser("a");
    const b = await makeUser("b");
    const res = await Promise.all([
      joinEvent(a, { token: t1.qr_token, nickname: "Anna", teamName: "Le Volpi" }),
      joinEvent(b, { token: t1.qr_token, nickname: "Bruno", teamName: "I Lupi" }),
    ]);
    const teams = await teamsOf(eventId);
    expect(teams).toHaveLength(1);
    expect(res.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(res.map((r) => r.teamId)).size).toBe(1);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from tig_members where team_id = ${teams[0].id} and status = 'active'`;
    expect(n).toBe(2);
    // chi scansiona dopo vede «Entra nella squadra: [nome]»
    const c = await makeUser("c");
    const p = await previewJoin(c, { token: t1.qr_token });
    expect(p.team?.name).toMatch(/Volpi|Lupi/);
    expect(p.canCreate).toBe(false);
    expect(p.canJoin).toBe(true);
  });

  it("un account non entra in due squadre della stessa serata, nemmeno da due sessioni simultanee", async () => {
    const owner = await makeUser("org");
    const { eventId } = await createEvent(owner, { venue: "Pub Doppio", tables: 3 });
    await act(eventId, owner, { action: "open_lobby" });
    const tb = await tables(eventId);
    const u = await makeUser("doppio");
    const r = await Promise.allSettled([joinEvent(u, { token: tb[0].qr_token, nickname: "Dario", teamName: "Primo Tavolo" }), joinEvent(u, { code: tb[1].join_code, nickname: "Dario", teamName: "Secondo Tavolo" })]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const rejected = r.find((x) => x.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(TigError);
    expect((rejected.reason as TigError).code).toBe("ALREADY_IN_TEAM");
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from tig_members where event_id = ${eventId} and user_id = ${u.userId}`;
    expect(n).toBe(1);
    // riscansionare il proprio QR è una riconnessione, non un errore
    const again = await joinEvent(u, r[0].status === "fulfilled" ? { token: tb[0].qr_token, nickname: "Dario" } : { code: tb[1].join_code, nickname: "Dario" });
    expect(again.joinedExisting).toBe(true);
  });

  it("lobby bloccata: niente nuove squadre senza l'ingresso tardivo autorizzato; PIN dello staff", async () => {
    const owner = await makeUser("org");
    const { eventId } = await createEvent(owner, { venue: "Pub PIN", tables: 3, staffPin: true });
    const tb = await tables(eventId);
    const [{ pin }] = await sql<{ pin: string }[]>`select pin from tig_tables where id = ${tb[0].id}`;
    const u = await makeUser("pin");
    await expectCode(joinEvent(u, { token: tb[0].qr_token, nickname: "Pia", teamName: "Bozza" }), "LOBBY_LOCKED"); // ancora DRAFT
    await act(eventId, owner, { action: "open_lobby" });
    await expectCode(joinEvent(u, { token: tb[0].qr_token, nickname: "Pia", teamName: "Tavolo Pin" }), "PIN_REQUIRED");
    await expectCode(joinEvent(u, { token: tb[0].qr_token, nickname: "Pia", teamName: "Tavolo Pin", pin: pin === "0000" ? "1111" : "0000" }), "PIN_WRONG");
    await joinEvent(u, { token: tb[0].qr_token, nickname: "Pia", teamName: "Tavolo Pin", pin });
    await act(eventId, owner, { action: "lock_lobby" });
    const v = await makeUser("tardi");
    const [{ pin: pin2 }] = await sql<{ pin: string }[]>`select pin from tig_tables where id = ${tb[1].id}`;
    await expectCode(joinEvent(v, { token: tb[1].qr_token, nickname: "Vito", teamName: "Ritardatari", pin: pin2 }), "LOBBY_LOCKED");
    await act(eventId, owner, { action: "late_join", open: true });
    await joinEvent(v, { token: tb[1].qr_token, nickname: "Vito", teamName: "Ritardatari", pin: pin2 });
    expect(await teamsOf(eventId)).toHaveLength(2);
    // QR alterato: scartato prima del database
    await expectCode(previewJoin(v, { token: tb[0].qr_token.slice(0, -2) + "xx" }), "NOT_FOUND");
  });

  it("nome squadra filtrato e mostrato in TV solo dopo la convalida dello staff", async () => {
    const owner = await makeUser("org");
    const { eventId } = await createEvent(owner, { venue: "Pub Nomi", tables: 2 });
    await act(eventId, owner, { action: "open_lobby" });
    const tb = await tables(eventId);
    const u = await makeUser("nomi");
    await expectCode(joinEvent(u, { token: tb[0].qr_token, nickname: "Nino", teamName: "Merdacce" }), "VALIDATION");
    await joinEvent(u, { token: tb[0].qr_token, nickname: "Nino", teamName: "Gli Inattesi" });
    const [{ display_key }] = await sql<{ display_key: string }[]>`select display_key from tig_events where id = ${eventId}`;
    let d = await getDisplayState(display_key);
    expect(JSON.stringify(d.state)).not.toContain("Gli Inattesi");
    expect(d.state.pendingTeams).toBe(1);
    const [t] = await teamsOf(eventId);
    await act(eventId, owner, { action: "approve_team", teamId: t.id, approved: true });
    d = await getDisplayState(display_key);
    expect(d.state.teams[0].name).toBe("Gli Inattesi");
    // vista live: niente QR né codici
    const live = await getDisplayState(display_key, { live: true });
    expect(live.lobby).toBe(null);
    expect(JSON.stringify(live)).not.toContain(tb[0].qr_token);
    expect(JSON.stringify(live)).not.toContain(tb[0].join_code);
    expect(JSON.stringify(d.state)).not.toContain(tb[0].qr_token);
  });
});

describe("TAVOLI IN GUERRA! · mascotte", () => {
  it("voto dei membri, conferma del capitano, ogni mascotte a un solo tavolo anche con conferme simultanee", async () => {
    const s = await setupEvent(3, { extraPerTable: [1, 0, 0] });
    const [t1, t2, t3] = await teamsOf(s.eventId);
    // tutti vogliono la 5
    await act(s.eventId, s.captains[0], { action: "vote_mascot", slot: 5 });
    await act(s.eventId, s.extra[0], { action: "vote_mascot", slot: 5 });
    await act(s.eventId, s.captains[1], { action: "vote_mascot", slot: 5 });
    await act(s.eventId, s.captains[2], { action: "vote_mascot", slot: 5 });
    // doppio voto dello stesso membro: resta UN voto (modificato)
    await act(s.eventId, s.captains[2], { action: "vote_mascot", slot: 7 });
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from tig_mascot_votes where event_id = ${s.eventId}`;
    expect(n).toBe(4);
    await Promise.allSettled([act(s.eventId, s.captains[0], { action: "confirm_mascot" }), act(s.eventId, s.captains[1], { action: "confirm_mascot" })]);
    const after = await teamsOf(s.eventId);
    const slots = after.filter((t) => t.mascot_slot).map((t) => t.mascot_slot);
    expect(new Set(slots).size).toBe(slots.length);
    expect(slots).toContain(5);
    // al via chi non ha confermato riceve la sua più votata ancora libera
    await act(s.eventId, s.owner, { action: "start" });
    const final = await teamsOf(s.eventId);
    expect(final.find((t) => t.id === t3.id)!.mascot_slot).toBe(7);
    expect(new Set(final.map((t) => t.mascot_slot)).size).toBe(3);
    expect([t1.id, t2.id].length).toBe(2);
  });
});

describe("TAVOLI IN GUERRA! · prova, invii e punteggio", () => {
  it("tavolo da 2 e tavolo da 8, stesse risposte → stessi punti; doppio clic/refresh → nessun doppio invio", async () => {
    const s = await setupEvent(2, { extraPerTable: [1, 7], start: true });
    let e = await ev(s.eventId);
    expect(e.state).toBe("GAME_ACTIVE");
    const gameId = e.current_game_id!;
    await goPlay(s.eventId);
    const answer = await answerOf(gameId);
    const k1 = key();
    // stesso istante dal punto di vista del tempo: si fissa elapsed uguale
    const r1 = await act(s.eventId, s.captains[0], { action: "submit", gameId, payload: { choice: answer }, idempotencyKey: k1 });
    expect(r1.result.accepted).toBe(true);
    // doppio clic con la stessa chiave: nessun cambiamento
    const r1b = await act(s.eventId, s.captains[0], { action: "submit", gameId, payload: { choice: answer }, idempotencyKey: k1 });
    expect(r1b.result.duplicate).toBe(true);
    // refresh con una chiave nuova: la squadra ha già risposto
    await expectCode(act(s.eventId, s.captains[0], { action: "submit", gameId, payload: { choice: (answer + 1) % 4 }, idempotencyKey: key() }), "ALREADY_SUBMITTED");
    // un non capitano non invia la risposta di squadra (il capitano è online)
    await expectCode(act(s.eventId, s.extra[1], { action: "submit", gameId, payload: { choice: answer }, idempotencyKey: key() }), "FORBIDDEN");
    await act(s.eventId, s.captains[1], { action: "submit", gameId, payload: { choice: answer }, idempotencyKey: key() });
    await sql`update tig_submissions set elapsed_ms = 5000 where game_id = ${gameId}`;
    // tutti hanno risposto: la prova si chiude da sola... ma l'elapsed è stato forzato dopo: si rifà il punteggio su una prova nuova
    e = await ev(s.eventId);
    expect(e.state).toBe("GAME_RESULTS");
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from tig_submissions where game_id = ${gameId}`;
    expect(n).toBe(2);
    // punteggio uguale a parità di risposta e tempo (calcolato dalla fixture, indipendente dai telefoni)
    const out = provaRapida.score({ content: (await sql<{ content: never }[]>`select content from tig_games where id = ${gameId}`)[0].content, ctx: { gameInstanceId: gameId, startsAt: 0, deadlineAt: 30_000, seed: "", participants: ["a", "b"], teams: [{ teamId: "a", tableNo: 1, members: ["1", "2"], captainId: "1" }, { teamId: "b", tableNo: 2, members: ["1", "2", "3", "4", "5", "6", "7", "8"], captainId: "1" }] }, submissions: [{ teamId: "a", memberId: "1", elapsedMs: 5000, payload: { choice: answer } }, { teamId: "b", memberId: "1", elapsedMs: 5000, payload: { choice: answer } }] });
    expect(out.outcomes[0].points).toBe(out.outcomes[1].points);
    // nel database: entrambe le squadre hanno preso punti (risposta giusta), ognuna UNA voce di registro
    const ledger = await sql<{ team_id: string; applied: number }[]>`select team_id, applied from tig_score_ledger where event_id = ${s.eventId} and ref = ${gameId}`;
    expect(ledger).toHaveLength(2);
    for (const l of ledger) expect(l.applied).toBeGreaterThanOrEqual(100);
  });

  it("registro idempotente: rielaborare la stessa prova non raddoppia i punti", async () => {
    const s = await setupEvent(2, { start: true });
    const e = await ev(s.eventId);
    await goPlay(s.eventId);
    const answer = await answerOf(e.current_game_id!);
    await act(s.eventId, s.captains[0], { action: "submit", gameId: e.current_game_id!, payload: { choice: answer }, idempotencyKey: key() });
    await expire(s.eventId);
    const before = await teamsOf(s.eventId);
    // tick ripetuti, letture concorrenti: nessun doppio punteggio
    await Promise.all([runAction(s.eventId, SYSTEM_ACTOR, { action: "tick" }), runAction(s.eventId, SYSTEM_ACTOR, { action: "tick" }), getEventView(s.captains[0], s.eventId, "player")]);
    const after = await teamsOf(s.eventId);
    expect(after.map((t) => t.score)).toEqual(before.map((t) => t.score));
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from tig_score_ledger where event_id = ${s.eventId}`;
    expect(n).toBe(1);
    // il registro torna con i saldi
    const [{ sum }] = await sql<{ sum: number }[]>`select coalesce(sum(applied),0)::int as sum from tig_score_ledger where event_id = ${s.eventId} and team_id = ${after[0].id}`;
    expect(sum).toBe(after[0].score);
  });

  it("nessuna soluzione nello stato pubblico (TV, realtime, vista dei giocatori) prima del reveal", async () => {
    const s = await setupEvent(2, { start: true });
    const e = await ev(s.eventId);
    const [{ content, display_key }] = await sql<{ content: { answer: number; explain: string; options: string[] }; display_key: string }[]>`select g.content, e.display_key from tig_games g join tig_events e on e.id = g.event_id where g.id = ${e.current_game_id}`;
    // durante la regola: nemmeno la domanda
    let tv = await getDisplayState(display_key);
    expect(tv.state.game?.stage).toBe("rule");
    expect(tv.state.game?.view).toBe(null);
    await goPlay(s.eventId);
    tv = await getDisplayState(display_key);
    const pub = JSON.stringify(tv);
    expect(tv.state.game?.stage).toBe("play");
    expect(pub).not.toContain(content.explain);
    expect(pub).not.toContain('"answer"');
    const pv = JSON.stringify(await getEventView(s.captains[1], s.eventId, "player"));
    expect(pv).not.toContain(content.explain);
    expect(pv).not.toContain('"answer"');
    await expire(s.eventId);
    tv = await getDisplayState(display_key);
    expect(tv.state.state).toBe("GAME_RESULTS");
    expect((tv.state.game?.reveal as { answer: number }).answer).toBe(content.answer);
  });

  it("pausa e ripresa spostano le scadenze; niente invii in pausa", async () => {
    const s = await setupEvent(2, { start: true });
    await goPlay(s.eventId);
    const before = await ev(s.eventId);
    const [g0] = await sql<{ deadline_at: Date }[]>`select deadline_at from tig_games where id = ${before.current_game_id}`;
    await act(s.eventId, s.owner, { action: "pause", reason: "Wi-Fi del locale" });
    expect((await ev(s.eventId)).state).toBe("PAUSED");
    await expectCode(act(s.eventId, s.captains[0], { action: "submit", gameId: before.current_game_id!, payload: { choice: 0 }, idempotencyKey: key() }), "PAUSED");
    // in pausa il tempo non scorre: le letture non fanno avanzare nulla
    await sql`update tig_events set paused_at = paused_at - interval '20 seconds' where id = ${s.eventId}`;
    await runAction(s.eventId, SYSTEM_ACTOR, { action: "tick" });
    expect((await ev(s.eventId)).state).toBe("PAUSED");
    await act(s.eventId, s.owner, { action: "resume" });
    const after = await ev(s.eventId);
    const [g1] = await sql<{ deadline_at: Date }[]>`select deadline_at from tig_games where id = ${before.current_game_id}`;
    expect(after.state).toBe("GAME_ACTIVE");
    expect(g1.deadline_at.getTime() - g0.deadline_at.getTime()).toBeGreaterThanOrEqual(19_000);
    expect(after.phase_deadline_at!.getTime() - before.phase_deadline_at!.getTime()).toBeGreaterThanOrEqual(19_000);
    const audit = await sql<{ kind: string; reason: string | null }[]>`select kind, reason from tig_log where event_id = ${s.eventId} and audit order by id`;
    expect(audit.map((a) => a.kind)).toEqual(expect.arrayContaining(["pause", "resume", "start"]));
    expect(audit.find((a) => a.kind === "pause")?.reason).toBe("Wi-Fi del locale");
  });

  it("skip e rollback della regia con audit: la prova annullata storna i punti e riparte", async () => {
    const s = await setupEvent(2, { start: true });
    let e = await ev(s.eventId);
    await goPlay(s.eventId);
    const answer = await answerOf(e.current_game_id!);
    await act(s.eventId, s.captains[0], { action: "submit", gameId: e.current_game_id!, payload: { choice: answer }, idempotencyKey: key() });
    await act(s.eventId, s.owner, { action: "skip", reason: "Tutti pronti" });
    e = await ev(s.eventId);
    expect(e.state).toBe("GAME_RESULTS");
    const scored = (await teamsOf(s.eventId))[0].score;
    expect(scored).toBeGreaterThan(0);
    await expectCode(act(s.eventId, s.owner, { action: "rollback", reason: "" }), "VALIDATION");
    await act(s.eventId, s.owner, { action: "rollback", reason: "Domanda letta male" });
    e = await ev(s.eventId);
    expect(e.state).toBe("GAME_ACTIVE");
    expect((await teamsOf(s.eventId))[0].score).toBe(0);
    const [{ status }] = await sql<{ status: string }[]>`select status from tig_games where event_id = ${s.eventId} order by created_at limit 1`;
    expect(status).toBe("voided");
    const [{ reason }] = await sql<{ reason: string }[]>`select reason from tig_log where event_id = ${s.eventId} and kind = 'rollback'`;
    expect(reason).toBe("Domanda letta male");
    // un giocatore non può dare comandi di regia
    await expectCode(act(s.eventId, s.captains[0], { action: "skip" }), "FORBIDDEN");
  });

  it("puntata finale idempotente e con tetto min(25% saldo, 250)", async () => {
    const s = await setupEvent(2, { start: true });
    // si salta alla manche finale, ultima prova
    await sql`update tig_teams set score = 600 where event_id = ${s.eventId}`;
    const e0 = await ev(s.eventId);
    await sql`update tig_games set bet_enabled = true where id = ${e0.current_game_id}`;
    await sql`update tig_events set manche_no = 5 where id = ${s.eventId}`;
    await goPlay(s.eventId);
    const k = key();
    await expectCode(act(s.eventId, s.captains[0], { action: "bet", gameId: e0.current_game_id!, amount: 200, idempotencyKey: k }), "LIMIT");
    const r1 = await act(s.eventId, s.captains[0], { action: "bet", gameId: e0.current_game_id!, amount: 150, idempotencyKey: k });
    const r2 = await act(s.eventId, s.captains[0], { action: "bet", gameId: e0.current_game_id!, amount: 150, idempotencyKey: k });
    expect(r1.result.accepted).toBe(true);
    expect(r2.result.duplicate).toBe(true);
    await expectCode(act(s.eventId, s.captains[0], { action: "bet", gameId: e0.current_game_id!, amount: 10, idempotencyKey: key() }), "ALREADY_SUBMITTED");
    const answer = await answerOf(e0.current_game_id!);
    await act(s.eventId, s.captains[0], { action: "submit", gameId: e0.current_game_id!, payload: { choice: (answer + 1) % 4 }, idempotencyKey: key() });
    await expire(s.eventId);
    const t = (await teamsOf(s.eventId))[0];
    expect(t.score).toBe(450); // puntata persa, saldo mai negativo
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from tig_bets where event_id = ${s.eventId}`;
    expect(n).toBe(1);
  });
});

describe("TAVOLI IN GUERRA! · poteri, attacchi e Bottone del Caos", () => {
  async function toManche2Leaderboard(s: Setup) {
    await sql`update tig_events set manche_no = 2 where id = ${s.eventId}`;
    await expire(s.eventId); // GAME_ACTIVE → GAME_RESULTS
    expect((await ev(s.eventId)).state).toBe("GAME_RESULTS");
  }

  it("terzo attacco sullo stesso tavolo entro 10 minuti respinto; tetti 40/80; scudo non cumulabile", async () => {
    const s = await setupEvent(4, { start: true });
    await sql`update tig_events set manche_no = 2 where id = ${s.eventId}`;
    await sql`update tig_teams set score = 500 where event_id = ${s.eventId}`;
    const [a, b, c, d] = await teamsOf(s.eventId);
    const r1 = await _testing.transfer(s.eventId, a.id, d.id, 100);
    const r2 = await _testing.transfer(s.eventId, b.id, d.id, 40);
    const r3 = await _testing.transfer(s.eventId, c.id, d.id, 40);
    expect(r1).toMatchObject({ amount: 40, outcome: "applied" });
    expect(r2).toMatchObject({ amount: 40, outcome: "applied" });
    expect(r3).toMatchObject({ amount: 0, outcome: "refused" });
    const t = await teamsOf(s.eventId);
    expect(t.find((x) => x.id === d.id)!.score).toBe(420);
    expect(t.find((x) => x.id === a.id)!.score).toBe(540);
    // tetto di 80 persi per manche (anche dopo la finestra dei 10 minuti)
    await sql`update tig_attacks set created_at = now() - interval '11 minutes' where event_id = ${s.eventId}`;
    expect(await _testing.transfer(s.eventId, c.id, d.id, 40)).toMatchObject({ amount: 0 });
    // scudo: uno per manche, blocca il prossimo attacco e si consuma
    await act(s.eventId, s.captains[2], { action: "shield", idempotencyKey: key() });
    await expectCode(act(s.eventId, s.captains[2], { action: "shield", idempotencyKey: key() }), "ALREADY_SUBMITTED");
    expect(await _testing.transfer(s.eventId, a.id, c.id, 40)).toMatchObject({ amount: 0, outcome: "blocked" });
    expect(await _testing.transfer(s.eventId, b.id, c.id, 40)).toMatchObject({ amount: 40, outcome: "applied" });
  });

  it("un potere consumato non si riusa nemmeno con richieste concorrenti (Bottone del Caos 1 volta)", async () => {
    const s = await setupEvent(4, { start: true });
    await toManche2Leaderboard(s);
    const [, b, c] = await teamsOf(s.eventId);
    const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => act(s.eventId, s.captains[0], { action: "caos", targetTeamId: i % 2 ? b.id : c.id, idempotencyKey: key() })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from tig_powers where event_id = ${s.eventId} and kind = 'caos'`;
    expect(n).toBe(1);
    const e = await ev(s.eventId);
    expect(e.state).toBe("GAME_ACTIVE");
    const [g] = await sql<{ kind: string; participants: string[]; timer_ms: number }[]>`select kind, participants, timer_ms from tig_games where id = ${e.current_game_id}`;
    expect(g.kind).toBe("caos");
    expect(g.participants).toHaveLength(2);
    expect(g.timer_ms).toBe(45_000);
    // ALLARME CAOS sulla TV
    const [{ display_key }] = await sql<{ display_key: string }[]>`select display_key from tig_events where id = ${s.eventId}`;
    const tv = await getDisplayState(display_key);
    expect(tv.state.spotlight?.kind).toBe("chaos");
    expect(tv.state.game?.kind).toBe("caos");
    // solo i due tavoli del duello possono rispondere
    await goPlay(s.eventId);
    await expectCode(act(s.eventId, s.captains[3], { action: "submit", gameId: e.current_game_id!, payload: { choice: 0 }, idempotencyKey: key() }), "FORBIDDEN");
    // +50 al vincitore
    const answer = await answerOf(e.current_game_id!);
    await act(s.eventId, s.captains[0], { action: "submit", gameId: e.current_game_id!, payload: { choice: answer }, idempotencyKey: key() });
    await expire(s.eventId);
    const [{ applied }] = await sql<{ applied: number }[]>`select applied from tig_score_ledger where event_id = ${s.eventId} and source = 'caos'`;
    expect(applied).toBe(50);
    // e non si preme più
    await expire(s.eventId); // → LEADERBOARD
    await expectCode(act(s.eventId, s.captains[0], { action: "caos", targetTeamId: c.id, idempotencyKey: key() }), "ALREADY_SUBMITTED");
  });

  it("Bottone del Caos: niente nella manche 1, niente su se stessi, terza sfida allo stesso tavolo respinta", async () => {
    const s = await setupEvent(4, { start: true });
    const [a, , , d] = await teamsOf(s.eventId);
    await expire(s.eventId); // manche 1 → GAME_RESULTS
    await expectCode(act(s.eventId, s.captains[1], { action: "caos", targetTeamId: d.id, idempotencyKey: key() }), "WRONG_PHASE");
    await sql`update tig_events set manche_no = 2 where id = ${s.eventId}`;
    await expectCode(act(s.eventId, s.captains[0], { action: "caos", targetTeamId: a.id, idempotencyKey: key() }), "LIMIT");
    // due sfide già registrate sul tavolo 4
    await sql`insert into tig_attacks (event_id, source_team_id, target_team_id, kind, manche_no, outcome) values (${s.eventId}, ${a.id}, ${d.id}, 'caos', 2, 'applied'), (${s.eventId}, ${a.id}, ${d.id}, 'transfer', 2, 'applied')`;
    await expectCode(act(s.eventId, s.captains[1], { action: "caos", targetTeamId: d.id, idempotencyKey: key() }), "LIMIT");
  });

  it("Energia Caos separata dai punti: si accumula con la partecipazione e fa evolvere la mascotte (anche all'ultimo)", async () => {
    const s = await setupEvent(2, { start: true, config: { chaosLevel2: 10, chaosLevel3: 20 } });
    const e = await ev(s.eventId);
    await goPlay(s.eventId);
    // risposta SBAGLIATA ma puntuale: zero punti, energia sì
    const answer = await answerOf(e.current_game_id!);
    await act(s.eventId, s.captains[0], { action: "submit", gameId: e.current_game_id!, payload: { choice: (answer + 1) % 4 }, idempotencyKey: key() });
    await expire(s.eventId);
    const [t] = await teamsOf(s.eventId);
    expect(t.score).toBe(0);
    expect(t.energy).toBeGreaterThanOrEqual(10);
    const [{ mascot_level }] = await sql<{ mascot_level: number }[]>`select mascot_level from tig_teams where id = ${t.id}`;
    expect(mascot_level).toBe(2);
    const [{ display_key }] = await sql<{ display_key: string }[]>`select display_key from tig_events where id = ${s.eventId}`;
    expect((await getDisplayState(display_key)).state.spotlight?.kind).toBe("evolve");
  });
});

describe("TAVOLI IN GUERRA! · isolamento tra serate", () => {
  it("due serate contemporanee non si toccano", async () => {
    const s1 = await setupEvent(2, { start: true });
    const s2 = await setupEvent(2);
    // un giocatore di una serata non agisce nell'altra
    await expectCode(act(s2.eventId, s1.captains[0], { action: "vote_mascot", slot: 3 }), "NOT_MEMBER");
    await expectCode(getEventView(s1.captains[0], s2.eventId, "player"), "NOT_MEMBER");
    // l'organizzatore di una non apre la regia dell'altra
    await expectCode(getEventView(s1.owner, s2.eventId, "regia"), "FORBIDDEN");
    await expectCode(act(s2.eventId, s1.owner, { action: "start" }), "NOT_MEMBER");
    // la TV di una non mostra le squadre dell'altra
    const [{ display_key }] = await sql<{ display_key: string }[]>`select display_key from tig_events where id = ${s2.eventId}`;
    const tv2 = JSON.stringify(await getDisplayState(display_key));
    for (const t of await teamsOf(s1.eventId)) expect(tv2).not.toContain(t.id);
    // le azioni su una non cambiano la versione dell'altra
    const [{ version: v0 }] = await sql<{ version: number }[]>`select version from tig_events where id = ${s2.eventId}`;
    await act(s1.eventId, s1.owner, { action: "pause" });
    const [{ version: v1 }] = await sql<{ version: number }[]>`select version from tig_events where id = ${s2.eventId}`;
    expect(v1).toBe(v0);
    // il codice di un tavolo porta solo alla sua serata
    const tb2 = await tables(s2.eventId);
    const u = await makeUser("iso");
    expect((await previewJoin(u, { code: tb2[0].join_code })).eventId).toBe(s2.eventId);
  });

  it("serata intera: dalla lobby alla premiazione, con classifica condivisa e premiazione dal fondo", async () => {
    const s = await setupEvent(3, { start: true });
    for (let step = 0; step < 400; step++) {
      const e = await ev(s.eventId);
      if (e.state === "COMPLETED") break;
      if (e.state === "GAME_ACTIVE") {
        await goPlay(s.eventId);
        const answer = await answerOf(e.current_game_id!);
        // il tavolo 1 risponde sempre giusto, il 2 a volte, il 3 mai
        await act(s.eventId, s.captains[0], { action: "submit", gameId: e.current_game_id!, payload: { choice: answer }, idempotencyKey: key() }).catch(() => undefined);
        if (step % 2) await act(s.eventId, s.captains[1], { action: "submit", gameId: e.current_game_id!, payload: { choice: answer }, idempotencyKey: key() }).catch(() => undefined);
      }
      await expire(s.eventId);
    }
    const e = await ev(s.eventId);
    expect(e.state).toBe("COMPLETED");
    const [{ awards }] = await sql<{ awards: { order: string[] } }[]>`select awards from tig_events where id = ${s.eventId}`;
    const t = await teamsOf(s.eventId);
    expect(awards.order.at(-1)).toBe(t[0].id);
    expect(awards.order[0]).toBe(t[2].id);
    const games = await sql<{ manche_no: number; kind: string }[]>`select manche_no, kind from tig_games where event_id = ${s.eventId} and status = 'scored'`;
    expect(new Set(games.map((g) => g.manche_no))).toEqual(new Set([1, 2, 3, 4, 5]));
    const states = await sql<{ to_state: string }[]>`select distinct to_state from tig_log where event_id = ${s.eventId} and to_state is not null`;
    expect(states.length).toBeGreaterThan(0);
    const [{ breaks }] = await sql<{ breaks: number }[]>`select count(*)::int as breaks from tig_log where event_id = ${s.eventId} and kind = 'game_started' and (data->>'mancheNo')::int = 4`;
    expect(breaks).toBeGreaterThan(0);
  });

  it("serate abbandonate (né regia né TV da troppo) chiuse e annunciate; «Riprendi» e CSV", async () => {
    const s = await setupEvent(2, { start: true });
    expect((await listMyEvents(s.owner.userId)).map((e) => e.eventId)).toContain(s.eventId);
    expect((await listMyEvents(s.captains[0].userId))[0]).toMatchObject({ eventId: s.eventId, role: "player" });
    const csv = await exportCsv(s.owner, s.eventId, "classifica");
    expect(csv.body).toContain("Squadra 1");
    await expectCode(exportCsv(s.captains[0], s.eventId, "classifica"), "FORBIDDEN");
    await sql`update tig_events set host_seen_at = now() - interval '2 hours', display_seen_at = now() - interval '2 hours' where id = ${s.eventId}`;
    expect(await closeAbandonedEvents({ eventId: s.eventId })).toBe(1);
    const [row] = await sql<{ status: string; state: string; close_reason: string }[]>`select status, state, close_reason from tig_events where id = ${s.eventId}`;
    expect(row).toEqual({ status: "closed", state: "CANCELLED", close_reason: "abandoned" });
    expect((await listMyEvents(s.owner.userId)).map((e) => e.eventId)).not.toContain(s.eventId);
    await expectCode(act(s.eventId, s.owner, { action: "resume" }), "CLOSED");
  });
});
