# PSYCO – nessun massimo di giocatori, ma limiti reali

Nel codice non c'è nessun `MAX_PLAYERS`: la partita parte con almeno 3 giocatori attivi e accetta chiunque entri. Le interfacce restano leggere: oltre 24 nomi la lista si compatta e scorre nel suo riquadro, lo schermo TV mostra gli ultimi 40 entrati più «+N altri», le votazioni mostrano solo il conteggio. Gli unici tetti sono tecnici (durata della manche ≤ 24 h perché le stanze inattive si chiudono dopo un giorno; regola libera ≤ 280 caratteri; nickname ≤ 20).

## Prove simulate (tests/integration/psyco-scale.test.ts)

Account veri di Supabase Auth locale, tutti che agiscono **nello stesso istante** (Promise.all), motore e database veri, sul PC di sviluppo (Supabase locale in Docker, pool di 10 collegamenti):

| Operazione (tutti insieme) | 50 giocatori | 100 giocatori |
|---|---|---|
| ingresso nella stanza | 486 ms | 942 ms |
| «ho visto il ruolo» | 287 ms | 683 ms |
| lettura della vista privata | 80 ms | 199 ms |
| voto difficoltà | 438 ms | 1 294 ms |
| voto sulla regola | 393 ms | 1 004 ms |
| «pronto» | 398 ms | 662 ms |
| voto sul tentativo | 574 ms | 813 ms |
| stato pubblico (= messaggio realtime) in sala d'attesa | 7,9 kB | 15,3 kB |
| stato pubblico durante una votazione | 14,4 kB | 27,7 kB |
| errori BUSY (lucchetto conteso) | 0 | 0 |

Risultato: stato sempre coerente (un solo PSYCO, nessun voto perso o doppio). Le azioni della stessa stanza passano in fila sul lucchetto della stanza (~6–13 ms l'una); oltre 40 giocatori i voti e i «visto/pronto» intermedi aggiornano il canale realtime al massimo ogni 1,5 s (gli altri arrivano col polling o col voto successivo), le transizioni di fase partono sempre subito.

## Dove sono i limiti veri (stime, da verificare in produzione)

- **Supabase Realtime**: ogni cambio di stato è UN messaggio inviato a tutti i collegati. Piano Free: 200 connessioni contemporanee e 100 messaggi/s per progetto; Pro: 500 connessioni (estendibili) e 500 msg/s; dimensione massima del messaggio 256 kB (Free) – lo stato di 100 giocatori ne occupa ~28 kB. Con 100 telefoni + TV una votazione rapida può superare 100 msg/s sul piano Free: per questo i voti intermedi delle stanze grandi sono limitati. Se il canale non regge, i client passano da soli al polling (2 s).
- **Polling di sicurezza**: ogni dispositivo legge lo stato ogni ~10 s (serve anche come «battito»): 100 giocatori ≈ 10 richieste/s ≈ 36 000 invocazioni/ora di funzioni Vercel. Il piano Hobby include 1 milione di invocazioni/mese: bastano molte serate normali, non decine di partite da 100 persone ogni giorno.
- **Database**: Supabase usa il pooler in transaction mode; le azioni sono transazioni brevi (decine di ms). Un'unica stanza da 100 non è un problema; molte stanze grandi insieme dipendono dal piano (collegamenti del pooler: 200 Free / 400+ Pro).
- **Supabase Auth**: ogni richiesta verifica la sessione col server Auth (getUser), come il resto del sito: con 100 giocatori ≈ 10 verifiche/s.
- **Vercel Hobby**: funzioni fino a 60 s (le azioni durano < 1 s), un cron giornaliero (riusato).

In sintesi: 50 persone in una stanza sono tranquille; 100 funzionano (provato) e sul piano Free di Supabase sono vicine al limite dei messaggi realtime nei momenti di voto; oltre 150–200 persone contemporanee serve il piano Pro di Supabase.
