import type { IstintoInput } from "@/lib/tig/games/mechanics/questione-di-istinto";

/**
 * 43 · QUESTIONE DI ISTINTO — tre stili per variante, tre situazioni con una reazione per stile. Lo stile di ogni
 * reazione è una scelta editoriale chiara, spiegata al reveal; nessuna reazione è «sbagliata» o umiliante.
 */
const varianti: IstintoInput[] = [
  {
    id: "testa-cuore-pancia",
    difficulty: "facile",
    styles: [
      { id: "testa", name: "Testa" },
      { id: "cuore", name: "Cuore" },
      { id: "pancia", name: "Pancia" },
    ],
    situations: [
      {
        id: "capo",
        prompt: "Il capo ti scrive alle 22: «Domani ne parliamo».",
        options: [
          { id: "scaletta", text: "Prepari una scaletta dei possibili argomenti", style: "testa" },
          { id: "collega", text: "Scrivi a un collega per farti rassicurare", style: "cuore" },
          { id: "subito", text: "Rispondi subito: «Di cosa?»", style: "pancia" },
        ],
      },
      {
        id: "regalo",
        prompt: "Hai dieci minuti per scegliere il regalo di un amico.",
        options: [
          { id: "recensioni", text: "Confronti tre recensioni e prendi il più utile", style: "testa" },
          { id: "ricordo", text: "Prendi quello che vi ricorda una serata insieme", style: "cuore" },
          { id: "primo", text: "Prendi il primo che ti fa ridere", style: "pancia" },
        ],
      },
      {
        id: "volo",
        prompt: "Il tuo volo è cancellato e sei già in aeroporto.",
        options: [
          { id: "alternative", text: "Controlli alternative e rimborsi prima di muoverti", style: "testa" },
          { id: "avvisi", text: "Chiami chi ti aspetta per avvisarlo", style: "cuore" },
          { id: "treno", text: "Prendi il primo treno che va nella direzione giusta", style: "pancia" },
        ],
      },
    ],
    explain: "La testa ragiona prima di agire, il cuore pensa alle persone coinvolte, la pancia fa la prima cosa che sente. Chi ha preso tre volte la stessa strada è stato coerente.",
  },
  {
    id: "calma-squadra-azione",
    difficulty: "media",
    styles: [
      { id: "calma", name: "Calma" },
      { id: "squadra", name: "Squadra" },
      { id: "azione", name: "Azione" },
    ],
    situations: [
      {
        id: "ascensore",
        prompt: "L'ascensore si blocca tra due piani con tre sconosciuti.",
        options: [
          { id: "allarme", text: "Premi l'allarme e aspetti respirando piano", style: "calma" },
          { id: "presentazioni", text: "Fai presentare tutti e tieni alto il morale", style: "squadra" },
          { id: "porte", text: "Provi ad aprire le porte con le mani", style: "azione" },
        ],
      },
      {
        id: "blackout",
        prompt: "Salta la luce nel palazzo mentre hai ospiti a cena.",
        options: [
          { id: "candele", text: "Accendi le candele e la cena continua", style: "calma" },
          { id: "vicini", text: "Bussi ai vicini per capire cosa succede", style: "squadra" },
          { id: "quadro", text: "Corri al quadro elettrico con la torcia", style: "azione" },
        ],
      },
      {
        id: "gomma",
        prompt: "Gomma bucata in tangenziale, di sera.",
        options: [
          { id: "soccorso", text: "Ti fermi, triangolo e chiami il soccorso", style: "calma" },
          { id: "amico", text: "Chiami l'amico che sa cambiarla e vi organizzate", style: "squadra" },
          { id: "cambi", text: "La cambi da solo, subito", style: "azione" },
        ],
      },
    ],
    explain: "Calma aspetta e mette in sicurezza, squadra coinvolge gli altri, azione mette le mani sul problema. Tre reazioni sensate: conta solo restare sulla stessa strada.",
  },
  {
    id: "piano-improvvisa-delega",
    difficulty: "media",
    styles: [
      { id: "piano", name: "Il piano" },
      { id: "improvvisa", name: "Improvvisare" },
      { id: "delega", name: "La delega" },
    ],
    situations: [
      {
        id: "cena",
        prompt: "Organizzi una cena per otto amici.",
        options: [
          { id: "menu", text: "Menù deciso una settimana prima", style: "piano" },
          { id: "frigo", text: "Apri il frigo alle sette e vedi cosa viene fuori", style: "improvvisa" },
          { id: "porta", text: "Ognuno porta qualcosa, tu metti i piatti", style: "delega" },
        ],
      },
      {
        id: "trasloco",
        prompt: "Devi traslocare tra due settimane.",
        options: [
          { id: "lista", text: "Lista delle scatole stanza per stanza", style: "piano" },
          { id: "sera-prima", text: "Inizi a impacchettare la sera prima", style: "improvvisa" },
          { id: "amici", text: "Chiami gli amici in cambio di pizza e birra", style: "delega" },
        ],
      },
      {
        id: "vacanza",
        prompt: "C'è da organizzare la vacanza di gruppo.",
        options: [
          { id: "foglio", text: "Foglio condiviso con orari e costi", style: "piano" },
          { id: "primo-giorno", text: "Si prenota solo la prima notte, poi si vede", style: "improvvisa" },
          { id: "organizzato", text: "Lasci decidere all'amico più organizzato", style: "delega" },
        ],
      },
    ],
    explain: "Il piano mette tutto in fila prima, l'improvvisazione si fida del momento, la delega trova chi lo fa meglio. Tutti e tre funzionano, ma solo se ci si crede fino in fondo.",
  },
  {
    id: "diplomatico-diretto-ironico",
    difficulty: "media",
    styles: [
      { id: "diplomatico", name: "Diplomatico" },
      { id: "diretto", name: "Diretto" },
      { id: "ironico", name: "Ironico" },
    ],
    situations: [
      {
        id: "piatti",
        prompt: "Il coinquilino lascia i piatti sporchi da tre giorni.",
        options: [
          { id: "turni", text: "Proponi una tabella dei turni per tutti", style: "diplomatico" },
          { id: "chiaro", text: "Gli dici chiaro che stasera tocca a lui", style: "diretto" },
          { id: "biglietto", text: "Gli lasci un biglietto firmato «i piatti»", style: "ironico" },
        ],
      },
      {
        id: "ritardo",
        prompt: "Un collega arriva sempre tardi alle riunioni.",
        options: [
          { id: "privato", text: "Gli chiedi in privato se l'orario gli va bene", style: "diplomatico" },
          { id: "senza", text: "Inizi la riunione senza di lui", style: "diretto" },
          { id: "sveglia", text: "Gli regali una sveglia gigante", style: "ironico" },
        ],
      },
      {
        id: "prestito",
        prompt: "Un amico non ti ha ancora ridato 20 euro.",
        options: [
          { id: "occasione", text: "Aspetti l'occasione giusta per parlarne", style: "diplomatico" },
          { id: "messaggio", text: "Gli mandi un messaggio con l'importo", style: "diretto" },
          { id: "cartolina", text: "Gli mandi una cartolina dalla vacanza che ti sei perso", style: "ironico" },
        ],
      },
    ],
    explain: "Il diplomatico cerca un accordo, il diretto dice le cose come stanno, l'ironico le dice ridendo. Tre modi civili di affrontare un fastidio: coerenza premiata.",
  },
  {
    id: "risparmio-comodita-avventura",
    difficulty: "media",
    styles: [
      { id: "risparmio", name: "Risparmio" },
      { id: "comodita", name: "Comodità" },
      { id: "avventura", name: "Avventura" },
    ],
    situations: [
      {
        id: "venerdi",
        prompt: "Cena del venerdì, nessuno ha voglia di cucinare.",
        options: [
          { id: "pasta", text: "Pasta con quello che c'è in dispensa", style: "risparmio" },
          { id: "consegna", text: "Consegna a domicilio dal solito posto", style: "comodita" },
          { id: "nuovo", text: "Il ristorante nuovo che nessuno ha ancora provato", style: "avventura" },
        ],
      },
      {
        id: "ferie",
        prompt: "Una settimana di ferie da prenotare.",
        options: [
          { id: "ostello", text: "Ostello e offerte dell'ultimo minuto", style: "risparmio" },
          { id: "albergo", text: "Albergo con colazione vicino alla spiaggia", style: "comodita" },
          { id: "tenda", text: "Tenda in un posto mai visto", style: "avventura" },
        ],
      },
      {
        id: "telefono",
        prompt: "Il telefono ti cade e lo schermo si rompe.",
        options: [
          { id: "riparazione", text: "Lo fai riparare in un negozietto", style: "risparmio" },
          { id: "uguale", text: "Compri lo stesso modello, subito", style: "comodita" },
          { id: "diverso", text: "Provi un telefono di un tipo che non hai mai usato", style: "avventura" },
        ],
      },
    ],
    explain: "Risparmio guarda il portafoglio, comodità il proprio tempo, avventura la novità. Chi è rimasto sulla stessa linea in tutte e tre ha un istinto riconoscibile.",
  },
  {
    id: "nostalgico-curioso-pratico",
    difficulty: "facile",
    styles: [
      { id: "nostalgico", name: "Nostalgico" },
      { id: "curioso", name: "Curioso" },
      { id: "pratico", name: "Pratico" },
    ],
    situations: [
      {
        id: "musica",
        prompt: "Scegli tu la musica per un viaggio in auto.",
        options: [
          { id: "superiori", text: "Le canzoni dei tempi delle superiori", style: "nostalgico" },
          { id: "generi", text: "Una selezione di generi che non conosci", style: "curioso" },
          { id: "radio", text: "La radio, così non ci pensi", style: "pratico" },
        ],
      },
      {
        id: "ristorante",
        prompt: "Si sceglie il ristorante per un compleanno.",
        options: [
          { id: "storico", text: "Quello dove andavate sempre anni fa", style: "nostalgico" },
          { id: "strano", text: "Quello appena aperto con il menù strano", style: "curioso" },
          { id: "parcheggio", text: "Quello vicino con il parcheggio", style: "pratico" },
        ],
      },
      {
        id: "film",
        prompt: "Serata film, scegli tu.",
        options: [
          { id: "rivisto", text: "Un film visto mille volte da ragazzi", style: "nostalgico" },
          { id: "straniero", text: "Un film straniero di cui nessuno sa niente", style: "curioso" },
          { id: "corto", text: "Il più corto, domani si lavora", style: "pratico" },
        ],
      },
    ],
    explain: "Il nostalgico torna dove è stato bene, il curioso cerca quello che non conosce, il pratico pensa al domani. Tre stili riconoscibili: bastava sceglierne uno e tenerlo.",
  },
  {
    id: "capo-pacere-solitario",
    difficulty: "difficile",
    styles: [
      { id: "capo", name: "Capo" },
      { id: "pacere", name: "Pacere" },
      { id: "solitario", name: "Solitario" },
    ],
    situations: [
      {
        id: "progetto",
        prompt: "Lavoro di gruppo in ufficio, scadenza tra due giorni.",
        options: [
          { id: "dividi", text: "Dividi i compiti e fissi le scadenze", style: "capo" },
          { id: "esclusi", text: "Ti assicuri che nessuno si senta escluso", style: "pacere" },
          { id: "parte", text: "Ti prendi una parte e la finisci per conto tuo", style: "solitario" },
        ],
      },
      {
        id: "gita",
        prompt: "In gita il gruppo non decide dove mangiare.",
        options: [
          { id: "scegli", text: "Scegli tu e porti tutti", style: "capo" },
          { id: "voto", text: "Proponi un voto veloce", style: "pacere" },
          { id: "panino", text: "Ti compri un panino e aspetti", style: "solitario" },
        ],
      },
      {
        id: "discussione",
        prompt: "Due amici discutono al tavolo per una cosa da poco.",
        options: [
          { id: "argomento", text: "Cambi argomento con decisione", style: "capo" },
          { id: "compromesso", text: "Ascolti entrambi e trovi un compromesso", style: "pacere" },
          { id: "bancone", text: "Vai al bancone a ordinare e torni dopo", style: "solitario" },
        ],
      },
    ],
    explain: "Il capo decide per il gruppo, il pacere tiene unito il gruppo, il solitario si sfila con eleganza. Le reazioni si somigliano: per questo è la versione difficile.",
  },
  {
    id: "ottimista-realista-pessimista",
    difficulty: "difficile",
    styles: [
      { id: "ottimista", name: "Ottimista" },
      { id: "realista", name: "Realista" },
      { id: "pessimista", name: "Pessimista" },
    ],
    situations: [
      {
        id: "meteo",
        prompt: "Il meteo dà il 50% di pioggia per la gita di domani.",
        options: [
          { id: "sole", text: "Si parte, il sole arriverà", style: "ottimista" },
          { id: "ombrello", text: "Si parte con l'ombrello nello zaino", style: "realista" },
          { id: "rimanda", text: "Si rimanda, tanto pioverà", style: "pessimista" },
        ],
      },
      {
        id: "colloquio",
        prompt: "Hai appena finito un colloquio di lavoro.",
        options: [
          { id: "primo-giorno", text: "Pensi già a cosa farai il primo giorno", style: "ottimista" },
          { id: "curriculum", text: "Aspetti la risposta e intanto mandi altri curriculum", style: "realista" },
          { id: "altro", text: "Sei sicuro che abbiano scelto un altro", style: "pessimista" },
        ],
      },
      {
        id: "patente",
        prompt: "Un amico fa l'esame di guida domani.",
        options: [
          { id: "festa", text: "Prenoti già la cena per festeggiare", style: "ottimista" },
          { id: "ripasso", text: "Gli ricordi le due cose da ripassare", style: "realista" },
          { id: "prima-volta", text: "Gli dici che alla prima ci si inciampa spesso", style: "pessimista" },
        ],
      },
    ],
    explain: "L'ottimista vede già il risultato, il realista si prepara, il pessimista mette le mani avanti. Tutti al pub hanno un amico per ognuno dei tre: coerenza premiata.",
  },
  {
    id: "sportivo-goloso-pigro",
    difficulty: "facile",
    styles: [
      { id: "sportivo", name: "Sportivo" },
      { id: "goloso", name: "Goloso" },
      { id: "pigro", name: "Pigro" },
    ],
    situations: [
      {
        id: "domenica",
        prompt: "Domenica mattina di sole.",
        options: [
          { id: "corsa", text: "Corsa al parco", style: "sportivo" },
          { id: "paste", text: "Colazione con le paste della pasticceria", style: "goloso" },
          { id: "letto", text: "Letto fino a mezzogiorno", style: "pigro" },
        ],
      },
      {
        id: "mare",
        prompt: "Primo giorno di vacanza al mare.",
        options: [
          { id: "canoa", text: "Noleggi una canoa", style: "sportivo" },
          { id: "friggitoria", text: "Cerchi subito la friggitoria migliore", style: "goloso" },
          { id: "lettino", text: "Ombrellone, lettino e non ti muovi più", style: "pigro" },
        ],
      },
      {
        id: "festa",
        prompt: "Festa a casa di amici.",
        options: [
          { id: "partita", text: "Proponi una partita in giardino", style: "sportivo" },
          { id: "buffet", text: "Ti piazzi vicino al buffet", style: "goloso" },
          { id: "divano", text: "Trovi il divano e lo difendi", style: "pigro" },
        ],
      },
    ],
    explain: "Lo sportivo si muove, il goloso mangia, il pigro si siede. La versione più facile: la coerenza è a portata di mano, se il tavolo si mette d'accordo su chi è.",
  },
  {
    id: "tecnologico-analogico-sociale",
    difficulty: "media",
    styles: [
      { id: "tecnologico", name: "Tecnologico" },
      { id: "analogico", name: "Analogico" },
      { id: "sociale", name: "Sociale" },
    ],
    situations: [
      {
        id: "perso",
        prompt: "Ti perdi in una città che non conosci.",
        options: [
          { id: "mappa", text: "Apri la mappa sul telefono", style: "tecnologico" },
          { id: "cartina", text: "Tiri fuori la cartina di carta", style: "analogico" },
          { id: "passante", text: "Chiedi al primo passante", style: "sociale" },
        ],
      },
      {
        id: "ricetta",
        prompt: "Vuoi cucinare un piatto mai fatto prima.",
        options: [
          { id: "video", text: "Guardi un video con la ricetta", style: "tecnologico" },
          { id: "quaderno", text: "Apri il vecchio quaderno delle ricette", style: "analogico" },
          { id: "zia", text: "Chiami la zia che lo fa benissimo", style: "sociale" },
        ],
      },
      {
        id: "compleanni",
        prompt: "Come ti ricordi i compleanni degli amici?",
        options: [
          { id: "promemoria", text: "Promemoria automatici sul telefono", style: "tecnologico" },
          { id: "calendario", text: "Un calendario appeso in cucina", style: "analogico" },
          { id: "chat", text: "Ci pensa la chat del gruppo", style: "sociale" },
        ],
      },
    ],
    explain: "Il tecnologico si affida allo schermo, l'analogico alla carta, il sociale alle persone. Tre strade valide: vince chi le tiene tutte e tre uguali.",
  },
];

export default varianti;
