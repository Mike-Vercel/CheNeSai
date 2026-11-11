import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getSql } from "@/lib/database/db";
import { createSession } from "@/lib/server/cms/sessions";
import type { VoiceConfig } from "@/lib/server/tts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { buildPublishedSession, cleanupSession, TEST_ACTOR } from "../support/fixtures";

/**
 * "Voci della serata" guidate dal TV (POST /api/display/[sessionId]/voices?k=…) con ElevenLabs
 * SIMULATO: nessuna chiamata vera, voci finte "test-voci-…" (chiavi di cache mai condivise con le
 * clip vere). Database e storage locali reali.
 */
const run = randomUUID().slice(0, 6);
const VOICE_PREFIX = `test-voci-${run}`;
const TONE = readFileSync(path.resolve(import.meta.dirname, "../fixtures/audio/tone-440.mp3"));
let budget = 10_000_000;

function testConfig(): VoiceConfig {
  const role = (r: string) => ({ voiceId: `${VOICE_PREFIX}-${r}`, voiceName: null, stability: 0.5, similarity: 0.8, style: 0.3, speed: 1 });
  return {
    monthlyBudgetChars: budget,
    namesMode: "spliced",
    roles: { professore: role("professore"), regina: role("regina"), palmino: role("palmino"), annunciatore: role("annunciatore") },
  };
}

// configurazione delle voci di prova (il resto del modulo resta vero)
vi.mock("@/lib/server/tts", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server/tts")>();
  return { ...real, loadVoiceConfig: async () => testConfig() };
});

const { POST } = await import("@/app/api/display/[sessionId]/voices/route");
const { sessionLines } = await import("@/lib/server/tts-pregen");

const sql = getSql();
let sessionId: string;
let displayKey: string;
let otherId: string;
let otherKey: string;
let synthesized: string[] = [];
let realKey: string | undefined;
let realFetch: typeof fetch;

async function call(id: string, k: string | null, body: unknown) {
  const url = `http://localhost/api/display/${id}/voices${k === null ? "" : `?k=${encodeURIComponent(k)}`}`;
  const res = await POST(new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), {
    params: Promise.resolve({ sessionId: id }),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  realKey = process.env.ELEVENLABS_API_KEY;
  process.env.ELEVENLABS_API_KEY = "test-chiave-finta";
  realFetch = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("https://api.elevenlabs.io")) return realFetch(input, init);
    const body = JSON.parse(String(init?.body)) as { text: string };
    synthesized.push(body.text);
    return new Response(new Uint8Array(TONE), { status: 200, headers: { "Content-Type": "audio/mpeg", "character-cost": String(body.text.length) } });
  });
  const f = await buildPublishedSession({ isTest: true, title: `Voci TV ${run}` });
  sessionId = f.sessionId;
  [{ display_key: displayKey }] = await sql<{ display_key: string }[]>`select display_key from game_sessions where id = ${sessionId}`;
  otherId = await createSession({ title: `Altra serata ${run}`, isTest: true, settings: {} }, TEST_ACTOR);
  [{ display_key: otherKey }] = await sql<{ display_key: string }[]>`select display_key from game_sessions where id = ${otherId}`;
});

beforeEach(() => {
  synthesized = [];
  budget = 10_000_000;
});

afterAll(async () => {
  vi.restoreAllMocks();
  process.env.ELEVENLABS_API_KEY = realKey;
  const rows = await sql<{ storage_path: string }[]>`delete from tts_clips where voice_id like ${VOICE_PREFIX + "%"} returning storage_path`;
  if (rows.length) await getSupabaseAdmin().storage.from("tts").remove(rows.map((r) => r.storage_path));
  await sql`delete from rate_limits where bucket = ${"tts-voices:" + sessionId}`.catch(() => undefined);
  if (sessionId) await cleanupSession(sessionId);
  if (otherId) await cleanupSession(otherId);
});

describe("voci della serata dal TV (ElevenLabs simulato)", () => {
  it("serve la chiave dello schermo di QUELLA serata", async () => {
    expect((await call(sessionId, null, { action: "estimate" })).status).toBe(403);
    expect((await call(sessionId, "chiave-sbagliata", { action: "estimate" })).status).toBe(403);
    // chiave valida ma di un'altra serata
    const cross = await call(sessionId, otherKey, { action: "run", batch: 4 });
    expect(cross.status).toBe(403);
    expect(cross.json).toMatchObject({ error: { code: "BAD_DISPLAY_KEY" } });
    expect(synthesized).toEqual([]);
  });

  it("stima: battute della serata, nessuna spesa e nessun dato del budget", async () => {
    const r = await call(sessionId, displayKey, { action: "estimate" });
    expect(r.status).toBe(200);
    expect(r.json.configured).toBe(true);
    expect(r.json.total).toBeGreaterThan(10);
    expect(r.json.missing).toBe(r.json.total);
    expect(r.json).not.toHaveProperty("budget");
    expect(r.json).not.toHaveProperty("remainingBudget");
    expect(synthesized).toEqual([]);
  });

  it("lotto: genera solo battute di questa serata, al massimo `batch`", async () => {
    const r = await call(sessionId, displayKey, { action: "run", batch: 3 });
    expect(r.status).toBe(200);
    expect(r.json.generated).toBe(3);
    expect(synthesized).toHaveLength(3);
    const own = new Set((await sessionLines(sql, sessionId)).map((l) => l.text.replace(/\s+/g, " ").trim()));
    // ogni testo inviato a ElevenLabs è una battuta della serata (a meno degli audio tag tolti dal modello)
    for (const t of synthesized) expect([...own].some((l) => l.includes(t.replace(/\[[^\]]*\]\s*/g, "").trim().slice(0, 20)))).toBe(true);
    const after = await call(sessionId, displayKey, { action: "estimate" });
    expect(after.json.ready).toBe(3);
    // oltre il massimo per lotto: rifiutato
    expect((await call(sessionId, displayKey, { action: "run", batch: 50 })).status).toBe(422);
  });

  it("budget mensile esaurito: si ferma (blocked) senza chiamare ElevenLabs", async () => {
    budget = 0;
    const r = await call(sessionId, displayKey, { action: "run", batch: 4 });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ generated: 0, blocked: true });
    expect(synthesized).toEqual([]);
  });

  it("partita finita: niente da preparare", async () => {
    await sql`update game_state set phase = 'FINISHED' where session_id = ${sessionId}`;
    const r = await call(sessionId, displayKey, { action: "run", batch: 4 });
    expect(r.json).toMatchObject({ finished: true });
    expect(synthesized).toEqual([]);
  });

  it("voce professionale spenta: nessuna preparazione", async () => {
    process.env.ELEVENLABS_API_KEY = "";
    const r = await call(sessionId, displayKey, { action: "estimate" });
    process.env.ELEVENLABS_API_KEY = "test-chiave-finta";
    expect(r.json).toMatchObject({ configured: false, total: 0 });
  });
});
