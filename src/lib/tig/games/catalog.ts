import type { CatalogEntry, InputMode, MancheNo, MechanicDef } from "./contract";

/**
 * Catalogo delle 80 meccaniche (PDF §06, pagine 9–15): numero, codice, manche, titolo, descrizione,
 * modalità d'ingresso, timer e regola dei punti. Lo STATO non è scritto a mano: è «implementata» solo
 * se la meccanica è davvero nel registro (`MECHANICS`), altrimenti «da-implementare».
 * Per le meccaniche implementate titolo, ingresso e timer arrivano dalla definizione (una sola fonte).
 */

type Row = [number, string, string, string, InputMode, number, string];

/** [numero, codice, titolo, descrizione, ingresso, timer (s), punti] — manche dedotta dal numero. */
const ROWS: Row[] = [
  // 01 · CHI PARTE MALE...
  [1, "memoria-lampo", "Memoria lampo", "La TV mostra una scena affollata per 8 secondi; scompare e ogni team ricostruisce tre dettagli.", "team", 45, "Correttezza, non numero di giocatori."],
  [2, "pixel-killer", "Pixel killer", "Una fotografia originale è sfocata; indizi visivi progressivi permettono di identificarne il soggetto.", "team", 40, "Più punti se il team risponde prima degli indizi successivi."],
  [3, "screenshot-traditore", "Screenshot traditore", "Due schermate fittizie sembrano identiche, ma una nasconde un cambiamento decisivo.", "team", 30, "Punto solo per dettaglio corretto; errore costa tempo."],
  [4, "tempo-fantasma", "Tempo fantasma", "Senza cronometro a schermo, la squadra deve fermare un timer il più vicino possibile a 12 secondi.", "team", 25, "Scarto assoluto dal tempo bersaglio."],
  [5, "ordine-nel-caos", "Ordine nel caos", "Quattro azioni, eventi o fotogrammi vanno disposti nel giusto ordine causale.", "team", 40, "Punti per posizione corretta, bonus sequenza perfetta."],
  [6, "un-secondo-prima", "Un secondo prima", "Un breve video originale si interrompe; il team deve prevedere il fotogramma successivo.", "team", 30, "100 per previsione corretta."],
  [7, "titoli-tagliati", "Titoli tagliati", "Appaiono titoli inventati, realistici e ironici; manca la frase che dà senso alla notizia.", "team", 30, "Plausibilità verificata su chiave di risposta, non voto soggettivo."],
  [8, "non-e-quello-che-sembra", "Non è quello che sembra", "Tre immagini si assomigliano; solo una rispetta la descrizione esatta sullo schermo.", "team", 25, "Precisione + bonus di rapidità limitato."],
  [9, "la-sequenza-sporca", "La sequenza sporca", "Tra simboli e numeri c'è una regola; un solo elemento la viola.", "team", 30, "Un punto corretto o nessun punto."],
  [10, "il-dettaglio-da-100", "Il dettaglio da 100", "Una scena piena di stimoli dura 6 secondi; il team risponde a una domanda molto specifica.", "team", 25, "Domande nuove selezionate per difficoltà comparabile."],
  [11, "cifra-improbabile", "La cifra improbabile", "Indovinare una quantità visiva (oggetti, metri, secondi) senza sapere il valore esatto.", "team", 35, "Punti proporzionali alla vicinanza, con tetto massimo."],
  [12, "rumore-di-fondo", "Rumore di fondo", "Tre suoni originali si sovrappongono: va riconosciuto quello dominante o estraneo.", "team", 30, "Versione alternativa testuale per accessibilità."],
  [13, "feed-in-5-secondi", "Feed in 5 secondi", "Scorrono cinque post fittizi con particolari; una domanda verifica attenzione e memoria.", "team", 30, "Correttezza e non velocità di lettura estrema."],
  [14, "effetto-domino", "Effetto domino", "Tra quattro situazioni, individuare l'unica conseguenza logicamente coerente.", "team", 35, "Stessa difficoltà per tutti i tavoli."],
  [15, "indizio-dopo-indizio", "Indizio dopo indizio", "Un oggetto o concetto viene svelato tramite tre indizi progressivi.", "team", 45, "100/70/40 in base all'indizio usato."],
  [16, "sotto-la-superficie", "Sotto la superficie", "Un finto messaggio di chat contiene un doppio significato: riconoscere l'intenzione più probabile.", "team", 35, "Chiave editoriale univoca, niente risposte controverse."],
  // 02 · FREGALI TUTTI!
  [17, "scegli-il-bersaglio", "Scegli il bersaglio", "La squadra seleziona chi sfidare; entrambi affrontano lo stesso puzzle a difficoltà identica.", "duel", 60, "Vincitore +40, perdente 0; nessuna sottrazione."],
  [18, "taglia-il-tempo", "Taglia il tempo", "Vincendo una prova lampo, il team può ridurre di 3 secondi il tempo di una sfida successiva all'avversario.", "duel", 50, "Effetto massimo una volta per tavolo per round."],
  [19, "scudo-rapido", "Scudo rapido", "Un micro-enigma permette di attivare uno scudo contro il prossimo attacco valido.", "team", 45, "Scudo non cumulabile; scade alla fine della manche."],
  [20, "contrattacco", "Contrattacco", "Il tavolo bersagliato può scegliere una prova rapida per ottenere un bonus di rivincita.", "duel", 50, "Massimo +40; non attiva catene infinite."],
  [21, "caccia-alla-capolista", "Caccia alla capolista", "Sfida opzionale contro chi guida; se il leader vince, ottiene anch'esso una piccola ricompensa.", "duel", 60, "Bonus limitato e simmetrico per evitare bullismo competitivo."],
  [22, "furto-con-destrezza", "Furto con destrezza", "Per sottrarre punti servono due indizi risolti correttamente entro il timer.", "duel", 60, "Trasferimento massimo 40, una sola volta per round."],
  [23, "asta-al-buio", "Asta al buio", "I tavoli offrono una quota di punti guadagnati per un bonus di manche, senza vedere le offerte altrui.", "team", 45, "Costo addebitato solo al vincitore; tetto d'offerta."],
  [24, "doppio-rischio", "Doppio rischio", "Scegliere prima della prova tra ricompensa normale e alta con penalità moderata.", "team", 45, "Esito fissato dal regolamento prima della scelta."],
  [25, "scegli-il-terreno", "Scegli il terreno", "Un tavolo seleziona tra due categorie, entrambe con difficoltà e punti equivalenti.", "team", 50, "Non si può scegliere la stessa categoria due volte di fila."],
  [26, "la-trappola", "La trappola", "Si piazza una trappola di logica; il bersaglio può disinnescarla con una risposta corretta.", "duel", 50, "Massimo -30 al bersaglio, con protezione anti-focus."],
  [27, "il-patto-di-60-secondi", "Il patto di 60 secondi", "Due squadre collaborano su un codice composto da due metà visibili separatamente.", "duel", 60, "Bonus uguale per entrambe se risolvono."],
  [28, "la-sfida-incrociata", "La sfida incrociata", "Due tavoli ricevono versioni speculari della stessa griglia, da risolvere nel minor tempo valido.", "duel", 60, "Tempo mediano con pari condizioni."],
  [29, "bottone-del-caos", "Bottone del Caos", "Potere unico della serata: sfida pubblica contro un tavolo, attivabile solo in finestre consentite.", "duel", 45, "+50 a chi vince; nessun malus eccessivo."],
  [30, "scambio-di-posta", "Scambio di posta", "Prima di un round i due tavoli concordano una posta limitata, poi giocano entrambi.", "duel", 60, "Scambio massimo 40; consenso di entrambe le squadre."],
  [31, "falso-vantaggio", "Falso vantaggio", "Il team sceglie tra due premi coperti: uno immediato, uno condizionato a un enigma.", "team", 40, "Probabilità e valore dei premi documentati nel regolamento."],
  [32, "ultima-parola", "Ultima parola", "Il capitano deve scegliere quando bloccare la risposta della squadra, mentre gli indizi continuano.", "team", 45, "Risposta precoce vale più punti se corretta."],
  // 03 · IL PUB DECIDE!
  [33, "prevedi-la-maggioranza", "Prevedi la maggioranza", "Scegliere quale opzione voterà la maggioranza dei tavoli in un dilemma leggero e universale.", "pub", 60, "Un voto per tavolo; punti per previsione esatta."],
  [34, "chi-ha-votato-cosa", "Chi ha votato cosa?", "Ogni team vota un'opzione; un capitano deve intuire la scelta prevalente del locale.", "pub", 60, "Risultati aggregati, mai nomi individuali."],
  [35, "sincronizzati", "Sincronizzati", "Ogni giocatore dello stesso tavolo seleziona segretamente una delle quattro scelte plausibili.", "vote", 35, "Punti sulla quota di accordo, normalizzata tra squadre."],
  [36, "il-capitano-ci-conosce", "Il capitano ci conosce?", "Il capitano prevede quale risposta sceglierà la maggioranza del suo tavolo.", "vote", 50, "Tie-break definito in anticipo."],
  [37, "quanto-siete-prevedibili", "Quanto siete prevedibili", "Indovinare la percentuale di tavoli che sceglierà una proposta surreale, ma innocua.", "pub", 45, "Punteggio in base alla distanza dal risultato reale."],
  [38, "pub-contro-tavolo", "Pub contro tavolo", "Un team sfida tutti gli altri in una prova simultanea, con bonus se supera la media dei rivali.", "team", 60, "Tutti giocano; il tavolo scelto non è penalizzato a priori."],
  [39, "dilemma-pubblico", "Il dilemma pubblico", "Ogni squadra sceglie cooperare o competere; la combinazione determina ricompense trasparenti.", "pub", 55, "Matrice punti visibile prima della decisione."],
  [40, "parola-che-gira", "Parola che gira", "Ogni tavolo propone una parola a tema; le risposte filtrate vengono usate in un quiz a eliminazione di parole.", "pub", 70, "Moderazione e whitelist; nessun testo grezzo su TV."],
  [41, "indovina-il-preferito", "Indovina il preferito", "Fra quattro scenari di vita adulta (vacanze, lavoro, amici), prevedere il preferito del pubblico.", "pub", 55, "Temi neutri, niente dati sensibili."],
  [42, "catena-di-codici", "Catena di codici", "I membri ricevono pezzi di un codice; devono collaborare per comporlo.", "coop", 60, "Numero di frammenti scalato alla dimensione squadra."],
  [43, "questione-di-istinto", "Questione di istinto", "Tutti i tavoli reagiscono a tre situazioni rapide; vince chi mantiene una scelta coerente.", "pub", 60, "Punteggio calcolato su regola annunciata."],
  [44, "allineamento-perfetto", "Allineamento perfetto", "Le squadre scelgono una risposta senza potersi confrontare con altri tavoli; conta la convergenza.", "pub", 40, "Un voto per tavolo, nessun vantaggio numerico."],
  [45, "il-pub-ha-torto", "Il pub ha torto?", "Viene mostrato un dato fittizio verificabile; i tavoli decidono se la maggioranza sbaglierà.", "pub", 60, "Punti distinti per risposta e previsione."],
  [46, "alleanza-espressa", "Alleanza espressa", "Due tavoli uniscono due mezzi indizi per decifrare una frase o combinazione.", "duel", 60, "Entrambi guadagnano o entrambi no."],
  [47, "effetto-gregge", "Effetto gregge", "Una squadra può scegliere di seguire la risposta più popolare o la propria intuizione.", "pub", 50, "Il voto popolare non è necessariamente corretto."],
  [48, "gira-la-scelta", "Gira la scelta", "Un evento comune mostra tre rischi; ogni tavolo decide quale affrontare prima che si sveli la prova.", "pub", 60, "Stesse probabilità e ricompense predefinite."],
  // 04 · IL GRANDE INGANNO
  [49, "credici-o-no", "Credici o no", "Un tavolo comunica una risposta all'avversario; può dire la verità o proporre una falsità.", "duel", 60, "Punti per bluff riuscito o smascherato."],
  [50, "il-testimone", "Il testimone", "Un membro riceve un indizio vero su un caso inventato; il gruppo deve capire se usarlo o rischiare.", "coop", 65, "Nessuna menzogna obbligatoria sui giocatori reali."],
  [51, "tre-versioni", "Tre versioni", "Tre testimonianze fittizie raccontano lo stesso evento; una sola rispetta tutti i fatti noti.", "team", 60, "Soluzione deterministica, spiegabile a fine round."],
  [52, "archivio-manomesso", "Archivio manomesso", "Un fascicolo grafico contiene un dettaglio modificato; bisogna scoprirlo confrontando le prove.", "team", 60, "Punti per anomalia corretta."],
  [53, "compra-un-indizio", "Compra un indizio", "Il team può sacrificare 20 punti potenziali per ottenere un dettaglio supplementare.", "team", 60, "Il costo è noto e non può creare punti negativi."],
  [54, "la-contraddizione", "La contraddizione", "Tre messaggi fittizi dello stesso personaggio non possono essere tutti veri. Individuare la contraddizione.", "team", 50, "Una soluzione editoriale verificata."],
  [55, "fiducia-cieca", "Fiducia cieca", "Gli avversari suggeriscono una risposta; il team decide se accettarla o risolvere in autonomia.", "duel", 60, "Punti simmetrici, nessuna penalizzazione personale."],
  [56, "la-bugia-piu-credibile", "La bugia più credibile", "I team compongono un falso indizio da opzioni predefinite; un altro deve distinguerlo dal vero.", "duel", 65, "Nessun campo libero non moderato."],
  [57, "doppio-gioco", "Doppio gioco", "Un team sceglie in segreto quale delle due prove comunicare all'avversario, sapendo che una è più rischiosa.", "duel", 60, "Entrambe le prove hanno punteggi trasparenti."],
  [58, "il-messaggio-interrotto", "Il messaggio interrotto", "Una conversazione inventata è incompleta; i giocatori ricostruiscono il passaggio logico mancante.", "team", 50, "Si valuta coerenza, non cultura generale."],
  [59, "alibi-impossibile", "L'alibi impossibile", "Un caso fittizio contiene orari e movimenti: va individuata l'azione incompatibile con la sequenza.", "team", 70, "Ogni soluzione validata con vincoli logici."],
  [60, "chi-cambia-versione", "Chi cambia versione", "Due giri di dichiarazioni fittizie: scoprire chi si contraddice dopo aver visto una nuova prova.", "team", 65, "Memoria + deduzione, senza dati reali."],
  [61, "negozio-di-sospetti", "Negozio di sospetti", "Ogni team investe pochi punti per rivelare una delle tre prove di un mistero.", "team", 60, "Punto massimo ridotto proporzionalmente."],
  [62, "la-finta-prova", "La finta prova", "Su tre elementi di un dossier, uno è costruito per depistare; il team deve riconoscerlo.", "team", 50, "Debrief mostra perché è falso."],
  [63, "la-frase-a-meta", "La frase a metà", "Un tavolo vede l'inizio di una frase, l'altro il finale: decidono se condividere o ingannare.", "duel", 60, "Entrambi vedono le regole prima della scelta."],
  [64, "ultimo-indizio", "Ultimo indizio", "Ogni 15 secondi appare un indizio; la squadra può bloccare la risposta in qualsiasi momento.", "team", 60, "Punteggio scende per ogni indizio richiesto."],
  // 05 · TUTTO O NIENTE!
  [65, "puntata-nascosta", "Puntata nascosta", "Prima della prova, ogni tavolo impegna una quota regolamentata dei propri punti.", "team", 60, "Max 25% del saldo e max 250; saldo mai negativo."],
  [66, "ultima-chiamata", "Ultima chiamata", "Una raffica di tre micro-sfide decide un bonus finale, con risposte simultanee.", "team", 70, "Score solo per correttezza, rapidità come tie-break."],
  [67, "la-cassa-chiusa", "La cassa chiusa", "Tre serrature logiche si aprono risolvendo indizi concatenati.", "team", 75, "Bonus per completamento, parziali per step."],
  [68, "solo-un-dettaglio", "Solo un dettaglio", "Una clip originale viene mostrata una sola volta; la risposta riguarda un dettaglio marginale.", "team", 50, "Stessa clip per tutti i tavoli."],
  [69, "soglia-di-rischio", "Soglia di rischio", "La squadra dichiara quante risposte pensa di azzeccare su tre domande veloci.", "team", 75, "Bonus se raggiunge la soglia dichiarata."],
  [70, "punto-di-rottura", "Punto di rottura", "Tre decisioni collegate richiedono coerenza strategica: la prima influenza le opzioni successive.", "team", 75, "Score garantito per percorso valido, extra per ottimale."],
  [71, "sicuro-o-rischio", "Sicuro o rischio", "Scegliere una prova da 100 punti accessibile o una da 240 più complessa.", "team", 65, "Difficoltà calibrata; nessun risultato casuale."],
  [72, "duello-silenzioso", "Duello silenzioso", "Due squadre vedono un puzzle uguale e nessuna sa se l'altra ha già terminato.", "duel", 70, "100 al vincitore, 60 se pareggio valido."],
  [73, "l-imboscata", "L'imboscata", "Un avversario sceglie il tipo di prova, ma il bersaglio decide quanto rischiare.", "duel", 70, "Limiti anti-target ripetuto."],
  [74, "tre-carte-un-destino", "Tre carte, un destino", "Tre carte nascondono sfide diverse ma ricompense comparabili; il team sceglie prima di rivelarle.", "team", 70, "Distribuzione casuale con seed verificabile."],
  [75, "il-mercato-finale", "Il mercato finale", "Spendere parte del punteggio per acquistare un singolo indizio per il finale.", "team", 45, "Costo massimo 50, un acquisto per team."],
  [76, "il-filo-rosso", "Il filo rosso", "Tre indizi raccolti in manche precedenti convergono in un enigma finale.", "team", 75, "Indizi riepilogati per chi ha perso connessione."],
  [77, "classifica-buia", "Classifica buia", "Senza vedere le posizioni, ogni squadra sceglie prudenza o rischio in base al proprio punteggio.", "team", 40, "Punteggi nascosti ma saldo personale visibile."],
  [78, "la-penultima-mossa", "La penultima mossa", "I tavoli possono giocare l'ultima difesa o conservarla per l'ultima prova.", "team", 45, "Scelta irrevocabile e visibile dopo lock."],
  [79, "falso-finale", "Falso finale", "Compare una classifica apparentemente conclusiva; parte invece una prova bonus annunciata dal regolamento.", "team", 60, "La sorpresa è narrativa, non modifica regole a posteriori."],
  [80, "l-ultima-decisione", "L'ultima decisione", "Ultima sfida: il team sceglie tra premio sicuro e grande rischio, poi completa un enigma comune.", "team", 75, "Esito e puntata espliciti; reveal dal fondo alla vetta."],
];

export function mancheOf(n: number): MancheNo {
  return (Math.min(5, Math.max(1, Math.ceil(n / 16))) as MancheNo);
}

/** Costruisce il catalogo: lo stato dipende SOLO dal registro delle meccaniche implementate. */
export function buildCatalog(implemented: readonly MechanicDef[]): CatalogEntry[] {
  const byCode = new Map(implemented.map((m) => [m.code, m]));
  return ROWS.map(([number, code, title, description, input, timerSec, pointsRule]) => {
    const m = byCode.get(code);
    return {
      number,
      code,
      manche: mancheOf(number),
      title: m?.title ?? title,
      description,
      input: m?.input ?? input,
      timerSec: m?.timerSec ?? timerSec,
      pointsRule,
      status: m ? "implementata" : "da-implementare",
    };
  });
}

/** Righe grezze (per i test di coerenza col PDF). */
export const CATALOG_ROWS: readonly Row[] = ROWS;
