/**
 * Genera le icone dell'app installabile (PWA) dal logo in public/brand/icon-512.png.
 *   node scripts/generate-pwa-icons.mjs
 * Le PNG generate in public/icons/ vanno committate (non si rigenerano in build).
 *
 * - icon-*.png      icone "any" (il logo ha già lo sfondo notte pieno)
 * - maskable-*.png  icone "maskable": logo ridotto all'interno della zona sicura (cerchio dell'80%)
 *                   su sfondo notte, così Android può ritagliarle a cerchio/goccia senza tagliare la scritta
 * - apple-touch-icon.png  180×180 opaca per la schermata Home di iPhone/iPad
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "public", "brand", "icon-512.png");
const OUT = join(root, "public", "icons");
const NIGHT = { r: 0x17, g: 0x08, b: 0x24, alpha: 1 }; // --color-night in globals.css

mkdirSync(OUT, { recursive: true });

async function plain(size, name) {
  await sharp(SRC).resize(size, size, { fit: "contain", background: NIGHT }).flatten({ background: NIGHT }).png({ compressionLevel: 9 }).toFile(join(OUT, name));
}

async function maskable(size, name, scale = 0.74) {
  const inner = Math.round(size * scale);
  const logo = await sharp(SRC).resize(inner, inner, { fit: "contain", background: NIGHT }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: NIGHT } })
    .composite([{ input: logo, gravity: "center" }])
    .flatten({ background: NIGHT })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, name));
}

await plain(192, "icon-192.png");
await plain(512, "icon-512.png");
await maskable(192, "maskable-192.png");
await maskable(512, "maskable-512.png");
await plain(180, "apple-touch-icon.png");
console.log("Icone PWA generate in public/icons/");
