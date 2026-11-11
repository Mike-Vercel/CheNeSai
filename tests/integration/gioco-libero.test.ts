import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { aggregatedLeaderboard } from "@/lib/server/cms/admin";
import { composeAndCreateSession } from "@/lib/server/cms/compose";
import { getSessionDetail, listSessions } from "@/lib/server/cms/sessions";
import { GiocoError } from "@/lib/server/gioco-errors";
import {
  createHostProfile,
  createPublicGame,
  getOwnedGame,
  hostCommand,
  hostGameStatus,
  isPublicSession,
  isUsernameAvailable,
  listHostGames,
  loadHostUser,
  quotaOf,
  loadPublicGamesSettings,
  previousOptions,
  rematchPublicGame,
  type HostAction,
  type HostUser,
} from "@/lib/server/gioco-libero";
import { authenticatePlayer, joinSession, PlayerError } from "@/lib/server/players";
import { buildPublicState } from "@/lib/server/public-state";
import { cleanupSession, makeQuestion, TEST_ACTOR } from "../support/fixtures";

/**
 * Gioco libero contro il database locale: account host veri (Supabase Auth locale),
 * archivio isolato (tag univoco), impostazioni globali ripristinate alla fine.
 */
const sql = getSql();
const TAG = `gioco-${randomUUID().slice(0, 8)}`;
const only = { onlyTag: TAG };
/** archivio a parte per la rivincita (un host nuovo, nessuna interferenza con i test sopra) */
const TAG2 = `rivincita-${randomUUID().slice(0, 8)}`;
const CATS = ["Storia", "Geografia", "Cinema", "Musica", "Sport", "Scienza"];
const created: string[] = [];
const users: string[] = [];
let previousSetting: { value: unknown } | undefined;

const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

async function makeUser(label: string): Promise<{ id: string; email: string }> {
  const email = `${label}-${randomUUID().slice(0, 8)}@test.chenesai.local`;
  const r = await auth.auth.admin.createUser({ email, password: `Pw-${randomUUID()}`, email_confirm: true });
  if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
  users.push(r.data.user.id);
  return { id: r.data.user.id, email };
}

async function setPublicGames(v: { enabled?: boolean; gamesPerAccount?: number; maxPlayers?: number }) {
  const current = await loadPublicGamesSettings(sql);
  await sql`
    insert into application_settings (key, value) values ('publicGames', ${sql.json({ ...current, ...v })})
    on conflict (key) do update set value = excluded.value`;
}

async function expectGiocoError(p: Promise<unknown>, code: string, status?: number) {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(GiocoError);
  expect((e as GiocoError).code).toBe(code);
  if (status) expect((e as GiocoError).status).toBe(status);
}

let hostA: HostUser;
let hostB: HostUser;

const refresh = async (h: HostUser) => loadHostUser(sql, h.userId, h.email);

beforeAll(async () => {
  [previousSetting] = await sql<{ value: unknown }[]>`select value from application_settings where key = 'publicGames'`;
  await setPublicGames({ enabled: true, gamesPerAccount: 0, maxPlayers: 20 });
  for (let i = 0; i < 24; i++) {
    await makeQuestion(`Domanda libera ${TAG} n. ${i}?`, ["Uno", "Due", "Tre", "Quattro"], [i % 4], {
      category: CATS[i % CATS.length],
      difficulty: (i % 5) + 1,
      tags: ["test-automatico", TAG],
    });
  }
  const a = await makeUser("host-a");
  const b = await makeUser("host-b");
  hostA = await loadHostUser(sql, a.id, a.email);
  hostB = await loadHostUser(sql, b.id, b.email);
});

afterAll(async () => {
  for (const id of created) await cleanupSession(id);
  await sql`delete from game_sessions where host_user_id = any(${sql.array(users)}::uuid[])`.catch(() => undefined);
  await sql`delete from question_bank where ${TAG} = any(tags) or ${TAG2} = any(tags)`;
  if (previousSetting) await sql`update application_settings set value = ${sql.json(previousSetting.value as never)} where key = 'publicGames'`;
  else await sql`delete from application_settings where key = 'publicGames'`;
  for (const id of users) await auth.auth.admin.deleteUser(id);
  await sql.end();
});

