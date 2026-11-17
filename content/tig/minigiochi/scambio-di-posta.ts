import type { PostaInput } from "@/lib/tig/games/mechanics/scambio-di-posta";

/**
 * 30 · SCAMBIO DI POSTA — una domanda uguale per tutti, a risposta univoca e veloce da verificare:
 * la posta la decide il duello (giusto batte sbagliato, tra giusti vince il più rapido).
 */
const varianti: PostaInput[] = [
  {
    id: "romana-aperitivo",
    difficulty: "facile",
    prompt: "Aperitivo in 6: tagliere da 24 € e 6 calici da 5 €. Fate alla romana. Quanto paga ciascuno?",
    options: [
      { id: "a", text: "8 €" },
      { id: "b", text: "9 €" },
      { id: "c", text: "10 €" },
      { id: "d", text: "11 €" },
    ],
    solution: { optionId: "b" },
    explain: "24 + 6 × 5 = 54 €; diviso 6 fa 9 € a testa.",
  },
  {
    id: "affitto-ritardo",
    difficulty: "media",
    prompt: "L'affitto si paga il 5 del mese. Il coinquilino dice «pago tra 40 giorni» il 20 marzo. Di quanti giorni è in ritardo rispetto alla scadenza di aprile?",
    options: [
      { id: "a", text: "19" },
      { id: "b", text: "24" },
      { id: "c", text: "25" },
      { id: "d", text: "29" },
    ],
    solution: { optionId: "b" },
    explain: "Dal 20 marzo, 40 giorni dopo è il 29 aprile (11 giorni a marzo, 29 ad aprile). Dal 5 al 29 aprile sono 24 giorni di ritardo.",
  },
  {
    id: "lavatrice-turni",
    difficulty: "facile",
    prompt: "Una lavatrice dura 1 h 40 min e l'asciugatrice 1 h 10 min. Fate due carichi uno dopo l'altro, e ogni carico va lavato e poi asciugato. Al minimo, quanto serve per finire tutto?",
    options: [
      { id: "a", text: "3 h 20 min" },
      { id: "b", text: "4 h 30 min" },
      { id: "c", text: "5 h 40 min" },
      { id: "d", text: "4 h 10 min" },
    ],
    solution: { optionId: "b" },
    explain: "Il secondo carico lava mentre il primo asciuga: 1:40 (primo lavaggio) + 1:40 (secondo lavaggio) + 1:10 (ultima asciugatura) = 4 h 30 min. Senza sovrapporre sarebbero 5 h 40.",
  },
  {
    id: "spesa-offerta",
    difficulty: "facile",
    prompt: "Offerta al supermercato: «3 birre al prezzo di 2». Una birra costa 1,50 €. Quanto spendi per 7 birre?",
    options: [
      { id: "a", text: "7,50 €" },
      { id: "b", text: "9,00 €" },
      { id: "c", text: "10,50 €" },
      { id: "d", text: "7,00 €" },
    ],
    solution: { optionId: "a" },
    explain: "Due terne da 3 si pagano come 4 birre, più la settima a prezzo pieno: 5 birre pagate × 1,50 = 7,50 €.",
  },
  {
    id: "maratona-serie",
    difficulty: "media",
    prompt: "Una serie ha 3 stagioni da 8 episodi da 45 minuti. Ne guardi 4 episodi a sera. Quante sere servono?",
    options: [
      { id: "a", text: "5" },
      { id: "b", text: "6" },
      { id: "c", text: "8" },
      { id: "d", text: "18" },
    ],
    solution: { optionId: "b" },
    explain: "3 × 8 = 24 episodi; a 4 per sera servono 24 ÷ 4 = 6 sere. La durata degli episodi non conta.",
  },
  {
    id: "volo-fuso",
    difficulty: "difficile",
    prompt: "Parti da Roma alle 10:00 ora di Roma. Il volo dura 3 ore. A destinazione l'orologio è un'ora INDIETRO rispetto a Roma. Che ora è lì quando atterri?",
    options: [
      { id: "a", text: "12:00" },
      { id: "b", text: "13:00" },
      { id: "c", text: "14:00" },
      { id: "d", text: "11:00" },
    ],
    solution: { optionId: "a" },
    explain: "Atterri alle 13:00 ora di Roma; lì sono un'ora indietro, quindi segnano le 12:00.",
  },
  {
    id: "torneo-calcetto",
    difficulty: "media",
    prompt: "Torneo di calcetto tra 5 squadre: ognuna gioca una volta contro ciascuna delle altre. Quante partite in tutto?",
    options: [
      { id: "a", text: "10" },
      { id: "b", text: "20" },
      { id: "c", text: "25" },
      { id: "d", text: "15" },
    ],
    solution: { optionId: "a" },
    explain: "Ogni squadra gioca 4 partite: 5 × 4 = 20, ma così ogni partita è contata due volte. Sono 10.",
  },
  {
    id: "batteria-telefono",
    difficulty: "facile",
    prompt: "Il telefono perde il 12% di batteria ogni ora. Alle 20:00 è al 70%. Qual è l'ultima ora piena in cui è ancora sopra il 20%?",
    options: [
      { id: "a", text: "22:00" },
      { id: "b", text: "23:00" },
      { id: "c", text: "0:00" },
      { id: "d", text: "1:00" },
    ],
    solution: { optionId: "c" },
    explain: "70% alle 20, 58% alle 21, 46% alle 22, 34% alle 23, 22% a mezzanotte, 10% all'una: l'ultima ora piena sopra il 20% è la mezzanotte.",
  },
  {
    id: "scale-condominio",
    difficulty: "difficile",
    prompt: "Per salire dal piano terra al 2° piano ci metti 30 secondi. A velocità costante, quanto ci metti dal piano terra al 6° piano?",
    options: [
      { id: "a", text: "60 secondi" },
      { id: "b", text: "75 secondi" },
      { id: "c", text: "90 secondi" },
      { id: "d", text: "120 secondi" },
    ],
    solution: { optionId: "c" },
    explain: "Dal piano terra al 2° sono 2 rampe: 15 secondi a rampa. Al 6° sono 6 rampe: 90 secondi.",
  },
  {
    id: "regalo-collega",
    difficulty: "media",
    prompt: "Regalo per un collega da 90 €. All'inizio dovevate dividerlo in 6, poi due si tirano indietro. Quanto in più paga ognuno dei rimasti?",
    options: [
      { id: "a", text: "5,00 €" },
      { id: "b", text: "7,50 €" },
      { id: "c", text: "15,00 €" },
      { id: "d", text: "22,50 €" },
    ],
    solution: { optionId: "b" },
    explain: "In 6 erano 15 € a testa; in 4 sono 22,50 €. La differenza è 7,50 € in più a testa.",
  },
  {
    id: "orario-cena",
    difficulty: "facile",
    prompt: "La cena è alle 20:30. Ti servono 25 minuti per prepararti e 35 per arrivare. A che ora devi iniziare a prepararti?",
    options: [
      { id: "a", text: "19:20" },
      { id: "b", text: "19:30" },
      { id: "c", text: "19:40" },
      { id: "d", text: "19:35" },
    ],
    solution: { optionId: "b" },
    explain: "25 + 35 = 60 minuti: un'ora prima delle 20:30, cioè alle 19:30.",
  },
  {
    id: "dadi-gioco",
    difficulty: "difficile",
    prompt: "Lanci due dadi normali. Quale somma esce nel maggior numero di combinazioni?",
    options: [
      { id: "a", text: "6" },
      { id: "b", text: "7" },
      { id: "c", text: "8" },
      { id: "d", text: "12" },
    ],
    solution: { optionId: "b" },
    explain: "Il 7 si fa in 6 modi (1+6, 2+5, 3+4 e i loro inversi); il 6 e l'8 solo in 5, il 12 in uno solo.",
  },
];

export default varianti;
