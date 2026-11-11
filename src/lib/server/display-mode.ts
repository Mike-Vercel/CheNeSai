import "server-only";
import { getSql, type Db } from "@/lib/database/db";

/**
 * Dove si guarda lo show di una partita libera:
 * - "phone": l'host ha scelto «Su questo telefono» → ogni giocatore vede e sente lo show sul suo telefono;
 * - "tv": televisore (abbinato con il codice, aperto dal PC o «Passa al televisore») → i telefoni dicono "Guarda il TV".
 * Lo decide l'ultima scelta dell'host. Cambia solo se diverso (niente scritture inutili) e lo stato
 * nuovo viene ritrasmesso a tutti i telefoni.
 */
export type DisplayMode = "tv" | "phone";

export async function setDisplayMode(sessionId: string, mode: DisplayMode, db: Db = getSql()): Promise<boolean> {
  const r = await db`update game_sessions set display_mode = ${mode} where id = ${sessionId} and display_mode is distinct from ${mode} returning id`;
  if (r.length === 0) return false;
  try {
    const { rebroadcast } = await import("./engine");
    await rebroadcast(sessionId);
  } catch {
    // lo stato arriva comunque al prossimo aggiornamento dei telefoni
  }
  return true;
}
