# TAVOLI IN GUERRA! — minigiochi della MANCHE 5 «TUTTO O NIENTE!» (66–80)

Le 13 meccaniche mancanti della manche 5, oltre alle tre già fatte (65 puntata nascosta, 69 soglia di rischio,
71 sicuro o rischio). Ognuna ha: definizione pura in `src/lib/tig/games/mechanics/<codice>.ts`, contenuti (solo server)
in `content/tig/minigiochi/<codice>.ts`, schermate telefono/PC e TV in `src/features/tig/games/mechanics/<codice>.tsx`.
Registri: `NUOVE_MANCHE_5` (lib), `CONTENUTI_MANCHE_5` (contenuti), `UI_MANCHE_5` (schermate).
Pezzi comuni della manche: `src/lib/tig/games/mechanics/m5-shared.ts` (saldi, perdite entro il 25%, impronta di un seme,
gruppi di duello) e `src/features/tig/games/mechanics/m5-kit.tsx` (saldo personale, griglia degli esiti fino a 24 tavoli,
orologio a fotogrammi per le animazioni). Test: `tests/unit/tig-giochi-m5.test.ts` (contenuti, regole, disegno statico
di tutte le schermate in tutte le fasi) più il test generico `tests/unit/tig-giochi.test.ts`.

Ogni variante dichiara la `difficulty` (facile / media / difficile, tutte e tre presenti): il registro del server la
legge per distribuire la difficoltà nella manche.

## Le meccaniche

