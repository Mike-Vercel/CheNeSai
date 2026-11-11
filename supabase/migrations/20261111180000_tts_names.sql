-- =====================================================================
-- Voci: "nomi salvati". Le battute live con i nickname si compongono da
-- parti fisse (uguali in ogni serata) e nomi in archivio (generati una volta
-- per voce e riusati in tutte le serate), uniti in un unico mp3.
-- Nuove origini in tts_clips:
--   segment = parte fissa di una battuta
--   name    = nome (o gruppo di nomi) in archivio
--   spliced = frase intera composta dalle parti (billed_chars 0: si pagano le parti)
-- saved_chars: caratteri risparmiati rispetto alla frase intera (stima per il pannello Voci).
-- Migrazione IDEMPOTENTE: si può rieseguire senza errori.
-- =====================================================================

alter table public.tts_clips drop constraint if exists tts_clips_source_check;
alter table public.tts_clips add constraint tts_clips_source_check
  check (source in ('pregen', 'live', 'sample', 'segment', 'name', 'spliced'));

alter table public.tts_clips add column if not exists saved_chars integer not null default 0;
alter table public.tts_clips drop constraint if exists tts_clips_saved_chars_check;
alter table public.tts_clips add constraint tts_clips_saved_chars_check check (saved_chars >= 0);

create index if not exists tts_clips_source_idx on public.tts_clips (source);
