import type { ContraddizioneInput } from "@/lib/tig/games/mechanics/la-contraddizione";

/**
 * 54 · LA CONTRADDIZIONE — quattro messaggi dello stesso personaggio inventato. Una sola coppia non può
 * essere vera insieme; le altre cinque coppie sono compatibili (verificate una per una).
 */
const varianti: ContraddizioneInput[] = [
  {
    id: "dario-coinquilino",
    character: "Dario, il coinquilino",
    context: "nel gruppo della casa, sabato",
    messages: [
      { id: "a", time: "10:05", text: "Sono in palestra, resto fino a mezzogiorno: ho la lezione delle 11. Niente spesa per me." },
      { id: "b", time: "11:30", text: "Sono sul divano da stamattina presto e da qui vedo la luce del bagno accesa: chi è stato?" },
      { id: "c", time: "13:10", text: "Ho preso il pane tornando a casa, è sul tavolo." },
      { id: "d", time: "13:40", text: "Stasera esco e rientro tardi: non chiudete con il chiavistello." },
    ],
    solution: { pair: ["a", "b"] },
    explain: "Alle 10:05 Dario era in palestra, ma alle 11:30 giura di essere sul divano «da stamattina presto». Il pane comprato tornando a casa e l'uscita serale sono compatibili con tutto.",
  },
  {
    id: "giada-serie",
    character: "Giada, l'amica del gruppo",
    context: "nel gruppo degli amici, giovedì sera",
    messages: [
      { id: "a", time: "20:10", text: "Stasera non posso, ho la cena con i colleghi del nuovo lavoro." },
      { id: "b", time: "20:12", text: "Comunque quella serie di cui parlate non l'ho mai vista: non spoilerate niente!" },
      { id: "c", time: "22:40", text: "Cena finita: mi hanno fatto sentire subito a casa." },
      { id: "d", time: "23:05", text: "Sono d'accordo con voi: il finale della seconda stagione è stato una delusione totale." },
    ],
    solution: { pair: ["b", "d"] },
    explain: "Alle 20:12 Giada non ha mai visto la serie, alle 23:05 giudica il finale della seconda stagione: in mezzo c'era una cena, non due stagioni intere. La cena e il suo esito tornano.",
  },
  {
    id: "ilario-lasagne",
    character: "Ilario, quello che cucina",
    context: "nel gruppo della casa, domenica",
    messages: [
      { id: "a", time: "18:00", text: "Stasera cucino io per tutti: lasagne!" },
      { id: "b", time: "18:30", text: "Vi ricordo che sono vegetariano da tre anni: le faccio con le verdure." },
      { id: "c", time: "19:45", text: "Vi ho lasciato la teglia in forno, io tra poco esco." },
      { id: "d", time: "21:00", text: "Il segreto è il ragù di mia nonna, con tre tipi di carne: l'ho assaggiato io stesso un'ora fa." },
    ],
    solution: { pair: ["b", "d"] },
    explain: "Vegetariano da tre anni e lasagne di verdure alle 18:30, ma alle 21 si vanta di aver assaggiato un ragù con tre tipi di carne. Assaggiare un'ora prima, alle 20, è compatibile con l'uscita «tra poco» delle 19:45.",
  },
  {
    id: "alessio-calcetto",
    character: "Alessio, il portiere",
    context: "nel gruppo del calcetto, lunedì",
    messages: [
      { id: "a", time: "17:20", text: "Giovedì niente partita per me: sono in trasferta a Torino da mercoledì a venerdì." },
      { id: "b", time: "18:00", text: "Qualcuno mi tiene da parte la maglia nuova? La mia è ancora in lavatrice." },
      { id: "c", time: "19:10", text: "Ho pagato la mia quota del mese al cassiere." },
      { id: "d", time: "21:30", text: "Allora ci vediamo giovedì al campo alle 20:30, porto io il pallone." },
    ],
    solution: { pair: ["a", "d"] },
    explain: "Giovedì Alessio è in trasferta a Torino, ma alle 21:30 promette di portare il pallone al campo proprio giovedì. Maglia e quota non c'entrano.",
  },
  {
    id: "bea-spesa",
    character: "Bea, la coinquilina organizzata",
    context: "nel gruppo della spesa condivisa, sabato",
    messages: [
      { id: "a", time: "10:00", text: "Questa settimana sono senza macchina: è dal meccanico fino a lunedì." },
      { id: "b", time: "10:15", text: "Faccio io la lista per oggi, aggiungete le vostre cose entro mezzogiorno." },
      { id: "c", time: "12:30", text: "Ho appena parcheggiato la mia macchina davanti al supermercato: vi serve altro?" },
      { id: "d", time: "13:20", text: "Speso 46 euro, vi giro lo scontrino." },
    ],
    solution: { pair: ["a", "c"] },
    explain: "La macchina di Bea è dal meccanico fino a lunedì, eppure alle 12:30 l'ha parcheggiata davanti al supermercato. Lista e scontrino sono coerenti con tutto.",
  },
  {
    id: "nico-appuntamento",
    character: "Nico, al primo appuntamento",
    context: "nella chat con il suo migliore amico, venerdì",
    messages: [
      { id: "a", time: "19:00", text: "Stasera primo appuntamento! Cinema alle 21." },
      { id: "b", time: "19:05", text: "Non so cosa mettermi, mi aiuti a scegliere?" },
      { id: "c", time: "22:10", text: "Sono già a casa da mezz'ora: lei è dovuta scappare prima che iniziasse il film." },
      { id: "d", time: "23:30", text: "Il film era lunghissimo, siamo usciti adesso dalla sala." },
    ],
    solution: { pair: ["c", "d"] },
    explain: "Alle 22:10 Nico è a casa perché lei se n'è andata prima del film, alle 23:30 racconta di essere appena uscito dalla sala con lei. Il piano del cinema alle 21 e il dubbio sui vestiti sono compatibili con entrambe.",
  },
];

export default varianti;
