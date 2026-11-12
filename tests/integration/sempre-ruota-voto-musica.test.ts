import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { freeVoteRoundIndex, FREE_SINGLE_ROUND_VOTED } from "@/lib/game-engine/free-game";
import type { StoredPalminoWheel } from "@/lib/game-engine/palmino-wheel";
import type { PublicState } from "@/lib/game-engine/types";
import { createHostProfile, createPublicGame, hostCommand, loadHostUser, rematchPublicGame, type HostUser } from "@/lib/server/gioco-libero";
import { authenticatePlayer, joinSession, submitVote } from "@/lib/server/players";
import { buildPublicState } from "@/lib/server/public-state";
import { cleanupSession, cmd, makeQuestion } from "../support/fixtures";

/**
 * Partita libera: votazione delle materie, Ruota di Palmino e canzone ("Ascolta") SEMPRE presenti.
 * Archivio isolato (tag univoco) con 3 canzoni finte (media audio senza file: qui conta la
 * composizione e il motore, l'audio vero lo prova l'e2e), account host veri (Supabase Auth locale).
 */
const sql = getSql();
const TAG = `sempre-${randomUUID().slice(0, 8)}`;
const CATS = ["Cinema", "Storia", "Sport", "Geografia", "Scienza", "Arte", "Cucina", "Natura"];
const created: string[] = [];
const users: string[] = [];
const media: string[] = [];
const music: string[] = [];
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const only = { onlyTag: TAG };

