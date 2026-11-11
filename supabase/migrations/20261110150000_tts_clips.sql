-- =====================================================================
-- Voci ElevenLabs: archivio delle battute generate e contabilità caratteri.
-- Ogni battuta è un mp3 nel bucket privato "tts" con chiave
-- sha256(voice_id|model|testo): si paga una volta sola e vale per ogni serata.
-- =====================================================================

create table public.tts_clips (
  cache_key text primary key check (cache_key ~ '^[0-9a-f]{64}$'),
  role text not null check (role in ('professore', 'regina', 'palmino', 'annunciatore')),
  model text not null check (char_length(model) between 1 and 80),
  voice_id text not null check (char_length(voice_id) between 1 and 80),
  text text not null check (char_length(text) between 1 and 1000),
  -- caratteri della battuta
  chars integer not null check (chars >= 0),
  -- caratteri effettivamente addebitati da ElevenLabs (0 per le clip recuperate dalla cache)
  billed_chars integer not null default 0 check (billed_chars >= 0),
  storage_path text not null unique,
  source text not null check (source in ('pregen', 'live', 'sample')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
create index tts_clips_created_idx on public.tts_clips (created_at);
create index tts_clips_role_idx on public.tts_clips (role);

-- Stesse regole delle altre tabelle: RLS attiva, nessun accesso anonimo o
-- autenticato diretto. Tutto passa dal backend (service role / postgres).
alter table public.tts_clips enable row level security;
revoke all on table public.tts_clips from anon, authenticated;

-- Voci, impostazioni per ruolo e budget mensile dell'app (fallback: variabili d'ambiente).
insert into public.application_settings (key, value, description) values
  ('voices', '{"monthlyBudgetChars":50000,"roles":{}}', 'Voci ElevenLabs dei presentatori e budget mensile di caratteri')
on conflict (key) do nothing;

-- Bucket privato delle battute (accesso solo con URL firmati generati dal backend).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts', 'tts', false, 5242880, array['audio/mpeg'])
on conflict (id) do nothing;
