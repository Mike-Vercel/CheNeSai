-- CHE NE SAI?! – modalità SQUADRE.
-- Le squadre appartengono a una serata; ogni giocatore conserva identità e punti personali
-- e può far parte di una squadra (participants.team_id). La classifica a squadre si calcola
-- dai punti ufficiali (score_totals): rank/previous_rank servono per le frecce di movimento.
-- Migrazione IDEMPOTENTE: si può rieseguire senza errori.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 24),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  position smallint not null default 0 check (position between 0 and 99),
  rank integer,
  previous_rank integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists teams_session_name_unique on public.teams (session_id, lower(name));
create index if not exists teams_session_idx on public.teams (session_id, position);
alter table public.teams enable row level security;
revoke all on table public.teams from anon, authenticated;

alter table public.participants add column if not exists team_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'public.participants'::regclass and conname = 'participants_team_id_fkey'
  ) then
    alter table public.participants
      add constraint participants_team_id_fkey foreign key (team_id) references public.teams (id) on delete set null;
  end if;
end $$;
create index if not exists participants_team_idx on public.participants (team_id) where team_id is not null;

-- Nuovi eventi del regista (solo in modalità squadre). Il vincolo viene ricreato unendo i valori
-- già ammessi (anche quelli aggiunti da altre migrazioni) a quelli nuovi.
do $$
declare
  v_def text;
  v_vals text[];
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conrelid = 'public.dialogue_templates'::regclass and conname = 'dialogue_templates_event_type_check';
  select array_agg(distinct v order by v) into v_vals
  from (
    -- valori già ammessi, sia nella forma ARRAY['A'::text, …] sia '{A,B}'::text[]
    select m[1] as v from regexp_matches(coalesce(v_def, ''), '([A-Z][A-Z_]{2,})', 'g') as m
    where m[1] not in ('CHECK', 'ANY', 'ARRAY')
    union
    select unnest(array[
      'LEADER_CHANGED', 'LEADER_TIE', 'LEADER_KEPT', 'OVERTAKE', 'COMEBACK', 'NEW_LAST', 'FASTEST_CORRECT',
      'CORRECT_STREAK', 'WRONG_STREAK', 'ONLY_ONE_CORRECT', 'ALL_WRONG', 'ALL_CORRECT', 'POINTS_MILESTONE', 'ROUND_WINNER',
      'TEAM_LEADER_CHANGED', 'TEAM_ROUND_WINNER'])
    union
    select distinct event_type from public.dialogue_templates
  ) s;
  alter table public.dialogue_templates drop constraint if exists dialogue_templates_event_type_check;
  execute format(
    'alter table public.dialogue_templates add constraint dialogue_templates_event_type_check check (event_type = any (%L::text[]))',
    v_vals);
end $$;
