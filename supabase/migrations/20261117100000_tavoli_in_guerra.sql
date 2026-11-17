-- ---------------------------------------------------------------------
-- TAVOLI IN GUERRA! – il game show per pub: ogni tavolo è una squadra.
--
-- Gioco indipendente della piattaforma: SOLO tabelle nuove con prefisso tig_, nessun dato degli altri
-- giochi viene toccato. Idempotente (si può rilanciare) e solo additiva.
--
-- Soggetti:
--   1. l'ORGANIZZATORE (account del sito) crea la serata e la gestisce dalla regia;
--   2. i GIOCATORI (account del sito, obbligatorio): un account = una squadra per serata
--      (UNIQUE(event_id, user_id)); un tavolo = una squadra (UNIQUE(event_id, table_id));
--   3. la TV del locale legge SOLO lo stato pubblico con una chiave lunga e casuale (nessun account).
--
-- Entità:
--   * tig_events: la serata (configurazione, macchina a stati, scadenze del server, versione, piano dei giochi);
--   * tig_tables: i tavoli fisici (QR firmato, codice squadra, PIN facoltativo dello staff);
--   * tig_teams: le squadre (nome filtrato e convalidato dallo staff, capitano, mascotte, saldo MAI < 0,
--     Energia Caos e livello, sfide vinte e precisione per gli spareggi, Bottone del Caos usato);
--   * tig_members: i telefoni/account delle squadre (presenza online);
--   * tig_games: le prove giocate (meccanica, variante di contenuto CONGELATA, partecipanti, scadenze, esito);
--   * tig_submissions: gli invii (chiave di idempotenza UNICA; uno valido per squadra o per membro);
--   * tig_score_ledger: OGNI variazione di punti (motivo, fonte, riferimento, chiave di idempotenza UNICA);
--   * tig_energy_log: l'Energia Caos guadagnata (separata dai punti, solo estetica);
--   * tig_attacks: attacchi/furti tra tavoli (anti-accanimento: max 2 sullo stesso tavolo in 10 minuti);
--   * tig_powers: poteri (scudo non cumulabile che scade a fine manche, Bottone del Caos 1 per serata);
--   * tig_bets: puntata finale (≤ min(25% saldo, 250)), una per squadra e prova;
--   * tig_mascot_votes: voto della mascotte (un voto per membro, modificabile in lobby);
--   * tig_log: registro eventi e AUDIT della regia (skip/rollback/pausa con motivo);
--   * tig_tts_clips: voci sintetizzate in cache (solo se configurate).
--
-- Nessun accesso diretto dai client: RLS attiva, nessuna policy, tutto passa dal server.
-- Realtime: il server pubblica sul topic privato 'qz:game:tig-<id serata>' (già autorizzato in ricezione
-- dalla policy qz_game_channel_receive) SOLO lo stato pubblico, senza soluzioni.
-- ---------------------------------------------------------------------

create table if not exists public.tig_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  venue text not null check (char_length(venue) between 2 and 60),
  venue_key text not null check (char_length(venue_key) between 1 and 60),
  display_key text not null unique check (char_length(display_key) >= 24),
  access_mode text not null default 'qr' check (access_mode in ('qr', 'code')),
  config jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'closed')),
  state text not null default 'DRAFT' check (state in ('DRAFT', 'LOBBY_OPEN', 'LOBBY_LOCKED', 'INTRO', 'ROUND_INTRO', 'GAME_ACTIVE', 'GAME_RESULTS', 'LEADERBOARD', 'BREAK', 'FINAL', 'AWARDS', 'COMPLETED', 'PAUSED', 'CANCELLED')),
  paused_from text,
  version bigint not null default 1,
  secret_rev integer not null default 0,
  late_join boolean not null default false,
  manche_no integer not null default 0 check (manche_no between 0 and 5),
  game_index integer not null default 0,
  manche_started_at timestamptz,
  manche_paused_ms bigint not null default 0,
  current_game_id uuid,
  plan jsonb not null default '[]'::jsonb,
  phase_started_at timestamptz,
  phase_deadline_at timestamptz,
  phase_total_ms integer,
  paused_at timestamptz,
  paused_ms bigint not null default 0,
  spotlight jsonb,
  event jsonb,
  awards jsonb,
  host_seen_at timestamptz not null default now(),
  display_seen_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  closed_at timestamptz,
  close_reason text
);
create index if not exists tig_events_owner_idx on public.tig_events (owner_user_id, created_at desc);
create index if not exists tig_events_open_idx on public.tig_events (last_activity_at) where status = 'open';
create index if not exists tig_events_venue_idx on public.tig_events (owner_user_id, venue_key, created_at desc);
alter table public.tig_events enable row level security;
revoke all on table public.tig_events from anon, authenticated;
comment on table public.tig_events is 'TAVOLI IN GUERRA!: serate (macchina a stati e scadenze autorevoli del server)';

