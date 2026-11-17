import type { CacciaInput } from "@/lib/tig/games/mechanics/caccia-alla-capolista";

/**
 * 21 · CACCIA ALLA CAPOLISTA — enigmi brevi (15–40 s) a risposta univoca: nel duello conta anche la velocità.
 * Ogni soluzione è verificata con un conto o un ragionamento esaustivo (scritto in `explain`).
 */
const varianti: CacciaInput[] = [
  {
    id: "giro-di-spritz",
    difficulty: "facile",
    prompt: "Al bancone uno spritz costa 7 € e un analcolico 4 €. Il tavolo ordina 5 drink e spende 29 €. Quanti spritz?",
    options: [
      { id: "a", text: "2" },
      { id: "b", text: "3" },
      { id: "c", text: "4" },
      { id: "d", text: "5" },
    ],
    solution: { optionId: "b" },
    explain: "3 spritz (21 €) più 2 analcolici (8 €) fanno 29 €. Con 2 spritz si arriva a 26 €, con 4 a 32 €.",
  },
  {
    id: "sveglia-snooze",
    difficulty: "facile",
    prompt: "La sveglia suona alle 7:00 e ogni «posticipa» aggiunge 9 minuti. Ti alzi alle 7:36. Quante volte hai premuto «posticipa»?",
    options: [
      { id: "a", text: "3" },
      { id: "b", text: "4" },
      { id: "c", text: "5" },
      { id: "d", text: "6" },
    ],
    solution: { optionId: "b" },
    explain: "Dalle 7:00 alle 7:36 passano 36 minuti: 36 ÷ 9 = 4 posticipi.",
  },
  {
    id: "palestra-abbonamento",
    difficulty: "facile",
    prompt: "La palestra costa 10 € a ingresso oppure 45 € al mese. Da quanti ingressi al mese l'abbonamento conviene davvero?",
    options: [
      { id: "a", text: "Da 4" },
      { id: "b", text: "Da 5" },
      { id: "c", text: "Da 6" },
      { id: "d", text: "Da 9" },
    ],
    solution: { optionId: "b" },
    explain: "4 ingressi costano 40 €, meno dei 45 dell'abbonamento; 5 ingressi costano 50 €: da lì l'abbonamento conviene.",
  },
  {
    id: "chat-non-letti",
    difficulty: "media",
    prompt: "La chat del calcetto ha 120 messaggi non letti. Ne leggi 15 al minuto, ma ne arrivano 5 nuovi al minuto. Dopo quanti minuti sei in pari?",
    options: [
      { id: "a", text: "8" },
      { id: "b", text: "10" },
      { id: "c", text: "12" },
      { id: "d", text: "24" },
    ],
    solution: { optionId: "c" },
    explain: "Ogni minuto il mucchio cala di 15 − 5 = 10 messaggi: 120 ÷ 10 = 12 minuti.",
  },
  {
    id: "coinquilini-turni",
    difficulty: "media",
    prompt: "Tre coinquilini puliscono a turno, un giorno ciascuno: Ada, Bea, Ciro, poi di nuovo Ada. Ada pulisce lunedì. Chi pulisce la domenica della stessa settimana?",
    options: [
      { id: "ada", text: "Ada" },
      { id: "bea", text: "Bea" },
      { id: "ciro", text: "Ciro" },
      { id: "nessuno", text: "Nessuno: salta" },
    ],
    solution: { optionId: "ada" },
    explain: "Lunedì Ada, martedì Bea, mercoledì Ciro, giovedì Ada, venerdì Bea, sabato Ciro, domenica Ada.",
  },
  {
    id: "valigia-kg",
    difficulty: "media",
    prompt: "Bagaglio massimo 10 kg. La valigia vuota pesa 2,5 kg, i vestiti 4,8 kg, le scarpe 1,9 kg. Quanto peso resta per i souvenir?",
    options: [
      { id: "a", text: "0,8 kg" },
      { id: "b", text: "1,2 kg" },
      { id: "c", text: "0,6 kg" },
      { id: "d", text: "1,8 kg" },
    ],
    solution: { optionId: "a" },
    explain: "2,5 + 4,8 + 1,9 = 9,2 kg: restano 10 − 9,2 = 0,8 kg di souvenir.",
  },
  {
    id: "orologio-specchio",
    difficulty: "difficile",
    prompt: "Nello specchio del bagno l'orologio a lancette (senza numeri) sembra segnare le 4:20. Che ore sono davvero?",
    options: [
      { id: "a", text: "7:40" },
      { id: "b", text: "8:40" },
      { id: "c", text: "7:20" },
      { id: "d", text: "4:40" },
    ],
    solution: { optionId: "a" },
    explain: "Lo specchio ribalta il quadrante da destra a sinistra: l'ora vera è 12:00 meno l'ora vista, cioè 12:00 − 4:20 = 7:40.",
  },
  {
    id: "staffetta-pizze",
    difficulty: "difficile",
    prompt: "Un forno cuoce 3 pizze insieme in 6 minuti. Quanti minuti servono, al minimo, per 8 pizze?",
    options: [
      { id: "a", text: "16" },
      { id: "b", text: "18" },
      { id: "c", text: "12" },
      { id: "d", text: "24" },
    ],
    solution: { optionId: "b" },
    explain: "Si cuociono a infornate da 3: 3 + 3 + 2 pizze sono tre infornate da 6 minuti, quindi 18. Non si può fare in 16.",
  },
  {
    id: "compleanno-weekend",
    difficulty: "media",
    prompt: "Oggi è mercoledì. Il compleanno di Luca è tra 100 giorni. Che giorno della settimana sarà?",
    options: [
      { id: "a", text: "Venerdì" },
      { id: "b", text: "Sabato" },
      { id: "c", text: "Giovedì" },
      { id: "d", text: "Domenica" },
    ],
    solution: { optionId: "a" },
    explain: "100 giorni sono 14 settimane (98 giorni) più 2 giorni: da mercoledì, due giorni dopo è venerdì.",
  },
  {
    id: "sconto-su-sconto",
    difficulty: "difficile",
    prompt: "Giacca da 80 €: prima uno sconto del 25%, poi un altro 10% sul prezzo già scontato. Quanto la paghi?",
    options: [
      { id: "a", text: "52 €" },
      { id: "b", text: "54 €" },
      { id: "c", text: "56 €" },
      { id: "d", text: "60 €" },
    ],
    solution: { optionId: "b" },
    explain: "80 − 25% = 60 €; 60 − 10% = 54 €. Non è uno sconto del 35% (che darebbe 52 €).",
  },
  {
    id: "tavolata-sedie",
    difficulty: "facile",
    prompt: "Una tavolata è fatta di 4 tavolini quadrati messi in fila, uno attaccato all'altro. Ogni lato libero ospita una persona. Quante persone ci stanno?",
    options: [
      { id: "a", text: "8" },
      { id: "b", text: "10" },
      { id: "c", text: "12" },
      { id: "d", text: "16" },
    ],
    solution: { optionId: "b" },
    explain: "In fila restano liberi 4 lati sopra, 4 sotto e i 2 alle estremità: 4 + 4 + 2 = 10 persone.",
  },
  {
    id: "bus-notturno",
    difficulty: "media",
    prompt: "Il bus notturno passa ogni 25 minuti, il primo alle 23:10. Esci dal locale alle 1:20. A che ora passa il prossimo bus?",
    options: [
      { id: "a", text: "1:25" },
      { id: "b", text: "1:35" },
      { id: "c", text: "1:40" },
      { id: "d", text: "1:45" },
    ],
    solution: { optionId: "c" },
    explain: "Le corse: 23:10, 23:35, 0:00, 0:25, 0:50, 1:15, 1:40. Quella delle 1:15 è appena partita: la prossima è alle 1:40.",
  },
];

export default varianti;
