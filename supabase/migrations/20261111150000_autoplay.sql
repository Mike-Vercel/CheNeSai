-- CHE NE SAI?! – scorrimento automatico della serata (autoplay).
-- Migrazione idempotente: si può rieseguire senza errori.
--
-- L'impostazione della serata (game_sessions.settings.advanceMode = 'manual' | 'auto') è congelata
-- con la pubblicazione: il valore LIVE vive qui, nello stato di gioco, e la regia lo cambia quando vuole.
--
-- * auto_mode     null = come da impostazione della serata; true/false = scelta della regia in diretta
-- * auto_next_at  quando il server considera "dovuto" il prossimo passo automatico (orologio del DB)
-- * auto_command  il comando che verrà eseguito (lo stesso che premerebbe la regia)
-- * auto_version  versione di game_state per cui vale il piano: se lo stato cambia, il piano decade
-- * auto_waiting  motivo per cui l'automatico è fermo in attesa della regia (null = nessuna attesa)
--
-- Nessun processo in background: TV e regia chiamano /tick quando auto_next_at è passato e il
-- server esegue il passo solo se è davvero dovuto (stessa transazione e stesso lock dei comandi).

alter table public.game_state add column if not exists auto_mode boolean;
alter table public.game_state add column if not exists auto_next_at timestamptz;
alter table public.game_state add column if not exists auto_command text;
alter table public.game_state add column if not exists auto_version bigint;
alter table public.game_state add column if not exists auto_waiting text;

comment on column public.game_state.auto_mode is 'Scorrimento automatico deciso in regia (null = impostazione della serata)';
comment on column public.game_state.auto_next_at is 'Scorrimento automatico: quando il prossimo passo è dovuto';
comment on column public.game_state.auto_command is 'Scorrimento automatico: comando del prossimo passo';
comment on column public.game_state.auto_version is 'Scorrimento automatico: versione dello stato a cui si riferisce il piano';
comment on column public.game_state.auto_waiting is 'Scorrimento automatico: in attesa della regia (motivo)';
