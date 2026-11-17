import type { TagliaInput } from "@/lib/tig/games/mechanics/taglia-il-tempo";

/**
 * 18 · TAGLIA IL TEMPO — una prova LAMPO (3 opzioni, si risolve in pochi secondi) che dà le forbici, e una SFIDA
 * uguale per tutti a risposta univoca. La difficoltà della variante è quella della sfida.
 */
const varianti: TagliaInput[] = [
  {
    id: "camicie-pantaloni",
    difficulty: "facile",
    lampo: {
      prompt: "Quanti minuti ci sono in un'ora e mezza?",
      options: [
        { id: "a", text: "90" },
        { id: "b", text: "80" },
        { id: "c", text: "150" },
      ],
    },
    sfida: {
      prompt: "In valigia hai 3 camicie e 2 paia di pantaloni. Quanti abbinamenti diversi camicia + pantaloni puoi fare?",
      options: [
        { id: "a", text: "5" },
        { id: "b", text: "6" },
        { id: "c", text: "8" },
        { id: "d", text: "9" },
      ],
    },
    solution: { lampo: "a", sfida: "b" },
    explain: "Lampo: 60 + 30 = 90 minuti. Sfida: ogni camicia va con 2 pantaloni, quindi 3 × 2 = 6 abbinamenti.",
  },
  {
    id: "consegna-pizze",
    difficulty: "facile",
    lampo: {
      prompt: "Se oggi è venerdì, che giorno è dopodomani?",
      options: [
        { id: "a", text: "Sabato" },
        { id: "b", text: "Domenica" },
        { id: "c", text: "Lunedì" },
      ],
    },
    sfida: {
      prompt: "L'app di consegne aggiunge 2,50 € di spedizione se la spesa è sotto i 20 €. Ordini 2 pizze da 8,50 €. Quanto paghi in tutto?",
      options: [
        { id: "a", text: "17,00 €" },
        { id: "b", text: "19,50 €" },
        { id: "c", text: "20,00 €" },
        { id: "d", text: "22,00 €" },
      ],
    },
    solution: { lampo: "b", sfida: "b" },
    explain: "Lampo: venerdì, sabato, domenica. Sfida: 2 × 8,50 = 17 €, sotto i 20 € quindi si aggiungono 2,50 €: 19,50 €.",
  },
  {
    id: "auguri-in-privato",
    difficulty: "media",
    lampo: {
      prompt: "Quale numero è pari?",
      options: [
        { id: "a", text: "37" },
        { id: "b", text: "52" },
        { id: "c", text: "81" },
      ],
    },
    sfida: {
      prompt: "In una chat di 8 amici ognuno manda un messaggio di auguri in privato a ciascuno degli altri. Quanti messaggi privati in tutto?",
      options: [
        { id: "a", text: "28" },
        { id: "b", text: "56" },
        { id: "c", text: "64" },
        { id: "d", text: "49" },
      ],
    },
    solution: { lampo: "b", sfida: "b" },
    explain: "Lampo: 52 finisce con una cifra pari. Sfida: ognuno degli 8 scrive ai 7 altri, 8 × 7 = 56 messaggi (28 sarebbero le coppie, ma qui i messaggi vanno in entrambe le direzioni).",
  },
  {
    id: "candela-cena",
    difficulty: "facile",
    lampo: {
      prompt: "Quante ruote hanno in tutto 3 biciclette e un'automobile?",
      options: [
        { id: "a", text: "8" },
        { id: "b", text: "10" },
        { id: "c", text: "12" },
      ],
    },
    sfida: {
      prompt: "Una candela alta 15 cm si accorcia di 2 cm ogni 30 minuti. Quanto è alta dopo 2 ore di cena?",
      options: [
        { id: "a", text: "5 cm" },
        { id: "b", text: "7 cm" },
        { id: "c", text: "9 cm" },
        { id: "d", text: "11 cm" },
      ],
    },
    solution: { lampo: "b", sfida: "b" },
    explain: "Lampo: 3 × 2 + 4 = 10 ruote. Sfida: in 2 ore ci sono 4 mezz'ore, 4 × 2 = 8 cm in meno: 15 − 8 = 7 cm.",
  },
  {
    id: "volo-alba",
    difficulty: "media",
    lampo: {
      prompt: "Quale mese viene subito dopo aprile?",
      options: [
        { id: "a", text: "Marzo" },
        { id: "b", text: "Maggio" },
        { id: "c", text: "Giugno" },
      ],
    },
    sfida: {
      prompt: "Il volo parte alle 6:50. Devi essere in aeroporto 1 ora e 30 prima, e da casa ci metti 40 minuti. A che ora devi partire, al più tardi?",
      options: [
        { id: "a", text: "4:30" },
        { id: "b", text: "4:40" },
        { id: "c", text: "4:50" },
        { id: "d", text: "5:10" },
      ],
    },
    solution: { lampo: "b", sfida: "b" },
    explain: "Lampo: dopo aprile viene maggio. Sfida: 6:50 meno 1:30 fa 5:20 in aeroporto; meno 40 minuti di strada: partenza alle 4:40.",
  },
  {
    id: "eta-somma",
    difficulty: "media",
    lampo: {
      prompt: "Metà di 50, più 5, fa…",
      options: [
        { id: "a", text: "25" },
        { id: "b", text: "30" },
        { id: "c", text: "35" },
      ],
    },
    sfida: {
      prompt: "Tre amici hanno 24, 27 e 30 anni. Tra quanti anni la somma delle loro età sarà 99?",
      options: [
        { id: "a", text: "3" },
        { id: "b", text: "6" },
        { id: "c", text: "9" },
        { id: "d", text: "18" },
      ],
    },
    solution: { lampo: "b", sfida: "b" },
    explain: "Lampo: 25 + 5 = 30. Sfida: oggi la somma è 81 e ogni anno cresce di 3 (uno a testa): servono 18 ÷ 3 = 6 anni.",
  },
  {
    id: "bicchieri-mensola",
    difficulty: "facile",
    lampo: {
      prompt: "Quanti secondi ci sono in 2 minuti?",
      options: [
        { id: "a", text: "100" },
        { id: "b", text: "120" },
        { id: "c", text: "200" },
      ],
    },
    sfida: {
      prompt: "Sulla mensola ci sono 12 bicchieri: un terzo da vino, metà dei restanti da birra, gli altri da acqua. Quanti bicchieri da acqua?",
      options: [
        { id: "a", text: "2" },
        { id: "b", text: "3" },
        { id: "c", text: "4" },
        { id: "d", text: "6" },
      ],
    },
    solution: { lampo: "b", sfida: "c" },
    explain: "Lampo: 2 × 60 = 120. Sfida: 4 da vino, ne restano 8; metà (4) da birra, gli altri 4 da acqua.",
  },
  {
    id: "orologio-pigro",
    difficulty: "media",
    lampo: {
      prompt: "Quale di questi è un frutto?",
      options: [
        { id: "a", text: "Carota" },
        { id: "b", text: "Pera" },
        { id: "c", text: "Cipolla" },
      ],
    },
    sfida: {
      prompt: "L'orologio della cucina perde 2 minuti al giorno. Lo regoli lunedì a mezzogiorno. Che ora segna il lunedì dopo, a mezzogiorno esatto?",
      options: [
        { id: "a", text: "11:46" },
        { id: "b", text: "11:48" },
        { id: "c", text: "11:56" },
        { id: "d", text: "12:14" },
      ],
    },
    solution: { lampo: "b", sfida: "a" },
    explain: "Lampo: la pera. Sfida: da lunedì a lunedì sono 7 giorni, 7 × 2 = 14 minuti persi: segna 11:46.",
  },
  {
    id: "bollette-in-tre",
    difficulty: "difficile",
    lampo: {
      prompt: "Quante lettere ha la parola BIRRA?",
      options: [
        { id: "a", text: "4" },
        { id: "b", text: "5" },
        { id: "c", text: "6" },
      ],
    },
    sfida: {
      prompt: "Quattro coinquilini dividono le bollette in parti uguali. Uno se ne va e gli altri tre dividono la stessa cifra. Di quanto aumenta la quota di ciascuno?",
      options: [
        { id: "a", text: "Del 25%" },
        { id: "b", text: "Di un terzo" },
        { id: "c", text: "Della metà" },
        { id: "d", text: "Del 10%" },
      ],
    },
    solution: { lampo: "b", sfida: "b" },
    explain: "Lampo: B-I-R-R-A, 5 lettere. Sfida: la quota passa da 1/4 a 1/3 del totale; 1/3 è 4/3 di 1/4, cioè aumenta di un terzo (circa il 33%), non del 25%.",
  },
  {
    id: "scala-su-e-giu",
    difficulty: "difficile",
    lampo: {
      prompt: "Il doppio di 15 è…",
      options: [
        { id: "a", text: "25" },
        { id: "b", text: "30" },
        { id: "c", text: "45" },
      ],
    },
    sfida: {
      prompt: "Una scala ha 15 gradini. Il gatto sale 3 gradini e ne scende 1, sempre così. Alla fine di quale salita arriva in cima?",
      options: [
        { id: "a", text: "Alla 5ª" },
        { id: "b", text: "Alla 6ª" },
        { id: "c", text: "Alla 7ª" },
        { id: "d", text: "Alla 8ª" },
      ],
    },
    solution: { lampo: "b", sfida: "c" },
    explain: "Lampo: 30. Sfida: dopo ogni salita è al gradino 3, 5, 7, 9, 11, 13, 15: arriva in cima alla 7ª salita, prima di dover riscendere.",
  },
  {
    id: "parcheggio-ruote",
    difficulty: "media",
    lampo: {
      prompt: "Sono le 22:45. Tra 30 minuti saranno le…",
      options: [
        { id: "a", text: "23:05" },
        { id: "b", text: "23:15" },
        { id: "c", text: "23:30" },
      ],
    },
    sfida: {
      prompt: "Nel parcheggio del locale ci sono solo auto e moto: 9 veicoli e 30 ruote. Quante sono le auto?",
      options: [
        { id: "a", text: "3" },
        { id: "b", text: "5" },
        { id: "c", text: "6" },
        { id: "d", text: "7" },
      ],
    },
    solution: { lampo: "b", sfida: "c" },
    explain: "Lampo: 22:45 + 30 minuti = 23:15. Sfida: se fossero tutte moto le ruote sarebbero 18; ogni auto ne aggiunge 2, e ne mancano 12: 6 auto (24 ruote) e 3 moto (6).",
  },
  {
    id: "biglietto-concerto",
    difficulty: "difficile",
    lampo: {
      prompt: "Il contrario di «accendere» è…",
      options: [
        { id: "a", text: "Spegnere" },
        { id: "b", text: "Spingere" },
        { id: "c", text: "Spendere" },
      ],
    },
    sfida: {
      prompt: "Il biglietto del concerto costa 50 € e il prezzo sale del 10% ogni settimana, sempre sul prezzo del momento. Quanto costerà tra due settimane?",
      options: [
        { id: "a", text: "55,00 €" },
        { id: "b", text: "60,00 €" },
        { id: "c", text: "60,50 €" },
        { id: "d", text: "61,00 €" },
      ],
    },
    solution: { lampo: "a", sfida: "c" },
    explain: "Lampo: spegnere. Sfida: dopo una settimana 50 + 5 = 55 €; dopo la seconda 55 + 5,50 = 60,50 €. L'aumento si calcola ogni volta sul prezzo nuovo.",
  },
];

export default varianti;
