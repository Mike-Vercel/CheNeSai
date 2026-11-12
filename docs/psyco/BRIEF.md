# CLAUDE CODE — SVILUPPO COMPLETO DEL MINIGIOCO PSYCO (testo dell'utente, integrale)

## 0. CONTESTO E OBIETTIVO
Stiamo sviluppando CHE NE SAI?!, una piattaforma web di intrattenimento con giochi originali, multiplayer e party game. Il sito è già stato realizzato e contiene il Quiz Pub principale, caratterizzato da un'identità grafica vivace, animazioni, personaggi 3D e un'esperienza da game show.
Ora voglio aggiungere il primo minigioco indipendente:
# PSYCO — "Tutti conoscono la regola. Tranne te."
PSYCO è un party game psicologico e sociale nel quale i partecipanti devono rispettare una regola segreta mentre un giocatore cerca di scoprirla.
**Non devi creare un progetto separato. Devi integrare PSYCO nel sito CHE NE SAI?! già esistente.** Devi realizzarlo completamente, non come demo o semplice mockup.
Prima di scrivere codice, analizza il repository e individua: framework e linguaggi; struttura frontend e backend; database e ORM; sistema di autenticazione; funzionalità multiplayer già presenti; eventuali sistemi realtime; design system e librerie UI; struttura delle rotte; sistema di deployment e configurazione Vercel; possibili componenti riutilizzabili. Non presumere lo stack tecnologico. Preserva tutte le funzionalità esistenti, soprattutto il Quiz Pub.

# 1. IL CONCETTO DEL GIOCO
PSYCO si gioca con almeno tre partecipanti. Non deve esserci un limite massimo artificiale.
Esempio con cinque giocatori: Sara, Mike, Luca, Giulia, Marco.
All'inizio della manche il sistema assegna un ruolo particolare a un giocatore: quel giocatore diventa lo **PSYCO**. Lo PSYCO ha il compito di indovinare una regola segreta. Tutti gli altri giocatori devono scegliere insieme la regola, conoscerla e rispettarla.
Esempio: Mike viene selezionato come PSYCO. Sara, Luca, Giulia e Marco scelgono la regola: "Ogni persona deve rispondere alle domande fingendo di essere il giocatore seduto alla propria destra." Mike non conosce questa regola. Durante il round Mike pone domande agli altri. Gli altri devono rispondere rispettando il comportamento segreto. Mike deve capire quale regola stanno seguendo.
**NESSUNO DEVE USCIRE DALLA STANZA.** Tutti possono rimanere seduti insieme. I dispositivi servono per assegnare i ruoli, scegliere la regola, votare, gestire il timer e seguire la partita. Il gioco si svolge principalmente attraverso conversazioni reali tra i partecipanti. Non obbligare i giocatori a scrivere le domande o le risposte.

# 2. NUMERO DI GIOCATORI
Minimo 3 partecipanti. Nessun numero massimo imposto artificialmente. Deve poter funzionare con 3, 5, 10, 20, 50 o più persone. La partita non può cominciare con meno di 3 partecipanti attivi. Numero dinamico. Gestire gruppi numerosi senza compromettere le prestazioni. Non introdurre limiti fissi come MAX_PLAYERS = 10. L'assenza di un massimo di gameplay non significa capacità infrastrutturale infinita: valuta e documenta i limiti reali. Interfacce scalabili, evitando di visualizzare centinaia di elementi contemporaneamente quando non necessario.

# 3. AUTENTICAZIONE — REQUISITO FONDAMENTALE
Questa sezione sostituisce qualsiasi precedente indicazione che prevedesse ospiti anonimi nel multiplayer. L'obbligo di registrazione dipende da come si gioca.
## A. Un solo dispositivo condiviso
Se cinque persone giocano con un solo cellulare: **BASTA UN SOLO ACCOUNT REGISTRATO.** Sara accede, seleziona PSYCO, "Un solo dispositivo", inserisce cinque nickname (incluso il proprio). Gli altri NON creano account: sono partecipanti locali identificati da nickname. Vale anche per PC o tablet usato come unico dispositivo condiviso. Il creatore autenticato è proprietario e gestore della sessione. Non creare account fittizi.
## B. Un dispositivo personale per ogni giocatore
**OGNI PARTECIPANTE DEVE ESSERE REGISTRATO E AUTENTICATO.** Sara crea la partita; QR code e codice; gli altri scansionano; se autenticati entrano, altrimenti login o registrazione e poi vengono riportati automaticamente alla stanza corretta. Nessun utente anonimo può partecipare dal proprio dispositivo personale. Ogni partecipante associato al proprio account. Un account non può occupare più posti autonomi nella stessa partita multiplayer.
## C. PC/TV e telefoni
Se il PC crea e gestisce la partita, l'host deve essere autenticato. Se gli altri partecipano dal proprio telefono, anche loro autenticati. Se un unico dispositivo viene passato, basta l'account di chi ha creato la partita. Uno schermo TV usato solo per timer, QR e stato pubblico non è un partecipante e non richiede account.
## D. Riutilizzo autenticazione esistente
Non implementare un secondo sistema di login: riutilizza account, sessioni, login, registrazione, profilo, provider OAuth, protezioni esistenti. Distingui chiaramente nel database e nella logica: 1) utenti registrati; 2) partecipanti locali di una partita a dispositivo condiviso; 3) dispositivi usati solo come schermi pubblici.

