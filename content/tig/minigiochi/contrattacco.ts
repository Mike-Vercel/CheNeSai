import type { ContrattaccoInput } from "@/lib/tig/games/mechanics/contrattacco";

/**
 * 20 · CONTRATTACCO — tre domande per variante: il COLPO (uguale per tutti), la rivincita SICURA (facile, 3 opzioni)
 * e la rivincita PIENA (difficile, 4 opzioni). La difficoltà della variante è quella della rivincita piena.
 */
const varianti: ContrattaccoInput[] = [
  {
    id: "divisibile-ieri",
    difficulty: "media",
    colpo: {
      prompt: "Quale di questi numeri è divisibile per 3?",
      options: [
        { id: "a", text: "124" },
        { id: "b", text: "213" },
        { id: "c", text: "412" },
        { id: "d", text: "241" },
      ],
    },
    sicura: {
      prompt: "Qual è il doppio di 12?",
      options: [
        { id: "a", text: "22" },
        { id: "b", text: "24" },
        { id: "c", text: "26" },
      ],
    },
    piena: {
      prompt: "Se ieri era il giorno dopo lunedì, che giorno sarà dopodomani?",
      options: [
        { id: "a", text: "Giovedì" },
        { id: "b", text: "Venerdì" },
        { id: "c", text: "Sabato" },
        { id: "d", text: "Mercoledì" },
      ],
    },
    solution: { colpo: "b", sicura: "b", piena: "b" },
    explain: "Colpo: 2 + 1 + 3 = 6, divisibile per 3. Sicura: 24. Piena: ieri era martedì, quindi oggi è mercoledì e dopodomani venerdì.",
  },
  {
    id: "bottigliette-enoteca",
    difficulty: "media",
    colpo: {
      prompt: "Un litro d'acqua in bottigliette da 25 cl: quante bottigliette?",
      options: [
        { id: "a", text: "2" },
        { id: "b", text: "4" },
        { id: "c", text: "5" },
        { id: "d", text: "10" },
      ],
    },
    sicura: {
      prompt: "Quante ore ci sono in due giorni?",
      options: [
        { id: "a", text: "24" },
        { id: "b", text: "36" },
        { id: "c", text: "48" },
      ],
    },
    piena: {
      prompt: "L'enoteca vende il vino a 12 € la bottiglia e ne regala una ogni 5 comprate. Con 60 € quante bottiglie porti a casa?",
      options: [
        { id: "a", text: "4" },
        { id: "b", text: "5" },
        { id: "c", text: "6" },
        { id: "d", text: "7" },
      ],
    },
    solution: { colpo: "b", sicura: "c", piena: "c" },
    explain: "Colpo: un litro sono 100 cl, 100 ÷ 25 = 4. Sicura: 2 × 24 = 48. Piena: 60 € comprano 5 bottiglie, più una in omaggio: 6.",
  },
  {
    id: "marzo-consecutivi",
    difficulty: "difficile",
    colpo: {
      prompt: "Che giorno è 45 giorni dopo il 1° marzo?",
      options: [
        { id: "a", text: "10 aprile" },
        { id: "b", text: "14 aprile" },
        { id: "c", text: "15 aprile" },
        { id: "d", text: "16 aprile" },
      ],
    },
    sicura: {
      prompt: "Esci alle 21 e torni alle 2 di notte. Quante ore sei stato fuori?",
      options: [
        { id: "a", text: "3" },
        { id: "b", text: "5" },
        { id: "c", text: "7" },
      ],
    },
    piena: {
      prompt: "Il prodotto di tre numeri interi positivi consecutivi è 210. Qual è il più grande dei tre?",
      options: [
        { id: "a", text: "6" },
        { id: "b", text: "7" },
        { id: "c", text: "8" },
        { id: "d", text: "10" },
      ],
    },
    solution: { colpo: "c", sicura: "b", piena: "b" },
    explain: "Colpo: dal 1° al 31 marzo passano 30 giorni, ne restano 15: 15 aprile. Sicura: dalle 21 alle 2 sono 5 ore. Piena: 5 × 6 × 7 = 210, il più grande è 7.",
  },
  {
    id: "rettangolo-galleria",
    difficulty: "difficile",
    colpo: {
      prompt: "Il taxi costa 3 € alla partenza più 1,20 € al chilometro. Quanto paghi per 5 km?",
      options: [
        { id: "a", text: "6,00 €" },
        { id: "b", text: "8,40 €" },
        { id: "c", text: "9,00 €" },
        { id: "d", text: "9,60 €" },
      ],
    },
    sicura: {
      prompt: "Quale di questi mesi ha 30 giorni?",
      options: [
        { id: "a", text: "Aprile" },
        { id: "b", text: "Gennaio" },
        { id: "c", text: "Luglio" },
      ],
    },
    piena: {
      prompt: "Un treno lungo 200 m entra in una galleria di 400 m a 20 metri al secondo. Quanti secondi passano dall'ingresso della testa all'uscita della coda?",
      options: [
        { id: "a", text: "10" },
        { id: "b", text: "20" },
        { id: "c", text: "25" },
        { id: "d", text: "30" },
      ],
    },
    solution: { colpo: "c", sicura: "a", piena: "d" },
    explain: "Colpo: 3 + 5 × 1,20 = 9 €. Sicura: aprile ha 30 giorni. Piena: la testa deve percorrere la galleria più tutto il treno, 400 + 200 = 600 m: a 20 m/s sono 30 secondi.",
  },
  {
    id: "palindromo-eta",
    difficulty: "media",
    colpo: {
      prompt: "Quale parola si legge uguale anche al contrario?",
      options: [
        { id: "a", text: "Radar" },
        { id: "b", text: "Rotta" },
        { id: "c", text: "Carta" },
        { id: "d", text: "Treno" },
      ],
    },
    sicura: {
      prompt: "Quanti centesimi fanno 3 euro?",
      options: [
        { id: "a", text: "30" },
        { id: "b", text: "300" },
        { id: "c", text: "3000" },
      ],
    },
    piena: {
      prompt: "Anna oggi ha il doppio degli anni che aveva 15 anni fa. Quanti anni ha?",
      options: [
        { id: "a", text: "15" },
        { id: "b", text: "25" },
        { id: "c", text: "30" },
        { id: "d", text: "45" },
      ],
    },
    solution: { colpo: "a", sicura: "b", piena: "c" },
    explain: "Colpo: RADAR al contrario resta RADAR. Sicura: 3 × 100 = 300 centesimi. Piena: 15 anni fa ne aveva 15, oggi 30, che è il doppio.",
  },
  {
    id: "bisestile-cifre",
    difficulty: "difficile",
    colpo: {
      prompt: "Quale di questi anni è bisestile?",
      options: [
        { id: "a", text: "2023" },
        { id: "b", text: "2024" },
        { id: "c", text: "2025" },
        { id: "d", text: "2026" },
      ],
    },
    sicura: {
      prompt: "Quale animale ha otto zampe?",
      options: [
        { id: "a", text: "Il ragno" },
        { id: "b", text: "La formica" },
        { id: "c", text: "Il gatto" },
      ],
    },
    piena: {
      prompt: "Scrivendo tutti i numeri da 1 a 20, quante volte si scrive la cifra 1?",
      options: [
        { id: "a", text: "10" },
        { id: "b", text: "11" },
        { id: "c", text: "12" },
        { id: "d", text: "13" },
      ],
    },
    solution: { colpo: "b", sicura: "a", piena: "c" },
    explain: "Colpo: il 2024 è divisibile per 4. Sicura: il ragno ha otto zampe. Piena: 1, 10, 11 (due volte), poi 12–19 (otto volte): 1 + 1 + 2 + 8 = 12.",
  },
  {
    id: "dado-campane",
    difficulty: "difficile",
    colpo: {
      prompt: "Quante facce ha un dado da gioco normale?",
      options: [
        { id: "a", text: "4" },
        { id: "b", text: "6" },
        { id: "c", text: "8" },
        { id: "d", text: "12" },
      ],
    },
    sicura: {
      prompt: "Un quarto d'ora sono quanti minuti?",
      options: [
        { id: "a", text: "15" },
        { id: "b", text: "25" },
        { id: "c", text: "40" },
      ],
    },
    piena: {
      prompt: "Il campanile batte tanti rintocchi quante sono le ore: uno all'una, due alle due… Dall'una a mezzogiorno compreso, quanti rintocchi in tutto?",
      options: [
        { id: "a", text: "66" },
        { id: "b", text: "72" },
        { id: "c", text: "78" },
        { id: "d", text: "144" },
      ],
    },
    solution: { colpo: "b", sicura: "a", piena: "c" },
    explain: "Colpo: un dado ha 6 facce. Sicura: 60 ÷ 4 = 15 minuti. Piena: 1 + 2 + … + 12 = 78 rintocchi (12 × 13 ÷ 2).",
  },
  {
    id: "caffe-pizza-tagli",
    difficulty: "difficile",
    colpo: {
      prompt: "Se 5 caffè costano 6 €, quanto costano 15 caffè?",
      options: [
        { id: "a", text: "15 €" },
        { id: "b", text: "18 €" },
        { id: "c", text: "20 €" },
        { id: "d", text: "30 €" },
      ],
    },
    sicura: {
      prompt: "Quante dita ci sono in tre mani?",
      options: [
        { id: "a", text: "10" },
        { id: "b", text: "15" },
        { id: "c", text: "20" },
      ],
    },
    piena: {
      prompt: "Una pizza tonda: con 3 tagli dritti da bordo a bordo, qual è il numero MASSIMO di pezzi che puoi ottenere?",
      options: [
        { id: "a", text: "6" },
        { id: "b", text: "7" },
        { id: "c", text: "8" },
        { id: "d", text: "9" },
      ],
    },
    solution: { colpo: "b", sicura: "b", piena: "b" },
    explain: "Colpo: 15 caffè sono il triplo di 5, quindi 3 × 6 = 18 €. Sicura: 3 × 5 = 15 dita. Piena: ogni taglio nuovo incrocia tutti i precedenti: 2, poi 4, poi 7 pezzi (non 6: il terzo taglio non passa dal centro).",
  },
  {
    id: "percentuale-rubinetti",
    difficulty: "media",
    colpo: {
      prompt: "Il 20% di 45 è…",
      options: [
        { id: "a", text: "4,5" },
        { id: "b", text: "9" },
        { id: "c", text: "20" },
        { id: "d", text: "25" },
      ],
    },
    sicura: {
      prompt: "Il triplo di 7 è…",
      options: [
        { id: "a", text: "14" },
        { id: "b", text: "21" },
        { id: "c", text: "24" },
      ],
    },
    piena: {
      prompt: "Due rubinetti riempiono la vasca: il primo da solo in 6 ore, il secondo da solo in 3 ore. Aperti insieme, in quanto tempo?",
      options: [
        { id: "a", text: "1 ora e mezza" },
        { id: "b", text: "2 ore" },
        { id: "c", text: "3 ore" },
        { id: "d", text: "4 ore e mezza" },
      ],
    },
    solution: { colpo: "b", sicura: "b", piena: "b" },
    explain: "Colpo: un decimo di 45 è 4,5, il doppio è 9. Sicura: 21. Piena: in un'ora il primo riempie 1/6 e il secondo 1/3, insieme 1/2 di vasca: 2 ore.",
  },
  {
    id: "alfabeto-saldi",
    difficulty: "media",
    colpo: {
      prompt: "Nell'alfabeto italiano di 21 lettere, quale viene subito prima della M?",
      options: [
        { id: "a", text: "I" },
        { id: "b", text: "K" },
        { id: "c", text: "L" },
        { id: "d", text: "N" },
      ],
    },
    sicura: {
      prompt: "Quante settimane ci sono, circa, in un anno?",
      options: [
        { id: "a", text: "12" },
        { id: "b", text: "52" },
        { id: "c", text: "365" },
      ],
    },
    piena: {
      prompt: "Un prezzo scende del 20% e poi risale del 20%. Rispetto al prezzo iniziale com'è?",
      options: [
        { id: "a", text: "Uguale" },
        { id: "b", text: "Più basso del 4%" },
        { id: "c", text: "Più alto del 4%" },
        { id: "d", text: "Più basso del 2%" },
      ],
    },
    solution: { colpo: "c", sicura: "b", piena: "b" },
    explain: "Colpo: la K non c'è nell'alfabeto italiano, prima della M viene la L. Sicura: circa 52 settimane. Piena: da 100 si scende a 80, e il 20% di 80 è 16: si risale a 96, il 4% in meno.",
  },
  {
    id: "milione-altezze",
    difficulty: "facile",
    colpo: {
      prompt: "Quanti zeri ha un milione scritto in cifre?",
      options: [
        { id: "a", text: "5" },
        { id: "b", text: "6" },
        { id: "c", text: "7" },
        { id: "d", text: "9" },
      ],
    },
    sicura: {
      prompt: "Quale di questi numeri è dispari?",
      options: [
        { id: "a", text: "14" },
        { id: "b", text: "27" },
        { id: "c", text: "30" },
      ],
    },
    piena: {
      prompt: "Marta è più alta di Luca, Luca è più alto di Sara, Sara è più alta di Teo. Chi è il secondo più basso?",
      options: [
        { id: "a", text: "Luca" },
        { id: "b", text: "Sara" },
        { id: "c", text: "Teo" },
        { id: "d", text: "Marta" },
      ],
    },
    solution: { colpo: "b", sicura: "b", piena: "b" },
    explain: "Colpo: 1.000.000 ha 6 zeri. Sicura: 27 è dispari. Piena: dal più alto al più basso Marta, Luca, Sara, Teo: il secondo più basso è Sara.",
  },
  {
    id: "rettangolo-resto",
    difficulty: "facile",
    colpo: {
      prompt: "Quanti angoli retti ha un rettangolo?",
      options: [
        { id: "a", text: "2" },
        { id: "b", text: "3" },
        { id: "c", text: "4" },
        { id: "d", text: "6" },
      ],
    },
    sicura: {
      prompt: "Mezz'ora più tre quarti d'ora fa…",
      options: [
        { id: "a", text: "60 minuti" },
        { id: "b", text: "75 minuti" },
        { id: "c", text: "90 minuti" },
      ],
    },
    piena: {
      prompt: "Un numero diviso per 4 dà 9 con resto 3. Qual è il numero?",
      options: [
        { id: "a", text: "33" },
        { id: "b", text: "36" },
        { id: "c", text: "39" },
        { id: "d", text: "40" },
      ],
    },
    solution: { colpo: "c", sicura: "b", piena: "c" },
    explain: "Colpo: un rettangolo ha 4 angoli retti. Sicura: 30 + 45 = 75 minuti. Piena: 4 × 9 + 3 = 39.",
  },
];

export default varianti;