create table if not exists public.tig_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tig_events (id) on delete cascade,
  table_no integer not null check (table_no between 1 and 60),
  qr_token text not null unique check (char_length(qr_token) between 20 and 80),
  join_code text not null check (join_code ~ '^[A-Z2-9]{6}$'),
  pin text check (pin is null or pin ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  unique (event_id, table_no)
);
create unique index if not exists tig_tables_code_key on public.tig_tables (join_code);
alter table public.tig_tables enable row level security;
revoke all on table public.tig_tables from anon, authenticated;
comment on table public.tig_tables is 'TAVOLI IN GUERRA!: tavoli fisici (QR firmato, codice squadra, PIN dello staff)';

create table if not exists public.tig_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tig_events (id) on delete cascade,
  table_id uuid not null references public.tig_tables (id) on delete cascade,
  table_no integer not null,
  name text not null check (char_length(name) between 2 and 24),
  name_key text not null,
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  status text not null default 'active' check (status in ('active', 'kicked')),
  approved boolean not null default false,
  approved_at timestamptz,
  captain_member_id uuid,
  mascot_slot integer check (mascot_slot is null or mascot_slot between 1 and 12),
  mascot_exclusive boolean not null default false,
  mascot_confirmed boolean not null default false,
  score integer not null default 0 check (score >= 0),
  energy integer not null default 0 check (energy >= 0),
  mascot_level integer not null default 1 check (mascot_level between 1 and 3),
  wins integer not null default 0,
  acc_sum double precision not null default 0,
  acc_n integer not null default 0,
  tiebreak_rank integer,
  caos_used boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, table_id)
);
-- in modalità standard ogni mascotte va a UN solo tavolo (assegnazione atomica)
create unique index if not exists tig_teams_mascot_key on public.tig_teams (event_id, mascot_slot) where mascot_exclusive and mascot_slot is not null;
create index if not exists tig_teams_event_idx on public.tig_teams (event_id, table_no);
alter table public.tig_teams enable row level security;
revoke all on table public.tig_teams from anon, authenticated;
comment on table public.tig_teams is 'TAVOLI IN GUERRA!: squadre (una per tavolo), saldo mai negativo, Energia Caos separata dai punti';

