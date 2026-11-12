-- ---------------------------------------------------------------------
-- CHE NE SAI?! – PSYCO: «Tutti conoscono la regola. Tranne te.»
--
-- Minigioco indipendente della piattaforma. Solo tabelle NUOVE (più una colonna nullable su
-- tv_pairings): nessun dato del quiz viene toccato. Idempotente: si può rilanciare.
--
-- Tre tipi di soggetti, ben distinti:
--   1. utenti registrati (auth.users): l'host e, nei dispositivi personali, OGNI partecipante
--      (psyco_participants.kind = 'account', user_id obbligatorio, un solo posto per account);
--   2. partecipanti locali del dispositivo condiviso (kind = 'local'): solo un nickname, nessun
--      account, "posseduti" dall'account che ha creato la stanza (owner_user_id);
--   3. schermi pubblici (TV/PC): NON sono partecipanti, non hanno righe qui; leggono lo stato
--      pubblico con una chiave lunga e casuale (psyco_rooms.display_key).
--
-- * psyco_rules: archivio delle regole (facile/media/difficile), modificabile dal pannello admin.
--   Le regole scritte dai giocatori NON finiscono qui (restano nella loro manche).
-- * psyco_rooms: la stanza (codice di 6 caratteri non prevedibile, fase della macchina a stati,
--   versione per l'ordinamento degli aggiornamenti, impostazioni modificabili tra le manche).
-- * psyco_rounds: una riga per manche = registro degli eventi (PSYCO, regola, difficoltà, esito,
--   tempo, tentativi): nessun punteggio, ma tutto quello che serve per calcolarne in futuro.
-- * psyco_round_members: chi partecipa alla manche e con che ruolo (uno e un solo 'psyco').
-- * psyco_candidates / psyco_votes / psyco_guesses: regole proposte, voti (uno per persona e
--   per votazione, garantito dalla chiave primaria), tentativi dello PSYCO.
--
-- Nessun accesso diretto dai client: RLS attiva, nessuna policy, tutto passa dal server.
-- Realtime: il server pubblica sul topic privato 'qz:game:psyco-<id stanza>' (già autorizzato in
-- ricezione dalla policy qz_game_channel_receive) SOLO lo stato pubblico, senza segreti.
-- ---------------------------------------------------------------------

create table if not exists public.psyco_rules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  title text not null check (char_length(title) between 2 and 80),
  description text not null check (char_length(description) between 5 and 400),
  difficulty text not null check (difficulty in ('facile', 'media', 'difficile')),
  instructions text check (instructions is null or char_length(instructions) <= 600),
  example text check (example is null or char_length(example) <= 400),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists psyco_rules_pick_idx on public.psyco_rules (difficulty) where active;
alter table public.psyco_rules enable row level security;
revoke all on table public.psyco_rules from anon, authenticated;
comment on table public.psyco_rules is 'PSYCO: archivio delle regole segrete (modalità automatica)';

create table if not exists public.psyco_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  display_key text not null unique check (char_length(display_key) >= 24),
  mode text not null check (mode in ('shared', 'personal')),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  host_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  phase text not null default 'LOBBY',
  version bigint not null default 1,
  secret_rev integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  round_no integer not null default 0,
  current_round_id uuid,
  event jsonb,
  host_seen_at timestamptz not null default now(),
  display_seen_at timestamptz,
  broadcast_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  closed_at timestamptz,
  close_reason text
);
create index if not exists psyco_rooms_owner_idx on public.psyco_rooms (owner_user_id, created_at desc);
create index if not exists psyco_rooms_open_idx on public.psyco_rooms (last_activity_at) where status = 'open';
alter table public.psyco_rooms enable row level security;
revoke all on table public.psyco_rooms from anon, authenticated;
comment on table public.psyco_rooms is 'PSYCO: stanze (dispositivo condiviso o dispositivi personali)';

