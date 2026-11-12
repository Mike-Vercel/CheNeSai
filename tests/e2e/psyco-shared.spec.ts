import { expect, test, type Page } from "@playwright/test";
import { VOICE_IDS } from "../../src/features/psyco/narrator";
import { cleanup, db, login, makeUser, newPage, PHONE, shot, type TestUser } from "./psyco-helpers";

/**
 * TEST 1 – PSYCO con UN SOLO TELEFONO: 5 persone, 1 account. Nickname, ruoli mostrati a turno con
 * le schermate di copertura, scelta collettiva (difficoltà + regola bocciata + regola accettata),
 * manche, «HO CAPITO!», verifica, fine, seconda manche con un altro PSYCO. Nessun'altra registrazione.
 * Anche: i clip della voce esistono (HTTP 200) e un clip mancante non blocca nulla.
 */
let owner: TestUser;
test.beforeAll(async () => {
  owner = await makeUser("psyco1tel");
});
test.afterAll(async () => cleanup());

const NAMES = ["Sara", "Mike", "Luca", "Giulia", "Marco"];

/** Passaggio del telefono finché c'è qualcuno a cui passarlo; `act` agisce per chi lo ha in mano. */
async function passAround(page: Page, kind: "ruolo" | "voto", act: (who: string, i: number) => Promise<void>, max = 10) {
  const re = kind === "ruolo" ? /^SONO .+ — MOSTRA IL MIO RUOLO$/ : /^SONO .+ — TOCCA A ME: VOTO$/;
  const seen: string[] = [];
  for (let i = 0; i < max; i++) {
    const btn = page.getByRole("button", { name: re });
    try {
      await btn.waitFor({ timeout: 8000 });
    } catch {
      break;
    }
    const label = (await btn.innerText()).trim();
    const who = label.replace(/^SONO /, "").replace(/ — .*$/, "");
    // la schermata di copertura NON mostra mai la regola
    await expect(page.getByText("regola proposta", { exact: false })).toHaveCount(0);
    await btn.click();
    await act(who, i);
    seen.push(who);
  }
  return seen;
}

