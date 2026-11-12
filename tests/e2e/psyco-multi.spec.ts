import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { candidateTexts, cleanup, currentRuleText, db, expectNoSecrets, login, makeUser, newPage, PC, PHONE, recordTraffic, shot, TV, type TestUser } from "./psyco-helpers";

/**
 * TEST 2, 3, 4, 6, 7, 8, 9, 10, 11, 12 – PSYCO con dispositivi personali e schermo TV.
 *
 *  - il PC dell'host (account) crea la stanza; lo SCHERMO TV (nessun account, non è un partecipante)
 *    mostra QR e codice;
 *  - un telefono NON autenticato inquadra il QR → login/registrazione → torna DA SOLO alla stanza;
 *  - altri 3 telefoni con account; un anonimo non può entrare come giocatore;
 *  - minimo 3 (con 2 «INIZIA» non parte), ruoli privati, scelta automatica, «pronto», timer
 *    (pausa, ripresa, refresh), tentativo sbagliato e giusto, seconda manche LIBERA con rotazione;
 *  - SICUREZZA: tutte le risposte HTTP e i frame realtime ricevuti dal telefono dello PSYCO e dallo
 *    schermo TV vengono registrati e controllati: il testo della regola non c'è mai (prima della fine);
 *  - disconnessione: un telefono va offline e torna, e ritrova lo stato.
 */
test.describe.configure({ mode: "serial" });

const signupName = `psycoqr_${randomUUID().slice(0, 6)}`;
const signupEmail = `${signupName}@test.chenesai.local`;
let host: TestUser;
let others: TestUser[];
const ctxs: BrowserContext[] = [];

test.beforeAll(async () => {
  host = await makeUser("psycohost");
  others = await Promise.all([makeUser("psycob"), makeUser("psycoc"), makeUser("psycod")]);
});
test.afterAll(async () => {
  for (const c of ctxs) await c.close().catch(() => undefined);
  await cleanup([signupEmail]);
});

