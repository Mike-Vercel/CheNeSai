import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { MAX_THEORETICAL } from "@/lib/giramente/rules";
import type { GiramenteAction, PublicState } from "@/lib/giramente/types";
import type { GiramenteUser } from "@/lib/server/giramente/auth";
import { runAction, SYSTEM_ACTOR } from "@/lib/server/giramente/engine";
import { GiramenteError } from "@/lib/server/giramente/errors";
import { createRoom, getDisplayState, getRoomView, joinRoom, previewRoom } from "@/lib/server/giramente/rooms";

/**
 * GIRAMENTE! contro il database locale: account veri (Supabase Auth locale), partite vere, tutte le
 * transizioni passano dal motore. Le soluzioni si leggono dal database SOLO per giocare nei test e
 * per controllare che non arrivino mai nello stato pubblico o nelle viste degli altri.
 */
const sql = getSql();
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const users: string[] = [];
const rooms: string[] = [];

async function makeUser(label: string): Promise<GiramenteUser> {
  const email = `giramente-${label}-${randomUUID().slice(0, 8)}@test.chenesai.local`;
  const r = await auth.auth.admin.createUser({ email, password: `Pw-${randomUUID()}`, email_confirm: true });
  if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
  users.push(r.data.user.id);
  return { userId: r.data.user.id, ip: null, username: label };
}

const act = (roomId: string, u: GiramenteUser, a: GiramenteAction) => runAction(roomId, { userId: u.userId, ip: null }, a);
const rid = () => randomUUID();

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof GiramenteError && e.code === code);
}

interface RoomRowT {
  phase: string;
  round_no: number;
  stage: string | null;
  current_play_id: string | null;
  devices: string;
  mode: string;
  owner_user_id: string;
  turn_order: string[];
  turn_index: number;
}
const roomRow = async (id: string) => (await sql<RoomRowT[]>`select phase, round_no, stage, current_play_id, devices, mode, owner_user_id, turn_order, turn_index from giramente_rooms where id = ${id}`)[0];
const scores = async (id: string) => Object.fromEntries((await sql<{ id: string; score: number }[]>`select id, score from giramente_competitors where room_id = ${id} and active`).map((r) => [r.id, r.score]));

/** Scadenza di fase (e delle giocate aperte) già passata: per non aspettare i timer veri nei test. */
async function expire(roomId: string) {
  await sql`update giramente_rooms set phase_deadline_at = now() - interval '1 second' where id = ${roomId} and phase_deadline_at is not null`;
  await sql`update giramente_plays set deadline_at = now() - interval '3 seconds' where room_id = ${roomId} and status = 'open'`;
  await sql`update giramente_spins set started_at = now() - interval '10 seconds' where room_id = ${roomId}`;
  await runAction(roomId, SYSTEM_ACTOR, { action: "tick" });
}

interface Puz {
  pool: string;
  answer_index: number | null;
  solution: string;
  false_index: number | null;
  options: string[] | null;
  clues: string[];
  extra_clue: string | null;
}
const puzzleOf = async (playId: string) =>
  (await sql<Puz[]>`select z.pool, z.answer_index, z.solution, z.false_index, z.options, z.clues, z.extra_clue from giramente_plays p join giramente_puzzles z on z.id = p.puzzle_id where p.id = ${playId}`)[0];

type Strategy = (ctx: { round: number; competitorId: string; stage: string }) => boolean;

/** Chi agisce per un concorrente: il proprietario (dispositivo condiviso), il giocatore o il capitano. */
async function actorFor(roomId: string, competitorId: string, byId: Map<string, GiramenteUser>): Promise<GiramenteUser> {
  const r = await roomRow(roomId);
  if (r.devices === "shared") return byId.get(r.owner_user_id)!;
  const [p] = await sql<{ user_id: string }[]>`select user_id from giramente_participants where room_id = ${roomId} and competitor_id = ${competitorId} and status = 'active' and captain and user_id is not null`;
  return byId.get(p.user_id)!;
}

/**
 * Gioca fino alla fine (o fino alla fase `until`): ogni passo fa l'azione «naturale» della fase.
 * `correct` decide se il concorrente risponde giusto; `risk` VERDE/ROSSO.
 */