create table if not exists public.psyco_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.psyco_rooms (id) on delete cascade,
  kind text not null check (kind in ('account', 'local')),
  user_id uuid references auth.users (id) on delete cascade,
  owner_user_id uuid references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  seat integer not null,
  status text not null default 'active' check (status in ('active', 'left', 'kicked')),
  psyco_count integer not null default 0,
  last_psyco_round integer,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_seen_at timestamptz not null default now(),
  constraint psyco_participants_identity_check check (
    (kind = 'account' and user_id is not null)
    or (kind = 'local' and user_id is null and owner_user_id is not null)
  )
);
-- un account = un solo posto per stanza (niente accessi doppi)
create unique index if not exists psyco_participants_account_key on public.psyco_participants (room_id, user_id) where user_id is not null;
create unique index if not exists psyco_participants_nick_key on public.psyco_participants (room_id, lower(nickname)) where status = 'active';
create index if not exists psyco_participants_room_idx on public.psyco_participants (room_id, status, seat);
create index if not exists psyco_participants_user_idx on public.psyco_participants (user_id) where user_id is not null;
alter table public.psyco_participants enable row level security;
revoke all on table public.psyco_participants from anon, authenticated;
comment on table public.psyco_participants is 'PSYCO: partecipanti (account registrati o nickname locali del dispositivo condiviso)';

create table if not exists public.psyco_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.psyco_rooms (id) on delete cascade,
  round_no integer not null,
  psyco_participant_id uuid references public.psyco_participants (id) on delete set null,
  psyco_nickname text not null,
  rule_mode text not null check (rule_mode in ('auto', 'free')),
  difficulty text check (difficulty in ('facile', 'media', 'difficile')),
  rule_source text check (rule_source in ('archive', 'custom')),
  rule_id uuid references public.psyco_rules (id) on delete set null,
  rule_title text,
  rule_text text,
  timer_ms integer check (timer_ms is null or timer_ms > 0),
  countdown_ms integer not null default 3500,
  vote jsonb,
  candidate_id uuid,
  candidates_shown integer not null default 0,
  started_at timestamptz,
  paused_at timestamptz,
  paused_ms bigint not null default 0,
  paused_by_guess boolean not null default false,
  ended_at timestamptz,
  outcome text check (outcome in ('guessed', 'time_up', 'ended', 'psyco_left')),
  elapsed_ms bigint,
  attempts integer not null default 0,
  participants_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (room_id, round_no)
);
alter table public.psyco_rounds enable row level security;
revoke all on table public.psyco_rounds from anon, authenticated;
comment on table public.psyco_rounds is 'PSYCO: manche (registro: PSYCO, regola, difficoltà, esito, tempo, tentativi)';
comment on column public.psyco_rounds.rule_text is 'SEGRETO fino alla fine della manche: mai nello stato pubblico, mai allo PSYCO';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'psyco_rooms_current_round_fk') then
    alter table public.psyco_rooms
      add constraint psyco_rooms_current_round_fk foreign key (current_round_id) references public.psyco_rounds (id) on delete set null;
  end if;
end $$;

create table if not exists public.psyco_round_members (
  round_id uuid not null references public.psyco_rounds (id) on delete cascade,
  participant_id uuid not null references public.psyco_participants (id) on delete cascade,
  role text not null check (role in ('psyco', 'knower')),
  seen_at timestamptz,
  ready_at timestamptz,
  primary key (round_id, participant_id)
);
-- uno e un solo PSYCO per manche
create unique index if not exists psyco_round_members_one_psyco on public.psyco_round_members (round_id) where role = 'psyco';
alter table public.psyco_round_members enable row level security;
revoke all on table public.psyco_round_members from anon, authenticated;

