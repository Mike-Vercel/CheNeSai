# TAVOLI IN GUERRA! — Manche 3 «IL PUB DECIDE!»: le 12 meccaniche nuove

Ramo `feat/tig-m3`. Con le 4 già fatte (33, 35, 39, 42) la manche 3 ha ora **16 meccaniche su 16**.
Ogni meccanica: logica pura in `src/lib/tig/games/mechanics/<codice>.ts`, schermate in
`src/features/tig/games/mechanics/<codice>.tsx`, contenuti (con le soluzioni, solo server) in
`content/tig/minigiochi/<codice>.ts`, registrate solo negli indici della manche 3
(`mechanics/manche-3.ts`, `features/tig/games/manche-3.ts`, `content/tig/minigiochi/manche-3.ts`).
Utilità comuni della manche: `mechanics/_m3.ts` (sondaggi, conteggi, capitano) e `mechanics/_m3-kit.tsx`
(tessera del tavolo, passi numerati, cursore di percentuale, timbro del reveal, spiegazione compatta).
Test: `tests/unit/tig-giochi-m3.test.ts` (regole di punteggio di ognuna, equità, completezza, e le schermate
telefono/TV disegnate davvero in gioco, bloccate e al reveal con 2, 4 e 12 tavoli per tutte le varianti).

Regole di equità rispettate ovunque: nei sondaggi del locale **un tavolo = un voto**; nel voto interno (36) conta
la **percentuale**, mai la somma; a schermo solo dati **aggregati per tavolo**, mai nomi di persone; nessun testo
libero dei giocatori arriva alla TV.

| N. | Codice | Ingresso | Timer | Punti | Varianti |
|----|--------|----------|-------|-------|----------|
| 34 | chi-ha-votato-cosa | pub | 60 | coppia giusta 100, mezza coppia 30 (max 60) | 10 |
| 36 | il-capitano-ci-conosce | vote | 50 | 100; parità 60 se tra le pari; 1 telefono 50 | 10 |
| 37 | quanto-siete-prevedibili | pub | 45 | entro 2 punti 100, poi −2,5 a punto | 10 |
| 38 | pub-contro-tavolo | team | 60 | 20 a risposta (max 100), sfidante +40 se batte la media | 10 |
| 40 | parola-che-gira | pub | 70 | parola unica +30, sopravvissuta +70 | 10 |
| 41 | indovina-il-preferito | pub | 55 | preferito +70, meno votato +30 | 10 |
| 43 | questione-di-istinto | pub | 60 | stesso stile 3/3 100, 2/3 50 | 10 |
| 44 | allineamento-perfetto | pub | 40 | 100 × altri tavoli con voi / altri tavoli; solo 50 | 10 |
| 45 | il-pub-ha-torto | pub | 60 | risposta +60, previsione sulla maggioranza +40 | 10 |
| 46 | alleanza-espressa | duel | 60 | alleanza tutta giusta 100 a testa, altrimenti 0; solo 60 | 10 |
| 47 | effetto-gregge | pub | 50 | istinto giusto 100, gregge giusto 60 | 10 |
| 48 | gira-la-scelta | pub | 60 | giusta 80, +20 sulla carta meno scelta | 10 |

Difficoltà miste in ogni meccanica (campo `difficulty` facile/media/difficile nei contenuti: il registro del server
lo legge già). Nessun punteggio negativo, nessun trasferimento: la manche 3 non toglie punti a nessuno.

## Come funzionano e dove differiscono dal PDF (onestamente)

**34 · Chi ha votato cosa?** — Due domande leggere a due risposte; ogni tavolo dà un voto anonimo a entrambe e
indovina la *coppia* di risposte più votata dal locale (griglia 2×2 in TV, solo conteggi). *Differenza*: il PDF parla
di «intuire la scelta prevalente»; per non fare un doppione del 33 (stessa cosa con una domanda) la scelta
prevalente è la combinazione delle due risposte: «chi ha votato mare, cosa ha votato dopo?». 30 punti per ogni metà
giusta come premio parziale.