describe("account host e username", () => {
  const name = `Host_${randomUUID().slice(0, 6)}`;

  it("senza username non si crea una partita", async () => {
    await expectGiocoError(createPublicGame(hostA, { totalQuestions: 10, rounds: 2 }, only), "PROFILE_REQUIRED");
  });

  it("username univoco senza distinzione di maiuscole", async () => {
    expect(await isUsernameAvailable(sql, name)).toEqual({ available: true, message: null });
    const p = await createHostProfile(sql, hostA.userId, name);
    expect(p).toMatchObject({ username: name, gamesCreated: 0 });
    expect((await isUsernameAvailable(sql, name.toUpperCase())).available).toBe(false);
    // il proprio username risulta libero per sé stessi
    expect((await isUsernameAvailable(sql, name.toLowerCase(), hostA.userId)).available).toBe(true);
    await expectGiocoError(createHostProfile(sql, hostB.userId, name.toLowerCase()), "USERNAME_TAKEN", 409);
    await expectGiocoError(createHostProfile(sql, hostA.userId, `${name}x`), "PROFILE_EXISTS");
    await expectGiocoError(createHostProfile(sql, hostB.userId, "no spazi"), "USERNAME_INVALID", 422);
    await expectGiocoError(createHostProfile(sql, hostB.userId, "Admin"), "USERNAME_INVALID");
    await createHostProfile(sql, hostB.userId, `${name}_b`);
    hostA = await refresh(hostA);
    hostB = await refresh(hostB);
    expect(hostA.profile?.username).toBe(name);
    expect(hostA.adminRole).toBeNull();
  });
});

