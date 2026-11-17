import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, created, db, login, makeUser, PC, PHONE, TV, type TestUser } from "./psyco-helpers";

/**
 * TAVOLI IN GUERRA! end-to-end, DALL'INTERFACCIA: l'organizzatore crea la serata con 3 tavoli dal wizard, 3 account
 * entrano dai QR dei tavoli (più un secondo telefono sullo stesso tavolo), lo staff convalida, voto della mascotte,
 * via, prova di sviluppo giocata da telefono (tocco) e da PC (tastiera), TV con classifica, `?live=1` senza codici,
 * pausa/ripresa, Bottone del Caos usato una volta sola, premiazione. Dal database si leggono solo stato, token dei QR
 * e la soluzione (per rispondere giusto apposta).
 */
const SHOTS = process.env.TIG_SHOTS_DIR ?? path.join("test-results", "tig-shots");
mkdirSync(SHOTS, { recursive: true });
const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(700); // animazioni d'ingresso concluse
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
};

async function q<T>(fn: (sql: ReturnType<typeof db>) => Promise<T>): Promise<T> {
  const sql = db();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}
const evRow = (id: string) => q(async (sql) => (await sql<{ state: string; manche_no: number; current_game_id: string | null; display_key: string }[]>`select state, manche_no, current_game_id, display_key from tig_events where id = ${id}`)[0]);
async function waitState(id: string, states: string[], timeout = 30_000) {
  await expect.poll(async () => (await evRow(id)).state, { timeout }).toMatch(new RegExp(`^(${states.join("|")})$`));
}

async function open(browser: Browser, opts: Parameters<Browser["newContext"]>[0], u: TestUser, next: string) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await login(page, u, next);
  await page.waitForURL((url) => url.pathname.startsWith(next.split("?")[0]), { timeout: 60_000 });
  return page;
}

test.afterAll(async () => {
  if (created.users.length) await q((sql) => sql`delete from tig_events where owner_user_id in ${sql(created.users)}`);
  for (const id of created.users.splice(0)) await admin.auth.admin.deleteUser(id).catch(() => undefined);
});