# 4. MODALITÀ DI GIOCO
## MODALITÀ 1 — UN SOLO CELLULARE / DISPOSITIVO (importantissima)
1. Utente registrato accede. 2. Pagina PSYCO. 3. "Un solo dispositivo". 4. Inserisce i nickname di tutti, incluso il proprio. 5. Imposta la partita. 6. "Inizia". 7. Assegnazione ruoli. 8. Il telefono viene passato a turno. 9. Ognuno vede privatamente il proprio ruolo. 10. Conferma. 11. Schermata neutra per il passaggio. 12. Fino a quando tutti hanno visto il ruolo.
Esempio: "PASSA IL TELEFONO A MIKE" → Mike preme "SONO MIKE — MOSTRA IL MIO RUOLO" → "SEI LO PSYCO!" → "HO VISTO IL MIO RUOLO" → la schermata nasconde subito l'informazione → "PASSA IL TELEFONO A LUCA" e così via.
Nessuno deve allontanarsi. Chi deve indovinare non deve guardare durante la scelta della regola. Schermate di copertura per impedire rivelazioni accidentali. Dopo l'assegnazione, tutti quelli che conoscono la regola la scelgono insieme sul dispositivo condiviso; anche proposte e votazioni passando il telefono. Terminata la scelta, il telefono mostra la schermata pubblica del round. Timer visibile a tutti. La regola non deve comparire accidentalmente durante la manche. Non usare altri telefoni come requisito nascosto.
## MODALITÀ 2 — MULTIPLAYER CON DISPOSITIVI PERSONALI
Ognuno con il proprio dispositivo e account. Un giocatore crea una stanza; gli altri entrano con QR, link di invito o codice. Dopo l'autenticazione entrano con profilo e nickname. Sincronizzazione in tempo reale. Ruolo privato. Gli aventi diritto vedono regole e votazioni. Lo PSYCO non deve poter accedere alla regola segreta. Aggiornamento automatico senza ricaricare.
## MODALITÀ 3 — PC / TV CON QR CODE
L'host apre il sito da PC, accede, crea la partita. Sullo schermo: logo PSYCO, codice stanza, QR, numero partecipanti, nickname, stato, timer, numero della manche, risultati pubblici. I giocatori entrano con dispositivi personali autenticati. Lo schermo condiviso non deve mostrare regole segrete, proposte riservate, voti individuali riservati, informazioni private. Prevedi una modalità display pubblica dedicata, separata dalle interfacce private.

# 5. CREAZIONE DELLA STANZA
Homepage del minigioco: CREA PARTITA, ENTRA IN PARTITA, UN SOLO DISPOSITIVO, COME SI GIOCA.
Multiplayer: host autenticato crea la stanza; codice univoco; QR; link di invito; login/registrazione se serve; ingresso; lobby in tempo reale; l'host avvia con almeno tre persone. L'host può essere anche giocatore.
Prevedi: recupero sessione, riconnessione, disconnessioni, abbandono, trasferimento della gestione se l'host abbandona, protezione dei codici stanza, pulizia delle stanze inattive, prevenzione degli accessi duplicati.

# 6. ASSEGNAZIONE DEI RUOLI
A ogni manche **UNO E UN SOLO PSYCO**. Tutti gli altri conoscono la regola. Assegnazione automatica con rotazione equa (con 5 giocatori tutti fanno lo PSYCO prima di ricominciare il ciclo). Non sempre la stessa persona. Eventualmente selezione manuale da parte dell'host.
PSYCO: "SEI LO PSYCO!" — "Gli altri conoscono una regola segreta. Scoprila prima che finisca il tempo!"
Altri: "CONOSCERAI LA REGOLA!" — "Insieme agli altri dovrai scegliere una regola e rispettarla durante la manche."
Assegnazioni e stati gestiti dal server nel multiplayer.

