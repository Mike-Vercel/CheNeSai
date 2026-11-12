import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { CATEGORY_HINTS } from "@/lib/psyco/hints";
import type { PsycoAction, PsycoPublicState, PsycoSettings, PsycoView } from "@/lib/psyco/types";
import { runAction, type PsycoActor } from "@/lib/server/psyco/engine";
import { PsycoError } from "@/lib/server/psyco/errors";
import { createRoom, getDisplayKey, getDisplayState, getRoomView, joinRoom, listMyRooms, runScreenAction, screenControl, type PsycoUser } from "@/lib/server/psyco/rooms";

/**
 * PSYCO – «Schermo + telefoni» da PC e «CHIAMA L'INVESTIGATORE», contro il database locale.
 *  - la chiamata: solo lo PSYCO, solo durante la manche giocata, limite per manche, idempotente,
 *    livelli 1 → 3, indizio SOLO nella vista privata dello PSYCO (mai nello stato pubblico, mai a chi
 *    conosce la regola, mai allo schermo), registro in psyco_calls;
 *  - regole libere: indizio del gruppo alla prima chiamata, poi quelli della categoria;
 *  - lo schermo del PC: comandi solo per l'host, solo quelli che non rivelano nulla, risposta pubblica.
 */
const sql = getSql();
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const users: string[] = [];
const rooms: string[] = [];

async function makeUser(label: string): Promise<PsycoUser> {
  const email = `psyco-aiuto-${label}-${randomUUID().slice(0, 8)}@test.chenesai.local`;
  const r = await auth.auth.admin.createUser({ email, password: `Pw-${randomUUID()}`, email_confirm: true });
  if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
  users.push(r.data.user.id);
  return { userId: r.data.user.id, ip: null, username: label };
}

const actor = (u: PsycoUser, as?: string): PsycoActor => ({ userId: u.userId, ip: null, asParticipantId: as ?? null });
const act = (roomId: string, u: PsycoUser, a: PsycoAction, as?: string) => runAction(roomId, actor(u, as), a);
const view = (roomId: string, u: PsycoUser, as?: string): Promise<PsycoView> => getRoomView(u, roomId, as ?? null);

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof PsycoError && e.code === code);
}

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

function assertNoSecret(state: unknown, secrets: string[]) {
  const json = JSON.stringify(state);
  for (const s of secrets) if (s) expect(json.includes(s), `segreto: ${s}`).toBe(false);
}

/** salta il conto alla rovescia di 3,5 s */
const skipCountdown = (roomId: string) => sql`update psyco_rounds set started_at = now() - interval '2 seconds' where id = (select current_round_id from psyco_rooms where id = ${roomId})`;

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

const SETTINGS: PsycoSettings = { timerMs: 600_000, ruleMode: "auto", psycoPick: "auto", calls: 2 };