describe("creazione della partita libera", () => {
  let first: string;

  it("crea, pubblica e apre la lobby con scorrimento automatico", async () => {
    const r = await createPublicGame(hostA, { totalQuestions: 10, rounds: 3, mix: "bilanciata" }, only);
    first = r.sessionId;
    created.push(first);
    expect(r.lobbyOpen).toBe(true);
    expect(r.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(r.quota).toMatchObject({ limit: null, remaining: null, canCreate: true });
    const d = await getSessionDetail(sql, first);
    expect(d).toMatchObject({ status: "live", phase: "LOBBY", hostUserId: hostA.userId, hostUsername: hostA.profile!.username, isTest: false });
    expect(d!.settings).toMatchObject({ advanceMode: "auto", maxPlayers: 20 });
    expect(d!.roundsDetail.map((x) => [x.kind, x.questions.length])).toEqual([
      ["standard", 4],
      ["standard", 3],
      ["final", 3],
    ]);
    expect(await isPublicSession(first)).toBe(true);
    expect((await refresh(hostA)).profile?.gamesCreated).toBe(1);
    expect(await getOwnedGame(sql, hostA.userId, first)).toMatchObject({ id: first, code: r.code });
    expect(await getOwnedGame(sql, hostB.userId, first)).toBeNull();
    expect((await listHostGames(sql, hostA.userId)).map((g) => g.id)).toContain(first);
  });

  it("rifiuta quantità non previste", async () => {
    await expectGiocoError(createPublicGame(hostA, { totalQuestions: 10, rounds: 4 }, only), "ACTION_NOT_ALLOWED");
    await expectGiocoError(createPublicGame(hostA, { totalQuestions: 12, rounds: 2 }, only), "ACTION_NOT_ALLOWED");
  });

  it("la partita successiva evita le domande che l'host ha già visto", async () => {
    // le domande della prima partita "escono" (come durante il gioco): il trigger le registra per l'host
    // (le candidate della Ruota di Palmino restano riserve: non escono mai tutte)
    await sql`update session_questions set shown_at = now() where session_id = ${first} and not wheel_candidate`;
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from question_plays where session_id = ${first} and host_user_id = ${hostA.userId}`;
    expect(n).toBe(10);
    const seen = new Set((await sql<{ question_id: string }[]>`select question_id from session_questions where session_id = ${first} and not wheel_candidate`).map((r) => r.question_id));
    const r = await createPublicGame((hostA = await refresh(hostA)), { totalQuestions: 10, rounds: 2 }, only);
    created.push(r.sessionId);
    const picked = (await sql<{ question_id: string }[]>`select question_id from session_questions where session_id = ${r.sessionId} and not wheel_candidate`).map((x) => x.question_id);
    expect(picked).toHaveLength(10);
    expect(picked.filter((q) => seen.has(q))).toEqual([]);
    expect(r.warnings.some((w) => w.includes("tua partita precedente"))).toBe(false);
  });

  it("se l'archivio nuovo per l'host non basta, ripesca le già viste (con avviso)", async () => {
    // 24 domande: 10 viste, 10 nella seconda partita (non ancora uscite), 4 mai usate
    const r = await createPublicGame((hostA = await refresh(hostA)), { totalQuestions: 15, rounds: 3 }, only);
    created.push(r.sessionId);
    expect(r.warnings.some((w) => w.includes("tua partita precedente"))).toBe(true);
  });

  it("un altro host non è limitato dallo storico del primo", async () => {
    const r = await createPublicGame(hostB, { totalQuestions: 10, rounds: 2 }, only);
    created.push(r.sessionId);
    expect(r.warnings.some((w) => w.includes("tua partita precedente"))).toBe(false);
  });

  it("archivio insufficiente: errore chiaro", async () => {
    await expectGiocoError(createPublicGame(hostB, { totalQuestions: 30, rounds: 5 }, only), "ARCHIVE_TOO_SMALL", 422);
  });
});

describe("quota e interruttore generale", () => {
  it("predefinito illimitato; con un limite impostato si blocca", async () => {
    hostB = await refresh(hostB);
    expect(quotaOf(hostB, await loadPublicGamesSettings(sql)).limit).toBeNull();
    const used = hostB.profile!.gamesCreated;
    await setPublicGames({ gamesPerAccount: used + 1 });
    expect(quotaOf(hostB, await loadPublicGamesSettings(sql))).toMatchObject({ limit: used + 1, remaining: 1, canCreate: true });
    const r = await createPublicGame(hostB, { totalQuestions: 10, rounds: 1 }, only);
    created.push(r.sessionId);
    expect(r.quota).toMatchObject({ remaining: 0, canCreate: false });
    await expectGiocoError(createPublicGame((hostB = await refresh(hostB)), { totalQuestions: 10, rounds: 1 }, only), "QUOTA_EXHAUSTED", 403);
    // un admin non ha limiti
    const asAdmin: HostUser = { ...hostB, adminRole: "admin" };
    expect(quotaOf(asAdmin, await loadPublicGamesSettings(sql))).toMatchObject({ limit: null, canCreate: true });
    await setPublicGames({ gamesPerAccount: 0 });
  });

  it("gioco libero chiuso: solo gli admin possono creare", async () => {
    await setPublicGames({ enabled: false });
    await expectGiocoError(createPublicGame(hostA, { totalQuestions: 10, rounds: 1 }, only), "GIOCO_CHIUSO", 403);
    await setPublicGames({ enabled: true });
  });
});

describe("comandi dell'host", () => {
  let id: string;
  let code: string;

  beforeAll(async () => {
    await setPublicGames({ maxPlayers: 2 });
    const r = await createPublicGame((hostA = await refresh(hostA)), { totalQuestions: 10, rounds: 1 }, only);
    id = r.sessionId;
    code = r.code;
    created.push(id);
    await setPublicGames({ maxPlayers: 0 });
  });

  it("un altro account non può controllare la partita", async () => {
    await expectGiocoError(hostCommand(hostB, id, "pause"), "NOT_OWNER", 403);
    await expectGiocoError(hostCommand(hostB, id, "finish"), "NOT_OWNER", 403);
    await expectGiocoError(hostCommand(hostA, randomUUID(), "start"), "NOT_FOUND", 404);
  });

  it("solo i comandi previsti", async () => {
    await expectGiocoError(hostCommand(hostA, id, "skip_intro" as HostAction), "ACTION_NOT_ALLOWED");
  });

  it("INIZIA PARTITA solo con almeno un giocatore", async () => {
    await expectGiocoError(hostCommand(hostA, id, "start"), "NO_PLAYERS", 409);
  });

  it("giocatori massimi della partita libera", async () => {
    await joinSession({ code, nickname: "Primo" }, { ip: "10.9.0.1", deviceToken: null });
    await joinSession({ code, nickname: "Secondo" }, { ip: "10.9.0.2", deviceToken: null });
    const e = await joinSession({ code, nickname: "Terzo" }, { ip: "10.9.0.3", deviceToken: null }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PlayerError);
    expect((e as PlayerError).code).toBe("GAME_FULL");
  });

  it("giocatori ed espulsione: solo il proprietario", async () => {
    const status = await hostGameStatus(hostA, id);
    expect(status.autoplay).toBe(true);
    expect(status.players.map((p) => p.nickname)).toEqual(["Primo", "Secondo"]);
    await expectGiocoError(hostGameStatus(hostB, id), "NOT_FOUND", 404);
    const secondo = status.players.find((p) => p.nickname === "Secondo")!;
    await expectGiocoError(hostCommand(hostB, id, "kick", undefined, { participantId: secondo.id }), "NOT_OWNER", 403);
    await expectGiocoError(hostCommand(hostA, id, "kick"), "ACTION_NOT_ALLOWED");
    const kicked = await hostCommand(hostA, id, "kick", undefined, { participantId: secondo.id });
    expect(kicked.state.playerCount).toBe(1);
    expect((await hostGameStatus(hostA, id)).players.map((p) => p.nickname)).toEqual(["Primo"]);
  });

  it("scorrimento automatico o manuale", async () => {
    await expectGiocoError(hostCommand(hostB, id, "auto", undefined, { autoplay: false }), "NOT_OWNER", 403);
    await expectGiocoError(hostCommand(hostA, id, "auto"), "ACTION_NOT_ALLOWED");
    await hostCommand(hostA, id, "auto", undefined, { autoplay: false });
    expect((await hostGameStatus(hostA, id)).autoplay).toBe(false);
    await hostCommand(hostA, id, "auto", undefined, { autoplay: true });
    expect((await hostGameStatus(hostA, id)).autoplay).toBe(true);
  });

  it("inizia, avanti (solo se sicuro), pausa, riprendi, termina", async () => {
    await expectGiocoError(hostCommand(hostA, id, "next"), "ACTION_NOT_ALLOWED"); // in lobby si usa INIZIA PARTITA
    const started = await hostCommand(hostA, id, "start");
    expect(started.state.phase).toBe("INTRO");
    // da qui va avanti lo scorrimento automatico
    expect(started.state.auto?.nextAt).toBeTruthy();
    await expectGiocoError(hostCommand(hostA, id, "start"), "ACTION_NOT_ALLOWED");
    expect((await hostCommand(hostA, id, "pause")).state.phase).toBe("PAUSED");
    await expectGiocoError(hostCommand(hostA, id, "next"), "ACTION_NOT_ALLOWED"); // in pausa no
    expect((await hostCommand(hostA, id, "resume")).state.phase).toBe("INTRO");
    await expectGiocoError(hostCommand(hostB, id, "next"), "NOT_OWNER", 403);
    // "Avanti": salta l'intro, poi la presentazione del round, poi la lettura della domanda
    expect((await hostCommand(hostA, id, "next")).state.phase).toBe("ROUND_INTRO");
    expect((await hostCommand(hostA, id, "next")).state.phase).toBe("QUESTION_VISIBLE");
    const options = await hostCommand(hostA, id, "next");
    expect(options.state.phase).toBe("OPTIONS_VISIBLE");
    // risposte aperte: mai tagliare il tempo dei giocatori
    expect(Date.parse(options.state.question!.closesAt!)).toBeGreaterThan(Date.now() + 1000);
    await expectGiocoError(hostCommand(hostA, id, "next"), "ACTION_NOT_ALLOWED");
    expect((await hostCommand(hostA, id, "finish")).state.phase).toBe("FINISHED");
  });
});

describe("giocatori illimitati (predefinito)", () => {
  it("0 = nessun limite: la partita nasce senza tetto di giocatori", async () => {
    await setPublicGames({ maxPlayers: 0 });
    const r = await createPublicGame((hostA = await refresh(hostA)), { totalQuestions: 10, rounds: 1 }, only);
    created.push(r.sessionId);
    const d = await getSessionDetail(sql, r.sessionId);
    expect(d!.settings.maxPlayers ?? null).toBeNull();
    for (let i = 0; i < 25; i++) await joinSession({ code: r.code, nickname: `Folla${i}` }, { ip: `10.8.0.${i}`, deviceToken: null });
    expect((await buildPublicState(sql, r.sessionId))!.playerCount).toBe(25);
  });
});

describe("rivincita", () => {
  let hostC: HostUser;
  let oldId: string;
  let code: string;
  const tokens: Record<string, string> = {};
  const onlyC = { onlyTag: TAG2 };

  beforeAll(async () => {
    for (let i = 0; i < 26; i++) {
      await makeQuestion(`Domanda rivincita ${TAG2} n. ${i}?`, ["Uno", "Due", "Tre", "Quattro"], [i % 4], {
        category: CATS[i % CATS.length],
        difficulty: (i % 5) + 1,
        tags: ["test-automatico", TAG2],
      });
    }
    const c = await makeUser("host-c");
    await createHostProfile(sql, c.id, `Riv_${randomUUID().slice(0, 6)}`);
    hostC = await loadHostUser(sql, c.id, c.email);
    const r = await createPublicGame(hostC, { totalQuestions: 10, rounds: 2, mix: "facile" }, onlyC);
    oldId = r.sessionId;
    code = r.code;
    for (const [i, n] of ["Anna", "Bruno", "Carla"].entries()) {
      tokens[n] = (await joinSession({ code, nickname: n }, { ip: `10.7.0.${i}`, deviceToken: null })).participantToken;
    }
  });

  it("si propongono le stesse impostazioni di prima", async () => {
    expect(await previousOptions(sql, oldId)).toEqual({ totalQuestions: 10, rounds: 2, mix: "facile" });
  });

  it("solo il proprietario e solo a partita finita", async () => {
    await expectGiocoError(rematchPublicGame(hostA, oldId, null, onlyC), "NOT_OWNER", 403);
    await expectGiocoError(rematchPublicGame(hostC, oldId, null, onlyC), "ACTION_NOT_ALLOWED");
    await expectGiocoError(rematchPublicGame(hostC, randomUUID(), null, onlyC), "NOT_FOUND", 404);
  });

  it("stesso codice, giocatori dentro senza rientrare, domande nuove, vecchia archiviata", async () => {
    // Carla viene espulsa: non passa nella rivincita
    const carla = (await hostGameStatus(hostC, oldId)).players.find((p) => p.nickname === "Carla")!;
    await hostCommand(hostC, oldId, "kick", undefined, { participantId: carla.id });
    await hostCommand(hostC, oldId, "start");
    // le domande della partita "escono" (come durante il gioco): restano nello storico dell'host
    await sql`update session_questions set shown_at = now() where session_id = ${oldId} and not wheel_candidate`;
    await hostCommand(hostC, oldId, "finish");
    const oldQuestions = new Set((await sql<{ question_id: string }[]>`select question_id from session_questions where session_id = ${oldId} and not wheel_candidate`).map((r) => r.question_id));
    const used = (await refresh(hostC)).profile!.gamesCreated;

    const r = await rematchPublicGame((hostC = await refresh(hostC)), oldId, null, onlyC);
    expect(r.existing).toBe(false);
    expect(r.code).toBe(code);
    expect(r.carried).toBe(2);
    expect(r.lobbyOpen).toBe(true);
    // nuova partita: stesso codice, lobby aperta, stesse impostazioni
    const d = await getSessionDetail(sql, r.sessionId);
    expect(d).toMatchObject({ code, phase: "LOBBY", status: "live", hostUserId: hostC.userId });
    expect(d!.roundsDetail.map((x) => x.questions.length).reduce((a, b) => a + b, 0)).toBe(10);
    // nessuna domanda già vista
    const picked = (await sql<{ question_id: string }[]>`select question_id from session_questions where session_id = ${r.sessionId} and not wheel_candidate`).map((x) => x.question_id);
    expect(picked.filter((q) => oldQuestions.has(q))).toEqual([]);
    // vecchia partita: archiviata, codice d'archivio, punta alla rivincita (TV e telefoni la seguono)
    const [old] = await sql<{ code: string; status: string; next_session_id: string }[]>`select code, status, next_session_id from game_sessions where id = ${oldId}`;
    expect(old.code).not.toBe(code);
    expect(old.status).toBe("archived");
    expect(old.next_session_id).toBe(r.sessionId);
    expect((await buildPublicState(sql, oldId))!.rematch).toEqual({ sessionId: r.sessionId });
    expect((await buildPublicState(sql, r.sessionId))!.rematch).toBeNull();
    // giocatori: stesso nickname, punti a zero, lo stesso cookie del telefono funziona nella nuova
    const status = await hostGameStatus(hostC, r.sessionId);
    expect(status.players.map((p) => [p.nickname, p.points])).toEqual([
      ["Anna", 0],
      ["Bruno", 0],
    ]);
    const anna = await authenticatePlayer(sql, code, tokens.Anna);
    expect(anna).toMatchObject({ sessionId: r.sessionId, nickname: "Anna" });
    await expect(authenticatePlayer(sql, code, tokens.Carla)).rejects.toBeInstanceOf(PlayerError);
    // chi scansiona ora il QR entra nella rivincita
    const late = await joinSession({ code, nickname: "Dario" }, { ip: "10.7.0.9", deviceToken: null });
    expect(late.sessionId).toBe(r.sessionId);
    // quota: senza limite la rivincita non consuma partite
    expect((await refresh(hostC)).profile!.gamesCreated).toBe(used);
    // doppio clic / due schermi: sempre la stessa rivincita
    const again = await rematchPublicGame(hostC, oldId, null, onlyC);
    expect(again).toMatchObject({ sessionId: r.sessionId, existing: true, code });
    // una partita non finita non si "rivince"
    await expectGiocoError(rematchPublicGame(hostC, r.sessionId, null, onlyC), "ACTION_NOT_ALLOWED");
  });

  it("impostazioni cambiate al volo; con un limite la rivincita conta come partita", async () => {
    const [{ next }] = await sql<{ next: string }[]>`select next_session_id as next from game_sessions where id = ${oldId}`;
    await hostCommand(hostC, next, "finish");
    hostC = await refresh(hostC);
    const used = hostC.profile!.gamesCreated;
    await setPublicGames({ gamesPerAccount: used + 1 });
    const r = await rematchPublicGame(hostC, next, { totalQuestions: 10, rounds: 1, mix: "difficile" }, onlyC);
    await setPublicGames({ gamesPerAccount: 0 });
    expect(r.code).toBe(code);
    expect(await previousOptions(sql, r.sessionId)).toEqual({ totalQuestions: 10, rounds: 1, mix: "difficile" });
    expect((await refresh(hostC)).profile!.gamesCreated).toBe(used + 1);
    // tutti i giocatori della rivincita precedente (anche chi è entrato dopo) passano anche qui
    expect((await hostGameStatus(hostC, r.sessionId)).players.map((p) => p.nickname)).toEqual(["Anna", "Bruno", "Dario"]);
  });
});

describe("serate della regia non toccate", () => {
  it("le partite libere stanno in un elenco a parte e fuori dalle classifiche", async () => {
    const quick = await composeAndCreateSession(sql, { title: `Serata ${TAG}`, rounds: 1, totalQuestions: 3, reserves: 0 }, TEST_ACTOR, only);
    created.push(quick.sessionId!);
    const evenings = await listSessions({ includeArchived: true });
    const publicGames = await listSessions({ includeArchived: true, kind: "public" });
    expect(evenings.some((s) => s.id === quick.sessionId)).toBe(true);
    expect(evenings.some((s) => s.hostUserId !== null)).toBe(false);
    expect(publicGames.some((s) => s.id === created[0])).toBe(true);
    expect(publicGames.some((s) => s.id === quick.sessionId)).toBe(false);
    expect(await isPublicSession(quick.sessionId!)).toBe(false);
    const d = await getSessionDetail(sql, quick.sessionId!);
    expect(d).toMatchObject({ status: "draft", hostUserId: null });
    const month = new Date().toISOString().slice(0, 7);
    const lb = await aggregatedLeaderboard({ from: `${month}-01`, to: `${month}-28` });
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from leaderboards where session_id = any(${sql.array(created)}::uuid[])`;
    expect(n).toBeGreaterThan(0); // la partita libera terminata ha la sua classifica…
    expect(lb.standings.some((s) => s.nickname === "Primo" || s.nickname === "Secondo")).toBe(false); // …ma non entra in quella del mese
  });

  it("un account host non diventa admin", async () => {
    const [row] = await sql`select 1 from admin_users where user_id = ${hostA.userId}`;
    expect(row).toBeUndefined();
    expect((await refresh(hostA)).adminRole).toBeNull();
  });
});

describe("cancellazione dell'account (privacy)", () => {
  it("l'account host si elimina; partite e registri restano anonimi; i registri restano append-only", async () => {
    const [logged] = await sql<{ id: string }[]>`select id from admin_audit_logs where actor = ${hostB.userId} limit 1`;
    expect(logged).toBeTruthy();
    const del = await auth.auth.admin.deleteUser(hostB.userId);
    expect(del.error).toBeNull();
    const [p] = await sql`select 1 from host_profiles where user_id = ${hostB.userId}`;
    expect(p).toBeUndefined();
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from admin_audit_logs where actor = ${hostB.userId}`;
    expect(n).toBe(0);
    // azzerare il riferimento all'utente è l'unica modifica ammessa
    const e = await sql`update admin_audit_logs set action = 'manomesso' where id = ${logged.id}`.catch((x: unknown) => x);
    expect((e as { message?: string }).message).toMatch(/APPEND_ONLY/);
  });
});
