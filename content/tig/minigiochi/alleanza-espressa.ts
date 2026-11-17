import type { AlleanzaInput } from "@/lib/tig/games/mechanics/alleanza-espressa";

/**
 * 46 · ALLEANZA ESPRESSA — una griglia (le cifre le genera il seme della prova, diverse per ogni alleanza) e quattro
 * coordinate, scritte in modo semplice o come piccoli indovinelli. Le varianti difficili aggiungono un passaggio
 * finale che sta solo nella metà della griglia: senza parlarsi davvero non si arriva al codice.
 */
const ABCD = ["A", "B", "C", "D"];
const N4 = ["1", "2", "3", "4"];

const varianti: AlleanzaInput[] = [
  {
    id: "armadietto",
    difficulty: "facile",
    title: "Il lucchetto dell'armadietto",
    rows: ABCD,
    cols: N4,
    steps: [
      { row: 1, col: 2, clue: "Riga B, colonna 3" },
      { row: 3, col: 0, clue: "Riga D, colonna 1" },
      { row: 0, col: 3, clue: "Riga A, colonna 4" },
      { row: 2, col: 1, clue: "Riga C, colonna 2" },
    ],
    explain: "Chi aveva le coordinate doveva leggerle all'alleato, chi aveva la griglia rispondere con le cifre: B3, D1, A4, C2. Nessuno dei due poteva farcela da solo.",
  },
  {
    id: "turni-coinquilino",
    difficulty: "media",
    title: "Il calendario dei turni di casa",
    rows: ["Lunedì", "Martedì", "Mercoledì", "Giovedì"],
    cols: ["Mattina", "Pranzo", "Sera", "Notte"],
    steps: [
      { row: 1, col: 2, clue: "Il giorno dopo lunedì, all'ora di cena" },
      { row: 3, col: 0, clue: "L'ultimo giorno della tabella, appena svegli" },
      { row: 0, col: 3, clue: "Il primo giorno, quando tutti dormono" },
      { row: 2, col: 1, clue: "A metà settimana, all'ora di pranzo" },
    ],
    explain: "Gli indovinelli portavano a martedì sera, giovedì mattina, lunedì notte e mercoledì a pranzo. Le cifre erano solo nella griglia dell'altro tavolo.",
  },
  {
    id: "cassaforte-festival",
    difficulty: "facile",
    title: "La cassaforte del bar del festival",
    rows: ["A", "B", "C", "D", "E"],
    cols: ["1", "2", "3", "4", "5"],
    steps: [
      { row: 4, col: 1, clue: "Casella E2" },
      { row: 0, col: 4, clue: "Casella A5" },
      { row: 2, col: 2, clue: "Casella C3" },
      { row: 1, col: 0, clue: "Casella B1" },
    ],
    explain: "Griglia più grande ma coordinate dirette: E2, A5, C3, B1. Vinceva la coppia che si parlava in modo ordinato, una cifra alla volta.",
  },
  {
    id: "garage",
    difficulty: "media",
    title: "Il codice del garage",
    rows: ["Piano -1", "Piano 0", "Piano 1", "Piano 2"],
    cols: ["Rosso", "Verde", "Blu", "Giallo"],
    steps: [
      { row: 0, col: 1, clue: "Il piano sotto terra, settore verde" },
      { row: 3, col: 0, clue: "Il piano più alto, settore rosso" },
      { row: 1, col: 3, clue: "Il piano terra, settore giallo" },
      { row: 2, col: 2, clue: "Il primo piano, settore blu" },
    ],
    explain: "Sotto terra è il piano -1, il più alto è il 2, il piano terra è lo 0. Le coordinate erano a parole: bisognava tradurle prima di chiedere le cifre.",
  },
  {
    id: "menu-settimana",
    difficulty: "media",
    title: "Il menù della mensa aziendale",
    rows: ["Pizza", "Pasta", "Insalata", "Dolce"],
    cols: ["Lunedì", "Martedì", "Mercoledì", "Giovedì"],
    steps: [
      { row: 1, col: 0, clue: "Il primo piatto di pasta della settimana" },
      { row: 3, col: 3, clue: "Il dolce dell'ultimo giorno in tabella" },
      { row: 0, col: 2, clue: "La pizza di metà settimana" },
      { row: 2, col: 1, clue: "L'insalata del giorno dopo lunedì" },
    ],
    explain: "Pasta del lunedì, dolce del giovedì, pizza del mercoledì, insalata del martedì: quattro caselle, e le cifre stavano tutte dall'altra parte.",
  },
  {
    id: "lucchetto-palestra",
    difficulty: "difficile",
    title: "Il lucchetto della palestra",
    rows: ABCD,
    cols: N4,
    steps: [
      { row: 0, col: 1, clue: "Riga A, colonna 2" },
      { row: 3, col: 2, clue: "Riga D, colonna 3" },
      { row: 1, col: 3, clue: "Riga B, colonna 4" },
      { row: 2, col: 0, clue: "Riga C, colonna 1" },
    ],
    transform: { op: "piu-uno", text: "Ultimo passaggio: aggiungete 1 a ogni cifra (il 9 diventa 0)." },
    explain: "Le coordinate erano facili, ma l'ultimo passaggio era scritto solo nella metà della griglia: ogni cifra andava aumentata di 1. Chi non l'ha detto all'alleato ha mandato un codice sbagliato.",
  },
  {
    id: "cassetta-lettere",
    difficulty: "difficile",
    title: "La cassetta delle lettere del condominio",
    rows: ["Scala A", "Scala B", "Scala C", "Scala D"],
    cols: ["Interno 1", "Interno 2", "Interno 3", "Interno 4"],
    steps: [
      { row: 2, col: 3, clue: "La terza scala, l'ultimo interno" },
      { row: 0, col: 0, clue: "La prima scala, il primo interno" },
      { row: 3, col: 1, clue: "L'ultima scala, il secondo interno" },
      { row: 1, col: 2, clue: "La scala B, il penultimo interno" },
    ],
    transform: { op: "inverti", text: "Ultimo passaggio: scrivete il codice al contrario (l'ultima cifra trovata va per prima)." },
    explain: "Indovinelli su scale e interni, poi il codice andava rovesciato: l'istruzione stava solo nella metà della griglia. Serviva fiducia reciproca, e in fretta.",
  },
  {
    id: "biblioteca",
    difficulty: "media",
    title: "Il lucchetto della libreria di casa",
    rows: ["Gialli", "Viaggi", "Cucina", "Fumetti"],
    cols: ["Ripiano 1", "Ripiano 2", "Ripiano 3", "Ripiano 4"],
    steps: [
      { row: 2, col: 1, clue: "Il secondo ripiano dei libri di cucina" },
      { row: 0, col: 3, clue: "L'ultimo ripiano dei gialli" },
      { row: 3, col: 0, clue: "Il primo ripiano dei fumetti" },
      { row: 1, col: 2, clue: "Il terzo ripiano dei libri di viaggio" },
    ],
    explain: "Cucina al secondo ripiano, gialli all'ultimo, fumetti al primo, viaggi al terzo. Le parole erano facili: il difficile era non perdere l'ordine delle cifre.",
  },
  {
    id: "orari-bus",
    difficulty: "difficile",
    title: "Il codice della biglietteria",
    rows: ["Ore 6", "Ore 9", "Ore 12", "Ore 15", "Ore 18"],
    cols: ["Linea 1", "Linea 2", "Linea 3", "Linea 4", "Linea 5"],
    steps: [
      { row: 2, col: 2, clue: "La linea di mezzo, all'ora di pranzo" },
      { row: 0, col: 4, clue: "La prima corsa della mattina sull'ultima linea" },
      { row: 3, col: 0, clue: "La linea 1 alle tre del pomeriggio" },
      { row: 4, col: 1, clue: "L'ultima corsa in tabella della linea 2" },
    ],
    explain: "La linea di mezzo è la 3, l'ora di pranzo le 12; l'ultima linea è la 5; le tre del pomeriggio sono le 15; l'ultima corsa è alle 18. Griglia 5 per 5 e indovinelli: la versione più dura.",
  },
  {
    id: "albergo",
    difficulty: "facile",
    title: "La cassaforte della camera d'albergo",
    rows: ["Piano 1", "Piano 2", "Piano 3", "Piano 4"],
    cols: ["Camera A", "Camera B", "Camera C", "Camera D"],
    steps: [
      { row: 2, col: 1, clue: "Piano 3, camera B" },
      { row: 0, col: 3, clue: "Piano 1, camera D" },
      { row: 3, col: 0, clue: "Piano 4, camera A" },
      { row: 1, col: 2, clue: "Piano 2, camera C" },
    ],
    explain: "Coordinate dirette: piano 3 camera B, piano 1 camera D, piano 4 camera A, piano 2 camera C. Bastava dettarle nell'ordine giusto.",
  },
];

export default varianti;
