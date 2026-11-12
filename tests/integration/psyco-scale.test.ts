import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import type { PsycoAction } from "@/lib/psyco/types";
import { runAction } from "@/lib/server/psyco/engine";
import { PsycoError } from "@/lib/server/psyco/errors";
import { createRoom, getRoomView, joinRoom, type PsycoUser } from "@/lib/server/psyco/rooms";
import { buildPublicState } from "@/lib/server/psyco/state";

/**
 * PSYCO senza un massimo di giocatori: prove simulate con 50 e 100 partecipanti VERI (account di
 * Supabase Auth locale), tutti che entrano, guardano il ruolo e votano NELLO STESSO MOMENTO.
 * Misura tempi e dimensione dello stato pubblico (= messaggio realtime) e verifica che lo stato resti
 * coerente (un solo PSYCO, nessun voto perso o doppio). I numeri vengono stampati: vedi docs/psyco/LIMITI.md.
 *
 * Come un client vero, chi riceve BUSY (lucchetto conteso oltre il limite) ritenta.
 */
const sql = getSql();
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const users: string[] = [];
const rooms: string[] = [];

afterAll(async () => {
  if (rooms.length) await sql`delete from psyco_rooms where id = any(${sql.array(rooms)}::uuid[])`;
  for (let i = 0; i < users.length; i += 20) await Promise.all(users.slice(i, i + 20).map((id) => auth.auth.admin.deleteUser(id)));
}, 180_000);

async function makeUsers(n: number): Promise<PsycoUser[]> {
  const out: PsycoUser[] = [];
  for (let i = 0; i < n; i += 10) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(10, n - i) }, async (_, j) => {
        const email = `psyco-scala-${i + j}-${randomUUID().slice(0, 8)}@test.chenesai.local`;
        const r = await auth.auth.admin.createUser({ email, password: `Pw-${randomUUID()}`, email_confirm: true });
        if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
        users.push(r.data.user.id);
        return { userId: r.data.user.id, ip: null, username: null } satisfies PsycoUser;
      }),
    );
    out.push(...batch);
  }
  return out;
}

let retries = 0;
async function withBusyRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof PsycoError && e.code === "BUSY" && i < 6) {
        retries++;
        await new Promise((r) => setTimeout(r, 150 * 2 ** i + Math.random() * 150));
        continue;
      }
      if (e instanceof PsycoError && e.code === "STALE_BALLOT") return null as T;
      throw e;
    }
  }
}

const act = (roomId: string, u: PsycoUser, a: PsycoAction) => withBusyRetry(() => runAction(roomId, { userId: u.userId, ip: null }, a));

async function timed<T>(label: string, metrics: Record<string, number>, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const r = await fn();
  metrics[label] = Math.round(performance.now() - t0);
  return r;
}

for (const N of [50, 100]) {
  describe(`PSYCO con ${N} partecipanti`, () => {
    it(`${N} account entrano, ruoli, voti e tentativo in contemporanea`, async () => {
      retries = 0;
      const m: Record<string, number> = {};
      const people = await makeUsers(N);
      const [host, ...others] = people;
      const r = await createRoom(host, { mode: "personal", settings: { timerMs: 5 * 60_000, ruleMode: "auto", psycoPick: "auto" }, hostNickname: "Host" });
      rooms.push(r.roomId);
      await timed("ingresso (tutti insieme)", m, () =>
        Promise.all(others.map((u, i) => withBusyRetry(() => joinRoom(u, r.code, `Giocatore ${i + 1}`)))),
      );
      let s = (await getRoomView(host, r.roomId)).state;
      expect(s.activeCount).toBe(N);
      m["stato pubblico (byte)"] = JSON.stringify(s).length;

      await timed("avvio manche", m, () => act(r.roomId, host, { action: "start_game" }));
      await timed("«ho visto il ruolo» (tutti insieme)", m, () => Promise.all(people.map((u) => act(r.roomId, u, { action: "seen" }))));
      const views = await timed("lettura vista privata (tutti insieme)", m, () => Promise.all(people.map((u) => getRoomView(u, r.roomId))));
      expect(views.filter((v) => v.view.role === "psyco")).toHaveLength(1);
      const psyco = people[views.findIndex((v) => v.view.role === "psyco")];
      const knowers = people.filter((u) => u !== psyco);
      s = views[0].state;
      expect(s.phase).toBe("DIFFICULTY_VOTE");

      // difficoltà: voti divisi (nessuno ha la maggioranza fino alla fine)
      const ballot = s.round!.vote!.ballot;
      await timed("voto difficoltà (tutti insieme)", m, () =>
        Promise.all(knowers.map((u, i) => act(r.roomId, u, { action: "vote", ballot, choice: ["facile", "media", "difficile"][i % 3] }))),
      );
      s = (await buildPublicState(sql, r.roomId))!;
      expect(s.phase).toBe("RULE_VOTE");
      const b2 = s.round!.vote!.ballot;
      await timed("voto sulla regola (tutti insieme)", m, () => Promise.all(knowers.map((u) => act(r.roomId, u, { action: "vote", ballot: b2, choice: "yes" }))));
      s = (await buildPublicState(sql, r.roomId))!;
      expect(s.phase).toBe("RULE_CONFIRMED");
      await timed("«pronto» (tutti insieme)", m, () => Promise.all(people.map((u) => act(r.roomId, u, { action: "ready" }))));
      s = (await buildPublicState(sql, r.roomId))!;
      expect(s.phase).toBe("PLAYING");
      await sql`update psyco_rounds set started_at = now() - interval '10 seconds' where room_id = ${r.roomId}`;
      await act(r.roomId, psyco, { action: "guess" });
      s = (await buildPublicState(sql, r.roomId))!;
      const gb = s.round!.vote!.ballot;
      await timed("voto sul tentativo (tutti insieme)", m, () =>
        Promise.all(knowers.map((u, i) => act(r.roomId, u, { action: "vote", ballot: gb, choice: i % 4 === 0 ? "no" : "yes" }))),
      );
      s = (await buildPublicState(sql, r.roomId))!;
      expect(s.phase).toBe("ROUND_END");
      expect(s.round!.outcome).toBe("guessed");
      m["stato pubblico finale (byte)"] = JSON.stringify(s).length;
      // nessun voto doppio
      const [{ dup }] = await sql<{ dup: number }[]>`
        select count(*)::int as dup from (select participant_id from psyco_votes v join psyco_rounds r on r.id = v.round_id
        where r.room_id = ${r.roomId} group by v.ballot, participant_id having count(*) > 1) x`;
      expect(dup).toBe(0);
      m["tentativi ripetuti per BUSY"] = retries;
      console.log(`\n[PSYCO ${N} partecipanti] tempi in ms:\n${Object.entries(m).map(([k, v]) => `  ${k}: ${v}`).join("\n")}`);
    }, 300_000);
  });
}
