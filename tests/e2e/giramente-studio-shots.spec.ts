import { expect, test, type Page } from "@playwright/test";
import { cleanup, db, login, makeUser, newPage, PC, PHONE, TV } from "./psyco-helpers";
import { competitorIds, createGame, driveUi, gmShot, roomInfo } from "./giramente-helpers";

/**
 * FOTO DELLO STUDIO 3D in una partita vera (PC 1440×900 + telefono 390×844 + schermo TV 1920×1080), con la scheda
 * video del computer (ANGLE D3D11) e la qualità forzata da GIRAMENTE_STUDIO_Q (high | low, predefinita high).
 * Facoltativo: parte solo con GIRAMENTE_STUDIO_SHOTS=1 (i test normali girano con il renderer software → 2D).
 *   GIRAMENTE_STUDIO_SHOTS=1 GIRAMENTE_STUDIO_Q=low E2E_BASE_URL=http://localhost:4950 npx playwright test giramente-studio-shots
 */
const ON = process.env.GIRAMENTE_STUDIO_SHOTS === "1";
const Q = process.env.GIRAMENTE_STUDIO_Q === "low" ? "low" : "high";

test.describe.configure({ mode: "serial" });
test.use({ launchOptions: { args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] } });
test.afterAll(async () => {
  if (ON) await cleanup();
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

const withQ = (page: Page) => page.goto(`${new URL(page.url()).pathname}?q=${Q}`);

test("studio 3D: foto di una partita vera su PC, telefono e TV", async ({ browser }) => {
  test.skip(!ON, "solo con GIRAMENTE_STUDIO_SHOTS=1");
  test.setTimeout(1_200_000);
  const a = await makeUser("gmshotpc");
  const b = await makeUser("gmshottel");
  const { ctx: ca, page: pa } = await newPage(browser, PC);
  const { ctx: cb, page: pb } = await newPage(browser, PHONE);
  const { ctx: ct, page: tv } = await newPage(browser, TV);
  const shot = (p: Page, dev: string, name: string) => gmShot(p, `${Q}-${dev}-${name}`);

  await login(pa, a, "/giramente/nuova");
  await pa.waitForURL(/\/giramente\/nuova/);
  await createGame(pa, { devices: "personal", quick: true });
  await pa.waitForURL(/\/giramente\/stanza\//);
  const roomId = /\/stanza\/([0-9a-f-]{36})/.exec(pa.url())![1];
  const info = await roomInfo(roomId);
  await login(pb, b, `/giramente/entra/${info.code}`);
  await pb.getByLabel("Il tuo nome in partita").fill("Sara");
  await pb.getByRole("button", { name: /ENTRA IN PARTITA/ }).click();
  await pb.waitForURL(/\/giramente\/stanza\//);
  await withQ(pa);
  await withQ(pb);
  await tv.goto(`/giramente/schermo/${info.display_key}?q=${Q}`);
  await expect(pa.locator(".gm-studio-canvas canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(tv.locator(".gm-studio-canvas canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(pa.getByText("Sara")).toBeVisible({ timeout: 20_000 });
  await pa.waitForTimeout(5000);
  await shot(pa, "pc", "01-sala");
  await shot(pb, "tel", "01-sala");
  await shot(tv, "tv", "01-sala");

  await pa.getByRole("button", { name: /AVVIA PARTITA/ }).click();
  const comps = await competitorIds(roomId);
  const cA = comps.find((c) => c.name !== "Sara")!.id;
  const pageFor = (cid: string) => (cid === cA ? pa : pb);
  let forcedJolly = false;
  const seen = new Set<string>();
  const all = async (name: string, wait = 0) => {
    if (wait) await pa.waitForTimeout(wait);
    await shot(pa, "pc", name);
    await shot(pb, "tel", name);
    await shot(tv, "tv", name);
  };
  await driveUi({
    roomId,
    host: pa,
    pageFor,
    correct: (cid, round) => cid === cA || round === 1,
    onPhase: async (r) => {
      if (r.phase === "SPINNING" && r.round_no === 3 && !forcedJolly) {
        forcedJolly = true;
        await setSector(roomId, "jolly", 5);
      }
      const key = `${r.phase}:${r.round_no}:${r.stage}`;
      if (seen.has(key)) return;
      seen.add(key);
      const tag = `r${r.round_no}`;
      if (r.phase === "INTRO") await all("02-intro", 2500);
      else if (r.phase === "ROUND_INTRO" && r.round_no === 1) await all("03-manche", 1500);
      else if (r.phase === "CHOICE" && r.round_no === 1) await all("04-verde-rosso", 2500);
      else if (r.phase === "SPINNING" && (r.round_no === 1 || r.round_no === 3)) {
        await all(`05-ruota-gira-${tag}-a`, 1200);
        await all(`05-ruota-gira-${tag}-b`, 2600);
      } else if (r.phase === "WHEEL_RESULT" && (r.round_no === 1 || r.round_no === 3)) {
        await all(`06-esito-${tag}-spicchio`, 300);
        await all(`06-esito-${tag}-indica`, 3200);
      } else if (r.phase === "QUESTION" && r.round_no === 1) await all("07-domanda", 1500);
      else if (r.phase === "TURN_RESULT" && r.round_no === 1) await all("08-risultato", 900);
      else if (r.phase === "PLAY" && r.stage === "tabellone") await all("09-tabellone", 3000);
      else if (r.phase === "ROUND_RESULTS" && (r.round_no === 1 || r.round_no === 3)) await all(`10-classifica-${tag}`, 3500);
    },
  });
  await expect(pa.getByText("VINCITORE!")).toBeVisible({ timeout: 20_000 });
  await all("11-vincitore", 5000);
  await ca.close();
  await cb.close();
  await ct.close();
});