async function makeHost(label: string): Promise<HostUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@test.chenesai.local`;
  const r = await auth.auth.admin.createUser({ email, password: `Pw-${randomUUID()}`, email_confirm: true });
  if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
  users.push(r.data.user.id);
  await createHostProfile(sql, r.data.user.id, `${label}_${randomUUID().slice(0, 6)}`);
  return loadHostUser(sql, r.data.user.id, email);
}

beforeAll(async () => {
  for (let i = 0; i < 96; i++) {
    await makeQuestion(`Sempre ${TAG} n. ${i}?`, ["Uno", "Due", "Tre", "Quattro"], [i % 4], { category: CATS[i % CATS.length], difficulty: (i % 5) + 1, tags: ["test-automatico", TAG] });
  }
  for (const [i, title] of ["Billie Jean", "Gloria", "Per sempre"].entries()) {
    const [m] = await sql<{ id: string }[]>`
      insert into media_assets (kind, storage_path, mime_type, size_bytes, label, duration_ms)
      values ('audio', ${`audio/test-${randomUUID()}.mp3`}, 'audio/mpeg', 1000, ${title}, 10000) returning id`;
    media.push(m.id);
    music.push(
      await makeQuestion(`Canzone ${TAG}: come si intitola? (${i})`, [title, "Altro A", "Altro B", "Altro C"], [0], {
        category: "Musica",
        difficulty: 2,
        mediaId: m.id,
        tags: ["test-automatico", TAG, "musica"],
      }),
    );
  }
});

afterAll(async () => {
  for (const id of created) await cleanupSession(id).catch(() => undefined);
  await sql`delete from game_sessions where host_user_id = any(${sql.array(users)}::uuid[])`.catch(() => undefined);
  await sql`delete from question_plays where host_user_id = any(${sql.array(users)}::uuid[])`.catch(() => undefined);
  await sql`delete from question_bank where ${TAG} = any(tags)`;
  await sql`delete from media_assets where id = any(${sql.array(media)}::uuid[])`;
  for (const id of users) await auth.auth.admin.deleteUser(id);
  await sql.end();
});

interface Sq {
  id: string;
  round_index: number;
  kind: string;
  position: number;
  question_id: string;
  vote_option_id: string | null;
  media: boolean;
  is_reserve: boolean;
  wheel_candidate: boolean;
}

async function shape(sessionId: string) {
  const rounds = await sql<{ id: string; position: number; kind: string; palmino_wheel: StoredPalminoWheel | null; options: number }[]>`
    select r.id, r.position, r.kind::text as kind, r.palmino_wheel,
      (select count(*)::int from category_vote_options o where o.round_id = r.id) as options
    from game_rounds r where r.session_id = ${sessionId} order by r.position`;
  const qs = await sql<Sq[]>`
    select sq.id, r.position as round_index, r.kind::text as kind, sq.position, sq.question_id, sq.vote_option_id,
      qb.media_id is not null as media, sq.is_reserve, sq.wheel_candidate
    from session_questions sq join game_rounds r on r.id = sq.round_id join question_bank qb on qb.id = sq.question_id
    where sq.session_id = ${sessionId} order by r.position, sq.position`;
  return { rounds, qs };
}

/** Domande giocate nell'ordine della partita, se vince la prima materia di ogni votazione. */
function playedOrder(qs: Sq[], rounds: { id: string; position: number }[]): Sq[] {
  const out: Sq[] = [];
  for (const r of rounds) {
    const mine = qs.filter((q) => q.round_index === r.position && !q.is_reserve);
    const firstOption = mine.find((q) => q.vote_option_id)?.vote_option_id ?? null;
    out.push(...mine.filter((q) => !q.vote_option_id || q.vote_option_id === firstOption));
  }
  return out;
}

describe("garanzie della partita libera (composizione)", () => {

  const COMBOS: [number, number][] = [
    [10, 1],
    [10, 2],
    [10, 3],
    [15, 1],
    [15, 5],
    [20, 4],
    [30, 1],
    [30, 5],
  ];
  for (const [total, rounds] of COMBOS) {
    it(`${total} domande in ${rounds} round: votazione, ruota e canzone`, async () => {
      // un account per combinazione (limite di 6 partite ogni 10 minuti per account)
      const host = await makeHost("sempre");
      const r = await createPublicGame(host, { totalQuestions: total, rounds }, only);
      created.push(r.sessionId);
      expect(r.warnings.filter((w) => /votazione|canzoni/.test(w))).toEqual([]);
      const s = await shape(r.sessionId);
      const state = (await buildPublicState(sql, r.sessionId))!;
      expect(state.totalQuestions).toBe(total);

      // VOTAZIONE: esattamente un round a votazione, nel posto previsto, 3 materie con le stesse domande
      const votes = s.rounds.filter((x) => x.kind === "category_vote");
      expect(votes).toHaveLength(1);
      const vote = votes[0];
      expect(vote.position).toBe(freeVoteRoundIndex(rounds));
      expect(vote.options).toBe(3);
      const voteQs = s.qs.filter((q) => q.round_index === vote.position && !q.is_reserve);
      const per = new Map<string, number>();
      for (const q of voteQs) if (q.vote_option_id) per.set(q.vote_option_id, (per.get(q.vote_option_id) ?? 0) + 1);
      expect(per.size).toBe(3);
      const voted = rounds === 1 ? Math.min(FREE_SINGLE_ROUND_VOTED, Math.floor(total / 2)) : null;
      for (const n of per.values()) expect(n).toBe(voted ?? n);
      if (rounds > 1) {
        expect(voteQs.filter((q) => !q.vote_option_id)).toEqual([]);
        expect(vote.position).not.toBe(rounds - 1); // mai la finale
        if (rounds >= 3) expect(vote.position).toBeGreaterThan(0);
      } else {
        // round unico: le comuni vengono DOPO tutte quelle delle materie
        const lastVoted = Math.max(...voteQs.filter((q) => q.vote_option_id).map((q) => q.position));
        const common = voteQs.filter((q) => !q.vote_option_id);
        expect(common).toHaveLength(total - voted!);
        for (const q of common) expect(q.position).toBeGreaterThan(lastVoted);
      }

      // CANZONE: una sola, fuori dalle materie votate, mai prima del round, mai ultima della partita
      const played = playedOrder(s.qs, s.rounds);
      expect(played).toHaveLength(total);
      const songs = s.qs.filter((q) => q.media && !q.is_reserve);
      expect(songs).toHaveLength(1);
      expect(music).toContain(songs[0].question_id);
      expect(songs[0].vote_option_id).toBeNull();
      const idx = played.findIndex((q) => q.id === songs[0].id);
      expect(idx).toBeGreaterThan(0);
      expect(idx).toBeLessThan(total - 1);
      const roundPlayed = played.filter((q) => q.round_index === songs[0].round_index);
      expect(roundPlayed[0].id).not.toBe(songs[0].id);

      // RUOTA DI PALMINO: almeno una; mai sulla canzone né su una domanda delle materie votate
      const wheels = s.rounds.filter((x) => x.palmino_wheel);
      expect(wheels.length).toBeGreaterThanOrEqual(1);
      for (const w of wheels) {
        const slot = s.qs.find((q) => q.id === w.palmino_wheel!.slotSqId)!;
        expect(slot.media).toBe(false);
        expect(slot.vote_option_id).toBeNull();
        expect(w.palmino_wheel!.segments.length).toBeGreaterThanOrEqual(3);
        const n = played.findIndex((q) => q.id === slot.id) + 1;
        expect(n).toBeGreaterThanOrEqual(5);
        expect(n).toBeLessThan(total);
      }
    });
  }
});

describe("la canzone: prima quelle mai sentite, poi la meno recente", () => {
  it("sceglie la mai sentita; se le ha sentite tutte, la meno recente", async () => {
    const host = await makeHost("note");
    const [old] = await sql<{ id: string }[]>`
      insert into game_sessions (title, code, host_user_id, status) values ('Vecchia', ${`N${randomUUID().slice(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, "X")}`}, ${host.userId}, 'finished') returning id`;
    created.push(old.id);
    const heard = async (qid: string, at: string) =>
      sql`insert into question_plays (question_id, session_id, session_question_id, played_at, host_user_id) values (${qid}, ${old.id}, ${randomUUID()}, ${at}, ${host.userId})`;
    await heard(music[0], "2026-10-01T20:00:00Z");
    await heard(music[1], "2026-10-05T20:00:00Z");
    const songOf = async (sessionId: string) => (await sql<{ question_id: string }[]>`
      select sq.question_id from session_questions sq join question_bank qb on qb.id = sq.question_id
      where sq.session_id = ${sessionId} and qb.media_id is not null and not sq.is_reserve`)[0]?.question_id;
    const a = await createPublicGame(host, { totalQuestions: 10, rounds: 2 }, only);
    created.push(a.sessionId);
    expect(await songOf(a.sessionId)).toBe(music[2]);
    // ora le ha sentite tutte: la meno recente (la prima, sentita il 1° ottobre)
    await heard(music[2], "2026-11-01T20:00:00Z");
    const b = await createPublicGame(host, { totalQuestions: 10, rounds: 2 }, only);
    created.push(b.sessionId);
    expect(await songOf(b.sessionId)).toBe(music[0]);
    expect(b.warnings.some((w) => w.includes("canzoni"))).toBe(false);
  });

  it("archivio senza canzoni: la partita nasce lo stesso (con avviso)", async () => {
    const tag = `${TAG}-nomusic`;
    for (let i = 0; i < 40; i++) {
      await makeQuestion(`Senza musica ${tag} n. ${i}?`, ["Uno", "Due", "Tre", "Quattro"], [0], { category: CATS[i % 4], difficulty: (i % 5) + 1, tags: ["test-automatico", TAG, tag] });
    }
    const host = await makeHost("muto");
    const r = await createPublicGame(host, { totalQuestions: 10, rounds: 3 }, { onlyTag: tag });
    created.push(r.sessionId);
    expect(r.warnings.some((w) => w.includes("canzoni"))).toBe(true);
    const s = await shape(r.sessionId);
    expect(s.rounds.map((x) => x.kind)).toEqual(["standard", "category_vote", "final"]);
  });
});

describe("partita di un solo round: si gioca davvero (votazione, materia votata, comuni, ruota, canzone)", () => {
  it("dal voto al podio con i comandi del motore", async () => {
    const host = await makeHost("unico");
    const r = await createPublicGame(host, { totalQuestions: 10, rounds: 1 }, only);
    created.push(r.sessionId);
    const id = r.sessionId;
    const joined = await joinSession({ code: r.code, nickname: "Vota" }, { ip: "10.6.0.1", deviceToken: null });
    const player = await authenticatePlayer(sql, r.code, joined.participantToken);
    await hostCommand(host, id, "start");
    await cmd(id, "START_ROUND");
    const voting = await cmd(id, "START_VOTE");
    expect(voting.state.phase).toBe("CATEGORY_VOTING");
    const vote = voting.state.vote!;
    expect(vote.options).toHaveLength(3);
    // il giocatore vota la seconda materia: vince quella
    await submitVote(player, { roundId: vote.roundId, optionId: vote.options[1].id }, "10.6.0.1");
    const result = await cmd(id, "CLOSE_VOTE");
    expect(result.state.phase).toBe("CATEGORY_RESULT");
    expect(result.state.vote?.winnerOptionId).toBe(vote.options[1].id);
    const winner = vote.options[1].label;

    const seen: { category: string; audio: boolean; number: number }[] = [];
    let wheels = 0;
    let state: PublicState = result.state;
    for (let guard = 0; guard < 40 && seen.length < 10; guard++) {
      let shown = await cmd(id, "SHOW_QUESTION", state.phase === "WHEEL_SPIN" ? { force: true } : {});
      if (shown.state.phase === "WHEEL_SPIN") {
        wheels++;
        expect(shown.state.wheel?.kind).toBe("palmino");
        shown = await cmd(id, "SHOW_QUESTION", { force: true });
      }
      state = shown.state;
      expect(state.phase).toBe("QUESTION_VISIBLE");
      const q = state.question!;
      seen.push({ category: q.category, audio: q.media?.kind === "audio", number: q.number });
      if (q.media?.kind === "audio") {
        // scorrimento automatico: il passo alle risposte aspetta lettura + estratto (10 s)
        expect(state.auto?.nextAt).toBeTruthy();
        expect(Date.parse(state.auto!.nextAt!) - Date.parse(state.phaseStartedAt)).toBeGreaterThanOrEqual(10_000);
        expect(q.media.audioPlays).toBeGreaterThanOrEqual(1);
      }
      await cmd(id, "SHOW_OPTIONS");
      await cmd(id, "REVEAL", { force: true });
      state = (await cmd(id, "SCORE")).state;
    }
    expect(seen.map((x) => x.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // prima le 5 della materia votata, poi le comuni (fra cui la canzone, mai l'ultima)
    expect(seen.slice(0, 5).every((x) => x.category === winner)).toBe(true);
    expect(seen.filter((x) => x.audio)).toHaveLength(1);
    const song = seen.findIndex((x) => x.audio);
    expect(song).toBeGreaterThanOrEqual(5);
    expect(song).toBeLessThan(9);
    expect(wheels).toBe(1);
    expect(state.totalQuestions).toBe(10);
    expect((await cmd(id, "FINISH")).state.phase).toBe("FINISHED");

    // RIVINCITA: stesse garanzie
    const again = await rematchPublicGame(host, id, null, only);
    created.push(again.sessionId);
    const s = await shape(again.sessionId);
    expect(s.rounds.map((x) => x.kind)).toEqual(["category_vote"]);
    expect(s.rounds[0].palmino_wheel).not.toBeNull();
    expect(s.qs.filter((q) => q.media && !q.is_reserve)).toHaveLength(1);
    expect((await buildPublicState(sql, again.sessionId))!.totalQuestions).toBe(10);
  });
});
