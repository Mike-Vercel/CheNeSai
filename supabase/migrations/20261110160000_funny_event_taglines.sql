-- =====================================================================
-- Slogan degli eventi di Palmino più divertenti (li legge Palmino con la
-- voce ElevenLabs). Si aggiornano solo quelli rimasti al testo originale:
-- le modifiche fatte dall'admin nella libreria eventi restano intatte.
-- =====================================================================
update public.special_event_definitions d set tagline = v.new_tagline
from (values
  ('double-points', 'Questa domanda vale il doppio!', 'Questa domanda vale il doppio! Doppio gusto, doppio cervello!'),
  ('no-penalty', 'Se sbagli non perdi punti!', 'Se sbagli non perdi punti! Sbagliate pure, tanto è gratis!'),
  ('lightning', 'Hai pochissimi secondi!', 'Hai pochissimi secondi! Più veloci di un cocco che cade!'),
  ('super-bonus', 'Punti extra in palio!', 'Punti extra in palio! Palmino ha rotto il salvadanaio!'),
  ('mystery-question', 'Una domanda fuori programma!', 'Una domanda fuori programma! Nemmeno Palmino sa cosa c''è dentro!'),
  ('impossible-comeback', 'Chi è indietro può rimontare!', 'Chi è indietro può rimontare! Non è finita finché Palmino non canta!'),
  ('palmino-decides', 'Palmino sceglie la sorpresa!', 'Palmino sceglie la sorpresa! Tremate, mortali!'),
  ('finalissima', 'La domanda che decide tutto!', 'La domanda che decide tutto! Cuori forti e cervelli accesi!')
) as v(key, old_tagline, new_tagline)
where d.key = v.key and d.tagline = v.old_tagline;
