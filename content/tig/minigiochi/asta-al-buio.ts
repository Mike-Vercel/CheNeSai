import type { AstaInput } from "@/lib/tig/games/mechanics/asta-al-buio";

/**
 * 23 · ASTA AL BUIO — buste chiuse: gli indizi lasciano 2–4 valori possibili (elencati nella spiegazione),
 * il tetto d'offerta fa sì che strafare possa costare (perdita massima 40). Valori verificati con un controllo
 * esaustivo degli indizi.
 */
const varianti: AstaInput[] = [
  {
    id: "busta-bancone",
    lot: "La busta del bancone",
    hints: ["È un multiplo di 20.", "Vale più di 50 e meno di 130.", "Non è un numero tondo da cento."],
    cap: 100,
    solution: { value: 80 },
    explain: "Gli indizi lasciavano 60, 80 o 120. La busta valeva 80: offrire più di 80 voleva dire rimetterci.",
  },
  {
    id: "busta-coinquilino",
    lot: "La busta del coinquilino",
    hints: ["Finisce con 5.", "Sta tra 60 e 100.", "La somma delle sue cifre è pari."],
    cap: 90,
    solution: { value: 75 },
    explain: "Restavano 75 (7+5 = 12) e 95 (9+5 = 14). La busta valeva 75: chi ha offerto più di 75 ha pagato caro.",
  },
  {
    id: "busta-capo",
    lot: "La busta del capo",
    hints: ["Vale più di 40 e meno di 100.", "È un multiplo di 15.", "Non è un multiplo di 10."],
    cap: 60,
    solution: { value: 45 },
    explain: "I multipli di 15 tra 40 e 100 sono 45, 60, 75 e 90; senza i multipli di 10 restano 45 e 75. Valeva 45: sopra quella cifra si perdeva.",
  },
  {
    id: "busta-palestra",
    lot: "La busta della palestra",
    hints: ["È un multiplo di 12.", "Sta tra 50 e 110.", "La cifra delle unità è più piccola di quella delle decine."],
    cap: 95,
    solution: { value: 72 },
    explain: "Restavano 60, 72, 84 e 96 (il 108 ha lo 0 alle decine). La busta valeva 72.",
  },
  {
    id: "busta-vicino",
    lot: "La busta del vicino rumoroso",
    hints: ["È il doppio di un numero che finisce con 0.", "È meno di 100.", "È più del doppio di 25."],
    cap: 80,
    solution: { value: 60 },
    explain: "Il doppio di un numero tondo è un multiplo di 20: sopra 50 e sotto 100 restano 60 e 80. Valeva 60.",
  },
  {
    id: "busta-regia",
    lot: "La busta della regia",
    hints: ["Finisce con 0.", "Sta tra 85 e 135.", "La somma delle sue cifre è dispari."],
    cap: 100,
    solution: { value: 90 },
    explain: "Tra 90, 100, 110, 120 e 130 hanno somma dispari 90, 100 e 120. Valeva 90: offrire 100 voleva dire perdere 10.",
  },
  {
    id: "busta-trasloco",
    lot: "La busta del trasloco",
    hints: ["È un multiplo di 25.", "È maggiore di 60.", "Non supera 130."],
    cap: 100,
    solution: { value: 125 },
    explain: "Restavano 75, 100 e 125. Valeva 125: anche offrendo il massimo si guadagnava, ma chi ha osato poco è stato superato.",
  },
];

export default varianti;