create table if not exists public.psyco_candidates (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.psyco_rounds (id) on delete cascade,
  room_id uuid not null references public.psyco_rooms (id) on delete cascade,
  kind text not null check (kind in ('archive', 'custom')),
  rule_id uuid references public.psyco_rules (id) on delete set null,
  title text,
  text text not null check (char_length(text) between 1 and 400),
  author_participant_id uuid references public.psyco_participants (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'rejected', 'winner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists psyco_candidates_one_per_author on public.psyco_candidates (round_id, author_participant_id) where kind = 'custom';
create index if not exists psyco_candidates_room_rule_idx on public.psyco_candidates (room_id, rule_id) where rule_id is not null;
create index if not exists psyco_candidates_round_idx on public.psyco_candidates (round_id, created_at);
alter table public.psyco_candidates enable row level security;
revoke all on table public.psyco_candidates from anon, authenticated;
comment on table public.psyco_candidates is 'PSYCO: regole proposte nella manche (archivio o scritte dai giocatori, mai pubblicate altrove)';

create table if not exists public.psyco_votes (
  round_id uuid not null references public.psyco_rounds (id) on delete cascade,
  ballot text not null,
  participant_id uuid not null references public.psyco_participants (id) on delete cascade,
  choice text not null check (char_length(choice) between 1 and 64),
  created_at timestamptz not null default now(),
  primary key (round_id, ballot, participant_id)
);
alter table public.psyco_votes enable row level security;
revoke all on table public.psyco_votes from anon, authenticated;
comment on table public.psyco_votes is 'PSYCO: voti (uno per partecipante e per votazione)';

create table if not exists public.psyco_guesses (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.psyco_rounds (id) on delete cascade,
  attempt_no integer not null,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  result text check (result in ('correct', 'wrong')),
  yes_votes integer,
  no_votes integer,
  unique (round_id, attempt_no)
);
alter table public.psyco_guesses enable row level security;
revoke all on table public.psyco_guesses from anon, authenticated;
comment on table public.psyco_guesses is 'PSYCO: tentativi dello PSYCO («HO CAPITO LA REGOLA!») con l''esito votato dal gruppo';

-- Televisore abbinato con il codice di 4 cifre di /tv: anche a una stanza PSYCO (riuso di tv_pairings)
alter table public.tv_pairings add column if not exists psyco_room_id uuid references public.psyco_rooms (id) on delete cascade;
comment on column public.tv_pairings.psyco_room_id is 'Abbinamento del TV a una stanza PSYCO (in alternativa a session_id)';

-- ---------------------------------------------------------------------
-- Archivio iniziale: 60 regole originali (20 facili, 20 medie, 20 difficili).
-- Fonte: content/psyco/regole.json (scripts/psyco/regole-sql.mjs). Le modifiche fatte dal
-- pannello admin non vengono sovrascritte (on conflict do nothing).
-- ---------------------------------------------------------------------
insert into public.psyco_rules (slug, title, description, difficulty, instructions, example) values
  ($r$comincia-con-certo$r$, $r$Certo che sì$r$, $r$Ogni risposta deve cominciare con la parola «Certo».$r$, $r$facile$r$, $r$Vale anche quando la risposta è un no: «Certo, non ci sono mai stato».$r$, $r$«Che hai mangiato ieri?» → «Certo, una pizza enorme.»$r$),
  ($r$finisce-con-forse$r$, $r$Finale incerto$r$, $r$Ogni risposta deve finire con la parola «forse».$r$, $r$facile$r$, $r$Rispondete normalmente, ma chiudete sempre con «forse», anche se siete sicurissimi.$r$, $r$«Ti piace il mare?» → «Lo adoro, ci vado ogni estate, forse.»$r$),
  ($r$risposta-con-domanda$r$, $r$Botta e risposta$r$, $r$Si risponde sempre con un'altra domanda.$r$, $r$facile$r$, $r$Niente risposte dirette: rilanciate con una domanda che c'entri qualcosa.$r$, $r$«Che lavoro fai?» → «Secondo te ho la faccia da impiegato?»$r$),
  ($r$battito-di-mani$r$, $r$Applauso preventivo$r$, $r$Prima di rispondere si batte una volta le mani.$r$, $r$facile$r$, $r$Un solo battito, poi si risponde in modo normale. Se ve ne dimenticate, battetelo appena ve ne accorgete.$r$, $r$*clap* «Il mio colore preferito è il verde.»$r$),
  ($r$parola-banana$r$, $r$Parola d'ordine: banana$r$, $r$In ogni risposta deve comparire la parola «banana».$r$, $r$facile$r$, $r$Infilatela dove volete: all'inizio, in mezzo, alla fine. Più è naturale, meglio è.$r$, $r$«Dove vai in vacanza?» → «In montagna, con una banana nello zaino.»$r$),
  ($r$tocco-del-naso$r$, $r$Il naso che prude$r$, $r$Prima di rispondere ci si tocca il naso.$r$, $r$facile$r$, $r$Un gesto veloce e casuale, come se prudesse davvero. Poi si risponde normalmente.$r$, $r$(si tocca il naso) «Ho due fratelli.»$r$),
  ($r$nome-dello-psyco$r$, $r$Chiamalo per nome$r$, $r$Ogni risposta contiene il nome dello PSYCO.$r$, $r$facile$r$, $r$Rivolgetevi allo PSYCO chiamandolo per nome in ogni risposta, all'inizio o alla fine.$r$, $r$«Che film hai visto?» → «Mike, ho visto una commedia bruttissima.»$r$),
  ($r$terza-persona$r$, $r$In terza persona$r$, $r$Si parla di sé in terza persona, usando il proprio nome.$r$, $r$facile$r$, $r$Mai «io»: dite «Sara pensa…», «Luca non lo sa…».$r$, $r$«Ti piace cucinare?» → «Giulia cucina solo la pasta al pomodoro.»$r$),
  ($r$un-colore$r$, $r$Tavolozza$r$, $r$In ogni risposta bisogna nominare un colore.$r$, $r$facile$r$, $r$Qualsiasi colore, anche per sbaglio o in senso figurato: «una giornata nera» vale.$r$, $r$«Cosa hai fatto oggi?» → «Ho preso un caffè in un bar con le sedie gialle.»$r$),
  ($r$un-numero$r$, $r$Il contabile$r$, $r$Ogni risposta contiene un numero.$r$, $r$facile$r$, $r$Un numero qualsiasi: un'età, un orario, una quantità, un anno.$r$, $r$«Hai animali?» → «Avevo 3 pesci rossi.»$r$),
  ($r$un-animale$r$, $r$Lo zoo$r$, $r$In ogni risposta compare un animale.$r$, $r$facile$r$, $r$Va bene qualsiasi animale, anche in un modo di dire («ho una fame da lupi»).$r$, $r$«Com'è il tuo capo?» → «Lento come una tartaruga.»$r$),
  ($r$annuire-sempre$r$, $r$Testa che dice sì$r$, $r$Mentre si risponde si annuisce con la testa, anche quando si dice di no.$r$, $r$facile$r$, $r$Muovete la testa su e giù per tutta la risposta, senza esagerare troppo.$r$, $r$(annuendo) «No, non mi piacciono per niente le verdure.»$r$),
  ($r$parola-inglese$r$, $r$Very international$r$, $r$Ogni risposta contiene almeno una parola in inglese.$r$, $r$facile$r$, $r$Basta una parola vera e propria in inglese: quelle ormai italiane come «film» o «bar» non valgono.$r$, $r$«Cosa fai stasera?» → «Una serata relax sul divano, very chill.»$r$),
  ($r$braccia-conserte$r$, $r$Braccia conserte$r$, $r$Si risponde sempre con le braccia incrociate.$r$, $r$facile$r$, $r$Incrociate le braccia prima di parlare e scioglietele dopo. Se le avete già incrociate, va bene così.$r$, $r$(incrocia le braccia) «Sono nato a Bologna.»$r$),
  ($r$sguardo-al-soffitto$r$, $r$Ispirazione dall'alto$r$, $r$Prima di rispondere si guarda verso il soffitto.$r$, $r$facile$r$, $r$Uno sguardo verso l'alto, come per cercare la risposta, poi si risponde guardando chi si vuole.$r$, $r$(guarda in alto) «Direi la lasagna.»$r$),
  ($r$comincia-con-si$r$, $r$Sempre d'accordo$r$, $r$Ogni risposta comincia con «Sì», anche quando poi si dice il contrario.$r$, $r$facile$r$, $r$Prima «Sì», poi la risposta vera, anche se contraddice il sì.$r$, $r$«Sei mai stato a Parigi?» → «Sì, cioè no, mai.»$r$),
  ($r$pausa-di-tre-secondi$r$, $r$Pausa di riflessione$r$, $r$Prima di rispondere si resta in silenzio per circa tre secondi.$r$, $r$facile$r$, $r$Contate mentalmente fino a tre, senza farlo vedere, poi rispondete.$r$, $r$(…uno, due, tre…) «Il mio sport preferito è il tennis.»$r$),
  ($r$risposte-cantate$r$, $r$Il musical$r$, $r$Le risposte si cantano.$r$, $r$facile$r$, $r$Qualsiasi melodia, anche inventata e stonata: l'importante è cantare, non parlare.$r$, $r$♪ «Ieri sera ho mangiato il sushiii» ♪$r$),
  ($r$mano-alzata$r$, $r$Come a scuola$r$, $r$Prima di rispondere si alza la mano.$r$, $r$facile$r$, $r$Alzate la mano, aspettate un istante e solo dopo parlate.$r$, $r$(alza la mano) «Ho un cane che si chiama Briciola.»$r$),
  ($r$in-piedi$r$, $r$Sull'attenti$r$, $r$Chi risponde si alza in piedi e poi si risiede.$r$, $r$facile$r$, $r$Ci si alza per rispondere e ci si rimette seduti appena finito.$r$, $r$(si alza) «Lavoro in un ufficio.» (si siede)$r$),
  ($r$nei-panni-del-vicino-destra$r$, $r$Nei panni del vicino$r$, $r$Si risponde fingendo di essere il giocatore seduto alla propria destra.$r$, $r$media$r$, $r$Rispondete come risponderebbe chi vi sta a destra: i suoi gusti, il suo lavoro, la sua vita.$r$, $r$Sara ha Luca a destra. «Che lavoro fai?» → (Sara) «Faccio il cuoco.» (perché Luca è cuoco)$r$),
  ($r$tre-parole-esatte$r$, $r$Telegramma$r$, $r$Ogni risposta ha esattamente tre parole.$r$, $r$media$r$, $r$Né una di più né una di meno. Gli articoli contano come parole.$r$, $r$«Cosa hai fatto ieri?» → «Dormito tutto pomeriggio.»$r$),
  ($r$eco-ultima-parola$r$, $r$L'eco$r$, $r$Prima di rispondere si ripete l'ultima parola della domanda.$r$, $r$media$r$, $r$Ripetete l'ultima parola come un'eco, poi rispondete normalmente.$r$, $r$«Ti piace il cinema?» → «Cinema… sì, ci vado spesso.»$r$),
  ($r$iniziale-del-nickname$r$, $r$La firma$r$, $r$Ogni risposta comincia con la prima lettera del proprio nickname.$r$, $r$media$r$, $r$La prima parola della risposta deve iniziare con la stessa lettera del vostro nome in partita.$r$, $r$Marco: «Mai stato in Spagna.» · Luca: «Lì no, ma in Francia sì.»$r$),
  ($r$contrario-della-verita$r$, $r$Bugiardi seriali$r$, $r$Si risponde dicendo il contrario della verità.$r$, $r$media$r$, $r$Mentite sempre, ma con convinzione: se amate il mare, dite che lo odiate.$r$, $r$Chi è vegetariano: «Mangio carne a ogni pasto!»$r$),
  ($r$risponde-chi-sta-a-sinistra$r$, $r$Rimbalzo$r$, $r$La persona interrogata non risponde: risponde il giocatore alla sua sinistra.$r$, $r$media$r$, $r$Chi viene interrogato resta zitto (o fa finta di pensarci) e risponde al suo posto chi ha a sinistra, parlando in prima persona.$r$, $r$Lo PSYCO chiede a Sara; risponde Marco, alla sinistra di Sara: «Ho trent'anni.»$r$),
  ($r$domanda-precedente$r$, $r$In ritardo$r$, $r$Si risponde sempre alla domanda precedente, non a quella appena fatta.$r$, $r$media$r$, $r$Alla prima domanda della manche si risponde a caso; dalla seconda in poi si risponde alla domanda di prima.$r$, $r$Domanda 1: «Dove vivi?» Domanda 2: «Cosa mangi?» → «A Torino.»$r$),
  ($r$come-bambini$r$, $r$Cinque anni$r$, $r$Si risponde come se si avessero cinque anni.$r$, $r$media$r$, $r$Pensieri, parole e logica da bambino piccolo, ma senza esagerare con le vocine.$r$, $r$«Che lavoro fai?» → «Faccio il dinosauro, ma solo il sabato.»$r$),
  ($r$persona-famosa$r$, $r$Vita da star$r$, $r$Ognuno risponde come se fosse una persona famosa, sempre la stessa per tutta la manche.$r$, $r$media$r$, $r$Ognuno sceglie in segreto il proprio personaggio famoso (vero o di fantasia) e risponde come lui.$r$, $r$Chi ha scelto un calciatore: «Domenica ho segnato due gol.»$r$),
  ($r$tutti-in-crociera$r$, $r$Tutti in crociera$r$, $r$Tutti rispondono come se fossero in vacanza insieme su una nave da crociera.$r$, $r$media$r$, $r$Le risposte parlano della vita a bordo, come se foste lì in questo momento, tutti sulla stessa nave.$r$, $r$«Cosa hai fatto oggi?» → «Piscina al ponte sette, poi buffet.»$r$),
  ($r$vietato-si-e-no$r$, $r$Né sì né no$r$, $r$Nelle risposte non si possono dire «sì» né «no».$r$, $r$media$r$, $r$Trovate sempre un altro modo: «assolutamente», «per niente», «direi di sì» non vale!$r$, $r$«Ti piace il calcio?» → «Lo guardo ogni domenica.»$r$),
  ($r$stessa-iniziale-della-domanda$r$, $r$Lettera rubata$r$, $r$La risposta comincia con la stessa lettera con cui comincia la domanda.$r$, $r$media$r$, $r$Guardate la prima lettera della domanda dello PSYCO: la vostra prima parola deve iniziare uguale.$r$, $r$«Dove sei nato?» → «Da qualche parte in Puglia.»$r$),
  ($r$complimento-allo-psyco$r$, $r$Adulatori$r$, $r$Ogni risposta contiene un complimento allo PSYCO.$r$, $r$media$r$, $r$Un complimento piccolo e naturale, dentro la risposta: sui capelli, sulla domanda, sull'intelligenza.$r$, $r$«Che musica ascolti?» → «Rock, ma ottima domanda, sei sempre così brillante.»$r$),
  ($r$una-lamentela$r$, $r$Brontoloni$r$, $r$Ogni risposta contiene una lamentela.$r$, $r$media$r$, $r$Qualunque sia la domanda, trovate qualcosa di cui lamentarvi.$r$, $r$«Dove vai in vacanza?» → «Al lago, ma c'è sempre troppa gente.»$r$),
  ($r$mai-guardare-lo-psyco$r$, $r$Sguardo altrove$r$, $r$Chi risponde non guarda mai lo PSYCO negli occhi.$r$, $r$media$r$, $r$Guardate un altro giocatore, il tavolo o il soffitto, ma mai lo PSYCO mentre rispondete.$r$, $r$(guardando Giulia) «Mi piace il cioccolato fondente.»$r$),
  ($r$fissazione-cucina$r$, $r$Chiodo fisso$r$, $r$Ogni risposta, in qualche modo, finisce per parlare di cibo.$r$, $r$media$r$, $r$Partite dalla domanda, ma arrivate sempre a parlare di qualcosa da mangiare.$r$, $r$«Che auto hai?» → «Una piccola, ci entra a malapena la spesa del sabato.»$r$),
  ($r$tutto-al-passato$r$, $r$Ricordi$r$, $r$Si risponde sempre al passato, anche quando la domanda è sul presente o sul futuro.$r$, $r$media$r$, $r$Usate solo verbi al passato, come se tutto fosse già successo.$r$, $r$«Cosa farai domani?» → «Sono andato al mare.»$r$),
  ($r$niente-io$r$, $r$Ego vietato$r$, $r$Nelle risposte non si possono usare «io», «me», «mi» e «mio».$r$, $r$media$r$, $r$Parlate di voi senza mai usare queste parole. Ci vuole fantasia!$r$, $r$«Che sport fai?» → «Nuoto, tre volte a settimana.»$r$),
  ($r$parlare-come-robot$r$, $r$Modalità robot$r$, $r$Si risponde come un robot: voce piatta, frasi brevissime, nessuna emozione.$r$, $r$media$r$, $r$Niente risate e niente intonazione: frasi corte, voce monotona.$r$, $r$«Ti piacciono i gatti?» → «Gatti. Valutazione positiva. Fine.»$r$),
  ($r$domanda-di-ritorno-sullo-psyco$r$, $r$Specchio riflesso$r$, $r$Dopo aver risposto si fa sempre la stessa domanda allo PSYCO.$r$, $r$media$r$, $r$Rispondete, poi girate la domanda: «E tu?». Lo PSYCO non deve per forza rispondere.$r$, $r$«Che film ti piace?» → «Le commedie. E a te?»$r$),
  ($r$pari-due-dispari-quattro$r$, $r$Pari e dispari$r$, $r$Se la domanda ha un numero pari di parole si risponde con due parole; se è dispari, con quattro.$r$, $r$difficile$r$, $r$Contate le parole della domanda (articoli compresi): pari → risposta di 2 parole, dispari → risposta di 4.$r$, $r$«Ti piace il mare?» (4, pari) → «Moltissimo, sempre.» · «Che lavoro fai?» (3, dispari) → «Faccio il medico, ovviamente.»$r$),
  ($r$vocale-si-consonante-no$r$, $r$Vocale o consonante$r$, $r$Se la domanda comincia con una vocale la risposta comincia con «Sì», altrimenti con «No».$r$, $r$difficile$r$, $r$Guardate solo la prima lettera della domanda. Dopo il «Sì» o il «No» potete dire quello che volete.$r$, $r$«Ami i gatti?» → «Sì, ne ho due.» · «Hai fratelli?» (H è consonante) → «No, ho una sorella.»$r$),
  ($r$domanda-e-affermazione-alternate$r$, $r$Altalena$r$, $r$Le risposte si alternano: una è una domanda, la successiva un'affermazione, e così via.$r$, $r$difficile$r$, $r$Vale per il gruppo intero, nell'ordine in cui si risponde: chi risponde dopo una domanda deve affermare, e viceversa.$r$, $r$Sara: «Perché lo chiedi?» · Luca: «Ho trent'anni.» · Giulia: «Ti sembro una che cucina?»$r$),
  ($r$ultima-lettera-del-precedente$r$, $r$Staffetta di lettere$r$, $r$La risposta deve contenere una parola che comincia con l'ultima lettera del nickname di chi ha risposto prima.$r$, $r$difficile$r$, $r$Ricordatevi chi ha parlato prima di voi e l'ultima lettera del suo nome.$r$, $r$Prima ha risposto Marco (O): «Ho un orto pieno di pomodori.»$r$),
  ($r$alfabeto-progressivo$r$, $r$Abbecedario$r$, $r$Ogni risposta comincia con la lettera successiva a quella con cui cominciava la risposta precedente.$r$, $r$difficile$r$, $r$La prima risposta comincia con A, poi B, C, D… Le lettere difficili (H, J, K, Q, X, Y, W) si possono saltare.$r$, $r$«Andato al cinema.» → «Bello il mare.» → «Cucino poco.»$r$),
  ($r$prima-ultima-lettera$r$, $r$Aggancio$r$, $r$La prima parola della risposta comincia con l'ultima lettera dell'ultima parola della domanda.$r$, $r$difficile$r$, $r$Ascoltate bene come finisce la domanda: l'ultima lettera è la vostra iniziale.$r$, $r$«Che cosa mangi a cena?» (finisce con A) → «Abbastanza poco.»$r$),
  ($r$stesso-numero-di-parole$r$, $r$Specchio di parole$r$, $r$La risposta ha lo stesso numero di parole della domanda.$r$, $r$difficile$r$, $r$Contate le parole della domanda e rispondete con esattamente lo stesso numero.$r$, $r$«Dove sei nato?» (3) → «A Napoli, credo.»$r$),
  ($r$vero-e-falso-alternati$r$, $r$Mezza bugia$r$, $r$Ognuno alterna le proprie risposte: una vera, una falsa, una vera…$r$, $r$difficile$r$, $r$La vostra prima risposta della manche è vera, la seconda falsa, la terza vera, e così via. Ognuno tiene il proprio conto.$r$, $r$Luca (1ª, vera): «Sono di Roma.» · Luca (2ª, falsa): «Ho dieci gatti.»$r$),
  ($r$braccia-dello-psyco$r$, $r$Il segnale$r$, $r$Se lo PSYCO ha le braccia incrociate si mente; altrimenti si dice la verità.$r$, $r$difficile$r$, $r$Prima di rispondere guardate le braccia dello PSYCO: incrociate → bugia, libere → verità.$r$, $r$Lo PSYCO chiede con le braccia incrociate: «Sai nuotare?» → (chi non sa nuotare) «Benissimo!»$r$),
  ($r$chiamato-per-nome-mente$r$, $r$Nome e cognome$r$, $r$Se lo PSYCO chiama per nome chi deve rispondere, la risposta è falsa; altrimenti è vera.$r$, $r$difficile$r$, $r$Fate attenzione a come vi interroga lo PSYCO: «Sara, che lavoro fai?» → bugia; «Che lavoro fai?» → verità.$r$, $r$«Luca, hai figli?» → (Luca non ne ha) «Tre!»$r$),
  ($r$risponde-chi-ha-risposto-prima$r$, $r$Il ritardatario$r$, $r$Non risponde chi viene interrogato, ma chi ha risposto alla domanda precedente.$r$, $r$difficile$r$, $r$Chi ha risposto per ultimo risponde di nuovo, in prima persona, a qualsiasi domanda successiva, finché lo PSYCO non interroga proprio lui: allora risponde chi era stato interrogato.$r$, $r$Ha appena risposto Giulia. Lo PSYCO chiede a Marco; risponde Giulia.$r$),
  ($r$catena-di-parole$r$, $r$Catena$r$, $r$Ogni risposta deve contenere l'ultima parola della risposta precedente.$r$, $r$difficile$r$, $r$Ascoltate come finisce la risposta di chi ha parlato prima e riusate quella parola nella vostra.$r$, $r$«…ho preso il treno.» → «Il treno mi fa venire sonno.»$r$),
  ($r$lunghezza-crescente$r$, $r$Scala$r$, $r$Ogni risposta ha una parola in più della precedente: una, due, tre, quattro, cinque, poi si ricomincia da una.$r$, $r$difficile$r$, $r$Vale per il gruppo intero, nell'ordine in cui si risponde.$r$, $r$«Sì.» → «Mi piace.» → «Vado in palestra.» → «Abito vicino al mare.»$r$),
  ($r$chi-indossa-nero-mente$r$, $r$Abito nero$r$, $r$Chi indossa qualcosa di nero mente; gli altri dicono la verità.$r$, $r$difficile$r$, $r$Controllate i vostri vestiti all'inizio della manche: anche un dettaglio nero conta.$r$, $r$Marco ha le scarpe nere: «Sono altissimo» (non è vero).$r$),
  ($r$domanda-chiusa-risposta-domanda$r$, $r$Porte chiuse$r$, $r$Se alla domanda si può rispondere con sì o no, si risponde con un'altra domanda; altrimenti si risponde normalmente.$r$, $r$difficile$r$, $r$«Ti piace il mare?» → domanda; «Dove vivi?» → risposta normale.$r$, $r$«Hai un cane?» → «Perché, ti sembro uno da cani?» · «Che cane hai?» → «Un bassotto.»$r$),
  ($r$rima-con-la-domanda$r$, $r$Poeti$r$, $r$La risposta deve fare rima con l'ultima parola della domanda.$r$, $r$difficile$r$, $r$L'ultima parola della vostra risposta fa rima con l'ultima parola della domanda.$r$, $r$«Cosa mangi a cena?» → «Una pizza piena.»$r$),
  ($r$copia-la-posizione-dello-psyco$r$, $r$Specchio umano$r$, $r$Chi risponde assume la stessa posizione dello PSYCO in quel momento.$r$, $r$difficile$r$, $r$Prima di parlare copiate con discrezione la postura dello PSYCO: mani, gambe, testa.$r$, $r$Lo PSYCO ha il mento sulla mano: chi risponde mette il mento sulla mano.$r$),
  ($r$mano-sul-tavolo$r$, $r$Il testimone$r$, $r$Chi ha risposto per ultimo tiene una mano appoggiata sul tavolo finché qualcun altro non risponde.$r$, $r$difficile$r$, $r$Appena finite di rispondere appoggiate una mano sul tavolo (o sulle ginocchia se non c'è un tavolo) e toglietela quando risponde un altro.$r$, $r$Sara risponde e appoggia la mano; quando risponde Luca, Sara la toglie e la appoggia Luca.$r$),
  ($r$parole-quanti-siamo$r$, $r$Contati$r$, $r$Ogni risposta ha tante parole quante sono le persone che conoscono la regola.$r$, $r$difficile$r$, $r$Contate quanti giocatori conoscono la regola (tutti tranne lo PSYCO): è il numero di parole di ogni risposta.$r$, $r$In quattro conoscono la regola: «Vivo in centro città.»$r$),
  ($r$prima-e-ultima-uguali$r$, $r$Cornice$r$, $r$La prima e l'ultima parola della risposta cominciano con la stessa lettera.$r$, $r$difficile$r$, $r$Scegliete la parola d'apertura pensando già a come chiudere.$r$, $r$«Che sport fai?» → «Pallavolo, quando posso.»$r$)
on conflict (slug) do nothing;
