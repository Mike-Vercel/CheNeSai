import "server-only";
import type { Db } from "@/lib/database/db";
import type { PsycoPublicState } from "@/lib/psyco/types";

/**
 * Canale realtime di una stanza PSYCO. Il topic sta sotto 'qz:game:' così vale la policy RLS già
 * esistente (qz_game_channel_receive: i client possono SOLO ricevere, mai trasmettere).
 * Si pubblica SOLO lo stato pubblico (nessuna regola, proposta, voto individuale o ruolo):
 * i dati privati si leggono dall'endpoint autenticato quando `secretRev` cambia.
 */
export const psycoTopic = (roomId: string) => `qz:game:psyco-${roomId}`;

/** Dentro la transazione che ha cambiato lo stato: parte solo se la transazione va a buon fine. */
export async function broadcastPsyco(db: Db, state: PsycoPublicState): Promise<void> {
  await db`select realtime.send(${db.json(JSON.parse(JSON.stringify(state)))}::jsonb, 'state', ${psycoTopic(state.roomId)}, true)`;
}