create table if not exists public.tig_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tig_events (id) on delete cascade,
  team_id uuid not null references public.tig_teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24),
  status text not null default 'active' check (status in ('active', 'left', 'kicked')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index if not exists tig_members_team_idx on public.tig_members (team_id, status);
create index if not exists tig_members_user_idx on public.tig_members (user_id);
alter table public.tig_members enable row level security;
revoke all on table public.tig_members from anon, authenticated;
comment on table public.tig_members is 'TAVOLI IN GUERRA!: account dei giocatori (uno per serata) e appartenenza alla squadra';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tig_teams_captain_fk') then
    alter table public.tig_teams add constraint tig_teams_captain_fk foreign key (captain_member_id) references public.tig_members (id) on delete set null;
  end if;
end $$;

create table if not exists public.tig_games (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tig_events (id) on delete cascade,
  manche_no integer not null check (manche_no between 0 and 5),
  slot_no integer not null,
  kind text not null default 'regular' check (kind in ('regular', 'caos', 'tiebreak')),
  attempt integer not null default 1,
  mechanic_code text not null check (char_length(mechanic_code) between 2 and 60),
  variant_key text not null check (char_length(variant_key) between 1 and 80),
  difficulty text,
  content jsonb not null,
  seed text not null,
  teams jsonb not null default '[]'::jsonb,
  participants uuid[] not null default '{}',
  bet_enabled boolean not null default false,
  status text not null default 'active' check (status in ('active', 'scored', 'voided')),
  starts_at timestamptz not null,
  deadline_at timestamptz not null,
  timer_ms integer not null,
  closed_at timestamptz,
  outcome jsonb,
  reveal jsonb,
  caos_source uuid,
  caos_target uuid,
  winner_team_id uuid,
  created_at timestamptz not null default now(),
  unique (event_id, manche_no, slot_no, kind, attempt)
);
create index if not exists tig_games_event_idx on public.tig_games (event_id, created_at);
create index if not exists tig_games_variant_idx on public.tig_games (mechanic_code, variant_key);
alter table public.tig_games enable row level security;
revoke all on table public.tig_games from anon, authenticated;
comment on table public.tig_games is 'TAVOLI IN GUERRA!: prove giocate (contenuto congelato: soluzioni SEGRETE fino al reveal)';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tig_events_current_game_fk') then
    alter table public.tig_events add constraint tig_events_current_game_fk foreign key (current_game_id) references public.tig_games (id) on delete set null;
  end if;
end $$;

create table if not exists public.tig_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tig_events (id) on delete cascade,
  game_id uuid not null references public.tig_games (id) on delete cascade,
  team_id uuid not null references public.tig_teams (id) on delete cascade,
  member_id uuid not null references public.tig_members (id) on delete cascade,
  -- uno valido per squadra (team/pub/duel) o per membro (vote/coop)
  scope_key text not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 80),
  payload jsonb not null,
  elapsed_ms integer not null check (elapsed_ms >= 0),
  void boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_id, idempotency_key)
);
create unique index if not exists tig_submissions_scope_key on public.tig_submissions (game_id, scope_key) where not void;
create index if not exists tig_submissions_game_idx on public.tig_submissions (game_id);
alter table public.tig_submissions enable row level security;
revoke all on table public.tig_submissions from anon, authenticated;
comment on table public.tig_submissions is 'TAVOLI IN GUERRA!: invii validati dal server (idempotenti, uno per squadra o per membro)';

create table if not exists public.tig_score_ledger (
  id bigserial primary key,
  event_id uuid not null references public.tig_events (id) on delete cascade,
  team_id uuid not null references public.tig_teams (id) on delete cascade,
  manche_no integer not null,
  source text not null check (source in ('game', 'transfer', 'caos', 'bet', 'admin', 'rollback')),
  reason text not null check (char_length(reason) between 2 and 200),
  ref text,
  counterpart_team_id uuid references public.tig_teams (id) on delete set null,
  requested integer not null,
  applied integer not null,
  balance_after integer not null check (balance_after >= 0),
  idempotency_key text not null unique check (char_length(idempotency_key) between 4 and 200),
  created_at timestamptz not null default now()
);
create index if not exists tig_score_ledger_event_idx on public.tig_score_ledger (event_id, created_at);
create index if not exists tig_score_ledger_team_idx on public.tig_score_ledger (team_id, manche_no, source);
alter table public.tig_score_ledger enable row level security;
revoke all on table public.tig_score_ledger from anon, authenticated;
comment on table public.tig_score_ledger is 'TAVOLI IN GUERRA!: registro verificabile dei punti (motivo, fonte, riferimento, chiave unica)';

