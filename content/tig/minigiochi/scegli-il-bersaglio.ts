import type { BersaglioInput } from "@/lib/tig/games/mechanics/scegli-il-bersaglio";

/**
 * 17 · SCEGLI IL BERSAGLIO — enigmi brevi (20–40 s) a risposta univoca: nel duello conta anche la velocità.
 * Ogni soluzione è verificata con un controllo aritmetico/esaustivo.
 */
const varianti: BersaglioInput[] = [
  {
    id: "conto-anticipato",
    prompt: "Cena in 5, conto da 85 €. Giulia ha già anticipato 25 € con la carta; il resto lo dividono gli altri quattro in parti uguali. Quanto paga ciascuno dei quattro?",
    options: [
      { id: "a", text: "15 €" },
      { id: "b", text: "17 €" },
      { id: "c", text: "12 €" },
      { id: "d", text: "20 €" },
    ],
    solution: { optionId: "a" },
    explain: "Restano 85 − 25 = 60 €, divisi in quattro: 15 € a testa. Il 17 € è la trappola della «romana» in cinque.",
  },
  {
    id: "turni-bar",
    prompt: "Sara lavora al bar un giorno sì e uno no, e ha lavorato lunedì. Marco lavora ogni tre giorni, e ha lavorato martedì. Qual è il primo giorno dopo martedì in cui lavorano entrambi?",
    options: [
      { id: "gio", text: "Giovedì" },
      { id: "ven", text: "Venerdì" },
      { id: "sab", text: "Sabato" },
      { id: "dom", text: "Domenica" },
    ],
    solution: { optionId: "ven" },
    explain: "Sara: lunedì, mercoledì, venerdì, domenica… Marco: martedì, venerdì, lunedì… Il primo giorno in comune dopo martedì è venerdì.",
  },
  {
    id: "treno-ritorno",
    prompt: "All'andata il treno parte alle 18:47 e arriva alle 20:12. Il ritorno dura 10 minuti in meno. Quanto dura il ritorno?",
    options: [
      { id: "a", text: "1 ora e 15 minuti" },
      { id: "b", text: "1 ora e 25 minuti" },
      { id: "c", text: "1 ora e 35 minuti" },
      { id: "d", text: "1 ora e 5 minuti" },
    ],
    solution: { optionId: "a" },
    explain: "Dalle 18:47 alle 20:12 passano 1 ora e 25 minuti. Togliendo 10 minuti, il ritorno dura 1 ora e 15 minuti.",
  },
  {
    id: "arrivi-festa",
    prompt: "Quattro amici arrivano alla festa uno alla volta. Gaia arriva prima di tutti. Dani non è né primo né ultimo. Elia arriva subito dopo Fede. Chi arriva per ultimo?",
    options: [
      { id: "dani", text: "Dani" },
      { id: "elia", text: "Elia" },
      { id: "fede", text: "Fede" },
      { id: "gaia", text: "Gaia" },
    ],
    solution: { optionId: "elia" },
    explain: "Gaia è prima. Fede ed Elia devono essere vicini, quindi Dani non può stare in mezzo a loro: Dani è secondo, Fede terzo, Elia ultimo.",
  },
  {
    id: "affitto-metri",
    prompt: "Affitto da 900 € diviso in proporzione ai metri quadri delle stanze: A 12 m², B 12 m², C 16 m². Quanto paga chi ha la stanza C?",
    options: [
      { id: "a", text: "300 €" },
      { id: "b", text: "360 €" },
      { id: "c", text: "400 €" },
      { id: "d", text: "320 €" },
    ],
    solution: { optionId: "b" },
    explain: "In tutto sono 40 m², quindi 900 ÷ 40 = 22,50 € al metro. La stanza C: 16 × 22,50 = 360 €.",
  },
  {
    id: "giro-rider",
    prompt: "Un rider parte dal ristorante. La prima consegna è a 2 km, ogni consegna successiva è a 2 km dalla precedente. Dopo la terza torna al ristorante, che dista 3 km. Quanti km fa in tutto?",
    options: [
      { id: "a", text: "7 km" },
      { id: "b", text: "8 km" },
      { id: "c", text: "9 km" },
      { id: "d", text: "11 km" },
    ],
    solution: { optionId: "c" },
    explain: "Tre tratte da 2 km per le consegne (6 km) più 3 km per tornare: 9 km.",
  },
  {
    id: "palestra-alterni",
    prompt: "Vai in palestra a giorni alterni e oggi ci sei andato. Quante volte ci vai nei prossimi 14 giorni, oggi escluso?",
    options: [
      { id: "a", text: "6" },
      { id: "b", text: "7" },
      { id: "c", text: "8" },
      { id: "d", text: "14" },
    ],
    solution: { optionId: "b" },
    explain: "Dopo oggi ci vai al 2°, 4°, 6°, 8°, 10°, 12° e 14° giorno: 7 volte.",
  },
  {
    id: "pizza-otto-fette",
    prompt: "Sei amici, una pizza tagliata in 8 fette. Tre ne mangiano due a testa; gli altri tre una a testa, finché ce ne sono. Quanti restano senza fetta?",
    options: [
      { id: "a", text: "Nessuno" },
      { id: "b", text: "Uno" },
      { id: "c", text: "Due" },
      { id: "d", text: "Tre" },
    ],
    solution: { optionId: "b" },
    explain: "I primi tre mangiano 6 fette. Ne restano 2 per gli altri tre: uno resta senza.",
  },
  {
    id: "sveglia-posticipo",
    prompt: "La sveglia suona alle 7:00 e poi, a ogni posticipo, 9 minuti dopo. Ti alzi al quarto suono. Che ore sono?",
    options: [
      { id: "a", text: "7:27" },
      { id: "b", text: "7:36" },
      { id: "c", text: "7:18" },
      { id: "d", text: "7:30" },
    ],
    solution: { optionId: "a" },
    explain: "Primo suono 7:00, poi 7:09, 7:18 e il quarto alle 7:27: tre posticipi da 9 minuti.",
  },
];

export default varianti;
