import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { GameError } from "@/lib/game-engine/types";
import { streamSafeState } from "@/lib/game-engine/stream-view";
import { setDisplayMode } from "@/lib/server/display-mode";
import { FALLBACK_GRACE_MS, fallbackTick } from "@/lib/server/fallback-tick";
import { createHostProfile, createPublicGame, hostCommand, loadHostUser, loadPublicGamesSettings, rematchPublicGame, type HostUser } from "@/lib/server/gioco-libero";
import { authorizeLiveViewer, liveToken } from "@/lib/server/live-view";
import { authenticatePlayer, isOnlineSession, joinSession, PlayerError } from "@/lib/server/players";
import { buildPublicState } from "@/lib/server/public-state";
import { makeQuestion } from "../support/fixtures";

/**
 * Partite ONLINE (display_mode "phone") contro il database locale:
 *  - si entra solo con il proprio account (in salotto basta il nickname, come sempre);
 *  - stesso account da un altro dispositivo = stesso partecipante (niente doppioni, punti salvi),
 *    e il primo dispositivo resta collegato; la rivincita porta con sé account e dispositivi;
 *  - chi era entrato col nickname prima del passaggio all'online resta dentro;
 *  - passo di riserva dei giocatori solo se il passo è in ritardo di almeno 6 s;
 *  - vista LIVE: stato senza codice, gettone che segue la rivincita.
 */
const sql = getSql();
const TAG = `online-${randomUUID().slice(0, 8)}`;
const only = { onlyTag: TAG };
const CATS = ["Storia", "Geografia", "Cinema", "Musica", "Sport", "Scienza"];
const users: string[] = [];
let previousSetting: { value: unknown } | undefined;

const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

async function makeUser(label: string): Promise<string> {
  const email = `${label}-${randomUUID().slice(0, 8)}@test.chenesai.local`;
  const r = await auth.auth.admin.createUser({ email, password: `Pw-${randomUUID()}`, email_confirm: true });
  if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
  users.push(r.data.user.id);
  return r.data.user.id;
}

async function expectPlayerError(p: Promise<unknown>, code: string) {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(PlayerError);
  expect((e as PlayerError).code).toBe(code);
}

let ip = 0;
const ctx = (userId: string | null, deviceToken: string | null = null) => ({ ip: `10.42.0.${++ip % 250}`, deviceToken, userId });

/** Partita nuova con un host nuovo (limite di 6 partite in 10 minuti per account). */
async function newGame(mode: "tv" | "phone"): Promise<{ sessionId: string; code: string; displayKey: string; host: HostUser }> {
  const h = await makeUser("host-online");
  await createHostProfile(sql, h, `Onl_${randomUUID().slice(0, 6)}`);
  const host = await loadHostUser(sql, h, null);
  const g = await createPublicGame(host, { totalQuestions: 10, rounds: 2, mix: "facile" }, only);
  if (mode === "phone") await setDisplayMode(g.sessionId, "phone");
  return { sessionId: g.sessionId, code: g.code, displayKey: g.displayKey, host };
}

beforeAll(async () => {
  [previousSetting] = await sql<{ value: unknown }[]>`select value from application_settings where key = 'publicGames'`;
  const current = await loadPublicGamesSettings(sql);
  await sql`
    insert into application_settings (key, value) values ('publicGames', ${sql.json({ ...current, enabled: true, gamesPerAccount: 0, maxPlayers: 20 })})
    on conflict (key) do update set value = excluded.value`;
  for (let i = 0; i < 60; i++) {
    await makeQuestion(`Domanda online ${TAG} n. ${i}?`, ["Uno", "Due", "Tre", "Quattro"], [i % 4], {
      category: CATS[i % CATS.length],
      difficulty: (i % 5) + 1,
      tags: ["test-automatico", TAG],
    });
  }
});

afterAll(async () => {
  await sql.begin(async (tx) => {
    await tx`select set_config('qz.allow_reset', 'on', true)`;
    await tx`select set_config('qz.allow_frozen_write', 'on', true)`;
    await tx`delete from game_sessions where host_user_id = any(${sql.array(users)}::uuid[])`;
  });
  await sql`delete from question_plays where host_user_id = any(${sql.array(users)}::uuid[])`.catch(() => undefined);
  await sql`delete from question_bank where ${TAG} = any(tags)`;
  if (previousSetting) await sql`update application_settings set value = ${sql.json(previousSetting.value as never)} where key = 'publicGames'`;
  else await sql`delete from application_settings where key = 'publicGames'`;
  for (const id of users) await auth.auth.admin.deleteUser(id);
  await sql.end();
});

