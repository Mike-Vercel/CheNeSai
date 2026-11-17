import type { BuiaInput } from "@/lib/tig/games/mechanics/classifica-buia";

/**
 * 77 · CLASSIFICA BUIA — la categoria si vede 15 secondi prima della domanda (dice il terreno, non la risposta);
 * chi rischia ha 25 secondi per una domanda secca a 4 opzioni. Niente `balances`: li inietta il runtime.
 * Soluzioni verificate con calcolo.
 */
const varianti: BuiaInput[] = [
  // --- facili ---
  {
    id: "pizzeria-festeggiato",
    difficulty: "facile",
    category: "Conti della serata",
    prompt: "Il conto in pizzeria è di 84 € e siete in 6, ma il festeggiato non paga. Quanto mette ognuno degli altri?",
    options: [
      { id: "a", text: "14 €" },
      { id: "b", text: "16,80 €" },
      { id: "c", text: "17,50 €" },
      { id: "d", text: "16 €" },
    ],
    solution: { optionId: "b" },
    explain: "Pagano in 5, non in 6: 84 ÷ 5 = 16,80 €. Con 14 € a testa il festeggiato avrebbe pagato anche la sua parte.",
  },
  {
    id: "concerto-tra-dieci-giorni",
    difficulty: "facile",
    category: "Calendario e date",
    prompt: "Oggi è mercoledì e il concerto è tra 10 giorni esatti. Che giorno della settimana sarà?",
    options: [
      { id: "a", text: "Venerdì" },
      { id: "b", text: "Domenica" },
      { id: "c", text: "Sabato" },
      { id: "d", text: "Mercoledì" },
    ],
    solution: { optionId: "c" },
    explain: "Tra 7 giorni è di nuovo mercoledì; altri 3 giorni portano a sabato.",
  },
  {
    id: "volo-all-alba",
    difficulty: "facile",
    category: "Viaggi e orari",
    prompt: "Il volo parte alle 6:50 e in aeroporto bisogna arrivare 2 ore prima. Da casa all'aeroporto servono 40 minuti. A che ora devi uscire di casa, al più tardi?",
    options: [
      { id: "a", text: "4:30" },
      { id: "b", text: "4:50" },
      { id: "c", text: "3:50" },
      { id: "d", text: "4:10" },
    ],
    solution: { optionId: "d" },
    explain: "In aeroporto bisogna essere alle 4:50, due ore prima delle 6:50. Togliendo i 40 minuti di strada si esce alle 4:10.",
  },
  {
    id: "flessioni-settimana",
    difficulty: "facile",
    category: "Palestra e buoni propositi",
    prompt: "Lunedì fai 20 flessioni e ogni giorno ne aggiungi 5 rispetto al giorno prima. In che giorno arrivi a farne 50?",
    options: [
      { id: "a", text: "Domenica" },
      { id: "b", text: "Sabato" },
      { id: "c", text: "Venerdì" },
      { id: "d", text: "Il lunedì dopo" },
    ],
    solution: { optionId: "a" },
    explain: "Servono 30 flessioni in più, cioè 6 aumenti da 5: sei giorni dopo il lunedì è domenica (20, 25, 30, 35, 40, 45, 50).",
  },
  // --- medie ---
  {
    id: "giacca-doppio-sconto",
    difficulty: "media",
    category: "Saldi e percentuali",
    prompt: "Una giacca costa 80 €. È scontata del 25% e alla cassa ti fanno un altro 10% sul prezzo già scontato. Quanto paghi?",
    options: [
      { id: "a", text: "52 €" },
      { id: "b", text: "56 €" },
      { id: "c", text: "54 €" },
      { id: "d", text: "60 €" },
    ],
    solution: { optionId: "c" },
    explain: "Il 25% di 80 € sono 20 €: si scende a 60 €. Il 10% di 60 € sono 6 €: paghi 54 €. Non è uno sconto del 35%, che darebbe 52 €.",
  },
  {
    id: "auguri-di-mezzanotte",
    difficulty: "media",
    category: "Chat di gruppo",
    prompt: "A mezzanotte ognuno dei 10 amici del calcetto manda un messaggio privato di buon anno a ciascuno degli altri. Quanti messaggi partono in tutto?",
    options: [
      { id: "a", text: "45 messaggi" },
      { id: "b", text: "90 messaggi" },
      { id: "c", text: "100 messaggi" },
      { id: "d", text: "20 messaggi" },
    ],
    solution: { optionId: "b" },
    explain: "Ognuno dei 10 scrive ai 9 amici: 10 × 9 = 90 messaggi. 45 sono le coppie di amici, ma ogni coppia si scrive due volte.",
  },
  {
    id: "furgone-in-quattro",
    difficulty: "media",
    category: "Lavori di squadra",
    prompt: "In 3 caricate il furgone del trasloco in 2 ore. Arriva un quarto amico e tutti lavorano allo stesso ritmo. Quanto ci mettete in 4?",
    options: [
      { id: "a", text: "1 ora e 20 minuti" },
      { id: "b", text: "1 ora e 45 minuti" },
      { id: "c", text: "1 ora" },
      { id: "d", text: "1 ora e 30 minuti" },
    ],
    solution: { optionId: "d" },
    explain: "Il lavoro vale 3 persone per 2 ore, cioè 6 ore di lavoro. Diviso tra 4 persone fa un'ora e mezza: 1 ora e 30 minuti.",
  },
  {
    id: "bici-andata-ritorno",
    difficulty: "media",
    category: "Velocità e distanze",
    prompt: "Il lavoro è a 6 km da casa. All'andata, in discesa, pedali a 15 km/h; al ritorno, in salita, a 10 km/h. Quanti minuti pedali in tutto?",
    options: [
      { id: "a", text: "60 minuti" },
      { id: "b", text: "48 minuti" },
      { id: "c", text: "58 minuti" },
      { id: "d", text: "72 minuti" },
    ],
    solution: { optionId: "a" },
    explain: "Andata: 6 km a 15 km/h sono 24 minuti. Ritorno: 6 km a 10 km/h sono 36 minuti. In tutto 60 minuti.",
  },
  // --- difficili ---
  {
    id: "zio-e-nipote",
    difficulty: "difficile",
    category: "Età e anni che passano",
    prompt: "Oggi Marco ha il triplo degli anni di sua nipote Sofia. Tra 12 anni ne avrà il doppio. Quanti anni ha Marco oggi?",
    options: [
      { id: "a", text: "30 anni" },
      { id: "b", text: "36 anni" },
      { id: "c", text: "42 anni" },
      { id: "d", text: "24 anni" },
    ],
    solution: { optionId: "b" },
    explain: "Sofia ha 12 anni e Marco 36, il triplo. Tra 12 anni avranno 24 e 48 anni: proprio il doppio. Con le altre età il conto non torna.",
  },
  {
    id: "bolletta-in-proporzione",
    difficulty: "difficile",
    category: "Bollette di casa",
    prompt: "La bolletta della luce è di 96 € per due mesi. In casa siete in tre, ma Bea è stata via un mese intero. Si paga in proporzione al tempo passato in casa. Quanto tocca a Bea?",
    options: [
      { id: "a", text: "16 €" },
      { id: "b", text: "24 €" },
      { id: "c", text: "32 €" },
      { id: "d", text: "19,20 €" },
    ],
    solution: { optionId: "d" },
    explain: "Mesi passati in casa: 2 + 2 + 1 = 5. Ogni mese a persona costa 96 ÷ 5 = 19,20 €: Bea paga 19,20 €, gli altri due 38,40 € a testa, e il totale fa 96 €.",
  },
  {
    id: "scambio-regali",
    difficulty: "difficile",
    category: "Sorteggi tra amici",
    prompt: "Tre amici mettono i loro nomi in un cappello per lo scambio dei regali e ognuno, a turno, pesca un biglietto senza rimetterlo. Che probabilità c'è che nessuno peschi il proprio nome?",
    options: [
      { id: "a", text: "1 su 2" },
      { id: "b", text: "1 su 3" },
      { id: "c", text: "1 su 6" },
      { id: "d", text: "2 su 3" },
    ],
    solution: { optionId: "b" },
    explain: "I modi di distribuire 3 biglietti sono 6. Solo 2 vanno bene: Ada pesca Bruno, Bruno pesca Carla e Carla pesca Ada, oppure lo stesso giro al contrario. 2 su 6 fa 1 su 3.",
  },
  {
    id: "chi-ha-finito-il-latte",
    difficulty: "difficile",
    category: "Bugie in cucina",
    prompt: "Uno tra Ada, Bruno e Carla ha finito il latte. Ada: «Non sono stata io». Bruno: «È stata Ada». Carla: «Non sono stata io». Uno solo dei tre dice la verità. Chi è stato?",
    options: [
      { id: "a", text: "Ada" },
      { id: "b", text: "Bruno" },
      { id: "c", text: "Carla" },
      { id: "d", text: "Non si può stabilire" },
    ],
    solution: { optionId: "c" },
    explain: "Se fosse stata Ada direbbero il vero Bruno e Carla; se fosse stato Bruno, Ada e Carla. Solo se è stata Carla dice il vero una persona sola: Ada.",
  },
];

export default varianti;
