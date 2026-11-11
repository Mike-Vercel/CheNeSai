import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, devices } from "@playwright/test";

/**
 * Scorrimento automatico: la regia apre la lobby, passa ad "Automatico" e fa partire il round;
 * poi chiude la scheda e la serata va avanti da sola guidata dal TV (domanda → risposte →
 * timer → soluzione → punti). Infine la regia riapre e torna a "Manuale".
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@chenesai.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Quizzone-Dev-2026!";
const SESSION_FILE = path.join("test-results", "e2e-session-autoplay.json");

interface Session {
  sessionId: string;
  code: string;
  displayKey: string;
}

test.beforeAll(() => {
  // sessione dedicata (quella del global setup la usa la serata completa)
  execFileSync(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), "--conditions=react-server", "scripts/seed-demo.ts", "--e2e", SESSION_FILE], { stdio: "inherit" });
});

test("scorrimento automatico: la serata va da sola anche con la regia chiusa", async ({ browser }) => {
  const s = JSON.parse(readFileSync(SESSION_FILE, "utf8")) as Session;
  const step = { timeout: 45_000 };

  // ---------------------------------------------------------------- regia
  const adminCtx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const admin = await adminCtx.newPage();
  await admin.goto("/admin/login");
  await admin.getByLabel("Email").fill(ADMIN_EMAIL);
  await admin.getByLabel("Password").fill(ADMIN_PASSWORD);
  await admin.getByRole("button", { name: "ENTRA IN REGIA" }).click();
  await admin.waitForURL((url) => url.pathname.startsWith("/admin") && !url.pathname.includes("/login"), { timeout: 60_000 });
  const login = await adminCtx.storageState();
  await admin.goto(`/admin/sessions/${s.sessionId}/live`);
  await expect(admin.getByTestId("autoplay-status")).toHaveText(/MANUALE/);

  // ---------------------------------------------------------------- TV e un giocatore
  const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await tvCtx.newPage();
  await tv.goto(`/display/${s.sessionId}?k=${s.displayKey}`);
  await tv.getByRole("button", { name: "Continua senza audio" }).click();

  await admin.getByRole("button", { name: /APRI LOBBY/ }).first().click();
  await expect(tv.getByAltText(/QR code per entrare/)).toBeVisible();

  const phoneCtx = await browser.newContext({ ...devices["Pixel 7"] });
  const phone = await phoneCtx.newPage();
  await phone.goto(`/play/${s.code}`);
  await phone.getByLabel("Scegli il tuo nickname").fill("Auto");
  await phone.getByRole("button", { name: "ENTRA E GIOCA!" }).click();
  await phone.getByRole("button", { name: "ANDIAMO!" }).click();

  // ---------------------------------------------------------------- automatico
  await admin.getByRole("radio", { name: /Automatico/ }).click();
  await expect(admin.getByTestId("autoplay-status")).toHaveText(/AUTOMATICO — In attesa della regia/);
  await admin.getByRole("button", { name: /INIZIA ROUND/ }).first().click();
  await expect(tv.getByText("Cultura generale")).toBeVisible();
  await expect(admin.getByTestId("autoplay-status")).toHaveText(/AUTOMATICO — prossimo passo tra \d+ s: Mostra domanda/);

  // la regia chiude la scheda: guida il TV
  await adminCtx.close();

  await expect(tv.getByText("Qual è la capitale dell'Albania?")).toBeVisible(step);
  await expect(phone.getByRole("button", { name: /Tirana/ })).toBeVisible(step);
  await phone.getByRole("button", { name: /Tirana/ }).click();
  await expect(phone.getByText("RISPOSTA REGISTRATA!")).toBeVisible();
  // timer per intero, poi soluzione e punti senza nessun clic
  await expect(phone.getByText("ESATTO! 🎉")).toBeVisible(step);
  await expect(tv.getByText("PUNTI DI QUESTA RISPOSTA")).toBeVisible(step);
  // e la domanda successiva
  await expect(tv.getByText("Quali di questi sono pianeti del Sistema Solare?")).toBeVisible(step);

  // ---------------------------------------------------------------- di nuovo manuale
  const back = await browser.newContext({ viewport: { width: 1600, height: 1000 }, storageState: login });
  const regia = await back.newPage();
  await regia.goto(`/admin/sessions/${s.sessionId}/live`);
  await expect(regia.getByTestId("autoplay-status")).toHaveText(/AUTOMATICO/);
  await regia.getByRole("radio", { name: /Manuale/ }).click();
  await expect(regia.getByTestId("autoplay-status")).toHaveText(/MANUALE/);
  // fermo: in manuale nessun passo va avanti da solo (la versione dello stato non cambia)
  const versionLabel = regia.getByText(/· v\d+/).first();
  const before = await versionLabel.textContent();
  await tv.waitForTimeout(15_000);
  await expect(versionLabel).toHaveText(before ?? "");

  await Promise.all([back.close(), tvCtx.close(), phoneCtx.close()]);
});