describe("ingresso nelle partite online", () => {
  it("online = show su ogni dispositivo, escluse le serate di prova della regia", () => {
    expect(isOnlineSession({ display_mode: "phone", is_test: false })).toBe(true);
    expect(isOnlineSession({ display_mode: "phone", is_test: true })).toBe(false);
    expect(isOnlineSession({ display_mode: "tv", is_test: false })).toBe(false);
    expect(isOnlineSession({ display_mode: null, is_test: false })).toBe(false);
  });

  it("in salotto (TV) si entra ancora con il solo nickname", async () => {
    const g = await newGame("tv");
    const r = await joinSession({ code: g.code, nickname: "Divano" }, ctx(null));
    expect(r.rejoined).toBe(false);
    const [p] = await sql<{ user_id: string | null }[]>`select user_id from participants where id = ${r.participantId}`;
    // in salotto l'account non si registra nemmeno se c'è
    const u = await makeUser("salotto");
    const r2 = await joinSession({ code: g.code, nickname: "Poltrona" }, ctx(u));
    const [p2] = await sql<{ user_id: string | null }[]>`select user_id from participants where id = ${r2.participantId}`;
    expect(p.user_id).toBeNull();
    expect(p2.user_id).toBeNull();
  });

  it("online senza account: ACCOUNT_REQUIRED (401)", async () => {
    const g = await newGame("phone");
    await expectPlayerError(joinSession({ code: g.code, nickname: "Anonimo" }, ctx(null)), "ACCOUNT_REQUIRED");
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from participants where session_id = ${g.sessionId}`;
    expect(n).toBe(0);
  });

  it("stesso account da un altro dispositivo = stesso partecipante (e il primo resta collegato)", async () => {
    const g = await newGame("phone");
    const u = await makeUser("pc-e-telefono");
    const pc = await joinSession({ code: g.code, nickname: "Doppio" }, ctx(u));
    expect(pc.rejoined).toBe(false);
    // dal telefono: altro dispositivo (niente cookie), nickname diverso o vuoto: si ritrova lo stesso giocatore
    const phone = await joinSession({ code: g.code, nickname: "" }, ctx(u));
    expect(phone.rejoined).toBe(true);
    expect(phone.participantId).toBe(pc.participantId);
    expect(phone.nickname).toBe("Doppio");
    expect(phone.participantToken).not.toBe(pc.participantToken);
    const a = await authenticatePlayer(sql, g.code, pc.participantToken);
    const b = await authenticatePlayer(sql, g.code, phone.participantToken);
    expect(a.participantId).toBe(pc.participantId);
    expect(b.participantId).toBe(pc.participantId);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from participants where session_id = ${g.sessionId}`;
    expect(n).toBe(1);
    // un altro account non può prendere lo stesso nickname
    const altro = await makeUser("altro");
    await expectPlayerError(joinSession({ code: g.code, nickname: "doppio" }, ctx(altro)), "NICKNAME_TAKEN");
  });

  it("i punti restano: rientro con l'account dopo aver risposto", async () => {
    const g = await newGame("phone");
    const u = await makeUser("punti");
    const first = await joinSession({ code: g.code, nickname: "Puntiglioso" }, ctx(u));
    await sql`update score_totals set points = 1234 where participant_id = ${first.participantId}`;
    const again = await joinSession({ code: g.code, nickname: "" }, ctx(u));
    expect(again.participantId).toBe(first.participantId);
    const [t] = await sql<{ points: number }[]>`select points from score_totals where participant_id = ${again.participantId}`;
    expect(t.points).toBe(1234);
  });

  it("espulso: l'account non rientra da nessun dispositivo", async () => {
    const g = await newGame("phone");
    const u = await makeUser("espulso");
    const r = await joinSession({ code: g.code, nickname: "Fuori" }, ctx(u));
    await hostCommand(g.host, g.sessionId, "kick", undefined, { participantId: r.participantId });
    await expectPlayerError(joinSession({ code: g.code, nickname: "" }, ctx(u)), "KICKED");
  });

  it("partita passata da TV a online: chi era dentro col nickname resta, i nuovi servono l'account", async () => {
    const g = await newGame("tv");
    const nick = await joinSession({ code: g.code, nickname: "Pioniere" }, ctx(null));
    expect(nick.deviceToken).toBeTruthy();
    await setDisplayMode(g.sessionId, "phone");
    // il suo cookie vale ancora
    expect((await authenticatePlayer(sql, g.code, nick.participantToken)).participantId).toBe(nick.participantId);
    // rientra dallo stesso dispositivo (identità del dispositivo) anche senza account
    const back = await joinSession({ code: g.code, nickname: "" }, ctx(null, nick.deviceToken));
    expect(back.rejoined).toBe(true);
    expect(back.participantId).toBe(nick.participantId);
    // un nuovo arrivato senza account no
    await expectPlayerError(joinSession({ code: g.code, nickname: "Ritardatario" }, ctx(null)), "ACCOUNT_REQUIRED");
    // se fa l'accesso dallo stesso dispositivo, il suo posto si lega all'account (poi lo ritrova ovunque)
    const u = await makeUser("pioniere");
    const claimed = await joinSession({ code: g.code, nickname: "" }, ctx(u, nick.deviceToken));
    expect(claimed.participantId).toBe(nick.participantId);
    const fromPhone = await joinSession({ code: g.code, nickname: "" }, ctx(u));
    expect(fromPhone.participantId).toBe(nick.participantId);
  });
});

