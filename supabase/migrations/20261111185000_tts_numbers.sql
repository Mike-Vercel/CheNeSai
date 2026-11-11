-- =====================================================================
-- Voci: "numeri salvati". Come i nomi, ogni numero detto nelle battute live
-- (punti, secondi, posizioni, serie…) è una clip in archivio per voce,
-- generata una volta e riusata in tutte le serate.
--   number = numero in archivio (valore normalizzato + punteggiatura che lo segue)
-- Migrazione IDEMPOTENTE: si può rieseguire senza errori.
-- =====================================================================

alter table public.tts_clips drop constraint if exists tts_clips_source_check;
alter table public.tts_clips add constraint tts_clips_source_check
  check (source in ('pregen', 'live', 'sample', 'segment', 'name', 'number', 'spliced'));
