import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * QR dei tavoli: token FIRMATO (parte casuale + firma HMAC con un segreto del server), salvato nel database.
 * Il QR porta solo a /taverna-dei-pirati/t/<token>: nessun dato personale. Un token alterato si scarta
 * prima ancora di cercarlo nel database.
 */
function secret(): string {
  return process.env.TIG_QR_SECRET || `tig-qr|${process.env.SUPABASE_SECRET_KEY ?? "sviluppo-locale"}`;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url").slice(0, 16);
}

export function newTableToken(): string {
  const body = randomBytes(15).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyTableToken(token: string): boolean {
  const m = /^([A-Za-z0-9_-]{20})\.([A-Za-z0-9_-]{16})$/.exec(String(token ?? ""));
  if (!m) return false;
  const a = Buffer.from(sign(m[1]));
  const b = Buffer.from(m[2]);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newJoinCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return s;
}
export const normalizeCode = (raw: string) =>
  String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
export const isJoinCode = (c: string) => /^[A-Z2-9]{6}$/.test(c);

export const newPin = () => String(randomInt(0, 10_000)).padStart(4, "0");
export const newDisplayKey = () => randomBytes(24).toString("base64url");
export const newSeed = () => randomBytes(8).toString("hex");
