# TAVOLI IN GUERRA! — manche 1 «CHI PARTE MALE...»: i 10 minigiochi aggiunti

Le 6 meccaniche già fatte della manche (01, 03, 04, 05, 11, 15) erano nel ramo dei minigiochi; qui le altre 10.
Tutte: ingresso «team» (decide il capitano o l'unico telefono), `oneDeviceOk`, timer del catalogo, punti del PDF,
almeno 10 varianti con difficoltà facile/media/difficile (`difficulty` nel contenuto, letto dal motore).

| N. | Codice | Varianti | Cosa fa | Punti |
|----|--------|----------|---------|-------|
| 02 | `pixel-killer` | 12 | «Foto» disegnata con forme, mostrata a quadrettoni 16×9 → 32×18 (13 s) → 64×36 (26 s). Quattro risposte, si blocca quando si vuole. | 100 / 70 / 40 secondo il livello all'orario del server, 0 se sbagliata |
| 06 | `un-secondo-prima` | 11 | «Video» a fotogrammi chiave (attori fatti di forme e icone) che si ferma; tre fotogrammi candidati. | 100 se giusto |
| 07 | `titoli-tagliati` | 12 | Titolo inventato con il buco + sommario coi fatti; un solo finale coerente. | 100 se giusto |
| 08 | `non-e-quello-che-sembra` | 12 | Tre immagini quasi uguali, una descrizione esatta: una sola la rispetta. | 100 + rapidità (max 20) |
| 09 | `la-sequenza-sporca` | 14 | Fila di 6–9 elementi (numeri, simboli, dadi, orari, lettere, poligoni) con una regola e un intruso. | 100 o niente |
| 10 | `il-dettaglio-da-100` | 12 | Scena affollata per 6 s (coriandoli + scritta che scorre), poi UNA domanda molto specifica. | 100 o niente |
| 12 | `rumore-di-fondo` | 12 | Tre suoni sintetizzati insieme (due ascolti in TV, riascolto dal telefono): il più forte o l'estraneo. | 100 se giusto |
| 13 | `feed-in-5-secondi` | 11 | Cinque post inventati scorrono (1,2 s l'uno), spariscono, una domanda su un particolare. | 100 se giusto |
| 14 | `effetto-domino` | 12 | Catena di 2–4 fatti («tessere»), quattro conseguenze: una sola segue davvero. | 100 se giusto |
| 16 | `sotto-la-superficie` | 12 | Chat inventata con un messaggio a doppio senso evidenziato; quattro interpretazioni. | 100 se giusto |

## Contenuti verificati dallo schema (niente varianti sbagliate per distrazione)

Dove si può, la soluzione è scritta anche in forma strutturata e `contentSchema` la ricontrolla all'avvio
(`loadVariants` lancia un errore se una variante non torna):

- **La sequenza sporca**: la regola (`pattern`: aritmetica, raddoppio, somma dei due, quadrati, ciclo, rotazione,
  dado, orari, lettere, lati, due file intrecciate) deve essere violata in UN solo punto, quello della soluzione.
- **Non è quello che sembra**: la descrizione ha anche le `conditions` (testo su un oggetto, a sinistra di, sopra,
  quanti, specchiato, assente): solo l'immagine giusta le rispetta tutte; al reveal ogni immagine sbagliata mostra
  la frase che non rispetta.
- **Il dettaglio da 100**: la domanda è di quattro tipi controllati (testo su un oggetto unico, quanti oggetti, quale
  NON c'era, cosa diceva la scritta che scorre); le risposte sbagliate sono spesso testi veri presi da altri oggetti.
- **Feed in 5 secondi**: la domanda punta a un campo (account, luogo, «mi piace», quanto tempo fa) del post n. X o
  dell'unico post con un certo oggetto nella foto; la risposta giusta deve coincidere col campo.
- **Rumore di fondo**: le risposte sono i tre suoni presenti più uno assente; in «dominante» lo strato giusto è almeno
  1,8 volte più forte degli altri.
- **Un secondo prima**: fotogrammi chiave in ordine, posa iniziale per ogni attore, fine = durata del video.
- **Pixel killer**: solo forme geometriche (icone e testi non si sgranano e svelerebbero il soggetto).

## Media generati in codice (nessun file, nessuna immagine o suono presi dal web)

- Primitive di disegno della manche: `src/lib/tig/games/mechanics/m1/draw.ts` (rettangoli, ellissi, poligoni, linee,
  testi, icone del kit, tavolozza con nomi) e `src/features/tig/games/mechanics/m1/art.tsx` (SVG).
- **Pixel killer**: il rasterizzatore (puro, sul server) trasforma le forme in griglie di colori a 12 bit; ai telefoni
  arrivano solo le griglie, le forme vere solo al reveal. Il telefono le disegna su un `<canvas>` minuscolo ingrandito
  «a quadrettoni».
- **Un secondo prima**: animazione a fotogrammi chiave interpolati (posa = x, y, rotazione, scala, opacità) disegnata
  in SVG a ~30 fotogrammi al secondo in TV.
- **Rumore di fondo**: 25 ricette di suono (`m1/synth.ts`: campanello, telefono, sveglia, bollitore, sirena, clacson,
  pioggia, tic-tac, cuore, tastiera, notifica, uccellini, grilli, tuono, onde, vento, applausi, batteria, monete,
  frittura, gocce, aspirapolvere, fischietto, carillon, gabbiano) compilate dal server in una lista ANONIMA di eventi
  (oscillatori e rumore filtrato con inviluppo) mescolati per tempo: dal JSON non si leggono né i nomi né il volume dei
  singoli strati. Il telefono e la TV li suonano con Web Audio (`m1/synth-player.ts`) sul bus degli effetti del motore
  audio della piattaforma (rispetta volume e muto della TV). Versione testuale per l'accessibilità: descrizioni a
  parole dei suoni, senza nominarli.
  - **Volumi equalizzati**: a parità di guadagno un rumore filtrato suona 20–30 dB più piano di un tono, quindi ogni
    ricetta ha una correzione (`LOUDNESS` in `m1/synth.ts`) calcolata con un piccolo sintetizzatore offline (stessi
    inviluppi e filtri del riproduttore; volume percepito stimato = passa-alto a 150 Hz + 90° percentile dell'RMS su
    finestre di 200 ms). Risultato verificato dai test: ogni suono a pieno volume sta a −14 dB ±3; nelle varianti
    «dominante» lo strato giusto è circa 10 dB sopra gli altri (minimo garantito 6 dB), nelle «estraneo» i tre strati
    stanno entro 4 dB. Non ho potuto ascoltarli (niente audio in questo ambiente): la riconoscibilità dei timbri va
    provata a orecchio in sala, il volume relativo invece è misurato.
- Alternative testuali ovunque: `alt` di scene e foto, indizi a parole per ogni livello di Pixel killer, descrizione
  del video, lettura dei post per i lettori di schermo.

## Differenze dal PDF (oneste)

- **Pixel killer**: la «fotografia originale» è un'illustrazione a forme disegnata in codice (niente foto). Gli «indizi
  visivi progressivi» sono i tre livelli di quadrettoni (più un indizio a parole per livello, per l'accessibilità).
  Timer 40 s (catalogo); livelli a 0, 13 e 26 s.
- **Un secondo prima**: il «breve video originale» è un'animazione vettoriale (attori fatti di forme e icone), non un
  file video. Dura 2,5–5 s dopo un conto alla rovescia di 1,2 s; poi resta il fermo immagine sui telefoni.
- **Feed in 5 secondi**: i cinque post scorrono in 6 secondi (1,2 s l'uno, dopo un via di 1,5 s) invece di 5 netti,
  per rispettare la regola del catalogo «correttezza e non velocità di lettura estrema».
- **Rumore di fondo**: i «suoni originali» sono sintetizzati (riconoscibili ma stilizzati). La TV li fa sentire due
  volte (a 0,8 s e 8,6 s); se il browser della TV blocca l'audio compare un pulsante «tocca per far partire i suoni».
- **Il dettaglio da 100**: «domande nuove selezionate per difficoltà comparabile» = una domanda per variante, di
  quattro tipi controllati, con la difficoltà dichiarata nel contenuto (il motore la usa per la scelta).
- **Non è quello che sembra**: bonus di rapidità del kit (max +20, lineare sul timer), come Screenshot traditore.

## Scelte tecniche da sapere

- **Prove a tempo e `publicViewAt`**: il telefono rilegge lo stato ogni ~10 s (o quando arriva un evento realtime),
  non all'istante in cui si apre un livello. Per questo:
  - Pixel killer manda il livello aperto **più il successivo** (anticipo di un passo): il cambio avviene esattamente
    all'orario anche se il telefono non si è aggiornato; il livello più fine non parte prima dei 13 s, le forme mai.
  - Il dettaglio da 100 e Feed in 5 secondi tolgono scena e post dalla vista appena scade il tempo di visione; la
    domanda invece è nella vista dall'inizio (come Memoria lampo) e la UI la mostra solo dopo.
- Ogni meccanica guarda anche il caso «vista vecchia»: se il livello dell'orario non è ancora arrivato, si mostra il
  migliore disponibile.
- Layout TV pensati per 2–12 tavoli: le immagini (Non è quello che sembra, Pixel killer, Un secondo prima) si adattano
  a larghezza E altezza della cella con un contenitore `container-type: size`; nella chat di Sotto la superficie, se
  lo spazio non basta, si tagliano i messaggi più vecchi in alto e mai quello da interpretare.

## File

- Meccaniche: `src/lib/tig/games/mechanics/<codice>.ts` + `m1/` (common, draw, synth); registro `manche-1.ts`.
- Schermate: `src/features/tig/games/mechanics/<codice>.tsx` + `m1/` (art, chat, token, synth-player, m1.css);
  registro `src/features/tig/games/manche-1.ts`.
- Contenuti: `content/tig/minigiochi/<codice>.ts`, indice `content/tig/minigiochi/manche-1.ts`.
- Test: `tests/unit/tig-giochi-m1.test.ts` (regole, controlli editoriali, render lato server di telefono e TV per ogni
  variante in gioco/bloccata/reveal con 12 tavoli, volumi stimati di Rumore di fondo).
- Screenshot dell'anteprima: script `shots-m1.mjs` nella cartella di lavoro del coordinatore (tempi giusti per
  queste prove: scena/feed/video in corso sulla TV, domanda sul telefono).

## File condivisi che non ho toccato ma andrebbero rivisti

- `src/lib/tig/games/variants.ts` / brief: le varianti «dentro la definizione» non sono lette da nessuno (i contenuti
  passano da `content-core.ts`): la nota del file andrebbe aggiornata per non confondere.
- `src/features/tig/use-tig.ts`: per le prove con contenuti a tempo sarebbe utile una rilettura dello stato agli orari
  che la vista dichiara (es. `schedule` di Pixel killer e di Indizio dopo indizio), invece di aspettare il polling.
- `scripts/tig/shots-minigiochi.mjs` ha i tempi delle prime 21 meccaniche cablati: per queste 10 c'è uno script a
  parte nella cartella di lavoro del coordinatore (`shots-m1.mjs`).
