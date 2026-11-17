import type { TestimoneInput } from "@/lib/tig/games/mechanics/il-testimone";

/**
 * 50 · IL TESTIMONE — casi inventati. Regola editoriale: la testimonianza vera è compatibile con TUTTI i
 * fatti pubblici e indica la risposta; le due false contraddicono ciascuna almeno un fatto pubblico
 * (orario, accesso, presenza). I testimoni sono personaggi del gioco: i giocatori leggono, non mentono.
 */
const varianti: TestimoneInput[] = [
  {
    id: "monopattino-cortile",
    difficulty: "facile",
    caseTitle: "Il monopattino rigato",
    question: "Chi ha rigato il monopattino nel cortile?",
    facts: ["Il graffio è stato fatto sabato tra le 15 e le 16.", "Sabato il cancello del cortile è rimasto chiuso a chiave fino alle 18: potevano entrare solo i condomini."],
    options: [
      { id: "ada", text: "Ada, condomina del secondo piano" },
      { id: "bruno", text: "Bruno, il corriere" },
      { id: "carla", text: "Carla, condomina del quarto piano" },
      { id: "dario", text: "Dario, amico di Ada" },
    ],
    witnesses: [
      { id: "portinaia", source: "La portinaia", text: "Alle 15:30 ho visto Carla spostare la sua bici e strisciare contro il monopattino." },
      { id: "vicino", source: "Il vicino del primo piano", text: "Alle 15:20 il corriere è entrato in cortile e ha urtato il monopattino col carrello." },
      { id: "amica", source: "Un'amica di Ada", text: "Alle 15:45 Dario è passato dal cortile per salutare Ada e ci è finito contro." },
    ],
    solution: {
      optionId: "carla",
      witnessId: "portinaia",
      notes: {
        portinaia: "Carla abita lì e l'orario è dentro la finestra: tutto torna.",
        vicino: "Il cancello era chiuso a chiave: il corriere non poteva entrare.",
        amica: "Dario non abita lì: col cancello chiuso non poteva passare dal cortile.",
      },
    },
    explain: "Con il cancello chiuso a chiave entravano solo i condomini: corriere e amico di Ada sono fuori, e con loro le due testimonianze che li accusano. Resta la portinaia, che indica Carla.",
  },
  {
    id: "pizza-divano",
    difficulty: "facile",
    caseTitle: "Il cartone della pizza sul divano",
    question: "Chi ha lasciato il cartone della pizza sul divano?",
    facts: ["Il cartone è comparso venerdì sera, dopo le 22.", "Venerdì sera Marta era al cinema fino a mezzanotte."],
    options: [
      { id: "marta", text: "Marta" },
      { id: "nico", text: "Nico" },
      { id: "olga", text: "Olga" },
      { id: "pietro", text: "Pietro" },
    ],
    witnesses: [
      { id: "sopra", source: "Il vicino del piano di sopra", text: "Alle 22:30 ho sentito Marta ridere davanti alla TV, con la pizza." },
      { id: "fattorino", source: "Il fattorino", text: "Alle 22:15 ho consegnato una margherita a un ragazzo con gli occhiali che ha firmato «Nico»." },
      { id: "vicina", source: "La vicina", text: "Alle 21 Olga ha mangiato la pizza sul divano e poi è uscita." },
    ],
    solution: {
      optionId: "nico",
      witnessId: "fattorino",
      notes: {
        sopra: "Alle 22:30 Marta era al cinema: non poteva essere davanti alla TV.",
        fattorino: "Consegna dopo le 22, a casa: compatibile con tutti i fatti.",
        vicina: "Alle 21 il cartone non c'era ancora: è comparso dopo le 22.",
      },
    },
    explain: "Marta era al cinema, quindi il vicino di sopra sbaglia; alle 21 il cartone non c'era, quindi sbaglia la vicina. Il fattorino è l'unico compatibile: è stato Nico.",
  },
  {
    id: "chiavi-auto-aziendale",
    difficulty: "media",
    caseTitle: "Le chiavi dell'auto aziendale",
    question: "Chi ha preso le chiavi dell'auto aziendale?",
    facts: ["Le chiavi sono sparite martedì tra le 13 e le 14 dalla bacheca della reception.", "Dalle 13 alle 14 la reception era chiusa: si entrava solo col badge dell'ufficio commerciale."],
    options: [
      { id: "gina", text: "Gina, ufficio commerciale" },
      { id: "hassan", text: "Hassan, magazzino" },
      { id: "irene", text: "Irene, ufficio commerciale" },
      { id: "jacopo", text: "Jacopo, amministrazione" },
    ],
    witnesses: [
      { id: "magazzino", source: "Il collega del magazzino", text: "Alle 13:30 ho visto Hassan uscire dalla reception con un mazzo di chiavi." },
      { id: "segretaria", source: "La segretaria", text: "Alle 13:40 Irene è entrata in reception col suo badge e ha preso qualcosa dalla bacheca." },
      { id: "stagista", source: "Lo stagista", text: "Le chiavi le ha prese Gina alle 15, l'ho vista io." },
    ],
    solution: {
      optionId: "irene",
      witnessId: "segretaria",
      notes: {
        magazzino: "Hassan non ha il badge del commerciale: alle 13:30 non poteva entrare.",
        segretaria: "Irene è del commerciale e l'orario è dentro la finestra: tutto torna.",
        stagista: "Alle 15 le chiavi erano già sparite da un'ora.",
      },
    },
    explain: "Tra le 13 e le 14 entrava solo il commerciale: Hassan no. Alle 15 le chiavi non c'erano più: Gina no. Resta la segretaria, che indica Irene.",
  },
  {
    id: "regalo-armadio",
    difficulty: "media",
    caseTitle: "Il regalo aperto prima della festa",
    question: "Chi ha aperto il regalo di Lia prima della festa?",
    facts: ["Il pacco era nell'armadio di Lia, chiuso a chiave: la chiave ce l'ha solo chi abita in casa.", "Mercoledì sera il pacco era intatto, venerdì mattina no.", "Lia è in trasferta da mercoledì mattina a sabato."],
    options: [
      { id: "lia", text: "Lia, la festeggiata" },
      { id: "max", text: "Max, coinquilino" },
      { id: "nora", text: "Nora, coinquilina" },
      { id: "ottavio", text: "Ottavio, cugino di passaggio" },
    ],
    witnesses: [
      { id: "vicino", source: "Il vicino di pianerottolo", text: "Giovedì sera ho visto Ottavio aprire l'armadio di Lia con la chiave." },
      { id: "amica", source: "Un'amica di casa", text: "Giovedì pomeriggio Nora mi ha confessato che non resisteva e l'ha aperto." },
      { id: "collega", source: "Un collega di Lia", text: "Giovedì Lia è passata a casa e il pacco l'ha aperto lei, per curiosità." },
    ],
    solution: {
      optionId: "nora",
      witnessId: "amica",
      notes: {
        vicino: "Ottavio non abita lì: non ha la chiave dell'armadio.",
        amica: "Nora abita in casa e giovedì cade tra mercoledì sera e venerdì mattina.",
        collega: "Giovedì Lia era in trasferta: non poteva passare da casa.",
      },
    },
    explain: "Serviva la chiave di casa (fuori Ottavio) ed essere in città giovedì (fuori Lia). L'unica testimonianza compatibile è quella dell'amica: è stata Nora.",
  },
  {
    id: "luci-ufficio",
    difficulty: "media",
    caseTitle: "Le luci accese tutta la notte",
    question: "Chi ha lasciato le luci dell'ufficio accese tutta la notte?",
    facts: ["Le luci si spengono da sole alle 20, a meno che qualcuno non le riaccenda a mano.", "Ieri sera i badge in uscita: Paola alle 18, Sonia alle 19:30, Raoul alle 21:10. Nessuno è uscito dopo. Tullio è in ferie."],
    options: [
      { id: "paola", text: "Paola" },
      { id: "raoul", text: "Raoul" },
      { id: "sonia", text: "Sonia" },
      { id: "tullio", text: "Tullio" },
    ],
    witnesses: [
      { id: "guardiano", source: "Il guardiano notturno", text: "Alle 20:05 ho visto Raoul riaccendere le luci per finire una relazione." },
      { id: "collega", source: "Una collega", text: "Sonia è rimasta fino alle 21 e ha riacceso tutto prima di andare via." },
      { id: "portiere", source: "Il portiere", text: "Le luci le ha lasciate accese Tullio, passato alle 22 a prendere un pacco." },
    ],
    solution: {
      optionId: "raoul",
      witnessId: "guardiano",
      notes: {
        guardiano: "Raoul era l'unico ancora dentro dopo le 20: tutto torna.",
        collega: "Il badge dice che Sonia è uscita alle 19:30, non alle 21.",
        portiere: "Tullio è in ferie e dopo le 21:10 non è passato nessun badge.",
      },
    },
    explain: "Le luci si spengono alle 20: serviva qualcuno ancora dentro dopo quell'ora, e l'unico era Raoul (uscito alle 21:10). Le altre due testimonianze contraddicono i badge.",
  },
  {
    id: "gelato-festa",
    difficulty: "facile",
    caseTitle: "Il gelato della festa",
    question: "Chi ha finito il gelato della festa?",
    facts: ["Il gelato era nel freezer di Bea fino alle 23.", "Dopo le 23 in casa di Bea sono rimasti solo Bea, Ciro e Dora: gli altri erano già andati via."],
    options: [
      { id: "bea", text: "Bea" },
      { id: "ciro", text: "Ciro" },
      { id: "dora", text: "Dora" },
      { id: "ezio", text: "Ezio" },
    ],
    witnesses: [
      { id: "vicina", source: "La vicina di Bea", text: "Alle 23:30, dalla finestra, ho visto Dora mangiare il gelato direttamente dalla vaschetta." },
      { id: "invitato", source: "Un invitato", text: "A mezzanotte Ezio era ancora in cucina con il cucchiaio in mano." },
      { id: "fidanzato", source: "Il fidanzato di Bea", text: "Ciro è andato via con me alle 22:45, quindi lui non c'entra." },
    ],
    solution: {
      optionId: "dora",
      witnessId: "vicina",
      notes: {
        vicina: "Dora era tra chi è rimasto dopo le 23: tutto torna.",
        invitato: "Ezio era già andato via prima delle 23.",
        fidanzato: "Ciro dopo le 23 era ancora in casa: non è andato via alle 22:45.",
      },
    },
    explain: "Dopo le 23 c'erano solo Bea, Ciro e Dora: Ezio a mezzanotte non poteva esserci, e Ciro non era andato via. La vicina è l'unica compatibile: è stata Dora.",
  },
  {
    id: "moto-mercato",
    difficulty: "difficile",
    caseTitle: "La moto urtata in via Verdi",
    question: "Chi ha urtato la moto parcheggiata in via Verdi?",
    facts: ["L'urto è avvenuto lunedì alle 8:15: lo dice l'allarme della moto.", "Via Verdi è chiusa al traffico dalle 7 alle 9 per il mercato: passano solo bici e pedoni."],
    options: [
      { id: "fabio", text: "Fabio, in auto" },
      { id: "gaia", text: "Gaia, in bici" },
      { id: "ivo", text: "Ivo, a piedi col cane" },
      { id: "lea", text: "Lea, in scooter" },
    ],
    witnesses: [
      { id: "fruttivendolo", source: "Il fruttivendolo", text: "Alle 8:15 una bici ha preso la curva larga e ha strisciato la moto: la guidava Gaia." },
      { id: "barista", source: "Il barista", text: "È stato Fabio, facendo manovra con l'auto davanti al bar alle 8:15." },
      { id: "passante", source: "Un passante", text: "È stata Lea con lo scooter: alle 8:15 sfrecciava in mezzo alle bancarelle." },
    ],
    solution: {
      optionId: "gaia",
      witnessId: "fruttivendolo",
      notes: {
        fruttivendolo: "Una bici alle 8:15 in una via aperta solo a bici e pedoni: tutto torna.",
        barista: "Dalle 7 alle 9 in via Verdi le auto non passano.",
        passante: "Uno scooter è un mezzo a motore: in via Verdi non poteva entrare.",
      },
    },
    explain: "Nell'ora del mercato passano solo bici e pedoni: l'auto di Fabio e lo scooter di Lea non c'erano. Il fruttivendolo è l'unico testimone compatibile: è stata Gaia, in bici.",
  },
  {
    id: "patate-notte",
    difficulty: "difficile",
    caseTitle: "Dieci chili di patate",
    question: "Chi ha ordinato dieci chili di patate con l'app di casa?",
    facts: ["L'ordine è partito domenica alle 2 di notte dal tablet del salotto.", "Domenica alle 2 in casa c'erano solo Marco e Nina: Olmo e Pia erano a una festa fino all'alba."],
    options: [
      { id: "marco", text: "Marco" },
      { id: "nina", text: "Nina" },
      { id: "olmo", text: "Olmo" },
      { id: "pia", text: "Pia" },
    ],
    witnesses: [
      { id: "vicino", source: "Il vicino", text: "Alle 2 ho sentito Olmo in salotto che parlava al tablet." },
      { id: "sorella", source: "La sorella di Nina", text: "Alle 2 Nina mi ha scritto: «sono sul divano col tablet e ho una fame da lupi»." },
      { id: "amico", source: "Un amico di Marco", text: "Marco mi ha detto che ha ordinato lui, dal suo telefono, per scherzo." },
    ],
    solution: {
      optionId: "nina",
      witnessId: "sorella",
      notes: {
        vicino: "Alle 2 Olmo era alla festa: non poteva essere in salotto.",
        sorella: "Nina era in casa, col tablet del salotto, alle 2: tutto torna.",
        amico: "L'ordine è partito dal tablet, non da un telefono.",
      },
    },
    explain: "Alle 2 in casa c'erano solo Marco e Nina, e l'ordine è partito dal tablet: Olmo è fuori e il telefono di Marco non c'entra. La sorella di Nina è l'unica testimone compatibile.",
  },
  {
    id: "bici-universita",
    difficulty: "media",
    caseTitle: "La bici rossa dell'università",
    question: "Chi ha preso la bici rossa dalla rastrelliera dell'università?",
    facts: ["La bici è sparita giovedì a mezzogiorno, durante il cambio d'ora.", "Giovedì a mezzogiorno Rita e Sami erano in aula per un esame, senza poter uscire."],
    options: [
      { id: "rita", text: "Rita" },
      { id: "sami", text: "Sami" },
      { id: "teo", text: "Teo" },
      { id: "ugo", text: "Ugo" },
    ],
    witnesses: [
      { id: "custode", source: "Il custode", text: "A mezzogiorno Teo ha sbloccato la bici rossa con una chiave ed è partito." },
      { id: "compagna", source: "Una compagna di corso", text: "A mezzogiorno ho visto Rita andarsene sulla bici rossa." },
      { id: "bibliotecario", source: "Il bibliotecario", text: "Ugo è uscito con una bici rossa alle 11, un'ora prima del cambio." },
    ],
    solution: {
      optionId: "teo",
      witnessId: "custode",
      notes: {
        custode: "Teo a mezzogiorno era libero: tutto torna.",
        compagna: "A mezzogiorno Rita era chiusa in aula per l'esame.",
        bibliotecario: "Alle 11 la bici era ancora lì: è sparita a mezzogiorno.",
      },
    },
    explain: "A mezzogiorno Rita era all'esame, quindi la compagna sbaglia; alle 11 la bici c'era ancora, quindi sbaglia il bibliotecario. Il custode è compatibile: l'ha presa Teo.",
  },
  {
    id: "campanelli-notte",
    difficulty: "difficile",
    caseTitle: "I campanelli alle 3 di notte",
    question: "Chi ha suonato tutti i campanelli del palazzo alle 3 di notte?",
    facts: ["I campanelli si suonano solo dalla pulsantiera in strada.", "Alle 3 Walter dormiva in casa, Aldo era rientrato alle 2 con le sue chiavi e Zoe è in vacanza da una settimana."],
    options: [
      { id: "vale", text: "Vale" },
      { id: "walter", text: "Walter" },
      { id: "zoe", text: "Zoe" },
      { id: "aldo", text: "Aldo" },
    ],
    witnesses: [
      { id: "tassista", source: "Il tassista", text: "Alle 3 ho lasciato Vale davanti al portone: frugava nella borsa e non trovava le chiavi." },
      { id: "vicina", source: "La vicina del primo piano", text: "Era Aldo: alle 3 stava rientrando proprio in quel momento." },
      { id: "cugino", source: "Il cugino di Zoe", text: "Zoe è tornata stanotte alle 3 e ha suonato a tutti per scherzo." },
    ],
    solution: {
      optionId: "vale",
      witnessId: "tassista",
      notes: {
        tassista: "Vale era in strada alle 3, senza chiavi: tutto torna.",
        vicina: "Aldo era rientrato alle 2: alle 3 era già in casa.",
        cugino: "Zoe è in vacanza da una settimana.",
      },
    },
    explain: "Chi ha suonato era in strada alle 3. Walter dormiva, Aldo era dentro dalle 2, Zoe è in vacanza: le testimonianze su Aldo e Zoe cadono. Resta il tassista: è stata Vale, rimasta senza chiavi.",
  },
];

export default varianti;
