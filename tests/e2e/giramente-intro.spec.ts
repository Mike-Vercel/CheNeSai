import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createGame, roomInfo } from "./giramente-helpers";
import { cleanup, db, login, makeUser, newPage, PC, PHONE, type TestUser } from "./psyco-helpers";

/**
 * GIRAMENTE! come un videogioco: aprire = giocare.
 *  - /giramente: l'INTRO (una volta per scheda; nei test solo con ?intro=1), poi il MENU sopra lo studio;
 *  - menu da tastiera (↑↓, Invio, Esc), NUOVA PARTITA a pannelli, /giramente/nuova apre direttamente i pannelli;
 *  - «Esci» di chi gestisce chiude la partita per tutti (gli altri tornano al menu), chi gioca la lascia;
 *  - partita abbandonata da chi la gestisce (nessun segno di vita da 10 minuti in sala d'attesa) → chiusa da sola.
 * Nel browser dei test il WebGL è software: si vede lo studio disegnato (2D), stesso menu e stesso copione.
 */
const SHOTS = process.env.GIRAMENTE_INTRO_SHOTS_DIR ?? path.join("test-results", "giramente-intro-shots");
mkdirSync(SHOTS, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const menuItem = (page: Page, name: RegExp) => page.getByRole("menuitem", { name });

let owner: TestUser;
test.beforeAll(async () => {
  owner = await makeUser("gmintro");
});
test.afterAll(async () => cleanup());

test("aprire il gioco: prima l'intro, poi il MENU, poi NUOVA PARTITA a pannelli (la sala non ripete il benvenuto)", async ({ browser }) => {
  test.setTimeout(120_000);
  const { ctx, page } = await newPage(browser, PHONE);
  await login(page, owner, "/giramente?intro=1");
  await page.waitForURL(/\/giramente\?intro=1/);
  // l'intro parte subito e il menu non c'è ancora
  const intro = page.getByTestId("giramente-intro");
  await expect(intro).toBeVisible();
  await expect(page.getByRole("button", { name: /SALTA INTRO/ })).toBeVisible();
  await expect(menuItem(page, /NUOVA PARTITA/)).toHaveCount(0);
  await page.waitForTimeout(2500);
  await shot(page, "tel-intro-2d");
  await page.getByRole("button", { name: /SALTA INTRO/ }).click();
  await expect(intro).toHaveCount(0, { timeout: 5000 });
  // il menu da videogioco
  await expect(menuItem(page, /NUOVA PARTITA/)).toBeVisible();
  await shot(page, "tel-menu");
  await menuItem(page, /NUOVA PARTITA/).click();
  await createGame(page, { devices: "shared", players: ["Anna", "Bruno", "Carla"], shot: undefined });
  await page.waitForURL(/\/giramente\/un-dispositivo\/[0-9a-f-]{36}$/);
  const roomId = /\/un-dispositivo\/([0-9a-f-]{36})/.exec(page.url())![1];
  await expect(page.getByText("Bruno")).toBeVisible();
  await expect(page.getByTestId("giramente-intro")).toHaveCount(0);
  // la stanza appena creata è già salutata (niente secondo «Benvenuti» in sala d'attesa)
  expect(await page.evaluate((id) => sessionStorage.getItem(`giramente.benvenuto.v1:${id}`), roomId)).toBe("1");
  await ctx.close();
});

test("menu da tastiera: ↑↓ e Invio aprono i pannelli, Esc torna indietro; senza ?intro=1 nei test niente intro", async ({ browser }) => {
  test.setTimeout(60_000);
  const { ctx, page } = await newPage(browser, PC);
  await login(page, owner, "/giramente");
  await page.waitForURL(/\/giramente$/);
  await expect(menuItem(page, /NUOVA PARTITA/)).toBeVisible();
  await expect(page.getByTestId("giramente-intro")).toHaveCount(0);
  await menuItem(page, /NUOVA PARTITA/).focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  await expect(menuItem(page, /IMPOSTAZIONI/)).toHaveAttribute("data-active", "true");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "IMPOSTAZIONI" })).toBeVisible();
  await expect(page.getByRole("switch", { name: /Musica/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menuItem(page, /NUOVA PARTITA/)).toBeVisible();
  // NUOVA PARTITA: passo dopo passo, INDIETRO torna al passo prima e poi al menu
  await menuItem(page, /NUOVA PARTITA/).click();
  await expect(menuItem(page, /INDIVIDUALE/)).toBeVisible();
  await menuItem(page, /A SQUADRE/).click();
  await expect(menuItem(page, /Un solo telefono/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menuItem(page, /INDIVIDUALE/)).toBeVisible();
  await page.getByRole("button", { name: "‹ INDIETRO" }).click();
  await expect(menuItem(page, /NUOVA PARTITA/)).toBeVisible();
  await ctx.close();
});

test("l'intro finisce da sola e lascia il menu (PC)", async ({ browser }) => {
  test.setTimeout(90_000);
  const { ctx, page } = await newPage(browser, PC);
  await login(page, owner, "/giramente?intro=1");
  await page.waitForURL(/\/giramente/);
  const intro = page.getByTestId("giramente-intro");
  await expect(intro).toBeVisible();
  await expect(intro).toHaveAttribute("data-phase", "out", { timeout: 25_000 });
  await expect(intro).toHaveCount(0, { timeout: 5000 });
  await expect(menuItem(page, /NUOVA PARTITA/)).toBeVisible();
  await shot(page, "pc-menu-dopo-intro");
  await ctx.close();
});

test("/giramente/nuova apre direttamente NUOVA PARTITA (a squadre con ?modo=squadre); senza account si passa dall'accesso", async ({ browser }) => {
  test.setTimeout(60_000);
  const { ctx, page } = await newPage(browser, PC);
  await login(page, owner, "/giramente/nuova?modo=squadre");
  await page.waitForURL(/\/giramente\/nuova/);
  await expect(menuItem(page, /Un solo telefono/)).toBeVisible();
  await expect(page.getByTestId("giramente-intro")).toHaveCount(0);
  await ctx.close();
  // senza account: il menu c'è, NUOVA PARTITA porta all'accesso e poi torna ai pannelli
  const anon = await newPage(browser, PC);
  await anon.page.goto("/giramente");
  await menuItem(anon.page, /NUOVA PARTITA/).click();
  await anon.page.waitForURL(/\/accedi\?next=%2Fgiramente%2Fnuova/);
  await anon.ctx.close();
});

test("«Esci» di chi gestisce chiude la partita per tutti: chi gioca vede «Partita chiusa» e torna al menu; niente più in «Riprendi»", async ({ browser }) => {
  test.setTimeout(150_000);
  const player = await makeUser("gmintroplayer");
  const boss = await makeUser("gmintroplah");
  const { ctx: ch, page: host } = await newPage(browser, PC);
  const { ctx: cp, page: tel } = await newPage(browser, PHONE);
  await login(host, boss, "/giramente/nuova");
  await host.waitForURL(/\/giramente\/nuova/);
  await createGame(host, { devices: "personal" });
  await host.waitForURL(/\/giramente\/stanza\//);
  const roomId = /\/stanza\/([0-9a-f-]{36})/.exec(host.url())![1];
  const info = await roomInfo(roomId);
  await login(tel, player, `/giramente/entra/${info.code}`);
  await tel.getByLabel("Il tuo nome in partita").fill("Telefono");
  await tel.getByRole("button", { name: /ENTRA IN PARTITA/ }).click();
  await tel.waitForURL(/\/giramente\/stanza\//);
  // il menu dell'host mostra RIPRENDI con la partita aperta
  await host.goto("/giramente");
  await expect(menuItem(host, /RIPRENDI/)).toBeVisible();
  await menuItem(host, /RIPRENDI/).click();
  await host.waitForURL(/\/giramente\/stanza\//);
  // Esci (due tocchi): chiude per tutti e torna al menu
  await host.getByRole("button", { name: "Esci dalla partita" }).click();
  await expect(host.getByRole("button", { name: /Chiudi per tutti/ })).toBeVisible();
  await host.getByRole("button", { name: /Chiudi per tutti/ }).click();
  await host.waitForURL(/\/giramente$/);
  await expect(menuItem(host, /NUOVA PARTITA/)).toBeVisible();
  await expect(menuItem(host, /RIPRENDI/)).toHaveCount(0);
  expect((await roomStatus(roomId)).status).toBe("closed");
  // chi giocava: «Partita chiusa», poi da solo al menu
  await expect(tel.getByText("Partita chiusa")).toBeVisible({ timeout: 20_000 });
  await shot(tel, "tel-partita-chiusa");
  await tel.waitForURL(/\/giramente$/, { timeout: 20_000 });
  await expect(menuItem(tel, /NUOVA PARTITA/)).toBeVisible();
  await ch.close();
  await cp.close();
});

test("«Esci» di chi gioca lascia la partita (non la chiude)", async ({ browser }) => {
  test.setTimeout(120_000);
  const player = await makeUser("gmintroleave");
  const boss = await makeUser("gmintroleah");
  const { ctx: ch, page: host } = await newPage(browser, PC);
  const { ctx: cp, page: tel } = await newPage(browser, PHONE);
  await login(host, boss, "/giramente/nuova");
  await createGame(host, { devices: "personal" });
  await host.waitForURL(/\/giramente\/stanza\//);
  const roomId = /\/stanza\/([0-9a-f-]{36})/.exec(host.url())![1];
  const info = await roomInfo(roomId);
  await login(tel, player, `/giramente/entra/${info.code}`);
  await tel.getByLabel("Il tuo nome in partita").fill("Ospite");
  await tel.getByRole("button", { name: /ENTRA IN PARTITA/ }).click();
  await tel.waitForURL(/\/giramente\/stanza\//);
  await expect(host.getByText("Ospite")).toBeVisible({ timeout: 20_000 });
  await tel.getByRole("button", { name: "Esci dalla partita" }).click();
  await tel.getByRole("button", { name: /Esci davvero/ }).click();
  await tel.waitForURL(/\/giramente$/);
  expect((await roomStatus(roomId)).status).toBe("open");
  await expect(host.getByText("Ospite")).toHaveCount(0, { timeout: 20_000 });
  await ch.close();
  await cp.close();
});

test("partita abbandonata da chi la gestisce (10 minuti senza segni di vita in sala d'attesa): si chiude da sola", async ({ browser }) => {
  test.setTimeout(120_000);
  const player = await makeUser("gmintrogone");
  const boss = await makeUser("gmintrogonh");
  const { ctx: ch, page: host } = await newPage(browser, PC);
  const { ctx: cp, page: tel } = await newPage(browser, PHONE);
  await login(host, boss, "/giramente/nuova");
  await createGame(host, { devices: "personal" });
  await host.waitForURL(/\/giramente\/stanza\//);
  const roomId = /\/stanza\/([0-9a-f-]{36})/.exec(host.url())![1];
  const info = await roomInfo(roomId);
  // l'host chiude la scheda (niente più letture), il giocatore entra
  await ch.close();
  await login(tel, player, `/giramente/entra/${info.code}`);
  await tel.getByLabel("Il tuo nome in partita").fill("Rimasto");
  await tel.getByRole("button", { name: /ENTRA IN PARTITA/ }).click();
  await tel.waitForURL(/\/giramente\/stanza\//);
  // un semplice ritardo non chiude nulla: solo oltre i 10 minuti
  await setHostSeen(roomId, 9);
  await tel.reload();
  await expect(tel.getByText("Rimasto").first()).toBeVisible();
  expect((await roomStatus(roomId)).status).toBe("open");
  await setHostSeen(roomId, 11);
  await tel.reload();
  await expect(tel.getByText("Partita chiusa")).toBeVisible({ timeout: 20_000 });
  const st = await roomStatus(roomId);
  expect(st.status).toBe("closed");
  expect(st.close_reason).toBe("host_gone");
  await cp.close();
});

test("anteprima: l'intro finisce da sola entro il tempo di sicurezza e lascia il menu", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/preview/giramente/intro?intro=1");
  const intro = page.getByTestId("giramente-intro");
  await expect(intro).toBeVisible();
  await expect(intro).toHaveAttribute("data-phase", "out", { timeout: 25_000 });
  await expect(menuItem(page, /NUOVA PARTITA/)).toBeVisible();
});

test("sigla, benvenuto e modelli dello studio presenti (HTTP 200)", async ({ request }) => {
  for (const f of ["/audio/giramente/sigla.mp3", "/audio/giramente/voci/benvenuti-3.mp3"]) expect((await request.get(f)).status(), f).toBe(200);
  for (const f of ["dontralla.glb", "dontralla-low.glb", "supporto.glb", "supporto-low.glb"]) expect((await request.get(`/models/giramente/${f}`)).status(), f).toBe(200);
});

async function roomStatus(roomId: string): Promise<{ status: string; close_reason: string | null }> {
  const sql = db();
  try {
    const [r] = await sql<{ status: string; close_reason: string | null }[]>`select status, close_reason from giramente_rooms where id = ${roomId}`;
    return r;
  } finally {
    await sql.end();
  }
}

/** Simula l'host sparito da `minutes` minuti (scheda chiusa, telefono spento). */
async function setHostSeen(roomId: string, minutes: number) {
  const sql = db();
  try {
    await sql`update giramente_rooms set host_seen_at = now() - make_interval(mins => ${minutes}) where id = ${roomId}`;
  } finally {
    await sql.end();
  }
}
