import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { settingsSchema, type PsycoAction, type PsycoSettings } from "@/lib/psyco/types";
import { runAction } from "@/lib/server/psyco/engine";
import { PsycoError } from "@/lib/server/psyco/errors";
import { createRoom, getRoomView, joinRoom, type PsycoUser } from "@/lib/server/psyco/rooms";

/**
 * PSYCO – «VERITÀ O FALSITÀ», contro il database locale:
 *  - l'archivio ha la famiglia «verita» con indizi completi per l'Investigatore;
 *  - con rules = "verita" l'archivio propone SOLO regole di verità o falsità (anche dopo vari «un'altra»);
 *  - con rules = "classiche" non ne propone mai; senza il campo (stanze di prima) vale «tutte».
 */
const sql = getSql();
const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const users: string[] = [];
const rooms: string[] = [];

async function makeUser(label: string): Promise<PsycoUser> {
  const email = `psyco-verita-${label}-${randomUUID().slice(0, 8)}@test.chenesai.local`;
  const r = await auth.auth.admin.createUser({ email, password: `Pw-${randomUUID()}`, email_confirm: true });
  if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
  users.push(r.data.user.id);
  return { userId: r.data.user.id, ip: null, username: label };
}

const act = (roomId: string, u: PsycoUser, a: PsycoAction) => runAction(roomId, { userId: u.userId, ip: null, asParticipantId: null }, a);

async function voteAll(roomId: string, voters: PsycoUser[], ballot: string, choice: string) {
  for (const x of voters) {
    try {
      await act(roomId, x, { action: "vote", ballot, choice });
    } catch (e) {
      if (!(e instanceof PsycoError && e.code === "STALE_BALLOT")) throw e;
    }
  }
}

let host: PsycoUser;
let p2: PsycoUser;
let p3: PsycoUser;

beforeAll(async () => {
  [host, p2, p3] = await Promise.all([makeUser("sara"), makeUser("mike"), makeUser("luca")]);
});

afterAll(async () => {
  if (rooms.length) await sql`delete from psyco_rooms where id = any(${sql.array(rooms)}::uuid[])`;
  for (const id of users) await auth.auth.admin.deleteUser(id);
});

/** Crea la stanza, entra in tre, avvia, vota la difficoltà e restituisce i temi delle regole proposte dopo `rejects` rifiuti. */
async function themesProposed(settings: PsycoSettings, difficulty: string, rejects: number): Promise<string[]> {
  const r = await createRoom(host, { mode: "personal", settings, hostNickname: "Sara" });
  rooms.push(r.roomId);
  await joinRoom(p2, r.code, "Mike");
  await joinRoom(p3, r.code, "Luca");
  const all = [host, p2, p3];
  await act(r.roomId, host, { action: "start_game" });
  const views = await Promise.all(all.map((u) => getRoomView(u, r.roomId, null)));
  const knowers = all.filter((_, i) => views[i].view.role !== "psyco");
  for (const u of all) await act(r.roomId, u, { action: "seen" });
  let s = (await getRoomView(host, r.roomId, null)).state;
  expect(s.phase).toBe("DIFFICULTY_VOTE");
  await voteAll(r.roomId, knowers, s.round!.vote!.ballot, difficulty);
  for (let i = 0; i < rejects; i++) {
    s = (await getRoomView(host, r.roomId, null)).state;
    expect(s.phase).toBe("RULE_VOTE");
    await voteAll(r.roomId, knowers, s.round!.vote!.ballot, "no");
  }
  const rows = await sql<{ theme: string }[]>`
    select ru.theme from psyco_candidates c join psyco_rules ru on ru.id = c.rule_id
    where c.room_id = ${r.roomId} and c.kind = 'archive' order by c.created_at`;
  return rows.map((x) => x.theme);
}

describe("PSYCO – VERITÀ O FALSITÀ", () => {
  it("l'archivio ha regole di verità o falsità in tutte le difficoltà, con i tre indizi", async () => {
    const rows = await sql<{ difficulty: string; n: number; complete: number }[]>`
      select difficulty, count(*)::int as n,
             count(*) filter (where hint_1 is not null and hint_2 is not null and hint_3 is not null)::int as complete
      from psyco_rules where active and theme = 'verita' group by difficulty`;
    const by = Object.fromEntries(rows.map((r) => [r.difficulty, r]));
    for (const d of ["facile", "media", "difficile"]) {
      expect(by[d]?.n ?? 0, d).toBeGreaterThanOrEqual(5);
      expect(by[d].complete, d).toBe(by[d].n);
    }
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from psyco_rules where slug in ('verita-grattati', 'primo-giro-bugie') and theme = 'verita'`;
    expect(n).toBe(2);
  });

  it("impostazioni: «rules» facoltativo (stanze di prima = tutte), valori fuori elenco rifiutati", () => {
    expect(settingsSchema.safeParse({ timerMs: 60_000, ruleMode: "auto", psycoPick: "auto" }).success).toBe(true);
    expect(settingsSchema.safeParse({ timerMs: 60_000, ruleMode: "auto", psycoPick: "auto", rules: "verita" }).success).toBe(true);
    expect(settingsSchema.safeParse({ timerMs: 60_000, ruleMode: "auto", psycoPick: "auto", rules: "bugie" }).success).toBe(false);
  });

  it("rules = verita: solo regole di verità o falsità, anche dopo vari «un'altra»", async () => {
    const themes = await themesProposed({ timerMs: 300_000, ruleMode: "auto", psycoPick: "auto", calls: 2, rules: "verita" }, "facile", 4);
    expect(themes.length).toBe(5);
    expect(new Set(themes)).toEqual(new Set(["verita"]));
  });

  it("rules = classiche: mai regole di verità o falsità", async () => {
    const themes = await themesProposed({ timerMs: 300_000, ruleMode: "auto", psycoPick: "auto", calls: 2, rules: "classiche" }, "difficile", 3);
    expect(themes.length).toBe(4);
    expect(new Set(themes)).toEqual(new Set(["classica"]));
  });
});
