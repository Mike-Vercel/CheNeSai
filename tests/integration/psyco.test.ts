import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { remainingMs } from "@/lib/psyco/logic";
import type { PsycoAction, PsycoPublicState, PsycoView } from "@/lib/psyco/types";
import { runAction, type PsycoActor } from "@/lib/server/psyco/engine";
import { PsycoError } from "@/lib/server/psyco/errors";
import { closeStaleRooms, createRoom, getDisplayState, getRoomView, joinRoom, previewRoom, type PsycoUser } from "@/lib/server/psyco/rooms";
import { buildPublicState } from "@/lib/server/psyco/state";

/**
 * PSYCO contro il database locale: account veri (Supabase Auth locale), stanze vere, tutte le
 * transizioni passano dal motore. Verifica anche che la regola non arrivi MAI allo PSYCO né nello
 * stato pubblico (TV, realtime).
 */
const sql = getSql();
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const users: string[] = [];
const rooms: string[] = [];

async function makeUser(label: string): Promise<PsycoUser> {
  const email = `psyco-${label}-${randomUUID().slice(0, 8)}@test.chenesai.local`;
  const r = await auth.auth.admin.createUser({ email, password: `Pw-${randomUUID()}`, email_confirm: true });
  if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
  users.push(r.data.user.id);
  return { userId: r.data.user.id, ip: null, username: label };
}

const actor = (u: PsycoUser, as?: string): PsycoActor => ({ userId: u.userId, ip: null, asParticipantId: as ?? null });
const act = (roomId: string, u: PsycoUser, a: PsycoAction, as?: string) => runAction(roomId, actor(u, as), a);
const view = (roomId: string, u: PsycoUser, as?: string): Promise<PsycoView> => getRoomView(u, roomId, as ?? null);

/** Voto di più persone: chi arriva dopo che la maggioranza ha già deciso riceve STALE_BALLOT (normale). */
async function voteAll(roomId: string, u: PsycoUser, voters: (string | PsycoUser)[], ballot: string, choice: string) {
  for (const x of voters) {
    try {
      if (typeof x === "string") await act(roomId, u, { action: "vote", ballot, choice }, x);
      else await act(roomId, x, { action: "vote", ballot, choice });
    } catch (e) {
      if (!(e instanceof PsycoError && e.code === "STALE_BALLOT")) throw e;
    }
  }
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof PsycoError && e.code === code);
}

/** Nessun testo segreto nel JSON pubblico (TV, realtime). */
function assertNoSecret(state: PsycoPublicState, secrets: string[]) {
  const json = JSON.stringify(state);
  for (const s of secrets) if (s) expect(json.includes(s), `segreto nel JSON pubblico: ${s}`).toBe(false);
}

let host: PsycoUser;
let p2: PsycoUser;
let p3: PsycoUser;
let p4: PsycoUser;
let stranger: PsycoUser;

beforeAll(async () => {
  [host, p2, p3, p4, stranger] = await Promise.all([makeUser("sara"), makeUser("mike"), makeUser("luca"), makeUser("giulia"), makeUser("estraneo")]);
});

afterAll(async () => {
  if (rooms.length) await sql`delete from psyco_rooms where id = any(${sql.array(rooms)}::uuid[])`;
  for (const id of users) await auth.auth.admin.deleteUser(id);
});

const SETTINGS = { timerMs: 90_000, ruleMode: "auto" as const, psycoPick: "auto" as const };

