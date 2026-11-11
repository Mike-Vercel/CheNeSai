import "server-only";
import { getSql, type Db, type Tx } from "@/lib/database/db";
import { optionsLine, type ScriptQuestion } from "@/features/game/script";
import { ensureClip, loadVoiceConfig, planClip } from "./tts";

/**
 * Quanto ci mette il TV a leggere le risposte ("A: …. B: …."), così il tempo per rispondere
 * parte quando il presentatore ha finito e non mentre sta ancora leggendo.
 *
 * - Se la clip ElevenLabs di quella battuta è già in archivio (di solito sì: viene pre-riscaldata
 *   quando appare la domanda) si usa la sua durata vera, ricavata dalla dimensione dell'mp3 a 128 kbps.
 * - Altrimenti una stima dal numero di caratteri (la clip si genera in background, mai qui).
 * Si aggiunge un piccolo margine per il ritardo di avvio della voce sul TV.
 */
const LEAD_MS = 1200;
const MIN_MS = 1500;
const MAX_MS = 15000;
/** mp3_44100_128: 128 kbit/s = 16 byte al millisecondo. */
const MP3_BYTES_PER_MS = 16;

async function optionsLineFor(db: Db, sessionQuestionId: string) {
  const [q] = await db<{ presenter: ScriptQuestion["presenter"]; options: { position: number; text: string }[] | null }[]>`
    select presenter, options from question_snapshots where session_question_id = ${sessionQuestionId}`;
  if (!q?.options?.length) return null;
  return { line: optionsLine({ presenter: q.presenter, options: [...q.options].sort((a, b) => a.position - b.position) }), count: q.options.length };
}

async function clipBytes(db: Db, key: string): Promise<number | null> {
  const [r] = await db<{ size: string | null }[]>`
    select o.metadata->>'size' as size
    from tts_clips c join storage.objects o on o.bucket_id = 'tts' and o.name = c.storage_path
    where c.cache_key = ${key}`;
  const bytes = r?.size ? Number(r.size) : 0;
  return bytes > 0 ? bytes : null;
}

/** Genera (se manca) la clip con la lettura delle risposte. Usata dal pre-riscaldamento (in background). */
export async function ensureOptionsClip(sessionQuestionId: string): Promise<void> {
  const sql = getSql();
  const o = await optionsLineFor(sql, sessionQuestionId);
  if (!o) return;
  const cfg = await loadVoiceConfig(sql);
  const plan = planClip(cfg, o.line);
  if (plan) await ensureClip(sql, plan, "pregen", cfg);
}

/**
 * Durata della lettura delle risposte, calcolata DENTRO la transazione del comando (`db` = tx):
 * MAI generazione di voci né altre connessioni qui. Clip già in archivio (pre-riscaldata quando
 * appare la domanda) → durata vera; altrimenti una stima dal testo, subito.
 * (Prima si generava la clip al volo fino a 6 s tenendo il lucchetto della partita e prendendo
 * altre connessioni dal pool: con più richieste in coda sullo stesso lucchetto il comando poteva
 * restare bloccato.)
 */
export async function optionsReadMs(db: Db, sessionQuestionId: string): Promise<number> {
  // test automatici: risposte aperte subito (QZ_OPTIONS_READ_DELAY=0)
  if (process.env.QZ_OPTIONS_READ_DELAY === "0") return 0;
  const o = await optionsLineFor(db, sessionQuestionId);
  if (!o) return 0;

  let ms: number | null = null;
  try {
    // savepoint: un errore dell'archivio voci non deve mai far fallire il comando
    await (db as Tx).savepoint(async (sp) => {
      const cfg = await loadVoiceConfig(sp);
      const plan = planClip(cfg, o.line);
      const bytes = plan ? await clipBytes(sp, plan.key) : null;
      if (bytes !== null) ms = bytes / MP3_BYTES_PER_MS;
    });
  } catch {
    ms = null; // archivio voci non disponibile: si usa la stima
  }
  // stima (voce del browser o clip non ancora pronta): ~13 caratteri al secondo + una pausa per ogni risposta
  ms ??= (o.line.text.length / 13) * 1000 + o.count * 350;
  return Math.round(Math.min(MAX_MS, Math.max(MIN_MS, ms + LEAD_MS)));
}
