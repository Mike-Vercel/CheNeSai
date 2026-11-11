-- ---------------------------------------------------------------------
-- CHE NE SAI?! – Gioco libero: RIVINCITA e giocatori illimitati.
--
-- * game_sessions.next_session_id: la partita libera finita è stata seguita da una
--   rivincita. La nuova partita (nuova sessione: classifica, storico domande e punteggi
--   separati) eredita il codice d'ingresso, quindi lo stesso QR continua a funzionare;
--   la vecchia riceve un codice d'archivio. TV e telefoni della vecchia partita leggono
--   questo campo nello stato pubblico e passano da soli alla nuova.
-- * game_sessions.public_options: impostazioni scelte nella creazione della partita libera
--   (domande, round, difficoltà), proposte di nuovo per la rivincita.
-- * Giocatori massimi per partita libera: 0 = illimitati (nuovo predefinito). Chi aveva il
--   vecchio predefinito (20) passa a illimitati.
-- Idempotente: si può rilanciare senza effetti.
-- ---------------------------------------------------------------------

alter table public.game_sessions add column if not exists next_session_id uuid references public.game_sessions (id) on delete set null;
alter table public.game_sessions add column if not exists public_options jsonb;
create index if not exists game_sessions_next_idx on public.game_sessions (next_session_id) where next_session_id is not null;
comment on column public.game_sessions.next_session_id is 'Gioco libero: rivincita che ha preso il posto di questa partita (stesso codice d''ingresso)';
comment on column public.game_sessions.public_options is 'Gioco libero: domande, round e difficoltà scelti dall''host (riproposti per la rivincita)';

update public.application_settings
set value = jsonb_set(value, '{maxPlayers}', '0'::jsonb)
where key = 'publicGames' and value->>'maxPlayers' = '20';
