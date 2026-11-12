import { expect, test, type Page } from "@playwright/test";
import { cleanup, db, login, makeUser, newPage, PC, PHONE, TV } from "./psyco-helpers";
import { competitorIds, driveUi, expectNoSolutionOnScreen, gmShot, plays, roomInfo } from "./giramente-helpers";

/**
 * GIRAMENTE! end-to-end, con account veri e partite giocate DALL'INTERFACCIA:
 *  1. due account su dispositivi separati (PC 1440×900 con la tastiera + telefono) per tutte le 5 manche,
 *     con lo schermo TV (nessuna soluzione delle prove private, vista LIVE senza codice);
 *  2. un solo telefono con 3 nomi (passaggio del telefono);
 *  3. una partita a squadre (un solo telefono, 2 squadre).
 */
test.describe.configure({ mode: "serial" });
test.afterAll(async () => {
  await cleanup();
});

async function setSector(roomId: string, sector: string, index: number) {
  const sql = db();
  try {
    const [r] = await sql<{ current_play_id: string }[]>`select current_play_id from giramente_rooms where id = ${roomId}`;
    await sql`update giramente_plays set sector = ${sector} where id = ${r.current_play_id}`;
    await sql`update giramente_spins set sector = ${sector}, target_index = ${index} where play_id = ${r.current_play_id}`;
  } finally {
    await sql.end();
  }
}

const roomIdOf = (page: Page) => /\/(stanza|un-dispositivo)\/([0-9a-f-]{36})/.exec(page.url())![2];

