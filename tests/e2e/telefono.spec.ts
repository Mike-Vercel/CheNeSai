import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import postgres from "postgres";
import { devices, expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * Partita creata dal TELEFONO (390×844):
 *  B. «Su questo telefono»: tutto lo show in verticale; l'host entra anche come giocatore, invita,
 *     preme INIZIA PARTITA, vede l'intro e risponde alla prima domanda toccandola sullo show.
 *  A. «Sul televisore»: la pagina /tv mostra un codice di 4 cifre, l'host lo scrive sul telefono,
 *     il TV diventa lo schermo della partita e il telefono il telecomando (anche l'audio del TV).
 * Screenshot (QZ_SHOTS_DIR=cartella): scelta, lobby/intro/domanda/soluzione/podio in verticale,
 * pagina /tv e telecomando.
 */
config({ path: ".env.local", quiet: true });

const username = `tel_${randomUUID().slice(0, 8)}`;
const email = `${username}@test.chenesai.local`;
const password = `Prova-${randomUUID().slice(0, 12)}`;
let userId = "";

const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: devices["Pixel 7"].userAgent,
};

const SHOTS = process.env.QZ_SHOTS_DIR ?? null;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.error || !r.data.user) throw r.error ?? new Error("utente non creato");
  userId = r.data.user.id;
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  try {
    await sql`insert into host_profiles (user_id, username) values (${userId}, ${username})`;
  } finally {
    await sql.end();
  }
});

test.afterAll(async () => {
  if (!userId) return;
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  try {
    await sql`delete from question_plays where host_user_id = ${userId}`;
    await sql`delete from tv_pairings where claimed_by = ${userId}`;
    await sql.begin(async (tx) => {
      await tx`select set_config('qz.allow_reset', 'on', true)`;
      await tx`select set_config('qz.allow_frozen_write', 'on', true)`;
      await tx`delete from game_sessions where host_user_id = ${userId}`;
    });
  } finally {
    await sql.end();
  }
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  await admin.auth.admin.deleteUser(userId);
});

async function phoneHost(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  await page.goto("/accedi?modo=accedi&next=/gioca");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "ACCEDI" }).click();
  await page.waitForURL(/\/gioca$/, { timeout: 60_000 });
  return { ctx, page };
}

