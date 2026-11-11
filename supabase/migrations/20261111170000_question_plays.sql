-- ---------------------------------------------------------------------
-- Registro delle domande giocate.
--
-- Una domanda conta come "giocata" quando viene davvero mostrata (shown_at)
-- in una serata reale (non di prova). Il registro è separato dalle serate:
-- resta anche se una serata viene azzerata o eliminata, così le domande già
-- viste dal pubblico non tornano mai per sbaglio.
-- Idempotente: si può rilanciare senza effetti.
-- ---------------------------------------------------------------------
create table if not exists public.question_plays (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank (id) on delete cascade,
  session_id uuid references public.game_sessions (id) on delete set null,
  session_question_id uuid not null unique,
  played_at timestamptz not null default now()
);
create index if not exists question_plays_question_idx on public.question_plays (question_id, played_at desc);

alter table public.question_plays enable row level security;
revoke all on table public.question_plays from anon, authenticated;

-- Ricerca veloce delle domande già inserite in altre serate (prenotate).
create index if not exists session_questions_question_idx on public.session_questions (question_id) where question_id is not null;

create or replace function public.qz_record_question_play()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.shown_at is not null and old.shown_at is null and new.question_id is not null then
    insert into public.question_plays (question_id, session_id, session_question_id, played_at)
    select new.question_id, new.session_id, new.id, new.shown_at
    from public.game_sessions s
    where s.id = new.session_id and not s.is_test
    on conflict (session_question_id) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.qz_record_question_play() from public, anon, authenticated;

drop trigger if exists trg_session_questions_played on public.session_questions;
create trigger trg_session_questions_played
  after update of shown_at on public.session_questions
  for each row execute function public.qz_record_question_play();

-- Recupero dello storico già presente.
insert into public.question_plays (question_id, session_id, session_question_id, played_at)
select sq.question_id, sq.session_id, sq.id, sq.shown_at
from public.session_questions sq
join public.game_sessions s on s.id = sq.session_id
where sq.shown_at is not null and sq.question_id is not null and not s.is_test
on conflict (session_question_id) do nothing;
