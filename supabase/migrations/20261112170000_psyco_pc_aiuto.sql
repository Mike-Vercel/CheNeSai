-- ---------------------------------------------------------------------
-- CHE NE SAI?! – PSYCO: «Schermo + telefoni» da PC e «CHIAMA L'INVESTIGATORE» (aiuto per lo PSYCO).
--
-- Solo colonne NUOVE (nullable o con default) e una tabella nuova: nessun dato esistente viene
-- cancellato o riscritto, tranne gli indizi delle regole d'archivio ancora originali (vedi in fondo).
-- Idempotente: si può rilanciare.
--
-- * psyco_rooms.screen_mode: la partita è stata creata da un PC come SCHERMO PUBBLICO (il PC mostra
--   solo lo stato pubblico e pochi comandi che non rivelano nulla; tutti giocano dal telefono).
-- * psyco_rules.hint_1/2/3: indizi graduati dell'Investigatore (1 vago → 3 quasi rivelatore).
-- * psyco_candidates.category/hint: categoria e indizio facoltativi delle regole LIBERE (segreti).
-- * psyco_rounds.rule_category/rule_hint: quelli della proposta vincente (segreti, mai pubblici);
--   calls_max/calls_used: chiamate all'Investigatore permesse e usate nella manche.
-- * psyco_calls: registro delle chiamate (manche, numero, livello, origine dell'indizio, istante);
--   l'indizio va SOLO allo PSYCO dalla sua vista privata. Pronto per pesare in futuro sui punteggi.
-- ---------------------------------------------------------------------

alter table public.psyco_rooms add column if not exists screen_mode boolean not null default false;
comment on column public.psyco_rooms.screen_mode is 'Creata da PC come schermo pubblico: tutti (host compreso) giocano dal telefono';

alter table public.psyco_rules add column if not exists hint_1 text;
alter table public.psyco_rules add column if not exists hint_2 text;
alter table public.psyco_rules add column if not exists hint_3 text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'psyco_rules_hints_len') then
    alter table public.psyco_rules add constraint psyco_rules_hints_len check (
      (hint_1 is null or char_length(hint_1) <= 300)
      and (hint_2 is null or char_length(hint_2) <= 300)
      and (hint_3 is null or char_length(hint_3) <= 300)
    );
  end if;
end $$;
comment on column public.psyco_rules.hint_1 is 'Indizio dell''Investigatore, livello 1 (vago ma utile). SEGRETO: solo allo PSYCO che chiama';

