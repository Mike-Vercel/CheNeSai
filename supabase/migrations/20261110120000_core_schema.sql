-- =====================================================================
-- CHE NE SAI?! – schema principale
-- Migrazione 001: schema principale
--
-- Modello di sicurezza:
--  * Tutte le tabelle hanno RLS attiva e NESSUNA policy per anon (e solo la
--    lettura del proprio profilo per gli admin autenticati): i client non
--    leggono né scrivono mai direttamente il database.
--  * L'unico accesso ai dati passa dal backend Next.js (connessione Postgres
--    server-side), che applica autorizzazione e validazione.
--  * Realtime: i messaggi vengono emessi con realtime.send() dentro le stesse
--    transazioni che cambiano lo stato e contengono solo dati pubblici.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- Nessun privilegio di default per i ruoli esposti all'API pubblica.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ---------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------
create type public.session_status as enum ('draft', 'ready', 'live', 'finished', 'archived');

create type public.game_phase as enum (
  'DRAFT', 'READY', 'LOBBY', 'INTRO', 'ROUND_INTRO',
  'QUESTION_VISIBLE', 'OPTIONS_VISIBLE', 'ANSWERS_LOCKED', 'ANSWER_REVEAL',
  'SCORE_REVEAL', 'LEADERBOARD', 'CATEGORY_VOTING', 'CATEGORY_RESULT',
  'SPECIAL_EVENT', 'PAUSED', 'FINISHED'
);

create type public.question_type as enum ('single', 'multiple');
create type public.media_kind as enum ('image', 'audio', 'video');
create type public.presenter as enum ('professore', 'regina', 'palmino');
create type public.round_kind as enum ('standard', 'music', 'image', 'video', 'category_vote', 'bonus', 'final');
create type public.question_status as enum ('draft', 'approved', 'archived');
create type public.special_event_type as enum (
  'double_points', 'no_penalty', 'lightning', 'super_bonus',
  'mystery_question', 'impossible_comeback', 'palmino_decides', 'finalissima'
);
create type public.participant_status as enum ('active', 'kicked');
create type public.score_event_kind as enum ('answer', 'no_answer', 'speed_bonus', 'manual', 'event_bonus');

-- ---------------------------------------------------------------------
-- Amministrazione
-- ---------------------------------------------------------------------
create table public.admin_roles (
  role text primary key,
  rank smallint not null unique,
  label text not null,
  description text not null
);

insert into public.admin_roles (role, rank, label, description) values
  ('operator', 10, 'Operatore', 'Regia live delle sessioni assegnate, nessuna modifica sensibile'),
  ('admin', 20, 'Admin', 'Sessioni, domande, round, media, giocatori e regia live'),
  ('super_admin', 30, 'Super Admin', 'Accesso completo, impostazioni globali e gestione amministratori');

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null references public.admin_roles (role),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.application_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.application_settings (key, value, description) values
  ('scoring', '{"correctPoints":1000,"wrongPenalty":400,"noAnswerPenalty":0,"allowNegative":true}', 'Punteggi globali predefiniti'),
  ('timing', '{"defaultDurationSeconds":20,"answerGraceMs":300,"defaultVoteSeconds":15}', 'Tempi predefiniti'),
  ('players', '{"nicknameMaxLength":16,"nicknameMinLength":2}', 'Regole nickname'),
  ('leaderboard', '{"monthlyAggregation":"sum_points","placementPoints":[25,18,15,12,10,8,6,4,2,1]}', 'Aggregazione classifiche mensili/stagionali'),
  ('events', '{"autoEventsEnabled":true}', 'Motore eventi speciali');

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  starts_on date not null,
  ends_on date not null,
  aggregation text not null default 'sum_points' check (aggregation in ('sum_points', 'placement_points')),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

