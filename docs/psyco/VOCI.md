# PSYCO – voce narrante e colonna sonora

Voce propria del gioco: i 34 clip del narratore sono dell'utente; i 7 clip della chiamata all'Investigatore e di «tocca al prossimo» sono generati con ElevenLabs (vedi sotto). Mappa id → testo e momenti in **un solo file**: `src/features/psyco/narrator.ts` (`VOICE_LINES`, `cuesFor`, `TIMER_WARNINGS`, `CALL_VOICES`).

## File

- Sorgenti (mai modificate): `REFERENCE/GIOCHI/PSYCO/AUDIO/NARRATORE/<id>.mp3` e `REFERENCE/GIOCHI/PSYCO/COLONNE_SONORE/PSYCO.mp3`.
- Nel sito: `public/audio/psyco/<id>.mp3` e `public/audio/psyco/tema.mp3`.
- `npm run psyco:voci` (nel repo principale) oppure `npm run psyco:voci -- --ref ../QUIZZONE/REFERENCE` da un worktree: copia, normalizza con ffmpeg (loudnorm: voci −16 LUFS, musica −20 LUFS, 128 kbps) e aggiunge dissolvenze alla musica per il loop. Senza ffmpeg copia e basta. Segnala i clip mancanti.
  - `--solo-mancanti`: prepara solo i file che non ci sono ancora in `public/audio/psyco` (non ritocca i vecchi).
  - `--genera`: crea in REFERENCE **solo i file che mancano** (mai sovrascritti): voci dell'Investigatore con ElevenLabs e effetti della chiamata con ffmpeg (vedi sotto).
- Effetti della chiamata: `REFERENCE/GIOCHI/PSYCO/AUDIO/EFFETTI/<nome>.mp3` → `public/audio/psyco/<nome>.mp3`.

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

## «CHIAMA L'INVESTIGATORE» – clip generati (12 novembre 2026)

Voce «Gottfried - Dark Thriller & Crime» (`ELEVENLABS_VOICE_INVESTIGATORE`), modello **eleven_v3** con tag audio, `stability 0.5`, `similarity 0.8`, mp3 44,1 kHz 128 kbps. Originali (puliti) in `REFERENCE/GIOCHI/PSYCO/AUDIO/NARRATORE/`; nel sito la voce **al telefono** (`investigatore-*`) passa da un filtro «cornetta» (300–3400 Hz + compressione + −16 LUFS). Il sottotitolo è il testo senza tag.

| id | testo inviato a ElevenLabs (con tag) | sottotitolo | durata | quando |
|---|---|---|---|---|
| investigatore-1 | `[whispers] Pronto? … [low voice] Sì, sono io. Non posso parlare a lungo. Ti ho mandato un messaggio. [whispers] Leggilo… e non farti vedere.` | Pronto? …Sì, sono io. Non posso parlare a lungo. Ti ho mandato un messaggio. Leggilo… e non farti vedere. | 9,6 s | risposta alla chiamata (una delle 5 a caso) |
| investigatore-2 | `[mysterious] Ascolta bene, Psyco. Le risposte non mentono mai… ma vanno lette. [whispers] Ti ho scritto tutto.` | Ascolta bene, Psyco. Le risposte non mentono mai… ma vanno lette. Ti ho scritto tutto. | 9,5 s | idem |
| investigatore-3 | `[whispers] Non dire il mio nome ad alta voce. [serious] Controlla i messaggi: lì c'è quello che ti serve.` | Non dire il mio nome ad alta voce. Controlla i messaggi: lì c'è quello che ti serve. | 6,5 s | idem |
| investigatore-4 | `[sighs] Ho seguito la pista per te. Non è molto… ma è qualcosa. [whispers] Ti ho appena scritto.` | Ho seguito la pista per te. Non è molto… ma è qualcosa. Ti ho appena scritto. | 9,3 s | idem |
| investigatore-5 | `[serious] Sono io. Niente domande. Ti ho mandato un messaggio: [whispers] leggilo, prima che sia tardi.` | Sono io. Niente domande. Ti ho mandato un messaggio: leggilo, prima che sia tardi. | 8,0 s | idem |
| investigatore-fine | `[whispers] Era l'ultima volta che rispondo. [mysterious] Da qui in poi… sei solo.` | Era l'ultima volta che rispondo. Da qui in poi… sei solo. | 4,8 s | dopo il messaggio dell'ULTIMA chiamata disponibile |
| tocca-al-prossimo | `[serious] Tocca al prossimo giocatore. [whispers] Gli altri… non guardate lo schermo.` | Tocca al prossimo giocatore. Gli altri… non guardate lo schermo. | 5,0 s | un solo dispositivo su PC/portatile, a ogni turno (al posto di «passa-telefono») |

**Costo**: 720 caratteri di testo inviati (7 richieste); ElevenLabs ha dichiarato **159 caratteri addebitati** in tutto (intestazione `character-cost`, tariffa di eleven_v3). Limite di sicurezza nello script: 3.000.

Effetti (sintetizzati con ffmpeg, nessun costo): `squillo` (campanello 440+480 Hz con trillo, doppio «drin» ogni 3 s, in loop sul telefono dello PSYCO), `squillo-breve` (un doppio «drin»: TV e altri telefoni), `notifica` (due note: arriva il messaggio), `riattacca` (clic + tre toni di occupato a 425 Hz). Se un file manca il gioco li sintetizza al volo con Web Audio.

Dove suonano: la chiamata (suoneria, voce, notifica, vibrazione) **solo sul dispositivo dello PSYCO** (anche se non è «voiced»: rispetta muto, voce ed effetti del pannello Audio); su TV e altri telefoni solo `squillo-breve` con l'avviso. Durante la chiamata il narratore tace (`getNarrator().holdForCall(true)`: le frasi aspettano, poi riprende con le più recenti; è un'attesa indipendente da quella dell'intro 3D, `hold/release`) e la voce dell'Investigatore passa davanti (`sayNow`); sulla TV il narratore si ferma ~2,5 s durante lo squillo breve.

## Voce con il nome del giocatore (non ancora fatta)

La voce dei clip è «Gottfried - Dark Thriller & Crime» di ElevenLabs (id nella variabile `ELEVENLABS_VOICE_INVESTIGATORE`, solo in `.env.local`/Vercel, documentata senza valore in `.env.example`). Le battute col nome («Mike, tocca a te…») tramite il TTS del quiz NON sono state aggiunte: il ruolo voce è un tipo chiuso usato da pannello Voci, configurazione per ruolo, battute del quiz e da un vincolo `check (role in ('professore','regina','palmino','annunciatore'))` su `tts_clips`. Aggiungere «investigatore» richiede una migrazione che cambia quel vincolo (tabella del quiz) e modifiche al pannello admin: non è un intervento «semplice e senza rischi» per il quiz, quindi è rimandato. Quando si farà: nuovo ruolo in `TTS_ROLES` (src/features/game/script.ts) + `VOICE_ENV.investigatore = "ELEVENLABS_VOICE_INVESTIGATORE"` (src/lib/server/tts.ts) + migrazione sul vincolo + endpoint autenticato per la stanza PSYCO; sul client, in `PassTheDevice` (SharedApp.tsx), provare la clip col nome con un limite di 1,5 s e ripiegare su `passa-telefono` / `guarda-ruolo`.
