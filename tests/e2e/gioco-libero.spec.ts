import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import postgres from "postgres";
import { devices, expect, test, type Page } from "@playwright/test";

/**
 * Gioco libero dall'inizio alla fine: un ragazzo apre la home, preme GIOCA, si registra
 * (username + email + password) e crea una partita da 10 domande: con un solo schermo si va
 * DRITTI al TV (lobby con QR e codice, niente secondo "avvia"). Un telefono entra con il codice,
 * l'host preme INIZIA PARTITA sul TV, usa l'ingranaggio (impostazioni, "Avanti") fino alla prima
 * domanda, apre il pannello dell'host (come sul secondo schermo), termina e fa la RIVINCITA:
 * stesso codice, il telefono resta dentro con lo stesso nickname.
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

/** Screenshot del nuovo flusso (QZ_SHOTS_DIR=cartella): TV con l'ingranaggio, impostazioni, pannello host. */
const SHOTS = process.env.QZ_SHOTS_DIR ?? null;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

test("gioco libero: registrazione, CREA PARTITA → TV dritto, telefono, INIZIA PARTITA dal TV, impostazioni, rivincita con lo stesso QR", async ({ browser }) => {
  test.setTimeout(300_000);
  const hostCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
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

  // ------------------------------------------------------------- nuova partita: un solo schermo → TV qui, subito
  await host.getByRole("button", { name: "10", exact: true }).click();
  await host.getByRole("button", { name: "2", exact: true }).click();
  await host.getByRole("button", { name: "CREA PARTITA" }).click();
  await host.waitForURL(/\/gioca\/tv\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const tv = host;
  const sessionId = tv.url().split("/").pop()!;
  // niente schermata "ATTIVA AUDIO" né secondo avvio: lobby con QR e codice grandi
  await expect(tv.getByRole("button", { name: "ATTIVA AUDIO E AVVIA SCHERMO" })).toHaveCount(0);
  await expect(tv.getByAltText(/QR code per entrare/)).toBeVisible();
  const code = (await tv.locator("span.font-display.text-gold").filter({ hasText: /^[A-Z0-9]{6}$/ }).first().innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);
  await expect(tv.getByRole("button", { name: /INIZIA PARTITA/ })).toBeDisabled();
  await expect(tv.getByRole("button", { name: "Impostazioni" })).toBeVisible();

  // un altro visitatore non comanda la partita
  const strangerCtx = await browser.newContext();
  const stranger = await strangerCtx.newPage();
  const res = await stranger.request.post(`/api/gioca/games/${sessionId}/command`, { data: { action: "finish" } });
  expect(res.status()).toBe(401);
  expect((await stranger.request.post(`/api/display/${sessionId}/voices?k=sbagliata`, { data: { action: "estimate" } })).status()).toBe(403);
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
  await expect(tv.getByText("1 giocatore pronto", { exact: false })).toBeVisible({ timeout: 20_000 });
  await tv.mouse.move(600, 300);
  await shot(tv, "01-tv-lobby-ingranaggio");

  // ------------------------------------------------------------- impostazioni (ingranaggio)
  await tv.getByRole("button", { name: "Impostazioni" }).click();
  const sheet = tv.getByRole("dialog", { name: "Impostazioni" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Telefono")).toBeVisible();
  await expect(sheet.getByRole("switch", { name: /Schermo intero/ })).toBeAttached();
  await expect(sheet.getByRole("radio", { name: "Auto" })).toHaveAttribute("aria-checked", "true");
  await shot(tv, "02-tv-impostazioni");
  await sheet.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(sheet).toHaveCount(0);

  // ------------------------------------------------------------- INIZIA PARTITA dal TV, poi "Avanti" fino alla prima domanda
  await tv.getByRole("button", { name: /INIZIA PARTITA/ }).click();
  await expect(tv.getByRole("button", { name: /INIZIA PARTITA/ })).toHaveCount(0, { timeout: 20_000 });
  for (let i = 0; i < 2; i++) {
    await tv.mouse.move(700 + i * 10, 300);
    await tv.getByRole("button", { name: "Impostazioni" }).click();
    await tv.getByRole("dialog", { name: "Impostazioni" }).getByRole("button", { name: /Avanti/ }).click();
    await tv.waitForTimeout(800);
    await tv.keyboard.press("Escape");
  }
  await expect(phone.getByText("Domanda 1")).toBeVisible({ timeout: 60_000 });
  await expect(tv.getByText(/Domanda 1 di 10/)).toBeVisible({ timeout: 20_000 });
  await tv.waitForTimeout(2500);
  await shot(tv, "05-tv-domanda-trio");

  // ------------------------------------------------------------- pannello dell'host (due schermi): stessa partita
  const panel = await hostCtx.newPage();
  await panel.setViewportSize({ width: 1440, height: 1000 });
  await panel.goto(`/gioca/partita/${sessionId}`);
  await expect(panel.getByText("TV collegato")).toBeVisible({ timeout: 15_000 });
  await expect(panel.getByText(code).first()).toBeVisible();
  await expect(panel.getByText("Telefono")).toBeVisible();
  await expect(panel.getByRole("radio", { name: "Auto" })).toHaveAttribute("aria-checked", "true");
  await shot(panel, "03-pannello-host");
  await panel.getByRole("button", { name: "Termina partita" }).click();
  await panel.getByRole("button", { name: "Sì, termina" }).click();
  await expect(panel.getByRole("heading", { name: "Terminata" })).toBeVisible({ timeout: 20_000 });

  // ------------------------------------------------------------- RIVINCITA dal TV: stesso codice, telefono già dentro
  await expect(tv.getByRole("button", { name: /RIVINCITA/ })).toBeVisible({ timeout: 20_000 });
  await shot(tv, "04-tv-podio-rivincita");
  await tv.getByRole("button", { name: /RIVINCITA/ }).first().click();
  await tv.waitForURL((u) => /\/gioca\/tv\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.endsWith(sessionId), { timeout: 30_000 });
  const rematchId = tv.url().split("/").pop()!;
  await expect(tv.getByAltText(/QR code per entrare/)).toBeVisible();
  await expect(tv.getByText(code).first()).toBeVisible();
  await expect(tv.getByText("1 giocatore pronto", { exact: false })).toBeVisible({ timeout: 20_000 });
  // il telefono non si è scollegato: è nella nuova lobby con lo stesso nickname
  await expect(phone.getByText("Aspetta il via dalla regia…")).toBeVisible({ timeout: 30_000 });
  await expect(phone.getByText("Telefono").first()).toBeVisible();
  // anche il pannello passa alla nuova partita
  await panel.waitForURL(new RegExp(`/gioca/partita/${rematchId}$`), { timeout: 30_000 });
  await expect(panel.getByRole("heading", { name: "Lobby aperta" })).toBeVisible();

  await phoneCtx.close();
  await hostCtx.close();
});
