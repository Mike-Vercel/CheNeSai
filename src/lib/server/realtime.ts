import type { Db } from "@/lib/database/db";
import type { PublicState } from "@/lib/game-engine/types";

export const gameTopic = (sessionId: string) => `qz:game:${sessionId}`;

/**
 * Pubblica lo stato pubblico sul canale PRIVATO di gioco. Viene eseguito
 * DENTRO la transazione che ha cambiato lo stato: il messaggio parte solo se
 * la transazione va a buon fine. I client possono solo ricevere (RLS).
 */
export async function broadcastState(db: Db, state: PublicState): Promise<void> {
  await db`select realtime.send(${db.json(JSON.parse(JSON.stringify(state)))}::jsonb, 'state', ${gameTopic(state.sessionId)}, true)`;
}

export type MediaControl =
  | { action: "play"; mediaId: string; startMs: number; durationMs: number | null; plays: number; at: number }
  | { action: "stop"; at: number }
  | { action: "test-tone"; at: number };

/** Comandi di riproduzione dalla regia al TV (audio della manche musicale). */
export async function broadcastMediaControl(db: Db, sessionId: string, control: MediaControl): Promise<void> {
  await db`select realtime.send(${db.json(control)}::jsonb, 'media', ${gameTopic(sessionId)}, true)`;
}
