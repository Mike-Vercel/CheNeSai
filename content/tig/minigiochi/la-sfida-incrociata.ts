import type { IncrociataInput } from "@/lib/tig/games/mechanics/la-sfida-incrociata";

/**
 * 28 · LA SFIDA INCROCIATA — griglie 4×4 a soluzione UNICA (verificata dallo schema con una ricerca esaustiva).
 * Simboli: 1 boccale, 2 pizza, 3 dado, 4 nota. Caselle date: 16 caratteri riga per riga, 0 = vuota.
 * Più caselle vuote = più difficile (6–7 facile, 8–10 media, 10–12 difficile).
 */
const SPECULARE = "Il tavolo rivale aveva la stessa griglia con le colonne rovesciate: stessa fatica, soluzione da non copiare.";

const varianti: IncrociataInput[] = [
  {
    id: "tavolo-perfetto",
    difficulty: "facile",
    theme: "Il tavolo perfetto",
    givens: "3412124000044020",
    solution: { grid: "3412124321344321" },
    explain: `Nella seconda riga manca solo il dado; poi colonne e riquadri si chiudono uno dopo l'altro per esclusione. ${SPECULARE}`,
  },
  {
    id: "serata-giochi",
    difficulty: "facile",
    theme: "Serata giochi in salotto",
    givens: "3401013000031342",
    solution: { grid: "3421213442131342" },
    explain: `Nella prima riga manca solo la pizza; da lì ogni colonna ha un solo posto libero per simbolo. ${SPECULARE}`,
  },
  {
    id: "pizza-e-birra",
    difficulty: "facile",
    theme: "Pizza e birra",
    givens: "0100030212043021",
    solution: { grid: "2143431212343421" },
    explain: `Nella seconda colonna manca solo la nota; poi le righe con tre simboli si completano da sole. ${SPECULARE}`,
  },
  {
    id: "karaoke",
    difficulty: "facile",
    theme: "La sera del karaoke",
    givens: "1000403134100140",
    solution: { grid: "1324423134122143" },
    explain: `Nella prima colonna manca solo la pizza; seconda e terza riga hanno un solo buco ciascuna. ${SPECULARE}`,
  },
  {
    id: "torneo-dadi",
    difficulty: "media",
    theme: "Il torneo di dadi",
    givens: "1003001230202001",
    solution: { grid: "1243431231242431" },
    explain: `Nella prima colonna manca solo la nota; poi i riquadri 2×2 dicono dove vanno pizza e dado. ${SPECULARE}`,
  },
  {
    id: "jam-session",
    difficulty: "media",
    theme: "Jam session al pub",
    givens: "3014040020010030",
    solution: { grid: "3214142323414132" },
    explain: `Nella prima riga manca solo la pizza; da quella colonna in poi si procede per esclusione riquadro per riquadro. ${SPECULARE}`,
  },
  {
    id: "brindisi",
    difficulty: "media",
    theme: "Il giro di brindisi",
    givens: "0231000004230004",
    solution: { grid: "4231314214232314" },
    explain: `Nella prima riga manca solo la nota, e anche la terza ha un solo buco; poi colonne e riquadri fanno il resto. ${SPECULARE}`,
  },
  {
    id: "consegna-notturna",
    difficulty: "media",
    theme: "Consegne di mezzanotte",
    givens: "0400030000023014",
    solution: { grid: "1423234141323214" },
    explain: `Nell'ultima riga manca solo la pizza; poi la terza riga e le colonne si sistemano per esclusione. ${SPECULARE}`,
  },
  {
    id: "dj-set",
    difficulty: "difficile",
    theme: "Il DJ set",
    givens: "0001200043020003",
    solution: { grid: "3421213443121243" },
    explain: `Nella terza riga manca solo il boccale; con quello si sbloccano la prima colonna e i riquadri in basso. ${SPECULARE}`,
  },
  {
    id: "quiz-del-giovedi",
    difficulty: "difficile",
    theme: "Il quiz del giovedì",
    givens: "0310100430000000",
    solution: { grid: "4312123434212143" },
    explain: `Nella prima riga mancano nota e pizza: la nota non può andare nell'ultima colonna, che ne ha già una subito sotto, quindi va nella prima. Poi tutto segue riquadro per riquadro. ${SPECULARE}`,
  },
  {
    id: "partita-a-carte",
    difficulty: "difficile",
    theme: "La partita a carte",
    givens: "0012200330000000",
    solution: { grid: "4312214334211234" },
    explain: `Nella prima riga mancano nota e dado: il dado non può andare nella prima colonna, che ne ha già uno più in basso, quindi la prima casella è la nota. Poi si chiude per esclusione. ${SPECULARE}`,
  },
  {
    id: "festa-a-sorpresa",
    difficulty: "difficile",
    theme: "La festa a sorpresa",
    givens: "0400001000300300",
    solution: { grid: "1423321441322341" },
    explain: `Solo quattro simboli dati: si parte dai due dadi, che tolgono il dado a due righe e due colonne, e si procede per esclusione fino all'unica soluzione. ${SPECULARE}`,
  },
];

export default varianti;
