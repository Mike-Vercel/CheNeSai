import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { cleanup, currentRuleText, db, login, makeUser, newPage, PC, PHONE, recordTraffic, shot, TV, type TestUser } from "./psyco-helpers";

/**
 * PSYCO DA PC – «Schermo + telefoni» e «CHIAMA L'INVESTIGATORE».
 *
 *  (a) il PC dell'host crea la partita: la scelta predefinita è SCHERMO + TELEFONI; il PC diventa lo
 *      schermo pubblico (QR, timer, comandi che non rivelano nulla) e TUTTI giocano dal telefono, host
 *      compreso (stesso account, ritrova la stanza da host). Ogni byte ricevuto dal PC e dalla TV viene
 *      controllato: nessun ruolo, nessuna vista privata, nessuna regola prima della fine, nessun indizio;
 *  (b) la chiamata: squilla, RIFIUTA non consuma, RISPONDI → voce con sottotitolo → messaggio con
 *      l'indizio di livello 1; la seconda dà il livello 2; poi il limite. TV e altri telefoni: solo
 *      l'avviso, mai l'indizio (controllato anche nel loro traffico);
 *  (c) un solo dispositivo su PC: «TOCCA A …», mai «PASSA IL TELEFONO».
 */
test.describe.configure({ mode: "serial" });

let host: TestUser;
let others: TestUser[];
const ctxs: BrowserContext[] = [];

test.beforeAll(async () => {
  host = await makeUser("pcschermo");
  others = await Promise.all([makeUser("pcb"), makeUser("pcc"), makeUser("pcd")]);
});
test.afterAll(async () => {
  for (const c of ctxs) await c.close().catch(() => undefined);
  await cleanup();
});

async function roleOf(p: Page): Promise<"psyco" | "knower"> {
  await p.getByRole("button", { name: "Tocca per scoprire il tuo ruolo" }).click({ timeout: 20_000 });
  await p.getByRole("button", { name: "HO VISTO IL MIO RUOLO" }).waitFor();
  const r = (await p.getByText("SEI LO PSYCO!").count()) > 0 ? "psyco" : "knower";
  await p.getByRole("button", { name: "HO VISTO IL MIO RUOLO" }).click();
  return r;
}

