import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { cleanup, login, makeUser, newPage, PC, PHONE, type TestUser } from "./psyco-helpers";

/**
 * INTRO DI GIRAMENTE! («Nuova partita»): prima l'intro, poi le impostazioni, poi la partita. Non deve mai bloccare:
 *  - «SALTA INTRO» sempre visibile e funzionante, poi le impostazioni sono usabili;
 *  - finisce da sola e lascia le impostazioni;
 *  - nei test automatici non compare se non è chiesta (?intro=1), così gli altri flussi restano uguali;
 *  - la stanza creata subito dopo non ripete il benvenuto (segnata come «già salutata» nella scheda).
 * Nel browser dei test il WebGL è software: si vede la versione 2D (stesso copione e voce).
 */
const SHOTS = process.env.GIRAMENTE_INTRO_SHOTS_DIR ?? path.join("test-results", "giramente-intro-shots");
mkdirSync(SHOTS, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

let owner: TestUser;
test.beforeAll(async () => {
  owner = await makeUser("gmintro");
});
test.afterAll(async () => cleanup());

test("nuova partita: prima l'intro, poi le impostazioni, poi INIZIA PARTITA (la sala non ripete il benvenuto)", async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page } = await newPage(browser, PHONE);
  await login(page, owner, "/giramente/nuova?intro=1");
  await page.waitForURL(/\/giramente\/nuova\?intro=1/);
  // l'intro parte subito e le impostazioni non ci sono ancora
  const intro = page.getByTestId("giramente-intro");
  await expect(intro).toBeVisible();
  await expect(page.getByRole("button", { name: /SALTA INTRO/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /INIZIA PARTITA/ })).toBeHidden();
  await page.waitForTimeout(2500);
  await shot(page, "tel-intro-2d");
  await page.getByRole("button", { name: /SALTA INTRO/ }).click();
  await expect(intro).toHaveCount(0, { timeout: 5000 });
  // le impostazioni: un solo telefono con tre nomi
  await page.getByRole("button", { name: /Un solo telefono/ }).click();
  for (const [i, n] of ["Anna", "Bruno", "Carla"].entries()) await page.getByLabel(`Giocatore ${i + 1}`).fill(n);
  await shot(page, "tel-impostazioni-dopo-intro");
  await page.getByRole("button", { name: /INIZIA PARTITA/ }).click();
  await page.waitForURL(/\/giramente\/un-dispositivo\/[0-9a-f-]{36}$/);
  const roomId = /\/un-dispositivo\/([0-9a-f-]{36})/.exec(page.url())![1];
  await expect(page.getByText("Bruno")).toBeVisible();
  await expect(page.getByTestId("giramente-intro")).toHaveCount(0);
  // la stanza appena creata è già salutata (niente secondo «Benvenuti» in sala d'attesa)
  expect(await page.evaluate((id) => sessionStorage.getItem(`giramente.benvenuto.v1:${id}`), roomId)).toBe("1");
  await ctx.close();
});

test("senza ?intro=1 nei test non c'è intro: le impostazioni subito", async ({ browser }) => {
  test.setTimeout(60_000);
  const { ctx, page } = await newPage(browser, PC);
  await login(page, owner, "/giramente/nuova");
  await page.waitForURL(/\/giramente\/nuova/);
  await expect(page.getByRole("button", { name: /INIZIA PARTITA/ })).toBeVisible();
  await expect(page.getByTestId("giramente-intro")).toHaveCount(0);
  await ctx.close();
});

test("l'intro finisce da sola e lascia le impostazioni (PC)", async ({ browser }) => {
  test.setTimeout(90_000);
  const { ctx, page } = await newPage(browser, PC);
  await login(page, owner, "/giramente/nuova?intro=1&modo=squadre");
  await page.waitForURL(/\/giramente\/nuova/);
  const intro = page.getByTestId("giramente-intro");
  await expect(intro).toBeVisible();
  await expect(intro).toHaveAttribute("data-phase", "out", { timeout: 25_000 });
  await expect(intro).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole("button", { name: /INIZIA PARTITA/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /A SQUADRE/ })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(1000);
  await shot(page, "pc-impostazioni-dopo-intro");
  await ctx.close();
});

test("anteprima: l'intro finisce da sola entro il tempo di sicurezza", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/preview/giramente/intro");
  const intro = page.getByTestId("giramente-intro");
  await expect(intro).toBeVisible();
  await expect(intro).toHaveAttribute("data-phase", "out", { timeout: 25_000 });
});

test("sigla, benvenuto e modelli dello studio presenti (HTTP 200)", async ({ request }) => {
  for (const f of ["/audio/giramente/sigla.mp3", "/audio/giramente/voci/benvenuti-3.mp3"]) expect((await request.get(f)).status(), f).toBe(200);
  for (const f of ["dontralla.glb", "dontralla-low.glb", "supporto.glb", "supporto-low.glb"]) expect((await request.get(`/models/giramente/${f}`)).status(), f).toBe(200);
});
