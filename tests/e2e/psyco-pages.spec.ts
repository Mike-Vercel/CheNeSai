import { expect, test } from "@playwright/test";
import { newPage, PC, PHONE, shot } from "./psyco-helpers";

/**
 * PSYCO nella piattaforma: la copertina nella riga «I nostri giochi» porta alla home del gioco (l'hero
 * della home resta CHE NE SAI?!); home del gioco e «come si gioca»; senza account, CREA PARTITA e
 * UN SOLO DISPOSITIVO portano al login e poi di nuovo alla scelta giusta.
 */
test("PSYCO nel catalogo, home del gioco, come si gioca, accesso richiesto per creare", async ({ browser }) => {
  const { ctx, page } = await newPage(browser, PC);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "CHE NE SAI?!" })).toBeAttached();
  const card = page.getByRole("link", { name: "Gioca a PSYCO" });
  await card.scrollIntoViewIfNeeded();
  await shot(page, "pc-00-home-catalogo");
  await card.click();
  await page.waitForURL(/\/psyco$/);
  await expect(page.getByRole("link", { name: "CREA PARTITA" })).toBeVisible();
  await expect(page.getByRole("link", { name: "ENTRA IN PARTITA" })).toBeVisible();
  await expect(page.getByRole("link", { name: "UN SOLO DISPOSITIVO" })).toBeVisible();
  await expect(page.getByRole("link", { name: "COME SI GIOCA" })).toBeVisible();
  await shot(page, "pc-00-psyco-home");
  await page.getByRole("link", { name: "UN SOLO DISPOSITIVO" }).click();
  await page.waitForURL(/\/accedi\?next=%2Fpsyco%2Fnuova%3Fmodo%3Dcondiviso/);
  await ctx.close();

  const m = await newPage(browser, PHONE);
  await m.page.goto("/psyco");
  await shot(m.page, "telefono-00-psyco-home");
  await m.page.goto("/psyco/come-si-gioca");
  await expect(m.page.getByRole("heading", { name: "Come si gioca" })).toBeVisible();
  await shot(m.page, "telefono-00-come-si-gioca");
  await m.page.goto("/psyco/entra");
  await shot(m.page, "telefono-00-entra");
  await m.ctx.close();
});
