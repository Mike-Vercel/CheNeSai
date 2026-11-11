-- CHE NE SAI?! – battibecchi tra presentatori.
-- Nuovi tipi di battuta: RETORT_PROFESSORE, RETORT_REGINA, RETORT_PALMINO (un altro presentatore
-- risponde a chi ha appena parlato). Si allarga il CHECK su dialogue_templates.event_type.
--
-- Idempotente e "additiva": il nuovo CHECK ammette gli eventi di base, quelli nuovi e TUTTI quelli
-- già ammessi dal CHECK attuale o già presenti in tabella (es. eventi aggiunti da altre migrazioni),
-- così non si toglie mai niente a nessuno e si può rieseguire senza errori.

do $$
declare
  def text;
  vals text[] := array[
    'LEADER_CHANGED', 'LEADER_TIE', 'LEADER_KEPT', 'OVERTAKE', 'COMEBACK', 'NEW_LAST', 'FASTEST_CORRECT',
    'CORRECT_STREAK', 'WRONG_STREAK', 'ONLY_ONE_CORRECT', 'ALL_WRONG', 'ALL_CORRECT', 'POINTS_MILESTONE', 'ROUND_WINNER',
    'PLAYERS_JOINED', 'FINAL_ROUND_START', 'TEAM_LEADER_CHANGED', 'TEAM_ROUND_WINNER',
    'RETORT_PROFESSORE', 'RETORT_REGINA', 'RETORT_PALMINO'];
begin
  select pg_get_constraintdef(c.oid) into def
  from pg_constraint c
  where c.conrelid = 'public.dialogue_templates'::regclass and c.conname = 'dialogue_templates_event_type_check';

  if def is not null then
    -- valori del CHECK attuale (parole maiuscole, escluse quelle della sintassi SQL)
    vals := vals || coalesce((
      select array_agg(m[1]) from regexp_matches(def, '([A-Z][A-Z0-9_]*)', 'g') as m
      where m[1] not in ('CHECK', 'ANY', 'ARRAY', 'IN', 'IS', 'NOT', 'NULL', 'OR', 'AND')), '{}');
  end if;
  -- valori già usati dalle battute in archivio
  vals := vals || coalesce((select array_agg(distinct event_type) from public.dialogue_templates), '{}');
  select array_agg(distinct v order by v) into vals from unnest(vals) as v;

  alter table public.dialogue_templates drop constraint if exists dialogue_templates_event_type_check;
  execute format('alter table public.dialogue_templates add constraint dialogue_templates_event_type_check check (event_type = any (%L::text[]))', vals);
end
$$;