-- ---------------------------------------------------------------------
-- Media
-- ---------------------------------------------------------------------
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  kind public.media_kind not null,
  storage_path text not null unique,        -- percorso opaco (uuid), mai il titolo
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  label text not null,                      -- nome interno, mai mostrato ai giocatori
  artist text,
  category text,
  license_info text,                        -- autorizzazione / licenza del contenuto
  license_confirmed boolean not null default false,
  width integer,
  height integer,
  duration_ms integer,
  archived boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index media_assets_kind_idx on public.media_assets (kind) where not archived;

-- ---------------------------------------------------------------------
-- Archivio domande (template modificabili)
-- ---------------------------------------------------------------------
create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  type public.question_type not null default 'single',
  text text not null check (char_length(text) between 3 and 400),
  category text not null check (char_length(category) between 2 and 60),
  difficulty smallint not null default 2 check (difficulty between 1 and 5),
  tags text[] not null default '{}',
  presenter public.presenter not null default 'professore',
  correct_points integer check (correct_points between 0 and 100000),
  wrong_penalty integer check (wrong_penalty between 0 and 100000),
  no_answer_penalty integer check (no_answer_penalty between 0 and 100000),
  duration_seconds smallint check (duration_seconds between 3 and 120),
  partial_scoring boolean not null default false,
  media_id uuid references public.media_assets (id) on delete set null,
  audio_start_ms integer not null default 0 check (audio_start_ms >= 0),
  audio_duration_ms integer check (audio_duration_ms is null or audio_duration_ms between 1000 and 600000),
  audio_plays smallint not null default 1 check (audio_plays between 1 and 3),
  animation text,
  notes text,
  status public.question_status not null default 'draft',
  answer_confirmed boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'import', 'duplicate')),
  version integer not null default 1,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index question_bank_category_idx on public.question_bank (category) where status <> 'archived';
create index question_bank_status_idx on public.question_bank (status);
create index question_bank_tags_idx on public.question_bank using gin (tags);
create index question_bank_text_search_idx on public.question_bank using gin (to_tsvector('italian', text));

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank (id) on delete cascade,
  position smallint not null check (position between 0 and 3),
  text text not null check (char_length(text) between 1 and 120),
  is_correct boolean not null default false,
  unique (question_id, position)
);

-- ---------------------------------------------------------------------
-- Libreria eventi speciali di Palmino (definizioni)
-- ---------------------------------------------------------------------
create table public.special_event_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  type public.special_event_type not null,
  title text not null,
  tagline text not null,
  description text not null,
  params jsonb not null default '{}',
  animation text not null default 'palmino-burst',
  sound text not null default 'palmino',
  max_per_session smallint not null default 2 check (max_per_session between 0 and 50),
  allowed_round_kinds public.round_kind[] not null default '{standard,music,image,video,category_vote,bonus,final}',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.special_event_definitions (key, type, title, tagline, description, params, max_per_session, allowed_round_kinds) values
  ('double-points', 'double_points', 'PUNTI DOPPI', 'Questa domanda vale il doppio!', 'I punti per la risposta corretta vengono raddoppiati.', '{"correctMultiplier":2}', 3, '{standard,music,image,video,category_vote,bonus}'),
  ('no-penalty', 'no_penalty', 'NESSUNA PENALITÀ', 'Se sbagli non perdi punti!', 'Risposte errate e mancate non tolgono punti.', '{}', 1, '{standard,music,image,video,category_vote,bonus}'),
  ('lightning', 'lightning', 'SFIDA LAMPO', 'Hai pochissimi secondi!', 'Il tempo per rispondere è drasticamente ridotto.', '{"durationSeconds":6,"correctMultiplier":1.5}', 2, '{standard,image,category_vote,bonus}'),
  ('super-bonus', 'super_bonus', 'SUPER BONUS', 'Punti extra in palio!', 'Chi risponde correttamente riceve un bonus aggiuntivo.', '{"bonusPoints":500}', 2, '{standard,music,image,video,category_vote,bonus}'),
  ('mystery-question', 'mystery_question', 'DOMANDA MISTERIOSA', 'Una domanda fuori programma!', 'Viene giocata una domanda di riserva già preparata e approvata.', '{"correctMultiplier":1.5}', 1, '{standard,music,image,video,category_vote,bonus}'),
  ('impossible-comeback', 'impossible_comeback', 'RECUPERO IMPOSSIBILE', 'Chi è indietro può rimontare!', 'Domanda dal valore altissimo, uguale per tutti: ultima occasione per recuperare.', '{"correctMultiplier":3,"wrongMultiplier":1}', 1, '{standard,bonus,final}'),
  ('palmino-decides', 'palmino_decides', 'PALMINO DECIDE', 'Palmino sceglie la sorpresa!', 'Palmino estrae un evento fra quelli approvati dall''admin per la serata.', '{}', 2, '{standard,music,image,video,category_vote,bonus}'),
  ('finalissima', 'finalissima', 'FINALISSIMA', 'La domanda che decide tutto!', 'Domanda finale ad altissimo valore.', '{"correctMultiplier":5,"wrongMultiplier":2}', 1, '{final,bonus,standard}');

