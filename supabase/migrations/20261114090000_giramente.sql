-- ---------------------------------------------------------------------
-- GIRAMENTE! – «La ruota gira. La mente decide.»
--
-- Gioco indipendente della piattaforma: SOLO tabelle nuove con prefisso giramente_, nessun dato
-- degli altri giochi viene toccato. Idempotente (si può rilanciare) e solo additiva.
--
-- Soggetti (come PSYCO):
--   1. utenti registrati (auth.users): chi crea la partita e, con un dispositivo a testa, OGNI
--      partecipante (giramente_participants.kind = 'account', un solo posto per account e stanza);
--   2. partecipanti locali del dispositivo condiviso (kind = 'local'): solo un nome, posseduti
--      dall'account che ha creato la stanza;
--   3. schermi TV/PC pubblici: non sono partecipanti, leggono lo stato pubblico con una chiave lunga.
--
-- Entità di gioco:
--   * giramente_competitors: il CONCORRENTE astratto (giocatore o squadra) con punteggio e Jolly;
--     giramente_participants.competitor_id = appartenenza (squadra) o il proprio concorrente.
--   * giramente_rooms = la partita (fase della macchina a stati, manche, turni, timer, vincitori).
--   * giramente_rounds = le manche giocate; giramente_plays = turni e risposte (una riga per enigma
--     affrontato da un concorrente); giramente_spins = giri di ruota decisi dal server (registro);
--   * giramente_score_log = transazioni di punteggio (premi, bonus, penalità, scudo) con il valore
--     effettivamente applicato (mai sotto zero), una sola per (giocata, voce): niente doppi premi;
--   * giramente_jolly_log = inventario/usi dei poteri della Jolly; giramente_events = registro eventi.
--   * giramente_puzzles = archivio degli enigmi (pannello admin), giramente_tts_clips = voci generate.
--
-- Nessun accesso diretto dai client: RLS attiva, nessuna policy, tutto passa dal server.
-- Realtime: il server pubblica sul topic privato 'qz:game:giramente-<id stanza>' (già autorizzato in
-- ricezione dalla policy qz_game_channel_receive) SOLO lo stato pubblico, senza soluzioni.
-- ---------------------------------------------------------------------

create table if not exists public.giramente_puzzles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  pool text not null check (pool in ('ruota', 'falsa_pista', 'collegamento', 'finale', 'tabellone')),
  kind text check (kind is null or kind in ('intruso', 'sequenza', 'indizi', 'prospettiva')),
  category text not null default 'logica' check (char_length(category) between 2 and 40),
  difficulty text not null check (difficulty in ('facile', 'media', 'difficile')),
  prompt text not null default '' check (char_length(prompt) <= 400),
  clues jsonb not null default '[]'::jsonb check (jsonb_typeof(clues) = 'array'),
  options jsonb check (options is null or jsonb_typeof(options) = 'array'),
  answer_index integer check (answer_index is null or answer_index between 0 and 3),
  solution text not null check (char_length(solution) between 1 and 120),
  accepted jsonb not null default '[]'::jsonb check (jsonb_typeof(accepted) = 'array'),
  extra_clue text check (extra_clue is null or char_length(extra_clue) <= 200),
  false_index integer check (false_index is null or false_index between 0 and 3),
  visual text check (visual is null or char_length(visual) <= 200),
  image_url text check (image_url is null or image_url ~ '^(https://|/)'),
  image_alt text check (image_alt is null or char_length(image_alt) <= 200),
  explanation text check (explanation is null or char_length(explanation) <= 400),
  time_limit_sec integer check (time_limit_sec is null or time_limit_sec between 8 and 180),
  status text not null default 'published' check (status in ('draft', 'published', 'disabled')),
  tags text[] not null default '{}',
  source text not null default 'seed' check (source in ('seed', 'admin')),
  times_played integer not null default 0,
  times_correct integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists giramente_puzzles_pick_idx on public.giramente_puzzles (pool, kind, difficulty) where status = 'published';
alter table public.giramente_puzzles enable row level security;
revoke all on table public.giramente_puzzles from anon, authenticated;
comment on table public.giramente_puzzles is 'GIRAMENTE!: archivio degli enigmi (soluzioni SEGRETE: mai ai client prima del risultato)';

create table if not exists public.giramente_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  display_key text not null unique check (char_length(display_key) >= 24),
  devices text not null check (devices in ('shared', 'personal')),
  mode text not null check (mode in ('individual', 'teams')),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  host_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  phase text not null default 'LOBBY',
  version bigint not null default 1,
  secret_rev integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  round_no integer not null default 0 check (round_no between 0 and 5),
  stage text check (stage is null or stage in ('wheel', 'falsa', 'collegamento', 'tabellone', 'finale', 'tiebreak')),
  tiebreak_no integer not null default 0,
  tiebreak_ids uuid[] not null default '{}',
  turn_order uuid[] not null default '{}',
  turn_index integer not null default 0,
  current_play_id uuid,
  phase_started_at timestamptz,
  phase_deadline_at timestamptz,
  phase_total_ms integer,
  paused_at timestamptz,
  paused_ms bigint not null default 0,
  event jsonb,
  result jsonb,
  reveal jsonb,
  winners uuid[] not null default '{}',
  host_seen_at timestamptz not null default now(),
  display_seen_at timestamptz,
  broadcast_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  closed_at timestamptz,
  close_reason text
);
create index if not exists giramente_rooms_owner_idx on public.giramente_rooms (owner_user_id, created_at desc);
create index if not exists giramente_rooms_open_idx on public.giramente_rooms (last_activity_at) where status = 'open';
alter table public.giramente_rooms enable row level security;
revoke all on table public.giramente_rooms from anon, authenticated;
comment on table public.giramente_rooms is 'GIRAMENTE!: partite (stanza, fase, manche, turni, timer autorevoli del server)';

create table if not exists public.giramente_competitors (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.giramente_rooms (id) on delete cascade,
  kind text not null check (kind in ('player', 'team')),
  name text not null check (char_length(name) between 1 and 24),
  seat integer not null,
  score integer not null default 0 check (score >= 0),
  jolly text check (jolly is null or jolly in ('occhio', 'scudo')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (room_id, seat)
);
create index if not exists giramente_competitors_room_idx on public.giramente_competitors (room_id, seat);
alter table public.giramente_competitors enable row level security;
revoke all on table public.giramente_competitors from anon, authenticated;
comment on table public.giramente_competitors is 'GIRAMENTE!: concorrenti (giocatore o squadra): punteggio (mai negativo) e Jolly (al massimo uno)';

create table if not exists public.giramente_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.giramente_rooms (id) on delete cascade,
  kind text not null check (kind in ('account', 'local')),
  user_id uuid references auth.users (id) on delete cascade,
  owner_user_id uuid references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  seat integer not null,
  status text not null default 'active' check (status in ('active', 'left', 'kicked')),
  competitor_id uuid references public.giramente_competitors (id) on delete set null,
  captain boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_seen_at timestamptz not null default now(),
  constraint giramente_participants_identity_check check (
    (kind = 'account' and user_id is not null)
    or (kind = 'local' and user_id is null and owner_user_id is not null)
  )
);
create unique index if not exists giramente_participants_account_key on public.giramente_participants (room_id, user_id) where user_id is not null;
create unique index if not exists giramente_participants_nick_key on public.giramente_participants (room_id, lower(nickname)) where status = 'active';
create index if not exists giramente_participants_room_idx on public.giramente_participants (room_id, status, seat);
create index if not exists giramente_participants_user_idx on public.giramente_participants (user_id) where user_id is not null;
alter table public.giramente_participants enable row level security;
revoke all on table public.giramente_participants from anon, authenticated;
comment on table public.giramente_participants is 'GIRAMENTE!: partecipanti (account o nomi locali del dispositivo condiviso) e appartenenza alla squadra';

create table if not exists public.giramente_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.giramente_rooms (id) on delete cascade,
  round_no integer not null check (round_no between 1 and 5),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (room_id, round_no)
);
alter table public.giramente_rounds enable row level security;
revoke all on table public.giramente_rounds from anon, authenticated;

create table if not exists public.giramente_plays (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.giramente_rooms (id) on delete cascade,
  round_no integer not null,
  stage text not null check (stage in ('wheel', 'falsa', 'collegamento', 'tabellone', 'finale', 'tiebreak')),
  series integer not null default 0,
  turn_no integer not null,
  competitor_id uuid not null references public.giramente_competitors (id) on delete cascade,
  puzzle_id uuid references public.giramente_puzzles (id) on delete set null,
  puzzle_kind text,
  risk text check (risk is null or risk in ('verde', 'rosso')),
  sector text,
  bonus boolean not null default false,
  lampo boolean not null default false,
  jolly_offer boolean not null default false,
  jolly_duplicate boolean not null default false,
  jolly_chosen text,
  colpo_offered boolean not null default false,
  colpo_accepted boolean,
  status text not null default 'pending' check (status in ('pending', 'open', 'answered', 'timeout')),
  started_at timestamptz,
  deadline_at timestamptz,
  total_ms integer,
  answered_at timestamptz,
  request_id text,
  answer jsonb,
  correct boolean,
  points integer not null default 0,
  applied boolean not null default false,
  aids jsonb not null default '{}'::jsonb,
  board jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  unique (room_id, round_no, stage, series, competitor_id, turn_no)
);
create index if not exists giramente_plays_room_idx on public.giramente_plays (room_id, round_no, stage, series);
create index if not exists giramente_plays_puzzle_idx on public.giramente_plays (puzzle_id);
alter table public.giramente_plays enable row level security;
revoke all on table public.giramente_plays from anon, authenticated;
comment on table public.giramente_plays is 'GIRAMENTE!: turni e risposte (una riga per enigma affrontato); esito calcolato SOLO dal server';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'giramente_rooms_current_play_fk') then
    alter table public.giramente_rooms
      add constraint giramente_rooms_current_play_fk foreign key (current_play_id) references public.giramente_plays (id) on delete set null;
  end if;
end $$;

create table if not exists public.giramente_spins (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.giramente_rooms (id) on delete cascade,
  play_id uuid not null unique references public.giramente_plays (id) on delete cascade,
  round_no integer not null,
  competitor_id uuid references public.giramente_competitors (id) on delete set null,
  segments text[] not null,
  target_index integer not null,
  sector text not null,
  request_id text,
  rng text not null default 'node:crypto.randomInt',
  started_at timestamptz not null,
  duration_ms integer not null,
  created_at timestamptz not null default now()
);
alter table public.giramente_spins enable row level security;
revoke all on table public.giramente_spins from anon, authenticated;
comment on table public.giramente_spins is 'GIRAMENTE!: giri di ruota (spicchio deciso dal server con RNG crittografico, registrato)';

