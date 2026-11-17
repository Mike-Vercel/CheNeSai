import type { TreVersioniInput } from "@/lib/tig/games/mechanics/tre-versioni";

/**
 * 51 · TRE VERSIONI — tre testimoni inventati, fatti certi. Una sola versione rispetta tutti i fatti;
 * ogni versione sbagliata ne viola almeno uno in modo verificabile.
 */
const varianti: TreVersioniInput[] = [
  {
    id: "festa-di-livia",
    event: "Chi è uscito per ultimo dalla festa di Livia?",
    facts: [
      "La festa è finita all'una e l'ultimo autobus è passato alle 00:40.",
      "Fuori ha iniziato a piovere a mezzanotte.",
      "L'ascensore del palazzo è rimasto guasto tutta la sera.",
    ],
    versions: [
      { id: "ugo", who: "Ugo", text: "Me ne sono andato a mezzanotte e mezza: ho preso l'ascensore perché ero distrutto e ho fatto in tempo all'ultimo autobus." },
      { id: "fede", who: "Fede", text: "Alle 00:50 ho fatto le scale di corsa e sotto la pioggia ho preso l'ultimo autobus al volo." },
      { id: "sami", who: "Sami", text: "Ho aiutato Livia a sistemare fino all'una, poi ho fatto le scale e sono tornato a piedi sotto la pioggia col cappuccio." },
    ],
    solution: {
      versionId: "sami",
      why: {
        ugo: "L'ascensore era guasto tutta la sera: Ugo non può averlo preso.",
        fede: "L'ultimo autobus è passato alle 00:40: alle 00:50 non c'era più niente da prendere al volo.",
      },
    },
    explain: "Solo Sami rispetta tutto: fine festa all'una, scale (ascensore guasto), pioggia già iniziata e niente autobus dopo le 00:40.",
  },
  {
    id: "compleanno-di-bianca",
    event: "La cena di compleanno di Bianca",
    facts: [
      "Il locale accetta solo pagamenti con carta.",
      "La torta è arrivata alle 22, dopo il secondo giro di portate.",
      "A tavola erano in otto, Bianca compresa.",
    ],
    versions: [
      { id: "carlo", who: "Carlo", text: "Abbiamo pagato in contanti dividendo per otto, e solo dopo è arrivata la torta con le candeline." },
      { id: "irene", who: "Irene", text: "Eravamo in sette più la festeggiata. La torta è arrivata alle dieci, appena finito il secondo giro, poi abbiamo pagato con le carte." },
      { id: "max", who: "Max", text: "La torta è arrivata subito, alle nove, prima ancora del secondo giro: Bianca non se l'aspettava proprio." },
    ],
    solution: {
      versionId: "irene",
      why: {
        carlo: "Il locale accetta solo carte: pagare in contanti non era possibile.",
        max: "La torta è arrivata alle 22 dopo il secondo giro, non alle 21 prima.",
      },
    },
    explain: "Irene ha ragione: sette più Bianca fa otto, torta alle 22 dopo il secondo giro, pagamento con carta. La sua frase sembrava sbagliata, ma non lo era.",
  },
  {
    id: "trasloco-sabato",
    event: "Il trasloco di sabato mattina",
    facts: [
      "Il furgone è stato restituito a mezzogiorno in punto.",
      "Il nuovo appartamento è al quinto piano, senza ascensore.",
      "Il divano non passava dalla porta ed è rimasto al vecchio indirizzo.",
    ],
    versions: [
      { id: "pina", who: "Pina", text: "Alle undici abbiamo caricato l'ultimo pezzo, il divano, e l'abbiamo portato su per cinque piani di scale: una fatica tremenda." },
      { id: "teo", who: "Teo", text: "Cinque piani a piedi tutta la mattina. Il divano l'abbiamo dovuto lasciare dov'era e a mezzogiorno ho riportato il furgone." },
      { id: "alessia", who: "Alessia", text: "Per fortuna c'era l'ascensore: abbiamo finito presto e abbiamo tenuto il furgone fino alle due per fare un giro." },
    ],
    solution: {
      versionId: "teo",
      why: {
        pina: "Il divano non è mai entrato nel nuovo appartamento: è rimasto al vecchio indirizzo.",
        alessia: "Il palazzo nuovo non ha ascensore e il furgone è tornato a mezzogiorno, non alle due.",
      },
    },
    explain: "Teo rispetta tutti i fatti: scale per cinque piani, divano lasciato indietro, furgone restituito a mezzogiorno.",
  },
  {
    id: "riunione-saltata",
    event: "La riunione saltata del lunedì",
    facts: [
      "La riunione era fissata alle 9:30 in sala Blu.",
      "Alle 9:30 la sala Blu era occupata dal corso sulla sicurezza.",
      "Alle 9:20 il capo ha scritto in chat: «spostiamo tutto online».",
    ],
    versions: [
      { id: "ernesto", who: "Ernesto", text: "Alle 9:25 ho visto il messaggio del capo e mi sono collegato da casa. Online eravamo in quattro." },
      { id: "gaia", who: "Gaia", text: "Alle 9:30 sono entrata in sala Blu: era vuota. Ho aspettato dieci minuti e non è arrivato nessuno." },
      { id: "nadia", who: "Nadia", text: "Il capo ha avvisato solo alle 9:45 che la riunione era online, quando eravamo già tutti seduti ad aspettare." },
    ],
    solution: {
      versionId: "ernesto",
      why: {
        gaia: "Alle 9:30 la sala Blu era piena per il corso sulla sicurezza: non poteva essere vuota.",
        nadia: "Il messaggio del capo è delle 9:20, non delle 9:45.",
      },
    },
    explain: "Solo Ernesto è coerente: ha letto il messaggio delle 9:20 alle 9:25 e si è collegato. Gaia e Nadia contraddicono un fatto certo.",
  },
  {
    id: "concerto-all-aperto",
    event: "La sera del concerto all'aperto",
    facts: [
      "I cancelli hanno aperto alle 19.",
      "Alle 22:15 un temporale ha interrotto il concerto, che non è più ripreso.",
      "Si entrava solo con il biglietto sul telefono.",
    ],
    versions: [
      { id: "rino", who: "Rino", text: "Siamo entrati alle 18:30 per prenderci il posto sotto il palco, con i biglietti stampati in mano." },
      { id: "lucia", who: "Lucia", text: "Siamo entrati alle sette e un quarto mostrando il telefono. Alle dieci passate è arrivato il temporale e siamo scappati." },
      { id: "bruno", who: "Bruno", text: "Il temporale è durato poco: dopo mezz'ora hanno ripreso a suonare e sono andati avanti fino a mezzanotte." },
    ],
    solution: {
      versionId: "lucia",
      why: {
        rino: "Alle 18:30 i cancelli erano ancora chiusi, e i biglietti stampati non valevano.",
        bruno: "Dopo il temporale delle 22:15 il concerto non è più ripreso.",
      },
    },
    explain: "Lucia rispetta tutto: ingresso dopo le 19 con il telefono, temporale poco dopo le 22. Rino e Bruno sbattono contro un fatto certo.",
  },
  {
    id: "weekend-in-baita",
    event: "Il weekend in baita",
    facts: [
      "La baita si raggiunge solo a piedi: 40 minuti dal parcheggio.",
      "Sabato ha nevicato tutto il giorno.",
      "In baita il telefono non prende.",
    ],
    versions: [
      { id: "dora", who: "Dora", text: "Sabato pomeriggio, con la neve che non smetteva, abbiamo giocato a carte. Per chiamare casa sono scesa fino al parcheggio." },
      { id: "ivo", who: "Ivo", text: "Siamo arrivati in macchina fin davanti alla porta e sabato c'era un sole splendido." },
      { id: "mara", who: "Mara", text: "Sabato sera ho fatto una videochiamata dal divano della baita per far vedere la neve a mia sorella." },
    ],
    solution: {
      versionId: "dora",
      why: {
        ivo: "In baita non si arriva in macchina e sabato ha nevicato tutto il giorno.",
        mara: "In baita il telefono non prende: niente videochiamate dal divano.",
      },
    },
    explain: "Dora è l'unica coerente: neve tutto sabato, nessun campo in baita (per telefonare bisogna scendere), arrivo solo a piedi.",
  },
  {
    id: "visita-appartamento",
    event: "La visita all'appartamento in affitto",
    facts: [
      "La visita era alle 18, ma il proprietario è arrivato alle 18:20.",
      "L'appartamento è al piano terra.",
      "Il contratto è stato firmato la settimana dopo.",
    ],
    versions: [
      { id: "gino", who: "Gino", text: "Il proprietario era già lì quando siamo arrivati alle sei, e abbiamo firmato subito sul tavolo della cucina." },
      { id: "sofia", who: "Sofia", text: "Abbiamo aspettato una ventina di minuti sotto casa. Dalle finestre si vedeva il cortile da vicino. Abbiamo firmato tutto qualche giorno dopo, la settimana seguente." },
      { id: "paolo", who: "Paolo", text: "Il proprietario è arrivato in ritardo, ma ne è valsa la pena: dal balcone del terzo piano la vista era bellissima." },
    ],
    solution: {
      versionId: "sofia",
      why: {
        gino: "Il proprietario è arrivato con venti minuti di ritardo e il contratto è stato firmato la settimana dopo, non subito.",
        paolo: "L'appartamento è al piano terra: nessun balcone al terzo piano.",
      },
    },
    explain: "Sofia rispetta i tre fatti: venti minuti di attesa, appartamento a piano terra, firma la settimana successiva.",
  },
];

export default varianti;