test("un solo telefono: 5 nickname, un account, due manche", async ({ browser }) => {
  test.setTimeout(240_000);
  const sql = db();
  const { ctx, page } = await newPage(browser, PHONE);
  // un clip della voce "manca" (rete che lo blocca): il gioco deve andare avanti lo stesso
  await page.route("**/audio/psyco/ruoli-assegnati.mp3", (r) => r.abort());

  await login(page, owner, "/psyco/nuova?modo=condiviso");
  await page.waitForURL(/\/psyco\/nuova\?modo=condiviso/);
  await expect(page.getByRole("radio", { name: /UN SOLO DISPOSITIVO/ })).toHaveAttribute("aria-checked", "true");
  for (let i = 0; i < 5; i++) {
    if (i >= 3) await page.getByRole("button", { name: "+ Aggiungi giocatore" }).click();
    await page.getByRole("textbox", { name: `Nickname ${i + 1}`, exact: true }).fill(NAMES[i]);
  }
  await page.getByRole("button", { name: "01:30" }).click();
  await shot(page, "telefono-01-creazione-un-dispositivo");
  await page.getByRole("button", { name: "▶ AVVIA", exact: true }).click();
  await page.waitForURL(/\/psyco\/un-dispositivo\/[0-9a-f-]{36}$/);
  const roomId = page.url().split("/").pop()!;
  await expect(page.getByText("Giocatori (5)")).toBeVisible();
  await shot(page, "telefono-02-lobby-un-dispositivo");

  // ------------------------------------------------ manche 1: ruoli a turno
  await page.getByRole("button", { name: "INIZIA LA PARTITA" }).click();
  let psyco1 = "";
  const revealed = await passAround(page, "ruolo", async (who, i) => {
    await page.getByRole("button", { name: "HO VISTO IL MIO RUOLO" }).waitFor();
    if ((await page.getByText("SEI LO PSYCO!").count()) > 0) psyco1 = who;
    if (i === 0) {
      await page.waitForTimeout(900); // la carta si gira
      await shot(page, "telefono-03-ruolo-privato");
    }
    await page.getByRole("button", { name: "HO VISTO IL MIO RUOLO" }).click();
    // dopo la conferma il ruolo sparisce subito
    await expect(page.getByText("SEI LO PSYCO!")).toHaveCount(0);
    await expect(page.getByText("CONOSCERAI LA REGOLA!")).toHaveCount(0);
  });
  expect(revealed.sort()).toEqual(NAMES.map((n) => n.toUpperCase()).sort());
  expect(NAMES.map((n) => n.toUpperCase())).toContain(psyco1);

  // ------------------------------------------------ difficoltà scelta da chi conosce la regola (lo PSYCO non è mai chiamato)
  await expect(page.getByText(`${psyco1}, NON GUARDARE!`, { exact: false })).toBeVisible({ timeout: 15_000 });
  await shot(page, "telefono-04-passa-il-telefono");
  const voters = await passAround(page, "voto", async () => {
    await page.getByRole("button", { name: /Media/ }).click();
  }, 3); // 3 voti su 4 = maggioranza: la votazione si chiude da sola
  expect(voters).not.toContain(psyco1);

  // ------------------------------------------------ regola proposta: bocciata (3 su 4), poi accettata
  let rejected = 0;
  await passAround(page, "voto", async (_who, i) => {
    await expect(page.getByRole("button", { name: "SÌ, QUESTA!" })).toBeVisible();
    if (i === 0) await shot(page, "telefono-05-regola-proposta");
    await page.getByRole("button", { name: i < 3 ? "UN'ALTRA" : "SÌ, QUESTA!" }).click();
    if (i < 3) rejected++;
  }, 3);
  expect(rejected).toBe(3);
  await passAround(page, "voto", async () => {
    await page.getByRole("button", { name: "SÌ, QUESTA!" }).click();
  }, 3);

  // ------------------------------------------------ regola scelta → via
  await expect(page.getByRole("heading", { name: "LA REGOLA È STATA SCELTA!" })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("article.psy-paper")).toHaveCount(0); // nessuna regola a schermo
  await page.getByRole("button", { name: "TUTTI PRONTI: VIA!" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/01:(2\d|30)|00:/, { timeout: 10_000 });
  await page.waitForTimeout(5500);
  // il tempo scorre davvero (dopo il conto alla rovescia di 3,5 s)
  await expect(page.getByRole("timer").locator("span").first()).toHaveText(/01:[12]\d/);
  await shot(page, "telefono-06-manche-timer");

  // ------------------------------------------------ «CHIAMA L'INVESTIGATORE» sul telefono condiviso: la chiamata è per lo PSYCO
  await page.getByTestId("psyco-call-button").click();
  const call = page.getByRole("dialog", { name: "Chiamata in arrivo dall'Investigatore" });
  await expect(call).toBeVisible();
  await expect(call.getByText(new RegExp(`Per ${psyco1}`, "i"))).toBeVisible();
  await page.getByRole("button", { name: "Rispondi alla chiamata" }).click();
  await expect(page.getByTestId("psyco-call-hint")).toBeVisible({ timeout: 25_000 });
  await expect(page.getByTestId("psyco-call-hint")).toContainText("Indizio n. 1");
  await shot(page, "telefono-06b-messaggio-investigatore-condiviso");
  await page.getByRole("button", { name: "HO LETTO" }).click();
  const [{ calls }] = await sql<{ calls: number }[]>`select count(*)::int as calls from psyco_calls where room_id = ${roomId}`;
  expect(calls).toBe(1);
  // i messaggi si rileggono solo dichiarandosi lo PSYCO
  await page.getByRole("button", { name: new RegExp(`Messaggi di ${psyco1}`, "i") }).click();
  await page.getByRole("button", { name: new RegExp(`SONO ${psyco1}: MOSTRA`, "i") }).click();
  await expect(page.getByTestId("psyco-messages")).toBeVisible();
  await page.getByRole("button", { name: "Chiudi" }).click();

  // ------------------------------------------------ «HO CAPITO!» → verifica sul telefono condiviso → vince lo PSYCO
  await page.getByRole("button", { name: "HO CAPITO LA REGOLA!" }).click();
  await expect(page.getByText("HA INDOVINATO?")).toBeVisible();
  await shot(page, "telefono-07-verifica");
  for (let i = 0; i < 4; i++) {
    const yes = page.getByRole("button", { name: "Sì", exact: true }).first();
    if ((await yes.count()) === 0) break;
    await yes.click();
    await page.waitForTimeout(300);
  }
  await expect(page.getByRole("heading", { name: "VINCE LO PSYCO!" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("ecco qual era la regola")).toBeVisible();
  await shot(page, "telefono-08-fine-manche");

  // ------------------------------------------------ manche 2: stessa stanza, un altro PSYCO
  await page.getByRole("button", { name: "07:45" }).click();
  await page.getByRole("button", { name: "NUOVA MANCHE" }).click();
  let psyco2 = "";
  await passAround(page, "ruolo", async (who) => {
    await page.getByRole("button", { name: "HO VISTO IL MIO RUOLO" }).waitFor();
    if ((await page.getByText("SEI LO PSYCO!").count()) > 0) psyco2 = who;
    await page.getByRole("button", { name: "HO VISTO IL MIO RUOLO" }).click();
  });
  expect(psyco2).not.toBe("");
  expect(psyco2).not.toBe(psyco1);
  await page.getByRole("button", { name: "Termina la manche" }).click();
  await expect(page.getByRole("heading", { name: "MANCHE CONCLUSA" })).toBeVisible({ timeout: 15_000 });

  // ------------------------------------------------ database: 5 partecipanti locali, nessun account nuovo
  const [{ locals }] = await sql<{ locals: number }[]>`select count(*)::int as locals from psyco_participants where room_id = ${roomId} and kind = 'local' and user_id is null`;
  expect(locals).toBe(5);
  const [{ accounts }] = await sql<{ accounts: number }[]>`select count(*)::int as accounts from psyco_participants where room_id = ${roomId} and kind = 'account'`;
  expect(accounts).toBe(0); // nessun account per gli altri giocatori
  const rounds = await sql<{ round_no: number; outcome: string | null; timer_ms: number | null }[]>`select round_no, outcome, timer_ms from psyco_rounds where room_id = ${roomId} order by round_no`;
  expect(rounds.map((r) => r.outcome)).toEqual(["guessed", "ended"]);
  expect(rounds.map((r) => r.timer_ms)).toEqual([90_000, 465_000]);
  await sql.end();
  await ctx.close();
});

test("voce narrante: tutti i clip esistono (HTTP 200) e la colonna sonora c'è", async ({ request }) => {
  for (const id of VOICE_IDS) {
    const r = await request.get(`/audio/psyco/${id}.mp3`);
    expect(r.status(), id).toBe(200);
  }
  expect((await request.get("/audio/psyco/tema.mp3")).status()).toBe(200);
  // effetti della chiamata all'Investigatore
  for (const fx of ["squillo", "squillo-breve", "notifica", "riattacca"]) expect((await request.get(`/audio/psyco/${fx}.mp3`)).status(), fx).toBe(200);
});
