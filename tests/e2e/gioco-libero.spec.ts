import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import postgres from "postgres";
import { devices, expect, test } from "@playwright/test";

/**
 * Gioco libero dall'inizio alla fine: un ragazzo apre la home, preme GIOCA, si registra
 * (username + email + password), crea una partita da 10 domande, apre la TV (QR e codice),
 * un telefono entra con il codice, l'host preme INIZIA PARTITA e lo scorrimento automatico
 * porta la partita fino alla prima domanda senza nessun altro clic.
 * Alla fine l'account e le sue partite vengono eliminati (anche lo storico delle domande uscite).
 */
config({ path: ".env.local", quiet: true });

const username = `e2e_${randomUUID().slice(0, 8)}`;
const email = `${username}@test.chenesai.local`;
const password = `Prova-${randomUUID().slice(0, 12)}`;

test.afterAll(async () => {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  try {
    const [u] = await sql<{ id: string }[]>`select id from auth.users where email = ${email}`;
    if (!u) return;
    await sql`delete from question_plays where host_user_id = ${u.id}`;
    await sql.begin(async (tx) => {
      await tx`select set_config('qz.allow_reset', 'on', true)`;
      await tx`select set_config('qz.allow_frozen_write', 'on', true)`;
      await tx`delete from game_sessions where host_user_id = ${u.id}`;
    });
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
    await admin.auth.admin.deleteUser(u.id);
  } finally {
    await sql.end();
  }
});

test("gioco libero: registrazione, nuova partita, TV con QR, telefono, INIZIA PARTITA e prima domanda in automatico", async ({ browser }) => {
  test.setTimeout(300_000);
  const hostCtx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const host = await hostCtx.newPage();

  // ------------------------------------------------------------- home → registrazione
  await host.goto("/");
  await expect(host.getByRole("heading", { level: 1, name: "CHE NE SAI?!" })).toBeVisible();
  await host.getByRole("link", { name: /GIOCA/ }).first().click();
  await host.waitForURL(/\/accedi\?next=%2Fgioca/);
  await host.getByLabel("Username").fill(username);
  await expect(host.getByText("Disponibile")).toBeVisible();
  await host.getByLabel("Email").fill(email);
  await host.getByLabel("Password", { exact: true }).fill(password);
  await host.getByRole("button", { name: "CREA ACCOUNT E GIOCA" }).click();
  await host.waitForURL(/\/gioca$/, { timeout: 60_000 });
  await expect(host.getByText(`@${username}`)).toBeVisible();

  // ------------------------------------------------------------- nuova partita
  await host.getByRole("button", { name: "10", exact: true }).click();
  await host.getByRole("button", { name: "2", exact: true }).click();
  await host.getByRole("button", { name: "CREA PARTITA" }).click();
  await host.waitForURL(/\/gioca\/partita\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const sessionId = host.url().split("/").pop()!;
  await expect(host.getByRole("heading", { name: "Lobby aperta" })).toBeVisible();
  const code = (await host.locator("p.font-display.text-gold").first().innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  await expect(host.getByRole("button", { name: /INIZIA PARTITA/ })).toBeDisabled();

  // ------------------------------------------------------------- il PC diventa la TV
  const tv = await hostCtx.newPage();
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await tv.goto(`/gioca/tv/${sessionId}`);
  await tv.getByRole("button", { name: "Continua senza audio" }).click();
  await expect(tv.getByAltText(/QR code per entrare/)).toBeVisible();
  await expect(tv.getByText(code).first()).toBeVisible();

  // un altro visitatore non apre la TV della partita
  const strangerCtx = await browser.newContext();
  const stranger = await strangerCtx.newPage();
  const res = await stranger.request.post(`/api/gioca/games/${sessionId}/command`, { data: { action: "finish" } });
  expect(res.status()).toBe(401);
  await strangerCtx.close();

  // ------------------------------------------------------------- un telefono entra col codice
  const phoneCtx = await browser.newContext({ ...devices["Pixel 7"] });
  const phone = await phoneCtx.newPage();
  await phone.goto("/entra");
  await phone.getByLabel("Codice partita").fill(code);
  await phone.getByRole("button", { name: "ENTRA" }).click();
  await phone.waitForURL(new RegExp(`/play/${code}$`));
  await phone.getByLabel("Scegli il tuo nickname").fill("Telefono");
  await phone.getByRole("button", { name: "ENTRA E GIOCA!" }).click();
  await phone.getByRole("button", { name: "ANDIAMO!" }).click();
  await expect(host.getByText("1 giocatore collegato")).toBeVisible({ timeout: 20_000 });

  // ------------------------------------------------------------- INIZIA PARTITA dalla TV
  await tv.mouse.move(400, 400);
  await tv.getByRole("button", { name: /INIZIA PARTITA/ }).click();
  await expect(host.getByRole("heading", { name: "Introduzione" })).toBeVisible({ timeout: 20_000 });
  // l'intro con le regole (~1 min 45 s), poi il round e la prima domanda: tutto in automatico
  await expect(phone.getByText("Domanda 1")).toBeVisible({ timeout: 200_000 });
  await expect(tv.getByText(/Domanda 1 di 10/)).toBeVisible({ timeout: 20_000 });

  // ------------------------------------------------------------- termina e podio
  await host.getByRole("button", { name: "Termina partita" }).click();
  await host.getByRole("button", { name: "Sì, termina" }).click();
  await expect(host.getByRole("heading", { name: "Terminata" })).toBeVisible({ timeout: 20_000 });
  await expect(host.getByRole("link", { name: "NUOVA PARTITA" })).toBeVisible();
  await expect(host.getByRole("link", { name: "Torna alla home" })).toBeVisible();

  await phoneCtx.close();
  await hostCtx.close();
});
