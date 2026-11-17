import type { TortoInput } from "@/lib/tig/games/mechanics/il-pub-ha-torto";

/**
 * 45 · IL PUB HA TORTO? — dati fittizi (scontrini, grafici, tabelle) con una domanda verificabile e una trappola
 * per chi legge di corsa. Ogni soluzione si ricava solo dal dato mostrato: la spiegazione rifà il conto.
 */
const varianti: TortoInput[] = [
  {
    id: "scontrino-cena",
    difficulty: "media",
    title: "Lo scontrino della cena",
    data: {
      kind: "scontrino",
      caption: "Trattoria del Borgo · tavolo da 4",
      rows: [
        { label: "Pizze (4)", shown: "32,00 €" },
        { label: "Birre medie (4)", shown: "22,00 €" },
        { label: "Acqua naturale", shown: "3,00 €" },
        { label: "Coperto (4 persone)", shown: "8,00 €" },
      ],
      footnote: "Si divide tutto alla romana, in parti uguali.",
    },
    question: "Quanto paga ognuno dei quattro?",
    options: [
      { id: "a", text: "14,25 €" },
      { id: "b", text: "16,25 €" },
      { id: "c", text: "13,75 €" },
      { id: "d", text: "17,00 €" },
    ],
    solution: { optionId: "b" },
    explain: "32 + 22 + 3 + 8 fa 65 euro, diviso 4 fa 16,25. La trappola è dimenticare il coperto: senza, verrebbe 14,25.",
  },
  {
    id: "sonno-coinquilino",
    difficulty: "facile",
    title: "Il sonno del coinquilino",
    data: {
      kind: "barre",
      caption: "Ore dormite ogni notte, settimana scorsa",
      rows: [
        { label: "Lunedì", shown: "6 ore", bar: 6 },
        { label: "Martedì", shown: "7,5 ore", bar: 7.5 },
        { label: "Mercoledì", shown: "5 ore", bar: 5 },
        { label: "Giovedì", shown: "8 ore", bar: 8 },
        { label: "Venerdì", shown: "4,5 ore", bar: 4.5 },
        { label: "Sabato", shown: "9,5 ore", bar: 9.5 },
        { label: "Domenica", shown: "7 ore", bar: 7 },
      ],
    },
    question: "In quante notti ha dormito almeno 7 ore?",
    options: [
      { id: "a", text: "3" },
      { id: "b", text: "4" },
      { id: "c", text: "5" },
    ],
    solution: { optionId: "b" },
    explain: "Martedì, giovedì, sabato e domenica: quattro notti. La trappola è la domenica con 7 ore esatte: «almeno 7» la comprende.",
  },
  {
    id: "chat-del-gruppo",
    difficulty: "media",
    title: "La chat del gruppo",
    data: {
      kind: "tabella",
      caption: "Messaggi mandati questa settimana",
      rows: [
        { label: "Chi organizza le serate", shown: "48" },
        { label: "Chi manda solo vocali", shown: "12" },
        { label: "Chi risponde con le immagini", shown: "35" },
        { label: "Chi legge e non scrive", shown: "2" },
        { label: "Chi scrive alle tre di notte", shown: "27" },
      ],
    },
    question: "Quanti messaggi in tutto, senza contare quelli di chi organizza?",
    options: [
      { id: "a", text: "74" },
      { id: "b", text: "76" },
      { id: "c", text: "124" },
      { id: "d", text: "78" },
    ],
    solution: { optionId: "b" },
    explain: "12 + 35 + 2 + 27 fa 76. Con chi organizza si arriva a 124: la trappola è leggere la domanda a metà.",
  },
  {
    id: "palestra-gennaio",
    difficulty: "difficile",
    title: "La palestra a gennaio",
    data: {
      kind: "barre",
      caption: "Ingressi in palestra, settimana per settimana",
      rows: [
        { label: "1ª settimana", shown: "120", bar: 120 },
        { label: "2ª settimana", shown: "95", bar: 95 },
        { label: "3ª settimana", shown: "60", bar: 60 },
        { label: "4ª settimana", shown: "45", bar: 45 },
      ],
    },
    question: "Di quanto per cento sono calati gli ingressi dalla prima alla quarta settimana?",
    options: [
      { id: "a", text: "Del 37,5%" },
      { id: "b", text: "Del 62,5%" },
      { id: "c", text: "Del 75%" },
      { id: "d", text: "Del 45%" },
    ],
    solution: { optionId: "b" },
    explain: "Da 120 a 45 mancano 75 ingressi: 75 su 120 è il 62,5%. Il 75 è la differenza, non la percentuale; il 37,5% è quanto resta.",
  },
  {
    id: "pizza-grande-piccola",
    difficulty: "difficile",
    title: "L'offerta della pizzeria",
    data: {
      kind: "tabella",
      caption: "Stessa pizza, due misure",
      rows: [
        { label: "Piccola · diametro 25 cm", shown: "6,00 €" },
        { label: "Grande · diametro 35 cm", shown: "10,00 €" },
      ],
      footnote: "Conta quanta pizza si mangia per ogni euro.",
    },
    question: "Quale conviene di più?",
    options: [
      { id: "a", text: "La piccola" },
      { id: "b", text: "La grande" },
      { id: "c", text: "Sono uguali" },
    ],
    solution: { optionId: "b" },
    explain: "La pizza si mangia in superficie: 35 al quadrato fa 1225, 25 al quadrato 625. La grande è quasi il doppio della piccola e costa solo il 67% in più, quindi conviene.",
  },
  {
    id: "tabellone-treni",
    difficulty: "facile",
    title: "Il tabellone delle partenze",
    data: {
      kind: "tabella",
      caption: "Partenze dal binario 3",
      rows: [
        { label: "Regionale delle 18:05", shown: "ritardo 10 min" },
        { label: "Intercity delle 18:12", shown: "in orario" },
        { label: "Regionale delle 18:20", shown: "ritardo 5 min" },
        { label: "Alta velocità delle 18:30", shown: "ritardo 25 min" },
      ],
    },
    question: "Quale treno parte davvero per primo?",
    options: [
      { id: "a", text: "Il regionale delle 18:05" },
      { id: "b", text: "L'intercity delle 18:12" },
      { id: "c", text: "Il regionale delle 18:20" },
      { id: "d", text: "L'alta velocità delle 18:30" },
    ],
    solution: { optionId: "b" },
    explain: "Il regionale delle 18:05 parte alle 18:15 per il ritardo; l'intercity delle 18:12 è in orario e parte prima di tutti.",
  },
  {
    id: "scontrino-spesa",
    difficulty: "difficile",
    title: "Lo scontrino della spesa",
    data: {
      kind: "scontrino",
      caption: "Supermercato di quartiere",
      rows: [
        { label: "Pasta (3 pacchi)", shown: "3,60 €" },
        { label: "Pomodori", shown: "2,40 €" },
        { label: "Formaggio", shown: "5,00 €" },
        { label: "Sconto 20% sul formaggio", shown: "-1,00 €" },
        { label: "Detersivo", shown: "4,50 €" },
      ],
    },
    question: "Quanto si è speso in tutto?",
    options: [
      { id: "a", text: "14,50 €" },
      { id: "b", text: "15,50 €" },
      { id: "c", text: "13,50 €" },
      { id: "d", text: "16,50 €" },
    ],
    solution: { optionId: "a" },
    explain: "3,60 + 2,40 + 5 + 4,50 fa 15,50, meno lo sconto di 1 euro: 14,50. Chi ha sommato tutto senza togliere lo sconto è finito sui 15,50.",
  },
  {
    id: "cena-aziendale",
    difficulty: "media",
    title: "Il voto per la cena aziendale",
    data: {
      kind: "barre",
      caption: "Voti di venti colleghi",
      rows: [
        { label: "Pizzeria", shown: "6 voti", bar: 6 },
        { label: "Sushi", shown: "5 voti", bar: 5 },
        { label: "Trattoria", shown: "5 voti", bar: 5 },
        { label: "Hamburgeria", shown: "4 voti", bar: 4 },
      ],
    },
    question: "Che percentuale dei voti ha preso la pizzeria?",
    options: [
      { id: "a", text: "Il 30%" },
      { id: "b", text: "Il 60%" },
      { id: "c", text: "Il 25%" },
      { id: "d", text: "Il 6%" },
    ],
    solution: { optionId: "a" },
    explain: "6 voti su 20 sono il 30%. La barra più lunga inganna: ha vinto, ma con meno di un terzo dei voti.",
  },
  {
    id: "bolletta-erasmus",
    difficulty: "difficile",
    title: "La bolletta dei coinquilini",
    data: {
      kind: "tabella",
      caption: "Bolletta della luce di marzo",
      rows: [
        { label: "Consumo", shown: "66,00 €" },
        { label: "Quota fissa", shown: "24,00 €" },
        { label: "Tasse", shown: "9,00 €" },
      ],
      footnote: "Il consumo si divide per i giorni in casa: due coinquilini 31 giorni, il terzo 0 (era in Erasmus). Quota fissa e tasse si dividono in tre.",
    },
    question: "Quanto paga il coinquilino in Erasmus?",
    options: [
      { id: "a", text: "0 €" },
      { id: "b", text: "11 €" },
      { id: "c", text: "22 €" },
      { id: "d", text: "33 €" },
    ],
    solution: { optionId: "b" },
    explain: "Il consumo non lo paga perché non c'era, ma quota fissa e tasse sì: 24 + 9 fa 33, diviso 3 fa 11 euro.",
  },
  {
    id: "temperature",
    difficulty: "facile",
    title: "Il meteo della settimana",
    data: {
      kind: "barre",
      caption: "Temperatura massima, in gradi",
      rows: [
        { label: "Lunedì", shown: "18°", bar: 18 },
        { label: "Martedì", shown: "21°", bar: 21 },
        { label: "Mercoledì", shown: "17°", bar: 17 },
        { label: "Giovedì", shown: "23°", bar: 23 },
        { label: "Venerdì", shown: "19°", bar: 19 },
      ],
    },
    question: "Quanti gradi di differenza tra il giorno più caldo e quello più freddo?",
    options: [
      { id: "a", text: "4" },
      { id: "b", text: "5" },
      { id: "c", text: "6" },
      { id: "d", text: "7" },
    ],
    solution: { optionId: "c" },
    explain: "Il più caldo è giovedì con 23, il più freddo mercoledì con 17: 6 gradi. Chi ha preso lunedì come più freddo ha detto 5.",
  },
];

export default varianti;
