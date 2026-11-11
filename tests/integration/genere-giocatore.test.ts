import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSql } from "@/lib/database/db";
import { joinSession } from "@/lib/server/players";
import { importAllLibraries, syncGenderVariants } from "@/lib/server/show";
import { buildPublishedSession, cleanupSession, cmd, type Fixture } from "../support/fixtures";

const sql = getSql();
const fixtures: Fixture[] = [];
const genderOf = async (id: string) => (await sql<{ g: string | null }[]>`select gender as g from participants where id = ${id}`)[0].g;

beforeAll(async () => {
  await importAllLibraries(sql);
  for (let i = 0; i < 2; i++) {
    const fx = await buildPublishedSession({ isTest: true });
    await cmd(fx.sessionId, "OPEN_LOBBY");
    fixtures.push(fx);
  }
});

afterAll(async () => {
  for (const fx of fixtures) await cleanupSession(fx.sessionId);
  await sql`delete from question_bank where 'test-automatico' = any(tags)`;
  await sql.end();
});

describe("genere del giocatore", () => {
  it("si sceglie all'ingresso (facoltativo); il rientro lo mantiene; il codice giocatore lo porta nella serata dopo", async () => {
    const [a, b] = fixtures;
    const anna = await joinSession({ code: a.code, nickname: "Anna", gender: "f" }, { ip: "10.0.0.20", deviceToken: null });
    expect(await genderOf(anna.participantId)).toBe("f");
    const ugo = await joinSession({ code: a.code, nickname: "Ugo" }, { ip: "10.0.0.20", deviceToken: null });
    expect(await genderOf(ugo.participantId)).toBeNull();
    const ale = await joinSession({ code: a.code, nickname: "Ale", gender: "n" }, { ip: "10.0.0.20", deviceToken: null });
    expect(await genderOf(ale.participantId)).toBeNull();

    // rientro nella stessa serata con il codice giocatore: stesso partecipante, stesso genere
    const again = await joinSession({ code: a.code, nickname: "Anna", recoveryCode: anna.recoveryCode, gender: "m" }, { ip: "10.0.0.20", deviceToken: null });
    expect(again.rejoined).toBe(true);
    expect(await genderOf(again.participantId)).toBe("f");

    // un'altra serata con il codice giocatore e senza scegliere: si tiene l'ultima scelta
    const next = await joinSession({ code: b.code, nickname: "Anna", recoveryCode: anna.recoveryCode }, { ip: "10.0.0.20", deviceToken: null });
    expect(await genderOf(next.participantId)).toBe("f");
  });

  it("le varianti per genere arrivano anche sulle battute già in archivio (testo invariato)", async () => {
    await sql`update dialogue_templates set text_f = null, text_n = null where id = 'palmino-new-last-01' and text = '{nome_ultimo}, ma sei venuto a giocare o a fare presenza?!'`;
    await syncGenderVariants(sql, true);
    const [row] = await sql<{ text: string; text_f: string | null; text_n: string | null }[]>`select text, text_f, text_n from dialogue_templates where id = 'palmino-new-last-01'`;
    expect(row.text).toBe("{nome_ultimo}, ma sei venuto a giocare o a fare presenza?!");
    expect(row.text_f).toBe("{nome_ultimo}, ma sei venuta a giocare o a fare presenza?!");
    expect(row.text_n).toBe("{nome_ultimo}, ma sei qui per giocare o per fare presenza?!");
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from dialogue_templates where text_f is not null`;
    expect(n).toBeGreaterThanOrEqual(29);
  });
});
