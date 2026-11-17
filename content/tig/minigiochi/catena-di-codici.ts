import type { CatenaInput } from "@/lib/tig/games/mechanics/catena-di-codici";

/**
 * 42 · CATENA DI CODICI — sei indizi autonomi (ognuno lo vede solo chi lo riceve), ognuno porta a UNA cifra
 * con un mini calcolo quotidiano. La posizione la mostra la UI.
 */
const varianti: CatenaInput[] = [
  {
    id: "chiavi-bnb",
    title: "La cassetta delle chiavi del B&B",
    clues: [
      "Il conto è 47 € e paghi con una banconota da 50 €: quanti euro di resto?",
      "Quanti giorni dura un weekend, sabato più domenica?",
      "Il treno parte alle 18:55 e sono le 18:47: quanti minuti mancano?",
      "Il volo atterra alle 21:40 con 35 minuti di ritardo. A che ora doveva atterrare? Usa l'ultima cifra dei minuti.",
      "In 4 dividete 28 € di pizza: quanti euro a testa?",
      "Se il lunedì è il giorno 1 della settimana, che numero ha il venerdì?",
    ],
    solution: {
      code: "328575",
      steps: ["50 − 47 = 3", "Sabato e domenica: 2", "18:55 − 18:47 = 8 minuti", "21:40 − 35 minuti = 21:05 → 5", "28 ÷ 4 = 7", "Lunedì 1 … venerdì 5"],
    },
    explain: "Ogni indizio dava una cifra: 3, 2, 8, 5, 7, 5. Messe in fila aprono la cassetta: 328575.",
  },
  {
    id: "bici-stazione",
    title: "Il lucchetto della bici in stazione",
    clues: [
      "Siete in 3 e dividete alla pari 2 pizze da 8 fette: quante fette intere a testa?",
      "Un biglietto del bus costa 2 €: quanti ne compri al massimo con 13 €?",
      "Quante ruote ha un monopattino classico?",
      "La riunione inizia alle 9:50 e dura 40 minuti. A che ora finisce? Usa l'ultima cifra dei minuti.",
      "Vivi con 4 coinquilini: quanti siete in casa, tu compreso?",
      "Ferie da mercoledì a venerdì, entrambi compresi: quanti giorni?",
    ],
    solution: {
      code: "562053",
      steps: ["16 fette ÷ 3 = 5 intere (ne avanza una)", "13 ÷ 2 = 6 biglietti", "Monopattino: 2 ruote", "9:50 + 40 minuti = 10:30 → 0", "4 + te = 5", "Mercoledì, giovedì, venerdì: 3"],
    },
    explain: "Le sei cifre erano 5, 6, 2, 0, 5, 3: il lucchetto si apriva con 562053.",
  },
  {
    id: "porta-coworking",
    title: "La porta del coworking",
    clues: [
      "Arrivi alle 8:52 e l'ufficio apre alle 9:00: quanti minuti aspetti?",
      "Siete in 9 e il tavolo ha 6 posti: quante sedie dovete aggiungere?",
      "Compri 4 panini da 4 € e paghi con 20 €: quanti euro di resto?",
      "Il turno inizia alle 14:00 e dura 6 ore. A che ora finisce? Usa l'ultima cifra dell'ora.",
      "Una pizza tagliata in 8: tu ne mangi 3, il coinquilino 4. Quante fette restano?",
      "In auto siete in 5 e scendono in 3: quanti restano in macchina?",
    ],
    solution: {
      code: "834012",
      steps: ["9:00 − 8:52 = 8 minuti", "9 − 6 = 3 sedie", "20 − 16 = 4", "14:00 + 6 ore = 20:00 → 0", "8 − 3 − 4 = 1", "5 − 3 = 2"],
    },
    explain: "Cifre in ordine: 8, 3, 4, 0, 1, 2. Il codice della porta era 834012.",
  },
  {
    id: "cassaforte-affitto",
    title: "La cassaforte dell'appartamento in affitto",
    clues: [
      "L'affitto è 600 € diviso in 3: quante centinaia di euro paga ognuno?",
      "Il bus passa ogni 12 minuti e l'ultimo è passato 5 minuti fa: tra quanti minuti arriva il prossimo?",
      "In una partita di calcetto, quanti giocatori ha in campo ogni squadra?",
      "Sono le 23:51: quanti minuti mancano a mezzanotte?",
      "Compri 3 biglietti del cinema da 8 € e paghi con 30 €: quanti euro di resto?",
      "Se la domenica è il giorno 7 della settimana e il lunedì l'1, che numero ha il mercoledì?",
    ],
    solution: {
      code: "275963",
      steps: ["600 ÷ 3 = 200 → 2", "12 − 5 = 7 minuti", "Calcetto: 5 per squadra", "24:00 − 23:51 = 9 minuti", "30 − 24 = 6", "Lunedì 1, martedì 2, mercoledì 3"],
    },
    explain: "Le cifre 2, 7, 5, 9, 6, 3 formano il codice della cassaforte: 275963.",
  },
  {
    id: "portone-festa",
    title: "Il portone della festa a sorpresa",
    clues: [
      "In 6 dividete un regalo da 30 €: quanti euro a testa?",
      "Il film inizia alle 21:20 e dura 1 ora e 50 minuti. A che ora finisce? Usa l'ultima cifra dei minuti.",
      "Hai 3 notifiche, ne arrivano altre 6 e ne leggi 2: quante restano da leggere?",
      "Quanti lati ha il tavolo quadrato del soggiorno?",
      "La spesa fa 18 €: tu metti 10 € e il coinquilino il resto. Quanti euro mette lui?",
      "Ti svegli alle 7:15 ed esci alle 8:00: quanti quarti d'ora sono passati?",
    ],
    solution: {
      code: "507483",
      steps: ["30 ÷ 6 = 5", "21:20 + 1:50 = 23:10 → 0", "3 + 6 − 2 = 7", "Un quadrato ha 4 lati", "18 − 10 = 8", "45 minuti = 3 quarti d'ora"],
    },
    explain: "Cifre: 5, 0, 7, 4, 8, 3. Il portone si apriva con 507483.",
  },
  {
    id: "armadietto-piscina",
    title: "L'armadietto della piscina",
    clues: [
      "Fai 4 vasche da 25 metri: quante centinaia di metri hai nuotato?",
      "L'ingresso costa 6 € e paghi con 10 €: quanti euro di resto?",
      "La lezione inizia alle 19:30 e dura 45 minuti. A che ora finisce? Usa l'ultima cifra dei minuti.",
      "Vai in piscina martedì, giovedì e sabato: quante volte a settimana?",
      "Che numero ha l'armadietto subito prima del 10?",
      "Il borsone pesa 8 kg; togli 2 kg di asciugamani. Quanti kg pesa adesso?",
    ],
    solution: {
      code: "145396",
      steps: ["4 × 25 = 100 metri → 1", "10 − 6 = 4", "19:30 + 45 minuti = 20:15 → 5", "Tre volte a settimana", "Prima del 10 c'è il 9", "8 − 2 = 6"],
    },
    explain: "Le cifre 1, 4, 5, 3, 9, 6 aprono l'armadietto: 145396.",
  },
];

export default varianti;