create table if not exists public.giramente_score_log (
  id bigserial primary key,
  room_id uuid not null references public.giramente_rooms (id) on delete cascade,
  competitor_id uuid not null references public.giramente_competitors (id) on delete cascade,
  play_id uuid references public.giramente_plays (id) on delete set null,
  round_no integer not null,
  kind text not null check (kind in ('award', 'bonus', 'lampo', 'penalty', 'shield', 'jolly_dup', 'falsa', 'soluzione', 'collegamento', 'tabellone', 'finale', 'tiebreak')),
  label text not null,
  requested integer not null,
  applied integer not null,
  score_after integer not null check (score_after >= 0),
  created_at timestamptz not null default now()
);
create unique index if not exists giramente_score_log_once on public.giramente_score_log (play_id, kind) where play_id is not null;
create index if not exists giramente_score_log_room_idx on public.giramente_score_log (room_id, created_at);
alter table public.giramente_score_log enable row level security;
revoke all on table public.giramente_score_log from anon, authenticated;
comment on table public.giramente_score_log is 'GIRAMENTE!: transazioni di punteggio (una per giocata e voce), con il valore applicato dopo il minimo a zero';

create table if not exists public.giramente_jolly_log (
  id bigserial primary key,
  room_id uuid not null references public.giramente_rooms (id) on delete cascade,
  competitor_id uuid not null references public.giramente_competitors (id) on delete cascade,
  play_id uuid references public.giramente_plays (id) on delete set null,
  round_no integer not null,
  power text check (power is null or power in ('occhio', 'scudo')),
  action text not null check (action in ('granted', 'duplicate', 'used', 'expired')),
  created_at timestamptz not null default now()
);
create index if not exists giramente_jolly_log_room_idx on public.giramente_jolly_log (room_id, created_at);
alter table public.giramente_jolly_log enable row level security;
revoke all on table public.giramente_jolly_log from anon, authenticated;
comment on table public.giramente_jolly_log is 'GIRAMENTE!: poteri della Jolly (assegnati, doppioni +50, usati, scaduti)';

