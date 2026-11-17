import type { ImboscataInput } from "@/lib/tig/games/mechanics/l-imboscata";

/**
 * 73 · L'IMBOSCATA — tre trappole per variante, ognuna una domanda a 3 opzioni di TIPO diverso e di difficoltà
 * comparabile: l'avversario sceglie quale far affrontare al bersaglio leggendo solo nome e `blurb` (che dice
 * il tipo di prova senza anticipare la domanda). Soluzioni verificate con calcolo.
 */
const varianti: ImboscataInput[] = [
  // ---------------------------------------------------------------- facili
  {
    id: "imboscata-in-cucina",
    difficulty: "facile",
    title: "Imboscata in cucina",
    traps: [
      {
        id: "dosi",
        name: "Calcolo lampo",
        blurb: "Un conto a mente con le dosi di una ricetta.",
        prompt: "La ricetta per 4 persone vuole 300 g di pasta. Quanti grammi servono per 6 persone?",
        options: [
          { id: "a", text: "450 g" },
          { id: "b", text: "400 g" },
          { id: "c", text: "500 g" },
        ],
      },
      {
        id: "compiti",
        name: "Logica",
        blurb: "Chi fa cosa: un ragionamento a esclusione tra coinquilini.",
        prompt: "Ada, Bruno e Carla: uno cucina, uno apparecchia, uno lava i piatti. Ada non cucina e Carla lava i piatti. Chi apparecchia?",
        options: [
          { id: "ada", text: "Ada" },
          { id: "bruno", text: "Bruno" },
          { id: "carla", text: "Carla" },
        ],
      },
      {
        id: "anagramma",
        name: "Parole",
        blurb: "Lettere da rimescolare: un anagramma da riconoscere.",
        prompt: "Una sola di queste parole è un anagramma di MELA. Quale?",
        options: [
          { id: "male", text: "Male" },
          { id: "mele", text: "Mele" },
          { id: "lama", text: "Lama" },
        ],
      },
    ],
    solution: { answers: { dosi: "a", compiti: "ada", anagramma: "male" } },
    explain: "Dosi: 300 ÷ 4 = 75 g a persona, per 6 fa 450 g. Logica: Carla lava i piatti e Ada non cucina, quindi Ada apparecchia e Bruno cucina. Parole: MALE ha le stesse lettere di MELA; MELE ha due E e LAMA due A.",
  },
  {
    id: "agguato-al-supermercato",
    difficulty: "facile",
    title: "Agguato al supermercato",
    traps: [
      {
        id: "spesa",
        name: "Il conto",
        blurb: "Prezzi da sommare al volo, come alla cassa.",
        prompt: "Tre yogurt a 1,30 € l'uno e un pacco di pasta a 0,90 €. Quanto spendi in tutto?",
        options: [
          { id: "a", text: "4,80 €" },
          { id: "b", text: "4,60 €" },
          { id: "c", text: "5,20 €" },
        ],
      },
      {
        id: "chiusura",
        name: "Orari",
        blurb: "Un orologio e un orario di chiusura: quanto tempo resta?",
        prompt: "Il supermercato chiude alle 21:00 e sono le 20:35. Quanti minuti hai per finire la spesa?",
        options: [
          { id: "a", text: "25 minuti" },
          { id: "b", text: "35 minuti" },
          { id: "c", text: "15 minuti" },
        ],
      },
      {
        id: "file",
        name: "Logica",
        blurb: "Due confronti e una sola conclusione possibile.",
        prompt: "Alle casse, la fila 1 è più lunga della fila 2 e la fila 3 è più corta della fila 2. Quale fila è la più corta?",
        options: [
          { id: "f1", text: "La fila 1" },
          { id: "f2", text: "La fila 2" },
          { id: "f3", text: "La fila 3" },
        ],
      },
    ],
    solution: { answers: { spesa: "a", chiusura: "a", file: "f3" } },
    explain: "Conto: 3 × 1,30 = 3,90 €, più 0,90 = 4,80 €. Orari: dalle 20:35 alle 21:00 passano 25 minuti. Logica: la 1 è più lunga della 2, la 2 più lunga della 3: la più corta è la fila 3.",
  },
  {
    id: "trappola-al-compleanno",
    difficulty: "facile",
    title: "Trappola al compleanno",
    traps: [
      {
        id: "regalo",
        name: "Calcolo lampo",
        blurb: "Una divisione da fare in fretta tra amici.",
        prompt: "Il regalo costa 72 € e lo dividete in 8. Quanto mette ognuno?",
        options: [
          { id: "a", text: "9 €" },
          { id: "b", text: "8 €" },
          { id: "c", text: "12 €" },
        ],
      },
      {
        id: "settimana",
        name: "Calendario",
        blurb: "Giorni della settimana da contare sul calendario.",
        prompt: "Il compleanno è sabato 14. Che giorno della settimana è il 21 dello stesso mese?",
        options: [
          { id: "sabato", text: "Sabato" },
          { id: "domenica", text: "Domenica" },
          { id: "venerdi", text: "Venerdì" },
        ],
      },
      {
        id: "specchio",
        name: "Parole",
        blurb: "Una parola da leggere in un modo un po' insolito.",
        prompt: "Quale di queste parole si legge uguale anche al contrario?",
        options: [
          { id: "osso", text: "Osso" },
          { id: "orso", text: "Orso" },
          { id: "ossa", text: "Ossa" },
        ],
      },
    ],
    solution: { answers: { regalo: "a", settimana: "sabato", specchio: "osso" } },
    explain: "Calcolo: 72 ÷ 8 = 9 €. Calendario: dal 14 al 21 passano 7 giorni, una settimana esatta: è di nuovo sabato. Parole: OSSO letto al contrario resta OSSO; ORSO diventa OSRO e OSSA diventa ASSO.",
  },
  {
    id: "imboscata-in-palestra",
    difficulty: "facile",
    title: "Imboscata in palestra",
    traps: [
      {
        id: "addominali",
        name: "Calcolo lampo",
        blurb: "Ripetizioni da contare, come a fine allenamento.",
        prompt: "Fai 4 serie da 15 addominali, ma nell'ultima ti fermi a 9. Quanti addominali hai fatto in tutto?",
        options: [
          { id: "a", text: "54" },
          { id: "b", text: "60" },
          { id: "c", text: "51" },
        ],
      },
      {
        id: "serie",
        name: "Sequenza",
        blurb: "Una serie di numeri: trovate la regola e il prossimo.",
        prompt: "2, 4, 8, 16... quale numero viene dopo?",
        options: [
          { id: "a", text: "32" },
          { id: "b", text: "24" },
          { id: "c", text: "20" },
        ],
      },
      {
        id: "corsa",
        name: "Logica",
        blurb: "Chi è più veloce di chi: un confronto a catena.",
        prompt: "Marco corre più veloce di Luca e Luca corre più veloce di Ivo. Chi è il più lento dei tre?",
        options: [
          { id: "ivo", text: "Ivo" },
          { id: "luca", text: "Luca" },
          { id: "marco", text: "Marco" },
        ],
      },
    ],
    solution: { answers: { addominali: "a", serie: "a", corsa: "ivo" } },
    explain: "Calcolo: tre serie complete fanno 45, più 9 dell'ultima = 54. Sequenza: ogni numero è il doppio del precedente, 16 × 2 = 32. Logica: Marco batte Luca e Luca batte Ivo: il più lento è Ivo.",
  },
  // ---------------------------------------------------------------- medie
  {
    id: "agguato-in-agenzia",
    difficulty: "media",
    title: "Agguato in agenzia viaggi",
    traps: [
      {
        id: "preventivo",
        name: "Il conto",
        blurb: "Un preventivo di viaggio da sommare senza dimenticare niente.",
        prompt: "Volo a 89 € a testa più 15 € di bagaglio ciascuno. Siete in 3: quanto spendete in tutto?",
        options: [
          { id: "a", text: "312 €" },
          { id: "b", text: "297 €" },
          { id: "c", text: "282 €" },
        ],
      },
      {
        id: "pullman",
        name: "Orari",
        blurb: "Partenza e durata: l'orario di arrivo da calcolare.",
        prompt: "Parti alle 22:40 e il pullman ci mette 7 ore e 35 minuti. A che ora arrivi?",
        options: [
          { id: "a", text: "6:15" },
          { id: "b", text: "5:15" },
          { id: "c", text: "6:25" },
        ],
      },
      {
        id: "iniziali",
        name: "Parole",
        blurb: "Una parola nascosta dentro un elenco, da scovare.",
        prompt: "Prendi le iniziali, in quest'ordine, di: Treno, Aereo, Nave, Gommone, Ostello. Che parola formano?",
        options: [
          { id: "tango", text: "Tango" },
          { id: "tonga", text: "Tonga" },
          { id: "tanga", text: "Tanga" },
        ],
      },
    ],
    solution: { answers: { preventivo: "a", pullman: "a", iniziali: "tango" } },
    explain: "Conto: 89 + 15 = 104 € a testa, per 3 = 312 €. Orari: 22:40 più 7 ore fa 5:40, più 35 minuti fa 6:15. Parole: T di Treno, A di Aereo, N di Nave, G di Gommone, O di Ostello: TANGO.",
  },
  {
    id: "imboscata-tra-coinquilini",
    difficulty: "media",
    title: "Imboscata tra coinquilini",
    traps: [
      {
        id: "affitto",
        name: "Calcolo lampo",
        blurb: "Un affitto da dividere in parti non proprio uguali.",
        prompt: "Affitto di 1.140 € in tre. La stanza grande paga 60 € più delle altre due, che pagano uguale. Quanto paga la stanza grande?",
        options: [
          { id: "a", text: "420 €" },
          { id: "b", text: "400 €" },
          { id: "c", text: "440 €" },
        ],
      },
      {
        id: "primo-aprile",
        name: "Calendario",
        blurb: "Un mese che finisce e un giorno della settimana da ritrovare.",
        prompt: "L'affitto si paga il 1° di ogni mese. Il 1° marzo è un mercoledì: che giorno della settimana sarà il 1° aprile?",
        options: [
          { id: "sabato", text: "Sabato" },
          { id: "venerdi", text: "Venerdì" },
          { id: "mercoledi", text: "Mercoledì" },
        ],
      },
      {
        id: "latte",
        name: "Logica",
        blurb: "Tre versioni, una sola vera: trovate il colpevole.",
        prompt: "Il latte è finito. Ada: «È stato Bruno». Bruno: «Non sono stato io». Carla: «Non sono stata io». Uno solo dice il vero: chi l'ha finito?",
        options: [
          { id: "carla", text: "Carla" },
          { id: "ada", text: "Ada" },
          { id: "bruno", text: "Bruno" },
        ],
      },
    ],
    solution: { answers: { affitto: "a", "primo-aprile": "sabato", latte: "carla" } },
    explain: "Calcolo: togli i 60 € in più, restano 1.080 € da dividere in 3 = 360 €; la grande paga 360 + 60 = 420 €. Calendario: marzo ha 31 giorni, 4 settimane e 3 giorni: mercoledì più 3 = sabato. Logica: se fosse Ada o Bruno direbbero il vero in due; con Carla dice il vero solo Bruno.",
  },
  {
    id: "agguato-al-matrimonio",
    difficulty: "media",
    title: "Agguato al matrimonio",
    traps: [
      {
        id: "busta",
        name: "Il conto",
        blurb: "Una busta per gli sposi: contate bene chi mette quanto.",
        prompt: "Per la busta degli sposi in 5 mettete 60 € a testa, ma uno di voi ne mette solo 40. Quanto c'è nella busta?",
        options: [
          { id: "a", text: "280 €" },
          { id: "b", text: "300 €" },
          { id: "c", text: "260 €" },
        ],
      },
      {
        id: "ricevimento",
        name: "Orari",
        blurb: "Una giornata a tappe: sommate i tempi.",
        prompt: "La cerimonia inizia alle 11:30 e dura un'ora. Poi 50 minuti di foto e 35 minuti di strada. A che ora arrivano gli sposi al ricevimento?",
        options: [
          { id: "a", text: "13:55" },
          { id: "b", text: "13:45" },
          { id: "c", text: "14:05" },
        ],
      },
      {
        id: "sedie",
        name: "Logica",
        blurb: "Posti a sedere e vincoli da rispettare.",
        prompt: "Fila di 4 sedie. Luca è sulla prima a sinistra e Bea ha Luca da un lato e Nora dall'altro. Dove si siede Ivo?",
        options: [
          { id: "ultima", text: "Sull'ultima a destra" },
          { id: "accanto-luca", text: "Accanto a Luca" },
          { id: "tra", text: "Tra Bea e Nora" },
        ],
      },
    ],
    solution: { answers: { busta: "a", ricevimento: "a", sedie: "ultima" } },
    explain: "Conto: 4 × 60 = 240 €, più 40 = 280 €. Orari: fine cerimonia 12:30, fine foto 13:20, arrivo 13:55. Logica: Luca prima sedia, Bea seconda, Nora terza: a Ivo resta l'ultima a destra.",
  },
  {
    id: "imboscata-al-concerto",
    difficulty: "media",
    title: "Imboscata al concerto",
    traps: [
      {
        id: "ordine",
        name: "Calcolo lampo",
        blurb: "Un ordine online da far quadrare al centesimo.",
        prompt: "Biglietto da 55 € più 8 € di commissione a biglietto. Ne comprate 4 e un codice toglie 10 € dal totale dell'ordine. Quanto pagate?",
        options: [
          { id: "a", text: "242 €" },
          { id: "b", text: "212 €" },
          { id: "c", text: "252 €" },
        ],
      },
      {
        id: "luci",
        name: "Sequenza",
        blurb: "Numeri che crescono con una regola: trovate il prossimo.",
        prompt: "Le luci del palco si accendono a 2, 5, 11, 23 secondi... quando si accendono la volta dopo?",
        options: [
          { id: "a", text: "47 secondi" },
          { id: "b", text: "46 secondi" },
          { id: "c", text: "35 secondi" },
        ],
      },
      {
        id: "palco",
        name: "Parole",
        blurb: "Lettere da togliere e parole da ritrovare.",
        prompt: "Togliendo una sola lettera da PALCO, e lasciando le altre in ordine, quale di queste parole ottieni?",
        options: [
          { id: "palo", text: "Palo" },
          { id: "polo", text: "Polo" },
          { id: "pala", text: "Pala" },
        ],
      },
    ],
    solution: { answers: { ordine: "a", luci: "a", palco: "palo" } },
    explain: "Calcolo: 55 + 8 = 63 € a biglietto, per 4 = 252 €, meno 10 = 242 €. Sequenza: ogni volta il doppio più uno, 23 × 2 + 1 = 47. Parole: togliendo la C resta PALO; POLO e PALA hanno lettere che in PALCO non ci sono due volte.",
  },
  // ---------------------------------------------------------------- difficili
  {
    id: "agguato-in-ufficio",
    difficulty: "difficile",
    title: "Agguato in ufficio",
    traps: [
      {
        id: "ore",
        name: "Calcolo lampo",
        blurb: "Ore e minuti da moltiplicare senza perdersi.",
        prompt: "Lavori 7 ore e 45 minuti al giorno per 5 giorni. Quante ore fai in una settimana?",
        options: [
          { id: "a", text: "38 ore e 45 minuti" },
          { id: "b", text: "37 ore e 45 minuti" },
          { id: "c", text: "38 ore e 15 minuti" },
        ],
      },
      {
        id: "piani",
        name: "Logica",
        blurb: "Persone e piani di un palazzo: chi sta dove?",
        prompt: "Quattro colleghi su quattro piani, uno per piano. Bea sta sopra Ivo ma sotto Sara. Luca non sta all'ultimo piano né a un piano vicino a quello di Ivo. Chi sta più in basso?",
        options: [
          { id: "ivo", text: "Ivo" },
          { id: "luca", text: "Luca" },
          { id: "bea", text: "Bea" },
        ],
      },
      {
        id: "rientro",
        name: "Calendario",
        blurb: "Settimane, fine mese e una data di rientro da trovare.",
        prompt: "Le ferie iniziano lunedì 28 luglio e durano 3 settimane piene. In che data rientri in ufficio, il lunedì dopo?",
        options: [
          { id: "a", text: "18 agosto" },
          { id: "b", text: "17 agosto" },
          { id: "c", text: "19 agosto" },
        ],
      },
    ],
    solution: { answers: { ore: "a", piani: "ivo", rientro: "a" } },
    explain: "Calcolo: 5 × 7 ore = 35 ore, 5 × 45 minuti = 225 minuti = 3 ore e 45: totale 38 ore e 45. Logica: dal basso l'ordine è Ivo, Bea, Luca, Sara (Luca non può stare accanto a Ivo né in cima): più in basso c'è Ivo. Calendario: luglio ha 31 giorni, quindi 21 giorni dopo il 28 luglio è il 18 agosto.",
  },
  {
    id: "imboscata-al-trasloco",
    difficulty: "difficile",
    title: "Imboscata al trasloco",
    traps: [
      {
        id: "noleggio",
        name: "Il conto",
        blurb: "Una tariffa fissa più una a consumo: fate il totale.",
        prompt: "Furgone a noleggio: 50 € fissi più 0,40 € al chilometro. Ne fate 135. Quanto spendete?",
        options: [
          { id: "a", text: "104 €" },
          { id: "b", text: "94 €" },
          { id: "c", text: "114 €" },
        ],
      },
      {
        id: "etichette",
        name: "Logica",
        blurb: "Etichette sbagliate e una sola occhiata per rimettere a posto tutto.",
        prompt: "Tre scatole, tutte con l'etichetta sbagliata: «Libri», «Piatti», «Libri e piatti». In quella «Libri e piatti» trovi solo piatti. Cosa c'è in quella «Libri»?",
        options: [
          { id: "misto", text: "Libri e piatti" },
          { id: "piatti", text: "Solo piatti" },
          { id: "libri", text: "Solo libri" },
        ],
      },
      {
        id: "scatolone",
        name: "Parole",
        blurb: "Lettere contate: quale parola ci sta dentro un'altra?",
        prompt: "Quale di queste parole si scrive con le lettere di SCATOLONE, usando ognuna al massimo tante volte quante compare?",
        options: [
          { id: "salone", text: "Salone" },
          { id: "cantone", text: "Cantone" },
          { id: "costante", text: "Costante" },
        ],
      },
    ],
    solution: { answers: { noleggio: "a", etichette: "misto", scatolone: "salone" } },
    explain: "Conto: 135 × 0,40 = 54 €, più 50 fissi = 104 €. Logica: la scatola «Libri» non può avere solo libri (etichetta sbagliata) né solo piatti (sono già nell'altra): ha libri e piatti. Parole: SALONE ci sta; CANTONE vuole due N e COSTANTE due T, ma SCATOLONE ne ha una sola.",
  },
  {
    id: "agguato-in-autostrada",
    difficulty: "difficile",
    title: "Agguato in autostrada",
    traps: [
      {
        id: "benzina",
        name: "Calcolo lampo",
        blurb: "Consumi, prezzi e chilometri: il conto del pieno.",
        prompt: "L'auto fa 18 km con un litro e la benzina costa 1,80 € al litro. Quanto spendete per 450 km?",
        options: [
          { id: "a", text: "45 €" },
          { id: "b", text: "40,50 €" },
          { id: "c", text: "48,60 €" },
        ],
      },
      {
        id: "arrivo",
        name: "Orari",
        blurb: "Velocità media, soste e orologio: a che ora si arriva?",
        prompt: "Partite alle 8:50 per 450 km a 90 km/h di media, con una sosta di 25 minuti. A che ora arrivate?",
        options: [
          { id: "a", text: "14:15" },
          { id: "b", text: "13:50" },
          { id: "c", text: "14:05" },
        ],
      },
      {
        id: "sinceri",
        name: "Logica",
        blurb: "Chi dice sempre il vero e chi mente sempre: un indovinello.",
        prompt: "Ognuno dei due amici dice sempre il vero o mente sempre. Ivo dice: «Almeno uno di noi due mente sempre». Che cosa sono Ivo e l'amico?",
        options: [
          { id: "ivo-sincero", text: "Ivo sincero, l'amico bugiardo" },
          { id: "ivo-bugiardo", text: "Ivo bugiardo, l'amico sincero" },
          { id: "entrambi", text: "Tutti e due sinceri" },
        ],
      },
    ],
    solution: { answers: { benzina: "a", arrivo: "a", sinceri: "ivo-sincero" } },
    explain: "Calcolo: 450 ÷ 18 = 25 litri, per 1,80 = 45 €. Orari: 450 ÷ 90 = 5 ore di guida più 25 minuti, dalle 8:50 si arriva alle 14:15. Logica: se Ivo mentisse, la sua frase sarebbe vera (lui stesso mente): impossibile. Quindi Ivo è sincero e, visto che almeno uno mente, mente l'amico.",
  },
  {
    id: "imboscata-al-ristorante",
    difficulty: "difficile",
    title: "Imboscata al ristorante",
    traps: [
      {
        id: "mancia",
        name: "Il conto",
        blurb: "Un conto, una percentuale e una divisione al centesimo.",
        prompt: "Il conto è 168 €. Aggiungete il 10% di mancia e dividete in 7. Quanto paga ognuno?",
        options: [
          { id: "a", text: "26,40 €" },
          { id: "b", text: "24,00 €" },
          { id: "c", text: "25,40 €" },
        ],
      },
      {
        id: "numeri",
        name: "Sequenza",
        blurb: "Numeri in fila: scoprite la regola e il prossimo.",
        prompt: "3, 5, 9, 17, 33... qual è il numero successivo?",
        options: [
          { id: "a", text: "65" },
          { id: "b", text: "49" },
          { id: "c", text: "66" },
        ],
      },
      {
        id: "prenotazione",
        name: "Calendario",
        blurb: "Un mese che finisce e un giorno della settimana da trovare.",
        prompt: "Oggi è martedì 18 e questo mese ha 30 giorni. Prenotate per il 1° del mese prossimo: che giorno della settimana è?",
        options: [
          { id: "lunedi", text: "Lunedì" },
          { id: "domenica", text: "Domenica" },
          { id: "martedi", text: "Martedì" },
        ],
      },
    ],
    solution: { answers: { mancia: "a", numeri: "a", prenotazione: "lunedi" } },
    explain: "Conto: 168 + 16,80 = 184,80 €, diviso 7 = 26,40 €. Sequenza: le differenze raddoppiano (2, 4, 8, 16), ora +32: 33 + 32 = 65. Calendario: martedì 18, martedì 25, poi il 30 è domenica e il 1° del mese dopo è lunedì.",
  },
];

export default varianti;