-- ---------------------------------------------------------------------
-- Sessioni (serate) e struttura
-- ---------------------------------------------------------------------
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text,
  scheduled_at timestamptz,
  status public.session_status not null default 'draft',
  code text not null unique check (code ~ '^[A-Z0-9]{4,8}$'),
  display_key text not null default encode(extensions.gen_random_bytes(18), 'hex'),
  is_test boolean not null default false,
  season_id uuid references public.seasons (id) on delete set null,
  settings jsonb not null default '{}',
  source_session_id uuid references public.game_sessions (id) on delete set null,
  published_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  archived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index game_sessions_status_idx on public.game_sessions (status, scheduled_at);

create table public.session_operators (
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  user_id uuid not null references public.admin_users (user_id) on delete cascade,
  primary key (session_id, user_id)
);

create table public.game_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  position smallint not null,
  title text not null check (char_length(title) between 2 and 80),
  kind public.round_kind not null default 'standard',
  presenter public.presenter not null default 'professore',
  description text,
  points_multiplier numeric(5,2) not null default 1 check (points_multiplier between 0 and 20),
  penalty_multiplier numeric(5,2) not null default 1 check (penalty_multiplier between 0 and 20),
  no_penalty boolean not null default false,
  correct_points integer check (correct_points between 0 and 100000),
  wrong_penalty integer check (wrong_penalty between 0 and 100000),
  duration_seconds smallint check (duration_seconds between 3 and 120),
  speed_bonus_max integer not null default 0 check (speed_bonus_max between 0 and 5000),
  -- votazione categoria
  vote_duration_seconds smallint not null default 15 check (vote_duration_seconds between 5 and 120),
  vote_tie_break text not null default 'random' check (vote_tie_break in ('random', 'admin', 'first')),
  vote_live_results boolean not null default true,
  vote_opened_at timestamptz,
  vote_closes_at timestamptz,
  vote_closed_at timestamptz,
  winning_option_id uuid,
  vote_result jsonb,
  started_at timestamptz,
  unique (session_id, position) deferrable initially deferred
);
create index game_rounds_session_idx on public.game_rounds (session_id, position);

create table public.category_vote_options (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game_rounds (id) on delete cascade,
  position smallint not null check (position between 0 and 3),
  label text not null check (char_length(label) between 2 and 40),
  unique (round_id, position)
);
alter table public.game_rounds
  add constraint game_rounds_winning_option_fk foreign key (winning_option_id) references public.category_vote_options (id) on delete set null;

