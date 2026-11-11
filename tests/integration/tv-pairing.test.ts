import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { closeStaleFreeGames, findStaleFreeGames } from "@/lib/server/auto-close";
import { GiocoError } from "@/lib/server/gioco-errors";
import { createHostProfile, createPublicGame, hostCommand, hostGamesFresh, isOpenGame, loadHostUser, loadPublicGamesSettings, type HostUser } from "@/lib/server/gioco-libero";
import { joinSession } from "@/lib/server/players";
import { buildPublicState } from "@/lib/server/public-state";
import {
  claimPairing,
  createCastPairing,
  createPairing,
  followRematch,
  PAIRING_LIMITS,
  pollPairing,
  remoteStatus,
  setRemotePrefs,
  tvHeartbeat,
} from "@/lib/server/tv-pairing";
import { buildPublishedSession, cleanupSession, cmd, makeQuestion } from "../support/fixtures";

/**
 * Telefono → televisore: abbinamento con codice di 4 cifre (crea, abbina, consegna una volta sola,
 * scadenza, solo il proprietario, limiti di frequenza), telecomando dell'audio, rivincita sul TV
 * abbinato e chiusura automatica delle partite libere abbandonate da 24 ore.
 */
const sql = getSql();
const TAG = `tv-${randomUUID().slice(0, 8)}`;
const only = { onlyTag: TAG };
const IP = `test-${randomUUID().slice(0, 8)}`;
const created: string[] = [];
const users: string[] = [];
let previousSetting: { value: unknown } | undefined;
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

