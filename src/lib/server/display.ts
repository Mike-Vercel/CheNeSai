import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { Db } from "@/lib/database/db";

/** Il TV si autentica con la chiave display (generata per sessione, visibile solo in regia). */
export async function verifyDisplayKey(db: Db, sessionId: string, key: string | null): Promise<boolean> {
  if (!key || !/^[0-9a-f-]{36}$/.test(sessionId)) return false;
  const [s] = await db<{ display_key: string }[]>`select display_key from game_sessions where id = ${sessionId}`;
  if (!s) return false;
  const a = Buffer.from(s.display_key);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}
