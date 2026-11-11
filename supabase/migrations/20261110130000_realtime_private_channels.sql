-- =====================================================================
-- Migrazione 002: canali Realtime PRIVATI per il gioco.
--
-- I canali pubblici permetterebbero a chiunque possieda la chiave pubblica
-- di INVIARE broadcast (es. un finto stato di gioco verso il TV).
-- Con i canali privati l'autorizzazione è data dalle policy RLS su
-- realtime.messages:
--   * SELECT (ricezione) consentita ad anon/authenticated sui topic qz:game:*
--   * nessuna policy INSERT => i client NON possono trasmettere
--   * il server invia con realtime.send(..., private => true) dentro le
--     transazioni (ruolo postgres, che ignora RLS)
-- =====================================================================

do $$
begin
  if to_regclass('realtime.messages') is null then
    raise notice 'realtime.messages non presente: policy non create (verranno create al prossimo avvio)';
    return;
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'realtime' and tablename = 'messages' and policyname = 'qz_game_channel_receive'
  ) then
    execute $p$
      create policy qz_game_channel_receive on realtime.messages
        for select to anon, authenticated
        using (
          realtime.topic() like 'qz:game:%'
          and realtime.messages.extension = 'broadcast'
        )
    $p$;
  end if;
end $$;
