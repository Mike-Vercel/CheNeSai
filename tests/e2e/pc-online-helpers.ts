import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import postgres from "postgres";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

config({ path: ".env.local", quiet: true });

/**
 * Aiuti per gli e2e delle partite ONLINE dal PC: account veri (Supabase Auth locale), accesso dal
 * modulo del sito, lettura dello stato dal database e «Avanti» dell'host per non aspettare i tempi
 * dello show.
 */
export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const createdUsers: string[] = [];

export interface TestUser {
  id: string;
  email: string;
  password: string;
  username: string;
}

export function db() {
  return postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, onnotice: () => {} });
}

export async function makeUser(label: string): Promise<TestUser> {
  const username = `${label}_${randomUUID().slice(0, 6)}`.slice(0, 20);
  const email = `${username.toLowerCase()}@test.chenesai.local`;
  const password = `Prova-${randomUUID().slice(0, 12)}`;
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
  createdUsers.push(r.data.user.id);
  const sql = db();
  try {
    await sql`insert into host_profiles (user_id, username) values (${r.data.user.id}, ${username})`;
  } finally {
    await sql.end();
  }
  return { id: r.data.user.id, email, password, username };
}

export async function cleanupUsers() {
  const sql = db();
  try {
    if (createdUsers.length) {
      await sql`delete from question_plays where host_user_id in ${sql(createdUsers)}`;
      await sql.begin(async (tx) => {
        await tx`select set_config('qz.allow_reset', 'on', true)`;
        await tx`select set_config('qz.allow_frozen_write', 'on', true)`;
        await tx`delete from game_sessions where host_user_id in ${tx(createdUsers)}`;
      });
    }
  } finally {
    await sql.end();
  }
  for (const id of createdUsers.splice(0)) await admin.auth.admin.deleteUser(id).catch(() => undefined);
}

/** Accesso dal modulo del sito, poi ritorno a `next`. */
export async function login(page: Page, u: TestUser, next: string) {
  await page.goto(`/accedi?modo=accedi&next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "ACCEDI", exact: true }).click();
}

export const PC = { viewport: { width: 1440, height: 900 } };
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" };

export async function newPage(browser: Browser, opts: Parameters<Browser["newContext"]>[0] = PC): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  return { ctx, page };
}

export const SHOTS = process.env.QZ_SHOTS_DIR ?? path.join("test-results", "pc-online-shots");
mkdirSync(SHOTS, { recursive: true });
export async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

export interface GameRow {
  phase: string;
  version: number;
  question: number | null;
  sqId: string | null;
  code: string;
}

export async function gameRow(sessionId: string): Promise<GameRow> {
  const sql = db();
  try {
    const [r] = await sql<{ phase: string; version: number; play_order: number | null; sq: string | null; code: string }[]>`
      select gs.phase, gs.version::int as version, sq.play_order, gs.current_session_question_id as sq, s.code
      from game_state gs join game_sessions s on s.id = gs.session_id
      left join session_questions sq on sq.id = gs.current_session_question_id
      where gs.session_id = ${sessionId}`;
    return { phase: r.phase, version: r.version, question: r.play_order, sqId: r.sq, code: r.code };
  } finally {
    await sql.end();
  }
}

/** «Avanti» dell'host (stessa API del menu), finché `done` non è vero. */
export async function advance(host: Page, sessionId: string, done: (g: GameRow) => boolean, opts: { max?: number; pauseMs?: number } = {}): Promise<GameRow> {
  const max = opts.max ?? 40;
  for (let i = 0; i < max; i++) {
    const g = await gameRow(sessionId);
    if (done(g)) return g;
    await host.request.post(`/api/gioca/games/${sessionId}/command`, { data: { action: "next" } }).catch(() => undefined);
    await host.waitForTimeout(opts.pauseMs ?? 900);
  }
  const g = await gameRow(sessionId);
  expect(done(g), `stato non raggiunto: ${JSON.stringify(g)}`).toBe(true);
  return g;
}

/** Aspetta (senza comandi) che la partita arrivi a uno stato: lo scorrimento automatico la porta avanti. */
export async function waitFor(sessionId: string, done: (g: GameRow) => boolean, timeoutMs = 90_000): Promise<GameRow> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const g = await gameRow(sessionId);
    if (done(g)) return g;
    if (Date.now() > until) throw new Error(`stato non raggiunto in ${timeoutMs} ms: ${JSON.stringify(g)}`);
    await new Promise((r) => setTimeout(r, 700));
  }
}

/** La domanda in corso diventa a risposta multipla con due risposte giuste (A e B). */
export async function forceMultiple(sqId: string) {
  const sql = db();
  try {
    await sql.begin(async (tx) => {
      await tx`select set_config('qz.allow_frozen_write', 'on', true)`;
      await tx`update question_snapshots set type = 'multiple', correct_positions = '{0,1}', partial_scoring = true where session_question_id = ${sqId}`;
    });
  } finally {
    await sql.end();
  }
}

export async function points(sessionId: string): Promise<Record<string, number>> {
  const sql = db();
  try {
    const rows = await sql<{ nickname: string; points: number }[]>`
      select p.nickname, coalesce(t.points, 0) as points from participants p left join score_totals t on t.participant_id = p.id
      where p.session_id = ${sessionId} and p.status = 'active'`;
    return Object.fromEntries(rows.map((r) => [r.nickname, r.points]));
  } finally {
    await sql.end();
  }
}

/** Partita online creata dall'host con l'API del sito (come «CREA PARTITA» → ONLINE). */
export async function createOnlineGame(host: Page): Promise<string> {
  const r = await host.request.post("/api/gioca/games", { data: { totalQuestions: 10, rounds: 2, mix: "facile" } });
  expect(r.ok(), await r.text()).toBe(true);
  const { sessionId } = (await r.json()) as { sessionId: string };
  await host.goto(`/gioca/online/${sessionId}`);
  return sessionId;
}

/** Il giocatore entra da /play/CODICE con il suo account (accesso → ritorno → nickname proposto). */
export async function joinWithAccount(page: Page, u: TestUser, code: string) {
  await page.goto(`/play/${code}`);
  await expect(page.getByText("Partita ONLINE")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Ho già un account" }).click();
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "ACCEDI", exact: true }).click();
  await page.waitForURL(new RegExp(`/play/${code}$`), { timeout: 60_000 });
  await expect(page.getByLabel("Scegli il tuo nickname")).toHaveValue(u.username, { timeout: 30_000 });
  await page.getByRole("button", { name: "ENTRA E GIOCA!" }).click();
  await expect(page.getByText(new RegExp(`Sei dentro come ${u.username}`))).toBeVisible({ timeout: 30_000 });
}

/** Risposte dello show interattivo (tasti 1–4 indicati sulle barre). */
export const answer = (page: Page, n: number) => page.locator(`button[aria-keyshortcuts='${n}']`).first();