create table public.session_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  round_id uuid not null references public.game_rounds (id) on delete cascade,
  position smallint not null,
  question_id uuid references public.question_bank (id) on delete set null,
  vote_option_id uuid references public.category_vote_options (id) on delete cascade,
  is_reserve boolean not null default false,
  shown_at timestamptz,
  options_opened_at timestamptz,
  answers_close_at timestamptz,
  answers_closed_at timestamptz,
  revealed_at timestamptz,
  scored_at timestamptz,
  play_order integer,
  rules jsonb,                               -- regole effettive congelate all'apertura delle risposte
  unique (round_id, position) deferrable initially deferred
);
create index session_questions_session_idx on public.session_questions (session_id, round_id, position);

-- Copia congelata al momento della pubblicazione: le partite passate restano
-- ricostruibili anche se il template nell'archivio viene modificato.
create table public.question_snapshots (
  session_question_id uuid primary key references public.session_questions (id) on delete cascade,
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  source_question_id uuid,
  source_question_version integer,
  type public.question_type not null,
  text text not null,
  category text not null,
  difficulty smallint not null,
  presenter public.presenter not null,
  options jsonb not null,                    -- [{"position":0,"text":"..."}] (senza soluzione)
  correct_positions smallint[] not null check (cardinality(correct_positions) between 1 and 4),
  correct_points integer not null,
  wrong_penalty integer not null,
  no_answer_penalty integer not null,
  duration_seconds smallint not null,
  partial_scoring boolean not null,
  media_id uuid references public.media_assets (id) on delete set null,
  media_kind public.media_kind,
  audio_start_ms integer not null default 0,
  audio_duration_ms integer,
  audio_plays smallint not null default 1,
  animation text,
  created_at timestamptz not null default now()
);
create index question_snapshots_session_idx on public.question_snapshots (session_id);

-- ---------------------------------------------------------------------
-- Giocatori
-- ---------------------------------------------------------------------
-- Identità persistente opzionale (stesso dispositivo o codice di recupero):
-- permette le classifiche mensili/stagionali senza basarsi sul nickname.
create table public.player_identities (
  id uuid primary key default gen_random_uuid(),
  device_token_hash text not null unique,
  recovery_code_hash text unique,
  last_nickname text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Partecipazione a una sessione (participant_sessions).
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  identity_id uuid references public.player_identities (id) on delete set null,
  nickname text not null,
  nickname_key text not null,
  token_hash text not null unique,
  status public.participant_status not null default 'active',
  is_bot boolean not null default false,
  joined_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default now(),
  kicked_at timestamptz,
  kick_reason text,
  unique (session_id, nickname_key)
);
create unique index participants_identity_unique on public.participants (session_id, identity_id) where identity_id is not null;
create index participants_session_idx on public.participants (session_id, status);

create table public.answer_submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  session_question_id uuid not null references public.session_questions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  selected_positions smallint[] not null check (cardinality(selected_positions) between 1 and 4),
  client_request_id uuid not null,
  submitted_at timestamptz not null default clock_timestamp(),
  response_ms integer not null check (response_ms >= 0),
  is_correct boolean,
  correct_hits smallint,
  wrong_hits smallint,
  unique (session_question_id, participant_id)
);
create index answer_submissions_question_idx on public.answer_submissions (session_question_id);
create index answer_submissions_participant_idx on public.answer_submissions (participant_id);

-- Opzioni selezionate in forma normalizzata (per analisi e distribuzione risposte)
create table public.answer_selected_options (
  submission_id uuid not null references public.answer_submissions (id) on delete cascade,
  session_question_id uuid not null references public.session_questions (id) on delete cascade,
  position smallint not null check (position between 0 and 3),
  primary key (submission_id, position)
);
create index answer_selected_options_q_idx on public.answer_selected_options (session_question_id, position);

create table public.score_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  session_question_id uuid references public.session_questions (id) on delete cascade,
  kind public.score_event_kind not null,
  points_before integer not null,
  delta integer not null,
  points_after integer not null,
  reason text not null,
  details jsonb not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  check (points_after = points_before + delta)
);
create unique index score_events_question_unique on public.score_events (session_question_id, participant_id, kind)
  where session_question_id is not null;
