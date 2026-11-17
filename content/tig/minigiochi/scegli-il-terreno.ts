import type { TerrenoInput } from "@/lib/tig/games/mechanics/scegli-il-terreno";

/**
 * 25 · SCEGLI IL TERRENO — tre categorie per variante, con domande di difficoltà e punti equivalenti
 * (un piccolo ragionamento di vita quotidiana ciascuna). Al primo turno si sceglie tra le prime due,
 * al secondo tra le due rimaste.
 */
const varianti: TerrenoInput[] = [
  {
    id: "cucina-viaggi-chat",
    difficulty: "facile",
    terreni: [
      {
        name: "Cucina",
        prompt: "Un uovo sodo richiede 9 minuti. Quanti minuti servono per 2 uova sode cotte insieme nella stessa pentola?",
        options: [
          { id: "a", text: "4 e mezzo" },
          { id: "b", text: "9" },
          { id: "c", text: "12" },
          { id: "d", text: "18" },
        ],
      },
      {
        name: "Viaggi",
        prompt: "Il volo parte alle 22:50 e dura 2 ore e 25 minuti, senza cambi di fuso. A che ora atterra?",
        options: [
          { id: "a", text: "0:15" },
          { id: "b", text: "1:15" },
          { id: "c", text: "1:25" },
          { id: "d", text: "2:15" },
        ],
      },
      {
        name: "Chat di gruppo",
        prompt: "In un gruppo di 6 persone ognuno manda un meme, e ogni meme lo guardano tutti tranne chi l'ha mandato. Quante visualizzazioni in tutto?",
        options: [
          { id: "a", text: "15" },
          { id: "b", text: "25" },
          { id: "c", text: "30" },
          { id: "d", text: "36" },
        ],
      },
    ],
    solution: { terreni: ["b", "b", "c"] },
    explain: "Cucina: insieme cuociono nello stesso tempo, 9 minuti. Viaggi: 22:50 + 2:25 = 1:15. Chat: ogni meme lo vedono 5 persone, 6 × 5 = 30.",
  },
  {
    id: "palestra-coinquilini-musica",
    difficulty: "facile",
    terreni: [
      {
        name: "Palestra",
        prompt: "Fai 3 serie da 12 piegamenti e poi una da 8. Quanti piegamenti in tutto?",
        options: [
          { id: "a", text: "36" },
          { id: "b", text: "40" },
          { id: "c", text: "44" },
          { id: "d", text: "48" },
        ],
      },
      {
        name: "Coinquilini",
        prompt: "Bolletta da 90 € divisa in tre. Ugo ha già anticipato 20 €. Quanto deve ancora mettere Ugo?",
        options: [
          { id: "a", text: "0 €" },
          { id: "b", text: "10 €" },
          { id: "c", text: "20 €" },
          { id: "d", text: "30 €" },
        ],
      },
      {
        name: "Musica",
        prompt: "Ogni canzone della playlist dura 3 minuti e 30 secondi. Quanto durano 6 canzoni?",
        options: [
          { id: "a", text: "18 minuti" },
          { id: "b", text: "19 minuti e mezzo" },
          { id: "c", text: "21 minuti" },
          { id: "d", text: "24 minuti" },
        ],
      },
    ],
    solution: { terreni: ["c", "b", "c"] },
    explain: "Palestra: 36 + 8 = 44. Coinquilini: la quota è 30 €, ne ha già dati 20, mancano 10. Musica: 6 × 3,5 = 21 minuti.",
  },
  {
    id: "lavoro-soldi-sport",
    difficulty: "media",
    terreni: [
      {
        name: "Lavoro",
        prompt: "Il turno va dalle 9:00 alle 17:30, con un'ora di pausa pranzo. Quante ore lavori?",
        options: [
          { id: "a", text: "6 ore e mezza" },
          { id: "b", text: "7 ore e mezza" },
          { id: "c", text: "8 ore" },
          { id: "d", text: "8 ore e mezza" },
        ],
      },
      {
        name: "Soldi",
        prompt: "Hai 50 €. Spendi un quinto per il cinema e poi metà di quel che resta per la cena. Quanto ti resta?",
        options: [
          { id: "a", text: "15 €" },
          { id: "b", text: "20 €" },
          { id: "c", text: "25 €" },
          { id: "d", text: "30 €" },
        ],
      },
      {
        name: "Sport",
        prompt: "Nel calcio la vittoria vale 3 punti e il pareggio 1. Una squadra ha 7 punti dopo 3 partite, senza sconfitte. Quante vittorie?",
        options: [
          { id: "a", text: "0" },
          { id: "b", text: "1" },
          { id: "c", text: "2" },
          { id: "d", text: "3" },
        ],
      },
    ],
    solution: { terreni: ["b", "b", "c"] },
    explain: "Lavoro: 8 ore e mezza meno un'ora di pausa. Soldi: 10 € al cinema, ne restano 40, metà a cena: 20. Sport: 2 vittorie e un pareggio fanno 7 punti.",
  },
  {
    id: "appuntamenti-cinema-treni",
    difficulty: "media",
    terreni: [
      {
        name: "Appuntamenti",
        prompt: "Appuntamento alle 20:30. Lei arriva 15 minuti prima, lui 10 minuti dopo. Quanto aspetta lei?",
        options: [
          { id: "a", text: "5 minuti" },
          { id: "b", text: "15 minuti" },
          { id: "c", text: "25 minuti" },
          { id: "d", text: "35 minuti" },
        ],
      },
      {
        name: "Cinema",
        prompt: "Lo spettacolo comincia alle 21:10 con 15 minuti di pubblicità, poi il film di 2 ore e 5 minuti. A che ora finisce?",
        options: [
          { id: "a", text: "23:15" },
          { id: "b", text: "23:20" },
          { id: "c", text: "23:30" },
          { id: "d", text: "23:45" },
        ],
      },
      {
        name: "Treni",
        prompt: "Un treno parte ogni 20 minuti a partire dalle 6:10. Qual è il primo che parte dopo le 8:00?",
        options: [
          { id: "a", text: "8:00" },
          { id: "b", text: "8:10" },
          { id: "c", text: "8:20" },
          { id: "d", text: "8:30" },
        ],
      },
    ],
    solution: { terreni: ["c", "c", "b"] },
    explain: "Appuntamenti: lei alle 20:15, lui alle 20:40, sono 25 minuti. Cinema: 21:10 + 15 minuti + 2:05 = 23:30. Treni: 6:10, 6:30, 6:50… 7:50, poi 8:10.",
  },
  {
    id: "logica-numeri-calendario",
    difficulty: "difficile",
    terreni: [
      {
        name: "Logica",
        prompt: "Tutti i giocatori di freccette del locale sono mancini. Paolo non è mancino. Allora…",
        options: [
          { id: "a", text: "Paolo gioca a freccette" },
          { id: "b", text: "Paolo non gioca a freccette" },
          { id: "c", text: "Non si può dire" },
          { id: "d", text: "Paolo gioca solo il venerdì" },
        ],
      },
      {
        name: "Numeri",
        prompt: "Qual è il numero più piccolo, maggiore di 1, che diviso per 2, per 3 e per 4 dà sempre resto 1?",
        options: [
          { id: "a", text: "7" },
          { id: "b", text: "9" },
          { id: "c", text: "13" },
          { id: "d", text: "25" },
        ],
      },
      {
        name: "Calendario",
        prompt: "In un anno non bisestile il 1° marzo è domenica. Che giorno era il 1° febbraio?",
        options: [
          { id: "a", text: "Venerdì" },
          { id: "b", text: "Sabato" },
          { id: "c", text: "Domenica" },
          { id: "d", text: "Lunedì" },
        ],
      },
    ],
    solution: { terreni: ["b", "c", "c"] },
    explain: "Logica: se fosse un giocatore sarebbe mancino, quindi non gioca. Numeri: 12 è divisibile per 2, 3 e 4, quindi 13 dà resto 1 a tutti (7 e 9 no). Calendario: febbraio ha 28 giorni, esattamente 4 settimane: domenica.",
  },
  {
    id: "aperitivo-social-casa",
    difficulty: "media",
    terreni: [
      {
        name: "Aperitivo",
        prompt: "Un tagliere da 18 € basta per 3 persone. Siete in 7: quanti taglieri servono, al minimo, e quanto spendete?",
        options: [
          { id: "a", text: "2 taglieri, 36 €" },
          { id: "b", text: "3 taglieri, 42 €" },
          { id: "c", text: "3 taglieri, 54 €" },
          { id: "d", text: "4 taglieri, 72 €" },
        ],
      },
      {
        name: "Social",
        prompt: "Un post fa 120 like. Il 25% arriva nella prima ora, poi un terzo dei restanti nella seconda. Quanti like nella seconda ora?",
        options: [
          { id: "a", text: "30" },
          { id: "b", text: "40" },
          { id: "c", text: "45" },
          { id: "d", text: "60" },
        ],
      },
      {
        name: "Casa",
        prompt: "La camera misura 4 m per 3 m e il parquet costa 25 € al metro quadro. Quanto spendi?",
        options: [
          { id: "a", text: "175 €" },
          { id: "b", text: "250 €" },
          { id: "c", text: "300 €" },
          { id: "d", text: "350 €" },
        ],
      },
    ],
    solution: { terreni: ["c", "a", "c"] },
    explain: "Aperitivo: 2 taglieri bastano per 6, ne serve un terzo: 3 × 18 = 54 €. Social: 30 like la prima ora, ne restano 90, un terzo è 30. Casa: 12 metri quadri × 25 € = 300 €.",
  },
  {
    id: "animali-spesa-feste",
    difficulty: "facile",
    terreni: [
      {
        name: "Animali",
        prompt: "Quante zampe hanno in tutto 3 cani e 2 galline?",
        options: [
          { id: "a", text: "14" },
          { id: "b", text: "16" },
          { id: "c", text: "18" },
          { id: "d", text: "20" },
        ],
      },
      {
        name: "Spesa",
        prompt: "Il latte costa 1,20 € al litro. Quanto costano 3 litri e mezzo?",
        options: [
          { id: "a", text: "3,60 €" },
          { id: "b", text: "3,90 €" },
          { id: "c", text: "4,20 €" },
          { id: "d", text: "4,80 €" },
        ],
      },
      {
        name: "Feste",
        prompt: "La festa va dalle 21 alle 2. Il DJ suona l'ultima ora e mezza. A che ora attacca?",
        options: [
          { id: "a", text: "23:30" },
          { id: "b", text: "0:00" },
          { id: "c", text: "0:30" },
          { id: "d", text: "1:00" },
        ],
      },
    ],
    solution: { terreni: ["b", "c", "c"] },
    explain: "Animali: 3 × 4 + 2 × 2 = 16. Spesa: 3,5 × 1,20 = 4,20 €. Feste: un'ora e mezza prima delle 2 è mezzanotte e mezza.",
  },
  {
    id: "cifre-farina-orari",
    difficulty: "difficile",
    terreni: [
      {
        name: "Cifre",
        prompt: "Scrivendo tutti i numeri da 1 a 30, quante volte scrivi la cifra 3?",
        options: [
          { id: "a", text: "3" },
          { id: "b", text: "4" },
          { id: "c", text: "5" },
          { id: "d", text: "6" },
        ],
      },
      {
        name: "Pizzeria",
        prompt: "Con 4 kg di farina si fanno 10 pizze. Quanta farina serve per 25 pizze?",
        options: [
          { id: "a", text: "8 kg" },
          { id: "b", text: "10 kg" },
          { id: "c", text: "12 kg" },
          { id: "d", text: "12,5 kg" },
        ],
      },
      {
        name: "Orari",
        prompt: "Il bar apre alle 7 e resta aperto 15 ore. Il lunedì chiude 2 ore prima. A che ora chiude il lunedì?",
        options: [
          { id: "a", text: "19:00" },
          { id: "b", text: "20:00" },
          { id: "c", text: "21:00" },
          { id: "d", text: "22:00" },
        ],
      },
    ],
    solution: { terreni: ["b", "b", "b"] },
    explain: "Cifre: 3, 13, 23 e 30, quattro volte. Pizzeria: 0,4 kg a pizza, 25 × 0,4 = 10 kg. Orari: 7 + 15 = 22, due ore prima sono le 20.",
  },
  {
    id: "auto-ristorante-tecnologia",
    difficulty: "media",
    terreni: [
      {
        name: "In auto",
        prompt: "Devi fare 300 km e l'auto consuma 6 litri ogni 100 km. Quanti litri ti servono?",
        options: [
          { id: "a", text: "12" },
          { id: "b", text: "18" },
          { id: "c", text: "20" },
          { id: "d", text: "24" },
        ],
      },
      {
        name: "Ristorante",
        prompt: "Conto di 64 € in quattro, più una mancia del 10% sul totale. Quanto mette ciascuno?",
        options: [
          { id: "a", text: "16,00 €" },
          { id: "b", text: "17,00 €" },
          { id: "c", text: "17,60 €" },
          { id: "d", text: "18,40 €" },
        ],
      },
      {
        name: "Tecnologia",
        prompt: "Il telefono ha 128 GB di memoria e un quarto è occupato dalle foto. Quanti GB di foto?",
        options: [
          { id: "a", text: "16" },
          { id: "b", text: "32" },
          { id: "c", text: "64" },
          { id: "d", text: "96" },
        ],
      },
    ],
    solution: { terreni: ["b", "c", "b"] },
    explain: "In auto: 3 × 6 = 18 litri. Ristorante: 64 + 6,40 = 70,40 €, diviso 4 fa 17,60 €. Tecnologia: 128 ÷ 4 = 32 GB.",
  },
  {
    id: "sequenze-eta-monete",
    difficulty: "difficile",
    terreni: [
      {
        name: "Sequenze",
        prompt: "Che numero continua la serie 3, 6, 11, 18, 27, …?",
        options: [
          { id: "a", text: "34" },
          { id: "b", text: "36" },
          { id: "c", text: "38" },
          { id: "d", text: "40" },
        ],
      },
      {
        name: "Età",
        prompt: "Oggi Marta ha il triplo degli anni di sua nipote. Tra 10 anni ne avrà il doppio. Quanti anni ha oggi Marta?",
        options: [
          { id: "a", text: "24" },
          { id: "b", text: "30" },
          { id: "c", text: "36" },
          { id: "d", text: "40" },
        ],
      },
      {
        name: "Monete",
        prompt: "In tasca hai solo monete da 2 € e da 50 centesimi: 7 monete per 8 €. Quante da 2 €?",
        options: [
          { id: "a", text: "2" },
          { id: "b", text: "3" },
          { id: "c", text: "4" },
          { id: "d", text: "5" },
        ],
      },
    ],
    solution: { terreni: ["c", "b", "b"] },
    explain: "Sequenze: si aggiunge 3, 5, 7, 9 e poi 11: 38. Età: la nipote ha 10 anni e Marta 30; tra 10 anni 40 e 20. Monete: 3 da 2 € (6 €) e 4 da 50 centesimi (2 €).",
  },
  {
    id: "bar-weekend-partita",
    difficulty: "facile",
    terreni: [
      {
        name: "Al bar",
        prompt: "Tre caffè a 1,20 € e due cornetti a 1,50 €. Quanto paghi?",
        options: [
          { id: "a", text: "6,30 €" },
          { id: "b", text: "6,60 €" },
          { id: "c", text: "6,90 €" },
          { id: "d", text: "7,20 €" },
        ],
      },
      {
        name: "Weekend",
        prompt: "Parti venerdì sera e torni lunedì mattina. Quante notti passi fuori?",
        options: [
          { id: "a", text: "1" },
          { id: "b", text: "2" },
          { id: "c", text: "3" },
          { id: "d", text: "4" },
        ],
      },
      {
        name: "Partita",
        prompt: "Due tempi da 45 minuti e 15 minuti di intervallo, senza recupero. Quanto dura la partita in tutto?",
        options: [
          { id: "a", text: "90 minuti" },
          { id: "b", text: "100 minuti" },
          { id: "c", text: "105 minuti" },
          { id: "d", text: "120 minuti" },
        ],
      },
    ],
    solution: { terreni: ["b", "c", "c"] },
    explain: "Al bar: 3,60 + 3,00 = 6,60 €. Weekend: le notti di venerdì, sabato e domenica, 3. Partita: 45 + 15 + 45 = 105 minuti.",
  },
  {
    id: "spesa-ponte-coda",
    difficulty: "media",
    terreni: [
      {
        name: "Frutta",
        prompt: "Le mele costano 2,40 € al chilo. Ne compri 750 grammi. Quanto spendi?",
        options: [
          { id: "a", text: "1,60 €" },
          { id: "b", text: "1,75 €" },
          { id: "c", text: "1,80 €" },
          { id: "d", text: "2,00 €" },
        ],
      },
      {
        name: "Il ponte",
        prompt: "Quanti giorni ci sono dal 25 aprile al 2 maggio, contando sia il primo sia l'ultimo?",
        options: [
          { id: "a", text: "6" },
          { id: "b", text: "7" },
          { id: "c", text: "8" },
          { id: "d", text: "9" },
        ],
      },
      {
        name: "In coda",
        prompt: "Allo sportello ogni persona ci mette 4 minuti. Davanti a te ce ne sono 6. Tra quanto tocca a te?",
        options: [
          { id: "a", text: "20 minuti" },
          { id: "b", text: "24 minuti" },
          { id: "c", text: "28 minuti" },
          { id: "d", text: "30 minuti" },
        ],
      },
    ],
    solution: { terreni: ["c", "c", "b"] },
    explain: "Frutta: tre quarti di chilo, 0,75 × 2,40 = 1,80 €. Il ponte: dal 25 al 30 aprile sono 6 giorni, più l'1 e il 2 maggio: 8. In coda: 6 × 4 = 24 minuti.",
  },
];

export default varianti;
