-- ---------------------------------------------------------------------
-- CHE NE SAI?! – Gioco libero (partite create dal pubblico).
--
-- * host_profiles: profilo degli account "host" (Supabase Auth, NON admin):
--   username univoco (senza distinzione maiuscole/minuscole), nome da mostrare,
--   numero di partite create (per la quota configurabile dal super admin).
-- * game_sessions.host_user_id: proprietario della partita libera
--   (null = serata della regia, come sempre).
-- * question_plays.host_user_id: storico delle domande uscite per account,
--   così la prossima partita dello stesso host evita le domande già viste
--   (resta anche se la partita viene eliminata).
--
-- Nessun accesso pubblico: RLS attiva e nessuna policy per anon/authenticated,
-- tutto passa dal server (postgres.js).
-- Idempotente: si può rilanciare senza effetti.
-- ---------------------------------------------------------------------

create table if not exists public.host_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_.]{3,20}$'),
  display_name text check (display_name is null or char_length(display_name) between 1 and 60),
  games_created integer not null default 0 check (games_created >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists host_profiles_username_key on public.host_profiles (lower(username));

alter table public.host_profiles enable row level security;
revoke all on table public.host_profiles from anon, authenticated;

comment on table public.host_profiles is 'Gioco libero: account host (username univoco, partite create)';

-- Proprietario della partita libera
alter table public.game_sessions add column if not exists host_user_id uuid references auth.users (id) on delete set null;
create index if not exists game_sessions_host_idx on public.game_sessions (host_user_id, created_at desc) where host_user_id is not null;
comment on column public.game_sessions.host_user_id is 'Gioco libero: account che ha creato la partita (null = serata della regia)';

-- Storico per account delle domande uscite
alter table public.question_plays add column if not exists host_user_id uuid references auth.users (id) on delete set null;
create index if not exists question_plays_host_idx on public.question_plays (host_user_id, question_id) where host_user_id is not null;

create or replace function public.qz_record_question_play()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.shown_at is not null and old.shown_at is null and new.question_id is not null then
    insert into public.question_plays (question_id, session_id, session_question_id, played_at, host_user_id)
    select new.question_id, new.session_id, new.id, new.shown_at, s.host_user_id
    from public.game_sessions s
    where s.id = new.session_id and not s.is_test
    on conflict (session_question_id) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.qz_record_question_play() from public, anon, authenticated;

-- Recupero: partite libere già giocate (se ce ne sono)
update public.question_plays p set host_user_id = s.host_user_id
from public.game_sessions s
where s.id = p.session_id and s.host_user_id is not null and p.host_user_id is null;