async function drive(
  roomId: string,
  host: GiramenteUser,
  all: GiramenteUser[],
  opts: { correct?: Strategy; risk?: (round: number, cid: string) => "verde" | "rosso"; until?: (r: RoomRowT) => boolean; secrets?: (s: PublicState) => void; maxSteps?: number } = {},
) {
  const byId = new Map(all.map((u) => [u.userId, u]));
  const correct = opts.correct ?? (() => true);
  for (let step = 0; step < (opts.maxSteps ?? 900); step++) {
    const r = await roomRow(roomId);
    if (r.phase === "FINAL" || opts.until?.(r)) return r;
    if (opts.secrets) opts.secrets(await getDisplayState((await sql<{ display_key: string }[]>`select display_key from giramente_rooms where id = ${roomId}`)[0].display_key));
    switch (r.phase) {
      case "INTRO":
      case "ROUND_INTRO":
      case "TURN_RESULT":
      case "REVEAL":
      case "ROUND_RESULTS":
        await act(roomId, host, { action: "skip" });
        break;
      case "SPINNING":
        await expire(roomId);
        break;
      case "CHOICE": {
        const cid = r.turn_order[r.turn_index];
        await act(roomId, await actorFor(roomId, cid, byId), { action: "choose_risk", choice: opts.risk?.(r.round_no, cid) ?? "verde" });
        break;
      }
      case "SPIN": {
        const cid = r.turn_order[r.turn_index];
        await act(roomId, await actorFor(roomId, cid, byId), { action: "spin", requestId: rid() });
        break;
      }
      case "WHEEL_RESULT": {
        const [p] = await sql<{ competitor_id: string; jolly_offer: boolean; jolly_chosen: string | null; colpo_offered: boolean; colpo_accepted: boolean | null }[]>`select * from giramente_plays where id = ${r.current_play_id}`;
        const u = await actorFor(roomId, p.competitor_id, byId);
        if (p.jolly_offer && !p.jolly_chosen) await act(roomId, u, { action: "choose_jolly", power: "scudo" });
        else if (p.colpo_offered && p.colpo_accepted === null) await act(roomId, u, { action: "colpo", accept: true });
        else await act(roomId, host, { action: "skip" });
        break;
      }
      case "QUESTION": {
        const [p] = await sql<{ id: string; competitor_id: string; stage: string }[]>`select id, competitor_id, stage from giramente_plays where id = ${r.current_play_id}`;
        const z = await puzzleOf(p.id);
        const u = await actorFor(roomId, p.competitor_id, byId);
        const ok = correct({ round: r.round_no, competitorId: p.competitor_id, stage: p.stage });
        if (z.pool === "ruota") await act(roomId, u, { action: "answer", playId: p.id, requestId: rid(), choice: ok ? z.answer_index! : (z.answer_index! + 1) % 4 });
        else await act(roomId, u, { action: "answer", playId: p.id, requestId: rid(), text: ok ? z.solution : "risposta sbagliata" });
        break;
      }
      case "TURN_READY":
        await act(roomId, byId.get(r.owner_user_id)!, { action: "start_turn" });
        break;
      case "PLAY": {
        const open = await sql<{ id: string; competitor_id: string; stage: string }[]>`
          select id, competitor_id, stage from giramente_plays where room_id = ${roomId} and status = 'open' order by turn_no`;
        if (open.length === 0) {
          await expire(roomId);
          break;
        }
        for (const p of open) {
          const z = await puzzleOf(p.id);
          const u = await actorFor(roomId, p.competitor_id, byId);
          const ok = correct({ round: r.round_no, competitorId: p.competitor_id, stage: p.stage });
          if (p.stage === "falsa") await act(roomId, u, { action: "answer", playId: p.id, requestId: rid(), falseIndex: ok ? z.false_index! : (z.false_index! + 1) % 4, text: ok ? z.solution : "boh" });
          else await act(roomId, u, { action: "answer", playId: p.id, requestId: rid(), text: ok ? z.solution : "sbagliato di sicuro" });
        }
        break;
      }
      default:
        throw new Error(`fase inattesa ${r.phase}`);
    }
  }
  throw new Error("partita troppo lunga");
}