describe("PSYCO – schermo + telefoni (PC come schermo pubblico) e chiamata all'Investigatore (regola d'archivio)", () => {
  let roomId: string;
  let code: string;
  let key: string;
  const all = () => [host, p2, p3, p4];
  let psyco: PsycoUser;
  let knowers: PsycoUser[];
  let hints: string[];
  let ruleText: string;

  it("il PC crea la stanza come SCHERMO: l'host gioca dal telefono, lo schermo non è un partecipante", async () => {
    const r = await createRoom(host, { mode: "personal", settings: SETTINGS, hostNickname: "Sara", screen: true });
    roomId = r.roomId;
    code = r.code;
    rooms.push(roomId);
    key = await getDisplayKey(host, roomId);
    const s = await getDisplayState(key);
    expect(s.screen).toBe(true);
    expect(s.participants.map((p) => p.nickname)).toEqual(["Sara"]);
    // chi guarda lo schermo: l'host vede i comandi, gli altri (o senza account) no
    expect(await screenControl(host, key)).toEqual({ host: true, screenMode: true });
    expect((await screenControl(p2, key)).host).toBe(false);
    expect((await screenControl(null, key)).host).toBe(false);
    // il telefono dell'host (stesso account) ritrova la stanza da host, col suo posto
    await joinRoom(host, code, "Sara");
    const hv = await view(roomId, host);
    expect(hv.view.isHost).toBe(true);
    expect(hv.view.me?.nickname).toBe("Sara");
    const mine = (await listMyRooms(host.userId)).find((x) => x.roomId === roomId)!;
    expect(mine).toMatchObject({ screen: true, isHost: true });
    await joinRoom(p2, code, "Mike");
    await joinRoom(p3, code, "Luca");
    await joinRoom(p4, code, "Giulia");
  });

  it("dallo schermo: solo l'host, solo comandi che non rivelano nulla, risposta SOLO pubblica", async () => {
    await expectCode(runScreenAction(p2, key, { action: "start_game" }), "FORBIDDEN");
    await expectCode(runScreenAction(host, key, { action: "vote", ballot: "x", choice: "yes" }), "FORBIDDEN");
    await expectCode(runScreenAction(host, key, { action: "guess" }), "FORBIDDEN");
    await expectCode(runScreenAction(host, key, { action: "close_vote" }), "FORBIDDEN");
    await expectCode(runScreenAction(host, "chiave-sbagliata-ma-lunga-abbastanza-123", { action: "start_game" }), "NOT_FOUND");
    // psycoId arrivato dal client: ignorato (lo schermo non sceglie lo PSYCO)
    const s = await runScreenAction(host, key, { action: "start_game", psycoId: randomUUID() });
    expect(s.phase).toBe("ROLE_REVEAL");
    // risposta = stato pubblico: niente vista privata, niente ruolo, nemmeno chi è lo PSYCO
    expect(Object.keys(s)).not.toContain("view");
    expect(s.round?.psycoId).toBeNull();
    expect(JSON.stringify(s)).not.toMatch(/"role"/);
    expect(s.round?.calls).toEqual({ max: 2, used: 0, lastAt: null });
  });

  it("ruoli, regola d'archivio scelta, la manche parte dallo schermo", async () => {
    const views = await Promise.all(all().map((u) => view(roomId, u)));
    psyco = all()[views.findIndex((v) => v.view.role === "psyco")];
    knowers = all().filter((u) => u !== psyco);
    for (const u of all()) await act(roomId, u, { action: "seen" });
    let s = (await view(roomId, host)).state;
    await voteAll(roomId, host, knowers, s.round!.vote!.ballot, "facile");
    s = (await view(roomId, host)).state;
    expect(s.phase).toBe("RULE_VOTE");
    await voteAll(roomId, host, knowers, s.round!.vote!.ballot, "yes");
    s = (await view(roomId, host)).state;
    expect(s.phase).toBe("RULE_CONFIRMED");
    const [round] = await sql<{ rule_id: string; rule_text: string; calls_max: number }[]>`
      select rule_id, rule_text, calls_max from psyco_rounds where id = (select current_round_id from psyco_rooms where id = ${roomId})`;
    expect(round.calls_max).toBe(2);
    ruleText = round.rule_text;
    const [rule] = await sql<{ hint_1: string; hint_2: string; hint_3: string }[]>`select hint_1, hint_2, hint_3 from psyco_rules where id = ${round.rule_id}`;
    hints = [rule.hint_1, rule.hint_2, rule.hint_3];
    expect(hints.every((h) => h && h.length > 10)).toBe(true);
    // prima del via: niente chiamate
    await expectCode(act(roomId, psyco, { action: "call_investigator", requestId: randomUUID() }), "WRONG_PHASE");
    s = await runScreenAction(host, key, { action: "start_round" });
    expect(s.phase).toBe("PLAYING");
    // ancora nel conto alla rovescia
    await expectCode(act(roomId, psyco, { action: "call_investigator", requestId: randomUUID() }), "WRONG_PHASE");
    await skipCountdown(roomId);
  });

  it("chiama solo lo PSYCO; indizio di livello 1 SOLO nella sua vista privata; ripetere la stessa chiamata non ne consuma due", async () => {
    await expectCode(act(roomId, knowers[0], { action: "call_investigator", requestId: randomUUID() }), "FORBIDDEN");
    await expectCode(act(roomId, stranger, { action: "call_investigator", requestId: randomUUID() }), "NOT_MEMBER");
    const req = randomUUID();
    const r = await act(roomId, psyco, { action: "call_investigator", requestId: req });
    expect(r.state!.round!.calls.used).toBe(1);
    expect(r.state!.round!.calls.lastAt).not.toBeNull();
    expect(r.state!.event).toMatchObject({ kind: "investigator_call", data: { no: 1, max: 2 } });
    // pubblico (telefoni, TV, realtime): solo il numero
    assertNoSecret(r.state, hints);
    assertNoSecret(await getDisplayState(key), hints);
    // lo PSYCO legge il messaggio
    const pv = await view(roomId, psyco);
    expect(pv.view.investigator?.messages).toEqual([{ no: 1, level: 1, text: hints[0], at: expect.any(String) }]);
    expect(pv.view.secret).toBeNull();
    // chi conosce la regola non riceve i messaggi (e nemmeno l'host che gioca, se non è lo PSYCO)
    for (const k of knowers) {
      const kv = await view(roomId, k);
      expect(kv.view.investigator).toBeNull();
      assertNoSecret(kv, hints);
    }
    // stessa chiamata ripetuta (rete ballerina): nessun consumo in più
    const again = await act(roomId, psyco, { action: "call_investigator", requestId: req });
    expect(again.changed).toBe(false);
    expect((await view(roomId, psyco)).state.round!.calls.used).toBe(1);
  });

  it("in pausa niente chiamate; la seconda dà il livello 2; poi il limite", async () => {
    await act(roomId, host, { action: "pause" });
    await expectCode(act(roomId, psyco, { action: "call_investigator", requestId: randomUUID() }), "WRONG_PHASE");
    await runScreenAction(host, key, { action: "resume" });
    await act(roomId, psyco, { action: "call_investigator", requestId: randomUUID() });
    const pv = await view(roomId, psyco);
    expect(pv.view.investigator?.messages.map((m) => [m.no, m.level, m.text])).toEqual([
      [1, 1, hints[0]],
      [2, 2, hints[1]],
    ]);
    await expectCode(act(roomId, psyco, { action: "call_investigator", requestId: randomUUID() }), "NO_CALLS_LEFT");
    const calls = await sql<{ call_no: number; level: number; hint_source: string }[]>`
      select call_no, level, hint_source from psyco_calls where round_id = (select current_round_id from psyco_rooms where id = ${roomId}) order by call_no`;
    expect(calls).toEqual([
      { call_no: 1, level: 1, hint_source: "rule" },
      { call_no: 2, level: 2, hint_source: "rule" },
    ]);
    // durante la verifica niente chiamate (la chiamata non si sovrappone a «HO CAPITO»)
    await act(roomId, psyco, { action: "guess" });
    await expectCode(act(roomId, psyco, { action: "call_investigator", requestId: randomUUID() }), "WRONG_PHASE");
    // a fine manche: la regola diventa pubblica, gli indizi MAI
    await act(roomId, host, { action: "end_round" });
    const end = await getDisplayState(key);
    expect(end.round?.revealedRule?.text).toBe(ruleText);
    assertNoSecret(end, hints);
    // lo PSYCO può ancora rileggere i suoi messaggi
    expect((await view(roomId, psyco)).view.investigator?.messages).toHaveLength(2);
  });

  it("nuova manche dallo schermo: chiamate di nuovo disponibili; con 0 l'Investigatore non risponde", async () => {
    await act(roomId, host, { action: "update_settings", settings: { ...SETTINGS, calls: 0 } });
    const s = await runScreenAction(host, key, { action: "next_round" });
    expect(s.phase).toBe("ROLE_REVEAL");
    expect(s.round?.calls).toEqual({ max: 0, used: 0, lastAt: null });
    const views = await Promise.all(all().map((u) => view(roomId, u)));
    const ps = all()[views.findIndex((v) => v.view.role === "psyco")];
    await act(roomId, host, { action: "end_round" });
    await expectCode(act(roomId, ps, { action: "call_investigator", requestId: randomUUID() }), "WRONG_PHASE");
  });
});

