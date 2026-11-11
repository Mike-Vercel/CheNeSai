/**
 * Test di carico: N giocatori virtuali sulla stessa partita.
 *   npx tsx scripts/load-test.ts --base http://localhost:3300 --players 200 [--realtime 200]
 *
 * Misura:
 *  - ingresso (POST /api/play/join) concorrente
 *  - consegna Realtime dello stato a K client (latenza dal comando)
 *  - invio risposte simultaneo (POST /api/play/answer) e correttezza
 *  - assegnazione punteggi (comando SCORE) con N giocatori
 * I comandi di regia sono eseguiti direttamente dal motore (stesso codice delle API).
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}
const BASE = arg("base", "http://localhost:3100");
const N = Number(arg("players", "100"));
const RT = Number(arg("realtime", String(Math.min(N, 200))));

function pct(values: number[], p: number) {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0;
}
function summary(label: string, ms: number[], errors: number) {
  console.log(
    `${label.padEnd(26)} n=${ms.length} err=${errors}  p50=${pct(ms, 50).toFixed(0)}ms  p95=${pct(ms, 95).toFixed(0)}ms  p99=${pct(ms, 99).toFixed(0)}ms  max=${Math.max(0, ...ms).toFixed(0)}ms`,
  );
}

async function main() {
  const { getSql } = await import("../src/lib/database/db");
  const { executeCommand } = await import("../src/lib/server/engine");
  const { buildPublishedSession, cleanupSession } = await import("../tests/support/fixtures");
  const actor = { userId: null, email: "loadtest@quizzone.local", ip: null };
  const cmd = (sessionId: string, command: Parameters<typeof executeCommand>[2]["command"], args = {}) =>
    executeCommand(sessionId, actor, { command, commandId: randomUUID(), args });

  console.log(`Base URL ${BASE} · giocatori ${N} · client realtime ${RT}`);
  const fx = await buildPublishedSession({ isTest: true, title: `Load test ${N}` });
  await cmd(fx.sessionId, "OPEN_LOBBY");

  // ---- ingresso concorrente ----
  const cookies: string[] = new Array(N);
  const joinMs: number[] = [];
  let joinErr = 0;
  await Promise.all(
    Array.from({ length: N }, async (_, i) => {
      const t0 = performance.now();
      try {
        const r = await fetch(`${BASE}/api/play/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": `10.1.${i >> 8}.${i & 255}` },
          body: JSON.stringify({ code: fx.code, nickname: `Giocatore ${i + 1}` }),
        });
        joinMs.push(performance.now() - t0);
        if (!r.ok) {
          joinErr++;
          return;
        }
        cookies[i] = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
      } catch {
        joinErr++;
      }
    }),
  );
  summary("join", joinMs, joinErr);

  // ---- client realtime ----
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const received = new Map<number, number[]>(); // version -> arrival times
  const clients = Array.from({ length: RT }, () => createClient(url, key, { auth: { persistSession: false } }));
  let subscribed = 0;
  await Promise.all(
    clients.map(
      (c) =>
        new Promise<void>((resolve) => {
          const ch = c.channel(`qz:game:${fx.sessionId}`, { config: { private: true } });
          ch.on("broadcast", { event: "state" }, (m) => {
            const v = (m.payload as { version: number }).version;
            const arr = received.get(v) ?? [];
            arr.push(performance.now());
            received.set(v, arr);
          });
          ch.subscribe((s) => {
            if (s === "SUBSCRIBED") {
              subscribed++;
              resolve();
            }
            if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") resolve();
          });
        }),
    ),
  );
  console.log(`realtime: ${subscribed}/${RT} client iscritti`);

  await cmd(fx.sessionId, "START_ROUND");
  await cmd(fx.sessionId, "SHOW_QUESTION");
  const tCmd = performance.now();
  const opened = await cmd(fx.sessionId, "SHOW_OPTIONS");
  const cmdMs = performance.now() - tCmd;
  await new Promise((r) => setTimeout(r, 3000));
  const arrivals = (received.get(opened.state.version) ?? []).map((t) => t - tCmd);
  summary("realtime SHOW_OPTIONS", arrivals, subscribed - arrivals.length);
  console.log(`comando SHOW_OPTIONS (transazione + broadcast): ${cmdMs.toFixed(0)}ms`);

  // ---- risposte simultanee ----
  const sq = opened.state.question!.id;
  const ansMs: number[] = [];
  let ansErr = 0;
  const errCodes = new Map<string, number>();
  await Promise.all(
    cookies.map(async (cookie, i) => {
      if (!cookie) return;
      const t0 = performance.now();
      try {
        const r = await fetch(`${BASE}/api/play/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie },
          body: JSON.stringify({ code: fx.code, sessionQuestionId: sq, positions: [i % 4], requestId: randomUUID() }),
        });
        ansMs.push(performance.now() - t0);
        if (!r.ok) {
          ansErr++;
          const body = (await r.json().catch(() => ({}))) as { error?: { code?: string } };
          errCodes.set(body.error?.code ?? String(r.status), (errCodes.get(body.error?.code ?? String(r.status)) ?? 0) + 1);
        }
      } catch {
        ansErr++;
      }
    }),
  );
  summary("answer (simultanee)", ansMs, ansErr);
  if (errCodes.size) console.log("errori risposte:", Object.fromEntries(errCodes));

  const sql = getSql();
  const [{ c }] = await sql<{ c: number }[]>`select count(*)::int as c from answer_submissions where session_question_id = ${sq}`;
  console.log(`risposte registrate nel DB: ${c}/${cookies.filter(Boolean).length}`);

  await cmd(fx.sessionId, "CLOSE_ANSWERS");
  await cmd(fx.sessionId, "REVEAL");
  const tScore = performance.now();
  const scored = await cmd(fx.sessionId, "SCORE");
  console.log(`SCORE con ${scored.result?.scored} giocatori: ${(performance.now() - tScore).toFixed(0)}ms`);

  for (const c of clients) await c.removeAllChannels();
  await cleanupSession(fx.sessionId);
  await sql`delete from question_bank where 'test-automatico' = any(tags)`;
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
