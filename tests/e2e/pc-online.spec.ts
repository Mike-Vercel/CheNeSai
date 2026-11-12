import { expect, test, type Page } from "@playwright/test";
import { advance, answer, cleanupUsers, createOnlineGame, forceMultiple, gameRow, joinWithAccount, login, makeUser, newPage, PC, PHONE, points, shot, waitFor } from "./pc-online-helpers";

/**
 * Partite ONLINE dal PC (contesti separati = computer diversi, 1440×900):
 *  a. l'host crea dal PC la partita ONLINE, un secondo PC entra con il suo account dal link, entrambi
 *     rispondono col MOUSE e con la TASTIERA (1–4, Invio per la multipla), punti allineati, materia
 *     votata con i tasti, podio; la vista per la LIVE non mostra mai codice/QR/link né la risposta
 *     scelta prima della soluzione; il giocatore ricarica e ritrova i punti.
 *  b. PC contro telefono (iPhone) nella stessa partita.
 *  c. 3+ giocatori.
 *  d. l'host chiude la scheda a metà partita: la partita va avanti (passo di riserva dei giocatori);
 *     l'host riapre e continua.
 * Screenshot in test-results/pc-online-shots (o QZ_SHOTS_DIR).
 */
test.describe.configure({ mode: "serial" });
test.afterAll(async () => {
  await cleanupUsers();
});

const fmt = (n: number) => new Intl.NumberFormat("it-IT", { useGrouping: "always" }).format(n);

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
};

