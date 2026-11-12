-- =====================================================================
-- Partite ONLINE (display_mode = 'phone'): ogni giocatore entra con il SUO account.
--
--  * participants.user_id: l'account del giocatore (solo nelle partite online; nelle partite col TV
--    in salotto si entra ancora con il solo nickname e resta null). Un account = un partecipante
--    per partita (indice unico parziale).
--  * participant_devices: altri dispositivi dello STESSO partecipante (stesso account dal PC e dal
--    telefono, o un dispositivo nuovo dopo un cambio). Ogni dispositivo ha il suo token (hash):
--    rientrare da un altro dispositivo NON scollega quello di prima e ritrova punti e risposte.
--
-- Solo aggiunte, idempotente: si può rilanciare.
-- =====================================================================

alter table public.participants add column if not exists user_id uuid references auth.users (id) on delete set null;

create unique index if not exists participants_user_unique
  on public.participants (session_id, user_id) where user_id is not null;

comment on column public.participants.user_id is
  'Account del giocatore nelle partite online (display_mode = phone); null per chi entra col solo nickname';

create table if not exists public.participant_devices (
  token_hash text primary key,
  participant_id uuid not null references public.participants (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists participant_devices_participant_idx on public.participant_devices (participant_id, created_at desc);

comment on table public.participant_devices is
  'Token dei dispositivi in più dello stesso partecipante (partite online: stesso account da PC e telefono)';

-- come le altre tabelle del gioco: nessun accesso dai client (solo il server, ruolo postgres)
alter table public.participant_devices enable row level security;
