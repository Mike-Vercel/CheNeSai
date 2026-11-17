# TAVOLI IN GUERRA! — minigiochi della MANCHE 2 «FREGALI TUTTI!»

Le 12 meccaniche mancanti della manche 2 (le altre quattro, 17 · 19 · 23 · 24, c'erano già). Ognuna ha:

- la meccanica pura in `src/lib/tig/games/mechanics/<codice>.ts` (pezzi comuni della manche in `mechanics/m2/shared.ts`);
- le schermate telefono/PC e TV in `src/features/tig/games/mechanics/<codice>.tsx` (pezzi comuni in `mechanics/m2/kit.tsx`);
- i contenuti (con le soluzioni, solo server) in `content/tig/minigiochi/<codice>.ts`, registrati in `content/tig/minigiochi/manche-2.ts`;
- 12 varianti ciascuna, con difficoltà dichiarata (`difficulty`: facile/media/difficile), che il registro del server legge per
  distribuire la difficoltà dentro la manche.

Registri: `NUOVE_MANCHE_2` (`mechanics/manche-2.ts`) e `UI_MANCHE_2` (`features/tig/games/manche-2.ts`).
Test: `tests/unit/tig-giochi-m2.test.ts` (regole, 1–12 tavoli, duello del Caos a 45 s, rendering statico di tutte le
schermate in gioco/bloccate/reveal) più quelli generici di `tests/unit/tig-giochi.test.ts`.

Regole comuni rispettate: un solo invio per tavolo (è così che il motore chiude la prova), nessuna soluzione nella vista
pubblica, punti propri tra −40 e +120, trasferimenti/penalità al massimo 40 a voce (il motore applica poi scudo, tetto di
80 persi per manche e massimo 2 attacchi sullo stesso tavolo in 10 minuti), Energia Caos 0–4, pareggi e invii mancanti
gestiti, precisione 0–1 per gli spareggi.

## Le meccaniche

| N. | Codice | Ingresso · timer | Come funziona | Punti |
|---|---|---|---|---|
| 18 | `taglia-il-tempo` | duel · 50 s | Prova LAMPO (3 opzioni) + scelta di un tavolo + SFIDA uguale per tutti. Lampo giusto = «forbici»: al tavolo scelto la sfida scade 3 s prima e il suo tempo conta 3 s in più. Un tavolo subisce al massimo un taglio (il primo; gli altri vanno a vuoto). In TV una «zona taglio» negli ultimi 3 s. | Sfida giusta in tempo 100 + bonus velocità (max 20) sul tempo tagliato; fuori tempo o sbagliata 0. |
| 20 | `contrattacco` | duel · 50 s | Giro di attacchi dal seme: ognuno colpisce il tavolo successivo ed è colpito dal precedente (uno a testa, niente accanimento). COLPO (domanda uguale per tutti) + RIVINCITA del bersagliato: SICURA (domanda facile) o PIENA (difficile). | Colpo giusto: furto di 20 al bersaglio (trasferimento). Rivincita +20 / +40 (massimo +40), mai un altro attacco: nessuna catena. |
| 21 | `caccia-alla-capolista` | duel · 60 s | La capolista (saldo più alto, dai `balances` che il motore inietta al congelamento) difende; gli altri scelgono CACCIA o PASSO e risolvono lo stesso enigma. A pari merito in vetta sono tutte capoliste (bisogna batterle tutte). Senza saldi utili la capolista è estratta col seme (e la UI lo dice). | Caccia riuscita +40, giusta ma battuta +10, passo giusto +20; capolista: giusta +20 e +10 a cacciatore respinto, tetto +40 (simmetrico). Nessuna sottrazione. |
| 22 | `furto-con-destrezza` | duel · 60 s | Vittima a scelta + colpo in due indizi concatenati (il secondo si risolve solo col risultato del primo; sul telefono si apre dopo il primo). | Entrambi giusti: furto di 40 (trasferimento). Nessun punto proprio. Un colpo per tavolo. |
| 25 | `scegli-il-terreno` | team · 50 s | Due turni nella stessa prova, tre categorie di pari difficoltà. 1° turno: A o B (solo dal nome, la domanda si apre dopo la scelta). 2° turno: una delle due rimaste; quella appena giocata è bloccata. | +50 a risposta giusta (max 100). |
| 26 | `la-trappola` | duel · 50 s | Tre trappole di logica (3 opzioni) uguali per tutti. Ogni tavolo ARMA una trappola contro un tavolo e DISINNESCA tutte e tre. Su ogni tavolo vale solo la prima trappola armata (anti-focus). | +20 a trappola disinnescata (max 60). Se il bersaglio sbaglia (o non risponde) proprio quella armata: −30 al bersaglio (penalità, nessuno la incassa). |
| 27 | `il-patto-di-60-secondi` | duel · 60 s | Tavoli accoppiati dal seme (dispari: un terzetto). Codice di 6 cifre, una per indizio; ogni tavolo vede SOLO i suoi indizi (vista privata), mai in TV: bisogna parlarsi tra tavoli. | Tutti i tavoli del patto col codice giusto: +100 a testa. Solo alcuni: +40 a chi l'ha giusto. |
| 28 | `la-sfida-incrociata` | duel · 60 s | Griglia 4×4 con quattro simboli disegnati (boccale, pizza, dado, nota). Coppie dal seme: uno ha la griglia, l'altro la versione speculare (colonne rovesciate). Soluzione unica verificata dallo schema (ricerca esaustiva); si accetta qualunque completamento valido. Tastiera sul PC (frecce, 1–4, Canc, Invio). | Valida +60; più rapida del rivale speculare +40. Tavolo dispari: sfida il tempo mediano delle griglie valide del locale. |
| 29 | `bottone-del-caos` | duel · 45 s | Raffica di tre domande lampo uguali per tutti. Ogni tavolo «preme il bottone» contro un rivale; ogni coppia è un duello (contata una volta). Vince chi ne azzecca di più; a pari numero il più rapido. | +50 a duello vinto (tetto 100), chi perde 0: nessun malus. |
| 30 | `scambio-di-posta` | duel · 60 s | Coppie dal seme (visibili: ci si accorda a voce). Ognuno propone una posta 0–40 e risponde alla stessa domanda. Si gioca la posta PIÙ BASSA delle due (consenso). Tavolo dispari contro il banco. | Giusta +50. Il vincitore del duello prende la posta all'altro (trasferimento ≤ 40). Il banco paga la posta (punti propri) se il tavolo è giusto entro il tempo mediano; non incassa mai. |
| 31 | `falso-vantaggio` | team · 40 s | Due buste coperte con regole annunciate: SUBITO vale 20, 40, 60 o 80 (1 su 4, media 50); ENIGMA vale 80, 100 o 120 (1 su 3, media 100) solo se si risolve l'enigma che contiene, visibile solo dopo averla scelta. Valori estratti dal seme, uguali per tutti, scoperti al reveal. | Il valore della busta; enigma sbagliato 0. |
| 32 | `ultima-parola` | team · 45 s | Un indovinello compare un pezzo alla volta (6 pezzi nei primi 3/4 della prova); manca l'ultima parola, da scegliere tra 4. Il capitano blocca quando vuole; con `publicViewAt` i pezzi futuri non partono. | Giusta: 120 col primo pezzo, poi 105, 90, 70, 55, 40 con la frase intera. Sbagliata 0. |

## Differenze dal PDF (oneste)

- **18 Taglia il tempo** — Il PDF dice «ridurre di 3 secondi il tempo di una sfida successiva». Il motore non porta effetti
  da una prova all'altra, quindi è **autocontenuta**: lampo e sfida stanno nella stessa prova e il taglio vale sulla sfida
  che segue il lampo. «Effetto massimo una volta per tavolo per round» = ognuno taglia al massimo un tavolo (un invio) e
  ciascun tavolo subisce al massimo un taglio. Chi è tagliato non lo sa durante la prova (non c'è comunicazione dal vivo
  tra tavoli): per questo la regola annuncia a tutti la «zona taglio» degli ultimi 3 secondi.
- **20 Contrattacco** — Il PDF parla del tavolo «bersagliato» da un attacco precedente. **Autocontenuta**: l'attacco (il
  colpo) e la rivincita sono nella stessa prova; il bersaglio di ciascuno lo decide il giro dal seme (tutti attaccano e
  sono attaccati una volta). La rivincita spetta a ogni bersagliato, anche se il colpo contro di lui va a vuoto (non
  può saperlo mentre gioca). È un bonus proprio, mai un attacco: nessuna catena.
