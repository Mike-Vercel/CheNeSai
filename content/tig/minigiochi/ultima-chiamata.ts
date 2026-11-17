import type { UltimaChiamataInput } from "@/lib/tig/games/mechanics/ultima-chiamata";

/**
 * 66 · ULTIMA CHIAMATA — un tema e tre micro-sfide a raffica (si aprono a 0, 15 e 30 secondi), di tipo diverso
 * dentro la stessa variante e risolvibili in 10-15 secondi. Le chiamate non si danno indizi a vicenda (si invia
 * tutto insieme alla fine). Soluzioni verificate con calcolo.
 */
const varianti: UltimaChiamataInput[] = [
  // ---------------------------------------------------------------- facili
  {
    id: "pizza-del-venerdi",
    difficulty: "facile",
    theme: "La pizza del venerdì",
    calls: [
      {
        id: "quattro-pizze",
        kind: "Calcolo lampo",
        prompt: "Quattro pizze da 7,50 € l'una. Quanto spendete in tutto?",
        options: [
          { id: "a", text: "30 €" },
          { id: "b", text: "28 €" },
          { id: "c", text: "32 €" },
          { id: "d", text: "26 €" },
        ],
      },
      {
        id: "intruso-forno",
        kind: "L'intruso",
        prompt: "Quale parola non c'entra con le altre?",
        options: [
          { id: "forno", text: "Forno" },
          { id: "impasto", text: "Impasto" },
          { id: "lievito", text: "Lievito" },
          { id: "ombrellone", text: "Ombrellone" },
        ],
      },
      {
        id: "chi-arriva",
        kind: "Logica",
        prompt: "Marco arriva prima di Giulia, Giulia arriva prima di Bea. Chi arriva per ultimo?",
        options: [
          { id: "bea", text: "Bea" },
          { id: "giulia", text: "Giulia" },
          { id: "marco", text: "Marco" },
        ],
      },
    ],
    solution: { answers: { "quattro-pizze": "a", "intruso-forno": "ombrellone", "chi-arriva": "bea" } },
    explain: "Uno: 7,50 × 4 = 30 €. Due: forno, impasto e lievito servono per la pizza, l'ombrellone no. Tre: l'ordine è Marco, Giulia, Bea, quindi l'ultima è Bea.",
  },
  {
    id: "trasloco-in-giornata",
    difficulty: "facile",
    theme: "Trasloco in giornata",
    calls: [
      {
        id: "furgone",
        kind: "Il conto",
        prompt: "Il furgone a noleggio costa 60 € al giorno e lo dividete in 3. Quanto paga ognuno?",
        options: [
          { id: "a", text: "20 €" },
          { id: "b", text: "18 €" },
          { id: "c", text: "30 €" },
          { id: "d", text: "15 €" },
        ],
      },
      {
        id: "riconsegna",
        kind: "Prima o dopo",
        prompt: "Il furgone va riconsegnato alle 18:00. Partite alle 16:45 e ci vogliono 1 ora e 20 minuti di strada. Arrivate prima o dopo?",
        options: [
          { id: "prima", text: "Prima, alle 17:55" },
          { id: "dopo", text: "Dopo, alle 18:05" },
          { id: "giusti", text: "Giusti alle 18:00" },
        ],
      },
      {
        id: "al-contrario",
        kind: "Parole",
        prompt: "Quale di queste parole si legge uguale anche al contrario?",
        options: [
          { id: "otto", text: "Otto" },
          { id: "scatola", text: "Scatola" },
          { id: "nastro", text: "Nastro" },
          { id: "divano", text: "Divano" },
        ],
      },
    ],
    solution: { answers: { furgone: "a", riconsegna: "dopo", "al-contrario": "otto" } },
    explain: "Uno: 60 ÷ 3 = 20 €. Due: 16:45 più 1 ora e 20 minuti fa 18:05, cinque minuti dopo la riconsegna. Tre: OTTO letto da destra a sinistra resta OTTO.",
  },
  {
    id: "calcetto-del-giovedi",
    difficulty: "facile",
    theme: "Il calcetto del giovedì",
    calls: [
      {
        id: "campo",
        kind: "Calcolo lampo",
        prompt: "Il campo costa 80 € e giocate in 10. Quanto paga ognuno?",
        options: [
          { id: "a", text: "8 €" },
          { id: "b", text: "10 €" },
          { id: "c", text: "6 €" },
          { id: "d", text: "12 €" },
        ],
      },
      {
        id: "classifica",
        kind: "Logica",
        prompt: "Tre squadre in classifica: i Gialli sono sotto i Rossi e sopra i Blu. Chi è secondo?",
        options: [
          { id: "gialli", text: "I Gialli" },
          { id: "rossi", text: "I Rossi" },
          { id: "blu", text: "I Blu" },
        ],
      },
      {
        id: "maglie",
        kind: "L'intruso",
        prompt: "Numeri di maglia: 12, 18, 24, 27. Quale non c'entra con gli altri?",
        options: [
          { id: "n12", text: "12" },
          { id: "n18", text: "18" },
          { id: "n24", text: "24" },
          { id: "n27", text: "27" },
        ],
      },
    ],
    solution: { answers: { campo: "a", classifica: "gialli", maglie: "n27" } },
    explain: "Uno: 80 ÷ 10 = 8 €. Due: Rossi in testa, Gialli in mezzo, Blu in fondo. Tre: 12, 18 e 24 sono pari (e multipli di 6), 27 è l'unico dispari.",
  },
  {
    id: "colazione-al-bar",
    difficulty: "facile",
    theme: "Colazione al bar",
    calls: [
      {
        id: "cappuccini",
        kind: "Il conto",
        prompt: "Due cappuccini a 1,60 € e due cornetti a 1,40 €. Quanto pagate in tutto?",
        options: [
          { id: "a", text: "6,00 €" },
          { id: "b", text: "5,80 €" },
          { id: "c", text: "6,20 €" },
          { id: "d", text: "5,60 €" },
        ],
      },
      {
        id: "apertura",
        kind: "Prima o dopo",
        prompt: "Il bar apre alle 7:30. Arrivi 25 minuti prima delle 8:00. Lo trovi già aperto?",
        options: [
          { id: "si-5", text: "Sì, da 5 minuti" },
          { id: "no-5", text: "No, apre tra 5 minuti" },
          { id: "si-25", text: "Sì, da 25 minuti" },
        ],
      },
      {
        id: "parola-lunga",
        kind: "Parole",
        prompt: "Quale di queste parole ha più lettere?",
        options: [
          { id: "cappuccino", text: "Cappuccino" },
          { id: "cornetto", text: "Cornetto" },
          { id: "spremuta", text: "Spremuta" },
          { id: "brioche", text: "Brioche" },
        ],
      },
    ],
    solution: { answers: { cappuccini: "a", apertura: "si-5", "parola-lunga": "cappuccino" } },
    explain: "Uno: 3,20 € di cappuccini più 2,80 € di cornetti = 6,00 €. Due: 25 minuti prima delle 8:00 sono le 7:35, il bar è aperto da 5 minuti. Tre: CAPPUCCINO ha 10 lettere, CORNETTO e SPREMUTA 8, BRIOCHE 7.",
  },
  // ---------------------------------------------------------------- medie
  {
    id: "chat-di-gruppo",
    difficulty: "media",
    theme: "La chat di gruppo in fiamme",
    calls: [
      {
        id: "messaggi",
        kind: "Calcolo lampo",
        prompt: "Nella chat arrivano 12 messaggi ogni 5 minuti. Quanti in un'ora?",
        options: [
          { id: "a", text: "144" },
          { id: "b", text: "120" },
          { id: "c", text: "132" },
          { id: "d", text: "160" },
        ],
      },
      {
        id: "chi-ha-letto",
        kind: "Logica",
        prompt: "Sara ha letto dopo Luca ma prima di Ivo. Nora ha letto dopo Ivo. Chi ha letto per primo?",
        options: [
          { id: "luca", text: "Luca" },
          { id: "sara", text: "Sara" },
          { id: "ivo", text: "Ivo" },
          { id: "nora", text: "Nora" },
        ],
      },
      {
        id: "numeri",
        kind: "L'intruso",
        prompt: "49, 64, 81, 90: quale numero non c'entra con gli altri?",
        options: [
          { id: "n49", text: "49" },
          { id: "n64", text: "64" },
          { id: "n81", text: "81" },
          { id: "n90", text: "90" },
        ],
      },
    ],
    solution: { answers: { messaggi: "a", "chi-ha-letto": "luca", numeri: "n90" } },
    explain: "Uno: in un'ora ci sono 12 blocchi da 5 minuti, 12 × 12 = 144. Due: l'ordine è Luca, Sara, Ivo, Nora. Tre: 49, 64 e 81 sono quadrati (7 × 7, 8 × 8, 9 × 9), 90 no.",
  },
  {
    id: "weekend-in-rifugio",
    difficulty: "media",
    theme: "Weekend in rifugio",
    calls: [
      {
        id: "notti",
        kind: "Il conto",
        prompt: "Il rifugio costa 45 € a notte a testa. Siete in 3 per 2 notti. Quanto spendete in tutto?",
        options: [
          { id: "a", text: "270 €" },
          { id: "b", text: "240 €" },
          { id: "c", text: "135 €" },
          { id: "d", text: "300 €" },
        ],
      },
      {
        id: "sentiero",
        kind: "Prima o dopo",
        prompt: "Il sentiero dura 3 ore e 40 minuti e partite alle 9:50. La cucina del rifugio chiude alle 13:30. Arrivate prima o dopo?",
        options: [
          { id: "prima", text: "Prima della chiusura" },
          { id: "dopo", text: "Dopo la chiusura" },
          { id: "giusti", text: "Esattamente alle 13:30" },
        ],
      },
      {
        id: "lettere",
        kind: "Parole",
        prompt: "Quale parola NON si scrive con le lettere di MONTAGNA, usando ognuna al massimo tante volte quante compare?",
        options: [
          { id: "anta", text: "Anta" },
          { id: "mago", text: "Mago" },
          { id: "tango", text: "Tango" },
          { id: "gatto", text: "Gatto" },
        ],
      },
    ],
    solution: { answers: { notti: "a", sentiero: "giusti", lettere: "gatto" } },
    explain: "Uno: 45 × 3 persone × 2 notti = 270 €. Due: 9:50 più 3 ore fa 12:50, più 40 minuti fa 13:30 esatte. Tre: GATTO ha due T, MONTAGNA una sola; ANTA, MAGO e TANGO invece ci stanno.",
  },
  {
    id: "bollette-di-casa",
    difficulty: "media",
    theme: "Le bollette di casa",
    calls: [
      {
        id: "luce",
        kind: "Calcolo lampo",
        prompt: "La bolletta della luce arriva ogni due mesi: 96 €. Siete in 4. Quanto paga ognuno al mese?",
        options: [
          { id: "a", text: "12 €" },
          { id: "b", text: "24 €" },
          { id: "c", text: "16 €" },
          { id: "d", text: "8 €" },
        ],
      },
      {
        id: "chi-paga",
        kind: "Logica",
        prompt: "Ada, Bruno e Carlo pagano una bolletta a testa: luce, gas, internet. Ada non paga il gas, Bruno paga internet. Chi paga il gas?",
        options: [
          { id: "ada", text: "Ada" },
          { id: "bruno", text: "Bruno" },
          { id: "carlo", text: "Carlo" },
        ],
      },
      {
        id: "mesi",
        kind: "Calendario",
        prompt: "Quale di questi mesi NON ha 31 giorni?",
        options: [
          { id: "luglio", text: "Luglio" },
          { id: "agosto", text: "Agosto" },
          { id: "settembre", text: "Settembre" },
          { id: "dicembre", text: "Dicembre" },
        ],
      },
    ],
    solution: { answers: { luce: "a", "chi-paga": "carlo", mesi: "settembre" } },
    explain: "Uno: 96 € per due mesi sono 48 € al mese, diviso 4 = 12 €. Due: Bruno ha internet, Ada non ha il gas e quindi ha la luce: il gas tocca a Carlo. Tre: settembre ha 30 giorni; luglio, agosto e dicembre 31.",
  },
  {
    id: "concerto-all-aperto",
    difficulty: "media",
    theme: "Il concerto all'aperto",
    calls: [
      {
        id: "inizio",
        kind: "Prima o dopo",
        prompt: "I cancelli aprono alle 18:30 e il concerto inizia 2 ore e 45 minuti dopo. Arrivi alle 21:00: prima o dopo l'inizio?",
        options: [
          { id: "prima-15", text: "Prima, di 15 minuti" },
          { id: "dopo-15", text: "Dopo, di 15 minuti" },
          { id: "prima-45", text: "Prima, di 45 minuti" },
        ],
      },
      {
        id: "prevendita",
        kind: "Il conto",
        prompt: "Il biglietto costa 42 € più il 10% di prevendita. Quanto paghi?",
        options: [
          { id: "a", text: "46,20 €" },
          { id: "b", text: "52,00 €" },
          { id: "c", text: "44,20 €" },
          { id: "d", text: "46,00 €" },
        ],
      },
      {
        id: "ondate",
        kind: "Sequenza",
        prompt: "Ai cancelli entrano 3 persone, poi 6, poi 12, poi 24. Se continua così, quante alla prossima ondata?",
        options: [
          { id: "a", text: "48" },
          { id: "b", text: "36" },
          { id: "c", text: "30" },
          { id: "d", text: "42" },
        ],
      },
    ],
    solution: { answers: { inizio: "prima-15", prevendita: "a", ondate: "a" } },
    explain: "Uno: 18:30 più 2 ore e 45 minuti fa 21:15, arrivi 15 minuti prima. Due: il 10% di 42 è 4,20, totale 46,20 €. Tre: ogni ondata è il doppio della precedente, 24 × 2 = 48.",
  },
  // ---------------------------------------------------------------- difficili
  {
    id: "matrimonio-giulia-marco",
    difficulty: "difficile",
    theme: "Il matrimonio di Giulia e Marco",
    calls: [
      {
        id: "tavoli",
        kind: "Calcolo lampo",
        prompt: "122 invitati e tavoli da 8 posti. Quanti tavoli servono, come minimo?",
        options: [
          { id: "a", text: "16" },
          { id: "b", text: "15" },
          { id: "c", text: "17" },
          { id: "d", text: "14" },
        ],
      },
      {
        id: "cento-giorni",
        kind: "Calendario",
        prompt: "Oggi è giovedì e mancano esattamente 100 giorni alle nozze. Che giorno della settimana sarà il matrimonio?",
        options: [
          { id: "sabato", text: "Sabato" },
          { id: "venerdi", text: "Venerdì" },
          { id: "domenica", text: "Domenica" },
          { id: "giovedi", text: "Giovedì" },
        ],
      },
      {
        id: "vocali",
        kind: "Parole",
        prompt: "Quante vocali ci sono in ADDIO AL CELIBATO?",
        options: [
          { id: "a", text: "8" },
          { id: "b", text: "7" },
          { id: "c", text: "9" },
          { id: "d", text: "6" },
        ],
      },
    ],
    solution: { answers: { tavoli: "a", "cento-giorni": "sabato", vocali: "a" } },
    explain: "Uno: 15 tavoli fanno 120 posti, ne mancano 2: serve il sedicesimo. Due: 100 giorni sono 14 settimane e 2 giorni, giovedì più 2 = sabato. Tre: A-I-O in ADDIO, A in AL, E-I-A-O in CELIBATO: 3 + 1 + 4 = 8.",
  },
  {
    id: "volo-all-alba",
    difficulty: "difficile",
    theme: "Il volo all'alba",
    calls: [
      {
        id: "uscire",
        kind: "Orari",
        prompt: "Il volo parte alle 6:10 e l'imbarco chiude 40 minuti prima. Servono 25 minuti di controlli e 50 di strada. A che ora, al più tardi, esci di casa?",
        options: [
          { id: "a", text: "4:15" },
          { id: "b", text: "4:35" },
          { id: "c", text: "4:05" },
          { id: "d", text: "4:25" },
        ],
      },
      {
        id: "bagagli",
        kind: "Il conto",
        prompt: "Il bagaglio costa 25 € online e 60 € al gate. Siete in 4 e due di voi lo pagano al gate. Quanto spendete in più rispetto a prenotarlo tutti online?",
        options: [
          { id: "a", text: "70 €" },
          { id: "b", text: "120 €" },
          { id: "c", text: "35 €" },
          { id: "d", text: "140 €" },
        ],
      },
      {
        id: "fila",
        kind: "Logica",
        prompt: "In fila al gate in 4: Carla è prima, Dario è subito dietro Carla, Bruno è subito dietro Ada. Chi è ultimo?",
        options: [
          { id: "bruno", text: "Bruno" },
          { id: "ada", text: "Ada" },
          { id: "dario", text: "Dario" },
          { id: "carla", text: "Carla" },
        ],
      },
    ],
    solution: { answers: { uscire: "a", bagagli: "a", fila: "bruno" } },
    explain: "Uno: l'imbarco chiude alle 5:30, i controlli iniziano alle 5:05, si esce alle 4:15. Due: ognuno dei due paga 35 € in più, 2 × 35 = 70 €. Tre: Carla prima, Dario secondo, restano due posti per la coppia Ada e Bruno: Ada terza, Bruno ultimo.",
  },
  {
    id: "palestra-a-gennaio",
    difficulty: "difficile",
    theme: "La palestra a gennaio",
    calls: [
      {
        id: "scheda",
        kind: "Sequenza",
        prompt: "2, 3, 5, 8, 12... qual è il numero successivo?",
        options: [
          { id: "a", text: "17" },
          { id: "b", text: "16" },
          { id: "c", text: "18" },
          { id: "d", text: "20" },
        ],
      },
      {
        id: "abbonamento",
        kind: "Calcolo lampo",
        prompt: "Abbonamento: 39 € al mese oppure 399 € l'anno. Quanto risparmi in un anno scegliendo l'annuale?",
        options: [
          { id: "a", text: "69 €" },
          { id: "b", text: "79 €" },
          { id: "c", text: "59 €" },
          { id: "d", text: "89 €" },
        ],
      },
      {
        id: "armadietti",
        kind: "L'intruso",
        prompt: "Armadietti numero 13, 17, 21 e 23. Quale numero è l'intruso?",
        options: [
          { id: "n13", text: "13" },
          { id: "n17", text: "17" },
          { id: "n21", text: "21" },
          { id: "n23", text: "23" },
        ],
      },
    ],
    solution: { answers: { scheda: "a", abbonamento: "a", armadietti: "n21" } },
    explain: "Uno: si aggiunge 1, poi 2, 3, 4: ora tocca a +5, 12 + 5 = 17. Due: 39 × 12 = 468 €, meno 399 = 69 € risparmiati. Tre: 13, 17 e 23 sono numeri primi, 21 no (3 × 7).",
  },
  {
    id: "rimpatriata-di-classe",
    difficulty: "difficile",
    theme: "La rimpatriata di classe",
    calls: [
      {
        id: "presenti",
        kind: "Calcolo lampo",
        prompt: "Eravate 30 in classe. Un quinto vive all'estero e, di chi è rimasto, tre su quattro vengono alla cena. Quanti siete a cena?",
        options: [
          { id: "a", text: "18" },
          { id: "b", text: "24" },
          { id: "c", text: "20" },
          { id: "d", text: "16" },
        ],
      },
      {
        id: "torta",
        kind: "Il conto",
        prompt: "Menu da 23 € a testa, più una torta da 36 € divisa in parti uguali tra 9 di voi. Quanto paga in tutto uno di quei 9?",
        options: [
          { id: "a", text: "27 €" },
          { id: "b", text: "25 €" },
          { id: "c", text: "32 €" },
          { id: "d", text: "23 €" },
        ],
      },
      {
        id: "primo-maggio",
        kind: "Calendario",
        prompt: "Oggi è venerdì 31 marzo. Che giorno della settimana sarà il 1° maggio?",
        options: [
          { id: "lunedi", text: "Lunedì" },
          { id: "domenica", text: "Domenica" },
          { id: "martedi", text: "Martedì" },
          { id: "sabato", text: "Sabato" },
        ],
      },
    ],
    solution: { answers: { presenti: "a", torta: "a", "primo-maggio": "lunedi" } },
    explain: "Uno: un quinto di 30 è 6, restano 24 e tre quarti di 24 fa 18. Due: 23 € di menu più 36 ÷ 9 = 4 € di torta, 27 €. Tre: il 1° aprile è sabato, aprile ha 30 giorni e 30 giorni dopo sono 4 settimane e 2 giorni: lunedì.",
  },
];

export default varianti;
