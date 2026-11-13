/**
 * Primi piani delle POSE al culmine (spalla, ascella, maniche) per controllare che la giacca non si strappi.
 *   node scripts/giramente/pose-shots.mjs http://localhost:PORTA cartella [filtro]
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:4950";
const out = process.argv[3] ?? "test-results/pose-shots";
const filter = process.argv[4] ?? "";
mkdirSync(out, { recursive: true });

/** [azione, istante del culmine in s] */
const POSES = [
  ["saluto", 1.3],
  ["indica", 1.2],
  ["applauso", 1.25],
  ["vittoria", 1.3],
  ["spinta", 0.3],
  ["spinta", 0.66],
  ["sorpresa", 1.0],
  ["pensiero", 1.3],
  ["risata", 1.2],
];

const browser = await chromium.launch({ headless: true, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
  for (const who of ["dontralla", "zafira"]) {
    for (const variant of ["a", "b"]) {
      for (const [action, t] of POSES) {
        for (const view of ["front", "side", "back"]) {
          const file = `${who}-${variant}-${action}-${String(t).replace(".", "_")}-${view}.png`;
          if (filter && !file.includes(filter)) continue;
          await page.goto(`${base}/preview/giramente/pose?who=${who}&variant=${variant}&action=${action}&t=${t}&view=${view}`, { waitUntil: "networkidle" });
          await page.waitForTimeout(Math.max(2200, t * 1000 + 1600));
          await page.screenshot({ path: path.join(out, file) });
          console.log("ok", file);
        }
      }
    }
  }
} finally {
  await browser.close();
}
