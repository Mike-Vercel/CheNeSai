import type { FalsoInput } from "@/lib/tig/games/mechanics/falso-vantaggio";

/**
 * 31 · FALSO VANTAGGIO — l'enigma chiuso nella busta ENIGMA: abbastanza duro da far pensare due volte prima di
 * lasciare la busta SUBITO, ma risolvibile in 30 secondi con un ragionamento spiegabile in una frase.
 */
const varianti: FalsoInput[] = [
  {
    id: "chi-dice-il-vero",
    difficulty: "difficile",
    prompt: "Ale dice: «Bea mente». Bea dice: «Ciro mente». Ciro dice: «Ale e Bea mentono tutti e due». Chi dice la verità?",
    options: [
      { id: "a", text: "Solo Ale" },
      { id: "b", text: "Solo Bea" },
      { id: "c", text: "Solo Ciro" },
      { id: "d", text: "Ale e Ciro" },
    ],
    solution: { optionId: "b" },
    explain: "Se Ale dicesse il vero, Bea mentirebbe e Ciro direbbe il vero; ma Ciro sostiene che Ale mente: contraddizione. Quindi Ale mente, Bea dice il vero e Ciro mente, come dice Bea.",
  },
  {
    id: "panino-bibita",
    difficulty: "media",
    prompt: "Un panino e una bibita costano 5,50 € in tutto. Il panino costa 4 € più della bibita. Quanto costa la bibita?",
    options: [
      { id: "a", text: "0,50 €" },
      { id: "b", text: "0,75 €" },
      { id: "c", text: "1,00 €" },
      { id: "d", text: "1,50 €" },
    ],
    solution: { optionId: "b" },
    explain: "Bibita 0,75 € e panino 4,75 €: insieme 5,50 €. La risposta istintiva, 1,50 €, darebbe un panino da 5,50 € e un totale di 7 €.",
  },
  {
    id: "calzini-rossi",
    difficulty: "difficile",
    prompt: "Nel cassetto, al buio, ci sono 3 calzini rossi, 3 blu e 3 verdi. Quanti ne devi prendere, al minimo, per avere di sicuro due calzini ROSSI?",
    options: [
      { id: "a", text: "4" },
      { id: "b", text: "6" },
      { id: "c", text: "8" },
      { id: "d", text: "9" },
    ],
    solution: { optionId: "c" },
    explain: "Nel caso peggiore escono prima tutti i 3 blu e i 3 verdi, più un rosso: 7 calzini e un solo rosso. L'ottavo è per forza rosso.",
  },
  {
    id: "lancette-tre-e-un-quarto",
    difficulty: "difficile",
    prompt: "Un orologio a lancette segna le 3:15. Quanti gradi ci sono tra la lancetta delle ore e quella dei minuti?",
    options: [
      { id: "a", text: "0°" },
      { id: "b", text: "7,5°" },
      { id: "c", text: "15°" },
      { id: "d", text: "30°" },
    ],
    solution: { optionId: "b" },
    explain: "I minuti sono esattamente sul 3. La lancetta delle ore però è andata avanti di un quarto dello spazio tra il 3 e il 4 (30°): un quarto di 30° fa 7,5°.",
  },
  {
    id: "volo-bagaglio",
    difficulty: "facile",
    prompt: "Il volo costa 80 € più 20 € di bagaglio. Hai uno sconto del 10% solo sul volo. Quanto paghi in tutto?",
    options: [
      { id: "a", text: "82 €" },
      { id: "b", text: "90 €" },
      { id: "c", text: "92 €" },
      { id: "d", text: "100 €" },
    ],
    solution: { optionId: "c" },
    explain: "Il 10% di 80 € è 8 €: il volo costa 72 €, più 20 € di bagaglio fa 92 €. Lo sconto non tocca il bagaglio.",
  },
  {
    id: "giorno-libero",
    difficulty: "media",
    prompt: "Il coinquilino dice: «Ieri era il giorno dopo il mio giorno libero, e domani è venerdì». Qual è il suo giorno libero?",
    options: [
      { id: "a", text: "Lunedì" },
      { id: "b", text: "Martedì" },
      { id: "c", text: "Mercoledì" },
      { id: "d", text: "Giovedì" },
    ],
    solution: { optionId: "b" },
    explain: "Se domani è venerdì, oggi è giovedì e ieri era mercoledì. Mercoledì è il giorno dopo il giorno libero: martedì.",
  },
  {
    id: "pasta-per-otto",
    difficulty: "media",
    prompt: "La ricetta per 6 persone vuole 450 grammi di pasta. Quanti grammi servono per 8 persone?",
    options: [
      { id: "a", text: "500" },
      { id: "b", text: "600" },
      { id: "c", text: "650" },
      { id: "d", text: "900" },
    ],
    solution: { optionId: "b" },
    explain: "450 ÷ 6 = 75 grammi a testa; per 8 persone 8 × 75 = 600 grammi.",
  },
  {
    id: "triangoli-nascosti",
    difficulty: "facile",
    prompt: "Disegni un triangolo e poi una linea dritta da un vertice fino al lato opposto. Quanti triangoli ci sono adesso nel disegno?",
    options: [
      { id: "a", text: "2" },
      { id: "b", text: "3" },
      { id: "c", text: "4" },
      { id: "d", text: "5" },
    ],
    solution: { optionId: "b" },
    explain: "I due triangoli piccoli creati dalla linea, più quello grande di partenza, che c'è ancora: 3.",
  },
  {
    id: "scarpe-scontate",
    difficulty: "facile",
    prompt: "Dopo uno sconto del 25% un paio di scarpe costa 60 €. Quanto costava prima dello sconto?",
    options: [
      { id: "a", text: "75 €" },
      { id: "b", text: "80 €" },
      { id: "c", text: "85 €" },
      { id: "d", text: "90 €" },
    ],
    solution: { optionId: "b" },
    explain: "60 € sono il 75% del prezzo pieno: 60 ÷ 0,75 = 80 €. Aggiungere il 25% a 60 (75 €) è la trappola.",
  },
  {
    id: "chi-e-il-piu-giovane",
    difficulty: "media",
    prompt: "Luca è più vecchio di Anna. Anna è più giovane di Bea. Bea è più giovane di Luca. Chi è il più giovane dei tre?",
    options: [
      { id: "a", text: "Luca" },
      { id: "b", text: "Anna" },
      { id: "c", text: "Bea" },
      { id: "d", text: "Non si può dire" },
    ],
    solution: { optionId: "b" },
    explain: "Luca è più vecchio di Bea, e Bea è più vecchia di Anna: in ordine Luca, Bea, Anna. La più giovane è Anna.",
  },
  {
    id: "lumaca-lenta",
    difficulty: "media",
    prompt: "Una lumaca percorre un metro ogni 4 minuti, senza mai fermarsi. Quanti metri fa in un'ora e mezza?",
    options: [
      { id: "a", text: "15" },
      { id: "b", text: "22,5" },
      { id: "c", text: "24" },
      { id: "d", text: "30" },
    ],
    solution: { optionId: "b" },
    explain: "Un'ora e mezza sono 90 minuti: 90 ÷ 4 = 22,5 metri.",
  },
  {
    id: "l-altro-ieri",
    difficulty: "difficile",
    prompt: "L'altro ieri era sabato. Che giorno sarà dopodomani?",
    options: [
      { id: "a", text: "Lunedì" },
      { id: "b", text: "Martedì" },
      { id: "c", text: "Mercoledì" },
      { id: "d", text: "Giovedì" },
    ],
    solution: { optionId: "c" },
    explain: "Se l'altro ieri era sabato, ieri era domenica e oggi è lunedì: dopodomani è mercoledì.",
  },
];

export default varianti;
