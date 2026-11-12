-- CHE NE SAI?! – Palmino in italiano (richiesta dell'utente): niente siciliano/dialetto nelle sue battute,
-- niente accento siciliano. Aggiorna SOLO le battute di archivio non modificate dal pannello (il testo
-- deve essere ancora quello vecchio, esatto): libreria ufficiale e libreria di sempre, con le varianti
-- per genere. Idempotente: rieseguita non trova più i testi vecchi e non fa nulla.
-- Testi nuovi = clip nuove in archivio voci (le vecchie restano, inutilizzate): si generano alla prima
-- occasione o con "Prepara voci".


-- ---------------- libreria ufficiale ----------------
update public.dialogue_templates set text = 'MAMMA MIA… E CI HAI PURE PENSATO!', level = case when level = 'irriverente' then 'sarcastico' else level end, updated_at = now()
  where id = 'uff-palmino-sbaglia-01' and text = 'MINCHIA… E CI HAI PURE PENSATO!';
update public.dialogue_templates set text = 'MA PERCHÉ SEI VENUTO?!', updated_at = now()
  where id = 'uff-palmino-sbaglia-02' and text = 'MA CHI T''ARRICAMPASTI A FARI?!';
update public.dialogue_templates set text = 'ACCIDENTI, MA L''HAI FATTO APPOSTA?!', level = case when level = 'irriverente' then 'sarcastico' else level end, updated_at = now()
  where id = 'uff-palmino-sbaglia-08' and text = 'MINCHIA, MA L''HAI FATTO APPOSTA?!';
update public.dialogue_templates set text = 'MA CHI TI HA DATO LA PATENTE?!', updated_at = now()
  where id = 'uff-palmino-sbaglia-18' and text = 'MA CU TI DETTI A PATENTI?!';
update public.dialogue_templates set text = 'Accidenti, abbiamo un premio Nobel!', level = case when level = 'irriverente' then 'leggero' else level end, updated_at = now()
  where id = 'uff-palmino-indovina-26' and text = 'Minchia, abbiamo un premio Nobel!';
update public.dialogue_templates set text = 'E QUESTO CHI È, EINSTEIN?!', updated_at = now()
  where id = 'uff-palmino-indovina-30' and text = 'E QUESTO CU È, EINSTEIN?!';
update public.dialogue_templates set text = 'Professore, secondo me questo è un infiltrato!', updated_at = now()
  where id = 'uff-palmino-indovina-33' and text = 'Professò, secondo me questo è un infiltrato!';
update public.dialogue_templates set text = 'MAMMA MIA! HA ACCESO IL CERVELLO!', updated_at = now()
  where id = 'uff-palmino-indovina-34' and text = 'MIIII! HA ACCESO IL CERVELLO!';
update public.dialogue_templates set text = 'DAI, DAI! CHE MI SPUNTANO I DATTERI!', updated_at = now()
  where id = 'uff-palmino-tempo-41' and text = 'AMUNÌÌÌ! CA MI SPUNTANO I DATTERI!';
update public.dialogue_templates set text = 'Professore, metti una domanda facile… tipo come si chiamano!', updated_at = now()
  where id = 'uff-palmino-ruota-50' and text = 'Professò, metti una domanda facile… tipo come si chiamano!';
update public.dialogue_templates set text = 'MAMMA MIA, {nome_primo}! MA CHI SEI, EINSTEIN?!', updated_at = now()
  where id = 'uff-palmino-nomi-53' and text = 'MIIII, {nome_primo}! MA CU SI'', EINSTEIN?!';
update public.dialogue_templates set text = 'ATTENZIONE! {nome_sorpasso} HA SUPERATO {nome_superato}! MAMMA MIA, CHE RIMONTA!', updated_at = now()
  where id = 'uff-palmino-nomi-55' and text = 'ATTENZIONE! {nome_sorpasso} HA SUPERATO {nome_superato}! MIIII, CHE RIMONTA!';
update public.dialogue_templates set text = '{nome_risposta_errata}, MA CHI TI HA CONSIGLIATO QUESTA RISPOSTA?!', level = case when level = 'irriverente' then 'sarcastico' else level end, updated_at = now()
  where id = 'uff-palmino-nomi-57' and text = '{nome_risposta_errata}, MA CHI MINCHIA TI CONSIGLIÒ STA RISPOSTA?!';
update public.dialogue_templates set text = 'MAMMA MIA! {nome_rimonta} STA RECUPERANDO! SECONDO ME HA CAMBIATO CERVELLO!', updated_at = now()
  where id = 'uff-palmino-nomi-60' and text = 'MIIII! {nome_rimonta} STA RECUPERANDO! SECONDO ME HA CAMBIATO CERVELLO!';
update public.dialogue_templates set text = '{nome_primo_precedente}, TI HANNO FREGATO IL PRIMO POSTO! FORZA, RISPONDI!', updated_at = now()
  where id = 'uff-palmino-nomi-61' and text = '{nome_primo_precedente}, TI HANNO FREGATO IL PRIMO POSTO! AMUNÌ, RISPONDI!';
update public.dialogue_templates set text = 'Mamma mia! Una rimonta più incredibile del prezzo delle granite!', updated_at = now()
  where id = 'uff-palmino-classifica-67' and text = 'MIIII! Una rimonta più incredibile del prezzo delle granite!';
update public.dialogue_templates set text = 'PROFESSOREEE, STACCA TUTTO! QUA NON C''È SPERANZA!', updated_at = now()
  where id = 'uff-palmino-classifica-68' and text = 'PROFESSÒÒÒ, STACCA TUTTO! QUA NON C''È SPERANZA!';
update public.dialogue_templates set text = 'MA CHE NE SAAA?!', level = case when level = 'irriverente' then 'leggero' else level end, updated_at = now()
  where id = 'uff-palmino-tormentone-70' and text = 'MA CHI MINCHIA NE SAAA?!';
update public.dialogue_templates set text = 'MAMMA MIA, CHE FIGURA!', updated_at = now()
  where id = 'uff-palmino-tormentone-72' and text = 'MIIII, CHE FIGURA!';
update public.dialogue_templates set text = 'FORZA, CHE SI FA TARDI!', updated_at = now()
  where id = 'uff-palmino-tormentone-73' and text = 'AMUNÌ, CA SI FA TARDU!';
update public.dialogue_templates set text = 'Professore, e questi dove li hanno parcheggiati?', updated_at = now()
  where id = 'uff-scenetta-04-2' and text = 'Professò, e questi dove li hanno parcheggiati?';
update public.dialogue_templates set text = 'Mamma mia, e non ti hanno dato nemmeno il cervello incluso?!', updated_at = now()
  where id = 'uff-scenetta-07-3' and text = 'Miii, e non ti hanno dato nemmeno il cervello incluso?!';
update public.dialogue_templates set text = 'Regina, sei l''unica femmina!', updated_at = now()
  where id = 'uff-scenetta-09-2' and text = 'Regì, sei l''unica femmina!';
update public.dialogue_templates set text = 'Professore, questi ancora devono finire le elementari!', updated_at = now()
  where id = 'uff-scenetta-10-2' and text = 'Professò, questi ancora devono finire le elementari!';
update public.dialogue_templates set text = 'Professore, ma hai visto con chi stiamo giocando?', updated_at = now()
  where id = 'uff-scenetta-11-2' and text = 'Professò, ma hai visto con chi stiamo giocando?';
update public.dialogue_templates set text = 'Professore, la lasciamo lì o facciamo la prossima domanda?', updated_at = now()
  where id = 'uff-scenetta-13-4' and text = 'Professò, la lasciamo lì o facciamo la prossima domanda?';
update public.dialogue_templates set text = 'Regina, vuoi un applauso o una visita specialistica?', updated_at = now()
  where id = 'uff-scenetta-14-4' and text = 'Regì, vuoi un applauso o una visita specialistica?';
update public.dialogue_templates set text = 'E quindi, professore?', updated_at = now()
  where id = 'uff-scenetta-15-2' and text = 'E quindi, professò?';
update public.dialogue_templates set text = 'MAMMA MIA, {nome_primo}! MA ALLORA SEI UN GENIO!', updated_at = now()
  where id = 'uff-palmino-primo' and text = 'MIIII, {nome_primo}! MA ALLORA SEI UN GENIO!';
update public.dialogue_templates set text = 'MAMMA MIA, {nome_risposta_errata}! MA CHI TI HA SUGGERITO QUESTA COSA?!', updated_at = now()
  where id = 'uff-palmino-errata' and text = 'MIIII, {nome_risposta_errata}! MA CHI TI HA SUGGERITO STA COSA?!';
update public.dialogue_templates set text = 'MAMMA MIA, {nome_rimonta}! MA PRIMA STAVI DORMENDO?!', updated_at = now()
  where id = 'uff-palmino-rimonta' and text = 'MIIII, {nome_rimonta}! MA PRIMA STAVI DORMENDO?!';
update public.dialogue_templates set text = 'MAMMA MIAAA! {nome_vincitore} HA VINTOOO! MA CHI SE L''ASPETTAVA?!', level = case when level = 'irriverente' then 'sarcastico' else level end, updated_at = now()
  where id = 'uff-palmino-vittoria' and text = 'MIIIIII! {nome_vincitore} HA VINTOOO! MA CHI MINCHIA SE L''ASPETTAVA?!';
update public.dialogue_templates set text = 'MAMMA MIA, {nome_giocatore}! MA TI SEI ADDORMENTATO?!', updated_at = now()
  where id = 'uff-palmino-silenzio-01' and text = 'MIIII, {nome_giocatore}! MA TI SEI ADDORMENTATO?!';
update public.dialogue_templates set text_f = 'MAMMA MIA, {nome_giocatore}! MA TI SEI ADDORMENTATA?!', updated_at = now()
  where id = 'uff-palmino-silenzio-01' and (text_f = 'MIIII, {nome_giocatore}! MA TI SEI ADDORMENTATA?!' or (text_f is null and text = 'MAMMA MIA, {nome_giocatore}! MA TI SEI ADDORMENTATO?!'));
update public.dialogue_templates set text_n = 'MAMMA MIA, {nome_giocatore}! MA STAI DORMENDO?!', updated_at = now()
  where id = 'uff-palmino-silenzio-01' and (text_n = 'MIIII, {nome_giocatore}! MA STAI DORMENDO?!' or (text_n is null and text = 'MAMMA MIA, {nome_giocatore}! MA TI SEI ADDORMENTATO?!'));
update public.dialogue_templates set text = '{nome_giocatore}, DAI, DAI! MA CHE STAI ASPETTANDO, NATALE?!', updated_at = now()
  where id = 'uff-palmino-silenzio-02' and text = '{nome_giocatore}, AMUNÌÌÌ! MA CHE STAI ASPETTANDO, NATALE?!';
update public.dialogue_templates set text = 'MAMMA MIA, {nome_giocatore}! IO HO LE RADICI E MI MUOVO PIÙ VELOCE DI TE!', updated_at = now()
  where id = 'uff-palmino-silenzio-05' and text = 'MIIII, {nome_giocatore}! IO HO LE RADICI E MI MUOVO PIÙ VELOCE DI TE!';
update public.dialogue_templates set text = '{nome_giocatore}, MAMMA MIA! MANCO UNA RISPOSTA A CASO SEI RIUSCITO A DARE!', updated_at = now()
  where id = 'uff-palmino-silenzio-08' and text = '{nome_giocatore}, MIIII! MANCO UNA RISPOSTA A CASO SEI RIUSCITO A DARE!';
update public.dialogue_templates set text_f = '{nome_giocatore}, MAMMA MIA! MANCO UNA RISPOSTA A CASO SEI RIUSCITA A DARE!', updated_at = now()
  where id = 'uff-palmino-silenzio-08' and (text_f = '{nome_giocatore}, MIIII! MANCO UNA RISPOSTA A CASO SEI RIUSCITA A DARE!' or (text_f is null and text = '{nome_giocatore}, MAMMA MIA! MANCO UNA RISPOSTA A CASO SEI RIUSCITO A DARE!'));
update public.dialogue_templates set text_n = '{nome_giocatore}, MAMMA MIA! MANCO UNA RISPOSTA A CASO HAI DATO!', updated_at = now()
  where id = 'uff-palmino-silenzio-08' and (text_n = '{nome_giocatore}, MIIII! MANCO UNA RISPOSTA A CASO HAI DATO!' or (text_n is null and text = '{nome_giocatore}, MAMMA MIA! MANCO UNA RISPOSTA A CASO SEI RIUSCITO A DARE!'));
update public.dialogue_templates set text = 'PROFESSOREEE! {nome_giocatore} NON RISPONDE! CHIAMIAMO CHI L''HA VISTO!', updated_at = now()
  where id = 'uff-palmino-silenzio-11' and text = 'PROFESSÒÒÒ! {nome_giocatore} NON RISPONDE! CHIAMIAMO CHI L''HA VISTO!';
update public.dialogue_templates set text = '{nome_giocatore}, MAMMA MIA! TI DEVO MANDARE UNA RACCOMANDATA PER FARTI CLICCARE?!', updated_at = now()
  where id = 'uff-palmino-silenzio-12' and text = '{nome_giocatore}, MIIII! TI DEVO MANDARE UNA RACCOMANDATA PER FARTI CLICCARE?!';
update public.dialogue_templates set text = 'MAMMA MIA, {nome_giocatore}! SEI PRIMO E ORA TI RIPOSI?! MA TI SENTI GIÀ IN VACANZA?!', updated_at = now()
  where id = 'uff-palmino-silenzio-primo' and text = 'MIIII, {nome_giocatore}! SEI PRIMO E ORA TI RIPOSI?! MA TI SENTI GIÀ IN VACANZA?!';
update public.dialogue_templates set text_f = 'MAMMA MIA, {nome_giocatore}! SEI PRIMA E ORA TI RIPOSI?! MA TI SENTI GIÀ IN VACANZA?!', updated_at = now()
  where id = 'uff-palmino-silenzio-primo' and (text_f = 'MIIII, {nome_giocatore}! SEI PRIMA E ORA TI RIPOSI?! MA TI SENTI GIÀ IN VACANZA?!' or (text_f is null and text = 'MAMMA MIA, {nome_giocatore}! SEI PRIMO E ORA TI RIPOSI?! MA TI SENTI GIÀ IN VACANZA?!'));
update public.dialogue_templates set text_n = 'MAMMA MIA, {nome_giocatore}! SEI IN TESTA E ORA TI RIPOSI?! MA TI SENTI GIÀ IN VACANZA?!', updated_at = now()
  where id = 'uff-palmino-silenzio-primo' and (text_n = 'MIIII, {nome_giocatore}! SEI IN TESTA E ORA TI RIPOSI?! MA TI SENTI GIÀ IN VACANZA?!' or (text_n is null and text = 'MAMMA MIA, {nome_giocatore}! SEI PRIMO E ORA TI RIPOSI?! MA TI SENTI GIÀ IN VACANZA?!'));
update public.dialogue_templates set text = '{nome_giocatore}, MA SEI ULTIMO E NON RISPONDI?! MAMMA MIA, MA VUOI FINIRE SOTTO TERRA?!', updated_at = now()
  where id = 'uff-palmino-silenzio-ultimo' and text = '{nome_giocatore}, MA SEI ULTIMO E NON RISPONDI?! MIIII, MA VUOI FINIRE SOTTO TERRA?!';
update public.dialogue_templates set text_f = '{nome_giocatore}, MA SEI ULTIMA E NON RISPONDI?! MAMMA MIA, MA VUOI FINIRE SOTTO TERRA?!', updated_at = now()
  where id = 'uff-palmino-silenzio-ultimo' and (text_f = '{nome_giocatore}, MA SEI ULTIMA E NON RISPONDI?! MIIII, MA VUOI FINIRE SOTTO TERRA?!' or (text_f is null and text = '{nome_giocatore}, MA SEI ULTIMO E NON RISPONDI?! MAMMA MIA, MA VUOI FINIRE SOTTO TERRA?!'));
update public.dialogue_templates set text_n = '{nome_giocatore}, MA SEI IN FONDO E NON RISPONDI?! MAMMA MIA, MA VUOI FINIRE SOTTO TERRA?!', updated_at = now()
  where id = 'uff-palmino-silenzio-ultimo' and (text_n = '{nome_giocatore}, MA SEI IN FONDO E NON RISPONDI?! MIIII, MA VUOI FINIRE SOTTO TERRA?!' or (text_n is null and text = '{nome_giocatore}, MA SEI ULTIMO E NON RISPONDI?! MAMMA MIA, MA VUOI FINIRE SOTTO TERRA?!'));
update public.dialogue_templates set text = 'MAMMA MIA, {nome_giocatore}! TRE DOMANDE SENZA RISPONDERE?! MA HAI MESSO IL TELEFONO IN FERIE?!', updated_at = now()
  where id = 'uff-palmino-silenzio-tre' and text = 'MIIII, {nome_giocatore}! TRE DOMANDE SENZA RISPONDERE?! MA HAI MESSO IL TELEFONO IN FERIE?!';
update public.dialogue_templates set text = 'MAMMA MIA! MA SIETE TUTTI IN MODALITÀ AEREO?!', updated_at = now()
  where id = 'uff-palmino-silenzio-tanti' and text = 'MIIII! MA SIETE TUTTI IN MODALITÀ AEREO?!';
update public.dialogue_templates set text = 'MAMMA MIA! CHIAMATE CHI L''HA VISTO!', updated_at = now()
  where id = 'uff-silenzio-01-3' and text = 'MIIII! CHIAMATE CHI L''HA VISTO!';
update public.dialogue_templates set text = 'PROFESSORE, QUA NON STANNO RIFLETTENDO! STANNO FACENDO LA PENNICHELLA!', updated_at = now()
  where id = 'uff-silenzio-03-3' and text = 'PROFESSÒ, QUA NON STANNO RIFLETTENDO! STANNO FACENDO LA PENNICHELLA!';
update public.dialogue_templates set text = 'REGINA, IO SONO UNA PALMA! MICA IL SERVIZIO CLIENTI!', updated_at = now()
  where id = 'uff-silenzio-04-2' and text = 'REGÌ, IO SONO UNA PALMA! MICA IL SERVIZIO CLIENTI!';

-- ---------------- libreria di sempre ----------------
update public.dialogue_templates set text = '[shouts] Mamma mia! {nome_primo} è in testa! {nome_ex_primo}, ma che fine hai fatto?!', updated_at = now()
  where id = 'palmino-leader-changed-01' and text = '[shouts] MIIII! {nome_primo} è in testa! {nome_ex_primo}, ma che fine hai fatto?!';
update public.dialogue_templates set text = 'Guarda, guarda! {nome_primo} si è preso la vetta con {punti_primo} punti! Ma chi sei, un genio?', updated_at = now()
  where id = 'palmino-leader-changed-02' and text = 'Talìa, talìa! {nome_primo} si è preso la vetta con {punti_primo} punti! Ma cu sì, un genio?';
update public.dialogue_templates set text = 'Mamma mia, {nome_primo} in cima alla classifica! Dalla sorpresa ho perso due foglie!', updated_at = now()
  where id = 'palmino-leader-changed-05' and text = 'MIIII, {nome_primo} in cima alla classifica! Dalla sorpresa ho perso due foglie!';
update public.dialogue_templates set text = '[giggles] Mamma mia, {nomi_primi} appaiati! Ma vi siete messi d''accordo?', updated_at = now()
  where id = 'palmino-leader-tie-01' and text = '[giggles] MIIII, {nomi_primi} appaiati! Ma vi siete messi d''accordo?';
update public.dialogue_templates set text = 'Guarda! {nomi_primi} tutti a {punti_primo}! La vetta è stretta, stringetevi!', updated_at = now()
  where id = 'palmino-leader-tie-02' and text = 'Talìa! {nomi_primi} tutti a {punti_primo}! La vetta è stretta, stringetevi!';
update public.dialogue_templates set text = 'Mamma mia, {nome_primo}! {domande} domande in cima, ma hai messo la colla sulla vetta?', updated_at = now()
  where id = 'palmino-leader-kept-01' and text = 'MIIII, {nome_primo}! {domande} domande in cima, ma hai messo la colla sulla vetta?';
update public.dialogue_templates set text = 'Guarda {nome_primo}: {domande} domande di fila davanti a tutti! Io senza sole non resisto manco cinque minuti!', updated_at = now()
  where id = 'palmino-leader-kept-03' and text = 'Talìa {nome_primo}: {domande} domande di fila davanti a tutti! Io senza sole non resisto manco cinque minuti!';
update public.dialogue_templates set text = 'Ma chi sei, {nome_primo}, il padrone della classifica? Lasciane un pochino agli altri!', updated_at = now()
  where id = 'palmino-leader-kept-04' and text = 'Ma cu sì, {nome_primo}, il padrone della classifica? Lasciane un pochino agli altri!';
update public.dialogue_templates set text_f = 'Ma chi sei, {nome_primo}, la padrona della classifica? Lasciane un pochino agli altri!', updated_at = now()
  where id = 'palmino-leader-kept-04' and (text_f = 'Ma cu sì, {nome_primo}, la padrona della classifica? Lasciane un pochino agli altri!' or (text_f is null and text = 'Ma chi sei, {nome_primo}, il padrone della classifica? Lasciane un pochino agli altri!'));
update public.dialogue_templates set text_n = 'Guarda {nome_primo}, comanda sempre la classifica! Lasciane un pochino agli altri!', updated_at = now()
  where id = 'palmino-leader-kept-04' and (text_n = 'Talìa {nome_primo}, comanda sempre la classifica! Lasciane un pochino agli altri!' or (text_n is null and text = 'Ma chi sei, {nome_primo}, il padrone della classifica? Lasciane un pochino agli altri!'));
update public.dialogue_templates set text = '[shouts] Mamma mia, sorpasso! {nome_sorpasso} si è mangiato {nome_superato} in un boccone!', updated_at = now()
  where id = 'palmino-overtake-01' and text = '[shouts] MIIII, sorpasso! {nome_sorpasso} si è mangiato {nome_superato} in un boccone!';
update public.dialogue_templates set text = 'Guarda! {nome_sorpasso} passa {nome_superato} come un motorino nel traffico di Palermo!', updated_at = now()
  where id = 'palmino-overtake-02' and text = 'Talìa! {nome_sorpasso} passa {nome_superato} come un motorino nel traffico di Palermo!';
update public.dialogue_templates set text = '{nome_sorpasso} avanti, {nome_superato} indietro! Ma chi sei, un pilota di Formula Uno?', updated_at = now()
  where id = 'palmino-overtake-04' and text = '{nome_sorpasso} avanti, {nome_superato} indietro! Ma cu sì, un pilota di Formula Uno?';
update public.dialogue_templates set text = '[shouts] Mamma mia! {nome} sale di {posizioni} posizioni! Ma che hai mangiato, arancine magiche?', updated_at = now()
  where id = 'palmino-comeback-01' and text = '[shouts] MIIII! {nome} sale di {posizioni} posizioni! Ma che hai mangiato, arancine magiche?';
update public.dialogue_templates set text = 'Guarda {nome}! {posizioni} posizioni in un colpo, manco l''ascensore va così veloce!', updated_at = now()
  where id = 'palmino-comeback-02' and text = 'Talìa a {nome}! {posizioni} posizioni in un colpo, manco l''ascensore va così veloce!';
update public.dialogue_templates set text = 'Ma chi sei, {nome}, un razzo? {posizioni} posizioni! Mi hai spettinato le foglie!', updated_at = now()
  where id = 'palmino-comeback-04' and text = 'Ma cu sì, {nome}, un razzo? {posizioni} posizioni! Mi hai spettinato le foglie!';
update public.dialogue_templates set text = 'Mamma mia, {nome_ultimo}, in fondo in fondo! Dai, che da lì si può solo salire!', updated_at = now()
  where id = 'palmino-new-last-03' and text = 'MIIII, {nome_ultimo}, in fondo in fondo! Dai, che da lì si può solo salire!';
update public.dialogue_templates set text = 'Guarda {nome_ultimo}: ultimo posto! Ma tranquillità, la serata è lunga e la granita pure.', updated_at = now()
  where id = 'palmino-new-last-04' and text = 'Talìa {nome_ultimo}: ultimo posto! Ma tranquillità, la serata è lunga e la granita pure.';
update public.dialogue_templates set text = 'Ma chi sei, {nome_ultimo}, il guardiano della classifica? Tieni la porta a tutti!', updated_at = now()
  where id = 'palmino-new-last-05' and text = 'Ma cu sì, {nome_ultimo}, il guardiano della classifica? Tieni la porta a tutti!';
update public.dialogue_templates set text_f = 'Ma chi sei, {nome_ultimo}, la guardiana della classifica? Tieni la porta a tutti!', updated_at = now()
  where id = 'palmino-new-last-05' and (text_f = 'Ma cu sì, {nome_ultimo}, la guardiana della classifica? Tieni la porta a tutti!' or (text_f is null and text = 'Ma chi sei, {nome_ultimo}, il guardiano della classifica? Tieni la porta a tutti!'));
update public.dialogue_templates set text_n = 'Guarda {nome_ultimo}, fai la guardia alla classifica? Tieni la porta a tutti!', updated_at = now()
  where id = 'palmino-new-last-05' and (text_n = 'Talìa {nome_ultimo}, fai la guardia alla classifica? Tieni la porta a tutti!' or (text_n is null and text = 'Ma chi sei, {nome_ultimo}, il guardiano della classifica? Tieni la porta a tutti!'));
update public.dialogue_templates set text = 'Mamma mia, {nome}! In {secondi} secondi! Ma allora sai qualcosa!', updated_at = now()
  where id = 'palmino-fastest-correct-01' and text = 'MIIII, {nome}! In {secondi} secondi! Ma allora sai qualcosa!';
update public.dialogue_templates set text = 'Guarda {nome}: {secondi} secondi! Io in quel tempo manco mi metto gli occhiali da sole!', updated_at = now()
  where id = 'palmino-fastest-correct-03' and text = 'Talìa {nome}: {secondi} secondi! Io in quel tempo manco mi metto gli occhiali da sole!';
update public.dialogue_templates set text = 'Ma chi sei, {nome}, un fulmine? {secondi} secondi e risposta giusta!', updated_at = now()
  where id = 'palmino-fastest-correct-05' and text = 'Ma cu sì, {nome}, un fulmine? {secondi} secondi e risposta giusta!';
update public.dialogue_templates set text = 'Mamma mia, {nome}! {serie} giuste di fila! Ma sei un''enciclopedia con le gambe?', updated_at = now()
  where id = 'palmino-correct-streak-01' and text = 'MIIII, {nome}! {serie} giuste di fila! Ma sei un''enciclopedia con le gambe?';
update public.dialogue_templates set text = 'Guarda! {nome} è a quota {serie}! Ma chi sei, un computer travestito?', updated_at = now()
  where id = 'palmino-correct-streak-03' and text = 'Talìa! {nome} è a quota {serie}! Ma cu sì, un computer travestito?';
update public.dialogue_templates set text = 'Mamma mia, {nome}, {serie} di fila sbagliate! Coraggio, la prossima è tua, me lo sento nelle radici!', updated_at = now()
  where id = 'palmino-wrong-streak-02' and text = 'MIIII, {nome}, {serie} di fila sbagliate! Coraggio, la prossima è tua, me lo sento nelle radici!';
update public.dialogue_templates set text = 'Guarda {nome}: {serie} errori! Dai, pure io sbaglio sempre la strada per il mare.', updated_at = now()
  where id = 'palmino-wrong-streak-03' and text = 'Talìa {nome}: {serie} errori! Dai, pure io sbaglio sempre la strada per il mare.';
update public.dialogue_templates set text = 'Mamma mia! Solo {nome} lo sapeva! E gli altri che facevano, guardavano il soffitto?', updated_at = now()
  where id = 'palmino-only-one-correct-01' and text = 'MIIII! Solo {nome} lo sapeva! E gli altri che facevano, guardavano il soffitto?';
update public.dialogue_templates set text = 'Guarda, guarda! Solo {nome} ha risposto giusto! Ma chi sei, un professore travestito?', updated_at = now()
  where id = 'palmino-only-one-correct-03' and text = 'Talìa, talìa! Solo {nome} ha risposto giusto! Ma cu sì, un professore travestito?';
update public.dialogue_templates set text_f = 'Guarda, guarda! Solo {nome} ha risposto giusto! Ma chi sei, una professoressa travestita?', updated_at = now()
  where id = 'palmino-only-one-correct-03' and (text_f = 'Talìa, talìa! Solo {nome} ha risposto giusto! Ma cu sì, una professoressa travestita?' or (text_f is null and text = 'Guarda, guarda! Solo {nome} ha risposto giusto! Ma chi sei, un professore travestito?'));
update public.dialogue_templates set text_n = 'Guarda, guarda! Solo {nome} ha risposto giusto! Ma chi sei, un genio?', updated_at = now()
  where id = 'palmino-only-one-correct-03' and (text_n = 'Talìa, talìa! Solo {nome} ha risposto giusto! Ma cu sì, un genio?' or (text_n is null and text = 'Guarda, guarda! Solo {nome} ha risposto giusto! Ma chi sei, un professore travestito?'));
update public.dialogue_templates set text = '[shouts] Mamma mia! Nessuno! Ma che, vi siete addormentati tutti?', updated_at = now()
  where id = 'palmino-all-wrong-01' and text = '[shouts] MIIII! Nessuno! Ma che, vi siete addormentati tutti?';
update public.dialogue_templates set text = 'Guarda che silenzio! Nessuno l''ha indovinata, manco per sbaglio!', updated_at = now()
  where id = 'palmino-all-wrong-03' and text = 'Talìa che silenzio! Nessuno l''ha indovinata, manco per sbaglio!';
update public.dialogue_templates set text = 'Mamma mia, tutti giusti! Ma l''avete copiata dal vicino?', updated_at = now()
  where id = 'palmino-all-correct-01' and text = 'MIIII, tutti giusti! Ma l''avete copiata dal vicino?';
update public.dialogue_templates set text = 'Guarda che squadra! Tutti giusti, mi viene da ballare con le foglie!', updated_at = now()
  where id = 'palmino-all-correct-03' and text = 'Talìa che squadra! Tutti giusti, mi viene da ballare con le foglie!';
update public.dialogue_templates set text = 'Mamma mia, {nome} a quota {soglia}! Ma dove li trovi tutti questi punti?', updated_at = now()
  where id = 'palmino-points-milestone-01' and text = 'MIIII, {nome} a quota {soglia}! Ma dove li trovi tutti ''sti punti?';
update public.dialogue_templates set text = 'Guarda! {nome} passa i {soglia} punti! Festa grande, granite per tutti!', updated_at = now()
  where id = 'palmino-points-milestone-03' and text = 'Talìa! {nome} passa i {soglia} punti! Festa grande, granite per tutti!';
update public.dialogue_templates set text = '[shouts] Mamma mia! Il round è di {nome_primo}, con {punti_primo} punti! Festa in piazza!', updated_at = now()
  where id = 'palmino-round-winner-01' and text = '[shouts] MIIII! Il round è di {nome_primo}, con {punti_primo} punti! Festa in piazza!';
update public.dialogue_templates set text = 'Guarda chi ha vinto il round: {nome_primo}! Gli altri, forza, che c''è ancora tempo!', updated_at = now()
  where id = 'palmino-round-winner-02' and text = 'Talìa chi ha vinto il round: {nome_primo}! Gli altri, forza, che c''è ancora tempo!';
update public.dialogue_templates set text = 'Ma chi sei, {nome_primo}? {punti_primo} punti e il round in tasca! Mi inchino, per quanto può una palma!', updated_at = now()
  where id = 'palmino-round-winner-05' and text = 'Ma cu sì, {nome_primo}? {punti_primo} punti e il round in tasca! Mi inchino, per quanto può una palma!';
update public.dialogue_templates set text = 'Mamma mia, guarda chi c''è! Ciao {nomi}! Stasera qua si fa festa!', updated_at = now()
  where id = 'palmino-players-joined-01' and text = 'MIIII, talìa cu c''è! Ciao {nomi}! Stasera qua si fa festa!';
update public.dialogue_templates set text = 'Mamma mia, quanta gente! Un saluto a {nomi}, e mi raccomando: niente foglie strappate!', updated_at = now()
  where id = 'palmino-players-joined-04' and text = 'MIIII, quanta gente! Un saluto a {nomi}, e mi raccomando: niente foglie strappate!';
update public.dialogue_templates set text = 'Mamma mia, siamo alla finale! {nome_primo} davanti, {nome_secondo} col fiato sul collo. Tutto è ancora possibile!', updated_at = now()
  where id = 'palmino-final-round-start-01' and text = 'MIIII, siamo alla finale! {nome_primo} davanti, {nome_secondo} col fiato sul collo. Tutto è ancora possibile!';
update public.dialogue_templates set text = 'Guarda che finale! Comanda {nome_primo}, ma {nome_secondo} non molla. Qua può succedere di tutto, parola di palma!', updated_at = now()
  where id = 'palmino-final-round-start-03' and text = 'Talìa che finale! Comanda {nome_primo}, ma {nome_secondo} non molla. Qua può succedere di tutto, parola di palma!';
update public.dialogue_templates set text = 'Mamma mia, che tensione! {nome_primo} in testa e {nome_secondo} subito dietro. Stasera si soffre, ma che bello!', updated_at = now()
  where id = 'palmino-final-round-start-04' and text = 'MIIII, che tensione! {nome_primo} in testa e {nome_secondo} subito dietro. Stasera si soffre, ma che bello!';
update public.dialogue_templates set text = '[shouts] Mamma mia! {nome_squadra} passa davanti! {nome_ex_squadra}, ma che state facendo, dormite?', updated_at = now()
  where id = 'palmino-team-leader-changed-01' and text = '[shouts] MIIII! {nome_squadra} passa davanti! {nome_ex_squadra}, ma che state facendo, dormite?';
update public.dialogue_templates set text = 'Mamma mia che sorpasso! {nome_squadra} in testa e {nome_ex_squadra} a rincorrere. Ma quando mai si è vista una cosa così!', updated_at = now()
  where id = 'palmino-team-leader-changed-02' and text = 'MIIII che sorpasso! {nome_squadra} in testa e {nome_ex_squadra} a rincorrere. Ma quando mai si è vista una cosa così!';
update public.dialogue_templates set text = '[shouts] Mamma mia! Round alla squadra {nome_squadra} con {punti_squadra} punti! Ve lo meritate tutti, nessuno escluso!', updated_at = now()
  where id = 'palmino-team-round-winner-01' and text = '[shouts] MIIII! Round alla squadra {nome_squadra} con {punti_squadra} punti! Ve lo meritate tutti, nessuno escluso!';
update public.dialogue_templates set text = 'Mamma mia che squadrone! {nome_squadra} si porta a casa il round: {punti_squadra} punti, roba da non credere!', updated_at = now()
  where id = 'palmino-team-round-winner-02' and text = 'MIIII che squadrone! {nome_squadra} si porta a casa il round: {punti_squadra} punti, roba da non credere!';
update public.dialogue_templates set text = 'Mamma mia, Regina, sempre a fare la diva! Qua siamo in Sicilia: si scende dal trono e si balla!', updated_at = now()
  where id = 'palmino-battibecco-regina-02' and text = 'MIIII Regina, sempre a fare la diva! Qua siamo in Sicilia: si scende dal trono e si balla!';
update public.dialogue_templates set text = 'Mamma mia, Professore, come parli difficile! Mi sono perso alla seconda parola!', updated_at = now()
  where id = 'palmino-battibecco-professore-02' and text = 'MIIII Professore, come parli difficile! Mi sono perso alla seconda parola!';
update public.dialogue_templates set text = 'Guarda il Professore, serio serio... rilassati, che è una festa!', updated_at = now()
  where id = 'palmino-battibecco-professore-06' and text = 'Talìa il Professore, serio serio... rilassati, che è una festa!';
update public.dialogue_templates set text = '[clears throat] Palmino, "Mamma miaaa" non è un''esclamazione accademica. Ma la apprezzo.', updated_at = now()
  where id = 'professore-battibecco-palmino-03' and text = '[clears throat] Palmino, "MIIII" non è un''esclamazione accademica. Ma la apprezzo.';

-- accento siciliano di Palmino: impostazione tolta (nessun effetto anche se era accesa)
update public.application_settings set value = value - 'palminoAccent' where key = 'show' and value ? 'palminoAccent';
