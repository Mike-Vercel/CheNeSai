-- ---------------------------------------------------------------------
-- CHE NE SAI?! – Il TV dice quando ha finito di parlare.
--
-- tv_presence: per ogni serata, l'ultima versione dello stato per cui il TV ha finito
-- le battute dei presentatori (spoken_version) e quando si è fatto sentire (seen_at).
-- Lo scorrimento automatico non passa al momento successivo mentre il TV sta ancora
-- parlando (al massimo 15 s oltre l'orario previsto) e, appena il TV ha finito, può
-- anticipare il passo (niente silenzi). TV chiuso o muto da oltre 15 s: si ignora.
-- Tabella a parte: nessuna scrittura su game_state (niente contesa col lucchetto dei comandi).
-- Nessun accesso diretto dai client: tutto passa dal server. Idempotente.
-- ---------------------------------------------------------------------
create table if not exists public.tv_presence (
  session_id uuid primary key references public.game_sessions (id) on delete cascade,
  spoken_version bigint,
  speaking_version bigint,
  seen_at timestamptz not null default now()
);
alter table public.tv_presence enable row level security;
revoke all on table public.tv_presence from anon, authenticated;
comment on table public.tv_presence is 'Il TV ha finito di parlare per questa versione dello stato (scorrimento automatico senza tagli né silenzi)';
