import "server-only";
import { getSql } from "@/lib/database/db";
import { optionsLine, type ScriptQuestion } from "@/features/game/script";
import { ensureClip, loadVoiceConfig, planClip, ttsConfigured } from "./tts";

/**
 * Quanto ci mette il TV a leggere le risposte ("A: …. B: …."), così il tempo per rispondere
 * parte quando il presentatore ha finito e non mentre sta ancora leggendo.
 *
 * - Se la clip ElevenLabs di quella battuta è già in archivio (di solito sì: viene pre-riscaldata
 *   quando appare la domanda) si usa la sua durata vera, ricavata dalla dimensione dell'mp3 a 128 kbps.
 * - Altrimenti una stima dal numero di caratteri.
 * Si aggiunge un piccolo margine per il ritardo di avvio della voce sul TV.
 */
const LEAD_MS = 1200;
const MIN_MS = 1500;
const MAX_MS = 15000;
/** Attesa massima per generare la clip al momento (se il pre-riscaldamento non l'ha già fatta). */
const GENERATE_WAIT_MS = 6000;
/** mp3_44100_128: 128 kbit/s = 16 byte al millisecondo. */
const MP3_BYTES_PER_MS = 16;

async function optionsLineFor(sessionQuestionId: string) {
  const sql = getSql();
  const [q] = await sql<{ presenter: ScriptQuestion["presenter"]; options: { position: number; text: string }[] | null }[]>`
    select presenter, options from question_snapshots where session_question_id = ${sessionQuestionId}`;
  if (!q?.options?.length) return null;
  return { line: optionsLine({ presenter: q.presenter, options: [...q.options].sort((a, b) => a.position - b.position) }), count: q.options.length };
}

async function clipBytes(key: string): Promise<number | null> {
  const [r] = await getSql()<{ size: string | null }[]>`
    select o.metadata->>'size' as size
    from tts_clips c join storage.objects o on o.bucket_id = 'tts' and o.name = c.storage_path
    where c.cache_key = ${key}`;
  const bytes = r?.size ? Number(r.size) : 0;
  return bytes > 0 ? bytes : null;
}

/** Genera (se manca) la clip con la lettura delle risposte. Usata dal pre-riscaldamento. */
export async function ensureOptionsClip(sessionQuestionId: string): Promise<void> {
  const o = await optionsLineFor(sessionQuestionId);
  if (!o) return;
  const sql = getSql();
  const cfg = await loadVoiceConfig(sql);
  const plan = planClip(cfg, o.line);
  if (plan) await ensureClip(sql, plan, "pregen", cfg);
}

export async function optionsReadMs(sessionQuestionId: string): Promise<number> {
  // test automatici: risposte aperte subito (QZ_OPTIONS_READ_DELAY=0)
  if (process.env.QZ_OPTIONS_READ_DELAY === "0") return 0;
  const o = await optionsLineFor(sessionQuestionId);
  if (!o) return 0;

  let ms: number | null = null;
  try {
    const sql = getSql();
    const cfg = await loadVoiceConfig(sql);
    const plan = planClip(cfg, o.line);
    if (plan) {
      let bytes = await clipBytes(plan.key);
      if (bytes === null && ttsConfigured()) {
        // non ancora pronta: la si genera ora (pochi secondi), così la durata è quella vera
        await Promise.race([ensureClip(sql, plan, "pregen", cfg), new Promise((r) => setTimeout(r, GENERATE_WAIT_MS))]).catch(() => undefined);
        bytes = await clipBytes(plan.key);
      }
      if (bytes !== null) ms = bytes / MP3_BYTES_PER_MS;
    }
  } catch {
    ms = null; // archivio voci non disponibile: si usa la stima
  }
  // stima (voce del browser o clip non disponibile): ~13 caratteri al secondo + una pausa per ogni risposta
  ms ??= (o.line.text.length / 13) * 1000 + o.count * 350;
  return Math.round(Math.min(MAX_MS, Math.max(MIN_MS, ms + LEAD_MS)));
}
