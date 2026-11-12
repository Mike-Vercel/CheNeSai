import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import postgres from "postgres";
import { devices, expect, test, type Page } from "@playwright/test";

/**
 * PARTITA LIBERA: votazione delle materie, Ruota di Palmino e canzone SEMPRE presenti.
 * Partita vera da 10 domande in 1 round creata come da /gioca (vedi sempre-setup.ts), show sui
 * telefoni (verticale). Scorrimento AUTOMATICO guidato dal TV: votazione (il giocatore vota dallo
 * show sul suo telefono), risultato, prima domanda della materia votata; poi si salta alla canzone:
 * cartello "Ascolta", il TV e il telefono fanno sentire l'estratto (Web Audio) e solo DOPO si aprono
 * le risposte. Voci dei presentatori spente (niente ElevenLabs nei test): conta il resto.
 * Screenshot (QZ_SHOTS_DIR=cartella): votazione in verticale, "Ascolta" su TV 16:9 e telefono.
 */
config({ path: ".env.local", quiet: true });

const FILE = path.join("test-results", "e2e-sempre.json");
const SHOTS = process.env.QZ_SHOTS_DIR ?? null;
const tsx = (mode: string) =>
  execFileSync(process.execPath, [path.join("node_modules", "tsx", "dist", "cli.mjs"), "--conditions=react-server", "tests/e2e/sempre-setup.ts", mode, FILE], { stdio: "inherit" });

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

interface Saved {
  sessionId: string;
  code: string;
  displayKey: string;
  musicSqId: string;
  mediaId: string;
}

/** voci dei presentatori spente (preferenze dello schermo), audio e musica accesi */
const QUIET = `try { localStorage.setItem("qz.tv.prefs", JSON.stringify({ voice: false })) } catch {}`;

test.beforeAll(() => tsx("prepare"));
test.afterAll(() => {
  try {
    tsx("cleanup");
  } catch {
    // pulizia facoltativa
  }
});

