-- CHE NE SAI?! – "Ruota impazzita": round in cui la categoria la sceglie una ruota.
-- Idempotente: si può rieseguire senza errori.
--
-- Note:
-- - i nuovi valori degli enum NON vengono usati in questo file (Postgres non permette di usare
--   un valore aggiunto nella stessa transazione); gli eventi speciali ammessi per "category_vote"
--   valgono anche per la ruota (mappatura nel codice: eventRoundKind).
-- - la ruota riusa le categorie e l'assegnazione delle domande dei round con votazione
--   (category_vote_options, session_questions.vote_option_id, game_rounds.winning_option_id).

alter type public.round_kind add value if not exists 'category_wheel';
alter type public.game_phase add value if not exists 'WHEEL_SPIN';

-- Fino a 8 categorie per round (la votazione resta limitata a 4 dalla validazione del CMS).
alter table public.category_vote_options drop constraint if exists category_vote_options_position_check;
alter table public.category_vote_options add constraint category_vote_options_position_check check (position between 0 and 7);

-- Giro della ruota deciso dal server: inizio dell'animazione (ora del server, uguale per tutti i TV)
-- e piano deterministico (spicchio vincente, giri, punto di arrivo, durata).
alter table public.game_rounds add column if not exists wheel_spun_at timestamptz;
alter table public.game_rounds add column if not exists wheel_spin jsonb;
