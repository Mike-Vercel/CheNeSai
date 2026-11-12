import "server-only";
import type { Db } from "@/lib/database/db";
import { findScriptLine, sessionLinesFor, type SpokenLine } from "@/features/game/script";
import { buildPublicState } from "./public-state";
import { checkRateLimit, PlayerError, type PlayerAuth } from "./players";

/** Richieste di voce per telefono (show sul telefono: poche battute per momento). */
export const PLAYER_TTS_RATE = { limit: 90, windowSeconds: 60 } as const;

/**
 * Voci per il telefono di un GIOCATORE (show sul telefono): consentite solo se la partita si guarda
 * sui telefoni e solo per una battuta che lo show può dire ADESSO in quella partita (stesso copione
 * del telefono dell'host, calcolato dallo stato ufficiale). Restituisce la battuta del copione
 * (con il suo flag live): mai un testo scelto dal telefono.
 */
export async function authorizePlayerLine(db: Db, auth: PlayerAuth, who: string, text: string): Promise<SpokenLine> {
  return authorizeShowLine(db, auth.sessionId, `tts-player:${auth.participantId}`, who, text, { requirePhone: true });
}

/**
 * Stessa regola per chi guarda lo show senza la chiave dello schermo (vista per la LIVE): solo le
 * battute che lo show può dire adesso in quella partita. `requirePhone`: solo con lo show sui
 * dispositivi dei giocatori (l'host può sempre: è la sua partita).
 */
export async function authorizeShowLine(db: Db, sessionId: string, rateKey: string, who: string, text: string, opts: { requirePhone: boolean }): Promise<SpokenLine> {
  if (!(await checkRateLimit(db, rateKey, PLAYER_TTS_RATE.limit, PLAYER_TTS_RATE.windowSeconds))) {
    throw new PlayerError("RATE_LIMITED", "Troppe richieste");
  }
  const state = await buildPublicState(db, sessionId);
  if (!state || (opts.requirePhone && state.displayMode !== "phone")) throw new PlayerError("TV_MODE", "In questa partita le voci si sentono dal TV");
  const line = findScriptLine(sessionLinesFor(state), who, text);
  if (!line) throw new PlayerError("NOT_A_LINE", "Battuta non prevista in questo momento");
  return line;
}
