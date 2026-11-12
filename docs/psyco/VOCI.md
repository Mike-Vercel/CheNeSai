# PSYCO – voce narrante e colonna sonora

Voce propria del gioco, registrata dall'utente (niente ElevenLabs). Mappa id → testo e momenti in **un solo file**: `src/features/psyco/narrator.ts` (`VOICE_LINES`, `cuesFor`, `TIMER_WARNINGS`).

## File

- Sorgenti (mai modificate): `REFERENCE/GIOCHI/PSYCO/AUDIO/NARRATORE/<id>.mp3` e `REFERENCE/GIOCHI/PSYCO/COLONNE_SONORE/PSYCO.mp3`.
- Nel sito: `public/audio/psyco/<id>.mp3` e `public/audio/psyco/tema.mp3`.
- `npm run psyco:voci` (nel repo principale) oppure `npm run psyco:voci -- --ref ../QUIZZONE/REFERENCE` da un worktree: copia, normalizza con ffmpeg (loudnorm: voci −16 LUFS, musica −20 LUFS, 128 kbps) e aggiunge dissolvenze alla musica per il loop. Senza ffmpeg copia e basta. Segnala i clip mancanti.

## Dove suona

| Dispositivo | Musica | Voce | Effetti |
|---|---|---|---|
| Schermo TV/PC pubblico | sì | sì | sì |
| Un solo dispositivo | sì (se nessuna TV collegata) | sì (se nessuna TV) | sì |
| Telefono di chi gestisce, senza TV | sì | sì | sì |
| Altri telefoni personali | no (attivabile dal pannello Audio) | no | sì |

Pannello **Audio** in ogni schermata: audio attivo/muto, musica, voce, effetti, volume (preferenze salvate sul dispositivo). Musica in loop basso in sala d'attesa, ruoli, scelta della regola e fine manche; quasi muta in PLAYING e durante la verifica; si abbassa quando parla il narratore. Sblocco audio al primo tocco (Web Audio, come nel quiz); sulla TV c'è il pulsante «ATTIVA AUDIO».

Se un clip manca o non si carica: nessun errore, si mostra solo il sottotitolo. Il gioco non aspetta mai la voce.

## Momenti

| id | testo | quando |
|---|---|---|
| benvenuti | Benvenuti a PSYCO. Tutti conoscono la regola… tranne uno. | apertura della stanza in sala d'attesa |
| lobby-attesa | Entrate pure. Più siete, più sarà difficile. | subito dopo |
| minimo-giocatori | Servono almeno tre giocatori per cominciare. | l'host prova a iniziare con meno di 3 |
| ruoli-assegnati | I ruoli sono stati assegnati. Uno di voi è lo Psyco. | inizio della manche |
| passa-telefono | Passa il telefono al prossimo giocatore. Senza sbirciare. | un solo dispositivo, a ogni passaggio |
| guarda-ruolo | Guarda il tuo ruolo. E non farti vedere. | un solo dispositivo, dopo «SONO …» |
| tutti-visto | Tutti conoscono il proprio ruolo. Si comincia. | tutti hanno visto il ruolo |
| psyco-non-guardare | Psyco, non guardare. Gli altri stanno scegliendo la regola. | inizio della scelta |
| scegliete-difficolta | Scegliete la difficoltà della regola. | modalità automatica |
| votate-regola | Leggete la regola e votate. Vi piace? | prima regola proposta |
| nuova-regola | Non vi convince? Eccone un'altra. | regola bocciata, nuova proposta |
| scrivete-regole | Scrivete la vostra regola. Più è subdola, meglio è. | modalità libera |
| votate-proposte | Votate la regola migliore. | voto sulle proposte |
| spareggio | Parità. Si vota di nuovo. | spareggio (proposte o tentativo) |
| regola-scelta | La regola è stata scelta. Psyco, preparati a scoprirla. | regola confermata |
| pronti | Tutti pronti? | subito dopo |
| countdown | Tre… due… uno… | conto alla rovescia |
| via | Via! Psyco, fai le tue domande. | al via |
| senza-tempo | Nessun limite di tempo… | al via, se senza limite |
| pausa / ripresa | Pausa. / Si riprende. | pausa e ripresa dell'host |
| un-minuto / trenta-secondi / dieci-secondi | … | solo se la durata li supera, mai in pausa né in verifica, una volta per manche |
| ho-capito | Lo Psyco crede di aver capito… | «HO CAPITO LA REGOLA!» |
| votate-risposta | Ha indovinato? Votate. | subito dopo |
| risposta-giusta / risposta-sbagliata | … | esito del tentativo |
| tempo-scaduto | Tempo scaduto! … | timer a zero |
| ecco-la-regola | Ecco qual era la regola. | a ogni fine manche |
| vince-psyco / vince-gruppo | … | esito della manche |
| nuova-manche | Nuova manche. Nuovo Psyco. Nuova regola. | dalla seconda manche |
| fine-partita | Fine della partita… | stanza chiusa |

## Voce con il nome del giocatore (non ancora fatta)

La voce dei clip è «Gottfried - Dark Thriller & Crime» di ElevenLabs (id nella variabile `ELEVENLABS_VOICE_INVESTIGATORE`, solo in `.env.local`/Vercel, documentata senza valore in `.env.example`). Le battute col nome («Mike, tocca a te…») tramite il TTS del quiz NON sono state aggiunte: il ruolo voce è un tipo chiuso usato da pannello Voci, configurazione per ruolo, battute del quiz e da un vincolo `check (role in ('professore','regina','palmino','annunciatore'))` su `tts_clips`. Aggiungere «investigatore» richiede una migrazione che cambia quel vincolo (tabella del quiz) e modifiche al pannello admin: non è un intervento «semplice e senza rischi» per il quiz, quindi è rimandato. Quando si farà: nuovo ruolo in `TTS_ROLES` (src/features/game/script.ts) + `VOICE_ENV.investigatore = "ELEVENLABS_VOICE_INVESTIGATORE"` (src/lib/server/tts.ts) + migrazione sul vincolo + endpoint autenticato per la stanza PSYCO; sul client, in `PassTheDevice` (SharedApp.tsx), provare la clip col nome con un limite di 1,5 s e ripiegare su `passa-telefono` / `guarda-ruolo`.
