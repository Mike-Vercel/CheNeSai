import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { getSql } from "@/lib/database/db";
import type { PublicState } from "@/lib/game-engine/types";
import { buildPublishedSession, cleanupSession, cmd, type Fixture } from "../support/fixtures";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

let fx: Fixture;
const clients: SupabaseClient[] = [];

function anonClient() {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  clients.push(c);
  return c;
}

function subscribe(c: SupabaseClient, topic: string, onMsg: (event: string, payload: unknown) => void): Promise<RealtimeChannel> {
  return new Promise((resolve, reject) => {
    const ch = c.channel(topic, { config: { private: true, broadcast: { self: true } } });
    ch.on("broadcast", { event: "*" }, (m) => onMsg(m.event, m.payload));
    ch.subscribe((s, err) => {
      if (s === "SUBSCRIBED") resolve(ch);
      if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") reject(err ?? new Error(s));
    });
  });
}

beforeAll(async () => {
  fx = await buildPublishedSession({ isTest: true });
});

afterAll(async () => {
  for (const c of clients) await c.removeAllChannels();
  await cleanupSession(fx.sessionId);
  await getSql()`delete from question_bank where 'test-automatico' = any(tags)`;
  await getSql().end();
});

describe("Realtime: canale privato di gioco", () => {
  it("TV e telefoni ricevono lo stato pubblicato dalla transazione del server", async () => {
    const received: PublicState[] = [];
    const tv = anonClient();
    const phone = anonClient();
    const phoneMsgs: PublicState[] = [];
    await subscribe(tv, `qz:game:${fx.sessionId}`, (ev, p) => ev === "state" && received.push(p as PublicState));
    await subscribe(phone, `qz:game:${fx.sessionId}`, (ev, p) => ev === "state" && phoneMsgs.push(p as PublicState));
    const out = await cmd(fx.sessionId, "OPEN_LOBBY");
    const deadline = Date.now() + 8000;
    while ((received.length === 0 || phoneMsgs.length === 0) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    expect(received.at(-1)?.version).toBe(out.state.version);
    expect(received.at(-1)?.phase).toBe("LOBBY");
    expect(phoneMsgs.at(-1)?.version).toBe(out.state.version);
  });

  it("un client non può trasmettere messaggi falsi agli altri", async () => {
    const victimMsgs: unknown[] = [];
    const victim = anonClient();
    await subscribe(victim, `qz:game:${fx.sessionId}`, (ev, p) => ev === "state" && victimMsgs.push(p));
    const attacker = anonClient();
    const ch = await subscribe(attacker, `qz:game:${fx.sessionId}`, () => {});
    // L'ack del websocket può essere "ok", ma la policy RLS impedisce la consegna.
    await ch.send({ type: "broadcast", event: "state", payload: { version: 999999, phase: "FINISHED", fake: true } });
    await new Promise((r) => setTimeout(r, 1500));
    // un comando legittimo invece arriva: il canale della vittima funziona
    const legit = await cmd(fx.sessionId, "SET_JOIN", { joinLocked: true });
    const deadline = Date.now() + 8000;
    while (!victimMsgs.some((m) => (m as PublicState).version === legit.state.version) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(victimMsgs.some((m) => (m as PublicState).version === legit.state.version)).toBe(true);
    expect(victimMsgs.some((m) => (m as { fake?: boolean }).fake)).toBe(false);
  });
});