describe("passo di riserva dei giocatori (host sparito)", () => {
  it("solo nelle partite online e solo se il passo è in ritardo di almeno 6 s", async () => {
    expect(FALLBACK_GRACE_MS).toBeGreaterThanOrEqual(6000);
    const g = await newGame("phone");
    const u = await makeUser("riserva");
    await joinSession({ code: g.code, nickname: "Riserva" }, ctx(u));
    await hostCommand(g.host, g.sessionId, "start");
    const before = await buildPublicState(sql, g.sessionId);
    expect(before?.phase).toBe("INTRO");
    expect(before?.auto?.nextAt).toBeTruthy();
    // in ritardo di 3 s: l'host (che aspetta la fine delle voci) ha ancora la precedenza
    await sql`update game_state set auto_next_at = clock_timestamp() - interval '3 seconds' where session_id = ${g.sessionId}`;
    const early = await fallbackTick(g.sessionId);
    expect(early.advanced).toBe(false);
    expect((await buildPublicState(sql, g.sessionId))?.version).toBe(before!.version);
    // in ritardo di 10 s: il passo si esegue una volta sola anche con tanti giocatori insieme
    await sql`update game_state set auto_next_at = clock_timestamp() - interval '10 seconds' where session_id = ${g.sessionId}`;
    const all = await Promise.all([fallbackTick(g.sessionId), fallbackTick(g.sessionId), fallbackTick(g.sessionId)]);
    expect(all.filter((r) => r.advanced)).toHaveLength(1);
    const after = await buildPublicState(sql, g.sessionId);
    expect(after?.phase).toBe("ROUND_INTRO");
    expect(after!.version).toBe(before!.version + 1);
  });

  it("in salotto (TV) il passo lo guida solo lo schermo dell'host", async () => {
    const g = await newGame("tv");
    const e = await fallbackTick(g.sessionId).then(
      () => null,
      (err: unknown) => err,
    );
    expect(e).toBeInstanceOf(GameError);
    expect((e as GameError).code).toBe("FORBIDDEN");
  });
});

describe("vista per la LIVE", () => {
  it("lo stato della vista non contiene codice, QR, link né chiave dello schermo", async () => {
    const g = await newGame("phone");
    const u = await makeUser("streamer");
    await joinSession({ code: g.code, nickname: "Streamer" }, ctx(u));
    const state = await buildPublicState(sql, g.sessionId);
    const safe = streamSafeState(state!);
    const json = JSON.stringify(safe);
    expect(safe.code).toBe("");
    expect(safe.auto).toBeNull();
    expect(json).not.toContain(g.code);
    expect(json).not.toContain(g.displayKey);
    expect(json).not.toContain(`/play/`);
    // lo show resta: nomi e giocatori
    expect(safe.recentPlayers).toContain("Streamer");
  });

  it("gettone per la Sorgente browser: firmato, solo per quella partita e per le sue rivincite", async () => {
    const g = await newGame("phone");
    const u = await makeUser("obs");
    const p = await joinSession({ code: g.code, nickname: "Obs" }, ctx(u));
    const t = await liveToken(sql, g.sessionId, p.participantId);
    expect(t).not.toContain(g.code);
    const v = await authorizeLiveViewer(sql, g.sessionId, t);
    expect(v.kind).toBe("token");
    // gettone manomesso: non vale (si passa ai cookie, che qui fuori da una richiesta non ci sono)
    const forged = t.slice(0, -4) + (t.endsWith("AAAA") ? "BBBB" : "AAAA");
    await expect(authorizeLiveViewer(sql, g.sessionId, forged)).rejects.toThrow();
    // un'altra partita: non vale
    const other = await newGame("phone");
    await expect(authorizeLiveViewer(sql, other.sessionId, t)).rejects.toThrow();

    // rivincita: stesso codice, account e dispositivi passano alla nuova partita, il gettone la segue
    const phone = await joinSession({ code: g.code, nickname: "" }, ctx(u));
    await hostCommand(g.host, g.sessionId, "finish");
    const rem = await rematchPublicGame(g.host, g.sessionId, null, only);
    expect(rem.code).toBe(g.code);
    expect((await authorizeLiveViewer(sql, rem.sessionId, t)).kind).toBe("token");
    const a = await authenticatePlayer(sql, g.code, p.participantToken);
    const b = await authenticatePlayer(sql, g.code, phone.participantToken);
    expect(a.sessionId).toBe(rem.sessionId);
    expect(b.participantId).toBe(a.participantId);
    const [np] = await sql<{ user_id: string | null }[]>`select user_id from participants where id = ${a.participantId}`;
    expect(np.user_id).toBe(u);
    // nella rivincita lo stesso account rientra nello stesso posto
    const again = await joinSession({ code: g.code, nickname: "" }, ctx(u));
    expect(again.participantId).toBe(a.participantId);
  });
});
