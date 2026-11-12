import "server-only";
import type { Db } from "@/lib/database/db";
import type { PublicState } from "@/lib/giramente/types";

/**
 * Canale realtime di una partita GIRAMENTE!. Il topic sta sotto 'qz:game:' così vale la policy RLS già
 * esistente (qz_game_channel_receive: i client possono SOLO ricevere, mai trasmettere).
 * Si pubblica SOLO lo stato pubblico (nessuna soluzione prima del risultato, nessuna prova privata):
 * i dati privati si rileggono dall'endpoint autenticato quando `secretRev` cambia.
 * Gli eventi realtime non sostituiscono la persistenza: lo stato vive nel database.
 */
export const giramenteTopic = (roomId: string) => `qz:game:giramente-${roomId}`;

/** Dentro la transazione che ha cambiato lo stato: parte solo se la transazione va a buon fine. */
export async function broadcastGiramente(db: Db, state: PublicState): Promise<void> {
  await db`select realtime.send(${db.json(JSON.parse(JSON.stringify(state)))}::jsonb, 'state', ${giramenteTopic(state.roomId)}, true)`;
}
