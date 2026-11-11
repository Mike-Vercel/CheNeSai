-- CHE NE SAI?! – regista automatico dei presentatori.
-- Libreria delle battute (dati, mai codice), registro di quello che i presentatori hanno detto
-- (per cooldown e limiti di menzioni) e battute scelte per il momento corrente.

create table public.dialogue_templates (
  id text primary key check (id ~ '^[a-z0-9-]{3,80}$'),
  character text not null check (character in ('professore', 'regina', 'palmino')),
  event_type text not null check (event_type in (
    'LEADER_CHANGED', 'LEADER_TIE', 'LEADER_KEPT', 'OVERTAKE', 'COMEBACK', 'NEW_LAST', 'FASTEST_CORRECT',
    'CORRECT_STREAK', 'WRONG_STREAK', 'ONLY_ONE_CORRECT', 'ALL_WRONG', 'ALL_CORRECT', 'POINTS_MILESTONE', 'ROUND_WINNER')),
  text text not null check (char_length(text) between 3 and 300),
  tone text not null default 'comico' check (char_length(tone) between 2 and 30),
  intensity smallint not null default 2 check (intensity between 1 and 3),
  priority smallint not null default 50 check (priority between 0 and 100),
  weight numeric(4, 2) not null default 1 check (weight > 0 and weight <= 10),
  cooldown_sec integer not null default 120 check (cooldown_sec between 0 and 7200),
  animation text check (animation is null or animation in ('celebrate', 'point', 'surprised', 'wave', 'talk', 'idle')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dialogue_templates_event_idx on public.dialogue_templates (event_type) where enabled;
alter table public.dialogue_templates enable row level security;

create table public.show_dialogue_log (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  session_question_id uuid references public.session_questions (id) on delete cascade,
  round_id uuid references public.game_rounds (id) on delete set null,
  template_id text not null,
  character text not null,
  event_type text not null,
  text text not null,
  participant_ids uuid[] not null default '{}',
  created_at timestamptz not null default clock_timestamp()
);
create index show_dialogue_log_session_idx on public.show_dialogue_log (session_id, created_at desc);
alter table public.show_dialogue_log enable row level security;

-- battute scelte per il momento corrente (lette dal TV insieme allo stato pubblico)
alter table public.game_state add column show_lines jsonb;
