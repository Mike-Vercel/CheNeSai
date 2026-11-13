/**
 * Foto dello STUDIO 3D di GIRAMENTE! dall'anteprima con stati finti (/preview/giramente/studio), con la scheda video
 * vera (ANGLE D3D11) invece del renderer software dei test.
 *   node scripts/giramente/studio-shots.mjs [baseUrl] [cartella] [filtro]
 * Esempio: node scripts/giramente/studio-shots.mjs http://localhost:4950 ./shots spin
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:4950";
const out = process.argv[3] ?? "test-results/studio-shots";
const filter = process.argv[4] ?? "";
mkdirSync(out, { recursive: true });

const SIZES = {
  tv: { width: 1920, height: 1080 },
  pc: { width: 1440, height: 900 },
  tel: { width: 390, height: 844 },
};

/** [nome, parametri, attesa ms] */
const SCENES = [
  ["01-lobby", "phase=LOBBY", 6000],
  ["02-intro", "phase=INTRO", 5700],
  ["03-manche", "phase=ROUND_INTRO&round=1", 3300],
  ["04-verde-rosso", "phase=CHOICE&round=1", 5000],
  ["05-gira", "phase=SPIN&round=1", 5000],
  ["06-ruota-gira", "phase=SPINNING&round=1&spinAt=-1000&sector=bonus", 6200],
  ["07-esito-spicchio", "phase=WHEEL_RESULT&round=1&sector=bonus", 1100],
  ["08-esito-indica", "phase=WHEEL_RESULT&round=1&sector=bonus", 5700],
  ["09-domanda", "phase=QUESTION&round=3&sector=indizi", 5000],
  ["10-giusto", "phase=TURN_RESULT&round=3&sector=indizi&correct=1", 3100],
  ["11-sbagliato", "phase=TURN_RESULT&round=3&sector=indizi&correct=0", 4100],
  ["12-jolly", "phase=WHEEL_RESULT&round=3&sector=jolly", 8000],
  ["13-tabellone", "phase=PLAY&round=4&stage=tabellone", 5300],
  ["14-classifica", "phase=ROUND_RESULTS&round=3", 5500],
  ["15-vincitore", "phase=FINAL&round=5", 6500],
];

const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
try {
  for (const q of ["high", "low"]) {
    for (const [device, size] of Object.entries(SIZES)) {
      const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: device === "tel" ? 2 : 1, isMobile: device === "tel", hasTouch: device === "tel" });
      const page = await ctx.newPage();
      page.on("console", (m) => {
        if (m.type() === "error" || m.type() === "warning") console.log(`  [${device}/${q}] ${m.type()}: ${m.text().slice(0, 200)}`);
      });
      for (const [name, params, wait] of SCENES) {
        const file = `${q}-${device}-${name}.png`;
        if (filter && !file.includes(filter)) continue;
        await page.goto(`${base}/preview/giramente/studio?${params}&device=${device}&q=${q}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(wait);
        await page.screenshot({ path: path.join(out, file) });
        console.log("ok", file);
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