test("partita libera: votazione dai telefoni, ruota e canzone «Ascolta» (TV e telefono, automatico)", async ({ browser }) => {
  test.setTimeout(300_000);
  const s = JSON.parse(readFileSync(FILE, "utf8")) as Saved;
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const errors: string[] = [];
  try {
    // ---------------------------------------------------------------- composizione (database)
    const rounds = await sql<{ kind: string; wheel: boolean; options: number }[]>`
      select r.kind::text as kind, r.palmino_wheel is not null as wheel,
        (select count(*)::int from category_vote_options o where o.round_id = r.id) as options
      from game_rounds r where r.session_id = ${s.sessionId} order by r.position`;
    expect(rounds).toEqual([{ kind: "category_vote", wheel: true, options: 3 }]);
    const [song] = await sql<{ vote_option_id: string | null; is_reserve: boolean }[]>`select vote_option_id, is_reserve from session_questions where id = ${s.musicSqId}`;
    expect(song).toEqual({ vote_option_id: null, is_reserve: false });

    // ---------------------------------------------------------------- TV (16:9)
    const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await tvCtx.addInitScript(QUIET);
    const tv = await tvCtx.newPage();
    tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
    await tv.goto(`/display/${s.sessionId}?k=${s.displayKey}`);
    await tv.getByRole("button", { name: "ATTIVA AUDIO E AVVIA SCHERMO" }).click();
    await expect(tv.getByAltText(/QR code per entrare/)).toBeVisible({ timeout: 60_000 });
    // l'estratto è servito al TV (file vero nell'archivio locale)
    expect((await tv.request.get(`/api/display/${s.sessionId}/media/${s.mediaId}?k=${s.displayKey}`)).ok()).toBe(true);

    // ---------------------------------------------------------------- giocatore (show sul telefono)
    const phoneCtx = await browser.newContext({ ...devices["Pixel 7"] });
    await phoneCtx.addInitScript(QUIET);
    const phone = await phoneCtx.newPage();
    phone.on("pageerror", (e) => errors.push(`telefono: ${e.message}`));
    await phone.goto(`/play/${s.code}`);
    await phone.getByLabel("Scegli il tuo nickname").fill("Votante");
    await phone.getByRole("button", { name: "ENTRA E GIOCA!" }).click();
    await phone.getByRole("button", { name: "ANDIAMO!" }).click();
    await expect(phone.getByText(/Sei dentro come Votante/)).toBeVisible({ timeout: 30_000 });
    await phone.getByRole("button", { name: /TOCCA PER L'AUDIO/ }).click();

    // ---------------------------------------------------------------- il round (automatico, guidato dal TV)
    tsx("start");
    await expect(phone.getByText("ADESSO DECIDETE VOI!").first()).toBeVisible({ timeout: 30_000 });
    // votazione in verticale: le materie da toccare
    await expect(phone.getByRole("heading", { name: "Votate la materia!" })).toBeVisible({ timeout: 40_000 });
    await expect(tv.getByText("Votate la categoria!")).toBeVisible({ timeout: 10_000 });
    const options = phone.locator("button[aria-pressed]");
    await expect(options).toHaveCount(3);
    await phone.waitForTimeout(600);
    await shot(phone, "V1-telefono-votazione");
    await shot(tv, "V1-tv-votazione");
    const label = (await options.nth(1).locator("span.flex-1").innerText()).trim();
    await options.nth(1).click();
    await expect(phone.getByText("VOTO REGISTRATO!")).toBeVisible({ timeout: 10_000 });
    await expect(options.nth(1)).toHaveAttribute("aria-pressed", "true");
    await shot(phone, "V2-telefono-voto-registrato");
    // chiusura a tempo scaduto (15 s) e risultato: vince l'unico voto
    await expect(phone.getByRole("heading", { name: "La materia scelta è…" })).toBeVisible({ timeout: 30_000 });
    await expect(phone.getByText(`${label}!`)).toBeVisible();
    await phone.waitForTimeout(800);
    await shot(phone, "V3-telefono-materia-scelta");
    await shot(tv, "V3-tv-materia-scelta");
    // poi, da sola, la prima domanda: della materia votata
    await expect(phone.getByText(/^1\/10$/)).toBeVisible({ timeout: 60_000 });
    await expect(phone.getByText(label, { exact: true }).first()).toBeVisible();

    // ---------------------------------------------------------------- la canzone
    tsx("song");
    await expect(tv.getByText("🎧 Ascolta la canzone")).toBeVisible({ timeout: 40_000 });
    await expect(phone.getByText("🎧 Ascolta la canzone")).toBeVisible({ timeout: 20_000 });
    // l'estratto parte (Web Audio, già sbloccato) su TV e telefono
    await expect(tv.getByText("Ascoltate bene…")).toBeVisible({ timeout: 30_000 });
    await expect(phone.getByText("Ascoltate bene…")).toBeVisible({ timeout: 15_000 });
    await tv.waitForTimeout(1200);
    await shot(tv, "A1-tv-ascolta");
    await shot(phone, "A1-telefono-ascolta");
    // le risposte si aprono solo a estratto finito (10 s)
    await expect(phone.locator("button[aria-pressed]").first()).toBeEnabled({ timeout: 60_000 });
    const [t] = await sql<{ waited_ms: number }[]>`
      select extract(epoch from (options_opened_at - shown_at)) * 1000 as waited_ms from session_questions where id = ${s.musicSqId}`;
    expect(Number(t.waited_ms)).toBeGreaterThanOrEqual(10_000);
    await shot(phone, "A2-telefono-risposte-dopo-canzone");
    expect(errors, errors.join("\n")).toEqual([]);
    await Promise.all([tvCtx.close(), phoneCtx.close()]);
  } finally {
    await sql.end();
  }
});
