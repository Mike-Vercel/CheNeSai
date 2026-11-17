import type { CaosInput } from "@/lib/tig/games/mechanics/bottone-del-caos";

/**
 * 29 · BOTTONE DEL CAOS — raffiche di tre domande lampo (3 opzioni, pochi secondi l'una): nel duello contano
 * prima le risposte giuste e poi la velocità. Fatte per stare in 45 secondi, anche come duello del Caos.
 */
const varianti: CaosInput[] = [
  {
    id: "galline-sabato-decimali",
    difficulty: "facile",
    raffica: [
      { prompt: "Quante zampe hanno due galline?", options: [{ id: "a", text: "2" }, { id: "b", text: "4" }, { id: "c", text: "6" }] },
      { prompt: "Se domani è sabato, oggi è…", options: [{ id: "a", text: "Giovedì" }, { id: "b", text: "Venerdì" }, { id: "c", text: "Domenica" }] },
      { prompt: "Quale numero è più grande?", options: [{ id: "a", text: "0,9" }, { id: "b", text: "0,19" }, { id: "c", text: "0,099" }] },
    ],
    solution: { raffica: ["b", "b", "a"] },
    explain: "2 galline × 2 zampe = 4. Se domani è sabato, oggi è venerdì. 0,9 vale 0,900: più di 0,19 e di 0,099.",
  },
  {
    id: "somma-natale-uscita",
    difficulty: "facile",
    raffica: [
      { prompt: "Quanto fa 25 + 25 + 25?", options: [{ id: "a", text: "65" }, { id: "b", text: "75" }, { id: "c", text: "85" }] },
      { prompt: "In che mese cade Natale?", options: [{ id: "a", text: "Novembre" }, { id: "b", text: "Dicembre" }, { id: "c", text: "Gennaio" }] },
      { prompt: "Il contrario di «entrata» è…", options: [{ id: "a", text: "Uscita" }, { id: "b", text: "Porta" }, { id: "c", text: "Salita" }] },
    ],
    solution: { raffica: ["b", "b", "a"] },
    explain: "Tre volte 25 fa 75. Natale è il 25 dicembre. Il contrario di entrata è uscita.",
  },
  {
    id: "secondi-alfabeto-strette",
    difficulty: "media",
    raffica: [
      { prompt: "Quanti secondi ci sono in un quarto d'ora?", options: [{ id: "a", text: "450" }, { id: "b", text: "900" }, { id: "c", text: "1500" }] },
      { prompt: "Quale parola viene prima in ordine alfabetico?", options: [{ id: "a", text: "Apertura" }, { id: "b", text: "Aperto" }, { id: "c", text: "Aperitivo" }] },
      { prompt: "Quattro amici si stringono la mano, ognuno con ciascun altro. Quante strette di mano?", options: [{ id: "a", text: "4" }, { id: "b", text: "6" }, { id: "c", text: "8" }] },
    ],
    solution: { raffica: ["b", "c", "b"] },
    explain: "15 × 60 = 900 secondi. APERI- viene prima di APERT-, perché la I viene prima della T. Le coppie tra 4 persone sono 4 × 3 ÷ 2 = 6.",
  },
  {
    id: "dozzine-primo-pomeriggio",
    difficulty: "media",
    raffica: [
      { prompt: "Quanto fa 12 × 5?", options: [{ id: "a", text: "50" }, { id: "b", text: "60" }, { id: "c", text: "70" }] },
      { prompt: "Quale di questi è un numero primo?", options: [{ id: "a", text: "21" }, { id: "b", text: "27" }, { id: "c", text: "29" }] },
      { prompt: "Le 17:00 sono…", options: [{ id: "a", text: "Le 5 del pomeriggio" }, { id: "b", text: "Le 7 di sera" }, { id: "c", text: "Le 3 del pomeriggio" }] },
    ],
    solution: { raffica: ["b", "c", "a"] },
    explain: "12 × 5 = 60. 21 = 3 × 7 e 27 = 3 × 9, mentre 29 si divide solo per 1 e per sé stesso. 17 − 12 = 5: le cinque del pomeriggio.",
  },
  {
    id: "frazioni-settimane-anagramma",
    difficulty: "difficile",
    raffica: [
      { prompt: "Quanto fa 1/2 + 1/4?", options: [{ id: "a", text: "2/6" }, { id: "b", text: "3/4" }, { id: "c", text: "1/6" }] },
      { prompt: "Quanti giorni sono 3 settimane e 3 giorni?", options: [{ id: "a", text: "21" }, { id: "b", text: "24" }, { id: "c", text: "27" }] },
      { prompt: "Quale parola usa esattamente le lettere di ROMA?", options: [{ id: "a", text: "Mora" }, { id: "b", text: "Rame" }, { id: "c", text: "Remo" }] },
    ],
    solution: { raffica: ["b", "b", "a"] },
    explain: "Mezzo più un quarto fa tre quarti. 3 × 7 + 3 = 24 giorni. MORA ha R, O, M e A; RAME e REMO hanno una E.",
  },
  {
    id: "biciclette-colori-mezzora",
    difficulty: "facile",
    raffica: [
      { prompt: "Quante ruote hanno 3 biciclette?", options: [{ id: "a", text: "5" }, { id: "b", text: "6" }, { id: "c", text: "8" }] },
      { prompt: "Mescolando giallo e blu si ottiene…", options: [{ id: "a", text: "Verde" }, { id: "b", text: "Viola" }, { id: "c", text: "Arancione" }] },
      { prompt: "Quanti minuti ci sono in mezz'ora?", options: [{ id: "a", text: "15" }, { id: "b", text: "30" }, { id: "c", text: "45" }] },
    ],
    solution: { raffica: ["b", "a", "b"] },
    explain: "3 × 2 = 6 ruote. Giallo e blu fanno verde. Mezz'ora sono 30 minuti.",
  },
  {
    id: "sottrazione-sabato-caos",
    difficulty: "media",
    raffica: [
      { prompt: "Quanto fa 100 − 37?", options: [{ id: "a", text: "63" }, { id: "b", text: "73" }, { id: "c", text: "67" }] },
      { prompt: "Che giorno viene due giorni prima di lunedì?", options: [{ id: "a", text: "Sabato" }, { id: "b", text: "Domenica" }, { id: "c", text: "Venerdì" }] },
      { prompt: "Quante lettere ha la parola CAOS?", options: [{ id: "a", text: "3" }, { id: "b", text: "4" }, { id: "c", text: "5" }] },
    ],
    solution: { raffica: ["a", "a", "b"] },
    explain: "100 − 37 = 63. Prima di lunedì c'è domenica, e prima ancora sabato. C-A-O-S: 4 lettere.",
  },
  {
    id: "percentuale-pizze-serie",
    difficulty: "difficile",
    raffica: [
      { prompt: "Quanto fa il 15% di 200?", options: [{ id: "a", text: "15" }, { id: "b", text: "20" }, { id: "c", text: "30" }] },
      { prompt: "Se 3 pizze costano 21 €, quanto costano 5 pizze?", options: [{ id: "a", text: "30 €" }, { id: "b", text: "35 €" }, { id: "c", text: "42 €" }] },
      { prompt: "Che numero viene dopo: 2, 4, 8, 16, …?", options: [{ id: "a", text: "24" }, { id: "b", text: "30" }, { id: "c", text: "32" }] },
    ],
    solution: { raffica: ["c", "b", "c"] },
    explain: "Il 10% di 200 è 20, il 5% è 10: insieme 30. Una pizza costa 7 €, cinque 35 €. Ogni numero è il doppio del precedente: 32.",
  },
  {
    id: "zeri-semi-meta",
    difficulty: "facile",
    raffica: [
      { prompt: "Quanti zeri ha il numero cento?", options: [{ id: "a", text: "1" }, { id: "b", text: "2" }, { id: "c", text: "3" }] },
      { prompt: "Quanti semi ha un mazzo di carte da briscola?", options: [{ id: "a", text: "2" }, { id: "b", text: "4" }, { id: "c", text: "5" }] },
      { prompt: "Qual è la metà di 50?", options: [{ id: "a", text: "20" }, { id: "b", text: "25" }, { id: "c", text: "30" }] },
    ],
    solution: { raffica: ["b", "b", "b"] },
    explain: "100 ha due zeri. Le carte da briscola hanno 4 semi: coppe, denari, bastoni e spade. 50 ÷ 2 = 25.",
  },
  {
    id: "dispari-ore-uova",
    difficulty: "media",
    raffica: [
      { prompt: "Che numero viene dopo: 1, 3, 5, 7, …?", options: [{ id: "a", text: "8" }, { id: "b", text: "9" }, { id: "c", text: "11" }] },
      { prompt: "Quante ore ci sono in un giorno e mezzo?", options: [{ id: "a", text: "30" }, { id: "b", text: "36" }, { id: "c", text: "48" }] },
      { prompt: "Il plurale di «uovo» è…", options: [{ id: "a", text: "Uovi" }, { id: "b", text: "Uova" }, { id: "c", text: "Uove" }] },
    ],
    solution: { raffica: ["b", "b", "b"] },
    explain: "Sono i numeri dispari: dopo il 7 viene il 9. 24 + 12 = 36 ore. Il plurale di uovo è uova.",
  },
  {
    id: "tabellina-sequenza-diagonali",
    difficulty: "difficile",
    raffica: [
      { prompt: "Quanto fa 7 × 8?", options: [{ id: "a", text: "54" }, { id: "b", text: "56" }, { id: "c", text: "63" }] },
      { prompt: "Che numero viene dopo: 1, 1, 2, 3, 5, 8, …?", options: [{ id: "a", text: "11" }, { id: "b", text: "12" }, { id: "c", text: "13" }] },
      { prompt: "Quante diagonali ha un quadrato?", options: [{ id: "a", text: "1" }, { id: "b", text: "2" }, { id: "c", text: "4" }] },
    ],
    solution: { raffica: ["b", "c", "b"] },
    explain: "7 × 8 = 56. Ogni numero è la somma dei due precedenti: 5 + 8 = 13. Un quadrato ha 2 diagonali.",
  },
  {
    id: "bisestile-vocali-rientro",
    difficulty: "media",
    raffica: [
      { prompt: "Quanti giorni ha un anno bisestile?", options: [{ id: "a", text: "364" }, { id: "b", text: "365" }, { id: "c", text: "366" }] },
      { prompt: "Quale parola contiene tutte e cinque le vocali?", options: [{ id: "a", text: "Aiuole" }, { id: "b", text: "Pausa" }, { id: "c", text: "Aereo" }] },
      { prompt: "Esci alle 23:30 e torni 2 ore e 45 minuti dopo. Che ore sono?", options: [{ id: "a", text: "1:15" }, { id: "b", text: "2:15" }, { id: "c", text: "2:45" }] },
    ],
    solution: { raffica: ["c", "a", "b"] },
    explain: "L'anno bisestile ha 366 giorni. AIUOLE contiene A, I, U, O ed E. Dalle 23:30, due ore portano all'1:30 e altri 45 minuti alle 2:15.",
  },
];

export default varianti;