# 7. SCELTA DELLA REGOLA — DUE MODALITÀ
AUTOMATICA e LIBERA. Il creatore imposta la modalità, ma **la regola concreta viene scelta dal gruppo, mai unilateralmente**. Lo PSYCO è escluso da scelta e visualizzazione.
## 7A. AUTOMATICA
Archivio di regole pronte. Difficoltà FACILE, MEDIA, DIFFICILE. Non obbligare una difficoltà: i giocatori che conoscono la regola la scelgono insieme. Il sistema propone una regola casuale della difficoltà. Tutti gli aventi diritto la leggono. Il gruppo può votare per accettarla, richiederne un'altra, confermare. Procedura trasparente (es. maggioranza degli aventi diritto). Senza consenso, nuova regola o nuova votazione. Non riproporre la stessa regola nella stessa sessione finché esistono alternative. Non rivelarla allo PSYCO.
## 7B. LIBERA
Il gruppo inventa la regola; tutti quelli che la conoscono possono contribuire; nessuna singola persona incaricata obbligatoriamente. Flusso: proposte di ogni autorizzato → mostrate agli autorizzati → voto → proposta vincente → spareggio in caso di parità → conferma → visibile agli aventi diritto → lo PSYCO non la riceve. Esempio: "Ogni volta che Mike fa una domanda, tutti devono rispondere usando una parola che inizia con la lettera S." Testo libero con validazione, campi vuoti, protezione XSS, limiti tecnici di lunghezza. Le regole personalizzate non diventano automaticamente pubbliche nel database generale.
## 7C. SCELTA CON UN SOLO TELEFONO
Automatica: gli autorizzati vedono a turno difficoltà e regole proposte, votano sullo stesso telefono, un voto per partecipante, schermata neutra tra i turni. Libera: ognuno può inserire una proposta, si raccolgono, si vota a turno, risultato condiviso, conferma. Il telefono non deve restare su una schermata con la regola quando viene passato allo PSYCO. Lo PSYCO non partecipa. Nella modalità condivisa la segretezza dipende anche dall'uso fisico: non promettere segretezza assoluta.

# 8. DATABASE DELLE REGOLE
Archivio iniziale di almeno 50 regole realmente giocabili, divise in Facile/Media/Difficile. Campi minimi: ID, titolo, descrizione, difficoltà, eventuali istruzioni, eventuali esempi, stato attivo/inattivo.
Esempi FACILI: tutte le risposte iniziano con "Certo"; ogni risposta termina con "forse"; si risponde solo con una domanda; prima di rispondere battere una volta le mani; tutte le risposte contengono "banana".
Esempi MEDI: rispondere fingendo di essere la persona alla propria destra; risposte di esattamente tre parole; ripetere l'ultima parola della domanda prima di rispondere; iniziare la risposta con la prima lettera del proprio nickname; rispondere in modo contrario alla verità.
Esempi DIFFICILI: numero pari di parole nella domanda → risposta di due parole, dispari → quattro; domanda che inizia con vocale → risposta che inizia con "Sì", altrimenti "No"; risposte alternate tra interrogativa e affermativa; usare una parola che inizi con l'ultima lettera del nickname del giocatore precedente; ogni risposta inizia con la lettera successiva a quella della risposta precedente.
Regole originali, varie, divertenti, eseguibili, non 50 varianti quasi identiche, funzionanti anche con tre partecipanti. Valuta l'amministrazione dal pannello esistente.

# 9. TIMER PERSONALIZZABILE
Il tempo NON deve essere preimpostato: non solo pulsanti 3/5/10. L'host sceglie liberamente minuti e secondi (es. 01:30, 04:25, 07:45, 12:10, 30:00 — esempi, non limiti). Opzione **SENZA LIMITE DI TEMPO** (il round non termina per scadenza). Validazione: minuti ≥ 0, secondi 0–59, durata > 0 se timer attivo. Nessun massimo arbitrario non motivato. Timer: sincronizzato, riferimento temporale autorevole, resistente a refresh e sospensione del browser, visibile sul display pubblico, pausa e ripresa dall'host, modificabile tra una manche e l'altra. Non contatori locali indipendenti in multiplayer.

