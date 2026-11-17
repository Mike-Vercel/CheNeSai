import type { CapitanoInput } from "@/lib/tig/games/mechanics/il-capitano-ci-conosce";

/**
 * 36 · IL CAPITANO CI CONOSCE? — domande leggere sui gusti di chi siede al tavolo. Nessuna risposta giusta:
 * conta se il capitano indovina la scelta più votata dai compagni. Mai temi personali delicati.
 */
const varianti: CapitanoInput[] = [
  {
    id: "dopo-il-pub",
    difficulty: "facile",
    prompt: "Finita la serata qui, la maggior parte di noi vorrebbe…",
    options: [
      { id: "letto", text: "Andare dritta a letto" },
      { id: "panino", text: "Un panino da asporto" },
      { id: "altro-locale", text: "Un altro locale" },
      { id: "chiacchiere", text: "Chiacchiere sotto casa di qualcuno" },
    ],
    explain: "Il capitano vede il tavolo tutte le settimane: se ha sbagliato, forse il panino da asporto è un desiderio più segreto di quanto sembri.",
  },
  {
    id: "superpotere",
    difficulty: "facile",
    prompt: "Un superpotere solo per la vita di tutti i giorni. Scegliamo…",
    options: [
      { id: "parcheggio", text: "Trovare sempre parcheggio" },
      { id: "sveglia", text: "Svegliarsi riposati con 5 ore di sonno" },
      { id: "batteria", text: "Telefono sempre carico" },
      { id: "code", text: "Mai una fila alle poste" },
    ],
    explain: "Il riposo con poche ore di sonno vince spesso tra chi lavora, il parcheggio tra chi guida in città. Il capitano doveva sapere chi è venuto in macchina stasera.",
  },
  {
    id: "vacanza-gruppo",
    difficulty: "media",
    prompt: "Vacanza tutti insieme, una sola settimana. Il tavolo vota…",
    options: [
      { id: "isola", text: "Isola, spiaggia e niente programmi" },
      { id: "capitale", text: "Capitale europea, musei e locali" },
      { id: "baita", text: "Baita in montagna con camino" },
      { id: "on-the-road", text: "Viaggio in auto, una tappa al giorno" },
    ],
    explain: "Le vacanze di gruppo sono il miglior test per un capitano: chi conosce davvero il tavolo sa chi sopporta otto ore di auto e chi no.",
  },
  {
    id: "cena-casa",
    difficulty: "media",
    prompt: "Cena a casa di uno di noi: cosa portate quasi sempre?",
    options: [
      { id: "vino", text: "Una bottiglia di vino" },
      { id: "dolce", text: "Il dolce" },
      { id: "niente", text: "Niente, ma lavo i piatti" },
      { id: "patatine", text: "Patatine e salatini" },
    ],
    explain: "Il vino è la risposta di default, ma i tavoli con più di un goloso cambiano tutto. E chi lava i piatti è sempre più popolare di quanto pensi.",
  },
  {
    id: "domenica",
    difficulty: "facile",
    prompt: "Domenica libera, piove. La maggioranza di noi passerebbe la giornata…",
    options: [
      { id: "divano", text: "Sul divano con una serie" },
      { id: "cucina", text: "A cucinare qualcosa di lungo" },
      { id: "fuori", text: "Fuori lo stesso, con l'ombrello" },
    ],
    explain: "Il divano vince quasi sempre, ma un capitano attento sa se al tavolo c'è chi impasta la pizza a mano appena può.",
  },
  {
    id: "gruppo-chat",
    difficulty: "media",
    prompt: "Nella chat del gruppo, la maggior parte di noi è…",
    options: [
      { id: "silenzioso", text: "Quello che legge e non scrive" },
      { id: "vocali", text: "Quello dei vocali lunghi" },
      { id: "meme", text: "Quello che risponde solo con le immagini" },
      { id: "organizzatore", text: "Quello che organizza tutto" },
    ],
    explain: "Ogni chat ha i suoi ruoli. Il capitano doveva capire se il tavolo si vede come pubblico silenzioso o come regista delle serate.",
  },
  {
    id: "colazione",
    difficulty: "facile",
    prompt: "Colazione ideale di un giorno qualunque:",
    options: [
      { id: "bar", text: "Al bar, cappuccino e brioche" },
      { id: "casa-dolce", text: "A casa, biscotti o fette biscottate" },
      { id: "salato", text: "Salata, uova o toast" },
      { id: "caffe", text: "Solo caffè, di corsa" },
    ],
    explain: "Il bar è un rito, il solo caffè una necessità. Il capitano conosceva le abitudini del mattino del tavolo, o solo quelle della sera?",
  },
  {
    id: "regalo-ultimo",
    difficulty: "difficile",
    prompt: "Regalo per un amico, comprato all'ultimo momento. Di solito prendiamo…",
    options: [
      { id: "libro", text: "Un libro a caso, ma con dedica" },
      { id: "buono", text: "Un buono da spendere" },
      { id: "colletta", text: "Ci aggreghiamo alla colletta" },
      { id: "bottiglia", text: "Una bottiglia buona" },
    ],
    explain: "La colletta è la salvezza di molti, il buono quella dei pratici. Domanda difficile: qui ognuno ha la sua tecnica di sopravvivenza.",
  },
  {
    id: "lavoro-sogno",
    difficulty: "difficile",
    prompt: "Se si potesse cambiare lavoro domani senza rischi, la maggioranza di noi farebbe…",
    options: [
      { id: "locale", text: "Aprire un locale tutto suo" },
      { id: "viaggio", text: "Un lavoro che fa viaggiare" },
      { id: "campagna", text: "Vita in campagna con l'orto" },
      { id: "stesso", text: "Lo stesso lavoro, ma pagato il doppio" },
    ],
    explain: "Il locale tutto proprio è il sogno classico di chi frequenta i pub, ma il lavoro uguale pagato il doppio vince più spesso di quanto si confessi.",
  },
  {
    id: "film-serata",
    difficulty: "media",
    prompt: "Serata film tutti insieme. Vince il genere…",
    options: [
      { id: "commedia", text: "Commedia" },
      { id: "horror", text: "Horror" },
      { id: "azione", text: "Azione" },
      { id: "romantico", text: "Romantico" },
    ],
    explain: "La commedia mette d'accordo quasi tutti, l'horror divide. Il capitano doveva sapere se il tavolo urla davanti a uno schermo o ride e basta.",
  },
];

export default varianti;