| N. | Codice | Ingresso · timer | Varianti | Come si gioca e punti |
|---|---|---|---|---|
| 66 | `ultima-chiamata` | team · 70 s | 12 | Tre micro-sfide di tipo diverso, aperte a 0, 15 e 30 s (con `publicViewAt` quelle future non partono). Un solo invio con le tre risposte. +40 a risposta, +40 di bonus finale con 3 su 3 (max 160). La rapidità non dà punti: ordine d'arrivo della raffica nel reveal e ritocco ≤ 5% sulla precisione (che il motore usa per le parità). |
| 67 | `la-cassa-chiusa` | team · 75 s | 12 | Tre serrature a combinazione con indizi concatenati (il secondo usa il primo codice, il terzo i precedenti). +30 per serratura, +30 se si apre tutta (max 120). |
| 68 | `solo-un-dettaglio` | team · 50 s | 10 | Clip ORIGINALE disegnata in codice (sfondi e icone del kit animati a fotogrammi chiave: posizione, scala, rotazione, opacità; sottotitoli dell'azione principale; alternativa testuale). Conto alla rovescia di 3 s, la clip passa una volta (10–11 s), poi la domanda su un dettaglio di contorno (mai solo un colore). Con `publicViewAt` la clip esiste solo durante la proiezione e la domanda solo dopo. Giusta +100 e fino a +20 di rapidità dalla fine della clip. Reveal con fermo immagine e cerchio sul dettaglio. |
| 70 | `punto-di-rottura` | team · 75 s | 10 | Albero a bivi 3 × 2 × 2 (12 percorsi): ogni opzione consuma due risorse con limite e porta «stelle» obiettivo; la prima scelta decide le opzioni dopo. Valido +60, il migliore +120, fuori limite 0. Lo schema verifica a ogni avvio: ottimo unico, almeno 3 percorsi rotti, la prima scelta più golosa NON porta all'ottimo. |
| 72 | `duello-silenzioso` | duel · 70 s | 12 | Tavoli accoppiati dal seme (con un numero dispari l'ultimo gruppo è da tre; nel duello del Caos/spareggio sono i due partecipanti). Stesso enigma a combinazione (cifre diverse, righe «giuste al posto giusto / fuori posto»), soluzione unica verificata per forza bruta dallo schema. Primo giusto +100; due giusti entro 3 s = pareggio valido +60 a testa; mai punti persi. La TV non mostra chi ha inviato fino al reveal. |
| 73 | `l-imboscata` | duel · 70 s | 12 | Giro dei tavoli dal seme: ognuno tende un'imboscata al successivo e la subisce dal precedente. L'avversario sceglie il TIPO di trappola (una di tre domande), il bersaglio decide QUANTO RISCHIARE (0/20/40) e risponde a tutte e tre. Difesa retta +60 + rischio; caduta: il rischio passa all'avversario come furto (≤ 40, scudi e anti-accanimento del runtime) e l'avversario prende +20. |
| 74 | `tre-carte-un-destino` | team · 70 s | 12 | Tre carte coperte con sfide diverse e ricompense comparabili (scarto ≤ 30). Mazzo mescolato col seme: prima si mostra l'impronta (FNV-1a), al reveal il testo del sorteggio, così chiunque può rifare il conto. Scelta entro 12 s (con `publicViewAt` le facce non partono prima della girata), poi la sfida della propria carta: giusta = ricompensa. |
| 75 | `il-mercato-finale` | team · 45 s | 12 | Enigma finale e banco di tre indizi a prezzi diversi (max 50), un acquisto per tavolo. Giusta +120 − spesa, sbagliata −spesa. Indizi oltre il 25% del proprio saldo bloccati (saldo iniettato dal runtime). |
| 76 | `il-filo-rosso` | team · 75 s | 12 | Caso finale, tre indizi «raccolti nelle manche precedenti» riepilogati e sempre visibili, soluzione da comporre con tre tessere (es. chi / dove / con cosa). Unicità verificata sulle 64 combinazioni. +30 a tessera, +60 a filo completo (max 150). |
| 77 | `classifica-buia` | team · 40 s | 12 | Ogni tavolo vede solo il proprio saldo (vista privata) e la categoria. Nei primi 15 s: PRUDENZA +50 sicuri, o RISCHIO: domanda secca, giusta +160, sbagliata −25% del proprio saldo (max 100). La domanda arriva dopo la finestra. La TV non mostra mai saldi né posizioni. |
| 78 | `la-penultima-mossa` | team · 45 s | 12 | Due colpi: la penultima subito, l'ultima dai 20 s. Giusta +60, sbagliata −30, ma la difesa (una sola) annulla il −30 dove è giocata: la si gioca sulla penultima senza conoscere l'ultima o la si conserva. Scelta bloccata all'arrivo dell'ultima e mostrata a tutti al reveal. |
| 79 | `falso-finale` | team · 60 s | 12 | 7 s di «classifica finale» con coriandoli, di squadre INVENTATE (mai i tavoli veri), poi la crepa «FALSO FINALE» e la prova bonus annunciata dal regolamento: un mini-enigma da risolvere guardando quella classifica (resta visibile, righe nell'ordine scritto). Giusta +100 e fino a +20 di rapidità, mai punti persi. |
| 80 | `l-ultima-decisione` | team · 75 s | 12 | Prima la scelta (15 s, l'enigma non è ancora arrivato): SICURO (risolto +100, sbagliato 0) o RISCHIO (risolto +240, sbagliato −25% del saldo, max 250; puntata mostrata col proprio saldo). Poi lo stesso enigma per tutti. Reveal dal fondo alla vetta: esiti in ordine crescente, svelati uno alla volta. |

Punti sempre entro i tetti: positivi ≤ 240 per prova, negativi solo dove dichiarato (rischio, furto, costo) e mai oltre
il 25% del saldo (il runtime riapplica comunque `capOwnPoints`, saldo ≥ 0, scudi e anti-valanga).

## Differenze dal PDF (oneste)

Il motore non porta informazioni tra una prova e l'altra e non passa ai telefoni gli invii degli altri tavoli durante
la prova (un solo invio per tavolo, vista pubblica uguale per tutti). Dove il PDF chiede di più, c'è una versione
AUTOCONTENUTA in una sola prova:

- **76 Il filo rosso**: gli indizi non sono raccolti davvero nelle manche precedenti. Sono riepilogati all'inizio della
  prova con l'etichetta della manche «di provenienza», come se fossero stati raccolti prima (resta valido «indizi
  riepilogati per chi ha perso connessione»: sono sempre a schermo). Per collegarli davvero servirebbe che il motore
  consegnasse un indizio come premio di prove precedenti e lo passasse a questa.
- **78 La penultima mossa**: la difesa non si conserva per la prova successiva. La prova ha due colpi (penultima e
  ultima) e la difesa vale dentro la prova. Non è lo scudo del motore (non blocca furti di altre prove).
- **77 Classifica buia**: la classifica nascosta dell'intera manche resta l'impostazione della serata `hideScoresInFinal`
  (il motore la gestisce in `state.ts`: punteggi e posizioni a `null` in TV e telefoni, saldo personale visibile).
  La meccanica fa la sua parte dentro la prova: solo il proprio saldo (vista privata dal saldo iniettato), nessuna
  posizione in TV, nemmeno al reveal (solo le scelte e l'esito della prova), così non tradisce la classifica buia.
- **79 Falso finale**: la «classifica conclusiva» è finta e con squadre inventate, dentro la prova (non è la classifica
  vera del motore, che non va toccata né mostrata a metà). La regola è dichiarata dall'inizio: non cambia nulla a posteriori.
- **73 L'imboscata**: nel PDF il bersaglio sceglie quanto rischiare dopo aver visto il tipo di prova. Qui non è possibile
  (le scelte degli altri arrivano solo a fine prova): il bersaglio sceglie il rischio senza sapere quale trappola gli
  toccherà e risponde a tutte e tre; conta quella scelta dall'avversario. «Limiti anti-target ripetuto»: il giro fa sì
  che ogni tavolo sia bersaglio una volta sola; il furto passa comunque dai limiti del runtime (2 attacchi in 10', scudi,
  max 40, max 80 a manche).
- **72 Duello silenzioso**: in una prova normale partecipano tutti i tavoli, quindi i duelli sono a coppie decise dal
  seme (un trio se i tavoli sono dispari). «Pareggio valido» = entrambi giusti entro 3 secondi l'uno dall'altro.
- **66 Ultima chiamata**: «decide un bonus finale» = +40 a chi fa 3 su 3; la rapidità è solo spareggio (ritocco ≤ 5%
  sulla precisione, ordine d'arrivo mostrato al reveal), mai punti.
- **75 Il mercato finale**: «indizio per il finale» = per l'enigma di questa stessa prova.

Limiti noti dovuti al contratto (un solo invio per tavolo, una vista uguale per tutti):
- **74, 75, 77, 80** fanno scegliere qualcosa «prima» di vedere un contenuto (carta, indizio, rischio, puntata), come la
  già esistente puntata nascosta. Il server riceve la scelta insieme alla risposta: con `publicViewAt` il contenuto non
  parte verso i telefoni prima della finestra (74, 77, 80), e il telefono blocca la scelta all'arrivo del contenuto, ma
  un client modificato potrebbe cambiarla dopo. Nel mercato (75) il testo degli indizi viaggia nella vista (serve al
  telefono di chi compra): il telefono lo mostra solo dopo l'acquisto, che è definitivo anche se si ricarica la pagina.
  Per una garanzia lato server servirebbe un secondo tipo di invio (es. «prenota» prima della domanda).

## Contenuti

Originali, in italiano, per adulti da pub, senza persone reali, marchi, opere protette o temi sensibili; niente emoji.
Calcoli e soluzioni verificati con script; le soluzioni uniche (duello, punto di rottura) le riverifica lo schema a ogni
avvio. In `falso-finale` alcune soluzioni dipendono dall'ordine delle righe: la schermata non le riordina mai.
Alcuni enigmi finali sono rivisitazioni di classici (il ponte al buio, i tre interruttori, il bugiardo, i biscotti con una
sola pesata): qualche tavolo potrebbe conoscerli.

## Verifica

- `npx tsc --noEmit -p .`, eslint sui file della manche: puliti.
- `npx vitest run tests/unit/tig-giochi.test.ts tests/unit/tig-giochi-m5.test.ts --maxWorkers=1`: verdi.
- Schermate: disegno statico di ogni schermata in ogni fase (test) e un primo controllo visivo nel browser di tutte e 13:
  telefono 390×844 e PC 1440×900 a pagina intera, TV 1920×1080 con 3 tavoli (anteprima `/preview/tig/giochi`) e con
  12 tavoli (pagina locale di prova con N tavoli, non committata), fasi in gioco / tempo scaduto / reveal. Il controllo
  è stato interrotto (nuovo stile grafico in arrivo): dopo le correzioni ho rifotografato e riguardato solo la TV di
  ultima chiamata, la cassa chiusa, solo un dettaglio e punto di rottura; le altre correzioni sono verificate dai test,
  non ancora a occhio. Correzioni fatte dopo il controllo: titolo della prova sempre quello della meccanica (prima alcune viste lo
  sostituivano col titolo della variante), reveal compatti sulla TV (domanda e sola risposta giusta) per non tagliare
  nulla con 12 tavoli, nomi dei tavoli che si accorciano invece di sovrapporsi ai punti, albero di «Punto di rottura» in
  TV ridisegnato (scritte grandi: prima scelta e percorso migliore; l'albero completo resta sul telefono), clip di
  «Solo un dettaglio» con oggetti più grandi, senza striscia dei tavoli durante la proiezione e fermo immagine
  ingrandito sul telefono, scala «dal fondo alla vetta» a una colonna nell'ultima decisione.