# 10. PREPARAZIONE DELLA MANCHE
Dopo la scelta: gli autorizzati vedono la regola confermata; lo PSYCO vede "LA REGOLA È STATA SCELTA!" "PREPARATI A SCOPRIRLA!". Si attende che i giocatori siano pronti. Al via: countdown di avvio, parte il timer, stato PLAYING, si parla liberamente. La preparazione non consuma il tempo della manche. Con un solo telefono, prima dell'avvio tutte le informazioni segrete nascoste dalla schermata pubblica.

# 11. SVOLGIMENTO
Lo PSYCO pone domande, osserva, confronta, cerca schemi, tenta di indovinare. Gli altri rispettano la regola. Conversazione libera; niente domande da elenco; niente riconoscimento vocale obbligatorio; niente AI che giudica se una regola è rispettata (decidono i partecipanti). Schermata: numero round, nome dello PSYCO, giocatori, timer, pulsante "HO CAPITO!", controlli host se autorizzato. Info segrete solo agli aventi diritto.

# 12. TENTATIVI E RISPOSTA CORRETTA
Lo PSYCO preme **"HO CAPITO LA REGOLA!"** → fase di verifica; spiega a voce; gli altri votano se è corretta (niente confronto di stringhe). Corretta: fine manche, animazione di vittoria, regola mostrata, registrato che lo PSYCO ha indovinato. Sbagliata: messaggio di errore, la manche prosegue, il timer riprende dal residuo se sospeso. Nessun massimo fisso di tentativi per ora. Timer scaduto: fine manche, vince il gruppo, regola rivelata. Senza limite di tempo: fine per risposta corretta o conclusione manuale autorizzata. Gestione esplicita di votazioni e parità, mai partita bloccata.

# 13. MANCHE SUCCESSIVE
Più round consecutivi nella stessa stanza. A fine manche: risultato, regola rivelata, chi era lo PSYCO, nuova manche, PSYCO successivo, confermare o cambiare la modalità della regola, cambiare il timer, nuova scelta collettiva, avvio. Non ricreare la stanza; conservare partecipanti e sessione; rotazione equilibrata.

# 14. PUNTEGGI E CLASSIFICHE
Nessun sistema definitivo: niente formule (+100, penalità, bonus temporali, classifiche globali obbligatorie). Registra: partecipanti della manche, chi era lo PSYCO, regola scelta, difficoltà, esito, tempo impiegato, tentativi, numero della manche. Modello dati pronto per punteggi futuri.

# 15. DESIGN
Visivamente spettacolare, stile CHE NE SAI?!: colori accesi, forte identità, vero party game, animazioni fluide, transizioni curate, carte dei ruoli, rivelazioni animate, timer di grande impatto, pulsanti facili, feedback per votazioni e conferme, effetti di vittoria e sconfitta, effetti sonori disattivabili, elementi luminosi e tridimensionali dove opportuno. PSYCO riconoscibile come gioco indipendente ma chiaramente della piattaforma. Responsive: smartphone verticali, tablet, PC, TV. Niente look da gestionale, niente componenti generici. Non cambiare il logo principale del sito. Riutilizza componenti e colori esistenti quando possibile. Bello ma leggibile, veloce, accessibile.

# 16. SICUREZZA
Multiplayer: dispositivi personali autenticati; account verificato dal server; ognuno agisce solo per il proprio partecipante; niente voti doppi o per altri; la regola segreta non va mai inviata allo PSYCO; non nascondere dati con CSS; niente dati riservati nel JSON pubblico della stanza né negli eventi realtime pubblici; niente identificativi prevedibili; endpoint protetti; input validati; protezione XSS; concorrenza gestita. Nel dispositivo condiviso l'account proprietario gestisce più partecipanti locali solo in quella modalità; non usare l'eccezione per bypassare il login nel multiplayer personale. L'host non deve conoscere la regola se in quella manche è lo PSYCO. Lo schermo pubblico non riceve dati privati.

# 17. ARCHITETTURA MULTIPLAYER
Usa il realtime già presente se adeguato, compatibile con Vercel. Lo stato del browser non è la fonte di verità. Macchina a stati esplicita (es. LOBBY, ROLE_ASSIGNMENT, ROLE_REVEAL, RULE_MODE_SELECTION, DIFFICULTY_SELECTION, RULE_PROPOSALS, RULE_VOTING, RULE_CONFIRMATION, WAITING_FOR_READY, PLAYING, GUESS_PENDING, GUESS_VOTING, ROUND_FINISHED, NEXT_ROUND), adattata ad automatica e libera. Transizioni validate dal server. Gestire refresh, disconnessioni, riconnessioni, eventi duplicati, voti simultanei, abbandono host, stanze inattive, nuova manche, cambiamenti nel gruppo, ingressi a partita in corso senza alterare il round. Operazioni idempotenti; DB coerente con richieste simultanee.

