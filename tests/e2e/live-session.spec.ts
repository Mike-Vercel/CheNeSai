import { readFileSync } from "node:fs";
import { expect, test, devices, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * Partita completa con 1 regia, 1 TV e 3 smartphone sulla stessa sessione:
 * ingresso, intro, domanda sincronizzata, risposte (corretta / errata /
 * nessuna), rivelazione, punteggi, ricarica TV/regia/telefono, perdita di
 * connessione, votazione categoria, tentativo di comando admin da un
 * giocatore, finale con podio.
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@chenesai.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Quizzone-Dev-2026!";
const SHOTS = "test-results/e2e-shots";

interface Session {
  sessionId: string;
  code: string;
  displayKey: string;
}

async function phone(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  return { ctx, page: await ctx.newPage() };
}

async function command(admin: Page, label: RegExp | string) {
  const btn = admin.getByRole("button", { name: label }).first();
  await expect(btn).toBeEnabled();
  await btn.click();
}

test("serata live: regia + TV + 3 giocatori sincronizzati", async ({ browser }) => {
  const s = JSON.parse(readFileSync("test-results/e2e-session.json", "utf8")) as Session;

  // ---------------------------------------------------------------- regia
  const adminCtx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const admin = await adminCtx.newPage();
  await admin.goto("/admin/login");
  await admin.getByLabel("Email").fill(ADMIN_EMAIL);
  await admin.getByLabel("Password").fill(ADMIN_PASSWORD);
  await admin.getByRole("button", { name: "ENTRA IN REGIA" }).click();
  await admin.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.includes("/login"), { timeout: 60_000 });
  await admin.goto(`/admin/sessions/${s.sessionId}/live`);
  await expect(admin.getByText("Pronta").first()).toBeVisible();

  // ---------------------------------------------------------------- TV
  const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await tvCtx.newPage();
  await tv.goto(`/display/${s.sessionId}?k=${s.displayKey}`);
  await tv.getByRole("button", { name: "Continua senza audio" }).click();
  await expect(tv.getByText("Tra poco si comincia!")).toBeVisible();

  // ---------------------------------------------------------------- lobby
  await command(admin, /APRI LOBBY/);
  await expect(tv.getByAltText(/QR code per entrare/)).toBeVisible();
  await expect(tv.getByText(s.code).first()).toBeVisible();

  const players = await Promise.all([phone(browser), phone(browser), phone(browser)]);
  const names = ["Anna", "Bruno", "Carla"];
  for (let i = 0; i < 3; i++) {
    const p = players[i].page;
    await p.goto(`/play/${s.code}`);
    await p.getByLabel("Scegli il tuo nickname").fill(names[i]);
    await p.getByRole("button", { name: "ENTRA E GIOCA!" }).click();
    await p.getByRole("button", { name: "ANDIAMO!" }).click();
    await expect(p.getByText(names[i]).first()).toBeVisible();
  }
  // nickname duplicato rifiutato
  const dup = await phone(browser);
  await dup.page.goto(`/play/${s.code}`);
  await dup.page.getByLabel("Scegli il tuo nickname").fill("anna");
  await dup.page.getByRole("button", { name: "ENTRA E GIOCA!" }).click();
  await expect(dup.page.getByText(/già in uso/)).toBeVisible();
  await dup.ctx.close();

  await expect(tv.getByText("giocatori")).toBeVisible();
  await expect(tv.locator("text=Carla")).toBeVisible();
  await tv.screenshot({ path: `${SHOTS}/01-tv-lobby.png` });
  await players[0].page.screenshot({ path: `${SHOTS}/02-phone-lobby.png` });

  // un giocatore non può inviare comandi di regia
  const forged = await players[0].page.request.post(`/api/admin/sessions/${s.sessionId}/command`, {
    data: { command: "FINISH", commandId: crypto.randomUUID(), args: {} },
  });
  expect(forged.status()).toBe(401);
  // né leggere lo stato admin (con le soluzioni)
  expect((await players[0].page.request.get(`/api/admin/sessions/${s.sessionId}/live`)).status()).toBe(401);

  // ---------------------------------------------------------------- intro
  await command(admin, /AVVIA INTRO/);
  await expect(players[0].page.getByText("Guarda il TV!")).toBeVisible();
  await tv.waitForTimeout(6000);
  await tv.screenshot({ path: `${SHOTS}/03-tv-intro.png` });
  await command(admin, /SALTA INTRO/);
  await admin.getByRole("button", { name: "Salta", exact: true }).click();
  await command(admin, /INIZIA ROUND/);
  await expect(tv.getByText("Cultura generale")).toBeVisible();

  // ---------------------------------------------------------------- domanda 1
  await command(admin, /MOSTRA DOMANDA/);
  const qText = "Qual è la capitale dell'Albania?";
  await expect(tv.getByText(qText)).toBeVisible();
  for (const p of players) await expect(p.page.getByText(qText)).toBeVisible();
  // le risposte non sono ancora visibili
  for (const p of players) await expect(p.page.getByText("Tirana")).toHaveCount(0);
  await expect(tv.getByText("Tirana")).toHaveCount(0);
  await tv.screenshot({ path: `${SHOTS}/04-tv-question.png` });

  await command(admin, /MOSTRA RISPOSTE/);
  await expect(tv.getByText("Tirana")).toBeVisible();
  for (const p of players) await expect(p.page.getByRole("button", { name: /Tirana/ })).toBeVisible();
  // stesso ordine su TV e telefoni
  const tvOrder = await tv.locator("text=/^(Tirana|Durazzo|Valona|Scutari)$/").allInnerTexts();
  const phoneOrder = await players[1].page.getByRole("button", { name: /Tirana|Durazzo|Valona|Scutari/ }).allInnerTexts();
  expect(phoneOrder.map((t) => t.replace(/^[A-D]\s*/, "").trim().split("\n").pop())).toEqual(tvOrder);

  await players[0].page.getByRole("button", { name: /Tirana/ }).click();
  await players[0].page.getByRole("button", { name: "CONFERMA" }).click();
  await expect(players[0].page.getByText("RISPOSTA REGISTRATA!")).toBeVisible();
  await players[1].page.getByRole("button", { name: /Valona/ }).click();
  await players[1].page.getByRole("button", { name: "CONFERMA" }).click();
  await expect(players[1].page.getByText("RISPOSTA REGISTRATA!")).toBeVisible();
  await tv.screenshot({ path: `${SHOTS}/05-tv-options.png` });
  await players[0].page.screenshot({ path: `${SHOTS}/06-phone-answered.png` });

  // il telefono ricarica la pagina: la risposta registrata viene ripristinata
  await players[0].page.reload();
  await expect(players[0].page.getByText("RISPOSTA REGISTRATA!")).toBeVisible();

  await command(admin, /CHIUDI RISPOSTE/);
  // risposta tardiva rifiutata dal server
  await expect(players[2].page.getByText("Tempo scaduto!")).toBeVisible();
  await expect(players[2].page.getByRole("button", { name: /Tirana/ })).toBeDisabled();

  await command(admin, /RIVELA SOLUZIONE/);
  await expect(players[0].page.getByText("ESATTO! 🎉")).toBeVisible();
  await expect(players[1].page.getByText("SBAGLIATO!")).toBeVisible();
  await expect(players[2].page.getByText("NESSUNA RISPOSTA")).toBeVisible();
  await tv.screenshot({ path: `${SHOTS}/07-tv-reveal.png` });
  await players[0].page.screenshot({ path: `${SHOTS}/08-phone-reveal.png` });

  await command(admin, /ASSEGNA PUNTEGGI/);
  await expect(tv.getByText("PUNTI ASSEGNATI")).toBeVisible();
  await expect(players[0].page.getByText("+1.000").first()).toBeVisible();
  await expect(players[1].page.getByText("−400").first()).toBeVisible();

  // ricarica TV e regia: stato corrente ripristinato
  await tv.reload();
  await tv.getByRole("button", { name: "Continua senza audio" }).click();
  await expect(tv.getByText("PUNTI ASSEGNATI")).toBeVisible();
  await admin.reload();
  await expect(admin.getByText("Punti assegnati").first()).toBeVisible();
  await tv.screenshot({ path: `${SHOTS}/09-tv-scores.png` });

  // ---------------------------------------------------------------- disconnessione
  await players[2].ctx.setOffline(true);
  await command(admin, /MOSTRA CLASSIFICA/);
  await expect(tv.getByText("CLASSIFICA")).toBeVisible();
  await players[2].page.waitForTimeout(5000);
  await players[2].ctx.setOffline(false);
  await expect(players[2].page.getByText("La tua posizione")).toBeVisible({ timeout: 30_000 });

  // ---------------------------------------------------------------- votazione categoria
  // seconda domanda del round 1 saltata: si passa al round con votazione
  await admin.getByRole("button", { name: /^2\. Decidete voi!/ }).click();
  await expect(tv.getByText("ADESSO DECIDETE VOI!").first()).toBeVisible();
  await command(admin, /AVVIA VOTAZIONE/);
  await expect(players[0].page.getByRole("button", { name: /CINEMA/ })).toBeVisible();
  await players[0].page.getByRole("button", { name: /MUSICA/ }).click();
  await players[1].page.getByRole("button", { name: /MUSICA/ }).click();
  await players[2].page.getByRole("button", { name: /CINEMA/ }).click();
  await expect(players[0].page.getByText("VOTO REGISTRATO!")).toBeVisible();
  await tv.screenshot({ path: `${SHOTS}/10-tv-voting.png` });
  await command(admin, /CHIUDI VOTAZIONE/);
  await expect(tv.getByText("MUSICA!")).toBeVisible();
  await tv.screenshot({ path: `${SHOTS}/11-tv-vote-result.png` });
  await command(admin, /MOSTRA DOMANDA/);
  await expect(tv.getByText("Chi canta 'Nel blu dipinto di blu'?")).toBeVisible();

  // ---------------------------------------------------------------- finale
  await admin.getByRole("button", { name: "TERMINA PARTITA" }).first().click();
  await admin.getByPlaceholder("Scrivi FINE per confermare").fill("FINE");
  await admin.getByRole("button", { name: "TERMINA", exact: true }).click();
  await expect(tv.getByText("I CAMPIONI DELLA SERATA")).toBeVisible();
  await expect(players[0].page.getByText("Partita finita!")).toBeVisible();
  await expect(players[0].page.getByText("CAMPIONE DELLA SERATA", { exact: false })).toBeVisible();
  await tv.waitForTimeout(2500);
  await tv.screenshot({ path: `${SHOTS}/12-tv-podium.png` });
  await players[0].page.screenshot({ path: `${SHOTS}/13-phone-final.png` });
  await admin.screenshot({ path: `${SHOTS}/14-admin-live.png`, fullPage: true });

  for (const p of players) await p.ctx.close();
  await tvCtx.close();
  await adminCtx.close();
});
