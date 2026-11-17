/**
 * Screenshot dell'anteprima dei minigiochi della MANCHE 1 (telefono 390×844, PC 1440×900, TV 1920×1080).
 * Uso: node scripts/tig/shots-manche-1.mjs <cartella> [--base=http://localhost:4110] [--v=0] [--stages=play,reveal]
 *      [--surfaces=tv,phone,pc] [--full=1] codice[:secondiTv[:secondiGiocatore]] …
 * Usa Chrome di sistema (channel "chrome"). Telefono e PC a pagina intera con --full=1.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--") && (a.includes("/") || a.includes("\\")));
if (!out) throw new Error("manca la cartella di uscita");
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3);
const base = opt("base", "http://localhost:4110");
const v = Number(opt("v", "0"));
const stages = opt("stages", "play,reveal").split(",");
const surfaces = opt("surfaces", "tv,phone,pc").split(",");
const full = opt("full", "0") === "1";
const items = args
  .filter((a) => !a.startsWith("--") && a !== out)
  .map((s) => {
    const [code, tv, pl] = s.split(":");
    return { code, tv: Number(tv ?? 5), pl: Number(pl ?? tv ?? 5) };
  });
mkdirSync(out, { recursive: true });

const SIZES = { tv: [1920, 1080], phone: [390, 844], pc: [1440, 900] };
const browser = await chromium.launch({ channel: "chrome" });
let n = 0;
for (const surface of surfaces) {
  const [w, h] = SIZES[surface];
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => console.log("ERRORE PAGINA", surface, e.message));
  for (const it of items) {
    for (const stage of stages) {
      const t = surface === "tv" ? it.tv : it.pl;
      const file = join(out, `${it.code}-v${v}-${surface}-${stage}.png`);
      await page.goto(`${base}/preview/tig/giochi?view=${surface}&m=${it.code}&v=${v}&stage=${stage}&t=${t}&freeze=1`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: file, fullPage: full && surface !== "tv" });
      n++;
    }
  }
  await page.close();
}
await browser.close();
console.log(`${n} screenshot salvati in ${out}`);
