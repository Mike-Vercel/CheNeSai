-- CHE NE SAI?! – manche speciali: "Scommetti tutto" (bet) e "Grande ribaltone" (comeback).
-- Migrazione idempotente: si può rieseguire senza errori.
--
-- * bet: durante la domanda ogni giocatore punta dal telefono 0/25/50/100% dei SUOI punti
--   (con una puntata minima per chi ne ha pochi o zero). Le puntate si chiudono a MOSTRA RISPOSTE.
-- * comeback: chi è nella metà bassa della classifica all'apertura della domanda prende un
--   moltiplicatore sui punti guadagnati (BOOST), il capolista eventualmente una penalità maggiorata.
--   L'elenco viene congelato nelle regole della domanda (session_questions.rules).

alter type public.round_kind add value if not exists 'bet';
alter type public.round_kind add value if not exists 'comeback';

-- ---------------------------------------------------------------------
-- Impostazioni della manche (usate solo dal tipo corrispondente)
-- ---------------------------------------------------------------------
alter table public.game_rounds add column if not exists bet_min_stake integer not null default 500;
alter table public.game_rounds add column if not exists bet_default_tier smallint not null default 0;
alter table public.game_rounds add column if not exists comeback_multiplier numeric(4,2) not null default 2;
alter table public.game_rounds add column if not exists comeback_leader_penalty numeric(4,2) not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'game_rounds_bet_min_stake_check') then
    alter table public.game_rounds add constraint game_rounds_bet_min_stake_check check (bet_min_stake between 0 and 100000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'game_rounds_bet_default_tier_check') then
    alter table public.game_rounds add constraint game_rounds_bet_default_tier_check check (bet_default_tier in (0, 25, 50, 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'game_rounds_comeback_multiplier_check') then
    alter table public.game_rounds add constraint game_rounds_comeback_multiplier_check check (comeback_multiplier between 1 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'game_rounds_comeback_leader_penalty_check') then
    alter table public.game_rounds add constraint game_rounds_comeback_leader_penalty_check check (comeback_leader_penalty between 1 and 10);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Puntate (una per giocatore per domanda)
-- ---------------------------------------------------------------------
create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  session_question_id uuid not null references public.session_questions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  tier smallint not null,
  stake integer not null,                   -- posta effettiva (ricalcolata alla chiusura sui punti del server)
  points_at_bet integer not null,           -- punti del giocatore quando ha puntato
  is_default boolean not null default false, -- nessuna scelta: puntata predefinita assegnata alla chiusura
  client_request_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  locked_at timestamptz,                    -- MOSTRA RISPOSTE: da qui la posta non cambia più
  points_at_lock integer
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bets_tier_check') then
    alter table public.bets add constraint bets_tier_check check (tier in (0, 25, 50, 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bets_stake_check') then
    alter table public.bets add constraint bets_stake_check check (stake between 0 and 100000000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bets_question_participant_key') then
    alter table public.bets add constraint bets_question_participant_key unique (session_question_id, participant_id);
  end if;
end $$;

create index if not exists bets_question_idx on public.bets (session_question_id);
create index if not exists bets_session_idx on public.bets (session_id);

-- Stesso modello di sicurezza delle altre tabelle: RLS attiva, nessun accesso dai client.
alter table public.bets enable row level security;
revoke all on table public.bets from anon, authenticated;
