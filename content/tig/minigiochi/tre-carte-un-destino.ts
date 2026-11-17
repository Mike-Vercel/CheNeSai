import type { CarteInput } from "@/lib/tig/games/mechanics/tre-carte-un-destino";

/**
 * 74 · TRE CARTE, UN DESTINO — tre carte coperte, tre sfide di tipo diverso con ricompense comparabili
 * (tra 80 e 140, scarto massimo 30): la carta più impegnativa vale un po' di più. Soluzioni verificate con calcolo.
 */
const varianti: CarteInput[] = [
  // ---------------------------------------------------------------- facili
  {
    id: "carte-in-cucina",
    difficulty: "facile",
    title: "Tre carte in cucina",
    cards: [
      {
        id: "lasagne",
        kind: "Calcolo",
        reward: 100,
        prompt: "Una teglia di lasagne fa 12 porzioni. Siete in 8 e ognuno ne mangia una. Quante porzioni avanzano?",
        options: [
          { id: "a", text: "4" },
          { id: "b", text: "3" },
          { id: "c", text: "6" },
          { id: "d", text: "2" },
        ],
      },
      {
        id: "chi-porta",
        kind: "Logica",
        reward: 110,
        prompt: "Ada, Bruno e Carla portano dolce, pane e frutta, una cosa a testa. Bruno non porta il dolce e Carla porta il pane. Chi porta il dolce?",
        options: [
          { id: "ada", text: "Ada" },
          { id: "bruno", text: "Bruno" },
          { id: "carla", text: "Carla" },
        ],
      },
      {
        id: "lettera-a",
        kind: "Parole",
        reward: 90,
        prompt: "Quale di queste parole contiene esattamente due volte la lettera A?",
        options: [
          { id: "patata", text: "Patata" },
          { id: "banana", text: "Banana" },
          { id: "carota", text: "Carota" },
          { id: "pomodoro", text: "Pomodoro" },
        ],
      },
    ],
    solution: { answers: { lasagne: "a", "chi-porta": "ada", "lettera-a": "carota" } },
    explain: "Calcolo: 12 porzioni meno 8 = 4. Logica: Carla porta il pane e Bruno non porta il dolce, quindi Bruno porta la frutta e il dolce tocca ad Ada. Parole: CAROTA ha due A; PATATA e BANANA ne hanno tre, POMODORO nessuna.",
  },
  {
    id: "carte-al-mare",
    difficulty: "facile",
    title: "Tre carte al mare",
    cards: [
      {
        id: "ombrellone",
        kind: "Calcolo",
        reward: 100,
        prompt: "Ombrellone e due lettini costano 25 € al giorno. Quanto spendete per una settimana intera?",
        options: [
          { id: "a", text: "175 €" },
          { id: "b", text: "150 €" },
          { id: "c", text: "200 €" },
          { id: "d", text: "165 €" },
        ],
      },
      {
        id: "traghetto",
        kind: "Orari",
        reward: 110,
        prompt: "Il traghetto parte alle 9:45 e la traversata dura 1 ora e 30 minuti. A che ora arrivate?",
        options: [
          { id: "a", text: "11:15" },
          { id: "b", text: "11:05" },
          { id: "c", text: "10:15" },
          { id: "d", text: "11:30" },
        ],
      },
      {
        id: "intruso",
        kind: "L'intruso",
        reward: 90,
        prompt: "Quale di queste cose non c'entra con una giornata in spiaggia?",
        options: [
          { id: "telo", text: "Telo mare" },
          { id: "infradito", text: "Infradito" },
          { id: "crema", text: "Crema solare" },
          { id: "sciarpa", text: "Sciarpa di lana" },
        ],
      },
    ],
    solution: { answers: { ombrellone: "a", traghetto: "a", intruso: "sciarpa" } },
    explain: "Calcolo: 25 € × 7 giorni = 175 €. Orari: 9:45 più un'ora fa 10:45, più mezz'ora fa 11:15. Intruso: telo, infradito e crema solare vanno in spiaggia, la sciarpa di lana no.",
  },
  {
    id: "carte-di-compleanno",
    difficulty: "facile",
    title: "Tre carte di compleanno",
    cards: [
      {
        id: "torta",
        kind: "Calcolo",
        reward: 100,
        prompt: "La torta ha 16 fette. Siete in 6 e ognuno ne mangia 2. Quante fette restano?",
        options: [
          { id: "a", text: "4" },
          { id: "b", text: "6" },
          { id: "c", text: "2" },
          { id: "d", text: "10" },
        ],
      },
      {
        id: "venerdi",
        kind: "Calendario",
        reward: 110,
        prompt: "Il compleanno di Bea è venerdì 9. Che giorno della settimana è il 23 dello stesso mese?",
        options: [
          { id: "venerdi", text: "Venerdì" },
          { id: "sabato", text: "Sabato" },
          { id: "giovedi", text: "Giovedì" },
          { id: "domenica", text: "Domenica" },
        ],
      },
      {
        id: "altezze",
        kind: "Logica",
        reward: 90,
        prompt: "Luca è più alto di Marco e Marco è più alto di Ivo. Chi è il più basso dei tre?",
        options: [
          { id: "ivo", text: "Ivo" },
          { id: "marco", text: "Marco" },
          { id: "luca", text: "Luca" },
        ],
      },
    ],
    solution: { answers: { torta: "a", venerdi: "venerdi", altezze: "ivo" } },
    explain: "Calcolo: 6 × 2 = 12 fette mangiate, 16 − 12 = 4. Calendario: dal 9 al 23 passano 14 giorni, due settimane esatte: è di nuovo venerdì. Logica: Luca più alto di Marco, Marco più alto di Ivo: il più basso è Ivo.",
  },
  {
    id: "carte-in-palestra",
    difficulty: "facile",
    title: "Tre carte in palestra",
    cards: [
      {
        id: "giri",
        kind: "Calcolo",
        reward: 100,
        prompt: "Corri 4 giri di una pista da 400 metri. Quanti chilometri fai?",
        options: [
          { id: "a", text: "1,6 km" },
          { id: "b", text: "1,2 km" },
          { id: "c", text: "2 km" },
          { id: "d", text: "16 km" },
        ],
      },
      {
        id: "serie",
        kind: "Sequenza",
        reward: 90,
        prompt: "50, 45, 40, 35... quale numero viene dopo?",
        options: [
          { id: "a", text: "30" },
          { id: "b", text: "25" },
          { id: "c", text: "33" },
        ],
      },
      {
        id: "sport",
        kind: "Logica",
        reward: 110,
        prompt: "Giulia, Marco e Sara fanno corsa, nuoto e yoga, uno sport a testa. Giulia odia l'acqua e Marco fa corsa. Che cosa fa Giulia?",
        options: [
          { id: "yoga", text: "Yoga" },
          { id: "nuoto", text: "Nuoto" },
          { id: "corsa", text: "Corsa" },
        ],
      },
    ],
    solution: { answers: { giri: "a", serie: "a", sport: "yoga" } },
    explain: "Calcolo: 4 × 400 = 1.600 metri, cioè 1,6 km. Sequenza: si scende di 5 alla volta, dopo 35 viene 30. Logica: la corsa è di Marco e Giulia non nuota, quindi fa yoga (e Sara nuota).",
  },
  // ---------------------------------------------------------------- medie
  {
    id: "carte-del-trasloco",
    difficulty: "media",
    title: "Tre carte del trasloco",
    cards: [
      {
        id: "viaggi",
        kind: "Calcolo",
        reward: 110,
        prompt: "Hai 61 scatole. Bea ne porta 5 nella sua auto, il resto va col furgone che ne carica 14 per viaggio. Quanti viaggi di furgone servono?",
        options: [
          { id: "a", text: "4" },
          { id: "b", text: "5" },
          { id: "c", text: "3" },
        ],
      },
      {
        id: "pila",
        kind: "Logica",
        reward: 120,
        prompt: "Quattro scatole impilate: libri, piatti, lampade, vestiti. I libri non sono né in cima né in fondo, i piatti sono subito sopra i libri, le lampade non sono in fondo. Cosa c'è in fondo?",
        options: [
          { id: "vestiti", text: "I vestiti" },
          { id: "lampade", text: "Le lampade" },
          { id: "libri", text: "I libri" },
          { id: "piatti", text: "I piatti" },
        ],
      },
      {
        id: "iniziali",
        kind: "Parole",
        reward: 100,
        prompt: "Le iniziali di Scatola, Cucina, Armadio, Libri e Asciugamani, in quest'ordine, formano una parola. Quale?",
        options: [
          { id: "scala", text: "Scala" },
          { id: "salsa", text: "Salsa" },
          { id: "scola", text: "Scola" },
        ],
      },
    ],
    solution: { answers: { viaggi: "a", pila: "vestiti", iniziali: "scala" } },
    explain: "Calcolo: 61 − 5 = 56 scatole, 56 ÷ 14 = 4 viaggi esatti. Logica: i libri stanno al secondo o al terzo posto dal basso, i piatti subito sopra; in fondo non ci sono né libri, né piatti, né lampade: restano i vestiti. Parole: S, C, A, L, A formano SCALA.",
  },
  {
    id: "carte-delle-bollette",
    difficulty: "media",
    title: "Tre carte delle bollette",
    cards: [
      {
        id: "gas",
        kind: "Calcolo",
        reward: 110,
        prompt: "La bolletta del gas è di 135 € per 3 mesi e la dividete in 3 coinquilini. Quanto paga ognuno al mese?",
        options: [
          { id: "a", text: "15 €" },
          { id: "b", text: "45 €" },
          { id: "c", text: "12 €" },
          { id: "d", text: "18 €" },
        ],
      },
      {
        id: "scadenza",
        kind: "Calendario",
        reward: 100,
        prompt: "La bolletta arriva lunedì 12 maggio e scade 20 giorni dopo. Quando scade?",
        options: [
          { id: "a", text: "Domenica 1° giugno" },
          { id: "b", text: "Sabato 31 maggio" },
          { id: "c", text: "Lunedì 2 giugno" },
          { id: "d", text: "Domenica 31 maggio" },
        ],
      },
      {
        id: "tutte-insieme",
        kind: "Logica",
        reward: 120,
        prompt: "La luce arriva ogni 2 mesi, il gas ogni 3, internet ogni mese. A gennaio sono arrivate tutte e tre insieme. In che mese ricapita la prossima volta?",
        options: [
          { id: "luglio", text: "Luglio" },
          { id: "giugno", text: "Giugno" },
          { id: "aprile", text: "Aprile" },
          { id: "dicembre", text: "Dicembre" },
        ],
      },
    ],
    solution: { answers: { gas: "a", scadenza: "a", "tutte-insieme": "luglio" } },
    explain: "Calcolo: 135 ÷ 3 mesi = 45 € al mese, diviso 3 = 15 €. Calendario: maggio ha 31 giorni, quindi 20 giorni dopo il 12 maggio è il 1° giugno; 20 giorni sono 2 settimane e 6 giorni: lunedì più 6 = domenica. Logica: serve un multiplo comune di 2 e 3, cioè 6 mesi: da gennaio a luglio.",
  },
  {
    id: "carte-al-concerto",
    difficulty: "media",
    title: "Tre carte al concerto",
    cards: [
      {
        id: "metro",
        kind: "Orari",
        reward: 110,
        prompt: "Il concerto inizia alle 21:15 e dura 2 ore e 50 minuti. L'ultima metro parte alle 0:10 dalla fermata davanti all'uscita. Ce la fai?",
        options: [
          { id: "si-5", text: "Sì, con 5 minuti di margine" },
          { id: "no-5", text: "No, la perdi per 5 minuti" },
          { id: "si-15", text: "Sì, con 15 minuti di margine" },
          { id: "no-15", text: "No, la perdi per 15 minuti" },
        ],
      },
      {
        id: "commissione",
        kind: "Calcolo",
        reward: 120,
        prompt: "Il biglietto costa 48 € più il 12,5% di commissione. Quanto paghi in tutto?",
        options: [
          { id: "a", text: "54 €" },
          { id: "b", text: "52 €" },
          { id: "c", text: "60 €" },
          { id: "d", text: "53,50 €" },
        ],
      },
      {
        id: "anagramma",
        kind: "Parole",
        reward: 100,
        prompt: "Quale di queste parole è un anagramma di CANTO?",
        options: [
          { id: "conta", text: "Conta" },
          { id: "canta", text: "Canta" },
          { id: "conto", text: "Conto" },
        ],
      },
    ],
    solution: { answers: { metro: "si-5", commissione: "a", anagramma: "conta" } },
    explain: "Orari: 21:15 più 2 ore e 50 minuti fa mezzanotte e 5, la metro parte 5 minuti dopo. Calcolo: il 12,5% è un ottavo, 48 ÷ 8 = 6 €, totale 54 €. Parole: CONTA ha le stesse lettere di CANTO; CANTA ha due A e CONTO due O.",
  },
  {
    id: "carte-del-matrimonio",
    difficulty: "media",
    title: "Tre carte del matrimonio",
    cards: [
      {
        id: "bomboniere",
        kind: "Calcolo",
        reward: 120,
        prompt: "Le bomboniere costano 4,50 € l'una e gli invitati sono 120. Con lo sconto del 10% sul totale, quanto spendono gli sposi?",
        options: [
          { id: "a", text: "486 €" },
          { id: "b", text: "494 €" },
          { id: "c", text: "540 €" },
          { id: "d", text: "476 €" },
        ],
      },
      {
        id: "ruoli",
        kind: "Logica",
        reward: 100,
        prompt: "Bea, Carlo e Dario fanno testimone, fotografo e DJ, un ruolo a testa. Bea non fa il DJ. Carlo non fa le foto e non fa il DJ. Chi fa il DJ?",
        options: [
          { id: "dario", text: "Dario" },
          { id: "bea", text: "Bea" },
          { id: "carlo", text: "Carlo" },
        ],
      },
      {
        id: "nubilato",
        kind: "Calendario",
        reward: 110,
        prompt: "Il matrimonio è sabato 6 settembre. L'addio al nubilato è due settimane e un giorno prima. Quando cade?",
        options: [
          { id: "a", text: "Venerdì 22 agosto" },
          { id: "b", text: "Venerdì 23 agosto" },
          { id: "c", text: "Sabato 23 agosto" },
          { id: "d", text: "Giovedì 21 agosto" },
        ],
      },
    ],
    solution: { answers: { bomboniere: "a", ruoli: "dario", nubilato: "a" } },
    explain: "Calcolo: 4,50 × 120 = 540 €, meno il 10% (54 €) = 486 €. Logica: Carlo non fa né foto né DJ, quindi è il testimone; Bea non fa il DJ, quindi fa le foto: il DJ è Dario. Calendario: due settimane prima è sabato 23 agosto, un giorno prima ancora venerdì 22 agosto.",
  },
  // ---------------------------------------------------------------- difficili
  {
    id: "carte-in-aeroporto",
    difficulty: "difficile",
    title: "Tre carte in aeroporto",
    cards: [
      {
        id: "fuso",
        kind: "Orari",
        reward: 120,
        prompt: "Parti alle 23:40, ora italiana, per un volo di 11 ore e 35 minuti. Dove atterri l'orologio segna 6 ore in meno che in Italia. Che ora è lì quando arrivi?",
        options: [
          { id: "a", text: "5:15" },
          { id: "b", text: "17:15" },
          { id: "c", text: "11:15" },
          { id: "d", text: "4:15" },
        ],
      },
      {
        id: "cambio",
        kind: "Calcolo",
        reward: 130,
        prompt: "Cambi 250 € in dollari: 1 € vale 1,08 dollari, ma l'ufficio cambi trattiene prima il 3% degli euro che porti. Quanti dollari ricevi?",
        options: [
          { id: "a", text: "261,90 dollari" },
          { id: "b", text: "270,00 dollari" },
          { id: "c", text: "262,50 dollari" },
          { id: "d", text: "251,90 dollari" },
        ],
      },
      {
        id: "check-in",
        kind: "Logica",
        reward: 110,
        prompt: "Ada, Bruno, Carla e Dario in fila al check-in. Dario è l'ultimo, Bruno è subito dietro Carla e Carla non è seconda. Chi è secondo?",
        options: [
          { id: "bruno", text: "Bruno" },
          { id: "ada", text: "Ada" },
          { id: "carla", text: "Carla" },
          { id: "dario", text: "Dario" },
        ],
      },
    ],
    solution: { answers: { fuso: "a", cambio: "a", "check-in": "bruno" } },
    explain: "Orari: 23:40 più 11 ore e 35 minuti fa le 11:15 italiane del giorno dopo, meno 6 ore = 5:15. Calcolo: il 3% di 250 è 7,50, restano 242,50 € × 1,08 = 261,90 dollari. Logica: Carla e Bruno sono in coppia davanti a Dario; Carla non è seconda, quindi è prima e Bruno secondo.",
  },
  {
    id: "carte-del-condominio",
    difficulty: "difficile",
    title: "Tre carte del condominio",
    cards: [
      {
        id: "millesimi",
        kind: "Calcolo",
        reward: 120,
        prompt: "Le spese del palazzo sono 2.400 € e si dividono per millesimi. Il tuo appartamento vale 85 millesimi. Quanto paghi?",
        options: [
          { id: "a", text: "204 €" },
          { id: "b", text: "240 €" },
          { id: "c", text: "185 €" },
          { id: "d", text: "212 €" },
        ],
      },
      {
        id: "piani",
        kind: "Logica",
        reward: 130,
        prompt: "Cinque piani, un inquilino per piano. Carla sta al primo, Dario subito sopra Carla. Bruno sta sopra Dario e Ada sopra Bruno, ma non all'ultimo. A che piano sta Ivo?",
        options: [
          { id: "quinto", text: "Al quinto" },
          { id: "quarto", text: "Al quarto" },
          { id: "terzo", text: "Al terzo" },
        ],
      },
      {
        id: "sequenza",
        kind: "Sequenza",
        reward: 110,
        prompt: "3, 4, 7, 11, 18, 29... qual è il numero successivo?",
        options: [
          { id: "a", text: "47" },
          { id: "b", text: "40" },
          { id: "c", text: "43" },
          { id: "d", text: "58" },
        ],
      },
    ],
    solution: { answers: { millesimi: "a", piani: "quinto", sequenza: "a" } },
    explain: "Calcolo: 2.400 × 85 ÷ 1.000 = 204 €. Logica: Carla al primo, Dario al secondo; Ada sta sopra Bruno ma non al quinto, quindi Ada al quarto e Bruno al terzo: Ivo al quinto. Sequenza: ogni numero è la somma dei due precedenti, 18 + 29 = 47.",
  },
  {
    id: "carte-della-cena",
    difficulty: "difficile",
    title: "Tre carte della cena tra amici",
    cards: [
      {
        id: "conto",
        kind: "Il conto",
        reward: 120,
        prompt: "Il conto è 210 €. Nora paga solo la sua insalata da 12 €. Gli altri 5 scalano un buono da 18 € e dividono il resto in parti uguali. Quanto paga ognuno dei 5?",
        options: [
          { id: "a", text: "36 €" },
          { id: "b", text: "39,60 €" },
          { id: "c", text: "38,40 €" },
          { id: "d", text: "42 €" },
        ],
      },
      {
        id: "sinceri",
        kind: "Logica",
        reward: 130,
        prompt: "Teo e Nora: ognuno dice sempre il vero o mente sempre. Teo: «Nora mente». Nora: «Teo e io diciamo entrambi il vero». Chi dice il vero?",
        options: [
          { id: "teo", text: "Solo Teo" },
          { id: "nora", text: "Solo Nora" },
          { id: "entrambi", text: "Tutti e due" },
          { id: "nessuno", text: "Nessuno dei due" },
        ],
      },
      {
        id: "alfabeto",
        kind: "Parole",
        reward: 110,
        prompt: "Quale di queste parole ha tutte le lettere in ordine alfabetico, da sinistra a destra?",
        options: [
          { id: "elmo", text: "Elmo" },
          { id: "cesto", text: "Cesto" },
          { id: "ditta", text: "Ditta" },
          { id: "forno", text: "Forno" },
        ],
      },
    ],
    solution: { answers: { conto: "a", sinceri: "teo", alfabeto: "elmo" } },
    explain: "Conto: 210 − 12 − 18 = 180 €, diviso 5 = 36 €. Logica: se Nora dicesse il vero, anche Teo sarebbe sincero, ma Teo dice che lei mente: impossibile. Quindi Nora mente e Teo, che lo dice, è sincero. Parole: E, L, M, O sono in ordine; in CESTO la O viene dopo la T, in DITTA la A è in fondo, in FORNO la N segue la R.",
  },
  {
    id: "carte-in-viaggio",
    difficulty: "difficile",
    title: "Tre carte in viaggio",
    cards: [
      {
        id: "pieno",
        kind: "Calcolo",
        reward: 120,
        prompt: "L'auto consuma 6 litri ogni 100 km e la benzina costa 1,85 € al litro. Quanto spendete per 650 km?",
        options: [
          { id: "a", text: "72,15 €" },
          { id: "b", text: "71,15 €" },
          { id: "c", text: "74,00 €" },
          { id: "d", text: "66,15 €" },
        ],
      },
      {
        id: "tappe",
        kind: "Orari",
        reward: 110,
        prompt: "Partite alle 7:20, guidate 3 ore e 45 minuti, vi fermate 40 minuti e poi guidate altre 2 ore e 50 minuti. A che ora arrivate?",
        options: [
          { id: "a", text: "14:35" },
          { id: "b", text: "14:15" },
          { id: "c", text: "13:55" },
          { id: "d", text: "14:45" },
        ],
      },
      {
        id: "bisestile",
        kind: "Calendario",
        reward: 130,
        prompt: "Partite giovedì 28 febbraio, in un anno bisestile, e restate via 10 notti. In che giorno tornate?",
        options: [
          { id: "a", text: "Domenica 9 marzo" },
          { id: "b", text: "Domenica 10 marzo" },
          { id: "c", text: "Sabato 9 marzo" },
          { id: "d", text: "Lunedì 10 marzo" },
        ],
      },
    ],
    solution: { answers: { pieno: "a", tappe: "a", bisestile: "a" } },
    explain: "Calcolo: 650 km sono 6,5 volte 100, quindi 6,5 × 6 = 39 litri; 39 × 1,85 = 72,15 €. Orari: 7:20 + 3:45 = 11:05, più 40 minuti = 11:45, più 2:50 = 14:35. Calendario: con il 29 febbraio, 10 giorni dopo il 28 febbraio è il 9 marzo; 10 giorni sono una settimana e 3 giorni: giovedì più 3 = domenica.",
  },
];

export default varianti;
