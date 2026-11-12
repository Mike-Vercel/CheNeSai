import { expect, test } from "@playwright/test";
import { cleanup, login, makeUser, newPage, PHONE, shot, type TestUser } from "./psyco-helpers";

/**
 * INTRO DI PSYCO (l'ufficio dell'Investigatore): non deve mai bloccare il gioco.
 *  - «SALTA INTRO» sempre visibile e funzionante, poi la sala d'attesa è usabile;
 *  - finisce da sola (fine naturale o sicurezza a 25 s);
 *  - nei test automatici non compare se non è chiesta (?intro=1), così gli altri flussi restano uguali.
 * Nel browser dei test il WebGL è software: si vede la versione illustrata 2D (stesso copione e voce).
 */
let owner: TestUser;
test.beforeAll(async () => {
  owner = await makeUser("psycointro");
});
test.afterAll(async () => cleanup());

test("intro: salta, sala d'attesa usabile, niente intro non richiesta", async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page } = await newPage(browser, PHONE);
  await login(page, owner, "/psyco/nuova?modo=condiviso");
  await page.waitForURL(/\/psyco\/nuova\?modo=condiviso/);
  for (const [i, n] of ["Sara", "Mike", "Luca"].entries()) await page.getByRole("textbox", { name: `Nickname ${i + 1}`, exact: true }).fill(n);
  await page.getByRole("button", { name: "CREA LA PARTITA" }).click();
  await page.waitForURL(/\/psyco\/un-dispositivo\/[0-9a-f-]{36}$/);
  const url = page.url();
  // senza ?intro=1 nei test non c'è
  await expect(page.getByText("Giocatori (3)")).toBeVisible();
  await expect(page.getByTestId("psyco-intro")).toHaveCount(0);

  await page.goto(`${url}?intro=1`);
  const intro = page.getByTestId("psyco-intro");
  await expect(intro).toBeVisible();
  await expect(page.getByRole("button", { name: /SALTA INTRO/ })).toBeVisible();
  await page.waitForTimeout(2500);
  await shot(page, "telefono-21-intro");
  await page.getByRole("button", { name: /SALTA INTRO/ }).click();
  await expect(intro).toHaveCount(0, { timeout: 5000 });
  await page.getByRole("button", { name: "INIZIA LA PARTITA" }).click();
  await expect(page.getByRole("button", { name: /^SONO .+ — MOSTRA IL MIO RUOLO$/ })).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});

test("intro: finisce da sola entro il tempo di sicurezza", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/preview/investigatore?intro=1&layout=landscape");
  const intro = page.getByTestId("psyco-intro");
  await expect(intro).toBeVisible();
  await expect(intro).toHaveAttribute("data-phase", "out", { timeout: 30_000 });
});

test("effetti sonori dell'intro presenti (HTTP 200)", async ({ request }) => {
  for (const id of ["passo", "sedia", "lampada", "pioggia"]) expect((await request.get(`/audio/psyco/sfx/${id}.mp3`)).status(), id).toBe(200);
  for (const f of ["investigatore.glb", "investigatore-low.glb", "investigatore-b.glb", "investigatore-b-low.glb"]) expect((await request.get(`/models/${f}`)).status(), f).toBe(200);
});