alter table public.psyco_candidates add column if not exists category text;
alter table public.psyco_candidates add column if not exists hint text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'psyco_candidates_category_check') then
    alter table public.psyco_candidates add constraint psyco_candidates_category_check
      check (category is null or category in ('parole', 'lettere', 'gesti', 'persone', 'verita', 'numeri', 'altro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'psyco_candidates_hint_len') then
    alter table public.psyco_candidates add constraint psyco_candidates_hint_len check (hint is null or char_length(hint) between 1 and 200);
  end if;
end $$;

alter table public.psyco_rounds add column if not exists rule_category text;
alter table public.psyco_rounds add column if not exists rule_hint text;
alter table public.psyco_rounds add column if not exists calls_max integer not null default 0;
alter table public.psyco_rounds add column if not exists calls_used integer not null default 0;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'psyco_rounds_calls_check') then
    alter table public.psyco_rounds add constraint psyco_rounds_calls_check check (calls_max between 0 and 3 and calls_used between 0 and calls_max);
  end if;
end $$;
comment on column public.psyco_rounds.rule_hint is 'Indizio scritto dal gruppo (regola libera). SEGRETO: solo allo PSYCO alla prima chiamata';

create table if not exists public.psyco_calls (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.psyco_rounds (id) on delete cascade,
  room_id uuid not null references public.psyco_rooms (id) on delete cascade,
  call_no integer not null check (call_no between 1 and 3),
  level integer not null check (level between 1 and 3),
  -- chiave scelta dal telefono: la stessa chiamata ripetuta (rete ballerina) non ne consuma due
  request_id uuid not null,
  hint_source text not null check (hint_source in ('rule', 'custom', 'category', 'generic')),
  hint_text text not null check (char_length(hint_text) between 1 and 300),
  answered_at timestamptz not null default now(),
  unique (round_id, call_no),
  unique (round_id, request_id)
);
alter table public.psyco_calls enable row level security;
revoke all on table public.psyco_calls from anon, authenticated;
comment on table public.psyco_calls is 'PSYCO: chiamate all''Investigatore (l''indizio è segreto: solo allo PSYCO della manche)';

-- ---------------------------------------------------------------------
-- Indizi delle 60 regole d'archivio (content/psyco/regole.json, scripts/psyco/regole-sql.mjs --indizi).
-- Solo le righe col testo ORIGINALE e ancora senza indizi: le regole modificate dal pannello admin
-- restano come sono (lì gli indizi si scrivono a mano). Rieseguiti non cambiano nulla.
-- ---------------------------------------------------------------------
update public.psyco_rules set hint_1 = $r$Non conta cosa dicono… conta come cominciano. Ascolta la prima parola, sempre.$r$, hint_2 = $r$Partono tutti dallo stesso punto, come chi non ammette dubbi. Anche quando poi ti dicono di no.$r$, hint_3 = $r$Quella prima parola è una sicurezza ostentata: cinque lettere, sempre le stesse, a ogni risposta.$r$
  where slug = $r$comincia-con-certo$r$ and description = $r$Ogni risposta deve cominciare con la parola «Certo».$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Non guardare dove cominciano le frasi. Guarda dove vanno a morire.$r$, hint_2 = $r$Ogni risposta si chiude con la stessa parola. Una parola che toglie certezze.$r$, hint_3 = $r$Anche quando sono sicurissimi, all'ultimo si tirano indietro. L'ultima parola è sempre un dubbio.$r$
  where slug = $r$finisce-con-forse$r$ and description = $r$Ogni risposta deve finire con la parola «forse».$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Hai notato che non ti danno mai niente di solido? Ti rimandano la palla.$r$, hint_2 = $r$Ascolta il tono, non il contenuto. Alla fine di ogni risposta la voce sale.$r$, hint_3 = $r$Tu fai domande… e loro fanno esattamente lo stesso. Nessuno ti ha ancora risposto davvero.$r$
  where slug = $r$risposta-con-domanda$r$ and description = $r$Si risponde sempre con un'altra domanda.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le orecchie non servono solo per le parole. Ascolta anche i rumori.$r$, hint_2 = $r$C'è un suono che arriva sempre un attimo prima della risposta. Non esce dalla bocca.$r$, hint_3 = $r$Guarda le mani. Prima di parlare fanno sempre la stessa cosa, una volta sola. Senti?$r$
  where slug = $r$battito-di-mani$r$ and description = $r$Prima di rispondere si batte una volta le mani.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$C'è un intruso in ogni frase. Una parola che non c'entra niente, eppure torna sempre.$r$, hint_2 = $r$La parola infiltrata è sempre la stessa. Viene dal reparto frutta.$r$, hint_3 = $r$È gialla, si sbuccia, e nelle loro risposte spunta ogni volta. Non serve che ti dica altro.$r$
  where slug = $r$parola-banana$r$ and description = $r$In ogni risposta deve comparire la parola «banana».$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Smetti di ascoltare per un momento. Guardali: le facce raccontano più delle parole.$r$, hint_2 = $r$Un gesto piccolo e veloce, prima di ogni risposta. Al centro della faccia.$r$, hint_3 = $r$A tutti prude la stessa cosa nello stesso momento. Guarda dove va la mano: tra gli occhi e la bocca.$r$
  where slug = $r$tocco-del-naso$r$ and description = $r$Prima di rispondere ci si tocca il naso.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Sono molto gentili con te, non trovi? Fin troppo personali.$r$, hint_2 = $r$C'è una parola che senti in ogni risposta e che conosci meglio di chiunque altro.$r$, hint_3 = $r$Ti stanno chiamando. Ogni volta. Ascolta bene: in ogni risposta c'è qualcosa che ti appartiene da quando sei nato.$r$
  where slug = $r$nome-dello-psyco$r$ and description = $r$Ogni risposta contiene il nome dello PSYCO.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Ascolta come parlano di sé. C'è qualcosa di strano, di lontano.$r$, hint_2 = $r$Nessuno dice più «io». Parlano di se stessi come di un'altra persona.$r$, hint_3 = $r$Sembrano cronisti della propria vita: usano il loro nome, come se parlassero di qualcun altro.$r$
  where slug = $r$terza-persona$r$ and description = $r$Si parla di sé in terza persona, usando il proprio nome.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le loro risposte sono più vivaci del solito. Come un quadro.$r$, hint_2 = $r$In ogni frase c'è una parola che si potrebbe dipingere. Valgono anche i modi di dire.$r$, hint_3 = $r$Rosso, nero, verde… stasera non sono semplici aggettivi. Contali, risposta dopo risposta.$r$
  where slug = $r$un-colore$r$ and description = $r$In ogni risposta bisogna nominare un colore.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Prendi appunti. In ogni risposta c'è qualcosa che si può contare.$r$, hint_2 = $r$Età, orari, quantità, anni… manca mai una cifra? Ascolta bene.$r$, hint_3 = $r$Conta quante volte senti una cifra. Poi conta le risposte. Vedrai che i due conti coincidono.$r$
  where slug = $r$un-numero$r$ and description = $r$Ogni risposta contiene un numero.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Questa stanza è più affollata di quanto sembri. In ogni risposta c'è qualcuno che non è umano.$r$, hint_2 = $r$Pelo, piume, squame… nelle loro frasi si nasconde sempre una creatura.$r$, hint_3 = $r$Lupi, gatti, cavalli, anche nei modi di dire. Ogni risposta ha il suo ospite a quattro zampe… o con le ali.$r$
  where slug = $r$un-animale$r$ and description = $r$In ogni risposta compare un animale.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le parole dicono una cosa, il corpo un'altra. Guarda le loro teste.$r$, hint_2 = $r$Anche quando ti dicono di no, qualcosa in loro continua a dirti di sì.$r$, hint_3 = $r$Su e giù, su e giù. Mentre rispondono la testa non sta mai ferma. Nemmeno quando negano.$r$
  where slug = $r$annuire-sempre$r$ and description = $r$Mentre si risponde si annuisce con la testa, anche quando si dice di no.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Ascolta bene. Qualcuno stasera ha viaggiato più del dovuto.$r$, hint_2 = $r$In ogni risposta c'è una parola che non è nata in Italia. Viene da oltremanica.$r$, hint_3 = $r$Ogni frase si porta dietro un souvenir: una parola straniera, sempre nella lingua dei film americani.$r$
  where slug = $r$parola-inglese$r$ and description = $r$Ogni risposta contiene almeno una parola in inglese.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Guarda come si mettono quando tocca a loro. Il corpo si chiude.$r$, hint_2 = $r$C'è una posa che prendono tutti prima di parlare. Riguarda le braccia.$r$, hint_3 = $r$Sembrano tutti offesi quando rispondono: braccia chiuse sul petto. Poi si sciolgono.$r$
  where slug = $r$braccia-conserte$r$ and description = $r$Si risponde sempre con le braccia incrociate.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Non guardarli in bocca, guardali negli occhi. Dove vanno, prima di parlare?$r$, hint_2 = $r$Prima di rispondere, gli sguardi scappano tutti nella stessa direzione.$r$, hint_3 = $r$Come se la risposta fosse scritta lassù: prima di parlare alzano tutti gli occhi.$r$
  where slug = $r$sguardo-al-soffitto$r$ and description = $r$Prima di rispondere si guarda verso il soffitto.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Sono d'accordo con te. Troppo d'accordo. Ascolta come partono.$r$, hint_2 = $r$La prima parola è sempre la stessa, e non sempre va d'accordo con quello che segue.$r$, hint_3 = $r$Cominciano tutti con un assenso. Anche quando poi ti dicono il contrario.$r$
  where slug = $r$comincia-con-si$r$ and description = $r$Ogni risposta comincia con «Sì», anche quando poi si dice il contrario.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Non è quello che dicono. È quando lo dicono.$r$, hint_2 = $r$C'è un silenzio prima di ogni risposta. Troppo lungo per essere un caso.$r$, hint_3 = $r$Conta con loro, mentalmente, dopo la tua domanda. Uno… due… e solo allora parlano.$r$
  where slug = $r$pausa-di-tre-secondi$r$ and description = $r$Prima di rispondere si resta in silenzio per circa tre secondi.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Stasera c'è musica nell'aria. E non viene dalla radio.$r$, hint_2 = $r$Non stanno parlando, non proprio. Ascolta la melodia, anche se stonata.$r$, hint_3 = $r$Nessuno parla normalmente: le risposte hanno una melodia. Avresti dovuto portare un microfono.$r$
  where slug = $r$risposte-cantate$r$ and description = $r$Le risposte si cantano.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Sembra di essere tornati a scuola. Guarda cosa fanno prima di parlare.$r$, hint_2 = $r$C'è un gesto da prima elementare che compiono tutti prima di rispondere.$r$, hint_3 = $r$Chiedono la parola, come in classe: una mano va su, poi parlano.$r$
  where slug = $r$mano-alzata$r$ and description = $r$Prima di rispondere si alza la mano.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Non guardare solo le bocche. Guarda tutta la persona: si muove.$r$, hint_2 = $r$Quando tocca a loro, cambiano altezza. Poi tornano come prima.$r$, hint_3 = $r$Chi risponde non resta al suo posto: su per la risposta, e di nuovo giù.$r$
  where slug = $r$in-piedi$r$ and description = $r$Chi risponde si alza in piedi e poi si risiede.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le risposte sono vere… ma non appartengono a chi le dice.$r$, hint_2 = $r$Ognuno racconta la vita di qualcun altro. Qualcuno seduto molto vicino.$r$, hint_3 = $r$Guarda chi siede accanto a chi risponde, sempre dallo stesso lato: quello della mano con cui si giura.$r$
  where slug = $r$nei-panni-del-vicino-destra$r$ and description = $r$Si risponde fingendo di essere il giocatore seduto alla propria destra.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Stasera sono di poche parole. Troppo poche per essere un caso.$r$, hint_2 = $r$Conta le parole di ogni risposta. Il numero non cambia mai.$r$, hint_3 = $r$Uno, due… e basta così? No: uno, due, tre. Sempre lo stesso conto, articoli compresi.$r$
  where slug = $r$tre-parole-esatte$r$ and description = $r$Ogni risposta ha esattamente tre parole.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$C'è un'eco in questa stanza. Che cosa senti subito prima di ogni risposta?$r$, hint_2 = $r$Prima di risponderti, ti restituiscono qualcosa che hai appena detto tu.$r$, hint_3 = $r$L'ultima parola della tua domanda non va persa: la senti di nuovo, subito, dalla loro bocca.$r$
  where slug = $r$eco-ultima-parola$r$ and description = $r$Prima di rispondere si ripete l'ultima parola della domanda.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Ognuno ha il suo modo di cominciare. Non è lo stesso per tutti, ma per ognuno non cambia mai.$r$, hint_2 = $r$La prima lettera della risposta dipende da chi risponde, non da cosa gli chiedi.$r$, hint_3 = $r$Pensa ai loro nomi. Poi ascolta la prima parola di ognuno. Non noti una somiglianza?$r$
  where slug = $r$iniziale-del-nickname$r$ and description = $r$Ogni risposta comincia con la prima lettera del proprio nickname.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Tu li conosci. Ascolta se le risposte somigliano davvero a loro.$r$, hint_2 = $r$Qualcosa non torna con quello che sai di loro. Nemmeno una volta.$r$, hint_3 = $r$Chi ama il mare dice di odiarlo, chi è astemio giura di bere. Prova a capovolgere ogni risposta.$r$
  where slug = $r$contrario-della-verita$r$ and description = $r$Si risponde dicendo il contrario della verità.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Fai una domanda a una persona… ma da dove arriva la risposta?$r$, hint_2 = $r$Chi interroghi non apre bocca. Risponde un altro, sempre nella stessa posizione rispetto a lui.$r$, hint_3 = $r$Guarda accanto a chi interroghi, dal lato del cuore. È lì che nasce ogni risposta.$r$
  where slug = $r$risponde-chi-sta-a-sinistra$r$ and description = $r$La persona interrogata non risponde: risponde il giocatore alla sua sinistra.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le risposte hanno senso… ma non con la tua domanda. Con un'altra.$r$, hint_2 = $r$Sono sempre un passo indietro, come un'eco in ritardo.$r$, hint_3 = $r$Ripensa alla domanda che hai fatto prima di questa. Ora riascolta la risposta.$r$
  where slug = $r$domanda-precedente$r$ and description = $r$Si risponde sempre alla domanda precedente, non a quella appena fatta.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Ascolta i loro ragionamenti. Sembrano molto semplici. Troppo.$r$, hint_2 = $r$C'è qualcosa di infantile in tutte le risposte. Non è un'impressione.$r$, hint_3 = $r$Merenda, cartoni, la maestra… stasera hanno tutti l'età dell'asilo.$r$
  where slug = $r$come-bambini$r$ and description = $r$Si risponde come se si avessero cinque anni.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Stasera ognuno porta una maschera. Ascolta chi c'è dietro.$r$, hint_2 = $r$Ognuno risponde come un personaggio diverso, ma sempre lo stesso per tutta la manche.$r$, hint_3 = $r$Le loro vite sono troppo interessanti per essere vere. Chiedi del lavoro, dei viaggi: sono vite da copertina.$r$
  where slug = $r$persona-famosa$r$ and description = $r$Ognuno risponde come se fosse una persona famosa, sempre la stessa per tutta la manche.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Ascolta lo sfondo delle loro storie. Sono tutti nello stesso posto.$r$, hint_2 = $r$Raccontano di essere in viaggio, insieme. E non sono sulla terraferma.$r$, hint_3 = $r$Buffet, cabine, ponte, onde… sono tutti sulla stessa nave. In vacanza.$r$
  where slug = $r$tutti-in-crociera$r$ and description = $r$Tutti rispondono come se fossero in vacanza insieme su una nave da crociera.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Fai domande semplici. Molto semplici. E guarda quanta fatica fanno.$r$, hint_2 = $r$Ci sono due parole che in questa stanza nessuno pronuncia. Le più corte e comode che esistano.$r$, hint_3 = $r$Chiedi qualcosa a cui si risponde con una sillaba. Conta i giri di parole che fanno per evitarla.$r$
  where slug = $r$vietato-si-e-no$r$ and description = $r$Nelle risposte non si possono dire «sì» né «no».$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$La risposta comincia sempre da qualcosa che hai fatto tu.$r$, hint_2 = $r$La prima lettera della risposta non la scelgono loro. La scegli tu, senza saperlo.$r$, hint_3 = $r$Ascolta come cominci la tua domanda. Poi ascolta come comincia la loro risposta.$r$
  where slug = $r$stessa-iniziale-della-domanda$r$ and description = $r$La risposta comincia con la stessa lettera con cui comincia la domanda.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Ti trattano bene, stasera. Troppo bene.$r$, hint_2 = $r$In ogni risposta c'è qualcosa di carino rivolto a qualcuno. Sempre la stessa persona.$r$, hint_3 = $r$Bei capelli, ottima domanda, che intelligenza… ti stanno lusingando. Ogni volta.$r$
  where slug = $r$complimento-allo-psyco$r$ and description = $r$Ogni risposta contiene un complimento allo PSYCO.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Hai notato che stasera sono tutti di cattivo umore?$r$, hint_2 = $r$Qualunque cosa tu chieda, trovano sempre qualcosa che non va.$r$, hint_3 = $r$Il traffico, il caldo, il lavoro… in ogni risposta qualcuno brontola.$r$
  where slug = $r$una-lamentela$r$ and description = $r$Ogni risposta contiene una lamentela.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le parole sono normali. Gli occhi no.$r$, hint_2 = $r$Mentre rispondono guardano ovunque. Tranne in un punto preciso.$r$, hint_3 = $r$Prova a cercare il loro sguardo mentre rispondono. Lo eviteranno. Tutti.$r$
  where slug = $r$mai-guardare-lo-psyco$r$ and description = $r$Chi risponde non guarda mai lo PSYCO negli occhi.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Da dove partono le risposte non conta. Conta dove arrivano.$r$, hint_2 = $r$Qualunque cosa chiedi, la conversazione prende sempre la stessa strada. E ha un profumo.$r$, hint_3 = $r$Hai fame? Loro sì. Ogni risposta, prima o poi, finisce in cucina.$r$
  where slug = $r$fissazione-cucina$r$ and description = $r$Ogni risposta, in qualche modo, finisce per parlare di cibo.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Ascolta i verbi. Il tempo, in questa stanza, si è fermato.$r$, hint_2 = $r$Chiedi del domani: ti rispondono come se fosse già successo.$r$, hint_3 = $r$«Andavo», «ho fatto», «era»… niente presente, niente futuro.$r$
  where slug = $r$tutto-al-passato$r$ and description = $r$Si risponde sempre al passato, anche quando la domanda è sul presente o sul futuro.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Ascolta come parlano di sé. Manca qualcosa.$r$, hint_2 = $r$Ci sono parole piccolissime che nessuno usa più. Parlano di sé, ma girano al largo.$r$, hint_3 = $r$Chiedi qualcosa di molto personale e fai caso ai pronomi: quelli in prima persona sono spariti.$r$
  where slug = $r$niente-io$r$ and description = $r$Nelle risposte non si possono usare «io», «me», «mi» e «mio».$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Ascolta la voce, non le parole. C'è qualcosa di meccanico.$r$, hint_2 = $r$Niente emozioni, niente intonazione, frasi cortissime.$r$, hint_3 = $r$Bip. Risposta. Elaborata. Sembrano tutti fatti di circuiti.$r$
  where slug = $r$parlare-come-robot$r$ and description = $r$Si risponde come un robot: voce piatta, frasi brevissime, nessuna emozione.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le risposte non finiscono dove dovrebbero. C'è sempre una coda.$r$, hint_2 = $r$Dopo aver risposto rilanciano, e la palla torna a te.$r$, hint_3 = $r$Alla fine di ogni risposta c'è una domanda che conosci benissimo: è la tua, rivolta a te.$r$
  where slug = $r$domanda-di-ritorno-sullo-psyco$r$ and description = $r$Dopo aver risposto si fa sempre la stessa domanda allo PSYCO.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le risposte cambiano lunghezza. Non a caso: dipende da te.$r$, hint_2 = $r$Le risposte sono sempre brevi, ma di due misure diverse. Conta anche le tue parole.$r$, hint_3 = $r$Conta le parole della tua domanda, articoli compresi. Pari o dispari? Poi conta quelle della risposta.$r$
  where slug = $r$pari-due-dispari-quattro$r$ and description = $r$Se la domanda ha un numero pari di parole si risponde con due parole; se è dispari, con quattro.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Cominciano sempre con una conferma o con un rifiuto. Ma non dipende da cosa chiedi.$r$, hint_2 = $r$Il «sì» o il «no» iniziale non risponde alla tua domanda: risponde alla sua forma.$r$, hint_3 = $r$Ascolta la prima lettera della tua domanda. A, E, I, O, U… oppure no?$r$
  where slug = $r$vocale-si-consonante-no$r$ and description = $r$Se la domanda comincia con una vocale la risposta comincia con «Sì», altrimenti con «No».$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Ascoltali tutti insieme, non uno alla volta. C'è un ritmo.$r$, hint_2 = $r$Una risposta sale, la successiva scende. Una chiede, una afferma.$r$, hint_3 = $r$Ascolta il tono delle risposte, una dopo l'altra, chiunque parli: punto interrogativo, punto fermo, e di nuovo.$r$
  where slug = $r$domanda-e-affermazione-alternate$r$ and description = $r$Le risposte si alternano: una è una domanda, la successiva un'affermazione, e così via.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Ognuno risponde pensando a chi ha parlato prima di lui.$r$, hint_2 = $r$C'è una parola, in ogni risposta, che dipende dal nome di qualcun altro.$r$, hint_3 = $r$Ricorda chi ha parlato per ultimo e guarda come finisce il suo nome. Poi cerca quella lettera nella risposta dopo.$r$
  where slug = $r$ultima-lettera-del-precedente$r$ and description = $r$La risposta deve contenere una parola che comincia con l'ultima lettera del nickname di chi ha risposto prima.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le risposte non sono indipendenti. C'è un ordine, dalla prima all'ultima.$r$, hint_2 = $r$Ascolta la prima lettera di ogni risposta, una dopo l'altra. Avanza.$r$, hint_3 = $r$A, B, C… l'hai imparato da bambino. Loro lo stanno recitando, una risposta alla volta.$r$
  where slug = $r$alfabeto-progressivo$r$ and description = $r$Ogni risposta comincia con la lettera successiva a quella con cui cominciava la risposta precedente.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Il modo in cui chiudi la tua domanda decide come aprono la loro risposta.$r$, hint_2 = $r$Ascolta l'ultima parola della tua domanda. Anzi: il suo ultimo suono.$r$, hint_3 = $r$L'ultima lettera della tua domanda… la ritrovi subito, all'inizio della risposta. Coincidenza?$r$
  where slug = $r$prima-ultima-lettera$r$ and description = $r$La prima parola della risposta comincia con l'ultima lettera dell'ultima parola della domanda.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Più parli, più parlano. Meno parli…$r$, hint_2 = $r$La lunghezza delle risposte segue la lunghezza delle tue domande.$r$, hint_3 = $r$Fai una domanda lunghissima, poi una di due parole. Conta cosa ti torna indietro.$r$
  where slug = $r$stesso-numero-di-parole$r$ and description = $r$La risposta ha lo stesso numero di parole della domanda.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Non tutti mentono sempre. E non tutti dicono sempre la verità.$r$, hint_2 = $r$Segui una persona sola, risposta dopo risposta: una volta sincera, una volta no.$r$, hint_3 = $r$Ognuno tiene il suo conto, a fasi alterne. Interroga due volte di fila la stessa persona su cose che sai.$r$
  where slug = $r$vero-e-falso-alternati$r$ and description = $r$Ognuno alterna le proprie risposte: una vera, una falsa, una vera…$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$La verità dipende da te. Più di quanto pensi.$r$, hint_2 = $r$A volte mentono, a volte no. Non dipende dalla domanda: dipende da come stai tu.$r$, hint_3 = $r$Guarda le tue braccia. Ora cambia posizione e rifai la stessa domanda.$r$
  where slug = $r$braccia-dello-psyco$r$ and description = $r$Se lo PSYCO ha le braccia incrociate si mente; altrimenti si dice la verità.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le bugie non sono casuali. Dipendono da come fai le domande.$r$, hint_2 = $r$Prova a fare la stessa domanda in due modi diversi. Uno è più personale.$r$, hint_3 = $r$Quando chiami qualcuno per nome, ascolta bene la risposta. Poi chiedi senza nomi.$r$
  where slug = $r$chiamato-per-nome-mente$r$ and description = $r$Se lo PSYCO chiama per nome chi deve rispondere, la risposta è falsa; altrimenti è vera.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Interroghi qualcuno, ma la risposta arriva da un'altra parte. Ricorda chi ha parlato.$r$, hint_2 = $r$Chi ha appena risposto non molla la parola. Continua lui.$r$, hint_3 = $r$Guarda chi ha risposto alla domanda prima: risponde ancora lui. Finché non interroghi proprio lui.$r$
  where slug = $r$risponde-chi-ha-risposto-prima$r$ and description = $r$Non risponde chi viene interrogato, ma chi ha risposto alla domanda precedente.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le risposte si tengono per mano, una con l'altra.$r$, hint_2 = $r$Ascolta come finisce una risposta: qualcosa passa nella risposta dopo.$r$, hint_3 = $r$L'ultima parola di chi ha parlato prima… la senti di nuovo nella risposta successiva.$r$
  where slug = $r$catena-di-parole$r$ and description = $r$Ogni risposta deve contenere l'ultima parola della risposta precedente.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le risposte crescono. Poi crollano. Poi crescono di nuovo.$r$, hint_2 = $r$Conta le parole di ogni risposta, una dopo l'altra, di tutto il gruppo. C'è una scala.$r$, hint_3 = $r$Una parola. Poi due. Poi tre… arrivati in cima si riparte dal basso.$r$
  where slug = $r$lunghezza-crescente$r$ and description = $r$Ogni risposta ha una parola in più della precedente: una, due, tre, quattro, cinque, poi si ricomincia da una.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Non tutti mentono. Chi mente, lo porta addosso.$r$, hint_2 = $r$Guarda come sono vestiti. Il colore conta più delle parole.$r$, hint_3 = $r$Il colore del lutto e delle notti senza luna. Chi lo indossa, anche in un dettaglio, non ti sta dicendo la verità.$r$
  where slug = $r$chi-indossa-nero-mente$r$ and description = $r$Chi indossa qualcosa di nero mente; gli altri dicono la verità.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$A volte ti rispondono, a volte no. Dipende dal tipo di domanda.$r$, hint_2 = $r$Alcune tue domande ti tornano indietro sotto forma di altre domande. Quali?$r$, hint_3 = $r$Chiedi «ti piace il mare?», poi «dove vivi?». Confronta come ti rispondono.$r$
  where slug = $r$domanda-chiusa-risposta-domanda$r$ and description = $r$Se alla domanda si può rispondere con sì o no, si risponde con un'altra domanda; altrimenti si risponde normalmente.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Stasera hanno l'anima dei poeti. Ascolta i finali.$r$, hint_2 = $r$L'ultima parola della risposta suona come qualcosa che hai detto tu.$r$, hint_3 = $r$Cuore, amore… mare, nuotare… Ascolta come finisce la tua domanda, e come finisce la loro risposta.$r$
  where slug = $r$rima-con-la-domanda$r$ and description = $r$La risposta deve fare rima con l'ultima parola della domanda.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Smetti di ascoltare e guarda. C'è uno specchio in questa stanza.$r$, hint_2 = $r$Chi risponde cambia postura. E la nuova postura non è casuale: la conosci bene.$r$, hint_3 = $r$Incrocia le gambe, tocca il mento. Poi fai la domanda e guarda chi risponde.$r$
  where slug = $r$copia-la-posizione-dello-psyco$r$ and description = $r$Chi risponde assume la stessa posizione dello PSYCO in quel momento.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Chi ha appena parlato lascia un segno. Guarda le mani.$r$, hint_2 = $r$C'è sempre una mano appoggiata da qualche parte. Cambia padrone a ogni risposta.$r$, hint_3 = $r$Guarda il tavolo. La mano appoggiata è sempre di chi ha risposto per ultimo.$r$
  where slug = $r$mano-sul-tavolo$r$ and description = $r$Chi ha risposto per ultimo tiene una mano appoggiata sul tavolo finché qualcun altro non risponde.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le risposte hanno sempre la stessa lunghezza: un numero che conosci, se ti guardi intorno.$r$, hint_2 = $r$Conta le parole delle risposte. Poi conta le persone nella stanza.$r$, hint_3 = $r$Conta i giocatori, ma lascia fuori te stesso. Ora conta le parole di una risposta.$r$
  where slug = $r$parole-quanti-siamo$r$ and description = $r$Ogni risposta ha tante parole quante sono le persone che conoscono la regola.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
update public.psyco_rules set hint_1 = $r$Le risposte si chiudono come si aprono.$r$, hint_2 = $r$Ascolta la prima e l'ultima parola di ogni risposta. Si somigliano.$r$, hint_3 = $r$Ascolta come comincia la prima parola, poi aspetta l'ultima: ti sembrerà di sentire lo stesso suono.$r$
  where slug = $r$prima-e-ultima-uguali$r$ and description = $r$La prima e l'ultima parola della risposta cominciano con la stessa lettera.$r$ and hint_1 is null and hint_2 is null and hint_3 is null;