**36 · Il capitano ci conosce?** — Voto segreto dentro il tavolo: i compagni votano (ognuno con le risposte in un
ordine diverso), il capitano prevede la risposta più votata **e non vota** (altrimenti con 2 telefoni si autoavvera).
Spareggio definito prima e scritto nella regola: se più risposte sono pari, la previsione vale 60 se è una di quelle.
Il capitano è quello fotografato all'avvio della prova (se manca, il primo membro); il ruolo arriva con `memberView`.
Un solo telefono: niente da indovinare, 50 fissi (`oneDeviceOk: false`, come Sincronizzati). *Limite*: nessuno può
impedire ai compagni di dire ad alta voce cosa votano; la regola in TV lo vieta (come in Sincronizzati).

**37 · Quanto siete prevedibili** — Proposta surreale e innocua; voto sì/no per tavolo e cursore della percentuale
di tavoli che dirà sì. Fedele al PDF. Il voto non dà punti (serve a creare il dato).

**38 · Pub contro tavolo** — Il tavolo sfidante è **estratto col seme della prova** (verificabile, uguale su
server/TV/telefoni): il PDF non dice come si sceglie e il motore non ha una fase «il pub sceglie chi sfidare».
Tutti fanno lo stesso quiz lampo di 5 domande (conti e orari di vita quotidiana): 20 a risposta; lo sfidante prende
+40 se fa più della media dei rivali che hanno risposto (senza rivali: almeno 3 su 5). Non è penalizzato a priori;
se il pub resiste i rivali guadagnano solo Energia Caos.

**40 · Parola che gira** — Nessun testo libero: ogni tavolo propone una parola scegliendola da una **lista chiusa**
già moderata (+30 se nessun altro tavolo sceglie la stessa), poi gioca il quiz a eliminazione: tre regole oggettive
(lettere, lunghezza, doppie) tolgono parole dalla lista e chi indica la sopravvissuta prende +70. In TV le proposte
compaiono solo al reveal, come numeri accanto a parole della lista. *Differenze*: il PDF dice «testo breve» (qui
whitelist pura, come chiede la regola «nessun testo grezzo su TV»); e «le risposte filtrate vengono usate nel quiz»:
nella stessa prova non si può, perché il motore non passa gli invii alle viste, quindi il quiz usa la stessa lista
moderata. Il test ricontrolla ogni regola lettera per lettera su tutte le varianti.

**41 · Indovina il preferito** — Quattro scenari di vita adulta illustrati con le icone del kit (SVG originali);
voto per tavolo, poi previsione del preferito (+70) e del meno votato (+30). Il «meno votato» è un'aggiunta per non
fare un doppione del 33.

**43 · Questione di istinto** — Tre situazioni, tre reazioni ciascuna; ogni reazione appartiene a uno di tre stili
annunciati (es. Testa, Cuore, Pancia) senza dire quale. Regola annunciata: stesso stile 3 volte su 3 = 100, 2 su 3 = 50.
*Differenza*: le «tre situazioni rapide» sono mostrate insieme in un unico invio (il motore accetta un invio per tavolo).

**44 · Allineamento perfetto** — Gioco del punto d'incontro, fedele al PDF: punti = quota degli *altri* tavoli che
hanno scelto come voi (tutti allineati 100, nessuno 0). Con un tavolo solo in gara: 50 fissi.

**45 · Il pub ha torto?** — Dato fittizio disegnato in codice (grafico a barre, tabella o scontrino, con
descrizione testuale per i lettori di schermo) e domanda con trappola. +60 per la risposta, +40 per la previsione
«la maggioranza sbaglierà?» (maggioranza = più della metà dei tavoli che hanno risposto). Fedele al PDF.