/** Nessuna soluzione (o falsa pista) degli enigmi in corso nel JSON pubblico. */
async function assertNoSolutionsLeak(roomId: string, s: PublicState) {
  const json = JSON.stringify(s);
  const open = await sql<{ solution: string; options: string[] | null; answer_index: number | null; pool: string }[]>`
    select z.solution, z.options, z.answer_index, z.pool from giramente_plays p join giramente_puzzles z on z.id = p.puzzle_id
    where p.room_id = ${roomId} and p.status in ('open', 'pending')`;
  for (const z of open) {
    if (z.pool === "ruota") continue; // la soluzione è una delle 4 opzioni visibili: si controlla l'indice
    expect(json.includes(`"${z.solution}"`), `soluzione nel JSON pubblico: ${z.solution}`).toBe(false);
  }
  expect(json).not.toMatch(/answer_index|false_index|"accepted":\[|"solution":/);
}

let host: GiramenteUser;
let p2: GiramenteUser;
let p3: GiramenteUser;
let p4: GiramenteUser;
let stranger: GiramenteUser;
const many: GiramenteUser[] = [];

beforeAll(async () => {
  [host, p2, p3, p4, stranger] = await Promise.all([makeUser("sara"), makeUser("mike"), makeUser("luca"), makeUser("giulia"), makeUser("estraneo")]);
  many.push(...(await Promise.all(["a", "b", "c", "d", "e", "f", "g"].map((x) => makeUser(`p${x}`)))));
}, 60_000);

afterAll(async () => {
  if (rooms.length) await sql`delete from giramente_rooms where id = any(${sql.array(rooms)}::uuid[])`;
  for (const id of users) await auth.auth.admin.deleteUser(id);
});

describe("GIRAMENTE! – 2 giocatori su dispositivi separati, partita completa", () => {
  let roomId: string;
  let code: string;
  let cHost: string;
  let cP2: string;

  it("crea la stanza (host autenticato e giocatore) e la protegge", async () => {
    const r = await createRoom(host, { devices: "personal", mode: "individual", hostNickname: "Sara", settings: { difficulty: "media" } });
    roomId = r.roomId;
    code = r.code;
    rooms.push(roomId);
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    await expectCode(getRoomView(stranger, roomId), "NOT_MEMBER");
    await expectCode(act(roomId, stranger, { action: "start_game" }), "NOT_MEMBER");
    const prev = await previewRoom(p2, code.toLowerCase());
    expect(prev.member).toBeNull();
    await joinRoom(p2, code, "Mike");
    // un solo posto per account (doppio ingresso = rientro)
    await joinRoom(p2, code, "Mike");
    const v = await getRoomView(p2, roomId);
    expect(v.state.competitors).toHaveLength(2);
    cHost = v.state.competitors.find((c) => c.name === "Sara")!.id;
    cP2 = v.state.competitors.find((c) => c.name === "Mike")!.id;
    await expectCode(joinRoom(p3, code, "Sara"), "NICKNAME_TAKEN");
    await expectCode(act(roomId, p2, { action: "start_game" }), "FORBIDDEN");
  });

  it("manche 1: Verde/Rosso prima del giro, GIRA idempotente, spicchio deciso e registrato dal server", async () => {
    await act(roomId, host, { action: "start_game" });
    await drive(roomId, host, [host, p2], { until: (r) => r.phase === "CHOICE" });
    const r = await roomRow(roomId);
    const turnComp = r.turn_order[0];
    const actor = turnComp === cHost ? host : p2;
    const other = turnComp === cHost ? p2 : host;
    await expectCode(act(roomId, other, { action: "choose_risk", choice: "rosso" }), "NOT_YOUR_TURN");
    await act(roomId, actor, { action: "choose_risk", choice: "rosso" });
    // vietato cambiare dopo la scelta
    await expectCode(act(roomId, actor, { action: "choose_risk", choice: "verde" }), "WRONG_PHASE");
    const req = rid();
    await act(roomId, actor, { action: "spin", requestId: req });
    await act(roomId, actor, { action: "spin", requestId: rid() }); // doppio clic: nessun secondo giro
    const spins = await sql<{ target_index: number; sector: string; segments: string[] }[]>`select target_index, sector, segments from giramente_spins where room_id = ${roomId}`;
    expect(spins).toHaveLength(1);
    expect(spins[0].segments[spins[0].target_index]).toBe(spins[0].sector);
    // un client che si ricollega durante il giro riceve il comando del giro (per ricostruire l'angolo) ma non lo spicchio
    const during = await getRoomView(other, roomId);
    expect(during.state.phase).toBe("SPINNING");
    expect(during.state.wheel.spin?.targetIndex).toBe(spins[0].target_index);
    expect(during.state.turn?.sector).toBeNull();
    expect(during.state.turn?.risk).toBe("rosso");
    await expire(roomId);
    const after = await getRoomView(other, roomId);
    expect(after.state.turn?.sector).toBe(spins[0].sector);
    expect(after.state.wheel.restIndex).toBe(spins[0].target_index);
  });

  it("risposta sbagliata in ROSSO a zero punti: il punteggio non scende sotto zero (registro con valore applicato)", async () => {
    // si porta il primo turno fino alla domanda e si risponde sbagliato
    await drive(roomId, host, [host, p2], { until: (r) => r.phase === "QUESTION" });
    const r = await roomRow(roomId);
    const [p] = await sql<{ id: string; competitor_id: string; risk: string; lampo: boolean }[]>`select id, competitor_id, risk, lampo from giramente_plays where id = ${r.current_play_id}`;
    const z = await puzzleOf(p.id);
    const actor = p.competitor_id === cHost ? host : p2;
    const view = await getRoomView(actor, roomId);
    await assertNoSolutionsLeak(roomId, view.state);
    expect(view.view.canAct).toBe(true);
    expect(JSON.stringify(view.state.question)).not.toContain("answer");
    const req = rid();
    const before = (await scores(roomId))[p.competitor_id];
    const scudo = (await sql<{ jolly: string | null }[]>`select jolly from giramente_competitors where id = ${p.competitor_id}`)[0].jolly === "scudo";
    await act(roomId, actor, { action: "answer", playId: p.id, requestId: req, choice: (z.answer_index! + 1) % 4 });
    // doppio invio della stessa risposta: nessun cambiamento; risposta diversa: rifiutata
    await act(roomId, actor, { action: "answer", playId: p.id, requestId: req, choice: (z.answer_index! + 1) % 4 });
    await expectCode(act(roomId, actor, { action: "answer", playId: p.id, requestId: rid(), choice: z.answer_index! }), "ALREADY_ANSWERED");
    const afterScore = (await scores(roomId))[p.competitor_id];
    expect(afterScore).toBe(before === 0 || scudo ? before : Math.max(0, before - 100));
    expect(afterScore).toBeGreaterThanOrEqual(0);
    const log = await sql<{ kind: string; requested: number; applied: number }[]>`select kind, requested, applied from giramente_score_log where play_id = ${p.id}`;
    if (!scudo) {
      expect(log).toEqual([{ kind: "penalty", requested: -100, applied: before === 0 ? 0 : -Math.min(before, 100) }]);
    }
    const res = await getRoomView(p2, roomId);
    expect(res.state.phase).toBe("TURN_RESULT");
    expect(res.state.result?.correct).toBe(false);
    expect(res.state.result?.solution).toBe(z.solution);
  });

  it("completa la partita: tutte le 5 manche, nessuna soluzione nello stato pubblico, vincitore corretto", async () => {
    let checked = 0;
    const end = await drive(roomId, host, [host, p2], {
      correct: ({ competitorId }) => competitorId === cHost,
      risk: (round) => (round === 3 ? "rosso" : "verde"),
      secrets: (s) => {
        checked++;
        const j = JSON.stringify(s);
        expect(j).not.toMatch(/answer_index|false_index|"accepted":\[/);
      },
    });
    expect(end.phase).toBe("FINAL");
    expect(checked).toBeGreaterThan(20);
    const s = await getDisplayState((await sql<{ display_key: string }[]>`select display_key from giramente_rooms where id = ${roomId}`)[0].display_key);
    expect(s.phase).toBe("FINAL");
    expect(s.winners).toEqual([cHost]);
    expect(s.standings[0].competitorId).toBe(cHost);
    expect(s.competitors.find((c) => c.id === cHost)!.score).toBeLessThanOrEqual(MAX_THEORETICAL + 4 * 100 + 50 * 4);
    // persistenza: punteggio = somma del registro
    const sum = await sql<{ competitor_id: string; total: number }[]>`select competitor_id, sum(applied)::int as total from giramente_score_log where room_id = ${roomId} group by 1`;
    const sc = await scores(roomId);
    for (const row of sum) expect(sc[row.competitor_id]).toBe(row.total);
    // tutte le manche registrate
    const rounds = await sql<{ round_no: number }[]>`select round_no from giramente_rounds where room_id = ${roomId} and ended_at is not null order by 1`;
    expect(rounds.map((r) => r.round_no)).toEqual([1, 2, 3, 4, 5]);
    // nessun enigma ripetuto nella stessa partita (nelle prove contemporanee lo stesso enigma vale per tutti)
    const [dup] = await sql<{ n: number }[]>`
      select count(*)::int as n from (
        select puzzle_id from giramente_plays where room_id = ${roomId} and puzzle_id is not null
        group by 1 having count(distinct (round_no, stage, series, turn_no)) > 1 or count(*) > count(distinct competitor_id)) x`;
    expect(dup.n).toBe(0);
    // i Jolly scadono a fine manche 4
    const [j] = await sql<{ n: number }[]>`select count(*)::int as n from giramente_competitors where room_id = ${roomId} and jolly is not null`;
    expect(j.n).toBe(0);
    void cP2;
  });
});

/** Durante il giro (fase SPINNING) il test sceglie lo spicchio: serve solo a provare gli spicchi speciali. */
async function forceSector(roomId: string, sector: string) {
  const r = await roomRow(roomId);
  const idx = (r.round_no === 5 ? ["intruso", "sequenza", "indizi", "prospettiva"] : ["intruso", "sequenza", "indizi", "prospettiva", "mistero", "jolly", "bonus", "colpo"]).indexOf(sector);
  await sql`update giramente_plays set sector = ${sector} where id = ${r.current_play_id}`;
  await sql`update giramente_spins set sector = ${sector}, target_index = ${idx} where play_id = ${r.current_play_id}`;
}

/** Porta il turno corrente fino al giro (VERDE/ROSSO scelto), con lo spicchio deciso dal test. */
async function spinTo(roomId: string, u: GiramenteUser, sector: string, risk: "verde" | "rosso" = "verde") {
  let r = await roomRow(roomId);
  if (r.phase === "CHOICE") await act(roomId, u, { action: "choose_risk", choice: risk });
  await act(roomId, u, { action: "spin", requestId: rid() });
  await forceSector(roomId, sector);
  await expire(roomId);
  r = await roomRow(roomId);
  return r;
}

describe("GIRAMENTE! – Jolly, Bonus, Colpo di scena, timer, pausa", () => {
  let roomId: string;
  let cA: string;
  let cB: string;
  const who = (cid: string) => (cid === cA ? host : p3);

  it("prepara una partita a 2 (dispositivi separati) fino al primo turno", async () => {
    const r = await createRoom(host, { devices: "personal", mode: "individual", hostNickname: "Sara" });
    roomId = r.roomId;
    rooms.push(roomId);
    await joinRoom(p3, r.code, "Luca");
    const v = await getRoomView(host, roomId);
    cA = v.state.competitors.find((c) => c.name === "Sara")!.id;
    cB = v.state.competitors.find((c) => c.name === "Luca")!.id;
    await act(roomId, host, { action: "start_game" });
    await drive(roomId, host, [host, p3], { until: (x) => x.phase === "CHOICE" });
  });

  it("JOLLY: il concorrente sceglie un potere; OCCHIO FURBO mostra l'indizio previsto e si consuma solo quando si usa", async () => {
    const r0 = await roomRow(roomId);
    const cid = r0.turn_order[r0.turn_index];
    const u = who(cid);
    let r = await spinTo(roomId, u, "jolly");
    expect(r.phase).toBe("WHEEL_RESULT");
    let s = (await getRoomView(u, roomId)).state;
    expect(s.turn?.jolly).toEqual({ offer: true, duplicate: false, chosen: null });
    await expectCode(act(roomId, host, { action: "skip" }), "WRONG_PHASE"); // il concorrente deve scegliere
    await act(roomId, u, { action: "choose_jolly", power: "occhio" });
    let [c] = await sql<{ jolly: string | null }[]>`select jolly from giramente_competitors where id = ${cid}`;
    expect(c.jolly).toBe("occhio");
    await expire(roomId);
    r = await roomRow(roomId);
    expect(r.phase).toBe("QUESTION");
    const z = await puzzleOf(r.current_play_id!);
    s = (await getRoomView(u, roomId)).state;
    expect(s.question?.extraClue).toBeNull();
    await act(roomId, u, { action: "use_occhio", playId: r.current_play_id! });
    s = (await getRoomView(u, roomId)).state;
    expect(s.question?.extraClue).toBe(z.extra_clue);
    [c] = await sql<{ jolly: string | null }[]>`select jolly from giramente_competitors where id = ${cid}`;
    expect(c.jolly).toBeNull();
    const log = await sql<{ action: string; power: string }[]>`select action, power from giramente_jolly_log where competitor_id = ${cid} order by id`;
    expect(log).toEqual([{ action: "granted", power: "occhio" }, { action: "used", power: "occhio" }]);
    await expectCode(act(roomId, u, { action: "use_occhio", playId: r.current_play_id! }), "NOT_AVAILABLE");
    await act(roomId, u, { action: "answer", playId: r.current_play_id!, requestId: rid(), choice: z.answer_index! });
    s = (await getRoomView(u, roomId)).state;
    expect(s.result?.correct).toBe(true);
    expect(s.result?.delta).toBe(150);
    await act(roomId, host, { action: "skip" });
  });

  it("BONUS: +100 se la risposta è giusta", async () => {
    let r = await roomRow(roomId);
    const cid = r.turn_order[r.turn_index];
    const u = who(cid);
    await spinTo(roomId, u, "bonus");
    await act(roomId, host, { action: "skip" });
    r = await roomRow(roomId);
    const z = await puzzleOf(r.current_play_id!);
    const before = (await scores(roomId))[cid];
    await act(roomId, u, { action: "answer", playId: r.current_play_id!, requestId: rid(), choice: z.answer_index! });
    expect((await scores(roomId))[cid]).toBe(before + 150 + 100);
    await act(roomId, host, { action: "skip" }); // fine manche 1 (2 turni)
    expect((await roomRow(roomId)).phase).toBe("ROUND_RESULTS");
  });

  it("manche 2 contemporanea: risposte simultanee, esiti nascosti fino alla rivelazione, viste private separate", async () => {
    await drive(roomId, host, [host, p3], { until: (x) => x.phase === "PLAY" });
    const vA = await getRoomView(host, roomId);
    const vB = await getRoomView(p3, roomId);
    expect(vA.view.plays).toHaveLength(2);
    expect(vB.view.plays).toHaveLength(2);
    expect(vA.view.plays.every((p) => p.timer.deadlineAt)).toBe(true);
    // ognuno vede SOLO le proprie giocate
    expect(vA.view.plays.map((p) => p.playId).some((id) => vB.view.plays.map((x) => x.playId).includes(id))).toBe(false);
    await assertNoSolutionsLeak(roomId, vA.state);
    expect(JSON.stringify(vA.view)).not.toMatch(/"solution"|false_index/);
    const scoreBefore = await scores(roomId);
    // il primo consegna: nessun esito pubblico, nessun punto ancora
    const first = vA.view.plays[0];
    const z0 = await puzzleOf(first.playId);
    await act(roomId, host, { action: "answer", playId: first.playId, requestId: rid(), falseIndex: z0.false_index!, text: z0.solution });
    const mid = await getRoomView(p3, roomId);
    expect(mid.state.reveal).toBeNull();
    expect(await scores(roomId)).toEqual(scoreBefore);
    expect(JSON.stringify(mid.state)).not.toContain(z0.solution);
    // tutti gli altri rispondono nello stesso momento
    const jobs = [...vA.view.plays.slice(1).map((p) => ({ u: host, p })), ...vB.view.plays.map((p) => ({ u: p3, p }))].map(async ({ u, p }) => {
      const z = await puzzleOf(p.playId);
      return act(roomId, u, { action: "answer", playId: p.playId, requestId: rid(), falseIndex: z.false_index!, text: z.solution.toLowerCase() });
    });
    await Promise.all(jobs);
    const s = (await getRoomView(host, roomId)).state;
    expect(s.phase).toBe("REVEAL");
    expect(s.reveal?.results).toHaveLength(2);
    for (const res of s.reveal!.results) expect(res.points).toBe(400);
    const after = await scores(roomId);
    expect(after[cA]).toBe(scoreBefore[cA] + 400);
    expect(after[cB]).toBe(scoreBefore[cB] + 400);
  });

  it("PAUSA: i timer si fermano, le risposte in pausa sono rifiutate, alla ripresa il tempo riparte da dove era; TEMPO SCADUTO", async () => {
    await drive(roomId, host, [host, p3], { until: (x) => x.phase === "QUESTION" });
    let r = await roomRow(roomId);
    const cid = r.turn_order[r.turn_index];
    const [before] = await sql<{ deadline_at: Date }[]>`select deadline_at from giramente_plays where id = ${r.current_play_id}`;
    await expectCode(act(roomId, p3, { action: "pause" }), "FORBIDDEN");
    await act(roomId, host, { action: "pause" });
    const z = await puzzleOf(r.current_play_id!);
    await expectCode(act(roomId, who(cid), { action: "answer", playId: r.current_play_id!, requestId: rid(), choice: z.answer_index! }), "PAUSED");
    // in pausa la scadenza non fa avanzare la partita
    await sql`update giramente_rooms set phase_deadline_at = now() - interval '1 second' where id = ${roomId}`;
    await runAction(roomId, SYSTEM_ACTOR, { action: "tick" });
    expect((await roomRow(roomId)).phase).toBe("QUESTION");
    await sql`update giramente_rooms set paused_at = now() - interval '5 seconds', phase_deadline_at = now() + interval '20 seconds' where id = ${roomId}`;
    await act(roomId, host, { action: "resume" });
    const [after] = await sql<{ deadline_at: Date }[]>`select deadline_at from giramente_plays where id = ${r.current_play_id}`;
    expect(after.deadline_at.getTime() - before.deadline_at.getTime()).toBeGreaterThanOrEqual(4900);
    // risposta oltre il tempo (tolleranza compresa): rifiutata
    await sql`update giramente_plays set deadline_at = now() - interval '5 seconds' where id = ${r.current_play_id}`;
    await sql`update giramente_rooms set phase_deadline_at = now() + interval '20 seconds' where id = ${roomId}`;
    await expectCode(act(roomId, who(cid), { action: "answer", playId: r.current_play_id!, requestId: rid(), choice: z.answer_index! }), "TOO_LATE");
    await expire(roomId);
    r = await roomRow(roomId);
    expect(r.phase).toBe("TURN_RESULT");
    const s = (await getRoomView(host, roomId)).state;
    expect(s.result?.timeout).toBe(true);
  });

  it("SCUDO annulla la penalità del ROSSO (non dà punti) e si consuma", async () => {
    await act(roomId, host, { action: "skip" });
    let r = await roomRow(roomId);
    expect(r.phase).toBe("CHOICE");
    const cid = r.turn_order[r.turn_index];
    const u = who(cid);
    await spinTo(roomId, u, "jolly", "rosso");
    await act(roomId, u, { action: "choose_jolly", power: "scudo" });
    await expire(roomId);
    r = await roomRow(roomId);
    const z = await puzzleOf(r.current_play_id!);
    await sql`update giramente_competitors set score = 500 where id = ${cid}`;
    await act(roomId, u, { action: "answer", playId: r.current_play_id!, requestId: rid(), choice: (z.answer_index! + 1) % 4 });
    const s = (await getRoomView(u, roomId)).state;
    expect(s.result?.shieldUsed).toBe(true);
    expect((await scores(roomId))[cid]).toBe(500);
    expect(s.competitors.find((c) => c.id === cid)!.jolly).toBeNull();
  });

  it("i Jolly scadono a fine manche 4 e non si usano nel Giro Decisivo", async () => {
    await sql`update giramente_competitors set jolly = 'occhio' where id = ${cA}`;
    await drive(roomId, host, [host, p3], { until: (x) => x.round_no === 5 && x.phase === "ROUND_INTRO" });
    const [c] = await sql<{ jolly: string | null }[]>`select jolly from giramente_competitors where id = ${cA}`;
    expect(c.jolly).toBeNull();
    const exp = await sql<{ action: string }[]>`select action from giramente_jolly_log where competitor_id = ${cA} and action = 'expired'`;
    expect(exp.length).toBeGreaterThanOrEqual(1);
    await drive(roomId, host, [host, p3], { until: (x) => x.phase === "QUESTION" });
    const r = await roomRow(roomId);
    await sql`update giramente_competitors set jolly = 'occhio' where id = ${r.turn_order[r.turn_index]}`;
    await expectCode(act(roomId, who(r.turn_order[r.turn_index]), { action: "use_occhio", playId: r.current_play_id! }), "NOT_AVAILABLE");
    await sql`update giramente_competitors set jolly = null where room_id = ${roomId}`;
    const spins = await sql<{ segments: string[] }[]>`select segments from giramente_spins where room_id = ${roomId} and round_no = 5`;
    for (const sp of spins) expect(sp.segments.some((x) => ["jolly", "bonus", "colpo", "mistero"].includes(x))).toBe(false);
  });

  it("Giro Decisivo: indizi a sblocco 600 → 400 → 200, un solo tentativo", async () => {
    const r = await roomRow(roomId);
    const cid = r.turn_order[r.turn_index];
    const u = who(cid);
    let s = (await getRoomView(u, roomId)).state;
    expect(s.question?.pointsAtStake).toBe(600);
    expect(s.question?.clues).toHaveLength(1);
    await act(roomId, u, { action: "next_clue", playId: r.current_play_id! });
    s = (await getRoomView(u, roomId)).state;
    expect(s.question?.pointsAtStake).toBe(400);
    expect(s.question?.clues).toHaveLength(2);
    const z = await puzzleOf(r.current_play_id!);
    const before = (await scores(roomId))[cid];
    await act(roomId, u, { action: "answer", playId: r.current_play_id!, requestId: rid(), text: ` ${z.solution.toLowerCase()} ` });
    expect((await scores(roomId))[cid]).toBe(before + 400);
    await expectCode(act(roomId, u, { action: "answer", playId: r.current_play_id!, requestId: rid(), text: z.solution }), "ALREADY_ANSWERED");
  });

  it("SPAREGGIO: parità al primo posto → enigma progressivo finché c'è un solo vincitore", async () => {
    await drive(roomId, host, [host, p3], { until: (x) => x.phase === "ROUND_RESULTS" && x.round_no === 5, correct: () => false });
    await sql`update giramente_competitors set score = 1000 where room_id = ${roomId}`;
    await act(roomId, host, { action: "skip" });
    let r = await roomRow(roomId);
    expect(r.stage).toBe("tiebreak");
    expect(r.phase).toBe("ROUND_INTRO");
    await act(roomId, host, { action: "skip" });
    r = await roomRow(roomId);
    expect(r.phase).toBe("PLAY");
    const vA = await getRoomView(host, roomId);
    const vB = await getRoomView(p3, roomId);
    expect(vA.view.plays[0].pointsAtStake).toBe(600);
    await act(roomId, host, { action: "answer", playId: vA.view.plays[0].playId, requestId: rid(), text: "no" });
    await act(roomId, p3, { action: "answer", playId: vB.view.plays[0].playId, requestId: rid(), text: "nemmeno" });
    let s = (await getRoomView(host, roomId)).state;
    expect(s.phase).toBe("REVEAL");
    expect(s.reveal?.tiebreakWinner).toBeNull();
    await act(roomId, host, { action: "skip" });
    r = await roomRow(roomId);
    expect(r.phase).toBe("ROUND_INTRO");
    await act(roomId, host, { action: "skip" });
    const v2A = await getRoomView(host, roomId);
    const v2B = await getRoomView(p3, roomId);
    const z = await puzzleOf(v2B.view.plays[0].playId);
    await act(roomId, host, { action: "next_clue", playId: v2A.view.plays[0].playId });
    await act(roomId, host, { action: "answer", playId: v2A.view.plays[0].playId, requestId: rid(), text: "boh" });
    await act(roomId, p3, { action: "answer", playId: v2B.view.plays[0].playId, requestId: rid(), text: z.solution });
    s = (await getRoomView(host, roomId)).state;
    expect(s.reveal?.tiebreakWinner).toBe(cB);
    await act(roomId, host, { action: "skip" });
    s = (await getRoomView(host, roomId)).state;
    expect(s.phase).toBe("FINAL");
    expect(s.winners).toEqual([cB]);
    expect((await scores(roomId))[cB]).toBe(1000);
  });
});

describe("GIRAMENTE! – Jolly doppione e Colpo di scena", () => {
  it("JOLLY doppione = +50 (niente secondo potere) e poi comunque un enigma; COLPO DI SCENA = sfida lampo +100", async () => {
    const created = await createRoom(host, { devices: "personal", mode: "individual", hostNickname: "Sara" });
    const roomId = created.roomId;
    rooms.push(roomId);
    await joinRoom(p4, created.code, "Giulia");
    const cA = (await getRoomView(host, roomId)).state.competitors.find((c) => c.name === "Sara")!.id;
    const who = (cid: string) => (cid === cA ? host : p4);
    await act(roomId, host, { action: "start_game" });
    await drive(roomId, host, [host, p4], { until: (x) => x.phase === "CHOICE" });
    let r = await roomRow(roomId);
    let cid = r.turn_order[r.turn_index];
    let u = who(cid);
    await sql`update giramente_competitors set jolly = 'occhio' where id = ${cid}`;
    const sc = (await scores(roomId))[cid];
    await spinTo(roomId, u, "jolly");
    let s = (await getRoomView(u, roomId)).state;
    expect(s.turn?.jolly?.duplicate).toBe(true);
    expect((await scores(roomId))[cid]).toBe(sc + 50);
    expect(s.competitors.find((c) => c.id === cid)!.jolly).toBe("occhio");
    await expectCode(act(roomId, u, { action: "choose_jolly", power: "scudo" }), "WRONG_PHASE");
    await expire(roomId);
    r = await roomRow(roomId);
    expect(r.phase).toBe("QUESTION");
    expect((await puzzleOf(r.current_play_id!)).pool).toBe("ruota");
    await expire(roomId); // tempo scaduto in VERDE: 0 punti, niente penalità
    expect((await scores(roomId))[cid]).toBe(sc + 50);
    await act(roomId, host, { action: "skip" });
    r = await roomRow(roomId);
    expect(r.phase).toBe("CHOICE");
    cid = r.turn_order[r.turn_index];
    u = who(cid);
    await spinTo(roomId, u, "colpo", "verde");
    await act(roomId, u, { action: "colpo", accept: true });
    r = await roomRow(roomId);
    const [p] = await sql<{ total_ms: number; lampo: boolean }[]>`select total_ms, lampo from giramente_plays where id = ${r.current_play_id}`;
    expect(p.lampo).toBe(true);
    expect(p.total_ms).toBe(12_000);
    s = (await getRoomView(u, roomId)).state;
    expect(s.question?.pointsAtStake).toBe(250);
    const z = await puzzleOf(r.current_play_id!);
    const before = (await scores(roomId))[cid];
    await act(roomId, u, { action: "answer", playId: r.current_play_id!, requestId: rid(), choice: z.answer_index! });
    expect((await scores(roomId))[cid]).toBe(before + 150 + 100);
  });
});

describe("GIRAMENTE! – un solo dispositivo (3 nomi), prove a turno con enigmi diversi", () => {
  it("gioca tutta la partita sul telefono di chi l'ha creata; ingressi da altri telefoni rifiutati", async () => {
    const r = await createRoom(p4, { devices: "shared", mode: "individual", players: ["Anna", "Bruno", "Carla"] });
    rooms.push(r.roomId);
    await expectCode(joinRoom(p2, r.code, "Intruso"), "SHARED_ROOM");
    await expectCode(getRoomView(p2, r.roomId), "NOT_MEMBER");
    await expectCode(createRoom(p4, { devices: "shared", mode: "individual", players: ["Anna", "anna"] }), "NICKNAME_TAKEN");
    await act(r.roomId, p4, { action: "start_game" });
    await drive(r.roomId, p4, [p4], { until: (x) => x.phase === "TURN_READY" });
    let v = await getRoomView(p4, r.roomId);
    expect(v.view.plays).toHaveLength(0);
    expect(v.state.stagePlay?.common).toBeNull();
    await act(r.roomId, p4, { action: "start_turn" });
    v = await getRoomView(p4, r.roomId);
    expect(v.view.plays).toHaveLength(2);
    expect(v.state.stagePlay?.common).toBeNull();
    await assertNoSolutionsLeak(r.roomId, v.state);
    const winner = v.state.competitors[1].id;
    const end = await drive(r.roomId, p4, [p4], { correct: ({ competitorId }) => competitorId === winner });
    expect(end.phase).toBe("FINAL");
    const rows = await sql<{ stage: string; n: number; d: number }[]>`
      select stage, count(*)::int as n, count(distinct puzzle_id)::int as d from giramente_plays where room_id = ${r.roomId} and stage in ('falsa','collegamento','tabellone') group by 1`;
    expect(rows).toHaveLength(3);
    for (const x of rows) expect(x.d).toBe(x.n);
    const s = (await getRoomView(p4, r.roomId)).state;
    expect(s.winners).toEqual([winner]);
  });
});

describe("GIRAMENTE! – squadre", () => {
  it("2 squadre su dispositivi separati: il capitano conferma, i componenti vedono ma non rispondono", async () => {
    const r = await createRoom(host, { devices: "personal", mode: "teams", hostNickname: "Sara", teams: [{ name: "Leoni" }, { name: "Tigri" }] });
    rooms.push(r.roomId);
    const pv = await previewRoom(p2, r.code);
    const leoni = pv.teams.find((t) => t.name === "Leoni")!.id;
    const tigri = pv.teams.find((t) => t.name === "Tigri")!.id;
    await joinRoom(p2, r.code, "Mike", leoni);
    await joinRoom(p3, r.code, "Luca", tigri);
    await expectCode(act(r.roomId, host, { action: "start_game" }), "NOT_ENOUGH_PLAYERS");
    await joinRoom(p4, r.code, "Giulia", tigri);
    let v = await getRoomView(p4, r.roomId);
    expect(v.state.competitors.find((c) => c.id === tigri)!.members.find((m) => m.nickname === "Luca")!.captain).toBe(true);
    await act(r.roomId, host, { action: "start_game" });
    await drive(r.roomId, host, [host, p2, p3, p4], { until: (x) => x.phase === "CHOICE" });
    const row = await roomRow(r.roomId);
    const turnTeam = row.turn_order[0];
    const member = turnTeam === leoni ? p2 : p4;
    const captain = turnTeam === leoni ? host : p3;
    await expectCode(act(r.roomId, member, { action: "choose_risk", choice: "rosso" }), "NOT_YOUR_TURN");
    v = await getRoomView(member, r.roomId);
    expect(v.view.canAct).toBe(false);
    await act(r.roomId, captain, { action: "choose_risk", choice: "verde" });
    const end = await drive(r.roomId, host, [host, p2, p3, p4], { correct: ({ competitorId }) => competitorId === tigri });
    expect(end.phase).toBe("FINAL");
    const s = (await getRoomView(p2, r.roomId)).state;
    expect(s.winners).toEqual([tigri]);
    expect(s.competitors.every((c) => c.kind === "team")).toBe(true);
  });

  it("4 squadre su un solo dispositivo: partita completa", async () => {
    const r = await createRoom(p2, {
      devices: "shared",
      mode: "teams",
      teams: [
        { name: "Rossi", members: ["Aldo", "Bea"] },
        { name: "Verdi", members: ["Ciro", "Dora"] },
        { name: "Blu", members: ["Ezio", "Fede"] },
        { name: "Gialli", members: ["Gino", "Ivo", "Lia"] },
      ],
    });
    rooms.push(r.roomId);
    await expectCode(createRoom(p2, { devices: "shared", mode: "teams", teams: [{ name: "A", members: ["x"] }, { name: "B", members: ["y", "z"] }] }), "VALIDATION");
    await act(r.roomId, p2, { action: "start_game" });
    const end = await drive(r.roomId, p2, [p2]);
    expect(end.phase).toBe("FINAL");
    const s = (await getRoomView(p2, r.roomId)).state;
    expect(s.competitors).toHaveLength(4);
    expect(s.winners.length).toBeGreaterThanOrEqual(1);
  });
});

describe("GIRAMENTE! – 8 giocatori su dispositivi separati", () => {
  it("entrano in 8 (il nono è rifiutato) e completano la partita", async () => {
    const r = await createRoom(host, { devices: "personal", mode: "individual", hostNickname: "Host8" });
    rooms.push(r.roomId);
    for (const [i, u] of many.entries()) await joinRoom(u, r.code, `Gioc${i + 1}`);
    await expectCode(joinRoom(stranger, r.code, "Nono"), "ROOM_FULL");
    await act(r.roomId, host, { action: "start_game" });
    const all = [host, ...many];
    const end = await drive(r.roomId, host, all, { correct: ({ competitorId }) => competitorId.charCodeAt(0) % 2 === 0, risk: (round) => (round === 1 ? "rosso" : "verde") });
    expect(end.phase).toBe("FINAL");
    const s = (await getRoomView(many[3], r.roomId)).state;
    expect(s.competitors).toHaveLength(8);
    for (const st of s.standings) expect(st.position).toBe(1 + s.standings.filter((x) => x.score > st.score).length);
    expect(s.competitors.every((c) => c.score >= 0)).toBe(true);
  }, 120_000);
});

describe("GIRAMENTE! – pannello admin degli enigmi", () => {
  it("un enigma incompleto non si pubblica; completato sì; statistiche delle partite", async () => {
    const { createPuzzle, updatePuzzle, listPuzzles, giramenteStats } = await import("@/lib/server/giramente/admin");
    const incomplete = { pool: "ruota", kind: "intruso", category: "logica", difficulty: "facile", prompt: "Quale non è un colore?", options: ["Rosso", "Verde", "Sedia", ""], answerIndex: 2, solution: "Sedia", status: "published" };
    await expectCode(createPuzzle(incomplete), "VALIDATION");
    const draft = await createPuzzle({ ...incomplete, status: "draft" });
    expect(draft.problems.length).toBeGreaterThan(0);
    await expectCode(updatePuzzle(draft.id, { status: "published" }), "VALIDATION");
    const fixed = await updatePuzzle(draft.id, { options: ["Rosso", "Verde", "Sedia", "Blu"], extraClue: "Ci si siede sopra.", status: "published" });
    expect(fixed.problems).toEqual([]);
    expect(fixed.status).toBe("published");
    const bad = await createPuzzle({ pool: "tabellone", category: "Proverbi", difficulty: "facile", solution: "frase minuscola", status: "draft" });
    expect(bad.problems.join(" ")).toMatch(/MAIUSCOLO|indizio/);
    expect((await listPuzzles()).some((p) => p.id === fixed.id)).toBe(true);
    const st = await giramenteStats();
    expect(st.games.total).toBeGreaterThan(0);
    expect(st.puzzles.find((p) => p.pool === "ruota")!.published).toBeGreaterThanOrEqual(64);
    await sql`delete from giramente_puzzles where id = any(${sql.array([draft.id, bad.id])}::uuid[])`;
  });
});
