import type { CompraInput } from "@/lib/tig/games/mechanics/compra-un-indizio";

/**
 * 53 · COMPRA UN INDIZIO — casi inventati. Con gli indizi pubblici restano DUE sospettati (comprare conviene)
 * oppure UNO solo ma serve ragionare bene (comprare è uno spreco per chi è sicuro). Il dettaglio in vendita
 * chiude sempre il caso. Le eliminazioni sono verificate dallo schema.
 */
const varianti: CompraInput[] = [
  {
    id: "telecomando-partita",
    difficulty: "media",
    caseTitle: "Il telecomando sparito",
    question: "Chi ha nascosto il telecomando?",
    suspects: [
      { id: "lia", text: "Lia · guarda le serie solo sul portatile" },
      { id: "max", text: "Max · stasera giocava la sua squadra del cuore" },
      { id: "ada", text: "Ada · odia il calcio, aspettava il suo quiz in TV" },
      { id: "teo", text: "Teo · fuori a cena dalle 19 a mezzanotte" },
    ],
    clues: [
      { text: "Il telecomando è sparito alle 21, quando è cominciata la partita.", clears: ["teo"] },
      { text: "Chi l'ha nascosto voleva impedire agli altri di vedere la partita.", clears: ["max"] },
    ],
    extra: { text: "Sotto il cuscino, accanto al telecomando, c'era il foglietto con gli orari del quiz.", clears: ["lia"] },
    solution: { optionId: "ada" },
    explain: "Alle 21 Teo era fuori e Max la partita voleva vederla. Restano Lia e Ada: il foglietto del quiz nascosto insieme al telecomando porta ad Ada, che voleva il suo programma al posto del calcio.",
  },
  {
    id: "borsa-scambiata",
    difficulty: "media",
    caseTitle: "La borsa coi biglietti del concerto",
    question: "Chi ha preso per sbaglio la borsa di Bea, con i biglietti dentro?",
    suspects: [
      { id: "carlo", text: "Carlo · gira solo con lo zaino" },
      { id: "dora", text: "Dora · borsa nera identica a quella di Bea" },
      { id: "enzo", text: "Enzo · arrivato stamattina da Torino" },
      { id: "fede", text: "Fede · borsa nera identica, è andata via per prima dalla festa" },
    ],
    clues: [
      { text: "Lo scambio è avvenuto ieri sera, alla festa in casa.", clears: ["enzo"] },
      { text: "Chi l'ha presa si è confuso: aveva una borsa nera identica.", clears: ["carlo"] },
    ],
    extra: { text: "La borsa di Bea era ancora sull'attaccapanni quando la festa stava finendo.", clears: ["fede"] },
    solution: { optionId: "dora" },
    explain: "Enzo ieri sera non c'era e Carlo ha solo lo zaino. Restano Dora e Fede, entrambe con la borsa identica: ma a fine festa la borsa di Bea era ancora lì, e Fede era già andata via. È stata Dora.",
  },
  {
    id: "ombrello-giallo",
    difficulty: "difficile",
    caseTitle: "L'ombrello giallo dell'ingresso",
    question: "Chi ha preso l'ombrello giallo dall'ingresso?",
    suspects: [
      { id: "nina", text: "Nina · uscita alle 8, quando non pioveva ancora" },
      { id: "omar", text: "Omar · uscito alle 9:30, sotto il diluvio" },
      { id: "pia", text: "Pia · uscita alle 10 col suo ombrello nero" },
      { id: "rino", text: "Rino · oggi non è uscito di casa" },
    ],
    clues: [
      { text: "Alle 9 l'ombrello giallo era ancora al suo posto.", clears: ["nina"] },
      { text: "Chi l'ha preso è uscito sotto la pioggia, senza un altro ombrello.", clears: ["pia", "rino"] },
    ],
    extra: { text: "La vicina ha visto un ombrello giallo uscire dal portone alle 9:30 in punto.", clears: ["nina", "pia", "rino"] },
    solution: { optionId: "omar" },
    explain: "Bastava incrociare: alle 9 l'ombrello c'era, quindi non Nina (uscita alle 8). Pia aveva il suo ombrello nero e Rino non è uscito. Resta Omar, uscito alle 9:30 sotto il diluvio. Il dettaglio comprato lo confermava soltanto.",
  },
  {
    id: "auto-garage",
    difficulty: "facile",
    caseTitle: "L'auto davanti al garage",
    question: "Chi ha parcheggiato davanti al garage stanotte?",
    suspects: [
      { id: "gaia", text: "Gaia · auto rossa" },
      { id: "ivo", text: "Ivo · auto bianca, rientrato a mezzanotte e mezza" },
      { id: "lara", text: "Lara · auto bianca, rientrata alle 23" },
      { id: "mino", text: "Mino · gira solo in moto" },
    ],
    clues: [
      { text: "Davanti al garage è parcheggiata un'auto bianca.", clears: ["gaia", "mino"] },
      { text: "Chi l'ha parcheggiata è rientrato dopo le 22.", clears: [] },
    ],
    extra: { text: "Il vicino giura: a mezzanotte davanti al garage non c'era nessuna auto.", clears: ["lara"] },
    solution: { optionId: "ivo" },
    explain: "Auto bianca: restano Ivo e Lara. Senza il dettaglio era testa o croce. A mezzanotte il posto era libero: Lara era rientrata alle 23, quindi è stato Ivo, arrivato a mezzanotte e mezza.",
  },
  {
    id: "luce-bagno",
    difficulty: "media",
    caseTitle: "La luce del bagno accesa tutta la notte",
    question: "Chi ha lasciato accesa la luce del bagno?",
    suspects: [
      { id: "quirino", text: "Quirino · a letto alle 21, non si è mai svegliato" },
      { id: "rosa", text: "Rosa · si è alzata alle 3 per bere un bicchiere d'acqua" },
      { id: "sandro", text: "Sandro · ha dormito dalla sorella" },
      { id: "ubaldo", text: "Ubaldo · ha il bagno privato in camera" },
    ],
    clues: [
      { text: "La luce si è accesa dopo le 2 di notte, in casa.", clears: ["quirino", "sandro"] },
      { text: "Chi l'ha accesa ha usato il bagno comune.", clears: ["ubaldo"] },
    ],
    extra: { text: "Sul lavandino del bagno comune c'è il bicchiere che Rosa usa ogni notte.", clears: ["quirino", "sandro", "ubaldo"] },
    solution: { optionId: "rosa" },
    explain: "Dopo le 2 Quirino dormiva e Sandro non era in casa; Ubaldo ha il suo bagno. Resta Rosa, alzata alle 3 per bere. Bastavano gli indizi gratuiti: il bicchiere sul lavandino era solo la conferma.",
  },
  {
    id: "vino-cantina",
    difficulty: "difficile",
    caseTitle: "La bottiglia buona della cantina",
    question: "Chi ha aperto la bottiglia di vino buono?",
    suspects: [
      { id: "aldo", text: "Aldo · astemio da sempre" },
      { id: "bice", text: "Bice · non ha le chiavi della cantina" },
      { id: "ciro", text: "Ciro · ha le chiavi, rientrato alle 22" },
      { id: "dea", text: "Dea · ha le chiavi, a casa tutta la sera" },
      { id: "elio", text: "Elio · ha le chiavi, uscito alle 20 e non ancora rientrato" },
    ],
    clues: [
      { text: "La bottiglia era in cantina, chiusa a chiave.", clears: ["bice"] },
      { text: "È stata aperta alle 21, e chi l'ha aperta ne ha bevuto un bicchiere.", clears: ["aldo", "ciro", "elio"] },
    ],
    extra: { text: "Il bicchiere usato è quello con la D incisa, il preferito di Dea.", clears: ["aldo", "bice", "ciro", "elio"] },
    solution: { optionId: "dea" },
    explain: "Servivano le chiavi (fuori Bice). Alle 21 Ciro non era ancora rientrato ed Elio era fuori; Aldo non beve. Resta Dea, a casa con le chiavi. Gli indizi gratuiti bastavano; il bicchiere con la D lo confermava.",
  },
  {
    id: "pacco-interno",
    difficulty: "facile",
    caseTitle: "Il pacco di Sara",
    question: "Chi ha ritirato il pacco di Sara dal corriere?",
    suspects: [
      { id: "fabio", text: "Fabio · interno 1, piano terra, in casa tutto il giorno" },
      { id: "gemma", text: "Gemma · interno 2, primo piano, in casa tutto il giorno" },
      { id: "hassan", text: "Hassan · interno 3, al lavoro fino alle 18" },
      { id: "irene", text: "Irene · interno 4, in vacanza" },
    ],
    clues: [
      { text: "Il corriere è passato alle 11.", clears: ["hassan", "irene"] },
      { text: "Chi l'ha ritirato ha firmato con una sigla illeggibile.", clears: [] },
    ],
    extra: { text: "Il corriere non è salito ai piani: ha consegnato al piano terra.", clears: ["gemma"] },
    solution: { optionId: "fabio" },
    explain: "Alle 11 Hassan era al lavoro e Irene in vacanza: restano Fabio e Gemma, entrambi in casa. Con il dettaglio (consegna al piano terra) resta solo Fabio, dell'interno 1.",
  },
  {
    id: "pizza-fredda",
    difficulty: "media",
    caseTitle: "L'ultima fetta di pizza",
    question: "Chi ha mangiato l'ultima fetta di pizza avanzata?",
    suspects: [
      { id: "jole", text: "Jole · vegetariana, mangia sempre anche i bordi" },
      { id: "kiko", text: "Kiko · celiaco, niente glutine" },
      { id: "lele", text: "Lele · con la febbre, non esce dalla camera da ieri" },
      { id: "mia", text: "Mia · adora la pizza fredda a colazione" },
    ],
    clues: [
      { text: "L'ultima fetta era una margherita normale, avanzata in cucina.", clears: ["kiko"] },
      { text: "È sparita stamattina prima delle 8, dalla cucina.", clears: ["lele"] },
    ],
    extra: { text: "Nel cartone sono rimasti i bordi, lasciati da chi l'ha mangiata.", clears: ["jole"] },
    solution: { optionId: "mia" },
    explain: "Margherita col glutine: fuori Kiko. Lele non è uscito dalla camera. Restano Jole e Mia; i bordi lasciati nel cartone escludono Jole, che li mangia sempre. È stata Mia.",
  },
  {
    id: "regalo-pois",
    difficulty: "difficile",
    caseTitle: "Il regalo senza biglietto",
    question: "Chi ha portato il regalo senza biglietto alla festa?",
    suspects: [
      { id: "nando", text: "Nando · dice di essere arrivato a mani vuote" },
      { id: "ofelia", text: "Ofelia · ha portato un mazzo di fiori" },
      { id: "paride", text: "Paride · ha portato un regalo col biglietto firmato" },
      { id: "rina", text: "Rina · arrivata dopo l'apertura dei regali" },
      { id: "stefi", text: "Stefi · ha portato un pacco enorme, carta a righe" },
    ],
    clues: [
      { text: "Il regalo misterioso è un pacchetto piccolo, con la carta a pois.", clears: ["ofelia", "stefi"] },
      { text: "Era già sul tavolo quando si sono aperti i regali.", clears: ["rina"] },
      { text: "Sul pacchetto non c'era nessuna firma.", clears: ["paride"] },
    ],
    extra: { text: "La commessa del negozio ricorda la carta a pois: l'ha incartata per un ragazzo timido che si chiamava Nando.", clears: ["ofelia", "paride", "rina", "stefi"] },
    solution: { optionId: "nando" },
    explain: "Il pacchetto piccolo a pois esclude i fiori di Ofelia e il pacco a righe di Stefi; Rina è arrivata dopo; Paride aveva firmato. Resta Nando, che diceva di essere arrivato a mani vuote: i fatti battono le parole.",
  },
  {
    id: "biglietto-scuse",
    difficulty: "media",
    caseTitle: "Il biglietto di scuse sul parabrezza",
    question: "Chi ha graffiato l'auto e lasciato il biglietto di scuse?",
    suspects: [
      { id: "tino", text: "Tino · va in giro solo in moto" },
      { id: "ugo", text: "Ugo · auto blu, scrive tutto in stampatello" },
      { id: "vale", text: "Vale · auto verde, scrive in corsivo" },
      { id: "zeno", text: "Zeno · auto blu, scrive in corsivo" },
    ],
    clues: [
      { text: "Sulla portiera graffiata è rimasta vernice blu.", clears: ["tino", "vale"] },
      { text: "Il biglietto dice solo: «Scusa, pago io».", clears: [] },
    ],
    extra: { text: "Il biglietto è scritto in un corsivo elegante.", clears: ["ugo"] },
    solution: { optionId: "zeno" },
    explain: "La vernice blu lascia Ugo e Zeno. Il biglietto in corsivo esclude Ugo, che scrive solo in stampatello: è stato Zeno.",
  },
];

export default varianti;