/** Dal telefono: 10 domande in 2 round → CREA PARTITA → scelta dello schermo. */
async function createFromPhone(page: Page): Promise<string> {
  await expect(page.getByText("Dopo scegli dove giocare")).toBeVisible();
  await page.getByRole("button", { name: "10", exact: true }).click();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.getByRole("button", { name: "CREA PARTITA" }).click();
  await page.waitForURL(/\/gioca\/schermo\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  return page.url().split("/").pop()!;
}

test("modalità B: tutto lo show sul telefono in verticale, l'host gioca dallo stesso schermo", async ({ browser }) => {
  test.setTimeout(300_000);
  const { ctx, page } = await phoneHost(browser);
  const sessionId = await createFromPhone(page);
  await expect(page.getByRole("heading", { name: "Dove giochiamo?" })).toBeVisible();
  await shot(page, "B0-scelta-schermo");

  await page.getByRole("button", { name: /Su questo telefono/ }).click();
  await page.waitForURL(new RegExp(`/gioca/telefono/${sessionId}$`));
  await expect(page.getByAltText(/QR code per entrare/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /INVITA AMICI/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /INIZIA PARTITA/ })).toBeDisabled();
  // invito: alternative a WhatsApp, link e QR
  await page.getByRole("button", { name: "Altri modi per invitare" }).click();
  await expect(page.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=.*%2Fplay%2F[A-Z0-9]{6}/);

  // l'host entra anche come giocatore (nickname = username)
  await expect(page.getByLabel(/Giochi anche tu/)).toHaveValue(username);
  await page.getByRole("button", { name: "GIOCO ANCH'IO" }).click();
  await expect(page.getByText(/Giochi anche tu come/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /INIZIA PARTITA/ })).toBeEnabled({ timeout: 20_000 });
  // audio: già attivo (il tocco su «Su questo telefono» lo ha sbloccato), altrimenti un tocco
  const audioBtn = page.getByRole("button", { name: /TOCCA PER L'AUDIO/ });
  if (await audioBtn.isVisible()) await audioBtn.click();
  await shot(page, "B1-lobby-verticale");

  // INIZIA PARTITA → intro ricomposta in verticale
  await page.getByRole("button", { name: /INIZIA PARTITA/ }).click();
  await expect(page.locator("[data-intro-mode]")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(9000);
  await shot(page, "B2-intro-verticale");
  await page.waitForTimeout(14_000);
  await shot(page, "B2b-intro-presentatori");
  await page.waitForTimeout(9_000);
  await shot(page, "B2c-intro-regole");

  // "Avanti" dal menu fino alla prima domanda
  for (let i = 0; i < 4; i++) {
    if (await page.getByText(/^1\/10$/).isVisible()) break;
    await page.getByRole("button", { name: "Impostazioni" }).click();
    const next = page.getByRole("dialog", { name: "Impostazioni" }).getByRole("button", { name: /Avanti/ });
    if (await next.isVisible()) await next.click();
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: "Chiudi", exact: true }).click();
    await page.waitForTimeout(600);
  }
  await expect(page.getByText(/^1\/10$/)).toBeVisible({ timeout: 60_000 });
  // risposte aperte: l'host tocca la prima direttamente sullo show
  const first = page.locator("button[aria-pressed]").first();
  await expect(first).toBeEnabled({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await shot(page, "B3-domanda-verticale");
  await first.click();
  await expect(page.getByText("RISPOSTA REGISTRATA!")).toBeVisible({ timeout: 20_000 });
  await shot(page, "B4-risposta-data");

  // soluzione
  await page.getByRole("button", { name: "Impostazioni" }).click();
  await page.getByRole("dialog", { name: "Impostazioni" }).getByRole("button", { name: /Avanti/ }).click({ timeout: 10_000 }).catch(() => undefined);
  await page.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(page.getByText(/Esatta!|Sbagliata…|Quasi!/)).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(1200);
  await shot(page, "B5-soluzione-verticale");

  // termina → podio in verticale
  await page.getByRole("button", { name: "Impostazioni" }).click();
  await page.getByRole("button", { name: "Termina partita" }).click();
  await page.getByRole("button", { name: "Sì, termina" }).click();
  await page.getByRole("button", { name: "Chiudi", exact: true }).click({ timeout: 5000 }).catch(() => undefined);
  await expect(page.getByRole("button", { name: /RIVINCITA/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("I CAMPIONI DELLA SERATA")).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(2500);
  await shot(page, "B6-podio-verticale");

  // anche a 1080×1920
  const big = await browser.newContext({ ...PHONE, viewport: { width: 360, height: 640 }, storageState: await ctx.storageState() });
  const bp = await big.newPage();
  await bp.goto(`/gioca/telefono/${sessionId}`);
  await expect(bp.getByText("I CAMPIONI DELLA SERATA")).toBeVisible({ timeout: 60_000 });
  await bp.waitForTimeout(2000);
  await shot(bp, "B7-podio-1080x1920");
  await big.close();
  await ctx.close();
});

test("modalità A: il televisore (/tv) si collega con un codice di 4 cifre, il telefono fa da telecomando", async ({ browser }) => {
  test.setTimeout(240_000);
  const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await tvCtx.newPage();
  await tv.goto("/tv");
  const codeBox = tv.getByRole("status", { name: /^Codice \d \d \d \d$/ });
  await expect(codeBox).toBeVisible({ timeout: 30_000 });
  await tv.waitForTimeout(1500);
  const tvCode = ((await codeBox.getAttribute("aria-label")) ?? "").replace(/\D/g, "");
  expect(tvCode).toMatch(/^\d{4}$/);
  await expect(tv.getByAltText("QR per collegare il telefono")).toBeVisible();
  await shot(tv, "A1-tv-codice");

  const { ctx, page } = await phoneHost(browser);
  const sessionId = await createFromPhone(page);
  await page.getByRole("button", { name: /Sul televisore/ }).click();
  await page.waitForURL(new RegExp(`/gioca/telecomando/${sessionId}$`));
  await expect(page.getByText("TV non collegato")).toBeVisible();
  // codice sbagliato: errore chiaro
  await page.getByLabel("Codice del televisore").fill(tvCode === "0000" ? "0001" : "0000");
  await page.getByRole("button", { name: "COLLEGA" }).click();
  await expect(page.getByText(/Codice non valido o scaduto/)).toBeVisible();
  await shot(page, "A2-telecomando-collega");
  await page.getByLabel("Codice del televisore").fill(tvCode);
  await page.getByRole("button", { name: "COLLEGA" }).click();

  // il TV diventa lo schermo della partita (lobby con QR e codice) e il telefono lo vede collegato
  await expect(tv.getByAltText(/QR code per entrare/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("TV collegato")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /INIZIA PARTITA/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /INVITA AMICI/ })).toBeVisible();
  await shot(tv, "A3-tv-collegato");
  await shot(page, "A4-telecomando");

  // audio del TV dal telefono: "Tutto muto" arriva al TV in pochi secondi
  await page.getByRole("switch", { name: /Tutto muto/ }).check({ force: true });
  await expect.poll(async () => tv.evaluate(() => JSON.parse(localStorage.getItem("qz.tv.prefs") ?? "{}").muted === true), { timeout: 20_000 }).toBe(true);
  // ricaricando il TV resta abbinato alla stessa partita
  await tv.reload();
  await expect(tv.getByAltText(/QR code per entrare/)).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Termina partita" }).click();
  await page.getByRole("button", { name: "Sì, termina" }).click();
  await expect(page.getByRole("heading", { name: "Terminata" })).toBeVisible({ timeout: 20_000 });
  await ctx.close();
  await tvCtx.close();
});