# 18. PAGINE E COMPONENTI
Integra PSYCO nel catalogo dei giochi. Interfacce per: scheda nella piattaforma; homepage del minigioco; come si gioca; creazione partita; accesso con codice o QR; login obbligatorio per dispositivi personali; un solo dispositivo; nickname; lobby; timer; assegnazione ruoli; rivelazione privata; scelta automatica/libera; scelta collettiva difficoltà; regole proposte; regole personalizzate; votazione; conferma; attesa dello PSYCO; preparazione; gioco; tentativo; votazione sulla risposta; vittoria/sconfitta; risultati; manche successiva; display PC/TV. Non servono 27 pagine: componenti e flussi coerenti.

# 19. TEST OBBLIGATORI
1. Un solo telefono: 5 persone, 1 account; nickname, ruoli, scelta collettiva, gioco, indovinare, fine, seconda manche, senza altre registrazioni.
2. Cinque telefoni: tutti con login; un non autenticato non entra come giocatore: va al login e torna alla stanza.
3. PC e TV: il PC crea, la TV mostra il QR, partecipanti con account; il display pubblico non mostra segreti.
4. Minimo giocatori: con 2 non si inizia, con 3 sì.
5. Nessun massimo: nessun limite fisso; prove simulate con 50 e 100; documenta i limiti osservati.
6. Timer: 01:30, 07:45, 12:10, senza limite, pausa, ripresa, refresh, sincronizzazione.
7. Regole automatiche: difficoltà collettiva, proposta, voto, cambio regola, conferma.
8. Regole libere: ogni avente diritto propone, tutti votano, vincente confermata.
9. Sicurezza: lo PSYCO non ottiene la regola via API, payload, realtime o schermate pubbliche.
10. Disconnessioni: refresh, perdita di rete, ritorno online.
11. Più manche: almeno due senza nuova stanza; rotazione dei ruoli.
12. Autenticazione: un account basta nel condiviso; ogni dispositivo personale ha un account; niente anonimi nel multiplayer personale; il QR preserva l'invito durante il login; il display TV non è un partecipante.
Non dichiarare superati test non eseguiti.

# 20. INTEGRAZIONE E DEPLOYMENT
Analizza, identifica il riutilizzabile, struttura coerente, implementa incrementale, test, verifica che il Quiz Pub funzioni. Non cancellare dati, niente migrazioni distruttive, niente segreti nel client, niente servizi a pagamento senza segnalare costi. Non eseguire il deploy in produzione senza approvazione.

# 21. COME DEVI LAVORARE
Fasi: analisi, architettura, implementazione, controlli (test, build, lint), correzioni, consegna (funzionalità, file creati/modificati, migrazioni, variabili d'ambiente, test e risultati, cose incomplete, costi, cosa serve per pubblicare). Decisioni ordinarie in autonomia. Se un requisito non è realizzabile, spiega e proponi soluzione. Non fingere completezza.

# 22. REQUISITI NON NEGOZIABILI
1 Si chiama PSYCO. 2 Parte di CHE NE SAI?!. 3 Minimo tre. 4 Nessun massimo artificiale. 5 Un solo PSYCO per manche. 6 Gli altri conoscono la stessa regola. 7 Regola scelta collettivamente. 8 Automatica con regole preimpostate. 9 Facile/media/difficile. 10 Libera con regole scritte. 11 Votazioni collettive. 12 Timer personalizzabile. 13 Anche senza timer. 14 Un solo cellulare. 15 Più cellulari. 16 PC e tablet. 17 PC/TV con QR. 18 Un account basta col dispositivo condiviso. 19 Account obbligatorio per ogni dispositivo personale. 20 Nessuno esce dalla stanza. 21 Ruoli privati. 22 Regola mai rivelata allo PSYCO. 23 Più manche. 24 Niente punteggi definitivi. 25 Design coerente con CHE NE SAI?!. 26 Realmente funzionante. 27 Quiz Pub non compromesso.

RISULTATO FINALE: aprire CHE NE SAI?!, selezionare PSYCO e giocare davvero con gli amici. Un solo telefono → un solo account. Ognuno il suo telefono → tutti registrati. Creare la partita, scegliere il tempo, assegnare i ruoli, scegliere collettivamente una regola automatica o personalizzata, giocare, indovinare, manche successiva. Curato graficamente, sicuro, responsive, funzionante.