test("PC = schermo pubblico, tutti dal telefono; chiamata all'Investigatore con indizi graduati", async ({ browser }) => {
  test.setTimeout(420_000);
  const sql = db();

  // ------------------------------------------------ PC: nuova partita, «Schermo + telefoni» è la scelta predefinita
  const { ctx: pcCtx, page: pc } = await newPage(browser, PC);
  ctxs.push(pcCtx);
  const pcTraffic = recordTraffic(pc);
  await login(pc, host, "/psyco/nuova?modo=personale");
  await pc.waitForURL(/\/psyco\/nuova/);
  await expect(pc.getByRole("radio", { name: /SCHERMO \+ TELEFONI/ })).toHaveAttribute("aria-checked", "true");
  await expect(pc.getByText("Consigliata")).toBeVisible();
  // un solo dispositivo: nascosto dietro «Altri modi di giocare»
  await expect(pc.getByRole("radio", { name: /UN SOLO DISPOSITIVO/ })).toBeHidden();
  await pc.getByRole("textbox", { name: "Il tuo nickname in partita" }).fill("Sara");
  await pc.getByLabel("Minuti").fill("12");
  await pc.getByLabel("Secondi").fill("10");
  await expect(pc.getByRole("radio", { name: "2", exact: true })).toHaveAttribute("aria-checked", "true"); // chiamate: 2 di serie
  await shot(pc, "pc-1440-01-nuova-partita-schermo-telefoni");
  await pc.getByText("Altri modi di giocare").click();
  await shot(pc, "pc-1440-02-nuova-partita-altri-modi");
  await pc.getByRole("radio", { name: /SCHERMO \+ TELEFONI/ }).click();
  await pc.getByRole("button", { name: "▶ AVVIA E APRI LO SCHERMO" }).click();
  await pc.waitForURL(/\/psyco\/schermo\/[A-Za-z0-9_-]{24,64}$/);
  const key = decodeURIComponent(pc.url().split("/").pop()!);
  const [room] = await sql<{ id: string; code: string; screen_mode: boolean }[]>`select id, code, screen_mode from psyco_rooms where display_key = ${key}`;
  expect(room.screen_mode).toBe(true);
  const { id: roomId, code } = room;
  await expect(pc.getByAltText("QR code per entrare nella partita")).toBeVisible();
  await expect(pc.getByTestId("psyco-screen-controls").getByRole("button", { name: "▶ INIZIA LA PARTITA" })).toBeDisabled();
  await expect(pc.getByText(/Si gioca tutti dal telefono/)).toBeVisible();
  await shot(pc, "pc-1440-03-schermo-pubblico-lobby");

  // ------------------------------------------------ TV (nessun account) sulla stessa chiave
  const { ctx: tvCtx, page: tv } = await newPage(browser, TV);
  ctxs.push(tvCtx);
  const tvTraffic = recordTraffic(tv);
  await tv.goto(`/psyco/schermo/${key}`);
  await expect(tv.getByText(code).first()).toBeVisible();
  await expect(tv.getByTestId("psyco-screen-controls")).toHaveCount(0); // niente comandi senza l'account dell'host

  // ------------------------------------------------ telefoni: l'host (stesso account) + 3 amici
  const phones: { page: Page; name: string }[] = [];
  const { ctx: hCtx, page: hp } = await newPage(browser, PHONE);
  ctxs.push(hCtx);
  await login(hp, host, `/psyco/entra/${code}`);
  await hp.waitForURL(new RegExp(`/psyco/stanza/${roomId}$`)); // già dentro: ritrova il suo posto
  await expect(hp.getByRole("button", { name: "INIZIA LA PARTITA" })).toBeVisible(); // ed è lui a gestire
  phones.push({ page: hp, name: "Sara" });
  const names = ["Mike", "Luca", "Giulia"];
  for (let i = 0; i < 3; i++) {
    const { ctx, page } = await newPage(browser, i === 2 ? { ...PHONE, viewport: { width: 360, height: 740 } } : PHONE);
    ctxs.push(ctx);
    await login(page, others[i], `/psyco/entra/${code}`);
    await page.waitForURL(new RegExp(`/psyco/entra/${code}$`));
    await page.getByLabel("Il tuo nickname").fill(names[i]);
    await page.getByRole("button", { name: "ENTRA NELLA STANZA" }).click();
    await page.waitForURL(new RegExp(`/psyco/stanza/${roomId}$`));
    phones.push({ page, name: names[i] });
  }
  await expect(pc.getByText("4 giocatori pronti: si può cominciare!")).toBeVisible({ timeout: 20_000 });
  // lo schermo non è un partecipante: 4 righe, una per telefono
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from psyco_participants where room_id = ${roomId}`;
  expect(n).toBe(4);
  await shot(pc, "pc-1440-04-schermo-lobby-4-telefoni");
  await pc.setViewportSize({ width: 1366, height: 768 });
  await shot(pc, "pc-1366-04-schermo-lobby-4-telefoni");
  await pc.setViewportSize({ width: 1440, height: 900 });
  await shot(tv, "tv-1920-01-lobby");

  // ------------------------------------------------ il PC avvia (comando che non rivela nulla)
  await pc.getByRole("button", { name: "▶ INIZIA LA PARTITA" }).click();
  await expect(pc.getByRole("heading", { name: "RUOLI ASSEGNATI" })).toBeVisible({ timeout: 15_000 });
  let psyco: { page: Page; name: string } | null = null;
  for (const p of phones) if ((await roleOf(p.page)) === "psyco") psyco = p;
  expect(psyco).not.toBeNull();
  const knowers = phones.filter((p) => p !== psyco);
  const knowerTraffic = recordTraffic(knowers[0].page);

  // ------------------------------------------------ regola d'archivio (facile), accettata
  for (const [i, k] of knowers.entries()) await k.page.getByRole("button", { name: /Facile/ }).click({ timeout: i < 2 ? 20_000 : 4000 }).catch(() => undefined);
  for (const [i, k] of knowers.entries()) await k.page.getByRole("button", { name: "SÌ, QUESTA!" }).click({ timeout: i < 2 ? 20_000 : 4000 }).catch(() => undefined);
  await expect(pc.getByRole("heading", { name: "LA REGOLA È STATA SCELTA!" })).toBeVisible({ timeout: 20_000 });
  const rule = (await currentRuleText(roomId))!;
  const [hintRow] = await sql<{ hint_1: string; hint_2: string; hint_3: string }[]>`
    select r.hint_1, r.hint_2, r.hint_3 from psyco_rounds x join psyco_rules r on r.id = x.rule_id where x.id = (select current_round_id from psyco_rooms where id = ${roomId})`;
  const hints = [hintRow.hint_1, hintRow.hint_2, hintRow.hint_3];

  // ------------------------------------------------ «VIA!» dallo schermo
  await pc.getByRole("button", { name: "▶ VIA!" }).click();
  await expect(tv.getByRole("timer")).toBeVisible({ timeout: 20_000 });
  await tv.waitForTimeout(4500); // conto alla rovescia
  await expect(tv.getByTestId("psyco-calls-chip")).toHaveText("0/2");
  // pausa e ripresa dal PC
  await pc.getByRole("button", { name: "⏸ PAUSA" }).click();
  await expect(tv.getByText("IN PAUSA")).toBeVisible({ timeout: 15_000 });
  await expect(psyco!.page.getByTestId("psyco-call-button")).toBeDisabled(); // in pausa niente chiamate
  await pc.getByRole("button", { name: "▶ RIPRENDI" }).click();
  await expect(tv.getByText("IN PAUSA")).toHaveCount(0, { timeout: 15_000 });
  await shot(pc, "pc-1440-05-schermo-manche");
  await shot(tv, "tv-1920-02-manche");

  // ------------------------------------------------ (b) chiamata: RIFIUTA non consuma
  const ps = psyco!.page;
  const callBtn = ps.getByTestId("psyco-call-button");
  await expect(callBtn).toContainText("Ne restano 2 su 2");
  await callBtn.click();
  const ringing = ps.getByRole("dialog", { name: "Chiamata in arrivo dall'Investigatore" });
  await expect(ringing).toBeVisible();
  await expect(ringing.getByText("INVESTIGATORE")).toBeVisible();
  await expect(ringing.getByText("numero sconosciuto")).toBeVisible();
  await ps.waitForTimeout(500);
  await shot(ps, "telefono-390-01-chiamata-in-arrivo");
  await ps.setViewportSize({ width: 360, height: 740 });
  await shot(ps, "telefono-360-01-chiamata-in-arrivo");
  await ps.setViewportSize({ width: 390, height: 844 });
  await ps.getByRole("button", { name: "Rifiuta la chiamata" }).click();
  await expect(ringing).toHaveCount(0);
  await expect(callBtn).toContainText("Ne restano 2 su 2");
  expect((await sql<{ n: number }[]>`select count(*)::int as n from psyco_calls where room_id = ${roomId}`)[0].n).toBe(0);

  // ------------------------------------------------ RISPONDI: voce con sottotitolo, poi il messaggio (livello 1)
  await callBtn.click();
  await ps.getByRole("button", { name: "Rispondi alla chiamata" }).click();
  await expect(ps.getByTestId("psyco-call-subtitle")).toBeVisible({ timeout: 15_000 });
  await expect(ps.getByTestId("psyco-call-subtitle")).toContainText(/messaggio|scritto/);
  await shot(ps, "telefono-390-02-voce-sottotitolo");
  await ps.setViewportSize({ width: 360, height: 740 });
  await shot(ps, "telefono-360-02-voce-sottotitolo");
  await ps.setViewportSize({ width: 390, height: 844 });
  // TV e altri telefoni: solo l'avviso pubblico
  await expect(tv.getByTestId("psyco-call-notice")).toContainText("Lo PSYCO ha chiamato l'investigatore! (1/2)", { timeout: 15_000 });
  await expect(knowers[2].page.getByTestId("psyco-call-notice")).toContainText("(1/2)");
  await shot(tv, "tv-1920-03-avviso-chiamata");
  await shot(pc, "pc-1440-06-avviso-chiamata");
  await shot(knowers[2].page, "telefono-360-03-avviso-altro-telefono");
  await expect(ps.getByTestId("psyco-call-hint")).toBeVisible({ timeout: 20_000 });
  await expect(ps.getByTestId("psyco-call-hint")).toContainText(hints[0]);
  await expect(ps.getByTestId("psyco-call-hint")).toContainText("Indizio n. 1");
  await shot(ps, "telefono-390-03-messaggio-indizio");
  await ps.setViewportSize({ width: 360, height: 740 });
  await shot(ps, "telefono-360-04-messaggio-indizio");
  await ps.setViewportSize({ width: 390, height: 844 });
  await ps.getByRole("button", { name: "HO LETTO" }).click();
  await expect(tv.getByTestId("psyco-calls-chip")).toHaveText("1/2", { timeout: 15_000 });
  await expect(callBtn).toContainText("Ultima chiamata su 2");

  // ------------------------------------------------ seconda chiamata: livello 2, poi il limite
  await callBtn.click();
  await ps.getByRole("button", { name: "Rispondi alla chiamata" }).click();
  await expect(ps.getByTestId("psyco-call-hint")).toContainText(hints[1], { timeout: 25_000 });
  await expect(ps.getByTestId("psyco-call-hint")).toContainText("Indizio n. 2");
  await ps.getByRole("button", { name: "HO LETTO" }).click();
  await expect(callBtn).toBeDisabled();
  await expect(callBtn).toContainText("Nessuna chiamata rimasta");
  // i messaggi restano consultabili
  await ps.getByRole("button", { name: /Messaggi dell'Investigatore: 2/ }).click();
  await expect(ps.getByTestId("psyco-messages").getByText(hints[0])).toBeVisible();
  await expect(ps.getByTestId("psyco-messages").getByText(hints[1])).toBeVisible();
  await shot(ps, "telefono-390-04-messaggi");
  await ps.getByRole("button", { name: "Chiudi" }).click();
  const calls = await sql<{ call_no: number; level: number }[]>`select call_no, level from psyco_calls where room_id = ${roomId} order by call_no`;
  expect(calls).toEqual([
    { call_no: 1, level: 1 },
    { call_no: 2, level: 2 },
  ]);

  // ------------------------------------------------ verifica giusta → fine manche: regola pubblica, indizi mai
  await ps.getByRole("button", { name: "HO CAPITO LA REGOLA!" }).click();
  for (const [i, k] of knowers.entries()) await k.page.getByRole("button", { name: "SÌ, ESATTO" }).click({ timeout: i < 2 ? 15_000 : 4000 }).catch(() => undefined);
  await expect(pc.getByRole("heading", { name: "VINCE LO PSYCO!" })).toBeVisible({ timeout: 15_000 });
  await expect(pc.getByText(rule)).toBeVisible();
  await expect(pc.getByRole("button", { name: "▶ NUOVA MANCHE" })).toBeVisible();
  await shot(pc, "pc-1440-07-fine-manche");

  // ------------------------------------------------ SICUREZZA: PC, TV e un altro telefono
  for (const [label, t] of [
    ["PC", pcTraffic],
    ["TV", tvTraffic],
    ["telefono di chi conosce la regola", knowerTraffic],
  ] as const) {
    const all = t.all();
    for (const h of hints) expect(all.includes(h), `${label}: indizio ricevuto «${h.slice(0, 40)}»`).toBe(false);
    expect(all, label).not.toMatch(/"investigator":\s*\{/);
  }
  for (const [label, t] of [
    ["PC", pcTraffic],
    ["TV", tvTraffic],
  ] as const) {
    const all = t.all();
    // il PC dell'host non riceve MAI una vista privata: niente ruolo, niente «secret», niente «view»
    expect(all, label).not.toMatch(/"role":\s*"(psyco|knower)"/);
    expect(all, label).not.toMatch(/"secret":/);
    expect(all, label).not.toMatch(/"view":\s*\{/);
    // la regola compare solo a manche finita
    for (const chunk of t.chunks()) if (chunk.includes(rule)) expect(chunk, label).toMatch(/"phase":\s*"ROUND_END"/);
  }
  expect(pcTraffic.count()).toBeGreaterThan(5);
  await sql.end();
});

test("un solo dispositivo su PC: «TOCCA A …», mai «PASSA IL TELEFONO»", async ({ browser }) => {
  const { ctx, page } = await newPage(browser, PC);
  ctxs.push(ctx);
  await login(page, host, "/psyco/nuova?modo=condiviso");
  await page.waitForURL(/\/psyco\/nuova\?modo=condiviso/);
  await expect(page.getByRole("radio", { name: /UN SOLO DISPOSITIVO/ })).toHaveAttribute("aria-checked", "true");
  for (const [i, nick] of ["Sara", "Mike", "Luca"].entries()) await page.getByRole("textbox", { name: `Nickname ${i + 1}`, exact: true }).fill(nick);
  await page.getByRole("button", { name: "▶ AVVIA", exact: true }).click();
  await page.waitForURL(/\/psyco\/un-dispositivo\/[0-9a-f-]{36}$/);
  await page.getByRole("button", { name: "INIZIA LA PARTITA" }).click();
  await expect(page.getByRole("heading", { name: /TOCCA A/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Gli altri non guardino lo schermo.")).toBeVisible();
  await expect(page.getByText("PASSA IL TELEFONO")).toHaveCount(0);
  await shot(page, "pc-1440-08-un-dispositivo-tocca-a");
});
