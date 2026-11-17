import type { ParolaInput } from "@/lib/tig/games/mechanics/ultima-parola";

/**
 * 32 · ULTIMA PAROLA — indovinelli originali a pezzi: i primi pezzi vanno bene per più risposte, gli ultimi ne
 * lasciano una sola. La frase finisce sempre con «Si chiama», così l'articolo non tradisce la risposta.
 */
const varianti: ParolaInput[] = [
  {
    id: "chiave",
    difficulty: "facile",
    chunks: ["Ha i denti", "ma non morde,", "sta in tasca o in borsa,", "sparisce sempre quando sei in ritardo", "e senza di lei la porta di casa non si apre.", "Si chiama…"],
    options: [
      { id: "chiave", text: "Chiave" },
      { id: "forchetta", text: "Forchetta" },
      { id: "cerniera", text: "Cerniera" },
      { id: "pettine", text: "Pettine" },
    ],
    solution: { optionId: "chiave" },
    explain: "Denti ne hanno tutte e quattro; in tasca ci stanno pettine e chiave, ma solo la chiave apre la porta di casa (e sparisce quando sei in ritardo).",
  },
  {
    id: "ombrello",
    difficulty: "facile",
    chunks: ["Ha le stecche", "ma non è un ventaglio,", "si apre quando il cielo si fa grigio,", "lo dimentichi sempre al bar", "e col vento forte si gira al contrario.", "Si chiama…"],
    options: [
      { id: "ombrello", text: "Ombrello" },
      { id: "ventaglio", text: "Ventaglio" },
      { id: "impermeabile", text: "Impermeabile" },
      { id: "tenda", text: "Tenda da sole" },
    ],
    solution: { optionId: "ombrello" },
    explain: "Le stecche le hanno ombrello, ventaglio e tenda; il ventaglio è escluso subito, e solo l'ombrello si dimentica al bar e si gira al contrario col vento.",
  },
  {
    id: "sveglia",
    difficulty: "facile",
    chunks: ["Ti parla tutte le mattine", "sempre alla stessa ora,", "la odi più di chiunque,", "le chiedi sempre altri cinque minuti", "e lei, puntuale, ricomincia.", "Si chiama…"],
    options: [
      { id: "sveglia", text: "Sveglia" },
      { id: "coinquilina", text: "Coinquilina" },
      { id: "radio", text: "Radio" },
      { id: "caffettiera", text: "Caffettiera" },
    ],
    solution: { optionId: "sveglia" },
    explain: "Parla al mattino e sempre alla stessa ora: radio o sveglia. Ma i «cinque minuti in più» si chiedono solo alla sveglia, che poi suona di nuovo.",
  },
  {
    id: "frigorifero",
    difficulty: "media",
    chunks: ["È freddo", "ma non è antipatico,", "lo apri anche quando non hai fame,", "fissi il suo interno sperando in un miracolo", "e dentro ha sempre la luce accesa.", "Si chiama…"],
    options: [
      { id: "frigorifero", text: "Frigorifero" },
      { id: "condizionatore", text: "Condizionatore" },
      { id: "armadio", text: "Armadio" },
      { id: "forno", text: "Forno" },
    ],
    solution: { optionId: "frigorifero" },
    explain: "Freddo è anche il condizionatore, ma non lo apri per guardarci dentro «sperando in un miracolo» quando hai fame: è il frigorifero, con la sua lucina.",
  },
  {
    id: "password",
    difficulty: "media",
    chunks: ["La scegli tu", "e poi te la dimentichi,", "vuole maiuscole, numeri e un simbolo,", "non va detta a nessuno", "e se la sbagli tre volte ti blocca tutto.", "Si chiama…"],
    options: [
      { id: "password", text: "Password" },
      { id: "chiave", text: "Chiave" },
      { id: "firma", text: "Firma" },
      { id: "serratura", text: "Serratura" },
    ],
    solution: { optionId: "password" },
    explain: "La scegli tu e la dimentichi: password o firma. Maiuscole, numeri, simboli e il blocco dopo tre errori lasciano solo la password.",
  },
  {
    id: "specchio",
    difficulty: "media",
    chunks: ["Ti guarda", "ma non ti vede,", "fa tutto quello che fai tu", "ma al contrario,", "e in bagno, la mattina, non mente mai.", "Si chiama…"],
    options: [
      { id: "specchio", text: "Specchio" },
      { id: "fotografia", text: "Fotografia" },
      { id: "finestra", text: "Finestra" },
      { id: "ombra", text: "Ombra" },
    ],
    solution: { optionId: "specchio" },
    explain: "Ti imitano sia l'ombra sia lo specchio, ma solo lo specchio lo fa «al contrario», destra e sinistra scambiate, e ti aspetta in bagno ogni mattina.",
  },
  {
    id: "calzino",
    difficulty: "media",
    chunks: ["Va sempre in coppia,", "ma in lavatrice", "uno dei due sparisce,", "vive dentro la scarpa", "e d'inverno lo vuoi di lana.", "Si chiama…"],
    options: [
      { id: "calzino", text: "Calzino" },
      { id: "guanto", text: "Guanto" },
      { id: "orecchino", text: "Orecchino" },
      { id: "scarpa", text: "Scarpa" },
    ],
    solution: { optionId: "calzino" },
    explain: "In coppia vanno tutti; in lavatrice si perdono calzini e guanti, ma dentro la scarpa ci va solo il calzino.",
  },
  {
    id: "eco",
    difficulty: "difficile",
    chunks: ["Parla", "solo dopo di te,", "ripete le ultime parole,", "abita tra le montagne", "e nelle stanze vuote.", "Si chiama…"],
    options: [
      { id: "eco", text: "Eco" },
      { id: "pappagallo", text: "Pappagallo" },
      { id: "registratore", text: "Registratore" },
      { id: "vento", text: "Vento" },
    ],
    solution: { optionId: "eco" },
    explain: "Parlano dopo di te e ripetono anche il pappagallo e il registratore, ma tra le montagne e nelle stanze vuote ti risponde solo l'eco.",
  },
  {
    id: "candela",
    difficulty: "difficile",
    chunks: ["Più vive", "e più si accorcia,", "piange cera", "e ha la testa che brucia;", "alle cene romantiche non manca mai.", "Si chiama…"],
    options: [
      { id: "candela", text: "Candela" },
      { id: "sigaretta", text: "Sigaretta" },
      { id: "matita", text: "Matita" },
      { id: "fiammifero", text: "Fiammifero" },
    ],
    solution: { optionId: "candela" },
    explain: "Si accorciano usandole candela, sigaretta e matita; ma a «piangere cera» è solo la candela, regina delle cene romantiche.",
  },
  {
    id: "ombra",
    difficulty: "difficile",
    chunks: ["Ti segue ovunque", "ma non fa rumore,", "la mattina è lunga,", "a mezzogiorno quasi sparisce", "e al buio non c'è più.", "Si chiama…"],
    options: [
      { id: "ombra", text: "Ombra" },
      { id: "gatto", text: "Gatto" },
      { id: "riflesso", text: "Riflesso" },
      { id: "eco", text: "Eco" },
    ],
    solution: { optionId: "ombra" },
    explain: "Ti segue in silenzio anche il gatto, ma lunga al mattino, cortissima a mezzogiorno e sparita al buio è l'ombra, che dipende dal sole.",
  },
  {
    id: "buco",
    difficulty: "difficile",
    chunks: ["Più ne togli", "e più diventa grande,", "lo trovi in certi formaggi,", "in mezzo alla ciambella", "e nella cintura, quando ne serve uno nuovo.", "Si chiama…"],
    options: [
      { id: "buco", text: "Buco" },
      { id: "fosso", text: "Fosso" },
      { id: "vuoto", text: "Vuoto" },
      { id: "debito", text: "Debito" },
    ],
    solution: { optionId: "buco" },
    explain: "«Più ne togli e più cresce» vale per buco, fosso e vuoto; nel formaggio, nella ciambella e nella cintura però c'è solo il buco.",
  },
  {
    id: "domani",
    difficulty: "difficile",
    chunks: ["Arriva sempre", "ma non arriva mai,", "è il giorno perfetto", "per cominciare la dieta", "e per rispondere alle email.", "Si chiama…"],
    options: [
      { id: "domani", text: "Domani" },
      { id: "lunedi", text: "Lunedì" },
      { id: "weekend", text: "Weekend" },
      { id: "futuro", text: "Futuro" },
    ],
    solution: { optionId: "domani" },
    explain: "Il lunedì della dieta prima o poi arriva davvero; domani no: quando arriva è già oggi. Ed è il giorno in cui si rimanda tutto, email comprese.",
  },
];

export default varianti;
