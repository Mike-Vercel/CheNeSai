import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import postgres from "postgres";
import { devices, expect, test, type Page } from "@playwright/test";

/**
 * RUOTA DI PALMINO dal vivo: serata di prova con la ruota forzata sulla 5ª domanda, già ai punti
 * della 4ª (vedi palmino-wheel-setup.ts). La regia vede «GIRA LA RUOTA DI PALMINO» e passa allo
 * scorrimento AUTOMATICO: da lì guida il TV (/tick e /spoken). Il TV (16:9) e il telefono di un
 * giocatore (show in verticale) mostrano Palmino che spinge la ruota, il giro e la categoria
 * scelta; poi, da sola, arriva la domanda di quella categoria (numero 5).
 * Screenshot (QZ_SHOTS_DIR=cartella): TV e telefono durante il colpo, il giro e il risultato.
 */
config({ path: ".env.local", quiet: true });

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@chenesai.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Quizzone-Dev-2026!";
const FILE = path.join("test-results", "e2e-ruota-palmino.json");
const SHOTS = process.env.QZ_SHOTS_DIR ?? null;
const tsx = (mode: string) =>
  execFileSync(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), "--conditions=react-server", "tests/e2e/palmino-wheel-setup.ts", mode, FILE], { stdio: "inherit" });

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

interface Session {
  sessionId: string;
  code: string;
  displayKey: string;
}

test.beforeAll(() => tsx("prepare"));
test.afterAll(() => {
  try {
    tsx("cleanup");
  } catch {
    // pulizia facoltativa
  }
});

test("la Ruota di Palmino sceglie la categoria della 5ª domanda su TV e telefoni", async ({ browser }) => {
  test.setTimeout(240_000);
  const s = JSON.parse(readFileSync(FILE, "utf8")) as Session;
  const errors: string[] = [];

  // ---------------------------------------------------------------- TV
  const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await tvCtx.newPage();
  tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
  await tv.goto(`/display/${s.sessionId}?k=${s.displayKey}`);
  await tv.getByRole("button", { name: "Continua senza audio" }).click();
  await expect(tv.getByText("PUNTI DI QUESTA RISPOSTA")).toBeVisible({ timeout: 60_000 });

  // ---------------------------------------------------------------- giocatore (show sul telefono)
  const phoneCtx = await browser.newContext({ ...devices["Pixel 7"] });
  const phone = await phoneCtx.newPage();
  phone.on("pageerror", (e) => errors.push(`telefono: ${e.message}`));
  await phone.goto(`/play/${s.code}`);
  await phone.getByLabel("Scegli il tuo nickname").fill("Ruotino");
  await phone.getByRole("button", { name: "ENTRA E GIOCA!" }).click();
  await phone.getByRole("button", { name: "ANDIAMO!" }).click();

  // ---------------------------------------------------------------- regia
  const adminCtx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const admin = await adminCtx.newPage();
  await admin.goto("/admin/login");
  await admin.getByLabel("Email").fill(ADMIN_EMAIL);
  await admin.getByLabel("Password").fill(ADMIN_PASSWORD);
  await admin.getByRole("button", { name: "ENTRA IN REGIA" }).click();
  await admin.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.includes("/login"), { timeout: 60_000 });
  await admin.goto(`/admin/sessions/${s.sessionId}/live`);
  // la regia sa che prima della prossima domanda arriva la ruota
  await expect(admin.getByText(/Prima la Ruota di Palmino/)).toBeVisible({ timeout: 30_000 });
  await expect(admin.getByRole("button", { name: /GIRA LA RUOTA DI PALMINO/ })).toBeVisible();
  // scorrimento automatico: la ruota (e poi la domanda) le fa partire il TV, senza altri clic
  await admin.getByRole("radio", { name: /Automatico/ }).click();

  // ---------------------------------------------------------------- la ruota
  const wheel = tv.getByTestId("palmino-wheel");
  await expect(wheel).toBeVisible({ timeout: 20_000 });
  await expect(tv.getByText("La Ruota di Palmino")).toBeVisible();
  await expect(tv.getByText(/Domanda 5: la categoria la sceglie la ruota!/)).toBeVisible();
  await expect(phone.getByTestId("palmino-wheel")).toBeVisible({ timeout: 20_000 });
  await shot(tv, "R1-tv-palmino-arriva");
  await shot(phone, "R1-telefono-palmino-arriva");
  // Palmino dà il colpo alla ruota (clip "spin" poco prima della partenza)
  await expect(tv.getByTestId("palmino-at-wheel")).toHaveAttribute("data-animation", "spin", { timeout: 15_000 });
  await shot(tv, "R2-tv-palmino-spinge");
  await shot(phone, "R2-telefono-palmino-spinge");
  await expect(tv.getByText("Gira… gira… gira!")).toBeVisible({ timeout: 10_000 });
  await tv.waitForTimeout(1500);
  await shot(tv, "R3-tv-gira");
  // arrivo: stessa categoria sul TV e sul telefono
  const result = tv.getByTestId("palmino-wheel-result");
  await expect(result).toBeVisible({ timeout: 20_000 });
  await expect(tv.getByTestId("palmino-at-wheel")).toHaveAttribute("data-animation", "celebrate");
  await expect(phone.getByTestId("palmino-wheel-result")).toBeVisible({ timeout: 10_000 });
  const label = (await result.locator("span").nth(1).innerText()).trim();
  expect(label.length).toBeGreaterThan(1);
  await expect(phone.getByTestId("palmino-wheel-result")).toContainText(label);
  await tv.waitForTimeout(800);
  await shot(tv, "R4-tv-risultato");
  await shot(phone, "R4-telefono-risultato");

  // ---------------------------------------------------------------- la domanda scelta (da sola)
  await expect(tv.getByText(`${label}: domanda di prova`, { exact: false })).toBeVisible({ timeout: 40_000 });
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  try {
    const [q] = await sql<{ category: string; play_order: number }[]>`
      select qs.category, sq.play_order from game_state gs
      join session_questions sq on sq.id = gs.current_session_question_id
      join question_snapshots qs on qs.session_question_id = sq.id
      where gs.session_id = ${s.sessionId}`;
    expect(q).toEqual({ category: label, play_order: 5 });
  } finally {
    await sql.end();
  }
  await shot(tv, "R5-tv-domanda-scelta");
  await shot(phone, "R5-telefono-domanda-scelta");
  expect(errors).toEqual([]);
  await Promise.all([tvCtx.close(), phoneCtx.close(), adminCtx.close()]);
});