describe("PSYCO – dispositivi personali", () => {
  let roomId: string;
  let code: string;
  const all = () => [host, p2, p3, p4];

  it("crea la stanza (host autenticato, anche giocatore) e la protegge", async () => {
    const r = await createRoom(host, { mode: "personal", settings: SETTINGS, hostNickname: "Sara" });
    roomId = r.roomId;
    code = r.code;
    rooms.push(roomId);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const v = await view(roomId, host);
    expect(v.view.isHost).toBe(true);
    expect(v.state.participants.map((p) => p.nickname)).toEqual(["Sara"]);
    // chi non è nella stanza non legge nulla
    await expectCode(view(roomId, stranger), "NOT_MEMBER");
    await expectCode(act(roomId, stranger, { action: "start_game" }), "NOT_MEMBER");
  });

  it("minimo 3: con 2 non si inizia, con 3 sì; un account = un solo posto", async () => {
    await joinRoom(p2, code, "Mike");
    await expectCode(act(roomId, host, { action: "start_game" }), "NOT_ENOUGH_PLAYERS");
    // stesso account che rientra: resta UN posto
    await joinRoom(p2, code.toLowerCase(), "Mike");
    await expectCode(joinRoom(p3, code, "mike"), "NICKNAME_TAKEN");
    await joinRoom(p3, code, "Luca");
    await joinRoom(p4, code, "Giulia");
    const prev = await previewRoom(p2, code);
    expect(prev.activeCount).toBe(4);
    expect(prev.member).toBe("active");
    // solo l'host avvia
    await expectCode(act(roomId, p2, { action: "start_game" }), "FORBIDDEN");
    const r = await act(roomId, host, { action: "start_game" });
    expect(r.state!.phase).toBe("ROLE_REVEAL");
    expect(r.state!.round?.members).toHaveLength(4);
  });

  let psyco: PsycoUser;
  let knowers: PsycoUser[];
  let firstRule = "";

  it("uno e un solo PSYCO, ruoli privati", async () => {
    const views = await Promise.all(all().map((u) => view(roomId, u)));
    const roles = views.map((v) => v.view.role);
    expect(roles.filter((r) => r === "psyco")).toHaveLength(1);
    expect(roles.filter((r) => r === "knower")).toHaveLength(3);
    psyco = all()[roles.indexOf("psyco")];
    knowers = all().filter((u) => u !== psyco);
    // lo stato pubblico dice CHI è lo PSYCO (serve allo schermo) ma nessun segreto
    expect(views[0].state.round?.psycoId).toBe(views[roles.indexOf("psyco")].view.me?.participantId);
    for (const u of all()) await act(roomId, u, { action: "seen" });
    const s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("DIFFICULTY_VOTE");
  });

  it("automatica: difficoltà scelta insieme, proposta, rifiuto → un'altra regola, conferma", async () => {
    let s = (await view(roomId, host)).state!;
    const ballot = s.round!.vote!.ballot;
    // lo PSYCO non vota
    await expectCode(act(roomId, psyco, { action: "vote", ballot, choice: "facile" }), "FORBIDDEN");
    await act(roomId, knowers[0], { action: "vote", ballot, choice: "media" });
    await act(roomId, knowers[1], { action: "vote", ballot, choice: "media" });
    s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("RULE_VOTE");
    expect(s.round!.difficulty).toBe("media");
    // chi conosce la regola vede la proposta, lo PSYCO no
    const k = await view(roomId, knowers[0]);
    const cand1 = k.view.secret!.candidate!;
    expect(cand1.text.length).toBeGreaterThan(5);
    expect(cand1.difficulty).toBe("media");
    const pv = await view(roomId, psyco);
    expect(pv.view.secret).toBeNull();
    expect(JSON.stringify(pv)).not.toContain(cand1.text);
    assertNoSecret(s, [cand1.text]);
    assertNoSecret(await getDisplayState((await sql<{ display_key: string }[]>`select display_key from psyco_rooms where id = ${roomId}`)[0].display_key), [cand1.text]);

    // due su tre la bocciano → nuova regola, diversa
    const b2 = s.round!.vote!.ballot;
    await act(roomId, knowers[0], { action: "vote", ballot: b2, choice: "no" });
    await act(roomId, knowers[1], { action: "vote", ballot: b2, choice: "no" });
    s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("RULE_VOTE");
    expect(s.event?.kind).toBe("rule_rejected");
    expect(s.round!.candidatesShown).toBe(2);
    const cand2 = (await view(roomId, knowers[2])).view.secret!.candidate!;
    expect(cand2.text).not.toBe(cand1.text);
    // voto su una votazione già chiusa: rifiutato
    await expectCode(act(roomId, knowers[2], { action: "vote", ballot: b2, choice: "yes" }), "STALE_BALLOT");
    // maggioranza: confermata
    const b3 = s.round!.vote!.ballot;
    await voteAll(roomId, host, knowers, b3, "yes");
    s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("RULE_CONFIRMED");
    firstRule = cand2.text;
    expect((await view(roomId, knowers[0])).view.secret!.rule!.text).toBe(firstRule);
    expect((await view(roomId, psyco)).view.secret).toBeNull();
    assertNoSecret(s, [firstRule]);
  });

  it("pronti → conto alla rovescia → PLAYING; tentativo sbagliato (timer in pausa e poi riprende), poi giusto", async () => {
    for (const u of all()) await act(roomId, u, { action: "ready" });
    let s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("PLAYING");
    // prima del via non si può dire «ho capito»
    await expectCode(act(roomId, psyco, { action: "guess" }), "WRONG_PHASE");
    await sql`update psyco_rounds set started_at = now() - interval '20 seconds' where room_id = ${roomId} and round_no = 1`;
    // solo lo PSYCO (o l'host)
    const notHostKnower = knowers.find((u) => u !== host)!;
    await expectCode(act(roomId, notHostKnower, { action: "guess" }), "FORBIDDEN");
    s = (await act(roomId, psyco, { action: "guess" })).state!;
    expect(s.phase).toBe("GUESS_VOTE");
    expect(s.round!.timer.pausedAt).not.toBeNull();
    const frozen = remainingMs(s.round!.timer, Date.parse(s.serverNow))!;
    const gb = s.round!.vote!.ballot;
    await voteAll(roomId, host, knowers, gb, "no");
    s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("PLAYING");
    expect(s.event?.kind).toBe("guess_wrong");
    expect(s.round!.timer.pausedAt).toBeNull();
    // riprende dal tempo residuo (± qualche centinaio di ms)
    expect(Math.abs(remainingMs(s.round!.timer, Date.parse(s.serverNow))! - frozen)).toBeLessThan(1500);
    // secondo tentativo: giusto
    s = (await act(roomId, psyco, { action: "guess" })).state!;
    const gb2 = s.round!.vote!.ballot;
    await voteAll(roomId, host, knowers, gb2, "yes");
    s = (await view(roomId, psyco)).state!;
    expect(s.phase).toBe("ROUND_END");
    expect(s.round!.outcome).toBe("guessed");
    expect(s.round!.attempts).toBe(2);
    // a manche finita la regola è pubblica
    expect(s.round!.revealedRule!.text).toBe(firstRule);
    const [row] = await sql<{ outcome: string; attempts: number; elapsed_ms: number; difficulty: string; rule_source: string }[]>`
      select outcome, attempts, elapsed_ms, difficulty, rule_source from psyco_rounds where room_id = ${roomId} and round_no = 1`;
    expect(row).toMatchObject({ outcome: "guessed", attempts: 2, difficulty: "media", rule_source: "archive" });
    expect(Number(row.elapsed_ms)).toBeGreaterThan(15_000);
  });

  it("manche successive senza ricreare la stanza: rotazione equa (tutti PSYCO una volta), modalità libera e timer nuovi", async () => {
    const psycos: string[] = [];
    const first = (await view(roomId, host)).state.round!.psycoId!;
    psycos.push(first);
    for (let i = 0; i < 3; i++) {
      await act(roomId, host, { action: "next_round", settings: { timerMs: 7 * 60_000 + 45_000, ruleMode: "free", psycoPick: "auto" } });
      const s = (await view(roomId, host)).state!;
      expect(s.round!.no).toBe(i + 2);
      expect(s.round!.timer.totalMs).toBe(465_000);
      psycos.push(s.round!.psycoId!);
      await act(roomId, host, { action: "end_round" });
    }
    expect(new Set(psycos).size).toBe(4);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from psyco_rooms where id = ${roomId}`;
    expect(n).toBe(1);
  });

  it("libera: ognuno propone, parità → spareggio → vincente; il testo resta segreto per lo PSYCO", async () => {
    await act(roomId, host, { action: "next_round", settings: { timerMs: null, ruleMode: "free", psycoPick: "manual" }, psycoId: (await view(roomId, p4)).view.me!.participantId });
    let s = (await view(roomId, host)).state!;
    expect(s.round!.psycoNickname).toBe("Giulia");
    expect(s.round!.timer.totalMs).toBeNull();
    for (const u of [host, p2, p3, p4]) await act(roomId, u, { action: "seen" });
    s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("RULE_PROPOSALS");
    await expectCode(act(roomId, p4, { action: "propose", text: "Lo PSYCO non può proporre" }), "FORBIDDEN");
    await expectCode(act(roomId, host, { action: "propose", text: "   " }), "VALIDATION");
    const texts = ["Si risponde sempre toccandosi un orecchio", "Ogni risposta contiene un nome di città <script>alert(1)</script>", "Si risponde parlando lentissimo"];
    await act(roomId, host, { action: "propose", text: texts[0] });
    await act(roomId, p2, { action: "propose", text: texts[1] });
    s = (await view(roomId, host)).state!;
    expect(s.round!.proposed).toHaveLength(2);
    assertNoSecret(s, texts);
    await act(roomId, p3, { action: "propose", text: texts[2] });
    s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("PROPOSAL_VOTE");
    const kv = (await view(roomId, p3)).view.secret!.proposals;
    expect(kv).toHaveLength(3);
    // il testo è conservato come testo (mostrato con escape da React), senza caratteri invisibili
    expect(kv.find((p) => p.text.includes("città"))!.text).toContain("<script>");
    expect((await view(roomId, p4)).view.secret).toBeNull();
    assertNoSecret(s, texts);
    const [a, b, c] = kv.map((p) => p.id);
    const ballot = s.round!.vote!.ballot;
    // ognuno vota una diversa → parità a tre → spareggio
    await act(roomId, host, { action: "vote", ballot, choice: a });
    await act(roomId, p2, { action: "vote", ballot, choice: b });
    await act(roomId, p3, { action: "vote", ballot, choice: c });
    s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("PROPOSAL_VOTE");
    expect(s.event?.kind).toBe("runoff");
    expect(s.round!.vote!.runoff).toHaveLength(3);
    const ballot2 = s.round!.vote!.ballot;
    await act(roomId, host, { action: "vote", ballot: ballot2, choice: b });
    await act(roomId, p2, { action: "vote", ballot: ballot2, choice: b });
    s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("RULE_CONFIRMED");
    const rule = (await view(roomId, p3)).view.secret!.rule!.text;
    expect(rule).toBe(kv.find((p) => p.id === b)!.text);
    // le regole dei giocatori NON finiscono nell'archivio
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from psyco_rules where description = ${rule}`;
    expect(n).toBe(0);
    // senza limite: il round non scade mai
    await act(roomId, host, { action: "start_round" });
    await sql`update psyco_rounds set started_at = now() - interval '3 hours' where room_id = ${roomId} and round_no = ${s.round!.no}`;
    s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("PLAYING");
    // conclusione manuale autorizzata
    await expectCode(act(roomId, p2, { action: "end_round" }), "FORBIDDEN");
    s = (await act(roomId, host, { action: "end_round" })).state!;
    expect(s.round!.outcome).toBe("ended");
  });

  it("timer: pausa, ripresa e scadenza (vince il gruppo) con riferimento al server", async () => {
    await act(roomId, host, { action: "next_round", settings: { timerMs: 12 * 60_000 + 10_000, ruleMode: "auto", psycoPick: "auto" } });
    for (const u of all()) await act(roomId, u, { action: "seen" });
    let s = (await view(roomId, host)).state!;
    const kn: PsycoUser[] = [];
    for (const u of all()) if ((await view(roomId, u)).view.role === "knower") kn.push(u);
    await voteAll(roomId, host, kn, s.round!.vote!.ballot, "sorpresa");
    s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("RULE_VOTE");
    await act(roomId, host, { action: "close_vote" }); // nessun voto → nessun consenso → un'altra regola
    s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("RULE_VOTE");
    await voteAll(roomId, host, kn, s.round!.vote!.ballot, "yes");
    await act(roomId, host, { action: "start_round" });
    await sql`update psyco_rounds set started_at = now() - interval '60 seconds' where room_id = ${roomId} and round_no = ${s.round!.no}`;
    s = (await act(roomId, host, { action: "pause" })).state!;
    const atPause = remainingMs(s.round!.timer, Date.parse(s.serverNow))!;
    expect(atPause).toBeGreaterThan(12 * 60_000 + 10_000 - 62_000);
    expect(atPause).toBeLessThan(12 * 60_000 + 10_000 - 58_000);
    // durante la pausa il tempo non scende (refresh = nuovo calcolo dal server)
    await new Promise((r) => setTimeout(r, 1200));
    s = (await view(roomId, p2)).state!;
    expect(remainingMs(s.round!.timer, Date.parse(s.serverNow))).toBe(atPause);
    s = (await act(roomId, host, { action: "resume" })).state!;
    expect(s.round!.timer.pausedMs).toBeGreaterThanOrEqual(1000);
    // scadenza: chiunque legga lo stato (anche lo schermo) chiude la manche
    await sql`update psyco_rounds set started_at = now() - interval '13 minutes' where room_id = ${roomId} and round_no = ${s.round!.no}`;
    const display = await getDisplayState((await sql<{ display_key: string }[]>`select display_key from psyco_rooms where id = ${roomId}`)[0].display_key);
    expect(display.phase).toBe("ROUND_END");
    expect(display.round!.outcome).toBe("time_up");
    expect(display.round!.revealedRule?.text).toBeTruthy();
  });

  it("uscite: l'host se ne va → gestione al giocatore entrato prima; lo PSYCO se ne va → fine manche", async () => {
    await act(roomId, host, { action: "leave" });
    let s = (await view(roomId, p2)).state!;
    expect(s.event?.kind).toBe("host_changed");
    expect(s.participants.find((p) => p.isHost)?.nickname).toBe("Mike");
    expect((await view(roomId, p2)).view.isHost).toBe(true);
    await expectCode(view(roomId, host), "NOT_MEMBER");
    // rientro con lo stesso account: stesso posto
    await joinRoom(host, code, "Sara");
    s = (await view(roomId, p2)).state!;
    expect(s.activeCount).toBe(4);
    await act(roomId, p2, { action: "next_round", psycoId: s.participants.find((p) => p.nickname === "Luca")!.id, settings: { timerMs: 60_000, ruleMode: "auto", psycoPick: "manual" } });
    await act(roomId, p3, { action: "leave" });
    s = (await view(roomId, p2)).state!;
    expect(s.phase).toBe("ROUND_END");
    expect(s.round!.outcome).toBe("psyco_left");
    // espulso: non rientra
    await act(roomId, p2, { action: "kick", participantId: s.participants.find((p) => p.nickname === "Giulia")!.id });
    await expectCode(joinRoom(p4, code, "Giulia"), "KICKED");
    await expectCode(view(roomId, p4), "KICKED");
  });
});

