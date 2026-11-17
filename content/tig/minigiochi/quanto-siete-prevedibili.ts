import type { PrevedibiliInput } from "@/lib/tig/games/mechanics/quanto-siete-prevedibili";

/**
 * 37 · QUANTO SIETE PREVEDIBILI — proposte surreali ma innocue. Nessuna risposta giusta: si indovina la quota
 * di tavoli che dirà sì. Le spiegazioni dicono perché il locale tende a votare in un modo, senza giudizi.
 */
const varianti: PrevedibiliInput[] = [
  {
    id: "riunioni-un-piede",
    difficulty: "facile",
    proposal: "Nuova regola per tutti: tutte le riunioni di lavoro si fanno in piedi su un piede solo. Così durano al massimo dieci minuti.",
    yesLabel: "Sì, subito",
    noLabel: "No, grazie",
    explain: "Le proposte che puniscono le riunioni lunghe raccolgono quasi sempre una maggioranza di sì: il nemico comune unisce il locale più di qualsiasi altra cosa.",
  },
  {
    id: "lunedi-abolito",
    difficulty: "facile",
    proposal: "Il lunedì viene abolito. In cambio la domenica dura trentasei ore, ma senza negozi aperti e senza consegne a domicilio.",
    yesLabel: "Accetto",
    noLabel: "Rifiuto",
    explain: "Tutti odiano il lunedì, ma la domenica senza consegne spaventa più del previsto. Di solito il locale si spacca più di quanto i tavoli si aspettino.",
  },
  {
    id: "piccione-sindaco",
    difficulty: "media",
    proposal: "Per un anno il quartiere viene amministrato da un piccione molto serio, assistito da tre impiegati. Decide lui dove mettere le panchine.",
    yesLabel: "Diamogli fiducia",
    noLabel: "Meglio di no",
    explain: "Le proposte assurde fanno ridere, ma al momento di votare molti tavoli tornano prudenti. Chi ha previsto tanti sì ha sopravvalutato la voglia di caos del locale.",
  },
  {
    id: "musica-ascensore",
    difficulty: "media",
    proposal: "In ogni ascensore d'Italia parte obbligatoriamente un coro che canta il nome del piano. Anche alle sei di mattina.",
    yesLabel: "Sì, che allegria",
    noLabel: "No, pietà",
    explain: "Il coro delle sei di mattina pesa più del divertimento: di solito vince il no, ma con una minoranza rumorosa di entusiasti.",
  },
  {
    id: "pigiama-ufficio",
    difficulty: "facile",
    proposal: "Il venerdì diventa ufficialmente la giornata del pigiama: in ufficio, in banca e in tribunale si va vestiti per dormire.",
    yesLabel: "Pigiama per tutti",
    noLabel: "Teniamo i vestiti",
    explain: "Il comfort vince quasi sempre quando la proposta tocca il lavoro. Chi ha previsto pochi sì ha pensato ai colleghi più che a sé stesso.",
  },
  {
    id: "gatto-ministro",
    difficulty: "difficile",
    proposal: "Ogni condominio nomina un gatto come amministratore onorario. Non decide nulla, ma ogni riunione inizia salutandolo.",
    yesLabel: "Viva il gatto",
    noLabel: "Niente gatti",
    explain: "Proposta innocua e simpatica: molti tavoli votano sì senza pensarci. Il difficile è capire quanti, perché chi non ama i gatti di solito vota compatto.",
  },
  {
    id: "scontrino-poesia",
    difficulty: "media",
    proposal: "Da domani ogni scontrino deve essere scritto in rima. Anche quello del benzinaio, anche quello del dentista.",
    yesLabel: "In rima, sì",
    noLabel: "In prosa, grazie",
    explain: "La rima piace come idea, meno quando pensi alla fila dal benzinaio. Le percentuali di questa proposta di solito finiscono vicine alla metà.",
  },
  {
    id: "vacanze-obbligatorie",
    difficulty: "difficile",
    proposal: "Una settimana di vacanza obbligatoria a sorpresa: una mattina ti arriva il biglietto e parti, con destinazione scelta a caso.",
    yesLabel: "Parto",
    noLabel: "Resto a casa",
    explain: "Sembra un sì facile, ma la parola obbligatoria e la destinazione a caso frenano molti. Proposta che divide i tavoli tra avventurosi e organizzati.",
  },
  {
    id: "parcheggio-ballo",
    difficulty: "media",
    proposal: "Per liberare un parcheggio a pagamento bisogna fare un piccolo balletto davanti alla telecamera del parchimetro.",
    yesLabel: "Ballo volentieri",
    noLabel: "Pago e basta",
    explain: "L'imbarazzo in pubblico pesa: di solito vince il no. Ma in un pub, a quest'ora, i tavoli coraggiosi sono sempre di più del previsto.",
  },
  {
    id: "orologi-rallentati",
    difficulty: "difficile",
    proposal: "Tutti gli orologi del Paese vanno più lenti del 10 per cento nel weekend. Il lunedì si recupera andando più veloci.",
    yesLabel: "Firmo",
    noLabel: "Non firmo",
    explain: "Il weekend più lungo è irresistibile, il lunedì più veloce un po' meno. Prevedere questa percentuale è difficile perché i tavoli ci pensano molto.",
  },
];

export default varianti;
