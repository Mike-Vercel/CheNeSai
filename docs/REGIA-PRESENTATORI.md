# Regia automatica dei presentatori

I tre presentatori commentano la partita **reale** con i **nomi veri** dei concorrenti.
Nessuna battuta nasce senza un evento confermato dal server.

## Flusso

1. La regia preme **PUNTI** (comando `SCORE`): il server assegna i punti e ricalcola la classifica (`engine.ts`).
2. Nella stessa transazione, `directAfterScore` (`src/lib/server/show.ts`):
   - ricostruisce la classifica **prima/dopo** dai `score_events` ufficiali;
   - calcola le serie di risposte giuste/sbagliate e da quante domande lo stesso giocatore è primo;
   - rileva gli eventi con `detectShowEvents` (`src/lib/show/events.ts`, funzione pura);
   - fa scegliere al regista (`directShow`, `src/lib/show/director.ts`, puro e deterministico) **chi** parla e **quale** battuta, inserendo i nomi;
   - registra le battute in `show_dialogue_log` e le mette in `game_state.show_lines`.
   Se qualcosa va storto la regia automatica viene saltata (savepoint): **i punti restano sempre salvi**.
3. Lo stato pubblico espone `showLines` solo nella fase dei punti; il TV le dice con le voci ElevenLabs
   (generate subito in background dal pre-riscaldamento) e, se il servizio voce non risponde, con la voce del browser.

## Eventi rilevati

| Evento | Quando |
|---|---|
| Nuovo primo | un solo primo che prima non lo era |
| Pari merito in testa | più giocatori primi, situazione nuova |
| Primo da più domande | stesso primo da 3, 6, 9… domande |
| Sorpasso | A aveva meno punti di B e ora ne ha di più (entrambi in gioco: un abbandono non conta) |
| Rimonta | almeno +3 posizioni in una volta (da 6 giocatori) |
| Nuovo ultimo | nuovo ultimo da solo (da 4 giocatori) |
| Il più veloce | risposta giusta più rapida (se almeno 2 giuste) |
| Serie giuste / errori | 3, 5, 7, 10 giuste di fila · 3 o 5 sbagliate di fila |
| Uno solo giusto · Tutti sbagliano · Tutti giusti | sulle risposte della domanda |
| Soglia di punti | 10.000, 20.000, 30.000, 50.000 |
| Vincitore del round | all'ultima domanda del round |

## Regole del regista

- Al massimo N battute per momento (default 2: piccolo dialogo tra personaggi diversi).
- Eventi in ordine di importanza; mai lo stesso concorrente due volte nello stesso momento.
- Limite di menzioni per concorrente in un round (default 3; la vittoria del round si annuncia sempre).
- Ogni battuta ha il suo cooldown; scelta pesata ma deterministica (stesso seme = stessa frase anche se il TV ricarica).
- Segnaposto ammessi per evento: battute con segnaposto sconosciuti vengono rifiutate al salvataggio e scartate a runtime.
- I nickname passano dalla pulizia del testo vocale (niente tag o parentesi iniettati dai giocatori).

## Libreria e regia

- Libreria iniziale: `content/show/battute.json` (180 battute, 3 personaggi × 14 eventi).
  Importazione: `npx tsx --conditions=react-server scripts/import-battute.ts` (aggiunge solo le mancanti);
  se l'archivio è vuoto viene importata automaticamente alla prima assegnazione di punti.
- Admin → **Presentatori**: attivazione, battute per momento, menzioni per round, eventi abilitati;
  libreria con filtri, modifica, attiva/disattiva, elimina, nuova battuta, ▶ prova con un nome di prova (voce vera, in cache).
- Regia in diretta: riquadro **Presentatori** con interruttore dei commenti automatici e ultime battute dette.

## Test

- `tests/unit/show-director.test.ts`: rilevamento eventi (nuovo primo, sorpasso non per abbandono, pari merito, serie, rimonta, ultimo, soglie, fine round) e regista (nomi veri, segnaposto rifiutati, limiti, cooldown, determinismo).
- `tests/integration/show-director.test.ts`: partita vera sul database (4 giocatori, uno solo giusto) → i presentatori nominano solo chi ha davvero risposto giusto; registro aggiornato; battute solo nella fase dei punti.

## Da fare

- Squadre (classifica e battute di squadra senza attribuire a un singolo i risultati collettivi).
- Animazione del personaggio che parla guidata da `animation` della battuta.
- Scenette a più battute pre-scritte (oggi: dialogo spontaneo fino a 3 battute di personaggi diversi).
- Commenti anche in altri momenti (lobby, ingresso di un concorrente, finalissima) con le stesse regole.
