# TAVOLI IN GUERRA! — minigiochi della MANCHE 4 «IL GRANDE INGANNO» (50–64)

Le 12 meccaniche mancanti della manche 4, oltre alle quattro già fatte (49 credici o no, 51 tre versioni,
54 la contraddizione, 59 l'alibi impossibile). Ognuna ha: definizione pura in `src/lib/tig/games/mechanics/<codice>.ts`,
contenuti (solo server, con le soluzioni) in `content/tig/minigiochi/<codice>.ts`, schermate telefono/PC e TV in
`src/features/tig/games/mechanics/<codice>.tsx`. Registri: `NUOVE_MANCHE_4` (lib), `CONTENUTI_MANCHE_4` (contenuti),
`UI_MANCHE_4` (schermate).

Pezzi comuni della manche:
- `src/lib/tig/games/mechanics/_m4.ts` — difficoltà, tipi di documento dei fascicoli, eliminazioni verificabili
  (`remainingAfter`), giro dei tavoli con casi diversi tra vicini (`seatsOf`), coppie col «banco» (`pairsOf`),
  telefono che compra per il tavolo (`isBuyer`), parole vietate negli id pubblici.
- `src/features/tig/games/mechanics/m4/kit.tsx` — schede dei sospettati con appunti «fuori», scala degli indizi a
  tempo, giro dei tavoli per la TV (frecce colorate, regge 2–12 tavoli), buste sigillate degli acquisti ricordate
  dal telefono (`sessionStorage`), elenchi di fatti e indizi.
- `src/features/tig/games/mechanics/m4/docs.tsx` — documenti dei fascicoli disegnati in codice (scontrino, biglietto,
  messaggio, post-it, tessera, verbale, agenda, polaroid con icona del kit): niente immagini esterne.

Test: `tests/unit/tig-giochi-m4.test.ts` (registro, contenuti, regole specifiche, giro e coppie da 1 a 12 tavoli,
disegno statico di tutte le schermate in tutte le fasi con 3 e con 12 tavoli) più il test generico
`tests/unit/tig-giochi.test.ts`. Ogni variante dichiara la `difficulty` (facile / media / difficile).

## Le meccaniche

| N. | Codice | Ingresso · timer | Varianti | Come si gioca e punti |
|---|---|---|---|---|
| 50 | `il-testimone` | coop · 65 s | 10 | Caso inventato con fatti pubblici e tre testimonianze PRIVATE divise tra i telefoni del tavolo (un telefono solo le riceve tutte). Una sola è vera; le altre due contraddicono un fatto pubblico. Si sceglie il testimone di cui fidarsi e la risposta: risposta giusta +80, testimone giusto +20. Vale il primo invio del tavolo. |
| 52 | `archivio-manomesso` | team · 60 s | 10 | Fascicolo di 3–4 documenti disegnati; gli stessi fatti compaiono in più documenti e un campo è stato ritoccato. Si tocca il campo. Giusto +100. Lo schema verifica ogni caso con la regola della maggioranza (un valore diverso contro almeno due concordi, in un solo gruppo). |
| 53 | `compra-un-indizio` | team · 60 s | 10 | Indizi gratuiti + un dettaglio in vendita a 20 punti potenziali. Giusta 100 senza comprare, 80 comprando; sbagliata 0 (mai negativo). In 4 casi su 10 gli indizi gratuiti bastano già, negli altri restano due sospettati: comprare o rischiare è una scelta vera. |
| 55 | `fiducia-cieca` | duel · 60 s | 11 | Stesso rompicapo «chi mente?» per tutti (una o due bugie dichiarate, unicità verificata dallo schema). Giro dei tavoli: la risposta di ognuno diventa il suggerimento per il successivo. Fidarsi al buio (+70 se il suggerimento è giusto, +30 a chi l'ha passato) o risolvere da soli (+100). Catene di fiducia seguite fino a chi ha risolto davvero; giro tutto di fiducia = nessuno ha risposto. |
| 56 | `la-bugia-piu-credibile` | duel · 65 s | 10 | Tre mini-casi per variante, mai lo stesso tra vicini. Verità in tre pezzi (chi/dove/quando…) da opzioni predefinite. Si ricostruisce il proprio caso (30 a pezzo, 100 tutto) e si compone una bugia per il tavolo dopo cambiando UN pezzo: se il tavolo dopo sceglie proprio quel pezzo falso, +40. |
| 57 | `doppio-gioco` | duel · 60 s | 10 | Due prove con punti trasparenti: sicura (giusta +40) e rischiosa (giusta +100, sbagliata −20). Ognuno sceglie in segreto quale vale per il tavolo dopo e risponde a entrambe. Chi sceglie: sicura +10, rischiosa +30 se l'altro sbaglia. Senza scelta del precedente vale la sicura. |
| 58 | `il-messaggio-interrotto` | team · 50 s | 10 | Chat inventata con un messaggio sparito; quattro candidati della stessa persona, uno solo rende coerenti le risposte successive. Giusto +100. La chat mostra in anteprima il candidato scelto dentro il buco. |
| 60 | `chi-cambia-versione` | team · 65 s | 10 | 1° giro di dichiarazioni (22 s), poi arriva una nuova prova e il 2° giro: le frasi del 1° spariscono (memoria). Uno solo ha cambiato versione. Giusto +100. Con `publicViewAt` il 2° giro non parte prima e il 1° non parte dopo. |
| 61 | `negozio-di-sospetti` | team · 60 s | 10 | Cinque sospettati e un negozio di tre prove a prezzi diversi (5–35, max 60 in tutto). Giusta = 100 meno la spesa; sbagliata 0; mai negativo. Tre schemi mescolati: servono tutte / basta una coppia economica / basta la prova cara. Il reveal calcola la spesa minima per essere sicuri. |
| 62 | `la-finta-prova` | team · 50 s | 10 | Dossier di tre prove; una è costruita per depistare e contiene un dettaglio che i fatti accertati rendono impossibile (giorno di chiusura, 31 aprile, totale che non torna, orologio fermo…). Giusto +100; il debrief spiega il dettaglio e perché le altre reggono. |
| 63 | `la-frase-a-meta` | duel · 60 s | 10 | A coppie (dispari: l'ultimo contro il «banco», che sceglie a caso dal seme e non prende punti). Una regola della casa spezzata: un tavolo vede l'inizio, l'altro la fine. Mossa segreta: condividere o ingannare, con tabella dei punti visibile prima: se l'altro condivide +70; se inganna vale la propria ipotesi sulla metà mancante (+40); ingannare chi condivide +30. |
| 64 | `ultimo-indizio` | team · 60 s | 10 | 5–6 sospettati con scheda; un indizio ogni 15 s ne scagiona qualcuno, solo l'ultimo lascia il colpevole. Blocco quando si vuole: 100 / 80 / 60 / 40 secondo gli indizi aperti (orario del server). Lo schema verifica che i sospettati calino a ogni indizio e che dopo il primo ne restino almeno 3. |

## Differenze dal PDF (oneste)

Il motore NON mostra durante una prova gli invii degli altri tavoli (le viste dipendono solo dal contenuto e dal
tempo) e non conserva effetti tra prove diverse. Dove il PDF chiede uno scambio «vivo» tra tavoli, la versione è
autocontenuta e simultanea:

- **55 Fiducia cieca** — l'avversario non vede e non sceglie il suggerimento: il suggerimento è la sua risposta, che
  arriva al tavolo successivo solo nel punteggio (fiducia AL BUIO, come dice il titolo). Rispetto a 49 *Credici o no*
  (dove chi suggerisce conosce la verità e può bluffare) qui nessuno mente: si scommette sulla bravura del vicino.
- **56 La bugia più credibile** — nel PDF un tavolo compone il falso e l'altro deve distinguerlo dal vero vedendolo.
  Qui la bugia (composta da opzioni predefinite, mai testo libero) non viene mostrata durante la prova: è una
  previsione dell'errore più probabile del vicino, che intanto ricostruisce la verità del proprio caso tra le stesse
  opzioni. Se sceglie proprio il pezzo falso, la bugia è stata «creduta».
- **57 Doppio gioco** — chi riceve non sa quale prova gli è toccata e risponde a entrambe; vale quella scelta dal
  tavolo precedente.
- **63 La frase a metà** — condividere/ingannare è una mossa simultanea con tabella dei punti; il gioco «consegna» la
  vera metà (o quella falsa) solo nel punteggio. Senza condivisione conta l'ipotesi del tavolo sulla metà mancante,
  ricavabile dalla coerenza (accordi lo/la/li/le, riferimenti, logica).
- **50 Il testimone** — il PDF dice «un membro riceve un indizio vero»; qui le testimonianze sono tre (una vera, due
  di testimoni inventati e inaffidabili) divise tra i telefoni, così «capire se usarlo o rischiare» è una deduzione
  di squadra. Nessun giocatore deve mai mentire: legge ciò che il gioco gli mostra.
- **53 Compra un indizio / 61 Negozio di sospetti** — il motore accetta UN solo invio per tavolo, quindi l'acquisto non
  è un'azione separata sul server: il contenuto in vendita arriva solo al telefono che compra per il tavolo (capitano,
  o primo telefono se il capitano non c'è), resta sigillato finché non si conferma l'acquisto (due tocchi), il
  telefono lo ricorda anche se la pagina si ricarica e l'acquisto viaggia insieme alla risposta. Un capitano che
  ispezionasse i dati della pagina potrebbe leggerlo senza «pagare»: limite noto (vedi sotto).
- **64 Ultimo indizio** — gli indizi si aprono a tempo (ogni 15 s, orario del server), non «a richiesta»: il punteggio
  scende per ogni indizio aperto al momento del blocco, come nel PDF.
- **60 Chi cambia versione** — le frasi del 1° giro spariscono all'arrivo della prova (memoria); un telefono può
  comunque fotografarle, come in ogni gioco di memoria.

## File condivisi che andrebbero toccati (NON toccati)

- **Acquisti lato server (53, 61)**: per renderli inattaccabili servirebbe nel motore un'azione «acquisto» separata
  dall'invio (come la puntata della manche 5), con `memberView` che riceve gli acquisti già fatti. Oggi il contenuto
  sigillato è nella vista privata del solo telefono che compra.
- **Viste dipendenti dagli invii** (per 55, 56, 57, 63 nella forma «viva» del PDF): servirebbe passare a
  `memberView` gli invii già accettati degli altri tavoli, o una prova in due fasi.
- `scripts/tig/shots-minigiochi.mjs` ha i tempi solo per le prime 21 meccaniche: per le mie c'è una copia con i tempi
  giusti nella scratchpad (`shots-m4.mjs`).

## Limiti noti

- 56 e 55 usano lo stesso giro dei tavoli di 49 (componenti `ring`/`ringColors`): con un solo tavolo non ci sono
  collegamenti e si gioca solo la parte «propria».
- La TV dei duelli mostra il giro con le frecce fino a 8 tavoli; da 9 a 12 diventa un elenco «tavolo → tavolo» a due
  colonne con lo stesso colore ed esito (sul cerchio le etichette sarebbero illeggibili da 5 metri).
- Controllo visivo fatto con 3 e con 12 tavoli (telefono, PC, TV; in gioco, a tempo scaduto, al reveal): con 12 tavoli
  la striscia delle squadre va su due righe, quindi al reveal alcune schermate si compattano (in 50, 57 e 62 resta
  solo la risposta giusta o il «perché» prende il posto dei fatti già ripetuti nelle note).
- Le testimonianze e i casi sono scritti a mano: dove la soluzione non è verificabile in automatico (58, 60, 62, 50,
  56, 63) ogni variante ha la spiegazione del perché nel reveal; dove è possibile la verifica è nello schema
  (52 maggioranza, 53/61/64 eliminazioni, 55 numero di bugie).