test("due account (PC con tastiera + telefono): 5 manche fino al vincitore, schermo TV e vista LIVE", async ({ browser }) => {
  test.setTimeout(900_000);
  const a = await makeUser("gmpc");
  const b = await makeUser("gmtel");
  const { ctx: ca, page: pa } = await newPage(browser, PC);
  const { ctx: cb, page: pb } = await newPage(browser, PHONE);
  const { ctx: ct, page: tv } = await newPage(browser, TV);

  // home e creazione dal PC
  await login(pa, a, "/giramente");
  await pa.waitForURL(/\/giramente$/);
  await expect(pa.getByRole("link", { name: /NUOVA PARTITA/ })).toBeVisible();
  await gmShot(pa, "pc-01-home");
  await pb.goto("/giramente");
  await gmShot(pb, "tel-01-home");
  await pa.getByRole("link", { name: /NUOVA PARTITA/ }).click();
  await pa.waitForURL(/\/giramente\/nuova/);
  await expect(pa.getByText("Durata stimata")).toBeVisible();
  await pa.getByText("⚙ Impostazioni").click();
  await pa.getByLabel("Introduzioni brevi (partita più veloce)").check();
  await gmShot(pa, "pc-02-nuova-partita");
  await pa.getByRole("button", { name: /INIZIA PARTITA/ }).click();
  await pa.waitForURL(/\/giramente\/stanza\//);
  const roomId = roomIdOf(pa);
  let info = await roomInfo(roomId);

  // ingresso dal telefono col link del QR (login e ritorno allo stesso codice)
  await login(pb, b, `/giramente/entra/${info.code}`);
  await pb.waitForURL(new RegExp(`/giramente/entra/${info.code}`));
  await pb.getByLabel("Il tuo nome in partita").fill("Telefono");
  await gmShot(pb, "tel-02-entra");
  await pb.getByRole("button", { name: /ENTRA IN PARTITA/ }).click();
  await pb.waitForURL(/\/giramente\/stanza\//);
  await expect(pa.getByText("Telefono")).toBeVisible({ timeout: 20_000 });
  await gmShot(pa, "pc-03-sala-partita");
  await gmShot(pb, "tel-03-sala-partita");

  // schermo TV (con codice e QR) e vista LIVE (senza codice né QR)
  await tv.goto(`/giramente/schermo/${info.display_key}`);
  await expect(tv.getByText(info.code)).toBeVisible({ timeout: 20_000 });
  await gmShot(tv, "tv-01-sala");
  const { ctx: cl, page: live } = await newPage(browser, TV);
  await live.goto(`/giramente/schermo/${info.display_key}?live=1`);
  await expect(live.getByText("Si parte tra poco…")).toBeVisible({ timeout: 20_000 });
  expect(await live.locator("body").innerText()).not.toContain(info.code);
  await expect(live.getByAltText("QR per entrare nella partita")).toHaveCount(0);
  await gmShot(live, "tv-02-live-senza-codice");
  await cl.close();

  await pa.getByRole("button", { name: /AVVIA PARTITA/ }).click();
  const comps = await competitorIds(roomId);
  const cA = comps.find((c) => c.name !== "Telefono")!.id;
  const pageFor = (cid: string) => (cid === cA ? pa : pb);
  let tvChecked = 0;
  let forcedJolly = false;

  await driveUi({
    roomId,
    host: pa,
    pageFor,
    keyboard: (p) => p === pa,
    correct: (cid, round) => cid === cA || round === 1,
    onPhase: async (r, n) => {
      const tag = `r${r.round_no}`;
      if (r.phase === "SPINNING" && r.round_no === 3 && !forcedJolly) {
        // una volta la ruota si ferma sulla Jolly (per vedere ingresso e poteri)
        forcedJolly = true;
        await setSector(roomId, "jolly", 5);
      }
      if (n > 1) return;
      const turnPage = r.turn_order.length ? pageFor(r.turn_order[r.turn_index]) : null;
      const shots: Record<string, () => Promise<void>> = {
        "ROUND_INTRO": async () => {
          await pa.waitForTimeout(700);
          await gmShot(pa, `pc-${tag}-introduzione`);
          await gmShot(tv, `tv-${tag}-introduzione`);
          if (r.round_no === 1 || r.round_no === 4) await gmShot(pb, `tel-${tag}-introduzione`);
        },
        "CHOICE": async () => {
          await pa.waitForTimeout(800);
          await gmShot(pa, `pc-${tag}-verde-rosso`);
          await gmShot(pb, `tel-${tag}-verde-rosso`);
          await gmShot(tv, `tv-${tag}-verde-rosso`);
        },
        "SPINNING": async () => {
          await pa.waitForTimeout(2500);
          await gmShot(pa, `pc-${tag}-ruota-gira`);
          await gmShot(pb, `tel-${tag}-ruota-gira`);
          await gmShot(tv, `tv-${tag}-ruota-gira`);
        },
        "WHEEL_RESULT": async () => {
          await pa.waitForTimeout(900);
          await gmShot(pa, `pc-${tag}-esito-ruota`);
          await gmShot(pb, `tel-${tag}-esito-ruota`);
          await gmShot(tv, `tv-${tag}-esito-ruota`);
        },
        "QUESTION": async () => {
          await pa.waitForTimeout(900);
          await gmShot(pa, `pc-${tag}-domanda`);
          await gmShot(pb, `tel-${tag}-domanda`);
          await gmShot(tv, `tv-${tag}-domanda`);
        },
        "TURN_RESULT": async () => {
          await pa.waitForTimeout(700);
          await gmShot(turnPage ?? pa, `${turnPage === pb ? "tel" : "pc"}-${tag}-risultato`);
          await gmShot(tv, `tv-${tag}-risultato`);
        },
        "PLAY": async () => {
          await pa.waitForTimeout(1200);
          const st = r.stage ?? "";
          await gmShot(pa, `pc-${tag}-${st}`);
          await gmShot(pb, `tel-${tag}-${st}`);
          await gmShot(tv, `tv-${tag}-${st}`);
          // il TV non mostra soluzioni né frasi nascoste delle prove in corso
          const open = await plays(roomId, "open");
          await expectNoSolutionOnScreen(tv, open.map((p) => p.solution ?? ""));
          tvChecked++;
        },
        "REVEAL": async () => {
          await pa.waitForTimeout(800);
          await gmShot(pa, `pc-${tag}-${r.stage}-rivelazione`);
          await gmShot(tv, `tv-${tag}-${r.stage}-rivelazione`);
        },
        "ROUND_RESULTS": async () => {
          await pa.waitForTimeout(800);
          await gmShot(pa, `pc-${tag}-classifica`);
          await gmShot(pb, `tel-${tag}-classifica`);
          await gmShot(tv, `tv-${tag}-classifica`);
        },
      };
      const run = shots[r.phase] ?? (r.phase === "PLAY" ? shots.PLAY : null);
      if (run) await run();
      // la seconda prova della manche 4 (tabellone) è un'altra PLAY nella stessa manche
      if (r.phase === "PLAY" && r.stage === "tabellone") return;
    },
  });
  // seconda prova della manche 4 fotografata a parte se serve
  info = await roomInfo(roomId);
  expect(info.phase).toBe("FINAL");
  expect(tvChecked).toBeGreaterThanOrEqual(2);
  await expect(pa.getByText("VINCITORE!")).toBeVisible({ timeout: 20_000 });
  await expect(tv.getByText("VINCITORE!")).toBeVisible({ timeout: 20_000 });
  await expect(pb.getByText("VINCITORE!")).toBeVisible({ timeout: 20_000 });
  const winnerName = comps.find((c) => c.id === cA)!.name;
  await expect(pa.getByText(winnerName).first()).toBeVisible();
  await pa.waitForTimeout(1200);
  await gmShot(pa, "pc-90-vincitore");
  await gmShot(pb, "tel-90-vincitore");
  await gmShot(tv, "tv-90-vincitore");
  const sql = db();
  try {
    const [w] = await sql<{ winners: string[] }[]>`select winners from giramente_rooms where id = ${roomId}`;
    expect(w.winners).toEqual([cA]);
    const [j] = await sql<{ n: number }[]>`select count(*)::int as n from giramente_jolly_log where room_id = ${roomId}`;
    expect(j.n).toBeGreaterThanOrEqual(1);
  } finally {
    await sql.end();
  }
  await ca.close();
  await cb.close();
  await ct.close();
});

test("un solo telefono con 3 nomi: «TOCCA A …», prove a turno, partita completa", async ({ browser }) => {
  test.setTimeout(900_000);
  const u = await makeUser("gmshared");
  const { ctx, page } = await newPage(browser, PHONE);
  await login(page, u, "/giramente/nuova");
  await page.waitForURL(/\/giramente\/nuova/);
  await page.getByRole("button", { name: /Un solo telefono/ }).click();
  await page.getByLabel("Giocatore 1").fill("Anna");
  await page.getByLabel("Giocatore 2").fill("Bruno");
  await page.getByLabel("Giocatore 3").fill("Carla");
  await page.getByText("⚙ Impostazioni").click();
  await page.getByLabel("Introduzioni brevi (partita più veloce)").check();
  await gmShot(page, "tel-condiviso-01-nuova");
  await page.getByRole("button", { name: /INIZIA PARTITA/ }).click();
  await page.waitForURL(/\/giramente\/un-dispositivo\//);
  const roomId = roomIdOf(page);
  await expect(page.getByText("Bruno")).toBeVisible();
  await gmShot(page, "tel-condiviso-02-sala");
  await page.getByRole("button", { name: /AVVIA PARTITA/ }).click();
  const comps = await competitorIds(roomId);
  let ready = 0;
  await driveUi({
    roomId,
    host: page,
    pageFor: () => page,
    correct: (cid) => cid === comps[2].id,
    onPhase: async (r, n) => {
      if (r.phase === "TURN_READY" && ready < 2) {
        ready++;
        await expect(page.getByText(/TOCCA A /).first()).toBeVisible({ timeout: 15_000 });
        await gmShot(page, `tel-condiviso-03-tocca-a-${ready}`);
      }
      if (r.phase === "PLAY" && n === 1) {
        await page.waitForTimeout(800);
        await gmShot(page, `tel-condiviso-04-${r.stage}`);
      }
    },
  });
  await expect(page.getByText("VINCITORE!")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Carla").first()).toBeVisible();
  await gmShot(page, "tel-condiviso-90-vincitore");
  await ctx.close();
});

test("partita a squadre (un solo telefono, 2 squadre da 2): il capitano conferma, fino al vincitore", async ({ browser }) => {
  test.setTimeout(900_000);
  const u = await makeUser("gmteam");
  const { ctx, page } = await newPage(browser, PC);
  await login(page, u, "/giramente/nuova?modo=squadre");
  await page.waitForURL(/\/giramente\/nuova/);
  await expect(page.getByRole("button", { name: /A SQUADRE/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Un solo telefono/ }).click();
  await page.getByLabel("Squadra 1, componente 1").fill("Aldo");
  await page.getByLabel("Squadra 1, componente 2").fill("Bea");
  await page.getByLabel("Squadra 2, componente 1").fill("Ciro");
  await page.getByLabel("Squadra 2, componente 2").fill("Dora");
  await page.getByText("⚙ Impostazioni").click();
  await page.getByLabel("Introduzioni brevi (partita più veloce)").check();
  await gmShot(page, "pc-squadre-01-nuova");
  await page.getByRole("button", { name: /INIZIA PARTITA/ }).click();
  await page.waitForURL(/\/giramente\/un-dispositivo\//);
  const roomId = roomIdOf(page);
  await expect(page.getByText("CAPITANO").first()).toBeVisible();
  await gmShot(page, "pc-squadre-02-sala");
  await page.getByRole("button", { name: /AVVIA PARTITA/ }).click();
  const comps = await competitorIds(roomId);
  await driveUi({
    roomId,
    host: page,
    pageFor: () => page,
    keyboard: () => true,
    correct: (cid) => cid === comps[0].id,
    onPhase: async (r, n) => {
      if (r.phase === "ROUND_RESULTS" && r.round_no === 3 && n === 1) {
        await page.waitForTimeout(600);
        await gmShot(page, "pc-squadre-03-classifica");
      }
    },
  });
  await expect(page.getByText("VINCITORE!")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Squadra Verde").first()).toBeVisible();
  await gmShot(page, "pc-squadre-90-vincitore");
  await ctx.close();
});
