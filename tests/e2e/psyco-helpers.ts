import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import postgres from "postgres";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

config({ path: ".env.local", quiet: true });

/** Utenti e stanze creati dai test PSYCO (eliminati alla fine). */
export const created = { users: [] as string[] };

export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

export interface TestUser {
  id: string;
  email: string;
  password: string;
  username: string;
}

/** Account vero (Supabase Auth locale) con username del sito. */
export async function makeUser(label: string): Promise<TestUser> {
  const username = `${label}_${randomUUID().slice(0, 6)}`.slice(0, 20);
  const email = `${username}@test.chenesai.local`;
  const password = `Prova-${randomUUID().slice(0, 12)}`;
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
  created.users.push(r.data.user.id);
  const sql = db();
  try {
    await sql`insert into host_profiles (user_id, username) values (${r.data.user.id}, ${username})`;
  } finally {
    await sql.end();
  }
  return { id: r.data.user.id, email, password, username };
}

export function db() {
  return postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, onnotice: () => {} });
}

export async function cleanup(extraEmails: string[] = []) {
  const sql = db();
  try {
    if (extraEmails.length) {
      const rows = await sql<{ id: string }[]>`select id from auth.users where email in ${sql(extraEmails)}`;
      created.users.push(...rows.map((r) => r.id));
    }
    if (created.users.length) await sql`delete from psyco_rooms where owner_user_id in ${sql(created.users)}`;
  } finally {
    await sql.end();
  }
  for (const id of created.users.splice(0)) await admin.auth.admin.deleteUser(id).catch(() => undefined);
}

/** Accesso dal modulo del sito (stesso login di CHE NE SAI?!), poi ritorno a `next`. */
export async function login(page: Page, u: TestUser, next: string) {
  await page.goto(`/accedi?modo=accedi&next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "ACCEDI", exact: true }).click();
}

export const SHOTS = process.env.PSYCO_SHOTS_DIR ?? path.join("test-results", "psyco-shots");
mkdirSync(SHOTS, { recursive: true });
export async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
export const PC = { viewport: { width: 1440, height: 900 } };
export const TV = { viewport: { width: 1920, height: 1080 } };

export async function newPage(browser: Browser, opts: Parameters<Browser["newContext"]>[0] = {}): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  return { ctx, page };
}

/**
 * Registra TUTTO ciò che arriva a una pagina: risposte HTTP delle API PSYCO e frame del websocket
 * realtime. Serve a dimostrare che lo PSYCO e lo schermo non ricevono mai il testo della regola.
 */
export function recordTraffic(page: Page) {
  const chunks: string[] = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("/api/psyco/")) return;
    try {
      chunks.push(`${url}\n${await res.text()}`);
    } catch {
      /* risposta senza corpo */
    }
  });
  page.on("websocket", (ws) => {
    ws.on("framereceived", (f) => chunks.push(typeof f.payload === "string" ? f.payload : f.payload.toString("utf8")));
  });
  return {
    all: () => chunks.join("\n"),
    chunks: () => [...chunks],
    count: () => chunks.length,
  };
}

/** Testo della regola segreta della manche in corso (letto dal database, per i controlli). */
export async function currentRuleText(roomId: string): Promise<string | null> {
  const sql = db();
  try {
    const [r] = await sql<{ rule_text: string | null }[]>`
      select rr.rule_text from psyco_rooms r join psyco_rounds rr on rr.id = r.current_round_id where r.id = ${roomId}`;
    return r?.rule_text ?? null;
  } finally {
    await sql.end();
  }
}

export async function candidateTexts(roomId: string): Promise<string[]> {
  const sql = db();
  try {
    const rows = await sql<{ text: string }[]>`select text from psyco_candidates where room_id = ${roomId}`;
    return rows.map((r) => r.text);
  } finally {
    await sql.end();
  }
}

export async function expectNoSecrets(traffic: { all: () => string }, secrets: string[]) {
  const all = traffic.all();
  for (const s of secrets) expect(all.includes(s), `segreto ricevuto: «${s.slice(0, 60)}»`).toBe(false);
}