- **21 Caccia alla capolista** — «Sfida opzionale» = scelta caccia/passo dentro la prova. La capolista viene dai saldi
  che il motore inietta già nel contenuto (`balances`, come per la puntata nascosta). Se i saldi mancano o sono tutti
  uguali la capolista è estratta col seme (dichiarato a schermo).
- **25 Scegli il terreno** — «Non si può scegliere la stessa categoria due volte di fila» non ha senso in una prova
  sola: diventa due turni nella stessa prova con tre categorie, e al secondo turno la categoria appena giocata è
  bloccata. Il PDF parla di «un tavolo» che sceglie: qui sceglie ogni tavolo per sé (ingresso «team» come nel catalogo).
- **27 Il patto di 60 secondi** — Con un numero dispari di tavoli un patto è a tre (il codice si divide in tre parti).
  «Bonus uguale per entrambe se risolvono»: +100 a tutti solo se tutti i tavoli del patto inseriscono il codice; chi
  lo inserisce giusto quando l'altro sbaglia prende +40 (patto a metà).
- **28 La sfida incrociata** — «Tempo mediano con pari condizioni»: le griglie sono speculari (stessa difficoltà) e il
  tempo mediano delle griglie valide è il riferimento per il tavolo senza coppia; i tempi sono mostrati al reveal.
