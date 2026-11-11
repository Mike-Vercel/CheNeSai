import "server-only";
import { getSql, type Db } from "@/lib/database/db";

/**
 * true se la sessione è una partita libera (creata da un account host).
 * Le partite libere usano sempre i "nomi salvati" per le battute con i nickname (risparmio sul budget voci).
 * Modulo a sé (niente dipendenze dal motore): lo usano anche la TTS e il pre-riscaldamento.
 */
export async function isPublicSession(sessionId: string, db: Db = getSql()): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return false;
  const [s] = await db<{ public: boolean }[]>`select host_user_id is not null as public from game_sessions where id = ${sessionId}`;
  return s?.public ?? false;
}
