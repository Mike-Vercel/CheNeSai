-- ---------------------------------------------------------------------
-- CHE NE SAI?! – Votazione delle materie a metà round.
-- game_rounds.vote_after: nei round a votazione (category_vote) quante domande "comuni" (senza
-- materia) si giocano PRIMA del voto; poi la votazione, poi le domande della materia votata e le
-- eventuali altre comuni. null = votazione a inizio round (comportamento di sempre, serate della
-- regia). Le partite libere usano 3: il voto non è mai la prima cosa della partita. Idempotente.
-- ---------------------------------------------------------------------
alter table public.game_rounds add column if not exists vote_after integer;
do $$ begin
  alter table public.game_rounds add constraint game_rounds_vote_after_check check (vote_after is null or vote_after between 1 and 30);
exception when duplicate_object then null;
end $$;
comment on column public.game_rounds.vote_after is 'Round a votazione: domande comuni giocate prima del voto (null = voto a inizio round)';