create index score_events_participant_idx on public.score_events (participant_id, id);
create index score_events_session_idx on public.score_events (session_id);

create table public.score_totals (
  participant_id uuid primary key references public.participants (id) on delete cascade,
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  points integer not null default 0,
  correct_count integer not null default 0,
  answered_count integer not null default 0,
  correct_response_ms bigint not null default 0,
  last_delta integer not null default 0,
  rank integer,
  previous_rank integer,
  updated_at timestamptz not null default now()
);
create index score_totals_session_rank_idx on public.score_totals (session_id, points desc);

-- ---------------------------------------------------------------------
-- Stato partita (fonte di verità) e log eventi
-- ---------------------------------------------------------------------
create table public.game_state (
  session_id uuid primary key references public.game_sessions (id) on delete cascade,
  phase public.game_phase not null default 'DRAFT',
  version bigint not null default 1,
  current_round_id uuid references public.game_rounds (id) on delete set null,
  current_session_question_id uuid references public.session_questions (id) on delete set null,
  forced_next_sq_id uuid references public.session_questions (id) on delete set null,
  questions_played integer not null default 0,
  phase_started_at timestamptz not null default clock_timestamp(),
  intro_started_at timestamptz,
  paused_from_phase public.game_phase,
  paused_remaining_ms integer,
  paused_at timestamptz,
  active_event_id uuid,
  last_command_id uuid,
  updated_at timestamptz not null default clock_timestamp()
);

create table public.game_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  version bigint not null,
  command text not null,
  from_phase public.game_phase,
  to_phase public.game_phase,
  payload jsonb not null default '{}',
  command_id uuid not null,
  actor uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  unique (session_id, command_id)
);
create index game_events_session_idx on public.game_events (session_id, id);

-- Eventi speciali attivati in una sessione (programmati o manuali)
create table public.special_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  definition_id uuid not null references public.special_event_definitions (id),
  type public.special_event_type not null,
  title text not null,
  tagline text not null,
  params jsonb not null default '{}',
  target_session_question_id uuid references public.session_questions (id) on delete cascade,
  status text not null default 'scheduled' check (status in ('scheduled', 'announced', 'applied', 'cancelled')),
  source text not null default 'manual' check (source in ('manual', 'scheduled', 'palmino_decides')),
  decided_from jsonb,                       -- PALMINO DECIDE: pool e scelta verificabili
  announced_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index special_events_session_idx on public.special_events (session_id, status);
create index special_events_target_idx on public.special_events (target_session_question_id);
alter table public.game_state
  add constraint game_state_active_event_fk foreign key (active_event_id) references public.special_events (id) on delete set null;

-- Voti di categoria
create table public.category_votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  round_id uuid not null references public.game_rounds (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  option_id uuid not null references public.category_vote_options (id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  unique (round_id, participant_id)
);
create index category_votes_round_idx on public.category_votes (round_id, option_id);

-- Classifica finale congelata a fine serata (base per mensile e stagionale)
create table public.leaderboards (
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  identity_id uuid references public.player_identities (id) on delete set null,
  nickname text not null,
  final_rank integer not null,
  points integer not null,
  correct_count integer not null,
  is_test boolean not null,
  session_date date not null,
  created_at timestamptz not null default now(),
  primary key (session_id, participant_id)
);
create index leaderboards_date_idx on public.leaderboards (session_date) where not is_test;
create index leaderboards_identity_idx on public.leaderboards (identity_id);

-- ---------------------------------------------------------------------
-- Audit, sicurezza, rate limit
-- ---------------------------------------------------------------------
create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null,
  session_id uuid references public.game_sessions (id) on delete set null,
  target_type text,
  target_id text,
  details jsonb not null default '{}',
  ip text,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_session_idx on public.admin_audit_logs (session_id, created_at desc);

create table public.security_events (
  id bigint generated always as identity primary key,
  session_id uuid references public.game_sessions (id) on delete set null,
  participant_id uuid references public.participants (id) on delete set null,
  kind text not null,
  details jsonb not null default '{}',
  ip text,
  created_at timestamptz not null default now()
);
create index security_events_session_idx on public.security_events (session_id, created_at desc);

create table public.rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  hits integer not null
);