**46 · Alleanza espressa** — Tutti i tavoli sono accoppiati col seme (con un numero dispari l'ultima alleanza è a
tre). In ogni alleanza un tavolo ha la **griglia** di cifre (generata dal seme e diversa per ogni alleanza, così
copiare da un'altra coppia non serve), l'altro le **coordinate**: si risolve solo parlandosi. Codice giusto da tutta
l'alleanza: 100 a testa; anche uno solo sbagliato o mancante: 0 a tutti. Le varianti difficili hanno un passaggio
finale (più uno, al contrario) scritto solo nella metà della griglia. *Nota per il motore*: essendo `duel`, il
Bottone del Caos può pescarla; in quel caso il motore premia chi invia per primo il codice giusto (+50) e
l'alleanza diventa una gara a chi lo scrive prima. Funziona, ma è meno nello spirito: se si preferisce, il core può
escluderla dalle prove del Caos (vedi sotto).

**47 · Effetto gregge** — Domanda trabocchetto con risposta verificabile; ogni tavolo dà la sua risposta e sceglie
istinto (vale la propria, 100) o gregge (vale la più data dal locale, 60). Gregge diviso (parità): vale la propria
risposta, pagata come gregge. Fedele al PDF.

**48 · Gira la scelta** — Un evento con tre rischi: per 15 secondi si vedono solo i titoli e si sceglie la carta,
poi si svela la prova (`publicViewAt`: prima dei 15 s le domande non partono verso i telefoni). Le tre prove hanno
lo stesso tipo e la stessa difficoltà e valgono uguale (80); +20 a chi risponde giusto sulla carta scelta da meno
tavoli. *Limite onesto*: il motore accetta un solo invio per tavolo, quindi la carta arriva al server insieme alla
risposta; il telefono la blocca appena si svela la prova e mostra solo la domanda della carta scelta, ma il server
non può verificare *quando* è stata scelta. Le tre prove equivalenti tolgono quasi tutto il vantaggio a chi provasse
a sbirciare.

## Effetti che attraversano più prove

Nessuna meccanica della manche 3 ne ha bisogno: tutte sono autocontenute in una prova.

## File condivisi

Nessun file condiviso modificato (la correzione sui contenuti di `content-core.ts` l'ha fatta il coordinatore).
Suggerimenti per chi gestisce i file comuni, **non applicati**:
- `src/lib/tig/selection.ts` (`fitsKind`): se il duello del Caos non deve essere cooperativo, escludere
  `alleanza-espressa` dalle prove `caos` (oggi basta `input === "duel"`).
- `scripts/tig/shots-minigiochi.mjs`: la tabella `TIMES` non contiene le meccaniche nuove; per la manche 3 c'è
  uno script a parte nella scratchpad (`shots-m3.mjs`, con il tempo giusto per la scelta della carta del 48).
- L'anteprima (`GiochiPreview`) usa `publicView`, non `publicViewAt`: per il 48 la fase di scelta si vede lo stesso
  perché lo schermo decide la fase dall'orologio (`choiceMs`).

## Verifica

- `npx vitest run tests/unit/tig-giochi.test.ts tests/unit/tig-giochi-m3.test.ts --maxWorkers=1`: tutto verde.
- `npx tsc --noEmit -p .` e eslint sui file della manche: puliti.
- Screenshot: fatti e controllati per 34, 36, 37, 38, 40, 41 (telefono, PC, TV; play e reveal) prima delle regole
  di memoria, con le correzioni che ne sono uscite (parole mai troncate nel 40, reveal compatti in TV nel 38 e 41,
  previsione del 41 più leggibile). Per 43–48 niente browser: al loro posto il test che disegna telefono e TV in
  tutte le fasi (che ha già trovato un errore vero nel 45, corretto). Lo script `shots-m3.mjs` nella scratchpad
  produce tutti gli screenshot dall'anteprima con il server acceso.
