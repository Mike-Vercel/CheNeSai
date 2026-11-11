-- ---------------------------------------------------------------------
-- CHE NE SAI?! – "Salta intro" a votazione.
--
-- Durante l'intro ogni giocatore può chiedere dal telefono di saltarla (e ritirare il voto).
-- Se TUTTI i giocatori attivi (bot esclusi) votano, il server fa partire subito il primo round;
-- basta un solo giocatore che non vota e l'intro si guarda fino in fondo.
-- intro_skip_votes: un voto per giocatore e serata. game_state.intro_skipped_at: quando l'intro
-- è stata saltata (il TV lo dice nella presentazione del primo round).
-- Nessun accesso diretto dai client: tutto passa dal server. Idempotente.
-- ---------------------------------------------------------------------
create table if not exists public.intro_skip_votes (
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  primary key (session_id, participant_id)
);
alter table public.intro_skip_votes enable row level security;
revoke all on table public.intro_skip_votes from anon, authenticated;
comment on table public.intro_skip_votes is 'Giocatori che vogliono saltare l''intro (si salta solo se votano tutti)';

alter table public.game_state add column if not exists intro_skipped_at timestamptz;
comment on column public.game_state.intro_skipped_at is 'Intro saltata per voto unanime dei giocatori';

-- ---------------------------------------------------------------------
-- Dove si guarda lo show (gioco libero): "tv" = televisore (i telefoni dicono "Guarda il TV"),
-- "phone" = show sul telefono dell'host: ogni giocatore vede (e sente) lo show sul suo telefono.
-- ---------------------------------------------------------------------
alter table public.game_sessions add column if not exists display_mode text not null default 'tv';
do $$ begin
  alter table public.game_sessions add constraint game_sessions_display_mode_check check (display_mode in ('tv', 'phone'));
exception when duplicate_object then null; end $$;
comment on column public.game_sessions.display_mode is 'Dove si guarda lo show: tv (televisore) o phone (ogni giocatore sul suo telefono)';
