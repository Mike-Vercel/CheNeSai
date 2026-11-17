import type { AllineamentoInput } from "@/lib/tig/games/mechanics/allineamento-perfetto";

/**
 * 44 · ALLINEAMENTO PERFETTO — domande da «punto d'incontro»: nessuna risposta giusta, vince chi converge con
 * gli altri tavoli. Le spiegazioni raccontano perché alcune scelte attirano più delle altre, senza garanzie.
 */
const varianti: AllineamentoInput[] = [
  {
    id: "numero-uno-nove",
    difficulty: "facile",
    prompt: "Scegliete un numero da 1 a 9. Vince chi sceglie lo stesso numero degli altri tavoli.",
    options: ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => ({ id: `n${n}`, text: n })),
    explain: "Quando si deve indovinare un numero «di tutti» vincono gli estremi e i numeri simbolici: l'1 perché è il primo, il 7 perché è il preferito di molti, il 5 perché sta nel mezzo.",
  },
  {
    id: "punto-di-incontro",
    difficulty: "media",
    prompt: "Vi siete persi in una città sconosciuta, senza telefono. Dove andate per ritrovarvi?",
    options: [
      { id: "stazione", text: "La stazione" },
      { id: "piazza", text: "La piazza principale" },
      { id: "duomo", text: "Davanti alla chiesa più grande" },
      { id: "informazioni", text: "L'ufficio informazioni" },
      { id: "bar", text: "Il primo bar che si vede" },
      { id: "fontana", text: "La fontana più famosa" },
    ],
    explain: "È il classico esperimento del punto d'incontro: senza accordarsi, quasi tutti scelgono il luogo più «ovvio» della città. Piazza principale e stazione si contendono il primo posto.",
  },
  {
    id: "ora-senza-ora",
    difficulty: "media",
    prompt: "Appuntamento domani in centro, ma nessuno ha detto l'ora. A che ora vi presentate?",
    options: [
      { id: "h10", text: "Alle 10" },
      { id: "h12", text: "A mezzogiorno" },
      { id: "h15", text: "Alle 15" },
      { id: "h18", text: "Alle 18" },
      { id: "h19", text: "Alle 19, per l'aperitivo" },
      { id: "h21", text: "Alle 21" },
    ],
    explain: "Mezzogiorno è il punto d'incontro più citato negli esperimenti, ma in un pub l'ora dell'aperitivo ha un'attrazione speciale: bisognava capire quale pensiero avrebbero fatto gli altri.",
  },
  {
    id: "colore",
    difficulty: "facile",
    prompt: "Scegliete un colore. Vince il colore scelto da più tavoli.",
    options: [
      { id: "rosso", text: "Rosso" },
      { id: "blu", text: "Blu" },
      { id: "verde", text: "Verde" },
      { id: "giallo", text: "Giallo" },
      { id: "nero", text: "Nero" },
      { id: "bianco", text: "Bianco" },
      { id: "viola", text: "Viola" },
    ],
    explain: "Il blu è spesso il colore preferito dichiarato, il rosso quello che viene in mente per primo. Chi cerca la convergenza sceglie tra questi due, chi segue il gusto si disperde.",
  },
  {
    id: "piatto-comune",
    difficulty: "facile",
    prompt: "Dovete ordinare tutti la stessa cosa senza parlarvi. Cosa ordinate?",
    options: [
      { id: "pizza", text: "Pizza" },
      { id: "hamburger", text: "Hamburger" },
      { id: "sushi", text: "Sushi" },
      { id: "pasta", text: "Pasta" },
      { id: "panino", text: "Panino" },
      { id: "insalata", text: "Insalata" },
    ],
    explain: "La pizza è la risposta che tutti si aspettano dagli altri: proprio per questo è il punto d'incontro perfetto, anche per chi stasera avrebbe preferito altro.",
  },
  {
    id: "giorno-rimpatriata",
    difficulty: "media",
    prompt: "Rimpatriata con vecchi amici: che giorno scegliete, sperando che lo scelgano anche gli altri?",
    options: [
      { id: "lun", text: "Lunedì" },
      { id: "mar", text: "Martedì" },
      { id: "mer", text: "Mercoledì" },
      { id: "gio", text: "Giovedì" },
      { id: "ven", text: "Venerdì" },
      { id: "sab", text: "Sabato" },
      { id: "dom", text: "Domenica" },
    ],
    explain: "Sabato è il giorno della festa per definizione, venerdì quello di chi lavora il sabato mattina. Per convergere bisognava pensare al giorno più «ovvio», non al più comodo.",
  },
  {
    id: "lettera",
    difficulty: "difficile",
    prompt: "Scegliete una lettera. Vince la lettera scelta da più tavoli.",
    options: [
      { id: "a", text: "A" },
      { id: "e", text: "E" },
      { id: "m", text: "M" },
      { id: "r", text: "R" },
      { id: "s", text: "S" },
      { id: "x", text: "X" },
      { id: "z", text: "Z" },
    ],
    explain: "La A è la prima dell'alfabeto e attira chi ragiona sul punto d'incontro; la X e la Z attirano chi vuole fare l'originale. Qui convergere è difficile perché ognuno pensa che gli altri pensino diverso.",
  },
  {
    id: "stemma",
    difficulty: "media",
    prompt: "Il pub deve scegliere l'animale del suo stemma. Quale scegliete, sperando che lo scelgano tutti?",
    options: [
      { id: "leone", text: "Leone" },
      { id: "aquila", text: "Aquila" },
      { id: "lupo", text: "Lupo" },
      { id: "orso", text: "Orso" },
      { id: "gufo", text: "Gufo" },
      { id: "gatto", text: "Gatto" },
    ],
    explain: "Il leone è lo stemma per eccellenza, l'orso e il gufo hanno l'aria da pub. Chi ha scelto con la testa del locale ha puntato sul più classico.",
  },
  {
    id: "cifra-tonda",
    difficulty: "difficile",
    prompt: "Dovete dire tutti la stessa cifra in euro. Quale scegliete?",
    options: [
      { id: "e1", text: "1 euro" },
      { id: "e5", text: "5 euro" },
      { id: "e10", text: "10 euro" },
      { id: "e13", text: "13 euro" },
      { id: "e50", text: "50 euro" },
      { id: "e99", text: "99 euro" },
      { id: "e100", text: "100 euro" },
    ],
    explain: "Le cifre tonde attirano: 10 e 100 sono i punti d'incontro più forti, l'1 piace a chi parte dall'inizio. Il 13 e il 99 sono trappole per chi vuole fare il furbo.",
  },
  {
    id: "posto-al-cinema",
    difficulty: "difficile",
    prompt: "Appuntamento «al solito posto» in un cinema vuoto, ma un solito posto non c'è. Dove vi sedete?",
    options: [
      { id: "centro", text: "Al centro della sala" },
      { id: "prima", text: "Prima fila, al centro" },
      { id: "ultima", text: "Ultima fila, al centro" },
      { id: "uscita", text: "Vicino all'uscita" },
      { id: "corridoio", text: "Sul corridoio, a metà sala" },
      { id: "angolo", text: "In fondo a sinistra" },
    ],
    explain: "Il centro della sala è il punto più «naturale», ma l'ultima fila ha i suoi fedelissimi. Convergere significa scegliere il posto che chiunque troverebbe senza spiegazioni.",
  },
];

export default varianti;