test("serata completa: wizard, QR, convalida, mascotte, prova da telefono e PC, TV, pausa, Caos, premiazione", async ({ browser }) => {
  test.setTimeout(420_000);
  const org = await makeUser("tigorg");
  const [u1, u2, u3, u4] = await Promise.all([makeUser("tig1"), makeUser("tig2"), makeUser("tig3"), makeUser("tig4")]);

  // ------------------------------------------------------------------ l'organizzatore crea la serata (PC)
  const regia = await open(browser, PC, org, "/tavoli-in-guerra");
  await expect(regia.getByRole("menuitem", { name: /CREA SERATA/ })).toBeVisible();
  await shot(regia, "pc-01-shell-menu");
  await regia.getByRole("menuitem", { name: /CREA SERATA/ }).click();
  await regia.getByPlaceholder("Es. Birrificio del Porto").fill("Pub del Test");
  await regia.getByRole("button", { name: "AVANTI ›" }).click();
  for (let i = 0; i < 5; i++) await regia.getByRole("button", { name: "Un tavolo in meno" }).click();
  await expect(regia.locator("output").first()).toHaveText("3");
  await regia.getByRole("button", { name: "AVANTI ›" }).click();
  await shot(regia, "pc-02-wizard-durata");
  await regia.getByRole("button", { name: "AVANTI ›" }).click();
  await regia.getByRole("button", { name: "CREA LA SERATA" }).click();
  await regia.waitForURL(/\/tavoli-in-guerra\/regia\//, { timeout: 60_000 });
  const eventId = regia.url().split("/regia/")[1].split(/[?#/]/)[0];
  await expect(regia.getByRole("button", { name: "APRI LA LOBBY" })).toBeVisible({ timeout: 30_000 });
  await shot(regia, "pc-03-regia-bozza");
  const tables = await q((sql) => sql<{ table_no: number; qr_token: string; join_code: string }[]>`select table_no, qr_token, join_code from tig_tables where event_id = ${eventId} order by table_no`);
  expect(tables).toHaveLength(3);

  // foglio dei QR
  const qrPage = await regia.context().newPage();
  await qrPage.goto(`/tavoli-in-guerra/regia/${eventId}/qr`);
  await expect(qrPage.getByText("TAVOLO 3")).toBeVisible({ timeout: 30_000 });
  await expect(qrPage.getByRole("img", { name: "QR del tavolo 1" })).toBeVisible();
  await shot(qrPage, "pc-04-foglio-qr");
  await qrPage.close();

  await regia.getByRole("button", { name: "APRI LA LOBBY" }).click();
  await waitState(eventId, ["LOBBY_OPEN"]);
  const { display_key } = await evRow(eventId);

  // ------------------------------------------------------------------ TV
  const tvCtx = await browser.newContext(TV);
  const tv = await tvCtx.newPage();
  await tv.goto(`/tavoli-in-guerra/tv/${display_key}`);
  await expect(tv.getByText("Scansiona il QR del tuo tavolo")).toBeVisible({ timeout: 30_000 });
  await expect(tv.getByRole("img", { name: "QR del tavolo 2" })).toBeVisible();

  // vista per la diretta: niente QR né codici
  const liveCtx = await browser.newContext(TV);
  const live = await liveCtx.newPage();
  await live.goto(`/tavoli-in-guerra/tv/${display_key}?live=1`);
  await expect(live.getByText("TAVOLI IN GUERRA!").first()).toBeVisible({ timeout: 30_000 });
  await live.waitForTimeout(1500);
  const liveText = await live.locator("body").innerText();
  for (const t of tables) expect(liveText).not.toContain(t.join_code);
  await expect(live.getByRole("img", { name: /QR del tavolo/ })).toHaveCount(0);
  await shot(live, "tv-01-lobby-live");
  await liveCtx.close();

  // ------------------------------------------------------------------ i tavoli entrano dal QR
  const p1 = await open(browser, PHONE, u1, `/tavoli-in-guerra/t/${tables[0].qr_token}`);
  await expect(p1.getByText("Sei il primo del tavolo 1!")).toBeVisible({ timeout: 30_000 });
  await p1.getByLabel("Nome della squadra").fill("Le Volpi");
  await p1.getByLabel("Il tuo nome al tavolo").fill("Anna");
  await shot(p1, "phone-01-join-primo");
  await p1.getByRole("button", { name: "CREA LA SQUADRA" }).click();
  await p1.waitForURL(/\/tavoli-in-guerra\/gioca\//);

  const p4 = await open(browser, PHONE, u4, `/tavoli-in-guerra/t/${tables[0].qr_token}`);
  await expect(p4.getByText("«Le Volpi»")).toBeVisible({ timeout: 30_000 });
  await p4.getByLabel("Il tuo nome al tavolo").fill("Dario");
  await shot(p4, "phone-02-join-entra-nella-squadra");
  await p4.getByRole("button", { name: "ENTRA", exact: true }).click();
  await p4.waitForURL(/\/tavoli-in-guerra\/gioca\//);

  const p2 = await open(browser, PHONE, u2, `/tavoli-in-guerra/t/${tables[1].qr_token}`);
  await p2.getByLabel("Nome della squadra").fill("I Lupi");
  await p2.getByLabel("Il tuo nome al tavolo").fill("Bruno");
  await p2.getByRole("button", { name: "CREA LA SQUADRA" }).click();
  await p2.waitForURL(/\/tavoli-in-guerra\/gioca\//);

  // il terzo entra dal PC con il codice del tavolo
  const p3 = await open(browser, PC, u3, "/tavoli-in-guerra/entra");
  await p3.getByLabel("Codice del tavolo (6 caratteri)").fill(tables[2].join_code);
  await p3.keyboard.press("Enter");
  await p3.getByLabel("Nome della squadra").fill("Gli Orsi");
  await p3.getByLabel("Il tuo nome al tavolo").fill("Carla");
  await p3.getByRole("button", { name: "CREA LA SQUADRA" }).click();
  await p3.waitForURL(/\/tavoli-in-guerra\/gioca\//);

  // ------------------------------------------------------------------ convalida dello staff
  await expect(regia.getByRole("button", { name: "✓ CONVALIDA" })).toHaveCount(3, { timeout: 30_000 });
  await shot(regia, "pc-05-regia-roster-da-convalidare");
  for (let i = 0; i < 3; i++) {
    await regia.getByRole("button", { name: "✓ CONVALIDA" }).first().click();
    await expect(regia.getByRole("button", { name: "✓ CONVALIDA" })).toHaveCount(2 - i, { timeout: 15_000 });
  }
  await expect(tv.getByText("Le Volpi")).toBeVisible({ timeout: 20_000 });
  await shot(tv, "tv-02-lobby-qr");

  // ------------------------------------------------------------------ voto della mascotte (due telefoni dello stesso tavolo)
  await expect(p1.getByText("Squadra convalidata dallo staff")).toBeVisible({ timeout: 20_000 });
  await p1.getByRole("button", { name: /^Mascotte 3/ }).click();
  await p4.getByRole("button", { name: /^Mascotte 3/ }).click();
  await expect(p1.getByRole("button", { name: /Mascotte 3, 2 voti/ })).toBeVisible({ timeout: 15_000 });
  await shot(p1, "phone-03-voto-mascotte");
  await p1.getByRole("button", { name: "CONFERMA LA PIÙ VOTATA" }).click();
  await expect(p1.getByText("La vostra mascotte")).toBeVisible({ timeout: 15_000 });
  await p2.getByRole("button", { name: /^Mascotte 3/ }).isDisabled();

  // ------------------------------------------------------------------ via!
  await regia.getByRole("button", { name: "▶ INIZIA LA SERATA" }).click();
  await waitState(eventId, ["INTRO"]);
  await expect(tv.getByText("CHI PARTE MALE...").first()).toBeVisible({ timeout: 20_000 });
  await shot(tv, "tv-03-intro");
  await regia.getByRole("button", { name: "AVANTI ⏭" }).click();
  await waitState(eventId, ["ROUND_INTRO"]);
  await expect(tv.getByText("MANCHE 1 DI 5")).toBeVisible({ timeout: 20_000 });
  await shot(tv, "tv-04-intro-manche");
  await regia.getByRole("button", { name: "AVANTI ⏭" }).click();
  await waitState(eventId, ["GAME_ACTIVE"]);
  await expect(tv.getByText("PROVA RAPIDA (fixture)").first()).toBeVisible({ timeout: 20_000 });
  await shot(tv, "tv-05-regola-prova");
  await shot(p2, "phone-04-regola-prova");
  // fine della regola: si parte subito
  await regia.getByRole("button", { name: "AVANTI ⏭" }).click();
  const g = await evRow(eventId);
  const [{ content }] = await q((sql) => sql<{ content: { answer: number; options: string[] } }[]>`select content from tig_games where id = ${g.current_game_id}`);

  // telefono: tocco sull'opzione giusta, poi INVIA
  await expect(p1.getByRole("button", { name: new RegExp(content.options[content.answer].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toBeEnabled({ timeout: 20_000 });
  await expect(tv.getByText(content.options[0]).first()).toBeVisible({ timeout: 20_000 });
  await shot(tv, "tv-06-prova-in-corso");
  // il secondo telefono dello stesso tavolo non invia (lo fa il capitano)
  await expect(p4.getByText("La risposta della squadra la invia il capitano")).toBeVisible({ timeout: 15_000 });
  await p1.getByRole("button", { name: new RegExp(content.options[content.answer].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
  await shot(p1, "phone-05-prova-scelta");
  await p1.getByRole("button", { name: /^INVIA [ABCD]$/ }).click();
  await expect(p1.getByText("Risposta inviata ✓")).toBeVisible({ timeout: 15_000 });
  // il secondo telefono dello stesso tavolo, dopo l'invio del capitano, vede la risposta della squadra già inviata
  await expect(p4.getByText("Risposta inviata ✓")).toBeVisible({ timeout: 15_000 });
  // PC: tastiera (numero + Invio)
  await expect(p3.getByText(content.options[0]).first()).toBeVisible({ timeout: 20_000 });
  await shot(p3, "pc-06-prova-pc");
  await p3.keyboard.press(String(((content.answer + 1) % 4) + 1));
  await p3.keyboard.press("Enter");
  await expect(p3.getByText("Risposta inviata ✓")).toBeVisible({ timeout: 15_000 });
  // terzo tavolo: risposta giusta dal telefono
  await p2.getByRole("button", { name: new RegExp(content.options[content.answer].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).click();
  await p2.getByRole("button", { name: /^INVIA [ABCD]$/ }).click();
  // tutti hanno risposto: risultati
  await waitState(eventId, ["GAME_RESULTS"]);
  await expect(tv.getByText("RISULTATI").first()).toBeVisible({ timeout: 20_000 });
  await shot(tv, "tv-07-risultati");
  await expect(p1.getByText("Il vostro esito")).toBeVisible({ timeout: 20_000 });
  await expect(p1.getByText(/^\+1\d\d$/).filter({ visible: true })).toBeVisible();
  await shot(p1, "phone-06-esito");
  const scores = await q((sql) => sql<{ table_no: number; score: number }[]>`select table_no, score from tig_teams where event_id = ${eventId} order by table_no`);
  expect(scores[0].score).toBeGreaterThanOrEqual(100);
  expect(scores[2].score).toBe(0);

  // classifica sulla TV
  await regia.getByRole("button", { name: "AVANTI ⏭" }).click();
  await waitState(eventId, ["LEADERBOARD"]);
  await expect(tv.getByRole("list", { name: "Classifica" })).toBeVisible({ timeout: 20_000 });
  await tv.waitForTimeout(800);
  await shot(tv, "tv-08-classifica");

  // ------------------------------------------------------------------ pausa e ripresa
  await regia.getByRole("button", { name: "⏸ PAUSA" }).click();
  await waitState(eventId, ["PAUSED"]);
  await expect(tv.getByText("PAUSA").first()).toBeVisible({ timeout: 20_000 });
  await expect(p1.getByText("Pausa tecnica della regia")).toBeVisible({ timeout: 20_000 });
  await shot(regia, "pc-07-regia-pausa");
  await regia.getByRole("button", { name: "▶ RIPRENDI" }).click();
  await waitState(eventId, ["LEADERBOARD", "GAME_ACTIVE", "ROUND_INTRO"]);

  // ------------------------------------------------------------------ Bottone del Caos (manche 2: scorciatoia nel database per non giocare tutta la manche 1)
  await q((sql) => sql`update tig_events set manche_no = 2, state = 'LEADERBOARD', phase_deadline_at = now() + interval '60 seconds' where id = ${eventId}`);
  await p1.reload();
  const caosBtn = p1.getByRole("button", { name: "BOTTONE DEL CAOS" });
  await expect(caosBtn).toBeEnabled({ timeout: 20_000 });
  await shot(p1, "phone-07-poteri");
  await caosBtn.click();
  await p1.getByRole("button", { name: /TAVOLO 2/ }).click();
  await waitState(eventId, ["GAME_ACTIVE"]);
  await expect(tv.getByText("ALLARME CAOS!").first()).toBeVisible({ timeout: 20_000 });
  await shot(tv, "tv-09-allarme-caos");
  await shot(p3, "pc-08-caos-spettatore");
  await expect(p1.getByRole("button", { name: "CAOS USATO" })).toBeDisabled({ timeout: 20_000 });
  const caosCount = await q(async (sql) => (await sql<{ n: number }[]>`select count(*)::int as n from tig_powers where event_id = ${eventId} and kind = 'caos'`)[0].n);
  expect(caosCount).toBe(1);
  // duello: si gioca, si chiude
  await regia.getByRole("button", { name: "AVANTI ⏭" }).click(); // fine dell'allarme
  await regia.getByRole("button", { name: "AVANTI ⏭" }).click(); // chiusura del duello
  await waitState(eventId, ["GAME_RESULTS"]);
  await regia.getByRole("button", { name: "AVANTI ⏭" }).click();
  await waitState(eventId, ["LEADERBOARD"]);
  // il Bottone non torna disponibile
  await p1.reload();
  await expect(p1.getByRole("button", { name: "CAOS USATO" })).toBeDisabled({ timeout: 20_000 });

  // ------------------------------------------------------------------ finale e premiazione
  await regia.getByRole("button", { name: "🏁 Vai al finale e alla premiazione" }).click();
  await waitState(eventId, ["FINAL"]);
  await expect(tv.getByText("TUTTO O NIENTE!").first()).toBeVisible({ timeout: 20_000 });
  await shot(tv, "tv-10-finale");
  await regia.getByRole("button", { name: "AVANTI ⏭" }).click();
  await waitState(eventId, ["AWARDS", "GAME_ACTIVE"]);
  if ((await evRow(eventId)).state === "GAME_ACTIVE") {
    // spareggio (pari merito in testa): si chiude e si torna al finale
    await regia.getByRole("button", { name: "AVANTI ⏭" }).click();
    await regia.getByRole("button", { name: "AVANTI ⏭" }).click();
    await waitState(eventId, ["GAME_RESULTS"]);
    await regia.getByRole("button", { name: "AVANTI ⏭" }).click();
    await waitState(eventId, ["FINAL"]);
    await regia.getByRole("button", { name: "AVANTI ⏭" }).click();
    await waitState(eventId, ["AWARDS"]);
  }
  await expect(tv.getByText("CAMPIONI!")).toBeVisible({ timeout: 30_000 });
  await shot(tv, "tv-11-premiazione");
  await shot(p1, "phone-08-premiazione");
  await shot(regia, "pc-09-regia-premiazione");
  await regia.getByRole("button", { name: "CONCLUDI LA SERATA" }).click();
  await waitState(eventId, ["COMPLETED"]);
  // esportazione CSV
  const csv = await regia.request.get(`/api/tig/events/${eventId}/export`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("Le Volpi");
});
