import "server-only";
import type { Db } from "@/lib/database/db";
import type { TigPublicState } from "@/lib/tig/types";

/**
 * Canale realtime di una serata. Il topic sta sotto 'qz:game:' così vale la policy RLS già esistente
 * (qz_game_channel_receive: i client possono SOLO ricevere). Si pubblica SOLO lo stato pubblico (niente
 * soluzioni prima del reveal, niente QR/codici): i dati privati si rileggono dall'endpoint autenticato.
 * Ogni serata ha il suo topic: serate contemporanee restano isolate.
 */
export const tigTopic = (eventId: string) => `qz:game:tig-${eventId}`;

/** Dentro la transazione che ha cambiato lo stato: parte solo se la transazione va a buon fine. */
export async function broadcastTig(db: Db, state: TigPublicState): Promise<void> {
  await db`select realtime.send(${db.json(JSON.parse(JSON.stringify(state)))}::jsonb, 'state', ${tigTopic(state.eventId)}, true)`;
}