describe("PSYCO – chiamata con la regola LIBERA, sul dispositivo condiviso", () => {
  let roomId: string;
  let ids: Record<string, string>;
  let psycoId: string;
  const HINT = "Guarda bene le mani di tutti";

  it("la proposta vincente porta con sé categoria e indizio (segreti)", async () => {
    const r = await createRoom(host, { mode: "shared", settings: { ...SETTINGS, ruleMode: "free", calls: 3 }, nicknames: ["Sara", "Mike", "Luca", "Giulia"] });
    roomId = r.roomId;
    rooms.push(roomId);
    let s = (await view(roomId, host)).state;
    ids = Object.fromEntries(s.participants.map((p) => [p.nickname, p.id]));
    await act(roomId, host, { action: "start_game" });
    for (const id of Object.values(ids)) await act(roomId, host, { action: "seen" }, id);
    s = (await view(roomId, host)).state;
    psycoId = s.round!.psycoId!;
    const knowers = Object.values(ids).filter((id) => id !== psycoId);
    // indizio non valido: rifiutato
    await expectCode(act(roomId, host, { action: "propose", text: "Prima di rispondere ci si tocca il gomito", hint: "boh" }, knowers[0]), "VALIDATION");
    await act(roomId, host, { action: "propose", text: "Prima di rispondere ci si tocca il gomito", category: "gesti", hint: HINT }, knowers[0]);
    await act(roomId, host, { action: "propose", text: "Ogni risposta contiene un frutto", category: "parole" }, knowers[1]);
    await act(roomId, host, { action: "pass" }, knowers[2]);
    s = (await view(roomId, host)).state;
    expect(s.phase).toBe("PROPOSAL_VOTE");
    assertNoSecret(s, [HINT, "gesti"]);
    const kv = await view(roomId, host, knowers[1]);
    const winner = kv.view.secret!.proposals.find((p) => p.text.includes("gomito"))!;
    expect(winner.category).toBe("gesti");
    await voteAll(roomId, host, knowers, s.round!.vote!.ballot, winner.id);
    s = (await view(roomId, host)).state;
    expect(s.phase).toBe("RULE_CONFIRMED");
    const [round] = await sql<{ rule_category: string; rule_hint: string }[]>`
      select rule_category, rule_hint from psyco_rounds where id = (select current_round_id from psyco_rooms where id = ${roomId})`;
    expect(round).toEqual({ rule_category: "gesti", rule_hint: HINT });
    await act(roomId, host, { action: "start_round" });
    await skipCountdown(roomId);
  });

  it("chiamata 1 = indizio del gruppo, 2 e 3 = indizi della categoria; mai senza «essere» lo PSYCO", async () => {
    // il proprietario senza scegliere il giocatore, o «come» un altro: no
    await expectCode(act(roomId, host, { action: "call_investigator", requestId: randomUUID() }), "FORBIDDEN");
    const other = Object.values(ids).find((id) => id !== psycoId)!;
    await expectCode(act(roomId, host, { action: "call_investigator", requestId: randomUUID() }, other), "FORBIDDEN");
    for (let i = 0; i < 3; i++) await act(roomId, host, { action: "call_investigator", requestId: randomUUID() }, psycoId);
    const pv = await view(roomId, host, psycoId);
    expect(pv.view.investigator?.messages.map((m) => m.text)).toEqual([HINT, CATEGORY_HINTS.gesti[1], CATEGORY_HINTS.gesti[2]]);
    // vista del proprietario (schermata pubblica del telefono condiviso) e degli altri: niente messaggi
    expect((await view(roomId, host)).view.investigator).toBeNull();
    expect((await view(roomId, host, other)).view.investigator).toBeNull();
    const pub: PsycoPublicState = (await view(roomId, host)).state;
    expect(pub.round!.calls).toMatchObject({ max: 3, used: 3 });
    assertNoSecret(pub, [HINT, CATEGORY_HINTS.gesti[1], CATEGORY_HINTS.gesti[2]]);
    await expectCode(act(roomId, host, { action: "call_investigator", requestId: randomUUID() }, psycoId), "NO_CALLS_LEFT");
  });
});
