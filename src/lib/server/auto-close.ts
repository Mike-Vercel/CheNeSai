import "server-only";
import { randomUUID } from "node:crypto";
import { getSql, type Db } from "@/lib/database/db";
import type { GamePhase } from "@/lib/game-engine/types";
import { executeCommand, type Actor } from "./engine";

/**
 * Chiusura automatica delle partite del gioco libero abbandonate.
 *
 * Una partita libera (host_user_id non nullo: le serate della regia NON si toccano mai) che non è
 * finita e non ha attività da 24 ore viene chiusa col normale comando FINISH (podio, punteggi,
 * stato "finished"), come se l'host avesse premuto «Termina partita».
 * Attività = l'ultimo tra: creazione, ultimo cambio dello stato di gioco, ultimo battito di un
 * telefono in partita, ultimo segnale del TV abbinato.
 *
 * Senza un server sempre acceso, la chiusura avviene:
 *  - "pigra": quando l'host elenca le sue partite o ne apre una, e (al massimo ogni 10 minuti per
 *    partita) quando un TV o un telefono ne legge lo stato;
 *  - ogni giorno con il Cron di Vercel (/api/cron/chiudi-partite, protetto da CRON_SECRET).
 * Idempotente: una partita già finita non viene più selezionata; due chiusure insieme si
 * risolvono nel lucchetto del comando (la seconda trova la fase FINISHED e viene ignorata).
 */
export const STALE_HOURS = 24;

const SYSTEM_ACTOR: Actor = { userId: null, email: "chiusura-automatica@sistema", ip: null };

export interface StaleFilter {
  /** solo le partite di questo host */
  userId?: string;
  /** solo questa partita */
  sessionId?: string;
  /** soglia di inattività (ore), 24 di default */
  olderThanHours?: number;
  /** massimo di partite chiuse per chiamata */
  limit?: number;
}

/** Partite libere non finite e senza attività da `olderThanHours` ore. */
export async function findStaleFreeGames(db: Db, f: StaleFilter = {}): Promise<{ id: string; phase: GamePhase }[]> {
  const hours = f.olderThanHours ?? STALE_HOURS;
  if (f.sessionId && !/^[0-9a-f-]{36}$/i.test(f.sessionId)) return [];
  return db<{ id: string; phase: GamePhase }[]>`
    select s.id, gs.phase
    from game_sessions s
    join game_state gs on gs.session_id = s.id
    left join tv_remote tr on tr.session_id = s.id
    where s.host_user_id is not null
      and s.status not in ('finished', 'archived')
      and gs.phase not in ('FINISHED', 'DRAFT')
      ${f.userId ? db`and s.host_user_id = ${f.userId}` : db``}
      ${f.sessionId ? db`and s.id = ${f.sessionId}` : db``}
      and greatest(
        s.created_at,
        gs.updated_at,
        coalesce(tr.tv_seen_at, s.created_at),
        coalesce((select max(p.last_seen_at) from participants p where p.session_id = s.id), s.created_at)
      ) < now() - make_interval(hours => ${hours})
    order by s.created_at
    limit ${f.limit ?? 50}`;
}

/** Chiude le partite libere abbandonate (vedi sopra). Mai dentro una transazione: ogni FINISH ha la sua. */
export async function closeStaleFreeGames(f: StaleFilter = {}): Promise<{ closed: string[]; failed: string[] }> {
  const sql = getSql();
  const stale = await findStaleFreeGames(sql, f);
  const closed: string[] = [];
  const failed: string[] = [];
  for (const g of stale) {
    try {
      // lobby mai aperta: si apre e si chiude (FINISH non è consentito da READY)
      if (g.phase === "READY") await executeCommand(g.id, SYSTEM_ACTOR, { command: "OPEN_LOBBY", commandId: randomUUID(), args: {} });
      await executeCommand(g.id, SYSTEM_ACTOR, { command: "FINISH", commandId: randomUUID(), args: {} });
      closed.push(g.id);
    } catch (e) {
      console.warn("[quizzone] chiusura automatica non riuscita", g.id, e instanceof Error ? e.message : e);
      failed.push(g.id);
    }
  }
  return { closed, failed };
}

/** Controllo pigro per una partita letta spesso (TV, telefoni): al massimo ogni 10 minuti, in background. */
const LAZY_EVERY_MS = 10 * 60_000;
const lastLazy = new Map<string, number>();
export function lazyCloseIfStale(sessionId: string): void {
  const now = Date.now();
  if (now - (lastLazy.get(sessionId) ?? 0) < LAZY_EVERY_MS) return;
  lastLazy.set(sessionId, now);
  if (lastLazy.size > 2000) lastLazy.clear();
  void closeStaleFreeGames({ sessionId, limit: 1 }).catch(() => undefined);
}
