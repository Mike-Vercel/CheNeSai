-- ---------------------------------------------------------------------
-- CHE NE SAI?! – "Ruota di Palmino": ogni tanto (dalla 5ª domanda in poi) Palmino gira una ruota
-- che sceglie la categoria della domanda successiva.
--
-- * game_rounds.palmino_wheel: piano della ruota del round (al massimo una per round), deciso
--   alla pubblicazione con un seme della serata: domanda "segnaposto" (slotSqId/slotPosition) e
--   gli spicchi, ognuno con UNA domanda candidata già riservata nel round (sqId/position/label).
--   Il giro riusa wheel_spun_at e wheel_spin (come la Ruota impazzita): un round normale non li usa.
-- * session_questions.wheel_candidate: domanda candidata di uno spicchio (riserva della ruota).
--   Inserita alla pubblicazione come riserva, quindi con la sua copia congelata
--   (question_snapshots) come tutte le altre: al giro la vincitrice prende il posto del segnaposto
--   (scambio di posizione e di "riserva", UPDATE consentito dal blocco delle serate pubblicate).
--   Non si usa mai come domanda misteriosa e non "prenota" la domanda per altre serate.
-- Idempotente: si può rilanciare senza effetti.
-- ---------------------------------------------------------------------
alter table public.game_rounds add column if not exists palmino_wheel jsonb;
comment on column public.game_rounds.palmino_wheel is 'Ruota di Palmino del round: segnaposto, spicchi con le candidate e vincitrice (giro in wheel_spun_at/wheel_spin)';

alter table public.session_questions add column if not exists wheel_candidate boolean not null default false;
comment on column public.session_questions.wheel_candidate is 'Domanda candidata di uno spicchio della Ruota di Palmino (riservata alla pubblicazione)';
create index if not exists session_questions_wheel_candidate_idx on public.session_questions (session_id) where wheel_candidate;
