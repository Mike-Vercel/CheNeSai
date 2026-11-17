import type { FurtoInput } from "@/lib/tig/games/mechanics/furto-con-destrezza";

/**
 * 22 · FURTO CON DESTREZZA — colpi in due indizi concatenati: il secondo si risolve SOLO col risultato del primo.
 * Furti inventati e innocui (fette di pizza, telecomandi, posti auto). Ogni passaggio è verificato in `explain`.
 */
const varianti: FurtoInput[] = [
  {
    id: "telecomando-sparito",
    difficulty: "facile",
    caper: "Il telecomando sparito",
    scene: "Il telecomando del salotto è nascosto in un cassetto del mobile e poi sotto un cuscino del divano. Va recuperato prima della partita.",
    steps: [
      {
        clue: "I cassetti sono numerati da 1 a 4. Quello giusto ha un numero pari e non è il più alto. Quale cassetto?",
        options: [
          { id: "c1", text: "Cassetto 1" },
          { id: "c2", text: "Cassetto 2" },
          { id: "c3", text: "Cassetto 3" },
          { id: "c4", text: "Cassetto 4" },
        ],
      },
      {
        clue: "Nel cassetto c'è un biglietto: «Il telecomando è sotto il cuscino numero (cassetto × 3) − 1». Quale cuscino?",
        options: [
          { id: "k4", text: "Cuscino 4" },
          { id: "k5", text: "Cuscino 5" },
          { id: "k6", text: "Cuscino 6" },
          { id: "k7", text: "Cuscino 7" },
        ],
      },
    ],
    solution: { first: "c2", second: "k5" },
    explain: "I pari sono 2 e 4, ma il 4 è il più alto: cassetto 2. Poi 2 × 3 − 1 = 5: cuscino 5.",
  },
  {
    id: "password-wifi",
    difficulty: "media",
    caper: "La password del wifi",
    scene: "Il barista non dà la password del wifi a nessuno. Ma l'ha scritta su un foglietto in codice, dietro la cassa.",
    steps: [
      {
        clue: "«La password inizia con l'anno di apertura del bar.» Il bar ha festeggiato i suoi 12 anni nel 2026. In che anno ha aperto?",
        options: [
          { id: "y12", text: "2012" },
          { id: "y14", text: "2014" },
          { id: "y16", text: "2016" },
          { id: "y38", text: "2038" },
        ],
      },
      {
        clue: "«Poi il nome del gatto: si chiama come il mese che ha per numero la somma delle cifre dell'anno di apertura.» Come si chiama il gatto?",
        options: [
          { id: "aprile", text: "Aprile" },
          { id: "luglio", text: "Luglio" },
          { id: "settembre", text: "Settembre" },
          { id: "marzo", text: "Marzo" },
        ],
      },
    ],
    solution: { first: "y14", second: "luglio" },
    explain: "2026 − 12 = 2014. Le cifre 2 + 0 + 1 + 4 fanno 7, e il settimo mese è luglio: password «2014Luglio».",
  },
  {
    id: "ultima-fetta",
    difficulty: "facile",
    caper: "L'ultima fetta",
    scene: "La pizza familiare era tagliata in 10 fette. Quattro amici ne hanno già mangiate un po'. Quante ne restano da rubare?",
    steps: [
      {
        clue: "Carlo ne ha mangiata una. Bruno una in più di Carlo. Anna il doppio di Bruno. Quante fette ha mangiato Anna?",
        options: [
          { id: "a2", text: "2" },
          { id: "a3", text: "3" },
          { id: "a4", text: "4" },
          { id: "a6", text: "6" },
        ],
      },
      {
        clue: "Daria ne ha mangiate quante Anna meno tre. Quante fette restano nel cartone?",
        options: [
          { id: "r0", text: "Nessuna" },
          { id: "r1", text: "1" },
          { id: "r2", text: "2" },
          { id: "r3", text: "3" },
        ],
      },
    ],
    solution: { first: "a4", second: "r2" },
    explain: "Carlo 1, Bruno 2, Anna 4. Daria 4 − 3 = 1. In tutto 1 + 2 + 4 + 1 = 8 fette: dalle 10 ne restano 2.",
  },
  {
    id: "posto-auto",
    difficulty: "facile",
    caper: "Il posto auto",
    scene: "Sabato sera, cinque posti in fila numerati da 1 a 5 davanti al locale. Uno è appena stato liberato: va preso prima degli altri.",
    steps: [
      {
        clue: "L'auto bianca è nel posto 2. L'auto rossa è subito alla sua destra (numeri crescenti). In che posto è la rossa?",
        options: [
          { id: "p1", text: "Posto 1" },
          { id: "p3", text: "Posto 3" },
          { id: "p4", text: "Posto 4" },
          { id: "p5", text: "Posto 5" },
        ],
      },
      {
        clue: "Il posto libero ha il numero della rossa più quello della bianca, meno uno. Quale posto è libero?",
        options: [
          { id: "l1", text: "Posto 1" },
          { id: "l3", text: "Posto 3" },
          { id: "l4", text: "Posto 4" },
          { id: "l5", text: "Posto 5" },
        ],
      },
    ],
    solution: { first: "p3", second: "l4" },
    explain: "Subito a destra del 2 c'è il 3: la rossa è nel posto 3. Poi 3 + 2 − 1 = 4: il posto libero è il 4.",
  },
  {
    id: "cassaforte-bar",
    difficulty: "media",
    caper: "La cassa delle mance",
    scene: "La cassetta delle mance ha un lucchetto a due cifre. Il barista ha lasciato due promemoria sul frigo.",
    steps: [
      {
        clue: "«La prima cifra è il numero di lati di un esagono.» Qual è la prima cifra?",
        options: [
          { id: "d5", text: "5" },
          { id: "d6", text: "6" },
          { id: "d7", text: "7" },
          { id: "d8", text: "8" },
        ],
      },
      {
        clue: "«La seconda cifra è la prima meno due.» Qual è il codice completo?",
        options: [
          { id: "k64", text: "64" },
          { id: "k46", text: "46" },
          { id: "k62", text: "62" },
          { id: "k68", text: "68" },
        ],
      },
    ],
    solution: { first: "d6", second: "k64" },
    explain: "L'esagono ha 6 lati: prima cifra 6. La seconda è 6 − 2 = 4, e va dopo la prima: codice 64.",
  },
  {
    id: "turno-del-barista",
    difficulty: "media",
    caper: "Il turno sbagliato",
    scene: "Il colpo va fatto quando il barista più attento è a casa. Il suo calendario dei turni è appeso in cucina.",
    steps: [
      {
        clue: "Lavora un giorno sì e due no, e ha lavorato il 3 del mese. Qual è il suo terzo turno del mese, contando il 3?",
        options: [
          { id: "g7", text: "Il 7" },
          { id: "g9", text: "Il 9" },
          { id: "g11", text: "L'11" },
          { id: "g12", text: "Il 12" },
        ],
      },
      {
        clue: "Il colpo si fa il giorno dopo il suo terzo turno se quel giorno è pari, altrimenti due giorni dopo. Che giorno?",
        options: [
          { id: "f10", text: "Il 10" },
          { id: "f11", text: "L'11" },
          { id: "f12", text: "Il 12" },
          { id: "f13", text: "Il 13" },
        ],
      },
    ],
    solution: { first: "g9", second: "f10" },
    explain: "Un giorno sì e due no: 3, 6, 9. Il terzo turno è il 9. Il giorno dopo è il 10, che è pari: il colpo è il 10.",
  },
  {
    id: "lucchetto-bici",
    difficulty: "difficile",
    caper: "Il lucchetto della bici",
    scene: "La bici del coinquilino ha un lucchetto a tre rotelle. Lui giura che la combinazione «è facilissima».",
    steps: [
      {
        clue: "Tre cifre diverse, nessuna è zero, in ordine crescente, e la loro somma è 6. Qual è la combinazione?",
        options: [
          { id: "c123", text: "1-2-3" },
          { id: "c114", text: "1-1-4" },
          { id: "c024", text: "0-2-4" },
          { id: "c132", text: "1-3-2" },
        ],
      },
      {
        clue: "Per aprire, la rotella centrale va girata in avanti di tante tacche quant'è la cifra più alta. Su che numero si ferma la rotella centrale?",
        options: [
          { id: "n3", text: "3" },
          { id: "n4", text: "4" },
          { id: "n5", text: "5" },
          { id: "n6", text: "6" },
        ],
      },
    ],
    solution: { first: "c123", second: "n5" },
    explain: "Senza zero e senza ripetizioni, le sole tre cifre che fanno 6 sono 1, 2 e 3: in ordine 1-2-3. La centrale è 2, la più alta 3: 2 + 3 = 5.",
  },
  {
    id: "buoni-pasto",
    difficulty: "difficile",
    caper: "La busta dei buoni pasto",
    scene: "Nella busta del collega ci sono buoni da 5 € e da 8 €: 7 buoni in tutto, per 44 €. Il colpo: sfilarne uno per tipo.",
    steps: [
      {
        clue: "Quanti sono i buoni da 8 €?",
        options: [
          { id: "b2", text: "2" },
          { id: "b3", text: "3" },
          { id: "b4", text: "4" },
          { id: "b5", text: "5" },
        ],
      },
      {
        clue: "Sfilate un buono da 5 € e uno da 8 €. Quanto resta nella busta?",
        options: [
          { id: "e28", text: "28 €" },
          { id: "e31", text: "31 €" },
          { id: "e36", text: "36 €" },
          { id: "e39", text: "39 €" },
        ],
      },
    ],
    solution: { first: "b3", second: "e31" },
    explain: "Con 3 buoni da 8 € (24 €) e 4 da 5 € (20 €) si fanno 44 € in 7 buoni. Togliendone uno per tipo: 44 − 13 = 31 €.",
  },
  {
    id: "ricetta-nonna",
    difficulty: "media",
    caper: "La ricetta della nonna",
    scene: "La ricetta segreta della nonna è nel ricettario di famiglia. Il cugino ha lasciato due indizi in chat e poi è andato a dormire.",
    steps: [
      {
        clue: "«È alla pagina che fa il doppio dell'età del gatto più dieci.» Il gatto ha 7 anni. Che pagina?",
        options: [
          { id: "p17", text: "Pagina 17" },
          { id: "p24", text: "Pagina 24" },
          { id: "p27", text: "Pagina 27" },
          { id: "p34", text: "Pagina 34" },
        ],
      },
      {
        clue: "A quella pagina ci sono, in ordine: carbonara, gnocchi, lasagne, tiramisù. «È quella in posizione pari alla somma delle cifre della pagina, meno tre.» Quale?",
        options: [
          { id: "carbonara", text: "Carbonara" },
          { id: "gnocchi", text: "Gnocchi" },
          { id: "lasagne", text: "Lasagne" },
          { id: "tiramisu", text: "Tiramisù" },
        ],
      },
    ],
    solution: { first: "p24", second: "lasagne" },
    explain: "7 × 2 + 10 = 24. Le cifre di 24 sommano 6, meno tre fa 3: la terza ricetta, le lasagne.",
  },
  {
    id: "guardaroba",
    difficulty: "media",
    caper: "Il cappotto giusto",
    scene: "Al guardaroba avete perso il gettone. Per farvi ridare il cappotto senza fila, dovete sapere dov'è appeso.",
    steps: [
      {
        clue: "Il numero del gettone è il più piccolo numero di due cifre divisibile sia per 4 sia per 6. Qual è?",
        options: [
          { id: "n12", text: "12" },
          { id: "n16", text: "16" },
          { id: "n18", text: "18" },
          { id: "n24", text: "24" },
        ],
      },
      {
        clue: "I gettoni sono appesi in file da 5: la prima fila ha i numeri 1–5, la seconda 6–10 e così via. In che fila è il vostro?",
        options: [
          { id: "f2", text: "Fila 2" },
          { id: "f3", text: "Fila 3" },
          { id: "f4", text: "Fila 4" },
          { id: "f5", text: "Fila 5" },
        ],
      },
    ],
    solution: { first: "n12", second: "f3" },
    explain: "12 è divisibile per 4 e per 6, e nessun numero di due cifre più piccolo lo è. La terza fila contiene 11–15: fila 3.",
  },
  {
    id: "follower-rubati",
    difficulty: "facile",
    caper: "Follower in prestito",
    scene: "Il profilo del locale rivale ha 240 follower. Il piano: convincere un po' dei loro a seguire anche voi.",
    steps: [
      {
        clue: "Un quarto dei loro follower sono amici di amici vostri. Quanti sono?",
        options: [
          { id: "n40", text: "40" },
          { id: "n60", text: "60" },
          { id: "n80", text: "80" },
          { id: "n120", text: "120" },
        ],
      },
      {
        clue: "Di questi, uno su tre vi segue già. Quanti potete ancora conquistare?",
        options: [
          { id: "m20", text: "20" },
          { id: "m30", text: "30" },
          { id: "m40", text: "40" },
          { id: "m45", text: "45" },
        ],
      },
    ],
    solution: { first: "n60", second: "m40" },
    explain: "240 ÷ 4 = 60 amici di amici. Un terzo, cioè 20, vi segue già: ne restano 40 da conquistare.",
  },
  {
    id: "ombrello-pois",
    difficulty: "difficile",
    caper: "L'ombrello a pois",
    scene: "Piove e all'ingresso c'è un portaombrelli con 6 ombrelli in fila. Il vostro è a pois, ma non siete i soli ad averne uno.",
    steps: [
      {
        clue: "Da sinistra: nero, pois, rosso, pois, nero, pois. Il vostro è il secondo a pois contando da sinistra. In che posizione della fila è?",
        options: [
          { id: "o2", text: "Posizione 2" },
          { id: "o4", text: "Posizione 4" },
          { id: "o5", text: "Posizione 5" },
          { id: "o6", text: "Posizione 6" },
        ],
      },
      {
        clue: "Qualcuno sposta il primo ombrello della fila in fondo, a destra. In che posizione è ora il vostro?",
        options: [
          { id: "q2", text: "Posizione 2" },
          { id: "q3", text: "Posizione 3" },
          { id: "q4", text: "Posizione 4" },
          { id: "q5", text: "Posizione 5" },
        ],
      },
    ],
    solution: { first: "o4", second: "q3" },
    explain: "I pois sono in 2, 4 e 6: il secondo è in posizione 4. Tolto il primo ombrello dalla testa della fila, tutti scalano di uno: il vostro va in 3.",
  },
];

export default varianti;