create table if not exists public.tig_energy_log (
  id bigserial primary key,
  event_id uuid not null references public.tig_events (id) on delete cascade,
  team_id uuid not null references public.tig_teams (id) on delete cascade,
  amount integer not null check (amount >= 0),
  reason text not null,
  ref text,
  level_after integer not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists tig_energy_log_team_idx on public.tig_energy_log (team_id, created_at);
alter table public.tig_energy_log enable row level security;
revoke all on table public.tig_energy_log from anon, authenticated;

create table if not exists public.tig_attacks (
  id bigserial primary key,
  event_id uuid not null references public.tig_events (id) on delete cascade,
  source_team_id uuid not null references public.tig_teams (id) on delete cascade,
  target_team_id uuid not null references public.tig_teams (id) on delete cascade,
  kind text not null check (kind in ('transfer', 'penalty', 'caos')),
  game_id uuid references public.tig_games (id) on delete set null,
  manche_no integer not null,
  outcome text not null check (outcome in ('applied', 'blocked', 'refused')),
  amount integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists tig_attacks_target_idx on public.tig_attacks (event_id, target_team_id, created_at);
alter table public.tig_attacks enable row level security;
revoke all on table public.tig_attacks from anon, authenticated;

create table if not exists public.tig_powers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tig_events (id) on delete cascade,
  team_id uuid not null references public.tig_teams (id) on delete cascade,
  kind text not null check (kind in ('shield', 'caos')),
  manche_no integer not null,
  status text not null check (status in ('active', 'consumed', 'expired')),
  idempotency_key text not null,
  target_team_id uuid references public.tig_teams (id) on delete set null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  -- prova in cui lo scudo si è consumato (per l'annullamento di una prova dalla regia)
  consumed_ref uuid,
  unique (event_id, idempotency_key)
);
-- Bottone del Caos: UNA volta per squadra per serata, anche con richieste simultanee
create unique index if not exists tig_powers_caos_once on public.tig_powers (event_id, team_id) where kind = 'caos';
-- scudo: uno per squadra e manche (non cumulabile)
create unique index if not exists tig_powers_shield_once on public.tig_powers (event_id, team_id, manche_no) where kind = 'shield';
alter table public.tig_powers enable row level security;
revoke all on table public.tig_powers from anon, authenticated;

create table if not exists public.tig_bets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tig_events (id) on delete cascade,
  game_id uuid not null references public.tig_games (id) on delete cascade,
  team_id uuid not null references public.tig_teams (id) on delete cascade,
  member_id uuid references public.tig_members (id) on delete set null,
  amount integer not null check (amount between 0 and 250),
  cap integer not null,
  idempotency_key text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (game_id, team_id)
);
alter table public.tig_bets enable row level security;
revoke all on table public.tig_bets from anon, authenticated;

create table if not exists public.tig_mascot_votes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tig_events (id) on delete cascade,
  team_id uuid not null references public.tig_teams (id) on delete cascade,
  member_id uuid not null references public.tig_members (id) on delete cascade,
  slot integer not null check (slot between 1 and 12),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (event_id, member_id)
);
create index if not exists tig_mascot_votes_team_idx on public.tig_mascot_votes (team_id);
alter table public.tig_mascot_votes enable row level security;
revoke all on table public.tig_mascot_votes from anon, authenticated;

create table if not exists public.tig_log (
  id bigserial primary key,
  event_id uuid not null references public.tig_events (id) on delete cascade,
  kind text not null check (char_length(kind) between 2 and 40),
  audit boolean not null default false,
  actor_user_id uuid,
  reason text,
  from_state text,
  to_state text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists tig_log_event_idx on public.tig_log (event_id, id);
alter table public.tig_log enable row level security;
revoke all on table public.tig_log from anon, authenticated;
comment on table public.tig_log is 'TAVOLI IN GUERRA!: registro eventi e audit della regia (motivo obbligatorio per skip/rollback)';

create table if not exists public.tig_tts_clips (
  cache_key text primary key check (cache_key ~ '^[0-9a-f]{64}$'),
  character_id text not null,
  line_id text not null,
  voice_id text not null,
  model text not null,
  chars integer not null,
  storage_path text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
alter table public.tig_tts_clips enable row level security;
revoke all on table public.tig_tts_clips from anon, authenticated;