create table if not exists public.giramente_events (
  id bigserial primary key,
  room_id uuid not null references public.giramente_rooms (id) on delete cascade,
  kind text not null check (char_length(kind) between 2 and 40),
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists giramente_events_room_idx on public.giramente_events (room_id, id);
alter table public.giramente_events enable row level security;
revoke all on table public.giramente_events from anon, authenticated;
comment on table public.giramente_events is 'GIRAMENTE!: registro degli eventi della partita';

create table if not exists public.giramente_tts_clips (
  cache_key text primary key check (cache_key ~ '^[0-9a-f]{64}$'),
  who text not null check (who in ('dontralla', 'zafira')),
  model text not null,
  voice_id text not null,
  text text not null check (char_length(text) between 1 and 400),
  chars integer not null check (chars >= 0),
  billed_chars integer not null default 0 check (billed_chars >= 0),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
alter table public.giramente_tts_clips enable row level security;
revoke all on table public.giramente_tts_clips from anon, authenticated;
comment on table public.giramente_tts_clips is 'GIRAMENTE!: battute dinamiche di Don Patrizio e Zafira generate con ElevenLabs (bucket privato tts)';

-- ---------------------------------------------------------------------
-- Archivio iniziale degli enigmi. Fonte: content/giramente/enigmi.json (scripts/giramente/enigmi-sql.mjs).
-- Le modifiche fatte dal pannello admin non vengono sovrascritte (on conflict do nothing).
-- ---------------------------------------------------------------------
-- @@SEED@@
insert into public.giramente_puzzles (slug, pool, kind, category, difficulty, prompt, clues, options, answer_index, solution, accepted, extra_clue, false_index, visual, explanation) values
  ($g$intruso-f-01$g$, $g$ruota$g$, $g$intruso$g$, $g$cultura$g$, $g$facile$g$, $g$Quale di questi NON è un pianeta del Sistema solare?$g$, $g$[]$g$::jsonb, $g$["Marte","Plutone","Venere","Saturno"]$g$::jsonb, 1, $g$Plutone$g$, $g$[]$g$::jsonb, $g$Dal 2006 gli astronomi lo considerano un pianeta nano.$g$, null, null, $g$Plutone è stato riclassificato come pianeta nano nel 2006. Marte, Venere e Saturno sono pianeti.$g$),
  ($g$intruso-f-02$g$, $g$ruota$g$, $g$intruso$g$, $g$cultura$g$, $g$facile$g$, $g$Quale di questi animali NON è un mammifero?$g$, $g$[]$g$::jsonb, $g$["Delfino","Pipistrello","Pinguino","Balena"]$g$::jsonb, 2, $g$Pinguino$g$, $g$[]$g$::jsonb, $g$Ha le piume e depone le uova, anche se non vola.$g$, null, null, $g$Il pinguino è un uccello. Delfino, pipistrello e balena sono mammiferi: allattano i piccoli.$g$),
  ($g$intruso-f-03$g$, $g$ruota$g$, $g$intruso$g$, $g$logica$g$, $g$facile$g$, $g$Quale di questi numeri NON appartiene al gruppo?$g$, $g$[]$g$::jsonb, $g$["12","26","40","27"]$g$::jsonb, 3, $g$27$g$, $g$[]$g$::jsonb, $g$Prova a dividerli tutti per 2.$g$, null, null, $g$12, 26 e 40 sono pari. 27 è dispari.$g$),
  ($g$intruso-f-04$g$, $g$ruota$g$, $g$intruso$g$, $g$cultura$g$, $g$facile$g$, $g$Quale di queste città NON è la capitale di uno Stato?$g$, $g$[]$g$::jsonb, $g$["Milano","Lisbona","Vienna","Atene"]$g$::jsonb, 0, $g$Milano$g$, $g$[]$g$::jsonb, $g$È il capoluogo di una regione, non di un Paese.$g$, null, null, $g$Lisbona, Vienna e Atene sono capitali di Portogallo, Austria e Grecia. Milano è il capoluogo della Lombardia.$g$),
  ($g$intruso-f-05$g$, $g$ruota$g$, $g$intruso$g$, $g$osservazione$g$, $g$facile$g$, $g$Quale colore NON c'è nella bandiera italiana?$g$, $g$[]$g$::jsonb, $g$["Verde","Bianco","Blu","Rosso"]$g$::jsonb, 2, $g$Blu$g$, $g$[]$g$::jsonb, $g$Pensa ai colori di una pizza Margherita: basilico, mozzarella e pomodoro.$g$, null, null, $g$Il tricolore italiano è verde, bianco e rosso. Il blu non c'è.$g$),
  ($g$intruso-f-06$g$, $g$ruota$g$, $g$intruso$g$, $g$cultura$g$, $g$facile$g$, $g$Quale di questi NON è uno strumento a corde?$g$, $g$[]$g$::jsonb, $g$["Violino","Chitarra","Arpa","Flauto"]$g$::jsonb, 3, $g$Flauto$g$, $g$[]$g$::jsonb, $g$Uno di questi si suona soffiando.$g$, null, null, $g$Violino, chitarra e arpa hanno le corde. Il flauto è uno strumento a fiato.$g$),
  ($g$intruso-f-07$g$, $g$ruota$g$, $g$intruso$g$, $g$pop$g$, $g$facile$g$, $g$Quale di questi NON è uno dei sette nani di Biancaneve (versione Disney italiana)?$g$, $g$[]$g$::jsonb, $g$["Birbone","Brontolo","Pisolo","Gongolo"]$g$::jsonb, 0, $g$Birbone$g$, $g$[]$g$::jsonb, $g$I nomi veri descrivono un carattere: uno brontola, uno sonnecchia, uno gongola di gioia.$g$, null, null, $g$Brontolo, Pisolo e Gongolo sono tre dei sette nani. Birbone non è tra loro.$g$),
  ($g$intruso-f-08$g$, $g$ruota$g$, $g$intruso$g$, $g$pop$g$, $g$facile$g$, $g$In quale di questi sport NON si usa una palla?$g$, $g$[]$g$::jsonb, $g$["Tennis","Hockey su ghiaccio","Pallavolo","Golf"]$g$::jsonb, 1, $g$Hockey su ghiaccio$g$, $g$[]$g$::jsonb, $g$In uno di questi si colpisce un disco piatto di gomma.$g$, null, null, $g$Tennis, pallavolo e golf si giocano con una palla. Nell'hockey su ghiaccio si usa il disco.$g$),
  ($g$intruso-d-01$g$, $g$ruota$g$, $g$intruso$g$, $g$logica$g$, $g$difficile$g$, $g$Quale di questi numeri NON è un numero primo?$g$, $g$[]$g$::jsonb, $g$["17","23","51","29"]$g$::jsonb, 2, $g$51$g$, $g$[]$g$::jsonb, $g$Somma le cifre di ciascun numero: una somma è divisibile per 3.$g$, null, null, $g$17, 23 e 29 sono primi. 51 = 3 × 17, quindi non è primo.$g$),
  ($g$intruso-d-02$g$, $g$ruota$g$, $g$intruso$g$, $g$cultura$g$, $g$difficile$g$, $g$Quale di queste NON è una regione italiana a statuto speciale?$g$, $g$[]$g$::jsonb, $g$["Sardegna","Valle d'Aosta","Liguria","Friuli-Venezia Giulia"]$g$::jsonb, 2, $g$Liguria$g$, $g$[]$g$::jsonb, $g$Le regioni a statuto speciale sono cinque: due isole e tre regioni di confine al nord.$g$, null, null, $g$Sardegna, Valle d'Aosta e Friuli-Venezia Giulia sono a statuto speciale (con Sicilia e Trentino-Alto Adige). La Liguria no.$g$),
  ($g$intruso-d-03$g$, $g$ruota$g$, $g$intruso$g$, $g$cultura$g$, $g$difficile$g$, $g$Quale di questi animali NON è un rettile?$g$, $g$[]$g$::jsonb, $g$["Salamandra","Iguana","Camaleonte","Geco"]$g$::jsonb, 0, $g$Salamandra$g$, $g$[]$g$::jsonb, $g$Ha la pelle umida e nasce in acqua, come la rana.$g$, null, null, $g$Iguana, camaleonte e geco sono rettili. La salamandra è un anfibio.$g$),
  ($g$intruso-d-04$g$, $g$ruota$g$, $g$intruso$g$, $g$cultura$g$, $g$difficile$g$, $g$Quale di questi elementi NON è un gas nobile?$g$, $g$[]$g$::jsonb, $g$["Neon","Argon","Elio","Azoto"]$g$::jsonb, 3, $g$Azoto$g$, $g$[]$g$::jsonb, $g$È il gas più abbondante nell'aria che respiriamo.$g$, null, null, $g$Neon, argon ed elio sono gas nobili. L'azoto, circa il 78% dell'aria, non lo è.$g$),
  ($g$intruso-d-05$g$, $g$ruota$g$, $g$intruso$g$, $g$cultura$g$, $g$difficile$g$, $g$Quale di questi pittori NON è italiano?$g$, $g$[]$g$::jsonb, $g$["Velázquez","Caravaggio","Tiziano","Giotto"]$g$::jsonb, 0, $g$Velázquez$g$, $g$[]$g$::jsonb, $g$Uno di loro era il pittore di corte del re di Spagna.$g$, null, null, $g$Caravaggio, Tiziano e Giotto sono italiani. Diego Velázquez era spagnolo, nato a Siviglia.$g$),
  ($g$intruso-d-06$g$, $g$ruota$g$, $g$intruso$g$, $g$cultura$g$, $g$difficile$g$, $g$Quale di questi fiumi NON sfocia nel Mar Adriatico?$g$, $g$[]$g$::jsonb, $g$["Po","Adige","Piave","Tevere"]$g$::jsonb, 3, $g$Tevere$g$, $g$[]$g$::jsonb, $g$Uno di loro attraversa Roma e finisce nel Tirreno.$g$, null, null, $g$Po, Adige e Piave sfociano nell'Adriatico. Il Tevere sfocia nel Tirreno, a Fiumicino e Ostia.$g$),
  ($g$intruso-d-07$g$, $g$ruota$g$, $g$intruso$g$, $g$cultura$g$, $g$difficile$g$, $g$Quale di questi NON è un satellite di Giove?$g$, $g$[]$g$::jsonb, $g$["Io","Titano","Europa","Ganimede"]$g$::jsonb, 1, $g$Titano$g$, $g$[]$g$::jsonb, $g$Uno di questi gira intorno al pianeta con gli anelli più famosi.$g$, null, null, $g$Io, Europa e Ganimede sono satelliti di Giove. Titano è il satellite più grande di Saturno.$g$),
  ($g$intruso-d-08$g$, $g$ruota$g$, $g$intruso$g$, $g$logica$g$, $g$difficile$g$, $g$Quale di questi anni NON è stato bisestile?$g$, $g$[]$g$::jsonb, $g$["1996","1900","2000","2024"]$g$::jsonb, 1, $g$1900$g$, $g$[]$g$::jsonb, $g$Gli anni di fine secolo sono bisestili solo se divisibili per 400.$g$, null, null, $g$1996, 2000 e 2024 sono bisestili. Il 1900 è divisibile per 100 ma non per 400, quindi non lo è.$g$),
  ($g$sequenza-f-01$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$facile$g$, $g$Completa la sequenza: 2, 4, 8, 16, ?$g$, $g$[]$g$::jsonb, $g$["24","32","30","20"]$g$::jsonb, 1, $g$32$g$, $g$[]$g$::jsonb, $g$Ogni numero è il doppio del precedente.$g$, null, null, $g$Ogni numero raddoppia: 16 × 2 = 32.$g$),
  ($g$sequenza-f-02$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$facile$g$, $g$Completa la sequenza: Lunedì, Mercoledì, Venerdì, ?$g$, $g$[]$g$::jsonb, $g$["Sabato","Giovedì","Martedì","Domenica"]$g$::jsonb, 3, $g$Domenica$g$, $g$[]$g$::jsonb, $g$Si salta sempre un giorno della settimana.$g$, null, null, $g$Si salta un giorno ogni volta: dopo venerdì si salta sabato e arriva domenica.$g$),
  ($g$sequenza-f-03$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$facile$g$, $g$Completa la sequenza: 5, 10, 15, 20, ?$g$, $g$[]$g$::jsonb, $g$["30","22","25","24"]$g$::jsonb, 2, $g$25$g$, $g$[]$g$::jsonb, $g$È la tabellina del 5.$g$, null, null, $g$Si aggiunge sempre 5: 20 + 5 = 25.$g$),
  ($g$sequenza-f-04$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$facile$g$, $g$Completa la sequenza di lettere: A, C, E, G, ?$g$, $g$[]$g$::jsonb, $g$["I","H","L","M"]$g$::jsonb, 0, $g$I$g$, $g$[]$g$::jsonb, $g$Si salta sempre una lettera dell'alfabeto.$g$, null, null, $g$Si salta una lettera: A (B) C (D) E (F) G (H) I.$g$),
  ($g$sequenza-f-05$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$facile$g$, $g$Completa la sequenza: Gennaio, Marzo, Maggio, Luglio, ?$g$, $g$[]$g$::jsonb, $g$["Agosto","Settembre","Ottobre","Giugno"]$g$::jsonb, 1, $g$Settembre$g$, $g$[]$g$::jsonb, $g$Si salta un mese ogni volta.$g$, null, null, $g$Si salta un mese: dopo luglio si salta agosto e arriva settembre.$g$),
  ($g$sequenza-f-06$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$facile$g$, $g$Completa la sequenza di numeri romani: I, II, III, IV, ?$g$, $g$[]$g$::jsonb, $g$["V","VI","IIII","X"]$g$::jsonb, 0, $g$V$g$, $g$[]$g$::jsonb, $g$Si conta da uno in su: manca il numero delle dita di una mano.$g$, null, null, $g$I, II, III, IV, V: sono i numeri da 1 a 5 in cifre romane.$g$),
  ($g$sequenza-f-07$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$facile$g$, $g$Completa la sequenza: 1, 4, 9, 16, ?$g$, $g$[]$g$::jsonb, $g$["20","24","36","25"]$g$::jsonb, 3, $g$25$g$, $g$[]$g$::jsonb, $g$1×1, 2×2, 3×3, 4×4… e poi?$g$, null, null, $g$Sono i quadrati dei numeri: dopo 4 × 4 = 16 viene 5 × 5 = 25.$g$),
  ($g$sequenza-f-08$g$, $g$ruota$g$, $g$sequenza$g$, $g$osservazione$g$, $g$facile$g$, $g$Quale forma viene al posto del punto interrogativo?$g$, $g$[]$g$::jsonb, $g$["Triangolo","Quadrato","Cerchio","Stella"]$g$::jsonb, 2, $g$Cerchio$g$, $g$[]$g$::jsonb, $g$Le forme si ripetono sempre nello stesso ordine, a gruppi di tre.$g$, null, $g$▲ ■ ● ▲ ■ ?$g$, $g$Il gruppo triangolo, quadrato, cerchio si ripete: dopo il quadrato viene il cerchio.$g$),
  ($g$sequenza-d-01$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$difficile$g$, $g$Completa la sequenza: 1, 1, 2, 3, 5, 8, ?$g$, $g$[]$g$::jsonb, $g$["11","13","12","16"]$g$::jsonb, 1, $g$13$g$, $g$[]$g$::jsonb, $g$Ogni numero è la somma dei due che lo precedono.$g$, null, null, $g$È la sequenza di Fibonacci: 5 + 8 = 13.$g$),
  ($g$sequenza-d-02$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$difficile$g$, $g$Completa la sequenza: 2, 3, 5, 7, 11, ?$g$, $g$[]$g$::jsonb, $g$["12","15","17","13"]$g$::jsonb, 3, $g$13$g$, $g$[]$g$::jsonb, $g$Sono numeri divisibili solo per 1 e per sé stessi.$g$, null, null, $g$Sono i numeri primi in ordine: dopo 11 viene 13.$g$),
  ($g$sequenza-d-03$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$difficile$g$, $g$Completa la sequenza: 1, 2, 6, 24, ?$g$, $g$[]$g$::jsonb, $g$["48","96","120","72"]$g$::jsonb, 2, $g$120$g$, $g$[]$g$::jsonb, $g$Si moltiplica per 2, poi per 3, poi per 4…$g$, null, null, $g$×2, ×3, ×4, quindi ×5: 24 × 5 = 120.$g$),
  ($g$sequenza-d-04$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$difficile$g$, $g$Completa la sequenza di lettere: U, D, T, Q, C, ?$g$, $g$[]$g$::jsonb, $g$["S","O","N","E"]$g$::jsonb, 0, $g$S$g$, $g$[]$g$::jsonb, $g$Sono le iniziali di qualcosa che si impara contando.$g$, null, null, $g$Sono le iniziali di Uno, Due, Tre, Quattro, Cinque: poi viene Sei.$g$),
  ($g$sequenza-d-05$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$difficile$g$, $g$Completa la sequenza di lettere: G, F, M, A, M, ?$g$, $g$[]$g$::jsonb, $g$["L","A","G","S"]$g$::jsonb, 2, $g$G$g$, $g$[]$g$::jsonb, $g$Sono le iniziali di dodici cose che tornano ogni anno.$g$, null, null, $g$Sono le iniziali dei mesi: Gennaio, Febbraio, Marzo, Aprile, Maggio, Giugno.$g$),
  ($g$sequenza-d-06$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$difficile$g$, $g$Completa la sequenza: 3, 6, 11, 18, 27, ?$g$, $g$[]$g$::jsonb, $g$["38","36","39","40"]$g$::jsonb, 0, $g$38$g$, $g$[]$g$::jsonb, $g$Guarda le differenze: +3, +5, +7, +9…$g$, null, null, $g$Le differenze crescono di 2 (+3, +5, +7, +9), quindi ora +11: 27 + 11 = 38.$g$),
  ($g$sequenza-d-07$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$difficile$g$, $g$Completa la sequenza di numeri romani: X, XX, XL, LXXX, ?$g$, $g$[]$g$::jsonb, $g$["C","CXL","XC","CLX"]$g$::jsonb, 3, $g$CLX$g$, $g$[]$g$::jsonb, $g$Traduci in cifre: 10, 20, 40, 80… ogni volta il doppio.$g$, null, null, $g$10, 20, 40, 80, poi 160. In numeri romani 160 si scrive CLX (100 + 50 + 10).$g$),
  ($g$sequenza-d-08$g$, $g$ruota$g$, $g$sequenza$g$, $g$sequenze$g$, $g$difficile$g$, $g$Completa la sequenza: 1, 3, 7, 15, 31, ?$g$, $g$[]$g$::jsonb, $g$["62","63","47","64"]$g$::jsonb, 1, $g$63$g$, $g$[]$g$::jsonb, $g$Raddoppia il numero e aggiungi 1.$g$, null, null, $g$Ogni numero è il doppio del precedente più 1: 31 × 2 + 1 = 63.$g$),
  ($g$indizi-f-01$g$, $g$ruota$g$, $g$indizi$g$, $g$indovinelli$g$, $g$facile$g$, $g$Di che cosa si tratta?$g$, $g$["È un animale.","Ha il collo lunghissimo.","Vive nella savana africana."]$g$::jsonb, $g$["Giraffa","Zebra","Elefante","Leone"]$g$::jsonb, 0, $g$Giraffa$g$, $g$[]$g$::jsonb, $g$Arriva a mangiare le foglie in cima agli alberi senza fatica.$g$, null, null, $g$La giraffa è l'animale più alto del mondo, grazie al suo collo lunghissimo.$g$),
  ($g$indizi-f-02$g$, $g$ruota$g$, $g$indizi$g$, $g$cultura$g$, $g$facile$g$, $g$Di che cosa si tratta?$g$, $g$["È un monumento di Roma.","Ospitava i combattimenti dei gladiatori."]$g$::jsonb, $g$["Pantheon","Colosseo","Circo Massimo","Fontana di Trevi"]$g$::jsonb, 1, $g$Colosseo$g$, $g$[]$g$::jsonb, $g$È un grande anfiteatro ovale, oggi in parte crollato.$g$, null, null, $g$Il Colosseo, o Anfiteatro Flavio, ospitava i giochi dei gladiatori. Il Circo Massimo era per le corse dei carri.$g$),
  ($g$indizi-f-03$g$, $g$ruota$g$, $g$indizi$g$, $g$pop$g$, $g$facile$g$, $g$Di chi si tratta?$g$, $g$["È un personaggio delle fiabe.","Gli cresce il naso quando dice una bugia."]$g$::jsonb, $g$["Geppetto","Peter Pan","Pinocchio","Lucignolo"]$g$::jsonb, 2, $g$Pinocchio$g$, $g$[]$g$::jsonb, $g$È un burattino di legno, nato dalla penna di Collodi.$g$, null, null, $g$Pinocchio, il burattino di Carlo Collodi, si allunga il naso a ogni bugia.$g$),
  ($g$indizi-f-04$g$, $g$ruota$g$, $g$indizi$g$, $g$cultura$g$, $g$facile$g$, $g$Di che cosa si tratta?$g$, $g$["È un piatto tipico napoletano.","Ha pomodoro, mozzarella e basilico.","Si cuoce nel forno."]$g$::jsonb, $g$["Lasagne","Pizza marinara","Spaghetti allo scoglio","Pizza Margherita"]$g$::jsonb, 3, $g$Pizza Margherita$g$, $g$[]$g$::jsonb, $g$Porta il nome di una regina e ha i colori della bandiera.$g$, null, null, $g$La pizza Margherita ha pomodoro, mozzarella e basilico. La marinara non ha la mozzarella.$g$),
  ($g$indizi-f-05$g$, $g$ruota$g$, $g$indizi$g$, $g$cultura$g$, $g$facile$g$, $g$Di che cosa si tratta?$g$, $g$["È un pianeta.","È famoso per i suoi anelli.","È il secondo più grande del Sistema solare."]$g$::jsonb, $g$["Saturno","Giove","Urano","Nettuno"]$g$::jsonb, 0, $g$Saturno$g$, $g$[]$g$::jsonb, $g$Il più grande di tutti è Giove: questo viene subito dopo.$g$, null, null, $g$Saturno è il secondo pianeta per grandezza dopo Giove ed è celebre per i suoi anelli.$g$),
  ($g$indizi-f-06$g$, $g$ruota$g$, $g$indizi$g$, $g$pop$g$, $g$facile$g$, $g$Di che cosa si tratta?$g$, $g$["È uno sport con racchetta e pallina.","Il torneo più famoso si gioca sull'erba di Wimbledon."]$g$::jsonb, $g$["Badminton","Tennis","Ping pong","Squash"]$g$::jsonb, 1, $g$Tennis$g$, $g$[]$g$::jsonb, $g$I punti si contano 15, 30, 40.$g$, null, null, $g$Wimbledon è il torneo di tennis più antico e famoso, giocato sui prati di Londra.$g$),
  ($g$indizi-f-07$g$, $g$ruota$g$, $g$indizi$g$, $g$indovinelli$g$, $g$facile$g$, $g$Di che cosa si tratta?$g$, $g$["È uno strumento musicale con tasti bianchi e neri.","Dentro, dei martelletti colpiscono le corde.","Di solito ha 88 tasti."]$g$::jsonb, $g$["Fisarmonica","Organo","Pianoforte","Arpa"]$g$::jsonb, 2, $g$Pianoforte$g$, $g$[]$g$::jsonb, $g$Il suo nome dice che può suonare sia piano sia forte.$g$, null, null, $g$Nel pianoforte i tasti azionano martelletti che colpiscono le corde. Organo e fisarmonica usano l'aria.$g$),
  ($g$indizi-f-08$g$, $g$ruota$g$, $g$indizi$g$, $g$pop$g$, $g$facile$g$, $g$Di chi si tratta?$g$, $g$["È un idraulico dei videogiochi.","Ha baffi, cappello rosso e salopette.","Suo fratello si chiama Luigi."]$g$::jsonb, $g$["Wario","Sonic","Toad","Mario"]$g$::jsonb, 3, $g$Mario$g$, $g$[]$g$::jsonb, $g$Salta sui funghi e salva la principessa Peach.$g$, null, null, $g$Super Mario, con il fratello Luigi, è l'idraulico più famoso dei videogiochi.$g$),
  ($g$indizi-d-01$g$, $g$ruota$g$, $g$indizi$g$, $g$cultura$g$, $g$difficile$g$, $g$Di chi si tratta?$g$, $g$["Era un genio del Rinascimento.","Ha dipinto l'Ultima Cena a Milano.","Progettava macchine volanti."]$g$::jsonb, $g$["Michelangelo","Raffaello","Leonardo da Vinci","Botticelli"]$g$::jsonb, 2, $g$Leonardo da Vinci$g$, $g$[]$g$::jsonb, $g$Ha dipinto anche la Gioconda.$g$, null, null, $g$Leonardo da Vinci dipinse l'Ultima Cena (Cenacolo) a Santa Maria delle Grazie e studiò il volo.$g$),
  ($g$indizi-d-02$g$, $g$ruota$g$, $g$indizi$g$, $g$cultura$g$, $g$difficile$g$, $g$Di che cosa si tratta?$g$, $g$["È un metallo prezioso.","Il suo simbolo chimico è Au.","È la medaglia del primo classificato."]$g$::jsonb, $g$["Argento","Oro","Rame","Platino"]$g$::jsonb, 1, $g$Oro$g$, $g$[]$g$::jsonb, $g$Il simbolo viene dal latino «aurum».$g$, null, null, $g$L'oro ha simbolo Au, dal latino aurum. L'argento è Ag, il rame Cu, il platino Pt.$g$),
  ($g$indizi-d-03$g$, $g$ruota$g$, $g$indizi$g$, $g$cultura$g$, $g$difficile$g$, $g$Di che città si tratta?$g$, $g$["È una città toscana.","È attraversata dall'Arno.","Ha un campanile famoso perché pende."]$g$::jsonb, $g$["Firenze","Arezzo","Lucca","Pisa"]$g$::jsonb, 3, $g$Pisa$g$, $g$[]$g$::jsonb, $g$Il campanile si trova in Piazza dei Miracoli.$g$, null, null, $g$Pisa è sull'Arno, come Firenze, ma solo Pisa ha la Torre pendente in Piazza dei Miracoli.$g$),
  ($g$indizi-d-04$g$, $g$ruota$g$, $g$indizi$g$, $g$cultura$g$, $g$difficile$g$, $g$Di chi si tratta?$g$, $g$["Era uno scienziato nato a Pisa.","Puntò il cannocchiale verso Giove.","Scoprì quattro dei suoi satelliti."]$g$::jsonb, $g$["Galileo Galilei","Copernico","Keplero","Isaac Newton"]$g$::jsonb, 0, $g$Galileo Galilei$g$, $g$[]$g$::jsonb, $g$Quei quattro satelliti oggi si chiamano «galileiani».$g$, null, null, $g$Galileo Galilei, nato a Pisa nel 1564, scoprì nel 1610 Io, Europa, Ganimede e Callisto.$g$),
  ($g$indizi-d-05$g$, $g$ruota$g$, $g$indizi$g$, $g$cultura$g$, $g$difficile$g$, $g$Di chi si tratta?$g$, $g$["È un compositore italiano dell'Ottocento.","È nato vicino a Busseto, in provincia di Parma.","Ha scritto Aida e La traviata."]$g$::jsonb, $g$["Puccini","Rossini","Verdi","Vivaldi"]$g$::jsonb, 2, $g$Verdi$g$, $g$[]$g$::jsonb, $g$Il suo nome di battesimo era Giuseppe.$g$, null, null, $g$Giuseppe Verdi nacque alle Roncole di Busseto nel 1813 e compose Aida, La traviata e Rigoletto.$g$),
  ($g$indizi-d-06$g$, $g$ruota$g$, $g$indizi$g$, $g$cultura$g$, $g$difficile$g$, $g$Di che cosa si tratta?$g$, $g$["È una lingua.","È la lingua ufficiale del Brasile.","Si parla anche in Angola e Mozambico."]$g$::jsonb, $g$["Spagnolo","Portoghese","Francese","Inglese"]$g$::jsonb, 1, $g$Portoghese$g$, $g$[]$g$::jsonb, $g$È la lingua di Lisbona.$g$, null, null, $g$Il portoghese è la lingua ufficiale di Portogallo, Brasile, Angola e Mozambico.$g$),
  ($g$indizi-d-07$g$, $g$ruota$g$, $g$indizi$g$, $g$cultura$g$, $g$difficile$g$, $g$Di che cosa si tratta?$g$, $g$["È un organo del corpo umano.","Si trova in alto a destra nell'addome.","Produce la bile."]$g$::jsonb, $g$["Polmone","Stomaco","Pancreas","Fegato"]$g$::jsonb, 3, $g$Fegato$g$, $g$[]$g$::jsonb, $g$Quello d'oca diventa il foie gras.$g$, null, null, $g$Il fegato, nella parte alta destra dell'addome, produce la bile che serve a digerire i grassi.$g$),
  ($g$indizi-d-08$g$, $g$ruota$g$, $g$indizi$g$, $g$pop$g$, $g$difficile$g$, $g$Di chi si tratta?$g$, $g$["È un ciclista italiano.","Era soprannominato «il Campionissimo».","Il suo grande rivale era Gino Bartali."]$g$::jsonb, $g$["Fausto Coppi","Felice Gimondi","Marco Pantani","Francesco Moser"]$g$::jsonb, 0, $g$Fausto Coppi$g$, $g$[]$g$::jsonb, $g$Vinse cinque Giri d'Italia tra gli anni '40 e '50.$g$, null, null, $g$Fausto Coppi, «il Campionissimo», vinse 5 Giri d'Italia e 2 Tour de France, sfidando Bartali.$g$),
  ($g$prospettiva-f-01$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$facile$g$, $g$Quante stelle PIENE (★) vedi?$g$, $g$[]$g$::jsonb, $g$["4","5","6","3"]$g$::jsonb, 1, $g$5$g$, $g$[]$g$::jsonb, $g$Conta riga per riga: nella prima riga ce ne sono 2.$g$, null, $g$★ ☆ ★
☆ ★ ★
★ ☆ ☆$g$, $g$Le stelle piene sono 2 nella prima riga, 2 nella seconda e 1 nella terza: 5 in tutto.$g$),
  ($g$prospettiva-f-02$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$facile$g$, $g$Quale riga è diversa dalle altre?$g$, $g$[]$g$::jsonb, $g$["La prima","La seconda","La terza","La quarta"]$g$::jsonb, 2, $g$La terza$g$, $g$[]$g$::jsonb, $g$Cerca un cerchio vuoto in mezzo a quelli pieni.$g$, null, $g$● ● ● ●
● ● ● ●
● ● ○ ●
● ● ● ●$g$, $g$Nella terza riga il terzo cerchio è vuoto: tutte le altre righe sono di cerchi pieni.$g$),
  ($g$prospettiva-f-03$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$facile$g$, $g$Leggi questa parola al contrario, da destra a sinistra. Che cosa ottieni?$g$, $g$[]$g$::jsonb, $g$["MORA","ROMA","ORMA","RAMO"]$g$::jsonb, 1, $g$ROMA$g$, $g$[]$g$::jsonb, $g$Comincia dalla R finale: è una città famosa.$g$, null, $g$AMOR$g$, $g$AMOR letto al contrario è R-O-M-A: ROMA. Le altre parole usano le stesse lettere in un altro ordine.$g$),
  ($g$prospettiva-f-04$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$facile$g$, $g$Capovolgi questo numero (ruotalo di mezzo giro). Che numero vedi?$g$, $g$[]$g$::jsonb, $g$["6","8","9","0"]$g$::jsonb, 2, $g$9$g$, $g$[]$g$::jsonb, $g$Il pancino del numero passa da sotto a sopra.$g$, null, $g$6$g$, $g$Ruotato di 180°, il 6 diventa un 9.$g$),
  ($g$prospettiva-f-05$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$facile$g$, $g$Guardi verso nord. Fai mezzo giro su te stesso. Verso dove guardi ora?$g$, $g$[]$g$::jsonb, $g$["Nord","Est","Ovest","Sud"]$g$::jsonb, 3, $g$Sud$g$, $g$[]$g$::jsonb, $g$Mezzo giro significa voltarsi completamente: guardi dalla parte opposta.$g$, null, $g$   N
O  +  E
   S$g$, $g$Mezzo giro è una rotazione di 180°: dal nord si passa al punto opposto, il sud.$g$),
  ($g$prospettiva-f-06$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$facile$g$, $g$Quanti quadrati NERI (■) vedi?$g$, $g$[]$g$::jsonb, $g$["5","7","8","6"]$g$::jsonb, 3, $g$6$g$, $g$[]$g$::jsonb, $g$Ogni riga ne ha lo stesso numero.$g$, null, $g$■ □ ■ □
□ ■ □ ■
■ ■ □ □$g$, $g$Ci sono 2 quadrati neri in ogni riga, per 3 righe: 6 in tutto.$g$),
  ($g$prospettiva-f-07$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$facile$g$, $g$Quale di queste lettere resta UGUALE riflessa in uno specchio (destra e sinistra scambiate)?$g$, $g$[]$g$::jsonb, $g$["A","F","R","S"]$g$::jsonb, 0, $g$A$g$, $g$[]$g$::jsonb, $g$Cerca la lettera che ha la metà sinistra uguale alla metà destra.$g$, null, null, $g$La A è simmetrica rispetto a una linea verticale, quindi allo specchio resta A. F, R e S si rovesciano.$g$),
  ($g$prospettiva-f-08$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$facile$g$, $g$In quale riga c'è una freccia girata al contrario?$g$, $g$[]$g$::jsonb, $g$["Prima","Seconda","Terza","Nessuna"]$g$::jsonb, 0, $g$Prima$g$, $g$[]$g$::jsonb, $g$Guarda in alto.$g$, null, $g$→ → ← →
→ → → →
→ → → →$g$, $g$Nella prima riga la terza freccia punta a sinistra; tutte le altre puntano a destra.$g$),
  ($g$prospettiva-d-01$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$difficile$g$, $g$Un orologio a lancette segna le 2:00. Che ora sembra segnare riflesso in uno specchio?$g$, $g$[]$g$::jsonb, $g$["10:00","2:00","8:00","4:00"]$g$::jsonb, 0, $g$10:00$g$, $g$[]$g$::jsonb, $g$Lo specchio scambia destra e sinistra: le 3 diventano le 9.$g$, null, null, $g$Allo specchio la lancetta delle ore passa dal lato destro al sinistro: 12 − 2 = 10, quindi le 10:00.$g$),
  ($g$prospettiva-d-02$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$difficile$g$, $g$Quale di questi numeri, capovolto (ruotato di 180°), resta identico?$g$, $g$[]$g$::jsonb, $g$["86","96","66","98"]$g$::jsonb, 1, $g$96$g$, $g$[]$g$::jsonb, $g$Capovolgendo si invertono anche le cifre di posto, e il 6 diventa 9.$g$, null, null, $g$Ruotando 96, il 6 diventa 9 e va davanti, il 9 diventa 6 e va dietro: si legge ancora 96.$g$),
  ($g$prospettiva-d-03$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$difficile$g$, $g$Quanti triangoli ci sono in tutto, pieni (▲) e vuoti (△)?$g$, $g$[]$g$::jsonb, $g$["8","9","10","12"]$g$::jsonb, 2, $g$10$g$, $g$[]$g$::jsonb, $g$I triangoli pieni sono 6.$g$, null, $g$▲ ● △ ▲
● ▲ ■ △
▲ △ ● ▲
■ ▲ △ ●$g$, $g$Ci sono 6 triangoli pieni e 4 vuoti: 10 triangoli in tutto.$g$),
  ($g$prospettiva-d-04$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$difficile$g$, $g$Guardi verso nord. Giri di 90° a destra, poi di 180°. Verso dove guardi ora?$g$, $g$[]$g$::jsonb, $g$["Nord","Est","Sud","Ovest"]$g$::jsonb, 3, $g$Ovest$g$, $g$[]$g$::jsonb, $g$Dopo il primo giro a destra guardi a est.$g$, null, $g$   N
O  +  E
   S$g$, $g$Da nord, 90° a destra porta a est; un giro di 180° porta al lato opposto, l'ovest.$g$),
  ($g$prospettiva-d-05$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$difficile$g$, $g$Quale parola, scritta in stampatello e riflessa in uno specchio, si legge identica?$g$, $g$[]$g$::jsonb, $g$["ANNA","OTTO","ESSE","RADAR"]$g$::jsonb, 1, $g$OTTO$g$, $g$[]$g$::jsonb, $g$Servono due cose: lettere simmetriche e una parola che si legge uguale nei due versi.$g$, null, null, $g$OTTO è palindroma e O e T sono simmetriche. In ANNA e RADAR le N e le R allo specchio si rovesciano.$g$),
  ($g$prospettiva-d-06$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$difficile$g$, $g$Una sola riga ha i simboli in un ordine diverso. Quale?$g$, $g$[]$g$::jsonb, $g$["Riga A","Riga B","Riga C","Riga D"]$g$::jsonb, 2, $g$Riga C$g$, $g$[]$g$::jsonb, $g$Guarda gli ultimi due simboli di ogni riga.$g$, null, $g$A ◆◇◆◇◆◇
B ◆◇◆◇◆◇
C ◆◇◆◇◇◆
D ◆◇◆◇◆◇$g$, $g$Le righe alternano pieno e vuoto. Nella riga C gli ultimi due simboli sono invertiti.$g$),
  ($g$prospettiva-d-07$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$difficile$g$, $g$Quanti cerchi pieni (●) ci sono in più rispetto ai cerchi vuoti (○)?$g$, $g$[]$g$::jsonb, $g$["3","2","4","5"]$g$::jsonb, 0, $g$3$g$, $g$[]$g$::jsonb, $g$I cerchi sono 15 in tutto: contane uno dei due tipi e ricavi l'altro.$g$, null, $g$● ○ ● ○ ●
○ ● ○ ●
● ○ ●
○ ●
●$g$, $g$I cerchi pieni sono 9 e quelli vuoti 6: 9 − 6 = 3.$g$),
  ($g$prospettiva-d-08$g$, $g$ruota$g$, $g$prospettiva$g$, $g$osservazione$g$, $g$difficile$g$, $g$Quale parola, scritta in stampatello e capovolta (ruotata di 180°), si legge identica?$g$, $g$[]$g$::jsonb, $g$["ORSO","OTTO","ANNA","OSSO"]$g$::jsonb, 3, $g$OSSO$g$, $g$[]$g$::jsonb, $g$Le lettere O e S restano uguali anche a testa in giù.$g$, null, null, $g$OSSO capovolto si legge ancora OSSO: O e S ruotate restano uguali. T, R, N e A no.$g$),
  ($g$fp-f-01$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$facile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Si apre quando piove","Ha un manico","Si chiude e si porta con sé","Si indossa ai piedi"]$g$::jsonb, null, null, $g$OMBRELLO$g$, $g$["ombrelli","un ombrello","l'ombrello"]$g$::jsonb, null, 3, null, $g$Si apre con la pioggia, ha un manico e si richiude: è l'ombrello. «Si indossa ai piedi» porta agli stivali.$g$),
  ($g$fp-f-02$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$facile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Si beve con la cannuccia","Si mangia nel cono","Ha tanti gusti diversi","Al sole si scioglie"]$g$::jsonb, null, null, $g$GELATO$g$, $g$["gelati","un gelato","il gelato"]$g$::jsonb, null, 0, null, $g$Cono, tanti gusti, si scioglie al sole: è il gelato. «Si beve con la cannuccia» porta al frullato.$g$),
  ($g$fp-f-03$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$facile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Abbaia","Fa le fusa","È il migliore amico dell'uomo","Scodinzola"]$g$::jsonb, null, null, $g$CANE$g$, $g$["cani","un cane","il cane"]$g$::jsonb, null, 1, null, $g$Abbaia, scodinzola ed è il migliore amico dell'uomo: è il cane. Le fusa le fa il gatto.$g$),
  ($g$fp-f-04$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$facile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["È bianca e fredda","Ci si fanno i pupazzi","Cade a gocce","Ci si scia sopra"]$g$::jsonb, null, null, $g$NEVE$g$, $g$["la neve"]$g$::jsonb, null, 2, null, $g$Bianca, fredda, ci si fanno i pupazzi e si scia: è la neve, che cade a fiocchi. A gocce cade la pioggia.$g$),
  ($g$fp-f-05$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$facile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Viaggia sui binari","Si ferma in stazione","Ha diversi vagoni","Decolla dalla pista"]$g$::jsonb, null, null, $g$TRENO$g$, $g$["treni","un treno","il treno"]$g$::jsonb, null, 3, null, $g$Binari, stazione e vagoni: è il treno. «Decolla dalla pista» porta all'aereo.$g$),
  ($g$fp-f-06$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$facile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Ha le fasi, come quella piena","È una stella","Sorge a est","Ci scalda di giorno"]$g$::jsonb, null, null, $g$SOLE$g$, $g$["il sole"]$g$::jsonb, null, 0, null, $g$È una stella, sorge a est e ci scalda: è il Sole. Le fasi, come la luna piena, sono della Luna.$g$),
  ($g$fp-f-07$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$facile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Napoli ne è la patria","Si scola dopo la cottura","Si cuoce nel forno a legna","La Margherita è la più famosa"]$g$::jsonb, null, null, $g$PIZZA$g$, $g$["pizze","la pizza","una pizza"]$g$::jsonb, null, 1, null, $g$Napoli, forno a legna, Margherita: è la pizza. «Si scola dopo la cottura» porta alla pasta.$g$),
  ($g$fp-f-08$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$facile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["L'acqua è salata","Ci sono le onde","D'estate ci si va in vacanza","Ha una vetta coperta di neve"]$g$::jsonb, null, null, $g$MARE$g$, $g$["il mare","al mare"]$g$::jsonb, null, 3, null, $g$Acqua salata, onde e vacanze estive: è il mare. La vetta innevata porta alla montagna.$g$),
  ($g$fp-f-09$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$facile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Ci sono undici giocatori per squadra","Il portiere può usare le mani","Si segna lanciando nel canestro","Si gioca su un campo d'erba"]$g$::jsonb, null, null, $g$CALCIO$g$, $g$["il calcio"]$g$::jsonb, null, 2, null, $g$Undici per squadra, il portiere con le mani, il campo d'erba: è il calcio. Il canestro porta alla pallacanestro.$g$),
  ($g$fp-f-10$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$facile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Ci sono i banchi e la lavagna","Ci vanno i malati per farsi curare","Suona la campanella","Ci sono le interrogazioni"]$g$::jsonb, null, null, $g$SCUOLA$g$, $g$["la scuola","scuole"]$g$::jsonb, null, 1, null, $g$Banchi, lavagna, campanella e interrogazioni: è la scuola. I malati da curare portano all'ospedale.$g$),
  ($g$fp-d-01$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$difficile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Ha il piumaggio bianco e nero","Non sa volare","Vive al Polo Nord","Nuota benissimo sott'acqua"]$g$::jsonb, null, null, $g$PINGUINO$g$, $g$["pinguini","il pinguino","un pinguino"]$g$::jsonb, null, 2, null, $g$Bianco e nero, non vola, nuota benissimo: è il pinguino, che vive nell'emisfero sud. Al Polo Nord vive l'orso polare.$g$),
  ($g$fp-d-02$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$difficile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Si attraversa in gondola","Ha il Ponte di Rialto","Il suo Carnevale è famoso per le maschere","Ha il Ponte Vecchio sull'Arno"]$g$::jsonb, null, null, $g$VENEZIA$g$, $g$["la serenissima"]$g$::jsonb, null, 3, null, $g$Gondole, Rialto e Carnevale: è Venezia. Il Ponte Vecchio sull'Arno porta a Firenze.$g$),
  ($g$fp-d-03$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$difficile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["È il pianeta rosso","Ha le fasi","Influenza le maree","Armstrong ci camminò nel 1969"]$g$::jsonb, null, null, $g$LUNA$g$, $g$["la luna"]$g$::jsonb, null, 0, null, $g$Fasi, maree e lo sbarco del 1969: è la Luna. Il pianeta rosso è Marte.$g$),
  ($g$fp-d-04$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$difficile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Si beve in tazzina","Si prepara lasciando le foglie in infusione","Al bar lo chiedi ristretto o macchiato","Contiene caffeina"]$g$::jsonb, null, null, $g$CAFFÈ$g$, $g$["caffe","caffe'","un caffè","un caffe","il caffè","espresso"]$g$::jsonb, null, 1, null, $g$Tazzina, ristretto o macchiato, caffeina: è il caffè. Le foglie in infusione portano al tè.$g$),
  ($g$fp-d-05$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$difficile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Nacque a Firenze nel 1265","Morì in esilio a Ravenna","Cantò il suo amore per Laura","Amava Beatrice"]$g$::jsonb, null, null, $g$DANTE$g$, $g$["dante alighieri","alighieri"]$g$::jsonb, null, 2, null, $g$Firenze 1265, esilio e morte a Ravenna, Beatrice: è Dante Alighieri. Laura era l'amata di Petrarca.$g$),
  ($g$fp-d-06$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$difficile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Si assegna la Coppa del Mondo di calcio","Il simbolo è formato da cinque cerchi","Si svolgono ogni quattro anni","Nell'antichità si svolgevano in Grecia"]$g$::jsonb, null, null, $g$OLIMPIADI$g$, $g$["olimpiade","le olimpiadi","giochi olimpici"]$g$::jsonb, null, 0, null, $g$Cinque cerchi, ogni quattro anni, origini greche: sono le Olimpiadi. La Coppa del Mondo è dei Mondiali di calcio.$g$),
  ($g$fp-d-07$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$difficile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Domina il golfo di Napoli","Si trova in Sicilia","Seppellì Pompei nel 79 d.C.","È un vulcano"]$g$::jsonb, null, null, $g$VESUVIO$g$, $g$["il vesuvio"]$g$::jsonb, null, 1, null, $g$Vulcano sul golfo di Napoli che seppellì Pompei: è il Vesuvio. In Sicilia c'è l'Etna.$g$),
  ($g$fp-d-08$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$difficile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["L'ha scritto Shakespeare","È il principe di Danimarca","Lo si ricorda con un teschio in mano","Muore insieme alla sua amata Giulietta"]$g$::jsonb, null, null, $g$AMLETO$g$, $g$["hamlet"]$g$::jsonb, null, 3, null, $g$Shakespeare, principe di Danimarca, il teschio: è Amleto. Chi muore con Giulietta è Romeo.$g$),
  ($g$fp-d-09$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$difficile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Divenne completamente sordo","Nacque a Salisburgo","Era un bambino prodigio","Compose Il flauto magico"]$g$::jsonb, null, null, $g$MOZART$g$, $g$["wolfgang amadeus mozart","amadeus mozart"]$g$::jsonb, null, 0, null, $g$Salisburgo, bambino prodigio, Il flauto magico: è Mozart. Il compositore diventato sordo è Beethoven.$g$),
  ($g$fp-d-10$g$, $g$falsa_pista$g$, null, $g$indovinelli$g$, $g$difficile$g$, $g$Tre indizi portano alla stessa soluzione, uno è una falsa pista.$g$, $g$["Si trova nell'Himalaya","Fu scalato per la prima volta nel 1953","È la vetta più alta delle Alpi","Nessuna montagna al mondo è più alta"]$g$::jsonb, null, null, $g$EVEREST$g$, $g$["monte everest","l'everest"]$g$::jsonb, null, 2, null, $g$Himalaya, prima scalata nel 1953, la più alta del mondo: è l'Everest. La vetta più alta delle Alpi è il Monte Bianco.$g$),
  ($g$cl-f-01$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$facile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["BANANA","CANARINO","LIMONE"]$g$::jsonb, null, null, $g$GIALLO$g$, $g$["il giallo","colore giallo","gialli"]$g$::jsonb, $g$È il colore del sole nei disegni dei bambini.$g$, null, null, $g$Banana, canarino e limone sono gialli.$g$),
  ($g$cl-f-02$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$facile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["RE","REGINA","ALFIERE"]$g$::jsonb, null, null, $g$SCACCHI$g$, $g$["gli scacchi","gioco degli scacchi"]$g$::jsonb, $g$Si gioca su 64 caselle bianche e nere.$g$, null, null, $g$Re, regina e alfiere sono pezzi degli scacchi.$g$),
  ($g$cl-f-03$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$facile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["FORCHETTA","COLTELLO","CUCCHIAIO"]$g$::jsonb, null, null, $g$POSATE$g$, $g$["posata","le posate"]$g$::jsonb, $g$Si apparecchiano accanto al piatto.$g$, null, null, $g$Forchetta, coltello e cucchiaio sono posate.$g$),
  ($g$cl-f-04$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$facile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["ROMA","PARIGI","MADRID"]$g$::jsonb, null, null, $g$CAPITALI$g$, $g$["capitale","le capitali","capitali europee"]$g$::jsonb, $g$Ognuna è la città più importante del proprio Stato, sede del governo.$g$, null, null, $g$Roma, Parigi e Madrid sono le capitali di Italia, Francia e Spagna.$g$),
  ($g$cl-f-05$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$facile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["PRIMAVERA","ESTATE","AUTUNNO"]$g$::jsonb, null, null, $g$STAGIONI$g$, $g$["stagione","le stagioni","le quattro stagioni"]$g$::jsonb, $g$Ne manca solo una: l'inverno.$g$, null, null, $g$Primavera, estate e autunno sono stagioni: con l'inverno fanno quattro.$g$),
  ($g$cl-f-06$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$facile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["DO","RE","MI"]$g$::jsonb, null, null, $g$NOTE$g$, $g$["nota","le note","note musicali"]$g$::jsonb, $g$Si leggono sul pentagramma.$g$, null, null, $g$Do, re e mi sono le prime tre note musicali.$g$),
  ($g$cl-f-07$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$facile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["LEONE","TIGRE","GHEPARDO"]$g$::jsonb, null, null, $g$FELINI$g$, $g$["felino","i felini","grandi felini","felidi"]$g$::jsonb, $g$Sono parenti selvatici del gatto di casa.$g$, null, null, $g$Leone, tigre e ghepardo sono felini, come il gatto.$g$),
  ($g$cl-f-08$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$facile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["TERRA","MERCURIO","SATURNO"]$g$::jsonb, null, null, $g$PIANETI$g$, $g$["pianeta","i pianeti"]$g$::jsonb, $g$Girano tutti intorno al Sole.$g$, null, null, $g$Terra, Mercurio e Saturno sono pianeti del Sistema solare.$g$),
  ($g$cl-f-09$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$facile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["RIGORE","CORNER","FUORIGIOCO"]$g$::jsonb, null, null, $g$CALCIO$g$, $g$["il calcio"]$g$::jsonb, $g$Si gioca undici contro undici.$g$, null, null, $g$Rigore, calcio d'angolo (corner) e fuorigioco sono situazioni di una partita di calcio.$g$),
  ($g$cl-d-01$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$difficile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["BOTTIGLIA","GIRAFFA","CIGNO"]$g$::jsonb, null, null, $g$COLLO$g$, $g$["il collo","colli"]$g$::jsonb, $g$D'inverno lo copri con la sciarpa.$g$, null, null, $g$Bottiglia, giraffa e cigno hanno tutti un collo, lungo e sottile.$g$),
  ($g$cl-d-02$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$difficile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["COMPUTER","PIANOFORTE","TELECOMANDO"]$g$::jsonb, null, null, $g$TASTI$g$, $g$["tasto","i tasti"]$g$::jsonb, $g$Si premono con le dita.$g$, null, null, $g$Computer, pianoforte e telecomando hanno tutti dei tasti.$g$),
  ($g$cl-d-03$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$difficile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["ZEBRA","TIGRE","CODICE A BARRE"]$g$::jsonb, null, null, $g$STRISCE$g$, $g$["a strisce","righe","a righe","striscia"]$g$::jsonb, $g$Sulle strade le trovi bianche, per far attraversare i pedoni.$g$, null, null, $g$Zebra, tigre e codice a barre sono a strisce.$g$),
  ($g$cl-d-04$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$difficile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["RISTRETTO","MACCHIATO","CORRETTO"]$g$::jsonb, null, null, $g$CAFFÈ$g$, $g$["caffe","caffe'","il caffè","il caffe","espresso"]$g$::jsonb, $g$Al bar si beve in piedi, in una tazzina.$g$, null, null, $g$Ristretto, macchiato e corretto sono modi di ordinare il caffè al bar.$g$),
  ($g$cl-d-05$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$difficile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["RICCIO","CACTUS","ROSA"]$g$::jsonb, null, null, $g$SPINE$g$, $g$["spina","le spine","aculei"]$g$::jsonb, $g$Pungono se le tocchi.$g$, null, null, $g$Riccio, cactus e rosa hanno le spine.$g$),
  ($g$cl-d-06$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$difficile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["NIAGARA","VITTORIA","IGUAZÚ"]$g$::jsonb, null, null, $g$CASCATE$g$, $g$["cascata","le cascate"]$g$::jsonb, $g$L'acqua precipita giù da un salto di roccia.$g$, null, null, $g$Niagara, Vittoria e Iguazú sono tre delle cascate più famose del mondo.$g$),
  ($g$cl-d-07$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$difficile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["ARCOBALENO","NANI","NOTE MUSICALI"]$g$::jsonb, null, null, $g$SETTE$g$, $g$["7"]$g$::jsonb, $g$Sono tanti quanti i giorni della settimana.$g$, null, null, $g$L'arcobaleno ha sette colori, i nani di Biancaneve sono sette e le note musicali sono sette.$g$),
  ($g$cl-d-08$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$difficile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["NERO","MORTO","ROSSO"]$g$::jsonb, null, null, $g$MARE$g$, $g$["mari","il mare","mar"]$g$::jsonb, $g$Ci si fa il bagno d'estate.$g$, null, null, $g$Mar Nero, Mar Morto e Mar Rosso: sono tutti mari.$g$),
  ($g$cl-d-09$g$, $g$collegamento$g$, null, $g$collegamenti$g$, $g$difficile$g$, $g$Qual è il concetto che unisce queste tre parole?$g$, $g$["LANCETTE","QUADRANTE","CINTURINO"]$g$::jsonb, null, null, $g$OROLOGIO$g$, $g$["orologi","un orologio","l'orologio","orologio da polso"]$g$::jsonb, $g$Lo porti al polso per sapere l'ora.$g$, null, null, $g$Lancette, quadrante e cinturino sono parti di un orologio da polso.$g$),
  ($g$fin-intruso-01$g$, $g$finale$g$, $g$intruso$g$, $g$logica$g$, $g$media$g$, $g$Trova l'intruso: BALENA, DELFINO, SQUALO, FOCA$g$, $g$["Tre di questi allattano i loro piccoli.","Uno respira con le branchie.","È un pesce con una pinna dorsale temuta dai bagnanti."]$g$::jsonb, null, null, $g$SQUALO$g$, $g$["lo squalo","squali"]$g$::jsonb, null, null, null, $g$Balena, delfino e foca sono mammiferi. Lo squalo è un pesce e respira con le branchie.$g$),
  ($g$fin-intruso-02$g$, $g$finale$g$, $g$intruso$g$, $g$logica$g$, $g$media$g$, $g$Trova l'intruso: PO, TEVERE, GARDA, ARNO$g$, $g$["Tre di questi scorrono verso il mare.","Uno è uno specchio d'acqua circondato dalla terra.","È il lago più grande d'Italia."]$g$::jsonb, null, null, $g$GARDA$g$, $g$["lago di garda","il garda","benaco"]$g$::jsonb, null, null, null, $g$Po, Tevere e Arno sono fiumi. Il Garda è un lago, il più grande d'Italia.$g$),
  ($g$fin-intruso-03$g$, $g$finale$g$, $g$intruso$g$, $g$logica$g$, $g$difficile$g$, $g$Trova l'intruso: 2, 3, 5, 9, 11$g$, $g$["Quattro di questi sono divisibili solo per 1 e per sé stessi.","L'intruso è un quadrato perfetto.","È il risultato di 3 × 3."]$g$::jsonb, null, null, $g$9$g$, $g$["nove"]$g$::jsonb, null, null, null, $g$2, 3, 5 e 11 sono numeri primi. 9 = 3 × 3 non è primo.$g$),
  ($g$fin-intruso-04$g$, $g$finale$g$, $g$intruso$g$, $g$logica$g$, $g$difficile$g$, $g$Trova l'intruso: ROSSINI, VERDI, PUCCINI, BERNINI$g$, $g$["Tre di loro hanno scritto opere liriche.","L'intruso lavorava il marmo.","Ha progettato il colonnato di piazza San Pietro."]$g$::jsonb, null, null, $g$BERNINI$g$, $g$["gian lorenzo bernini","gianlorenzo bernini"]$g$::jsonb, null, null, null, $g$Rossini, Verdi e Puccini erano compositori d'opera. Gian Lorenzo Bernini era scultore e architetto.$g$),
  ($g$fin-intruso-05$g$, $g$finale$g$, $g$intruso$g$, $g$logica$g$, $g$media$g$, $g$Trova l'intruso: GENNAIO, MARZO, GIUGNO, LUGLIO$g$, $g$["Conta i giorni di ciascun mese.","Uno solo non arriva a 31.","Trenta giorni ha novembre, con april, giugno e settembre."]$g$::jsonb, null, null, $g$GIUGNO$g$, $g$[]$g$::jsonb, null, null, null, $g$Gennaio, marzo e luglio hanno 31 giorni. Giugno ne ha 30.$g$),
  ($g$fin-intruso-06$g$, $g$finale$g$, $g$intruso$g$, $g$logica$g$, $g$difficile$g$, $g$Trova l'intruso: ESAGONO, CUBO, PENTAGONO, TRIANGOLO$g$, $g$["Tre sono figure piane: stanno tutte su un foglio.","L'intruso è un solido e ha un volume.","Ha sei facce, come un dado."]$g$::jsonb, null, null, $g$CUBO$g$, $g$["il cubo"]$g$::jsonb, null, null, null, $g$Esagono, pentagono e triangolo sono poligoni piani. Il cubo è un solido con sei facce.$g$),
  ($g$fin-sequenza-01$g$, $g$finale$g$, $g$sequenza$g$, $g$logica$g$, $g$media$g$, $g$Completa la sequenza: 3, 6, 12, 24, ?$g$, $g$["Ogni numero dipende solo da quello prima.","Si moltiplica sempre per lo stesso numero.","Raddoppia l'ultimo numero."]$g$::jsonb, null, null, $g$48$g$, $g$["quarantotto"]$g$::jsonb, null, null, null, $g$Ogni numero è il doppio del precedente: 24 × 2 = 48.$g$),
  ($g$fin-sequenza-02$g$, $g$finale$g$, $g$sequenza$g$, $g$logica$g$, $g$media$g$, $g$Completa la sequenza: GENNAIO, APRILE, LUGLIO, ?$g$, $g$["Tra un elemento e l'altro passa sempre lo stesso tempo.","Ogni volta si va avanti di tre mesi.","È il primo mese dell'ultimo trimestre dell'anno."]$g$::jsonb, null, null, $g$OTTOBRE$g$, $g$[]$g$::jsonb, null, null, null, $g$Si avanza di tre mesi: gennaio, aprile, luglio, ottobre.$g$),
  ($g$fin-sequenza-03$g$, $g$finale$g$, $g$sequenza$g$, $g$logica$g$, $g$media$g$, $g$Completa la sequenza: 1, 4, 9, 16, 25, ?$g$, $g$["Ogni numero è un numero moltiplicato per sé stesso.","1×1, 2×2, 3×3, 4×4, 5×5…","Calcola 6 × 6."]$g$::jsonb, null, null, $g$36$g$, $g$["trentasei"]$g$::jsonb, null, null, null, $g$Sono i quadrati dei numeri da 1 in su: dopo 5 × 5 = 25 viene 6 × 6 = 36.$g$),
  ($g$fin-sequenza-04$g$, $g$finale$g$, $g$sequenza$g$, $g$logica$g$, $g$difficile$g$, $g$Completa la sequenza: 2, 6, 12, 20, 30, ?$g$, $g$["Guarda di quanto cresce ogni numero rispetto al precedente.","Gli aumenti sono +4, +6, +8, +10…","Aggiungi 12 a 30."]$g$::jsonb, null, null, $g$42$g$, $g$["quarantadue"]$g$::jsonb, null, null, null, $g$Gli aumenti crescono di 2 (+4, +6, +8, +10, +12): 30 + 12 = 42. È anche 6 × 7.$g$),
  ($g$fin-sequenza-05$g$, $g$finale$g$, $g$sequenza$g$, $g$logica$g$, $g$difficile$g$, $g$Completa la sequenza: I, V, X, L, C, ?$g$, $g$["Sono simboli della numerazione degli antichi Romani.","Valgono 1, 5, 10, 50, 100…","Il prossimo simbolo vale 500."]$g$::jsonb, null, null, $g$D$g$, $g$[]$g$::jsonb, null, null, null, $g$I simboli romani in ordine di valore: I=1, V=5, X=10, L=50, C=100, D=500 (poi M=1000).$g$),
  ($g$fin-sequenza-06$g$, $g$finale$g$, $g$sequenza$g$, $g$logica$g$, $g$media$g$, $g$Completa la sequenza: 1, 2, 4, 7, 11, ?$g$, $g$["Guarda di quanto cresce ogni volta.","Si aggiunge 1, poi 2, poi 3, poi 4…","Aggiungi 5 a 11."]$g$::jsonb, null, null, $g$16$g$, $g$["sedici"]$g$::jsonb, null, null, null, $g$Gli aumenti crescono di 1 (+1, +2, +3, +4, +5): 11 + 5 = 16.$g$),
  ($g$fin-indizi-01$g$, $g$finale$g$, $g$indizi$g$, $g$logica$g$, $g$media$g$, $g$Che cos'è?$g$, $g$["Ha un ago, ma non cuce.","Ti aiuta se ti perdi.","Il suo ago punta sempre verso nord."]$g$::jsonb, null, null, $g$BUSSOLA$g$, $g$["una bussola","la bussola","bussole"]$g$::jsonb, null, null, null, $g$La bussola ha un ago magnetico che si orienta verso il nord: serve per orientarsi.$g$),
  ($g$fin-indizi-02$g$, $g$finale$g$, $g$indizi$g$, $g$logica$g$, $g$difficile$g$, $g$Chi è?$g$, $g$["È una scienziata nata a Varsavia.","Ha vinto due premi Nobel, in fisica e in chimica.","Scoprì il polonio e il radio insieme al marito Pierre."]$g$::jsonb, null, null, $g$MARIE CURIE$g$, $g$["curie","madame curie","maria curie","maria sklodowska","marie sklodowska curie"]$g$::jsonb, null, null, null, $g$Marie Curie vinse il Nobel per la fisica nel 1903 e per la chimica nel 1911.$g$),
  ($g$fin-indizi-03$g$, $g$finale$g$, $g$indizi$g$, $g$logica$g$, $g$difficile$g$, $g$Che città è?$g$, $g$["Fu la prima capitale del Regno d'Italia.","È attraversata dal Po.","Il suo simbolo è la Mole Antonelliana."]$g$::jsonb, null, null, $g$TORINO$g$, $g$[]$g$::jsonb, null, null, null, $g$Torino fu capitale d'Italia dal 1861 al 1865, prima di Firenze e Roma. Il suo simbolo è la Mole Antonelliana.$g$),
  ($g$fin-indizi-04$g$, $g$finale$g$, $g$indizi$g$, $g$logica$g$, $g$media$g$, $g$Che cos'è?$g$, $g$["Ha tanti denti, ma non morde.","Passa ogni giorno tra i capelli.","Lo usi davanti allo specchio per sistemarti la chioma."]$g$::jsonb, null, null, $g$PETTINE$g$, $g$["un pettine","il pettine","pettini"]$g$::jsonb, null, null, null, $g$Il pettine ha i denti e serve a pettinare i capelli.$g$),
  ($g$fin-indizi-05$g$, $g$finale$g$, $g$indizi$g$, $g$logica$g$, $g$media$g$, $g$Chi è?$g$, $g$["Era un navigatore genovese.","Partì dalla Spagna nel 1492 cercando le Indie.","Le sue navi erano la Niña, la Pinta e la Santa Maria."]$g$::jsonb, null, null, $g$CRISTOFORO COLOMBO$g$, $g$["colombo","cristoforo colombo"]$g$::jsonb, null, null, null, $g$Cristoforo Colombo partì da Palos nel 1492 e raggiunse le Americhe credendo di essere nelle Indie.$g$),
  ($g$fin-indizi-06$g$, $g$finale$g$, $g$indizi$g$, $g$logica$g$, $g$difficile$g$, $g$Che animale è?$g$, $g$["È il più grande animale vivente.","Si nutre di minuscoli crostacei, il krill.","È un cetaceo dal colore grigio-azzurro."]$g$::jsonb, null, null, $g$BALENOTTERA AZZURRA$g$, $g$["balena azzurra","balenottera blu","balena blu"]$g$::jsonb, null, null, null, $g$La balenottera azzurra può superare i 25 metri ed è il più grande animale vivente. Mangia krill.$g$),
  ($g$fin-prospettiva-01$g$, $g$finale$g$, $g$prospettiva$g$, $g$logica$g$, $g$media$g$, $g$Quanti quadrati NERI (■) vedi?$g$, $g$["Conta solo i quadrati pieni.","Sono disposti come i puntini di una faccia del dado.","Uno per ogni angolo, più quello al centro."]$g$::jsonb, null, null, $g$5$g$, $g$["cinque"]$g$::jsonb, null, null, $g$■ □ ■
□ ■ □
■ □ ■$g$, $g$Ci sono 4 quadrati neri agli angoli e 1 al centro: 5 in tutto.$g$),
  ($g$fin-prospettiva-02$g$, $g$finale$g$, $g$prospettiva$g$, $g$logica$g$, $g$media$g$, $g$Leggi questa parola al contrario, da destra a sinistra. Che parola ottieni?$g$, $g$["Comincia dall'ultima lettera.","È un dolce.","Sopra si spengono le candeline."]$g$::jsonb, null, null, $g$TORTA$g$, $g$["una torta","la torta","torte"]$g$::jsonb, null, null, $g$ATROT$g$, $g$ATROT letto al contrario è T-O-R-T-A: TORTA.$g$),
  ($g$fin-prospettiva-03$g$, $g$finale$g$, $g$prospettiva$g$, $g$logica$g$, $g$difficile$g$, $g$Visto in uno specchio, un orologio a lancette sembra segnare le 4 in punto. Che ore sono davvero? (scrivi solo l'ora)$g$, $g$["Lo specchio scambia destra e sinistra.","Le 3 allo specchio sembrano le 9.","Togli 4 da 12."]$g$::jsonb, null, null, $g$8$g$, $g$["otto","le otto","8:00","8.00","08:00","20","20:00"]$g$::jsonb, null, null, null, $g$Allo specchio un orario si legge come 12 meno l'ora vera: 12 − 4 = 8. Sono le 8.$g$),
  ($g$fin-prospettiva-04$g$, $g$finale$g$, $g$prospettiva$g$, $g$logica$g$, $g$difficile$g$, $g$Guardi verso est. Giri a sinistra, poi ancora a sinistra, poi a destra. Verso quale punto cardinale guardi?$g$, $g$["Due svolte a sinistra di fila equivalgono a un mezzo giro.","Dopo le prime due svolte guardi verso ovest.","Da ovest, girando a destra, guardi verso la stella polare."]$g$::jsonb, null, null, $g$NORD$g$, $g$["il nord","settentrione"]$g$::jsonb, null, null, $g$   N
O  +  E
   S$g$, $g$Est, a sinistra nord, ancora a sinistra ovest, poi a destra: nord.$g$),
  ($g$fin-prospettiva-05$g$, $g$finale$g$, $g$prospettiva$g$, $g$logica$g$, $g$media$g$, $g$Capovolgi questo numero (ruotalo di 180°). Che numero leggi?$g$, $g$["Capovolgendo, le due cifre si scambiano anche di posto.","Il 6 a testa in giù diventa un 9.","Ottieni un numero tra 90 e 100."]$g$::jsonb, null, null, $g$98$g$, $g$["novantotto"]$g$::jsonb, null, null, $g$86$g$, $g$Ruotando 86 di mezzo giro, il 6 diventa 9 e passa davanti, l'8 resta 8: si legge 98.$g$),
  ($g$fin-prospettiva-06$g$, $g$finale$g$, $g$prospettiva$g$, $g$logica$g$, $g$difficile$g$, $g$Quante stelle piene (★) ci sono in più rispetto a quelle vuote (☆)?$g$, $g$["Conta le piene, conta le vuote, poi fai la differenza.","In tutto le stelle sono 16.","Le stelle piene sono 9."]$g$::jsonb, null, null, $g$2$g$, $g$["due"]$g$::jsonb, null, null, $g$★ ☆ ★ ★
☆ ★ ☆ ★
★ ★ ☆ ☆
☆ ★ ★ ☆$g$, $g$Le stelle piene sono 9 e quelle vuote 7: 9 − 7 = 2.$g$),
  ($g$tb-01$g$, $g$tabellone$g$, null, $g$Cibo$g$, $g$facile$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$PIZZA MARGHERITA$g$, $g$[]$g$::jsonb, $g$La più classica napoletana, coi colori della bandiera.$g$, null, null, null),
  ($g$tb-02$g$, $g$tabellone$g$, null, $g$Modi di dire$g$, $g$facile$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$IN BOCCA AL LUPO$g$, $g$[]$g$::jsonb, $g$Si augura a chi sta per affrontare un esame.$g$, null, null, null),
  ($g$tb-03$g$, $g$tabellone$g$, null, $g$Natura$g$, $g$facile$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$LA LUNA PIENA$g$, $g$[]$g$::jsonb, $g$Rotonda e luminosa nel cielo notturno.$g$, null, null, null),
  ($g$tb-04$g$, $g$tabellone$g$, null, $g$Luoghi d'Italia$g$, $g$facile$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$LA TORRE DI PISA$g$, $g$[]$g$::jsonb, $g$Pende da secoli in Toscana.$g$, null, null, null),
  ($g$tb-05$g$, $g$tabellone$g$, null, $g$Cinema$g$, $g$facile$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$LA VITA È BELLA$g$, $g$["LA VITA E' BELLA"]$g$::jsonb, $g$Film di Benigni premiato con l'Oscar.$g$, null, null, null),
  ($g$tb-06$g$, $g$tabellone$g$, null, $g$Proverbi$g$, $g$facile$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$TRA IL DIRE E IL FARE$g$, $g$[]$g$::jsonb, $g$Parlare è facile, agire molto meno.$g$, null, null, null),
  ($g$tb-07$g$, $g$tabellone$g$, null, $g$Sport$g$, $g$facile$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$CALCIO DI RIGORE$g$, $g$[]$g$::jsonb, $g$Tiro dagli undici metri.$g$, null, null, null),
  ($g$tb-08$g$, $g$tabellone$g$, null, $g$Modi di dire$g$, $g$facile$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$ACQUA IN BOCCA$g$, $g$[]$g$::jsonb, $g$Mi raccomando, non dirlo a nessuno!$g$, null, null, null),
  ($g$tb-09$g$, $g$tabellone$g$, null, $g$Proverbi$g$, $g$media$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$CHI DORME NON PIGLIA PESCI$g$, $g$[]$g$::jsonb, $g$Se resti a letto, ti sfuggono le occasioni.$g$, null, null, null),
  ($g$tb-10$g$, $g$tabellone$g$, null, $g$Luoghi d'Italia$g$, $g$media$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$LA COSTIERA AMALFITANA$g$, $g$[]$g$::jsonb, $g$Positano, Ravello e limoni a picco sul mare.$g$, null, null, null),
  ($g$tb-11$g$, $g$tabellone$g$, null, $g$Cinema$g$, $g$media$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$NUOVO CINEMA PARADISO$g$, $g$[]$g$::jsonb, $g$Oscar al miglior film straniero per Tornatore.$g$, null, null, null),
  ($g$tb-12$g$, $g$tabellone$g$, null, $g$Canzoni$g$, $g$media$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$NEL BLU DIPINTO DI BLU$g$, $g$[]$g$::jsonb, $g$Trionfò a Sanremo 1958 con Domenico Modugno.$g$, null, null, null),
  ($g$tb-13$g$, $g$tabellone$g$, null, $g$Modi di dire$g$, $g$media$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$AVERE LE MANI IN PASTA$g$, $g$[]$g$::jsonb, $g$Essere coinvolti di persona negli affari.$g$, null, null, null),
  ($g$tb-14$g$, $g$tabellone$g$, null, $g$Sport$g$, $g$media$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$LA FINALE DEI MONDIALI$g$, $g$[]$g$::jsonb, $g$Il match più atteso, ogni quattro anni.$g$, null, null, null),
  ($g$tb-15$g$, $g$tabellone$g$, null, $g$Cibo$g$, $g$media$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$IL PESTO ALLA GENOVESE$g$, $g$[]$g$::jsonb, $g$Basilico, pinoli e parmigiano dalla Liguria.$g$, null, null, null),
  ($g$tb-16$g$, $g$tabellone$g$, null, $g$Natura$g$, $g$media$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$LA NEBBIA IN VAL PADANA$g$, $g$[]$g$::jsonb, $g$Grigia e fitta d'inverno tra Milano e Bologna.$g$, null, null, null),
  ($g$tb-17$g$, $g$tabellone$g$, null, $g$Proverbi$g$, $g$difficile$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$IL MATTINO HA L'ORO IN BOCCA$g$, $g$[]$g$::jsonb, $g$Alzarsi presto conviene.$g$, null, null, null),
  ($g$tb-18$g$, $g$tabellone$g$, null, $g$Cibo$g$, $g$difficile$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$ORECCHIETTE ALLE CIME DI RAPA$g$, $g$[]$g$::jsonb, $g$Primo piatto pugliese con una verdura amarognola.$g$, null, null, null),
  ($g$tb-19$g$, $g$tabellone$g$, null, $g$Modi di dire$g$, $g$difficile$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$PRENDERE DUE PICCIONI CON UNA FAVA$g$, $g$[]$g$::jsonb, $g$Un solo sforzo, un doppio risultato.$g$, null, null, null),
  ($g$tb-20$g$, $g$tabellone$g$, null, $g$Cinema$g$, $g$difficile$g$, $g$$g$, $g$[]$g$::jsonb, null, null, $g$IL BUONO, IL BRUTTO, IL CATTIVO$g$, $g$["IL BUONO IL BRUTTO IL CATTIVO"]$g$::jsonb, $g$Western di Sergio Leone con Clint Eastwood.$g$, null, null, null)
on conflict (slug) do nothing;