describe("PSYCO – un solo dispositivo (un account, nickname locali)", () => {
  let roomId: string;
  it("cinque nickname, nessun altro account; ruoli mostrati a turno; scelta collettiva; due manche", async () => {
    const r = await createRoom(host, { mode: "shared", settings: SETTINGS, nicknames: ["Sara", "Mike", "Luca", "Giulia", "Marco"] });
    roomId = r.roomId;
    rooms.push(roomId);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from psyco_participants where room_id = ${roomId} and kind = 'local' and user_id is null`;
    expect(n).toBe(5);
    // nessuno può entrare dal proprio telefono
    await expectCode(joinRoom(p2, r.code, "Intruso"), "SHARED_ROOM");
    await expectCode(view(roomId, p2), "NOT_MEMBER");
    let v = await view(roomId, host);
    expect(v.view.me).toBeNull();
    expect(v.view.secret).toBeNull();
    const ids = v.state.participants.map((p) => p.id);
    await act(roomId, host, { action: "start_game" });
    // a turno: «SONO MIKE — MOSTRA IL MIO RUOLO»
    const roles: Record<string, string | null> = {};
    for (const id of ids) {
      const pv = await view(roomId, host, id);
      roles[id] = pv.view.role;
      await act(roomId, host, { action: "seen" }, id);
    }
    expect(Object.values(roles).filter((x) => x === "psyco")).toHaveLength(1);
    const psycoId = ids.find((id) => roles[id] === "psyco")!;
    const knowers = ids.filter((id) => id !== psycoId);
    let s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("DIFFICULTY_VOTE");
    // lo PSYCO non vota nemmeno sul telefono condiviso
    await expectCode(act(roomId, host, { action: "vote", ballot: s.round!.vote!.ballot, choice: "facile" }, psycoId), "FORBIDDEN");
    await voteAll(roomId, host, knowers, s.round!.vote!.ballot, "facile");
    s = (await view(roomId, host)).state!;
    expect(s.round!.difficulty).toBe("facile");
    // vista dello PSYCO: niente regola
    expect((await view(roomId, host, psycoId)).view.secret).toBeNull();
    // vista senza "as" (telefono sul tavolo): niente regola
    expect((await view(roomId, host)).view.secret).toBeNull();
    const cand = (await view(roomId, host, knowers[0])).view.secret!.candidate!;
    assertNoSecret(s, [cand.text]);
    await voteAll(roomId, host, knowers, s.round!.vote!.ballot, "yes");
    s = (await view(roomId, host)).state!;
    expect(s.phase).toBe("RULE_CONFIRMED");
    await act(roomId, host, { action: "start_round" });
    await sql`update psyco_rounds set started_at = now() - interval '5 seconds' where room_id = ${roomId}`;
    // «HO CAPITO!» premuto sul telefono condiviso
    s = (await act(roomId, host, { action: "guess" })).state!;
    await voteAll(roomId, host, knowers, s.round!.vote!.ballot, "yes");
    s = (await view(roomId, host)).state!;
    expect(s.round!.outcome).toBe("guessed");
    // seconda manche: un altro PSYCO
    await act(roomId, host, { action: "next_round" });
    s = (await view(roomId, host)).state!;
    expect(s.round!.no).toBe(2);
    expect(s.round!.psycoId).not.toBe(psycoId);
    // il proprietario non può usare "as" con un id di un'altra stanza
    await expectCode(view(roomId, host, randomUUID()), "NOT_FOUND");
    // un altro account non può agire come un giocatore locale
    await expectCode(act(roomId, p2, { action: "seen" }, ids[0]), "FORBIDDEN");
    // giocatori aggiunti fra le manche
    await act(roomId, host, { action: "end_round" });
    await act(roomId, host, { action: "add_local", nickname: "Anna" });
    await expectCode(act(roomId, host, { action: "add_local", nickname: "anna" }), "NICKNAME_TAKEN");
    v = await view(roomId, host);
    expect(v.state.activeCount).toBe(6);
  });
});

describe("PSYCO – sicurezza dello stato pubblico e pulizia", () => {
  it("lo stato pubblico costruito dal server non contiene mai il testo della regola prima della fine", async () => {
    const r = await createRoom(host, { mode: "shared", settings: SETTINGS, nicknames: ["A1", "B2", "C3"] });
    rooms.push(r.roomId);
    let v = await view(r.roomId, host);
    await act(r.roomId, host, { action: "start_game" });
    const ids = v.state.participants.map((p) => p.id);
    for (const id of ids) await act(r.roomId, host, { action: "seen" }, id);
    v = await view(r.roomId, host);
    const knowers: string[] = [];
    for (const id of ids) if ((await view(r.roomId, host, id)).view.role === "knower") knowers.push(id);
    await voteAll(r.roomId, host, knowers, v.state.round!.vote!.ballot, "difficile");
    await voteAll(r.roomId, host, knowers, (await view(r.roomId, host)).state.round!.vote!.ballot, "yes");
    const [{ rule_text }] = await sql<{ rule_text: string }[]>`select rule_text from psyco_rounds where room_id = ${r.roomId}`;
    expect(rule_text).toBeTruthy();
    for (const action of ["start_round", "pause", "resume"] as const) {
      if (action === "pause") await sql`update psyco_rounds set started_at = now() - interval '5 seconds' where room_id = ${r.roomId}`;
      const res = await act(r.roomId, host, { action });
      assertNoSecret(res.state!, [rule_text]); // = payload inviato sul canale realtime
      assertNoSecret((await buildPublicState(sql, r.roomId))!, [rule_text]);
    }
  });

  it("chiude le stanze inattive da 24 ore", async () => {
    const r = await createRoom(host, { mode: "shared", settings: SETTINGS, nicknames: ["X", "Y", "Z"] });
    rooms.push(r.roomId);
    await sql`update psyco_rooms set last_activity_at = now() - interval '25 hours' where id = ${r.roomId}`;
    expect(await closeStaleRooms({ userId: host.userId })).toBeGreaterThanOrEqual(1);
    await expectCode(act(r.roomId, host, { action: "start_game" }), "ROOM_CLOSED");
  });

  it("codici: formato non valido o inesistente → nessuna informazione", async () => {
    await expectCode(previewRoom(stranger, "ZZZZZZ"), "NOT_FOUND");
    await expectCode(previewRoom(stranger, "<x>"), "NOT_FOUND");
  });
});
