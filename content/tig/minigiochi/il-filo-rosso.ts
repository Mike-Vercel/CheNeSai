import type { FiloInput } from "@/lib/tig/games/mechanics/il-filo-rosso";

/**
 * 76 · IL FILO ROSSO — un caso leggero e tre indizi «raccolti nelle manche precedenti» (riepilogati all'inizio).
 * La soluzione si compone di tre tessere. Per ogni variante i vincoli sono stati modellati e verificati con node:
 * sulle 64 combinazioni ne resta esattamente una, nessuna coppia di indizi basta e nessun indizio da solo
 * fissa una tessera.
 */
const varianti: FiloInput[] = [
  {
    id: "torta-ufficio",
    difficulty: "facile",
    title: "La torta sparita dal frigo dell'ufficio",
    intro: "Venerdì pomeriggio la torta di compleanno di Bea è sparita dal frigo dell'ufficio. Chi l'ha mangiata non si è mosso dalla sua stanza e ha usato l'unica posata che c'era lì. Chi è stato, dove e con cosa?",
    clues: [
      { from: "Manche 1 · Chi parte male...", text: "Dalle 16 alle 17 nessuno si è mosso: Marco e Giulia erano in sala riunioni, Luca in archivio, Sara in terrazzo. In cucinetta non c'era nessuno." },
      { from: "Manche 2 · Fregali tutti!", text: "In ogni stanza c'era una sola posata: la forchetta in sala riunioni, il cucchiaino in archivio, il coltello in terrazzo, il righello in cucinetta." },
      { from: "Manche 4 · Il grande inganno", text: "Chi ha mangiato la torta era da solo nella stanza. Il coltello, invece, è rimasto pulito." },
    ],
    slots: [
      { id: "chi", label: "Chi", options: [{ id: "marco", text: "Marco" }, { id: "giulia", text: "Giulia" }, { id: "luca", text: "Luca" }, { id: "sara", text: "Sara" }] },
      { id: "dove", label: "Dove", options: [{ id: "cucinetta", text: "Cucinetta" }, { id: "sala", text: "Sala riunioni" }, { id: "terrazzo", text: "Terrazzo" }, { id: "archivio", text: "Archivio" }] },
      { id: "cosa", label: "Con cosa", options: [{ id: "forchetta", text: "Forchetta" }, { id: "cucchiaino", text: "Cucchiaino" }, { id: "coltello", text: "Coltello" }, { id: "righello", text: "Righello" }] },
    ],
    solution: { answers: { chi: "luca", dove: "archivio", cosa: "cucchiaino" } },
    explain: "Da soli erano solo Luca in archivio e Sara in terrazzo. In terrazzo c'era il coltello, che è rimasto pulito: resta Luca, in archivio, col cucchiaino.",
  },
  {
    id: "finestra-aperta",
    difficulty: "facile",
    title: "La finestra rimasta aperta",
    intro: "Stamattina il pavimento di casa era bagnato: durante il temporale della notte una finestra è rimasta aperta. Ieri ognuno dei quattro coinquilini ne ha aperta una. Chi è stato, quale finestra e a che ora l'ha aperta?",
    clues: [
      { from: "Manche 1 · Chi parte male...", text: "Ognuno ha aperto la finestra di una stanza diversa: Ada quella del bagno, Bruno quella del salotto, Chiara quella della cucina, Dario quella della sua camera." },
      { from: "Manche 3 · Il pub decide!", text: "Gli orari: la cucina è stata aperta alle 22:00, il salotto alle 23:30, la camera all'1:00, il bagno alle 6:30 di stamattina." },
      { from: "Manche 4 · Il grande inganno", text: "Il temporale è durato da mezzanotte alle 5, e la finestra colpevole era già aperta quando è iniziato. Bruno giura di aver chiuso la sua, e il vicino lo conferma." },
    ],
    slots: [
      { id: "chi", label: "Chi", options: [{ id: "ada", text: "Ada" }, { id: "bruno", text: "Bruno" }, { id: "chiara", text: "Chiara" }, { id: "dario", text: "Dario" }] },
      { id: "dove", label: "Quale finestra", options: [{ id: "cucina", text: "Cucina" }, { id: "bagno", text: "Bagno" }, { id: "salotto", text: "Salotto" }, { id: "camera", text: "Camera" }] },
      { id: "quando", label: "Aperta alle", options: [{ id: "h2200", text: "22:00" }, { id: "h2330", text: "23:30" }, { id: "h0100", text: "1:00" }, { id: "h0630", text: "6:30" }] },
    ],
    solution: { answers: { chi: "chiara", dove: "cucina", quando: "h2200" } },
    explain: "Prima di mezzanotte erano aperte solo la cucina (22:00) e il salotto (23:30). Il salotto è di Bruno, che l'ha chiusa: resta Chiara, in cucina, alle 22:00.",
  },
  {
    id: "regalo-nascosto",
    difficulty: "facile",
    title: "Il regalo nascosto troppo bene",
    intro: "Il regalo per il compleanno di Luca è stato nascosto così bene che ora non lo trova più nessuno. Chi l'ha nascosto è entrato in una stanza chiusa a chiave e l'ha messo nell'unico contenitore che c'era. Chi, dove e dentro cosa?",
    clues: [
      { from: "Manche 1 · Chi parte male...", text: "Bea ha le chiavi del garage e della cantina, Carlo solo della soffitta, Elena solo del ripostiglio, Fabio del garage e della soffitta." },
      { from: "Manche 2 · Fregali tutti!", text: "In ogni stanza c'è un solo contenitore: il cesto in ripostiglio, il borsone in cantina, la scatola da scarpe in garage, la valigia in soffitta." },
      { from: "Manche 4 · Il grande inganno", text: "Chi ha nascosto il regalo ha scelto una stanza in cui nessun altro può entrare. E non l'ha messo né nel cesto né nella valigia." },
    ],
    slots: [
      { id: "chi", label: "Chi", options: [{ id: "bea", text: "Bea" }, { id: "carlo", text: "Carlo" }, { id: "elena", text: "Elena" }, { id: "fabio", text: "Fabio" }] },
      { id: "dove", label: "Dove", options: [{ id: "ripostiglio", text: "Ripostiglio" }, { id: "garage", text: "Garage" }, { id: "soffitta", text: "Soffitta" }, { id: "cantina", text: "Cantina" }] },
      { id: "dentro", label: "Dentro cosa", options: [{ id: "cesto", text: "Il cesto" }, { id: "borsone", text: "Il borsone" }, { id: "scatola", text: "La scatola da scarpe" }, { id: "valigia", text: "La valigia" }] },
    ],
    solution: { answers: { chi: "bea", dove: "cantina", dentro: "borsone" } },
    explain: "Le stanze con un solo mazzo di chiavi sono la cantina (Bea) e il ripostiglio (Elena). Nel ripostiglio c'è il cesto, escluso: resta Bea, in cantina, nel borsone.",
  },
  {
    id: "bici-prestata",
    difficulty: "facile",
    title: "La bici tornata con la gomma a terra",
    intro: "La bici di Marta è sparita per un'ora ed è tornata con una gomma a terra. L'ha presa uno dei coinquilini, senza chiedere. Chi è stato, dov'è andato e in quale ora?",
    clues: [
      { from: "Manche 1 · Chi parte male...", text: "Nel pomeriggio ognuno è uscito una sola volta, per un'ora: Nico dalle 13 alle 14, Olga dalle 14 alle 15, Paolo dalle 15 alle 16, Rita dalle 16 alle 17." },
      { from: "Manche 2 · Fregali tutti!", text: "Nico è andato al mercato, Olga in palestra, Paolo al lago, Rita in stazione." },
      { from: "Manche 3 · Il pub decide!", text: "La gomma si è bucata sullo sterrato, che c'è solo verso il lago e verso la palestra. E Marta ha visto la bici in cortile fino alle 14:30." },
    ],
    slots: [
      { id: "chi", label: "Chi", options: [{ id: "nico", text: "Nico" }, { id: "olga", text: "Olga" }, { id: "paolo", text: "Paolo" }, { id: "rita", text: "Rita" }] },
      { id: "dove", label: "Per andare", options: [{ id: "mercato", text: "Al mercato" }, { id: "palestra", text: "In palestra" }, { id: "lago", text: "Al lago" }, { id: "stazione", text: "In stazione" }] },
      { id: "quando", label: "In quale ora", options: [{ id: "h13", text: "Dalle 13 alle 14" }, { id: "h14", text: "Dalle 14 alle 15" }, { id: "h15", text: "Dalle 15 alle 16" }, { id: "h16", text: "Dalle 16 alle 17" }] },
    ],
    solution: { answers: { chi: "paolo", dove: "lago", quando: "h15" } },
    explain: "Lo sterrato porta solo al lago (Paolo) o in palestra (Olga). Olga è uscita dalle 14 alle 15, ma alle 14:30 la bici era ancora in cortile: resta Paolo, al lago, dalle 15 alle 16.",
  },
  {
    id: "spoiler-chat",
    difficulty: "media",
    title: "Lo spoiler nella chat di gruppo",
    intro: "Ieri sera qualcuno ha scritto il finale della serie del momento in una chat di gruppo, rovinandolo a tutti. Il colpevole è uno di quattro amici. Chi l'ha scritto, in quale chat e a che ora?",
    clues: [
      { from: "Manche 1 · Chi parte male...", text: "Irene e Kevin sono nelle chat del calcetto, di famiglia e del viaggio. Jacopo solo in quelle del calcetto e dell'ufficio. Laura in tutte tranne quella del calcetto." },
      { from: "Manche 2 · Fregali tutti!", text: "Lo spoiler è arrivato dopo le 22 ma prima di mezzanotte. Dopo le 23 la chat di famiglia e quella del calcetto erano già silenziose." },
      { from: "Manche 4 · Il grande inganno", text: "Irene e Laura erano al cinema dalle 22:30 all'una col telefono spento. Kevin dorme dalle 22:30. Jacopo è stato agli allenamenti fino alle 23, senza telefono." },
    ],
    slots: [
      { id: "chi", label: "Chi", options: [{ id: "irene", text: "Irene" }, { id: "jacopo", text: "Jacopo" }, { id: "kevin", text: "Kevin" }, { id: "laura", text: "Laura" }] },
      { id: "chat", label: "In quale chat", options: [{ id: "calcetto", text: "Chat del calcetto" }, { id: "ufficio", text: "Chat dell'ufficio" }, { id: "famiglia", text: "Chat di famiglia" }, { id: "viaggio", text: "Chat del viaggio" }] },
      { id: "quando", label: "A che ora", options: [{ id: "h2110", text: "21:10" }, { id: "h2245", text: "22:45" }, { id: "h2320", text: "23:20" }, { id: "h0005", text: "00:05" }] },
    ],
    solution: { answers: { chi: "jacopo", chat: "ufficio", quando: "h2320" } },
    explain: "Gli orari possibili sono 22:45 e 23:20, quando Irene, Laura e Kevin erano già offline: resta Jacopo, che il telefono l'ha ripreso dopo le 23, quindi alle 23:20. A quell'ora calcetto e famiglia tacevano, e delle sue due chat resta quella dell'ufficio.",
  },
  {
    id: "pianta-affogata",
    difficulty: "media",
    title: "La piantina affogata",
    intro: "Mentre Sara era via per lavoro, la sua piantina è stata innaffiata così tanto da affogare. È successo una volta sola, e chi l'ha fatto era in casa da solo. Chi è stato, che giorno e con cosa?",
    clues: [
      { from: "Manche 1 · Chi parte male...", text: "Mentre Sara era via, ognuno è rimasto in casa da solo in un giorno diverso: Tommaso lunedì, Ugo martedì, Vera mercoledì, Zoe giovedì." },
      { from: "Manche 2 · Fregali tutti!", text: "L'annaffiatoio è rotto da domenica. Martedì le tazze erano tutte in lavastoviglie. Giovedì non c'erano né tazze né bicchieri puliti." },
      { from: "Manche 4 · Il grande inganno", text: "Nel vaso c'era un fondo di caffè: è stata usata una tazza o un bicchiere del caffè. In casa il caffè lo bevono solo Ugo e Zoe." },
    ],
    slots: [
      { id: "chi", label: "Chi", options: [{ id: "tommaso", text: "Tommaso" }, { id: "ugo", text: "Ugo" }, { id: "vera", text: "Vera" }, { id: "zoe", text: "Zoe" }] },
      { id: "giorno", label: "Che giorno", options: [{ id: "lunedi", text: "Lunedì" }, { id: "martedi", text: "Martedì" }, { id: "mercoledi", text: "Mercoledì" }, { id: "giovedi", text: "Giovedì" }] },
      { id: "cosa", label: "Con cosa", options: [{ id: "annaffiatoio", text: "Annaffiatoio" }, { id: "bottiglia", text: "Bottiglia" }, { id: "tazza", text: "Tazza" }, { id: "bicchiere", text: "Bicchiere" }] },
    ],
    solution: { answers: { chi: "ugo", giorno: "martedi", cosa: "bicchiere" } },
    explain: "Il caffè porta a Ugo (martedì) o a Zoe (giovedì), con tazza o bicchiere. Giovedì non c'erano né tazze né bicchieri, martedì niente tazze: resta Ugo, martedì, col bicchiere.",
  },
  {
    id: "calzino-rosso",
    difficulty: "media",
    title: "Il calzino rosso nel bucato bianco",
    intro: "Le magliette bianche di tutta la casa sono diventate rosa: qualcuno ha lavato un calzino rosso insieme al bianco. È successo una volta sola. Chi è stato, in che giorno e con quale programma?",
    clues: [
      { from: "Manche 1 · Chi parte male...", text: "Dai turni del bucato: Alba può lavare lunedì o venerdì, Bruno solo mercoledì, Cesare solo sabato, Dora lunedì o mercoledì." },
      { from: "Manche 3 · Il pub decide!", text: "Il disastro è successo in un giorno in cui, da turni, poteva lavare una sola persona. E il rosa è venuto fortissimo: almeno 40 gradi." },
      { from: "Manche 4 · Il grande inganno", text: "Il sabato la lavatrice va solo coi delicati, per non disturbare il vicino. Alba usa sempre e solo il cotone a 60 gradi." },
    ],
    slots: [
      { id: "chi", label: "Chi", options: [{ id: "alba", text: "Alba" }, { id: "bruno", text: "Bruno" }, { id: "cesare", text: "Cesare" }, { id: "dora", text: "Dora" }] },
      { id: "giorno", label: "Che giorno", options: [{ id: "lunedi", text: "Lunedì" }, { id: "mercoledi", text: "Mercoledì" }, { id: "venerdi", text: "Venerdì" }, { id: "sabato", text: "Sabato" }] },
      { id: "programma", label: "Programma", options: [{ id: "cotone-60", text: "Cotone 60 gradi" }, { id: "delicati-30", text: "Delicati 30 gradi" }, { id: "rapido-40", text: "Rapido 40 gradi" }, { id: "sintetici-40", text: "Sintetici 40 gradi" }] },
    ],
    solution: { answers: { chi: "alba", giorno: "venerdi", programma: "cotone-60" } },
    explain: "Un solo turno possibile c'è solo il venerdì (Alba) e il sabato (Cesare). Il sabato si va coi delicati a 30 gradi, troppo pochi: resta Alba, venerdì, che usa sempre il cotone a 60.",
  },
  {
    id: "playlist-festa",
    difficulty: "media",
    title: "La canzone che ha svuotato la pista",
    intro: "Alla festa di Matteo qualcuno ha preso il telefono attaccato alle casse e ha messo il pezzo che ha svuotato la pista in dieci secondi. Chi è stato, a che ora e che genere ha messo?",
    clues: [
      { from: "Manche 1 · Chi parte male...", text: "Ognuno ha avuto il telefono in mano una sola volta: Elio alle 22:30, Flavia alle 23:15, Gianni a mezzanotte, Ilaria alle 00:40." },
      { from: "Manche 2 · Fregali tutti!", text: "Ogni volta è partito un genere diverso. Le sigle dei cartoni sono arrivate per prime, le canzoni di Natale per ultime e il metal subito dopo il liscio." },
      { from: "Manche 4 · Il grande inganno", text: "La pista si è svuotata dopo le 23. Gianni e Ilaria hanno solo alzato il volume: non conoscono il codice per cambiare canzone." },
    ],
    slots: [
      { id: "chi", label: "Chi", options: [{ id: "elio", text: "Elio" }, { id: "flavia", text: "Flavia" }, { id: "gianni", text: "Gianni" }, { id: "ilaria", text: "Ilaria" }] },
      { id: "quando", label: "A che ora", options: [{ id: "h2230", text: "22:30" }, { id: "h2315", text: "23:15" }, { id: "h0000", text: "Mezzanotte" }, { id: "h0040", text: "00:40" }] },
      { id: "genere", label: "Che genere", options: [{ id: "sigle", text: "Sigle dei cartoni" }, { id: "liscio", text: "Liscio" }, { id: "metal", text: "Metal" }, { id: "natale", text: "Canzoni di Natale" }] },
    ],
    solution: { answers: { chi: "flavia", quando: "h2315", genere: "liscio" } },
    explain: "Potevano cambiare canzone solo Elio (22:30) e Flavia (23:15), e la pista si è svuotata dopo le 23: Flavia. L'ordine dei generi è sigle, liscio, metal, Natale, quindi alle 23:15 è partito il liscio.",
  },
  {
    id: "caffe-finito",
    difficulty: "difficile",
    title: "La confezione del caffè nascosta",
    intro: "Da lunedì a giovedì ognuno dei quattro coinquilini ha fatto colazione a casa da solo, in un giorno diverso, e ogni giorno è stato aperto un solo nascondiglio, sempre diverso. In uno è finita la confezione del caffè, finita di nascosto. Chi, che giorno, dove?",
    clues: [
      { from: "Manche 1 · Chi parte male...", text: "Anna ha fatto colazione per prima. Bea il giorno dopo Carlo. Dino martedì era fuori per lavoro." },
      { from: "Manche 2 · Fregali tutti!", text: "Il frigo è stato aperto il giorno prima del forno. Lunedì e giovedì la credenza era chiusa a chiave." },
      { from: "Manche 4 · Il grande inganno", text: "Chi ha finito il caffè ha fatto colazione il giorno subito prima di Dino. E la confezione non era in frigo." },
    ],
    slots: [
      { id: "chi", label: "Chi", options: [{ id: "anna", text: "Anna" }, { id: "bea", text: "Bea" }, { id: "carlo", text: "Carlo" }, { id: "dino", text: "Dino" }] },
      { id: "giorno", label: "Che giorno", options: [{ id: "lunedi", text: "Lunedì" }, { id: "martedi", text: "Martedì" }, { id: "mercoledi", text: "Mercoledì" }, { id: "giovedi", text: "Giovedì" }] },
      { id: "dove", label: "Nascosta in", options: [{ id: "credenza", text: "Credenza" }, { id: "frigo", text: "Frigo" }, { id: "forno", text: "Forno" }, { id: "cassetto", text: "Cassetto" }] },
    ],
    solution: { answers: { chi: "bea", giorno: "mercoledi", dove: "credenza" } },
    explain: "Anna lunedì; Dino non martedì, quindi Carlo martedì, Bea mercoledì e Dino giovedì: il giorno prima di Dino c'era Bea. Per i nascondigli restano due calendari: frigo lunedì, forno martedì, credenza mercoledì; oppure credenza martedì, frigo mercoledì, forno giovedì. Mercoledì non può essere il frigo: credenza.",
  },
  {
    id: "sorpresa-giada",
    difficulty: "difficile",
    title: "La festa a sorpresa saltata",
    intro: "La festa a sorpresa per Giada è saltata: qualcuno le ha fatto capire tutto. Ieri ognuno dei quattro amici era in un posto diverso e ha contattato Giada in un modo diverso dagli altri. Chi si è tradito, da dove e come?",
    clues: [
      { from: "Manche 1 · Chi parte male...", text: "Luca era in palestra o in ufficio. Ieri Marta e Oscar non hanno preso il treno. Nadia al bar non ci mette piede." },
      { from: "Manche 2 · Fregali tutti!", text: "Chi era in treno le ha mandato un vocale, chi era in palestra le ha parlato di persona. Marta non scrive mai: chiama." },
      { from: "Manche 4 · Il grande inganno", text: "Chi si è tradito era seduto, al bar o in treno. E non le ha né telefonato né mandato un vocale." },
    ],
    slots: [
      { id: "chi", label: "Chi", options: [{ id: "luca", text: "Luca" }, { id: "marta", text: "Marta" }, { id: "nadia", text: "Nadia" }, { id: "oscar", text: "Oscar" }] },
      { id: "dove", label: "Da dove", options: [{ id: "palestra", text: "In palestra" }, { id: "ufficio", text: "In ufficio" }, { id: "bar", text: "Al bar" }, { id: "treno", text: "In treno" }] },
      { id: "come", label: "Come", options: [{ id: "vocale", text: "Con un vocale" }, { id: "telefonata", text: "Con una telefonata" }, { id: "foto", text: "Con una foto" }, { id: "di-persona", text: "Di persona" }] },
    ],
    solution: { answers: { chi: "oscar", dove: "bar", come: "foto" } },
    explain: "In treno può esserci solo Nadia, che ha mandato un vocale. Se Marta fosse in palestra dovrebbe parlarle di persona, ma lei chiama: quindi in palestra c'è Luca o Oscar. Al bar c'è Marta (telefonata) o Oscar: escluse le telefonate, resta Oscar al bar, con l'unico modo rimasto, la foto.",
  },
  {
    id: "rumore-palazzo",
    difficulty: "difficile",
    title: "Il rumore delle due di notte",
    intro: "Alle due di notte nel palazzo è partito un rumore infernale. Dal primo al quarto piano abita una persona per piano, e ognuno ha in casa uno solo dei quattro arnesi sospetti. Chi è stato, da che piano e con cosa?",
    clues: [
      { from: "Manche 1 · Chi parte male...", text: "Rosa abita sopra Pietro ma sotto Teresa. Sergio non ha nessuno sopra di sé." },
      { from: "Manche 2 · Fregali tutti!", text: "Il tapis roulant è al piano subito sopra il trapano. La lavatrice è di Pietro. Sergio il karaoke non ce l'ha." },
      { from: "Manche 3 · Il pub decide!", text: "Il rumore veniva dal secondo o dal terzo piano. E chi l'ha fatto non stava cantando." },
    ],
    slots: [
      { id: "chi", label: "Chi", options: [{ id: "pietro", text: "Pietro" }, { id: "rosa", text: "Rosa" }, { id: "sergio", text: "Sergio" }, { id: "teresa", text: "Teresa" }] },
      { id: "piano", label: "Da che piano", options: [{ id: "primo", text: "Primo piano" }, { id: "secondo", text: "Secondo piano" }, { id: "terzo", text: "Terzo piano" }, { id: "quarto", text: "Quarto piano" }] },
      { id: "cosa", label: "Con cosa", options: [{ id: "lavatrice", text: "La lavatrice" }, { id: "trapano", text: "Il trapano" }, { id: "karaoke", text: "Il karaoke" }, { id: "tapis", text: "Il tapis roulant" }] },
    ],
    solution: { answers: { chi: "teresa", piano: "terzo", cosa: "trapano" } },
    explain: "Dall'ordine: Pietro primo, Rosa secondo, Teresa terzo, Sergio quarto. Lavatrice a Pietro; trapano e tapis roulant sono consecutivi e Sergio non ha il karaoke, quindi trapano al terzo e tapis al quarto, karaoke a Rosa. Secondo o terzo, senza cantare: Teresa col trapano.",
  },
  {
    id: "sveglia-alle-5",
    difficulty: "difficile",
    title: "La sveglia delle 5 di domenica",
    intro: "Domenica alle 5 la cassa del salotto è partita a tutto volume. La sveglia l'ha programmata sabato alle 23 uno dei quattro coinquilini, dal telefono e con la sua suoneria preferita. Chi è stato, da quale stanza e con che suoneria?",
    clues: [
      { from: "Manche 2 · Fregali tutti!", text: "Sabato alle 23 ognuno era in una stanza diversa. Aldo e Bianca non erano né in cucina né in salotto. Delia non era in cucina." },
      { from: "Manche 3 · Il pub decide!", text: "Ognuno ha una suoneria preferita diversa. Il gallo è di chi alle 23 era in studio, la sirena è di Ciro. Bianca il gallo non lo sopporta." },
      { from: "Manche 4 · Il grande inganno", text: "Il wifi arriva solo in cucina e in studio, quindi la sveglia è stata programmata da lì. E non era la sirena." },
    ],
    slots: [
      { id: "chi", label: "Chi", options: [{ id: "aldo", text: "Aldo" }, { id: "bianca", text: "Bianca" }, { id: "ciro", text: "Ciro" }, { id: "delia", text: "Delia" }] },
      { id: "stanza", label: "Da quale stanza", options: [{ id: "cucina", text: "Cucina" }, { id: "salotto", text: "Salotto" }, { id: "studio", text: "Studio" }, { id: "camera", text: "Camera" }] },
      { id: "suoneria", label: "Che suoneria", options: [{ id: "gallo", text: "Il gallo" }, { id: "sirena", text: "La sirena" }, { id: "campane", text: "Le campane" }, { id: "tromba", text: "La tromba" }] },
    ],
    solution: { answers: { chi: "aldo", stanza: "studio", suoneria: "gallo" } },
    explain: "Delia non in cucina e Aldo e Bianca fuori da cucina e salotto: Ciro in cucina, Delia in salotto. La cucina vuol dire Ciro e la sirena, esclusa: resta lo studio, col gallo. Bianca il gallo non lo sopporta, quindi in studio c'era Aldo.",
  },
];

export default varianti;