async function makeHost(label: string): Promise<HostUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@test.chenesai.local`;
  const r = await auth.auth.admin.createUser({ email, password: `Pw-${randomUUID()}`, email_confirm: true });
  if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
  users.push(r.data.user.id);
  await createHostProfile(sql, r.data.user.id, `${label}_${randomUUID().slice(0, 6)}`);
  return { ...(await loadHostUser(sql, r.data.user.id, email)), ip: IP };
}

async function expectGiocoError(p: Promise<unknown>, code: string) {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(GiocoError);
  expect((e as GiocoError).code).toBe(code);
}

async function newGame(host: HostUser): Promise<string> {
  const r = await createPublicGame(host, { totalQuestions: 10, rounds: 1, mix: "bilanciata" }, only);
  created.push(r.sessionId);
  return r.sessionId;
}

/** Fa sembrare la partita ferma da `hours` ore (creazione, stato, telefoni, TV). */
async function ageGame(sessionId: string, hours: number) {
  await sql.begin(async (tx) => {
    await tx`select set_config('qz.allow_frozen_write', 'on', true)`;
    await tx`update game_sessions set created_at = now() - make_interval(hours => ${hours}) where id = ${sessionId}`;
    await tx`update game_state set updated_at = now() - make_interval(hours => ${hours}) where session_id = ${sessionId}`;
    await tx`update participants set last_seen_at = now() - make_interval(hours => ${hours}) where session_id = ${sessionId}`;
    await tx`update tv_remote set tv_seen_at = now() - make_interval(hours => ${hours}) where session_id = ${sessionId}`;
  });
}

let host: HostUser;
let other: HostUser;
let game: string;

beforeAll(async () => {
  [previousSetting] = await sql<{ value: unknown }[]>`select value from application_settings where key = 'publicGames'`;
  const current = await loadPublicGamesSettings(sql);
  await sql`
    insert into application_settings (key, value) values ('publicGames', ${sql.json({ ...current, enabled: true, gamesPerAccount: 0 })})
    on conflict (key) do update set value = excluded.value`;
  for (let i = 0; i < 12; i++) {
    await makeQuestion(`Domanda TV ${TAG} n. ${i}?`, ["Uno", "Due", "Tre", "Quattro"], [i % 4], { tags: ["test-automatico", TAG], difficulty: (i % 5) + 1 });
  }
  host = await makeHost("tvhost");
  other = await makeHost("tvaltro");
  game = await newGame(host);
});

afterAll(async () => {
  await sql`delete from tv_pairings where created_ip = ${IP} or claimed_by = any(${sql.array(users)}::uuid[])`;
  for (const id of created) await cleanupSession(id);
  await sql`delete from question_plays where host_user_id = any(${sql.array(users)}::uuid[])`;
  await sql.begin(async (tx) => {
    await tx`select set_config('qz.allow_reset', 'on', true)`;
    await tx`select set_config('qz.allow_frozen_write', 'on', true)`;
    await tx`delete from game_sessions where host_user_id = any(${sql.array(users)}::uuid[])`;
  });
  await sql`delete from question_bank where ${TAG} = any(tags)`;
  if (previousSetting) await sql`update application_settings set value = ${sql.json(previousSetting.value as never)} where key = 'publicGames'`;
  for (const id of users) await auth.auth.admin.deleteUser(id);
  await sql.end();
});

describe("abbinamento del televisore", () => {
  it("il TV riceve un codice di 4 cifre e aspetta", async () => {
    const p = await createPairing(IP);
    expect(p.code).toMatch(/^[0-9]{4}$/);
    expect(p.token.length).toBeGreaterThan(20);
    expect(Date.parse(p.expiresAt) - Date.now()).toBeGreaterThan(9 * 60_000);
    expect(await pollPairing(p.pairingId, p.token)).toEqual({ status: "waiting", code: p.code, expiresAt: p.expiresAt });
    // il gettone è segreto: senza quello giusto l'abbinamento non esiste
    await expectGiocoError(pollPairing(p.pairingId, "sbagliato"), "PAIRING_INVALID");
    // nel database c'è solo l'hash
    const [row] = await sql<{ token_hash: string }[]>`select token_hash from tv_pairings where id = ${p.pairingId}`;
    expect(row.token_hash).not.toContain(p.token);
  });

  it("l'host scrive il codice: il TV riceve partita e chiave UNA volta sola", async () => {
    const p = await createPairing(IP);
    expect(await claimPairing(host, p.code, game)).toEqual({ sessionId: game });
    const [{ display_key }] = await sql<{ display_key: string }[]>`select display_key from game_sessions where id = ${game}`;
    expect(await pollPairing(p.pairingId, p.token)).toEqual({ status: "paired", sessionId: game, displayKey: display_key });
    // monouso: la seconda richiesta non riceve più la chiave
    expect(await pollPairing(p.pairingId, p.token)).toEqual({ status: "used" });
    // e il codice non si può riusare
    await expectGiocoError(claimPairing(host, p.code, game), "PAIRING_INVALID");
  });

  it("codice scaduto: non si abbina e il TV lo sa", async () => {
    const p = await createPairing(IP);
    await sql`update tv_pairings set expires_at = now() - interval '1 second' where id = ${p.pairingId}`;
    await expectGiocoError(claimPairing(host, p.code, game), "PAIRING_INVALID");
    expect(await pollPairing(p.pairingId, p.token)).toEqual({ status: "expired" });
  });

  it("solo il proprietario della partita può abbinarla", async () => {
    const p = await createPairing(IP);
    await expectGiocoError(claimPairing(other, p.code, game), "NOT_OWNER");
    // il codice resta valido per il vero host
    expect((await pollPairing(p.pairingId, p.token)).status).toBe("waiting");
    await expectGiocoError(claimPairing(host, "12a4", game), "PAIRING_INVALID");
  });

  it("limiti di frequenza: tentativi per account e codici per rete", async () => {
    const brute = await makeHost("tvbrute");
    const g = await newGame(brute);
    for (let i = 0; i < PAIRING_LIMITS.claimPerUser.limit; i++) {
      await expectGiocoError(claimPairing({ ...brute, ip: null }, "abcd", g), "PAIRING_INVALID");
    }
    await expectGiocoError(claimPairing({ ...brute, ip: null }, "0000", g), "RATE_LIMITED");

    const ip = `${IP}-rl`;
    try {
      for (let i = 0; i < PAIRING_LIMITS.createPerIp.limit; i++) await createPairing(ip);
      await expectGiocoError(createPairing(ip), "RATE_LIMITED");
    } finally {
      await sql`delete from tv_pairings where created_ip = ${ip}`;
    }
  });

  it("«Trasmetti»: abbinamento già fatto, consegnato una volta sola, solo per il proprietario", async () => {
    await expectGiocoError(createCastPairing(other, game), "NOT_OWNER");
    const c = await createCastPairing(host, game);
    expect((await pollPairing(c.pairingId, c.token)).status).toBe("paired");
    expect((await pollPairing(c.pairingId, c.token)).status).toBe("used");
  });
});

describe("telecomando del TV", () => {
  it("presenza del TV e audio scelto dal telefono", async () => {
    expect((await remoteStatus(host, game)).tv).toBeNull();
    expect(await tvHeartbeat(game, false)).toEqual({ prefs: {}, rev: 0 });
    const st = await remoteStatus(host, game);
    expect(st.tv).toMatchObject({ online: true, audioOn: false });
    const r = await setRemotePrefs(host, game, { masterVolume: 0.4, muted: true });
    expect(r).toEqual({ prefs: { masterVolume: 0.4, muted: true }, rev: 1 });
    const r2 = await setRemotePrefs(host, game, { muted: false });
    expect(r2).toEqual({ prefs: { masterVolume: 0.4, muted: false }, rev: 2 });
    // il TV le riceve alla prossima presenza
    expect(await tvHeartbeat(game, true)).toEqual({ prefs: { masterVolume: 0.4, muted: false }, rev: 2 });
    expect((await remoteStatus(host, game)).tv?.audioOn).toBe(true);
    await expectGiocoError(setRemotePrefs(host, game, { masterVolume: 3 }), "ACTION_NOT_ALLOWED");
    await expectGiocoError(setRemotePrefs(other, game, { muted: true }), "NOT_FOUND");
    await expectGiocoError(remoteStatus(other, game), "NOT_FOUND");
  });

  it("rivincita: il TV abbinato passa alla nuova partita con la chiave della vecchia", async () => {
    const g = await newGame(host);
    const [{ display_key }] = await sql<{ display_key: string }[]>`select display_key from game_sessions where id = ${g}`;
    expect(await followRematch(g, display_key)).toBeNull();
    await expectGiocoError(followRematch(g, "chiave-sbagliata"), "NOT_OWNER");
    await sql`update game_sessions set next_session_id = ${game} where id = ${g}`;
    const [{ display_key: k2 }] = await sql<{ display_key: string }[]>`select display_key from game_sessions where id = ${game}`;
    expect(await followRematch(g, display_key)).toEqual({ sessionId: game, displayKey: k2 });
    await sql`update game_sessions set next_session_id = null where id = ${g}`;
  });
});

describe("chiusura automatica dopo 24 ore", () => {
  it("chiude la partita libera abbandonata, non quella recente né le serate della regia", async () => {
    const stale = await newGame(host);
    const fresh = await newGame(host);
    // un telefono era entrato nella partita abbandonata
    const [s] = await sql<{ code: string }[]>`select code from game_sessions where id = ${stale}`;
    await joinSession({ code: s.code, nickname: "Vecchio", recoveryCode: null, slot: null }, { ip: null, deviceToken: null });
    await ageGame(stale, 25);
    // serata della regia ferma da giorni: mai toccata
    const admin = await buildPublishedSession({ isTest: false });
    created.push(admin.sessionId);
    await cmd(admin.sessionId, "OPEN_LOBBY");
    await ageGame(admin.sessionId, 72);

    const found = (await findStaleFreeGames(sql)).map((g) => g.id);
    expect(found).toContain(stale);
    expect(found).not.toContain(fresh);
    expect(found).not.toContain(admin.sessionId);

    const r = await closeStaleFreeGames({ userId: host.userId });
    expect(r.closed).toEqual([stale]);
    expect((await buildPublicState(sql, stale))?.phase).toBe("FINISHED");
    expect((await buildPublicState(sql, fresh))?.phase).toBe("LOBBY");
    expect((await buildPublicState(sql, admin.sessionId))?.phase).toBe("LOBBY");
    // idempotente: già chiusa, non si ripete
    expect((await closeStaleFreeGames({ sessionId: stale })).closed).toEqual([]);
    // la lista dell'host la mostra chiusa; quella recente resta aperta
    const list = await hostGamesFresh(host.userId, 20);
    expect(isOpenGame(list.find((g) => g.id === stale)!)).toBe(false);
    expect(isOpenGame(list.find((g) => g.id === fresh)!)).toBe(true);
  });

  it("una partita in corso con attività recente resta aperta anche se creata da giorni", async () => {
    const g = await newGame(host);
    await ageGame(g, 48);
    await sql`update game_state set updated_at = now() - interval '2 hours' where session_id = ${g}`;
    expect((await closeStaleFreeGames({ sessionId: g })).closed).toEqual([]);
    await hostCommand(host, g, "finish");
  });
});