- **29 Bottone del Caos** — vedi sotto: il potere esiste già nel motore; questa meccanica è il **contenuto** del duello.
  Pescata come prova normale della manche diventa la «prova del bottone» per tutti.
- **30 Scambio di posta** — «Prima di un round i due tavoli concordano una posta»: l'accordo è implicito, si gioca la più
  bassa delle due poste proposte in segreto (nessuno rischia più di quanto ha accettato; 0 = nessuno scambio). Le coppie
  sono visibili subito, così i tavoli possono accordarsi a voce.
- **31 Falso vantaggio** — «Probabilità e valore dei premi documentati nel regolamento»: sono nella regola e sullo
  schermo (valori possibili e probabilità uguali), i valori veri li estrae il seme della prova.
- **32 Ultima parola** — «mentre gli indizi continuano»: la frase arriva a pezzi e manca l'ultima parola; il valore
  scende a ogni pezzo.

## Bottone del Caos: come si lega al motore

Il motore (`engine.ts → pressCaos`) gestisce già il **potere**: uso unico per serata, finestre consentite (manche 2–4, tra
una prova e l'altra), allarme in TV, duello a due tavoli di **45 s** e **+50 al vincitore** calcolato da lui
(`duelWinner` su punti, risposta giusta e tempo; i trasferimenti nel duello del Caos sono ignorati). Il contenuto lo
sceglie `selectGame(kind: "caos")`: una meccanica qualsiasi con `input: "duel"` e `oneDeviceOk`, a caso.

`bottone-del-caos` (29) è fatta per quel ruolo: duello identico, 45 s, con due tavoli il bersaglio è obbligato e i punti
proposti (50/0) indicano lo stesso vincitore del motore; nessun malus. Tutte le mie meccaniche «duel» reggono anche il
duello del Caos (testato con 2 tavoli e 45 s: tempi, zone e pezzi seguono la durata vera della prova), ma due non sono
adatte come duello del Caos: **27 Il patto** (è cooperativa: i due tavoli collaborerebbero e il motore premierebbe il più
rapido) e **21 Caccia alla capolista** (ruoli asimmetrici). Non ho toccato il motore: vedi le proposte qui sotto.

## Verifica

- `tests/unit/tig-giochi-m2.test.ts` e `tests/unit/tig-giochi.test.ts` verdi (con `--maxWorkers=1`); eslint pulito sui file
  della manche.
- Schermate: il test disegna Player e Tv di tutte le 12 meccaniche (in gioco a inizio/metà/fine, capitano e no, già
  inviato, a tempo scaduto, al reveal; 3 e 12 tavoli) e controlla che la TV non mostri la spiegazione prima del reveal.
- Screenshot nel browser: 18, 20, 21, 22, 26 e 30 guardati e corretti prima dello stop per memoria; per le altre sei
  (25, 27, 28, 29, 31, 32) c'è lo script `shots-m2.mjs` nella scratchpad (server di sviluppo acceso a parte).

## File condivisi che andrebbero toccati (non toccati)

1. `src/lib/tig/selection.ts` (o `engine.ts → pressCaos`): per `kind: "caos"` preferire `bottone-del-caos` quando ha
   varianti, ed escludere dal duello del Caos le meccaniche non simmetriche (`il-patto-di-60-secondi`,
   `caccia-alla-capolista`); per esempio una lista `CAOS_SAFE` o una proprietà facoltativa nella definizione.
2. Effetti tra prove diverse (18 «sfida successiva», 20 «quando vieni attaccato»): servirebbe nel motore una tabella di
   effetti pendenti da applicare alla prova seguente. Oggi le due meccaniche sono autocontenute.
3. Kit TV `TeamStrip` (`kit/ui.tsx`): al reveal mostra solo i punti propri; per furto, colpo, trappola e posta i
   trasferimenti applicati non compaiono nella striscia (le mie TV li mostrano nel pannello centrale, con i valori
   applicati dal motore quando l'esito li riporta).
4. `scripts/tig/shots-minigiochi.mjs` ha i tempi solo delle prime 21: per la manche 2 c'è uno script a parte nella
   scratchpad (`shots-m2.mjs`).