test("dispositivi personali + schermo TV: accesso, QR, minimo 3, manche automatica e libera, sicurezza", async ({ browser }) => {
  test.setTimeout(420_000);

  // ------------------------------------------------ PC dell'host: crea la stanza
  const { ctx: pcCtx, page: pc } = await newPage(browser, PC);
  ctxs.push(pcCtx);
  await login(pc, host, "/psyco/nuova?modo=personale");
  await pc.waitForURL(/\/psyco\/nuova/);
  await pc.getByRole("textbox", { name: "Il tuo nickname in partita" }).fill("Sara");
  await pc.getByLabel("Minuti").fill("12");
  await pc.getByLabel("Secondi").fill("10");
  await shot(pc, "pc-01-crea-partita");
  await pc.getByRole("button", { name: "CREA LA PARTITA" }).click();
  await pc.waitForURL(/\/psyco\/stanza\/[0-9a-f-]{36}$/);
  const roomId = pc.url().split("/").pop()!;
  const code = (await pc.getByLabel(/^Codice [A-Z0-9 ]+$/).first().getAttribute("aria-label"))!.replace("Codice ", "").replace(/ /g, "");
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  // ------------------------------------------------ schermo TV: nessun account, solo chiave
  const key = ((await (await pc.request.get(`/api/psyco/rooms/${roomId}/schermo`)).json()) as { displayKey: string }).displayKey;
  const { ctx: tvCtx, page: tv } = await newPage(browser, TV);
  ctxs.push(tvCtx);
  const tvTraffic = recordTraffic(tv);
  await tv.goto(`/psyco/schermo/${key}`);
  await expect(tv.getByAltText("QR code per entrare nella partita")).toBeVisible();
  await expect(tv.getByText(code).first()).toBeVisible();
  await shot(tv, "tv-01-lobby-qr");
  // lo schermo non è un partecipante
  const sql = db();
  const [{ n: parts }] = await sql<{ n: number }[]>`select count(*)::int as n from psyco_participants where room_id = ${roomId}`;
  expect(parts).toBe(1);

  // ------------------------------------------------ anonimo: niente ingresso da giocatore
  const { ctx: anonCtx, page: anon } = await newPage(browser, PHONE);
  ctxs.push(anonCtx);
  expect((await anon.request.post("/api/psyco/join", { data: { code, nickname: "Furbo" } })).status()).toBe(401);
  expect((await anon.request.get(`/api/psyco/rooms/${roomId}`)).status()).toBe(401);

  // ------------------------------------------------ telefono non registrato: QR → registrazione → torna alla stanza
  await anon.goto(`/psyco/entra/${code}`);
  await anon.waitForURL(new RegExp(`/accedi\\?next=%2Fpsyco%2Fentra%2F${code}`));
  await anon.getByLabel("Username").fill(signupName);
  await expect(anon.getByText("Disponibile")).toBeVisible();
  await anon.getByLabel("Email").fill(signupEmail);
  await anon.getByLabel("Password", { exact: true }).fill(`Prova-${randomUUID().slice(0, 10)}`);
  await anon.getByRole("button", { name: "CREA ACCOUNT E GIOCA" }).click();
  await anon.waitForURL(new RegExp(`/psyco/entra/${code}$`), { timeout: 60_000 });
  await expect(anon.getByLabel("Il tuo nickname")).toHaveValue(signupName);
  await anon.getByLabel("Il tuo nickname").fill("Mike");
  await shot(anon, "telefono-10-entra-con-qr");
  await anon.getByRole("button", { name: "ENTRA NELLA STANZA" }).click();
  await anon.waitForURL(new RegExp(`/psyco/stanza/${roomId}$`));
  const phones: { page: Page; name: string }[] = [{ page: anon, name: "Mike" }];

  // ------------------------------------------------ minimo 3: con 2 non si comincia
  await expect(pc.getByText("Servono almeno 3 giocatori per cominciare (ora 2)")).toBeVisible({ timeout: 15_000 });
  await pc.getByRole("button", { name: "INIZIA LA PARTITA" }).click();
  await expect(pc.getByRole("heading", { name: "RUOLI ASSEGNATI" })).toHaveCount(0);
  expect((await pc.request.post(`/api/psyco/rooms/${roomId}/action`, { data: { action: "start_game" } })).status()).toBe(409);

  // ------------------------------------------------ altri tre telefoni con account (login → ritorno alla stanza)
  const names = ["Luca", "Giulia", "Marco"];
  for (let i = 0; i < 3; i++) {
    const { ctx, page } = await newPage(browser, PHONE);
    ctxs.push(ctx);
    await login(page, others[i], `/psyco/entra/${code}`);
    await page.waitForURL(new RegExp(`/psyco/entra/${code}$`));
    await page.getByLabel("Il tuo nickname").fill(names[i]);
    await page.getByRole("button", { name: "ENTRA NELLA STANZA" }).click();
    await page.waitForURL(new RegExp(`/psyco/stanza/${roomId}$`));
    phones.push({ page, name: names[i] });
  }
  // stesso account sul secondo dispositivo = stesso posto (nessun doppio)
  const { ctx: dupCtx, page: dup } = await newPage(browser, PHONE);
  ctxs.push(dupCtx);
  await login(dup, others[0], `/psyco/entra/${code}`);
  await dup.waitForURL(new RegExp(`/psyco/stanza/${roomId}$`));
  await dupCtx.close();
  await expect(tv.getByText("5 giocatori pronti: si può cominciare!")).toBeVisible({ timeout: 20_000 });
  await shot(phones[1].page, "telefono-11-lobby");
  await shot(pc, "pc-02-lobby-host");
  await shot(tv, "tv-02-lobby-5-giocatori");

  // ------------------------------------------------ disconnessione e ritorno in linea (lobby)
  await phones[3].page.context().setOffline(true);
  await expect(phones[3].page.getByText(/Sei offline|Ricollegamento/)).toBeVisible({ timeout: 20_000 });

  // ------------------------------------------------ via! ruoli privati
  await pc.getByRole("button", { name: "INIZIA LA PARTITA" }).click();
  await expect(tv.getByRole("heading", { name: "RUOLI ASSEGNATI" })).toBeVisible({ timeout: 15_000 });
  await phones[3].page.context().setOffline(false);
  const all: { page: Page; name: string }[] = [{ page: pc, name: "Sara" }, ...phones];
  let psyco: { page: Page; name: string } | null = null;
  for (const p of all) {
    await p.page.getByRole("button", { name: "Tocca per scoprire il tuo ruolo" }).click({ timeout: 20_000 });
    await p.page.getByRole("button", { name: "HO VISTO IL MIO RUOLO" }).waitFor();
    if ((await p.page.getByText("SEI LO PSYCO!").count()) > 0) psyco = p;
    if (p.name === "Luca") {
      await p.page.waitForTimeout(900);
      await shot(p.page, "telefono-12-ruolo");
    }
    await p.page.getByRole("button", { name: "HO VISTO IL MIO RUOLO" }).click();
  }
  expect(psyco).not.toBeNull();
  const knowers = all.filter((p) => p !== psyco);
  const psycoTraffic = recordTraffic(psyco!.page);
  await psyco!.page.reload(); // da qui ogni byte ricevuto dallo PSYCO viene controllato

  // ------------------------------------------------ automatica: difficoltà, regola rifiutata, regola accettata
  await expect(psyco!.page.getByText("NON GUARDARE!")).toBeVisible({ timeout: 20_000 });
  await shot(tv, "tv-03-scelta-regola");
  // chi arriva dopo la maggioranza trova già la schermata successiva
  for (const [i, k] of knowers.entries()) await k.page.getByRole("button", { name: /Difficile/ }).click({ timeout: i < 3 ? 20_000 : 4000 }).catch(() => undefined);
  await expect(knowers[0].page.getByRole("button", { name: "SÌ, QUESTA!" })).toBeVisible({ timeout: 20_000 });
  await shot(knowers[0].page, knowers[0].page === pc ? "pc-03-regola-proposta" : "telefono-13-regola-proposta");
  for (const k of knowers.slice(0, 3)) await k.page.getByRole("button", { name: "UN'ALTRA" }).click();
  await expect(tv.getByText("Regola proposta n. 2")).toBeVisible({ timeout: 20_000 });
  for (const k of knowers.slice(0, 3)) await k.page.getByRole("button", { name: "SÌ, QUESTA!" }).click({ timeout: 20_000 });
  await expect(tv.getByRole("heading", { name: "LA REGOLA È STATA SCELTA!" })).toBeVisible({ timeout: 20_000 });
  await expect(psyco!.page.getByRole("heading", { name: "LA REGOLA È STATA SCELTA!" })).toBeVisible();
  await expect(psyco!.page.getByText("PREPARATI A SCOPRIRLA!")).toBeVisible();
  const rule1 = (await currentRuleText(roomId))!;
  expect(rule1.length).toBeGreaterThan(5);
  await expect(knowers[0].page.getByText(rule1)).toBeVisible();
  await shot(knowers[1].page, "telefono-14-regola-confermata");
  await shot(psyco!.page, psyco!.page === pc ? "pc-04-psyco-attesa" : "telefono-15-psyco-attesa");

  // ------------------------------------------------ pronti → conto alla rovescia → timer 12:10
  for (const p of all) await p.page.getByRole("button", { name: "SONO PRONTO" }).click();
  await expect(tv.getByRole("timer")).toBeVisible({ timeout: 20_000 });
  await tv.waitForTimeout(4500);
  await expect(tv.getByRole("timer")).toContainText(/12:0\d|12:10/);
  await shot(tv, "tv-04-manche-timer");
  await shot(psyco!.page, psyco!.page === pc ? "pc-05-manche-psyco" : "telefono-16-manche-psyco");
  // refresh a metà manche: il tempo riparte dal riferimento del server, non da capo
  await knowers[1].page.reload();
  await expect(knowers[1].page.getByRole("timer")).toContainText(/12:0\d|11:5\d/, { timeout: 20_000 });
  // pausa e ripresa (host)
  await pc.getByRole("button", { name: "⏸ Pausa" }).click();
  await expect(tv.getByText("IN PAUSA")).toBeVisible({ timeout: 15_000 });
  const frozen = await tv.getByRole("timer").locator("span").first().innerText();
  await tv.waitForTimeout(2500);
  expect(await tv.getByRole("timer").locator("span").first().innerText()).toBe(frozen);
  await pc.getByRole("button", { name: "▶ Riprendi" }).click();
  await expect(tv.getByText("IN PAUSA")).toHaveCount(0, { timeout: 15_000 });

  // ------------------------------------------------ tentativo sbagliato, poi giusto
  await psyco!.page.getByRole("button", { name: "HO CAPITO LA REGOLA!" }).click();
  await expect(tv.getByText(/HA CAPITO\?/)).toBeVisible({ timeout: 15_000 });
  await shot(tv, "tv-05-verifica");
  // 3 «no» su 4 = maggioranza: la votazione si chiude da sola
  for (const k of knowers.slice(0, 3)) await k.page.getByRole("button", { name: "NO", exact: true }).click({ timeout: 15_000 });
  await expect(tv.getByText("SBAGLIATO! SI CONTINUA")).toBeVisible({ timeout: 15_000 });
  await psyco!.page.getByRole("button", { name: "HO CAPITO LA REGOLA!" }).click();
  await shot(knowers[0].page, knowers[0].page === pc ? "pc-06-verifica" : "telefono-17-verifica");
  for (const k of knowers.slice(0, 3)) await k.page.getByRole("button", { name: "SÌ, ESATTO" }).click({ timeout: 15_000 });
  await expect(tv.getByRole("heading", { name: "VINCE LO PSYCO!" })).toBeVisible({ timeout: 15_000 });

  // ------------------------------------------------ SICUREZZA: lo PSYCO e la TV non hanno mai ricevuto la regola né le proposte scartate
  const secrets = await candidateTexts(roomId);
  expect(secrets.length).toBeGreaterThanOrEqual(2);
  // la regola ora è pubblica (manche finita): si controlla solo il traffico arrivato PRIMA della fine
  await shot(tv, "tv-06-fine-manche-regola-svelata");
  await shot(psyco!.page, psyco!.page === pc ? "pc-07-fine-manche" : "telefono-18-fine-manche");
  await expect(tv.getByText(rule1)).toBeVisible(); // svelata a fine manche
  const rejected = secrets.filter((s) => s !== rule1);
  await expectNoSecrets(psycoTraffic, rejected); // le regole bocciate non arrivano mai allo PSYCO
  await expectNoSecrets(tvTraffic, rejected);
  // e la regola scelta non è arrivata prima della fine: nessuna risposta/evento con fase diversa da ROUND_END la contiene
  for (const chunk of [...psycoTraffic.chunks(), ...tvTraffic.chunks()]) if (chunk.includes(rule1)) expect(chunk).toMatch(/"phase":\s*"ROUND_END"/);
  expect(psycoTraffic.count()).toBeGreaterThan(3);

  // ------------------------------------------------ manche 2: LIBERA, senza limite di tempo, PSYCO a rotazione
  await pc.getByRole("radio", { name: /LIBERA/ }).click();
  await pc.getByRole("checkbox", { name: "SENZA LIMITE DI TEMPO" }).check();
  await pc.getByRole("button", { name: "NUOVA MANCHE" }).click();
  await expect(tv.getByRole("heading", { name: "RUOLI ASSEGNATI" })).toBeVisible({ timeout: 15_000 });
  let psyco2: { page: Page; name: string } | null = null;
  for (const p of all) {
    await p.page.getByRole("button", { name: "Tocca per scoprire il tuo ruolo" }).click({ timeout: 20_000 });
    await p.page.getByRole("button", { name: "HO VISTO IL MIO RUOLO" }).waitFor();
    if ((await p.page.getByText("SEI LO PSYCO!").count()) > 0) psyco2 = p;
    await p.page.getByRole("button", { name: "HO VISTO IL MIO RUOLO" }).click();
  }
  expect(psyco2).not.toBeNull();
  expect(psyco2!.name).not.toBe(psyco!.name);
  const knowers2 = all.filter((p) => p !== psyco2);
  const psyco2Traffic = recordTraffic(psyco2!.page);
  const proposals = ["Ogni risposta contiene il nome di un frutto", "Si risponde sempre guardando il soffitto", "Prima di rispondere si dice «allora»", "Ogni risposta finisce con «capito?»"];
  for (const [i, k] of knowers2.entries()) {
    await k.page.locator("#psy-proposal").fill(proposals[i], { timeout: 20_000 });
    if (i === 0) await shot(k.page, k.page === pc ? "pc-08-proposta-libera" : "telefono-19-proposta-libera");
    await k.page.getByRole("button", { name: "PROPONI" }).click();
  }
  await expect(knowers2[0].page.getByText("Votate la regola migliore")).toBeVisible({ timeout: 20_000 });
  await shot(knowers2[1].page, knowers2[1].page === pc ? "pc-09-voto-proposte" : "telefono-20-voto-proposte");
  for (const [i, k] of knowers2.entries()) await k.page.getByRole("button", { name: new RegExp(proposals[1]) }).click({ timeout: i < 3 ? 20_000 : 4000 }).catch(() => undefined);
  await expect(tv.getByRole("heading", { name: "LA REGOLA È STATA SCELTA!" })).toBeVisible({ timeout: 20_000 });
  expect(await currentRuleText(roomId)).toBe(proposals[1]);
  await expectNoSecrets(psyco2Traffic, proposals);
  await expectNoSecrets(tvTraffic, proposals);
  await pc.getByRole("button", { name: "Inizia anche se non tutti sono pronti" }).click();
  await expect(tv.getByText(/senza limite di tempo/)).toBeVisible({ timeout: 20_000 });
  await pc.getByRole("button", { name: "Termina la manche" }).click();
  await expect(tv.getByRole("heading", { name: "MANCHE CONCLUSA" })).toBeVisible({ timeout: 15_000 });

  // ------------------------------------------------ registro delle manche (niente punteggi, solo eventi)
  const rounds = await sql<{ round_no: number; outcome: string; attempts: number; rule_mode: string; timer_ms: number | null; participants_count: number }[]>`
    select round_no, outcome, attempts, rule_mode, timer_ms, participants_count from psyco_rounds where room_id = ${roomId} order by round_no`;
  expect(rounds).toEqual([
    { round_no: 1, outcome: "guessed", attempts: 2, rule_mode: "auto", timer_ms: 730_000, participants_count: 5 },
    { round_no: 2, outcome: "ended", attempts: 0, rule_mode: "free", timer_ms: null, participants_count: 5 },
  ]);
  // le regole dei giocatori non finiscono nell'archivio pubblico
  const [{ n: leaked }] = await sql<{ n: number }[]>`select count(*)::int as n from psyco_rules where description in ${sql(proposals)}`;
  expect(leaked).toBe(0);
  await sql.end();
});