test("a. PC + PC online: mouse e tastiera, punti, voto, LIVE senza segreti, ricarica, podio", async ({ browser }) => {
  test.setTimeout(600_000);
  const hostU = await makeUser("pchost");
  const p2U = await makeUser("pcdue");

  // --------------------------------------------------------------- l'host crea dal PC: ONLINE
  const { ctx: hostCtx, page: host } = await newPage(browser, PC);
  const hostErrors = errorsOf(host);
  await login(host, hostU, "/gioca");
  await host.waitForURL(/\/gioca$/, { timeout: 60_000 });
  await host.getByRole("button", { name: "10", exact: true }).click();
  await host.getByRole("button", { name: "2", exact: true }).click();
  await host.getByRole("button", { name: /ONLINE — ognuno gioca dal suo dispositivo/ }).click();
  await shot(host, "a00-crea-online");
  await host.getByRole("button", { name: "CREA PARTITA" }).click();
  await host.waitForURL(/\/gioca\/online\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const sessionId = host.url().split("/").pop()!;
  const { code } = await gameRow(sessionId);
  // lobby orizzontale: codice, QR, link da copiare, INIZIA PARTITA, l'host entra come giocatore
  await expect(host.getByAltText(/QR code per entrare/)).toBeVisible({ timeout: 30_000 });
  // finestra più piccola (1280×720): la lobby con il modulo «Giochi anche tu?» non si sovrappone
  await host.setViewportSize({ width: 1280, height: 720 });
  await host.waitForTimeout(800);
  await shot(host, "a01b-lobby-host-prima-di-entrare-1280x720");
  await host.setViewportSize({ width: 1440, height: 900 });
  await expect(host.getByRole("textbox", { name: "Link per entrare nella partita" })).toHaveValue(new RegExp(`/play/${code}$`));
  await expect(host.getByLabel(/Giochi anche tu/)).toHaveValue(hostU.username);
  await host.getByRole("button", { name: "GIOCO ANCH'IO" }).click();
  await expect(host.getByText(/Giochi anche tu come/)).toBeVisible({ timeout: 20_000 });

  // --------------------------------------------------------------- il secondo PC entra con il suo account
  const { ctx: p2Ctx, page: p2 } = await newPage(browser, PC);
  const p2Errors = errorsOf(p2);
  await p2.goto(`/play/${code}`);
  await expect(p2.getByText("Partita ONLINE")).toBeVisible({ timeout: 30_000 });
  await shot(p2, "a01-ingresso-serve-account");
  // senza account non si entra nemmeno chiamando l'API
  const anon = await p2.request.post("/api/play/join", { data: { code, nickname: "Furbetto" } });
  expect(anon.status()).toBe(401);
  expect(((await anon.json()) as { error: { code: string } }).error.code).toBe("ACCOUNT_REQUIRED");
  await joinWithAccount(p2, p2U, code);
  await expect(host.getByText(p2U.username).first()).toBeVisible({ timeout: 20_000 });
  await host.waitForTimeout(1200);
  await shot(host, "a02-lobby-host-1440");
  await shot(p2, "a03-lobby-giocatore-1440");

  // --------------------------------------------------------------- vista per la LIVE (dal secondo PC)
  await p2.getByRole("button", { name: "Vista per la LIVE" }).click();
  await expect(p2.getByRole("region", { name: "Vista per la LIVE" })).toBeVisible();
  await shot(p2, "a04-pannello-live");
  const [live] = await Promise.all([p2Ctx.waitForEvent("page"), p2.getByRole("button", { name: "APRI LA VISTA LIVE" }).click()]);
  await live.setViewportSize({ width: 1280, height: 720 });
  const liveResponses: string[] = [];
  live.on("response", (r) => {
    if (r.url().includes("/api/live/")) void r.text().then((t) => liveResponses.push(t)).catch(() => undefined);
  });
  await expect(live).toHaveURL(new RegExp(`/gioca/live/${sessionId}$`));
  await expect(live.getByText("Tra poco si comincia!")).toBeVisible({ timeout: 30_000 });
  const liveHtml0 = await live.content();
  expect(liveHtml0).not.toContain(code);
  expect(liveHtml0).not.toContain("/play/");
  await expect(live.getByAltText(/QR code/)).toHaveCount(0);
  await live.waitForTimeout(1000);
  await shot(live, "f01-live-lobby-1280x720");
  await p2.getByRole("button", { name: "Vista per la LIVE" }).click(); // chiude il pannello

  // --------------------------------------------------------------- INIZIA PARTITA, avanti fino alla 1ª domanda
  await host.getByRole("button", { name: /INIZIA PARTITA/ }).click();
  await waitFor(sessionId, (g) => g.phase !== "LOBBY");
  await advance(host, sessionId, (g) => g.phase === "OPTIONS_VISIBLE" && g.question === 1);
  // risposte aperte (dopo la lettura): l'host col MOUSE, il secondo PC con la TASTIERA
  await expect(answer(host, 1)).toBeEnabled({ timeout: 60_000 });
  await expect(answer(p2, 1)).toBeEnabled({ timeout: 30_000 });
  await expect(p2.locator("kbd").filter({ hasText: /^1$/ }).first()).toBeVisible();
  await shot(host, "a05-domanda-host-1440");
  await answer(host, 1).click();
  await p2.keyboard.press("2");
  await expect(host.getByText("RISPOSTA REGISTRATA!")).toBeVisible({ timeout: 20_000 });
  await expect(p2.getByText("RISPOSTA REGISTRATA!")).toBeVisible({ timeout: 20_000 });
  await expect(p2.locator("button[aria-keyshortcuts='2'][aria-pressed='true']")).toBeVisible();
  await shot(p2, "a06-risposta-tastiera-1440");
  await p2.setViewportSize({ width: 1280, height: 720 });
  await host.setViewportSize({ width: 1920, height: 1080 });
  await p2.waitForTimeout(800);
  await shot(p2, "a06b-risposta-1280x720");
  await shot(host, "a06c-domanda-host-1920x1080");
  await p2.setViewportSize({ width: 1440, height: 900 });
  await host.setViewportSize({ width: 1440, height: 900 });
  // la vista LIVE non mostra la risposta scelta prima della soluzione (né nessun'altra)
  await expect(live.locator("[aria-pressed='true']")).toHaveCount(0);
  await expect(live.getByText("RISPOSTA REGISTRATA!")).toHaveCount(0);
  await expect(live.locator("button[aria-keyshortcuts], button[aria-pressed]")).toHaveCount(0);
  await shot(live, "f02-live-domanda-dopo-risposta-1280x720");

  // tutti hanno risposto: soluzione → esito sui due PC, punti uguali a quelli del server
  await advance(host, sessionId, (g) => g.phase === "ANSWER_REVEAL" || g.phase === "SCORE_REVEAL");
  await expect(host.getByTestId("seat-result")).toBeVisible({ timeout: 30_000 });
  await expect(p2.getByTestId("seat-result")).toBeVisible({ timeout: 30_000 });
  await host.waitForTimeout(1500);
  await shot(host, "a07-soluzione-host-1440");
  await shot(live, "f03-live-soluzione-1280x720");
  const pts1 = await points(sessionId);
  await expect(p2.getByTestId("score-hud")).toContainText(fmt(pts1[p2U.username]), { timeout: 20_000 });

  // --------------------------------------------------------------- ricarica: il giocatore ritrova punti e posto
  await p2.reload();
  await expect(p2.getByTestId("score-hud")).toContainText(p2U.username, { timeout: 60_000 });
  await expect(p2.getByTestId("score-hud")).toContainText(fmt(pts1[p2U.username]));

  // --------------------------------------------------------------- 2ª domanda a risposta MULTIPLA: 1, 2 e Invio
  const q2 = await advance(host, sessionId, (g) => g.question === 2 && g.phase === "QUESTION_VISIBLE");
  await forceMultiple(q2.sqId!);
  await advance(host, sessionId, (g) => g.question === 2 && g.phase === "OPTIONS_VISIBLE");
  await expect(answer(p2, 1)).toBeEnabled({ timeout: 60_000 });
  await expect(answer(host, 1)).toBeEnabled({ timeout: 30_000 });
  await p2.keyboard.press("1");
  await p2.keyboard.press("2");
  await expect(p2.locator("button[aria-pressed='true'][aria-keyshortcuts]")).toHaveCount(2);
  await expect(p2.getByRole("button", { name: /CONFERMA/ })).toBeEnabled();
  await shot(p2, "a08-multipla-tastiera-1440");
  await p2.keyboard.press("Enter");
  await expect(p2.getByText("RISPOSTA REGISTRATA!")).toBeVisible({ timeout: 20_000 });
  // l'host: Tab fino alla risposta (anello di fuoco), Spazio, poi CONFERMA col mouse
  await answer(host, 3).focus();
  await host.keyboard.press("Space");
  await expect(answer(host, 3)).toHaveAttribute("aria-pressed", "true");
  await host.getByRole("button", { name: /CONFERMA/ }).click();
  await expect(host.getByText("RISPOSTA REGISTRATA!")).toBeVisible({ timeout: 20_000 });
  await advance(host, sessionId, (g) => g.question === 2 && (g.phase === "ANSWER_REVEAL" || g.phase === "SCORE_REVEAL"));
  await expect(p2.getByTestId("seat-result")).toContainText(/Esatta!/, { timeout: 30_000 });
  await expect(host.getByTestId("seat-result")).toContainText(/Sbagliata/, { timeout: 30_000 });

  // punti di questa risposta / classifica: il mio nome evidenziato (i punti si assegnano qui)
  await advance(host, sessionId, (g) => g.question === 2 && g.phase === "SCORE_REVEAL");
  const pts2 = await points(sessionId);
  expect(pts2[p2U.username]).toBeGreaterThan(pts1[p2U.username]);
  await expect(p2.getByTestId("score-hud")).toContainText(fmt(pts2[p2U.username]), { timeout: 20_000 });
  await expect(p2.getByText("(tu)").first()).toBeVisible({ timeout: 30_000 });
  await host.waitForTimeout(1500);
  await shot(p2, "a09-punti-giocatore-1440");
  await shot(live, "f04-live-punti-1280x720");

  // --------------------------------------------------------------- 3ª domanda, poi la votazione delle materie con i tasti
  await advance(host, sessionId, (g) => g.phase === "CATEGORY_VOTING" || (g.question ?? 0) > 3, { max: 60 });
  const voting = await gameRow(sessionId);
  if (voting.phase === "CATEGORY_VOTING") {
    await expect(p2.locator("button[aria-keyshortcuts='1']")).toBeEnabled({ timeout: 30_000 });
    await shot(host, "a10-voto-host-1440");
    await p2.keyboard.press("1");
    await host.locator("button[aria-keyshortcuts='2']").click();
    await expect(p2.getByText("VOTO REGISTRATO!")).toBeVisible({ timeout: 20_000 });
    await expect(host.getByText("VOTO REGISTRATO!")).toBeVisible({ timeout: 20_000 });
  }

  // --------------------------------------------------------------- classifica generale (fine round) e podio
  await advance(host, sessionId, (g) => g.phase === "LEADERBOARD" || g.phase === "SCORE_REVEAL" && (g.question ?? 0) >= 5, { max: 80 }).catch(() => undefined);
  await host.waitForTimeout(1500);
  await shot(host, "a11-classifica-host-1440");
  await shot(live, "f05-live-classifica-1280x720");

  await host.getByRole("button", { name: "Impostazioni" }).click();
  const menu = host.getByRole("dialog", { name: "Impostazioni" });
  await expect(menu).toBeVisible();
  await shot(host, "a12-menu-host-1440");
  await menu.getByRole("button", { name: "Termina partita" }).click();
  await menu.getByRole("button", { name: "Sì, termina" }).click();
  await host.keyboard.press("Escape");
  await expect(host.getByText("I CAMPIONI DELLA SERATA")).toBeVisible({ timeout: 90_000 });
  await expect(p2.getByText(/I CAMPIONI DELLA SERATA|LA CLASSIFICA FINALE/)).toBeVisible({ timeout: 60_000 });
  await expect(host.getByRole("button", { name: /RIVINCITA/ })).toBeVisible();
  await host.waitForTimeout(2000);
  await shot(host, "a13-podio-host-1440");
  await live.setViewportSize({ width: 1920, height: 1080 });
  await live.waitForTimeout(1200);
  await shot(live, "f06-live-podio-1920x1080");

  // la vista LIVE: mai il codice, né nella pagina né nelle risposte delle sue API
  expect(await live.content()).not.toContain(code);
  expect(liveResponses.length).toBeGreaterThan(0);
  for (const t of liveResponses) expect(t).not.toContain(code);
  // nessuno estraneo apre la vista conoscendo l'indirizzo
  const { ctx: strangerCtx, page: stranger } = await newPage(browser, PC);
  await stranger.goto(`/gioca/live/${sessionId}`);
  await expect(stranger.getByText(/La vista LIVE si apre dalla tua partita/)).toBeVisible({ timeout: 30_000 });
  expect((await stranger.request.get(`/api/live/${sessionId}/state`)).status()).toBe(401);
  await strangerCtx.close();

  expect(hostErrors, hostErrors.join("\n")).toEqual([]);
  expect(p2Errors, p2Errors.join("\n")).toEqual([]);
  await p2Ctx.close();
  await hostCtx.close();
});

test("b. PC contro telefono nella stessa partita online", async ({ browser }) => {
  test.setTimeout(300_000);
  const hostU = await makeUser("pcb");
  const phoneU = await makeUser("telb");
  const { ctx: hostCtx, page: host } = await newPage(browser, PC);
  await login(host, hostU, "/gioca");
  await host.waitForURL(/\/gioca$/, { timeout: 60_000 });
  const sessionId = await createOnlineGame(host);
  const { code } = await gameRow(sessionId);
  await host.getByRole("button", { name: "GIOCO ANCH'IO" }).click();
  await expect(host.getByText(/Giochi anche tu come/)).toBeVisible({ timeout: 30_000 });

  const { ctx: phoneCtx, page: phone } = await newPage(browser, PHONE);
  const phoneErrors = errorsOf(phone);
  await joinWithAccount(phone, phoneU, code);
  await shot(phone, "b01-telefono-lobby");

  await host.getByRole("button", { name: /INIZIA PARTITA/ }).click();
  await waitFor(sessionId, (g) => g.phase !== "LOBBY");
  await advance(host, sessionId, (g) => g.phase === "OPTIONS_VISIBLE" && g.question === 1);
  // il PC risponde con la tastiera, il telefono toccando lo show verticale
  await expect(answer(host, 1)).toBeEnabled({ timeout: 60_000 });
  const phoneFirst = phone.locator("button[aria-pressed]").first();
  await expect(phoneFirst).toBeEnabled({ timeout: 30_000 });
  await host.keyboard.press("1");
  await phoneFirst.tap();
  await expect(host.getByText("RISPOSTA REGISTRATA!")).toBeVisible({ timeout: 20_000 });
  await expect(phone.getByText("RISPOSTA REGISTRATA!")).toBeVisible({ timeout: 20_000 });
  await shot(phone, "b02-telefono-domanda");
  await advance(host, sessionId, (g) => g.phase === "ANSWER_REVEAL" || g.phase === "SCORE_REVEAL");
  await expect(host.getByTestId("seat-result")).toBeVisible({ timeout: 30_000 });
  await expect(phone.getByText(/Esatta!|Sbagliata…|Quasi!/)).toBeVisible({ timeout: 30_000 });
  const pts = await points(sessionId);
  expect(Object.keys(pts).sort()).toEqual([hostU.username, phoneU.username].sort());
  expect(phoneErrors, phoneErrors.join("\n")).toEqual([]);
  await phoneCtx.close();
  await hostCtx.close();
});

test("c. 3+ giocatori online (host + 2 PC + telefono)", async ({ browser }) => {
  test.setTimeout(300_000);
  const hostU = await makeUser("pcc");
  const others = [await makeUser("tre1"), await makeUser("tre2"), await makeUser("tre3")];
  const { ctx: hostCtx, page: host } = await newPage(browser, PC);
  await login(host, hostU, "/gioca");
  await host.waitForURL(/\/gioca$/, { timeout: 60_000 });
  const sessionId = await createOnlineGame(host);
  const { code } = await gameRow(sessionId);
  await host.getByRole("button", { name: "GIOCO ANCH'IO" }).click();
  await expect(host.getByText(/Giochi anche tu come/)).toBeVisible({ timeout: 30_000 });
  const players = [];
  for (const [i, u] of others.entries()) {
    const p = await newPage(browser, i === 2 ? PHONE : PC);
    await joinWithAccount(p.page, u, code);
    players.push(p);
  }
  await expect(host.getByText("4 giocatori collegati")).toBeVisible({ timeout: 30_000 });
  await shot(host, "c01-lobby-4-giocatori");
  await host.getByRole("button", { name: /INIZIA PARTITA/ }).click();
  await waitFor(sessionId, (g) => g.phase !== "LOBBY");
  await advance(host, sessionId, (g) => g.phase === "OPTIONS_VISIBLE" && g.question === 1);
  await expect(answer(host, 1)).toBeEnabled({ timeout: 60_000 });
  await host.keyboard.press("4");
  for (const [i, p] of players.entries()) {
    if (i === 2) {
      const b = p.page.locator("button[aria-pressed]").nth(1);
      await expect(b).toBeEnabled({ timeout: 30_000 });
      await b.tap();
    } else {
      await expect(answer(p.page, 1)).toBeEnabled({ timeout: 30_000 });
      await p.page.keyboard.press(String(i + 1));
    }
    await expect(p.page.getByText("RISPOSTA REGISTRATA!")).toBeVisible({ timeout: 20_000 });
  }
  // tutti hanno risposto: le risposte si chiudono da sole
  await waitFor(sessionId, (g) => g.phase !== "OPTIONS_VISIBLE", 30_000);
  await advance(host, sessionId, (g) => g.phase === "SCORE_REVEAL");
  await host.waitForTimeout(1500);
  for (const u of [hostU, ...others]) await expect(host.getByText(u.username).first()).toBeVisible({ timeout: 30_000 });
  await shot(host, "c02-punti-4-giocatori");
  for (const p of players) await p.ctx.close();
  await hostCtx.close();
});

test("d. l'host chiude la scheda: la partita va avanti da sola, poi l'host rientra", async ({ browser }) => {
  test.setTimeout(420_000);
  const hostU = await makeUser("pcd");
  const pU = await makeUser("resto");
  const { ctx: hostCtx, page: host } = await newPage(browser, PC);
  await login(host, hostU, "/gioca");
  await host.waitForURL(/\/gioca$/, { timeout: 60_000 });
  const sessionId = await createOnlineGame(host);
  const { code } = await gameRow(sessionId);
  await host.getByRole("button", { name: "GIOCO ANCH'IO" }).click();
  await expect(host.getByText(/Giochi anche tu come/)).toBeVisible({ timeout: 30_000 });
  const { ctx: pCtx, page: player } = await newPage(browser, PC);
  await joinWithAccount(player, pU, code);
  await host.getByRole("button", { name: /INIZIA PARTITA/ }).click();
  await waitFor(sessionId, (g) => g.phase !== "LOBBY");
  // si salta l'intro, poi l'host sparisce (scheda chiusa) durante la presentazione del round
  await advance(host, sessionId, (g) => g.phase !== "INTRO" && g.phase !== "LOBBY");
  const before = await gameRow(sessionId);
  // passi di riserva chiesti dal dispositivo del giocatore (/api/play/CODICE/tick)
  const fallback: { advanced: boolean }[] = [];
  player.on("response", (r) => {
    if (/\/api\/play\/[A-Z0-9]+\/tick/.test(r.url()) && r.ok()) void r.json().then((j: { advanced: boolean }) => fallback.push(j)).catch(() => undefined);
  });
  await host.close();
  // senza host: i passi successivi li fa eseguire il dispositivo del giocatore (passo di riserva)
  const moved = await waitFor(sessionId, (g) => g.version >= before.version + 2, 150_000);
  expect(moved.version).toBeGreaterThanOrEqual(before.version + 2);
  await expect.poll(() => fallback.some((f) => f.advanced), { timeout: 30_000 }).toBe(true);
  await shot(player, "d01-giocatore-senza-host");
  // il giocatore risponde anche senza host, se arriva una domanda
  if (moved.phase === "OPTIONS_VISIBLE" || moved.phase === "QUESTION_VISIBLE") await expect(player.getByText(/Domanda \d+ di/)).toBeVisible({ timeout: 30_000 });

  // l'host torna (stesso PC, stesso account): ritrova la partita e la comanda
  const host2 = await hostCtx.newPage();
  await host2.goto(`/gioca/online/${sessionId}`);
  await expect(host2.getByRole("button", { name: "Impostazioni" })).toBeVisible({ timeout: 60_000 });
  await expect(host2.getByTestId("score-hud")).toContainText(hostU.username, { timeout: 30_000 });
  const back = await gameRow(sessionId);
  await advance(host2, sessionId, (g) => g.version > back.version);
  await shot(host2, "d02-host-rientrato");
  await pCtx.close();
  await hostCtx.close();
});
