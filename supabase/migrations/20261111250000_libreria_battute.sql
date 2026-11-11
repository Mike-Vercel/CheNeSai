-- CHE NE SAI?! – libreria ufficiale delle battute dei presentatori.
--
-- Estende dialogue_templates (niente tabelle parallele):
-- * level: livello di comicità della battuta (leggero / sarcastico / irriverente); la regia usa solo
--   quelle fino al livello scelto nel pannello "Presentatori" (predefinito: irriverente);
-- * origin: base (libreria di sempre, content/show/battute.json), ufficiale (libreria scritta
--   dall'utente, content/show/libreria-ufficiale.json) o admin (aggiunte dal pannello);
-- * tags: condizioni e indicazioni di voce (es. "gruppo", "squadre", "timer30", "non_finale", "voce:whispers");
-- * scene_key / scene_step: righe della stessa scenetta (dialogo fra più presentatori, in ordine).
-- Nuovi eventi: reazioni alla soluzione, tempo che scade, ruota, mancate risposte, riempitivi,
-- classifica, vincitore della serata (solo al podio) e finale.
-- participants.no_answer_streak: mancate risposte consecutive (contatore lato server).
--
-- Idempotente e "additiva" come le migrazioni precedenti sul CHECK degli eventi.

alter table public.dialogue_templates add column if not exists level text not null default 'leggero';
alter table public.dialogue_templates add column if not exists origin text not null default 'base';
alter table public.dialogue_templates add column if not exists tags text[] not null default '{}';
alter table public.dialogue_templates add column if not exists scene_key text;
alter table public.dialogue_templates add column if not exists scene_step smallint;

alter table public.dialogue_templates drop constraint if exists dialogue_templates_level_check;
alter table public.dialogue_templates add constraint dialogue_templates_level_check check (level in ('leggero', 'sarcastico', 'irriverente'));
alter table public.dialogue_templates drop constraint if exists dialogue_templates_origin_check;
alter table public.dialogue_templates add constraint dialogue_templates_origin_check check (origin in ('base', 'ufficiale', 'admin'));
alter table public.dialogue_templates drop constraint if exists dialogue_templates_scene_check;
alter table public.dialogue_templates add constraint dialogue_templates_scene_check check (
  (scene_key is null and scene_step is null)
  or (scene_key ~ '^[a-z0-9-]{2,60}$' and scene_step between 1 and 12));
alter table public.dialogue_templates drop constraint if exists dialogue_templates_tags_check;
alter table public.dialogue_templates add constraint dialogue_templates_tags_check check (cardinality(tags) <= 12);

create index if not exists dialogue_templates_scene_idx on public.dialogue_templates (scene_key, scene_step) where scene_key is not null;

do $$
declare
  def text;
  vals text[] := array[
    'LEADER_CHANGED', 'LEADER_TIE', 'LEADER_KEPT', 'OVERTAKE', 'COMEBACK', 'NEW_LAST', 'FASTEST_CORRECT',
    'CORRECT_STREAK', 'WRONG_STREAK', 'ONLY_ONE_CORRECT', 'ALL_WRONG', 'ALL_CORRECT', 'POINTS_MILESTONE', 'ROUND_WINNER',
    'PLAYERS_JOINED', 'FINAL_ROUND_START', 'TEAM_LEADER_CHANGED', 'TEAM_ROUND_WINNER',
    'RETORT_PROFESSORE', 'RETORT_REGINA', 'RETORT_PALMINO',
    'ANSWER_WRONG', 'EASY_WRONG', 'ANSWER_CORRECT', 'LOSE_PATIENCE', 'TIME_RUNNING_OUT', 'WHEEL_SPIN',
    'ONLY_ONE_WRONG', 'PLAYER_NO_ANSWER', 'NO_ANSWER_LEADER', 'NO_ANSWER_LAST', 'NO_ANSWER_STREAK',
    'MANY_NO_ANSWER', 'TEAM_NO_ANSWER', 'FILLER', 'LEADERBOARD_QUIP', 'GAME_WINNER', 'GAME_END'];
begin
  select pg_get_constraintdef(c.oid) into def
  from pg_constraint c
  where c.conrelid = 'public.dialogue_templates'::regclass and c.conname = 'dialogue_templates_event_type_check';

  if def is not null then
    vals := vals || coalesce((
      select array_agg(m[1]) from regexp_matches(def, '([A-Z][A-Z0-9_]*)', 'g') as m
      where m[1] not in ('CHECK', 'ANY', 'ARRAY', 'IN', 'IS', 'NOT', 'NULL', 'OR', 'AND')), '{}');
  end if;
  vals := vals || coalesce((select array_agg(distinct event_type) from public.dialogue_templates), '{}');
  select array_agg(distinct v order by v) into vals from unnest(vals) as v;

  alter table public.dialogue_templates drop constraint if exists dialogue_templates_event_type_check;
  execute format('alter table public.dialogue_templates add constraint dialogue_templates_event_type_check check (event_type = any (%L::text[]))', vals);
end
$$;

-- mancate risposte consecutive: +1 a ogni mancata risposta con il telefono collegato; torna a 0 quando
-- il giocatore risponde o quando la mancata risposta avviene da disconnesso (al rientro si riparte da 0).
-- Nuova partita / rivincita = nuovi partecipanti; RESET_TEST li cancella.
alter table public.participants add column if not exists no_answer_streak integer not null default 0;

-- storico delle battute per host (niente ripetizioni fra le serate dello stesso host)
create index if not exists show_dialogue_log_template_idx on public.show_dialogue_log (template_id, created_at desc);
