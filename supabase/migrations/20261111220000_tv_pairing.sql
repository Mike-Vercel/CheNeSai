-- ---------------------------------------------------------------------
-- CHE NE SAI?! – Partita avviata dal telefono: il televisore diventa lo schermo.
--
-- tv_pairings: abbinamento TV ↔ partita con un codice di 4 cifre.
--   * il TV (pagina /tv, nessun account) chiede un codice e riceve un gettone segreto
--     (qui solo il suo hash); poi interroga il server col gettone;
--   * l'host, dal telefono, scrive il codice: solo il proprietario della partita può
--     abbinarla (controllo sul server), con limiti di frequenza;
--   * il TV riceve UNA volta sola id della partita e chiave dello schermo (consegna),
--     poi l'abbinamento è consumato. I codici scadono dopo ~10 minuti.
--   Un codice è univoco solo tra quelli in attesa (indice parziale).
--
-- tv_remote: telecomando dell'audio del TV dal telefono e presenza del TV.
--   * prefs: preferenze audio/grafica scelte dal telefono (il TV le applica);
--   * tv_seen_at / tv_audio: il TV si fa sentire ogni pochi secondi (collegato, audio attivo).
--   Tabella a parte: nessuna scrittura su game_state (niente contesa col lucchetto dei comandi).
--
-- Nessun accesso diretto dai client: tutto passa dal server. Idempotente.
-- ---------------------------------------------------------------------
create table if not exists public.tv_pairings (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[0-9]{4}$'),
  token_hash text not null,
  status text not null default 'waiting' check (status in ('waiting', 'claimed', 'delivered', 'expired')),
  session_id uuid references public.game_sessions (id) on delete cascade,
  claimed_by uuid references auth.users (id) on delete set null,
  created_ip text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  claimed_at timestamptz,
  delivered_at timestamptz
);
create unique index if not exists tv_pairings_waiting_code_key on public.tv_pairings (code) where status = 'waiting';
create index if not exists tv_pairings_created_idx on public.tv_pairings (created_at);
alter table public.tv_pairings enable row level security;
revoke all on table public.tv_pairings from anon, authenticated;
comment on table public.tv_pairings is 'Abbinamento TV ↔ partita con codice di 4 cifre (monouso, scade in ~10 minuti)';

create table if not exists public.tv_remote (
  session_id uuid primary key references public.game_sessions (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  prefs_rev integer not null default 0,
  tv_seen_at timestamptz,
  tv_audio boolean,
  updated_at timestamptz not null default now()
);
alter table public.tv_remote enable row level security;
revoke all on table public.tv_remote from anon, authenticated;
comment on table public.tv_remote is 'Telecomando dal telefono: preferenze audio del TV e presenza del TV abbinato';