-- Rate limit a finestra fissa, condiviso tra tutte le istanze serverless.
create or replace function public.qz_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (bucket, window_start, hits)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

-- updated_at automatico
create or replace function public.qz_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_admin_users_touch before update on public.admin_users for each row execute function public.qz_touch_updated_at();
create trigger trg_question_bank_touch before update on public.question_bank for each row execute function public.qz_touch_updated_at();
create trigger trg_game_sessions_touch before update on public.game_sessions for each row execute function public.qz_touch_updated_at();

-- Le sessioni pubblicate sono congelate: round e domande non si modificano
-- più dal CMS (solo tramite comandi live registrati).
create or replace function public.qz_guard_frozen_session()
returns trigger
language plpgsql
as $$
declare
  v_status public.session_status;
  v_session uuid;
begin
  if current_setting('qz.allow_frozen_write', true) = 'on' then
    return coalesce(new, old);
  end if;
  v_session := coalesce(new.session_id, old.session_id);
  select status into v_status from public.game_sessions where id = v_session;
  if v_status is not null and v_status <> 'draft' then
    raise exception 'SESSION_FROZEN: la sessione % è pubblicata e non può essere modificata', v_session
      using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_rounds_frozen before insert or delete on public.game_rounds
  for each row execute function public.qz_guard_frozen_session();
create trigger trg_session_questions_frozen before insert or delete on public.session_questions
  for each row execute function public.qz_guard_frozen_session();
create trigger trg_snapshots_frozen before update or delete on public.question_snapshots
  for each row execute function public.qz_guard_frozen_session();

-- Il log eventi e gli eventi di punteggio sono append-only.
create or replace function public.qz_append_only()
returns trigger
language plpgsql
as $$
begin
  if current_setting('qz.allow_reset', true) = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'APPEND_ONLY: % non può essere modificata', tg_table_name using errcode = 'P0001';
end;
$$;

create trigger trg_score_events_append_only before update or delete on public.score_events
  for each row execute function public.qz_append_only();
create trigger trg_game_events_append_only before update or delete on public.game_events
  for each row execute function public.qz_append_only();
create trigger trg_audit_append_only before update or delete on public.admin_audit_logs
  for each row execute function public.qz_append_only();

-- ---------------------------------------------------------------------
-- RLS: attiva ovunque, nessuna policy pubblica.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'admin_roles','admin_users','application_settings','seasons','media_assets','question_bank',
    'question_options','special_event_definitions','game_sessions','session_operators','game_rounds',
    'category_vote_options','session_questions','question_snapshots','player_identities','participants',
    'answer_submissions','answer_selected_options','score_events','score_totals','game_state','game_events',
    'special_events','category_votes','leaderboards','admin_audit_logs','security_events','rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Gli admin autenticati possono leggere solo il proprio profilo (usato dal
-- client per mostrare il ruolo); tutto il resto passa dal backend.
create policy admin_users_self_read on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.admin_users to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Realtime: il canale di gioco 'qz:game:<session_id>' trasporta SOLO lo
-- stato pubblico (lo stesso mostrato dal TV). I dati admin (conteggi,
-- giocatori, soluzioni future) passano esclusivamente da API autenticate.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Storage: bucket privato per i media (accesso solo tramite URL firmati
-- generati dal backend al momento opportuno).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/x-wav','audio/webm','video/mp4','video/webm'])
on conflict (id) do nothing;
