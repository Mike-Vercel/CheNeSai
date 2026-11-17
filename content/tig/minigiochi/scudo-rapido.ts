import type { ScudoInput } from "@/lib/tig/games/mechanics/scudo-rapido";

/**
 * 19 · SCUDO RAPIDO — lucchetti con regole che portano a UN solo codice (verificato provando tutte le
 * combinazioni possibili).
 */
const varianti: ScudoInput[] = [
  {
    id: "bnb-chiavi",
    prompt: "Cassetta delle chiavi del B&B, 3 cifre tutte diverse e nessuno zero. La prima è il doppio della terza. La seconda è la somma delle altre due. In tutto le cifre fanno 12.",
    solution: { code: "462" },
    explain: "Se la terza è x, la prima è 2x e la seconda 3x: in tutto 6x = 12, quindi x = 2. Codice 4-6-2.",
  },
  {
    id: "armadietto-dispari",
    prompt: "Armadietto della palestra, 4 cifre. Sono tutte dispari, tutte diverse e in ordine crescente da sinistra a destra. La loro somma è 16.",
    solution: { code: "1357" },
    explain: "Le cifre dispari sono 1, 3, 5, 7, 9 e sommano 25. Per arrivare a 16 bisogna togliere il 9: restano 1, 3, 5, 7 in ordine crescente.",
  },
  {
    id: "wifi-casa-vacanze",
    prompt: "La password del wi-fi della casa vacanze finisce con un orario serale HHMM tra le 20:00 e le 23:59. I minuti sono un multiplo di 10, le 4 cifre sono tutte diverse e sommano 9.",
    solution: { code: "2340" },
    explain: "L'ora inizia per 2 e i minuti finiscono per 0, quindi l'ora non può essere 20 né 22. Le due cifre restanti fanno 7: con 21 i minuti sarebbero 60 (non validi), con 23 sono 40. Orario 23:40.",
  },
  {
    id: "bici-anno",
    prompt: "Lucchetto della bici condivisa, 4 cifre: un anno dal 1990 al 2005 compresi. Prima e terza cifra sommano quanto seconda e quarta. E c'è almeno un 9.",
    solution: { code: "1991" },
    explain: "Tra il 1990 e il 2005 solo il 1991 (1+9 = 9+1) e il 2002 (2+0 = 0+2) hanno le somme uguali. Il 9 c'è solo nel 1991.",
  },
  {
    id: "portone-25",
    prompt: "Codice del portone, 3 cifre tutte diverse: è un numero dispari multiplo di 25, la prima cifra è la più grande delle tre e la somma delle cifre è 14.",
    solution: { code: "725" },
    explain: "Un multiplo di 25 dispari finisce per 25 o 75. Con somma 14: 725 oppure 275. Nel 275 la prima cifra non è la più grande: resta 725.",
  },
  {
    id: "trolley-quadrato",
    prompt: "Lucchetto del trolley, 3 cifre: il numero è un quadrato perfetto (un numero per se stesso), le cifre crescono da sinistra a destra e la loro somma è 13.",
    solution: { code: "256" },
    explain: "I quadrati a tre cifre con cifre crescenti sono 169, 256 e 289. Le somme fanno 16, 13 e 19: solo 256 = 16 × 16 funziona.",
  },
  {
    id: "ufficio-uscita",
    prompt: "Armadietto in ufficio: il codice è l'orario di uscita HHMM. Esci dopo le 17:00 e prima delle 19:00, i minuti sono un multiplo di 15 e le quattro cifre sommano 12.",
    solution: { code: "1830" },
    explain: "Le ore possono essere 17 o 18, i minuti 00, 15, 30 o 45. Con 17 servirebbero minuti che sommano 4: nessuno. Con 18 servono minuti che sommano 3: 30. Orario 18:30.",
  },
  {
    id: "garage-quattro",
    prompt: "Codice del garage, 4 cifre tutte diverse. La seconda è il triplo della prima. La quarta è la somma delle prime due. La terza è la quarta meno uno.",
    solution: { code: "2678" },
    explain: "Con la prima a 1 il codice sarebbe 1-3-3-4 (3 ripetuto); con 3 o più la quarta supera 9. Resta la prima a 2: 2-6-7-8.",
  },
  {
    id: "piscina-pari",
    prompt: "Armadietto della piscina, 3 cifre: tutte pari, tutte diverse, in ordine decrescente, somma 10. La cifra centrale è maggiore di 3.",
    solution: { code: "640" },
    explain: "Con cifre pari diverse che fanno 10 si ottengono solo 8-2-0 e 6-4-0. La cifra centrale maggiore di 3 lascia 640.",
  },
  {
    id: "casa-mare-palindromo",
    prompt: "Cassetta delle chiavi della casa al mare, 4 cifre: il codice letto al contrario è identico, la prima cifra è la metà della seconda e la somma di tutte è 18.",
    solution: { code: "3663" },
    explain: "Letto al contrario è uguale, quindi è del tipo A-B-B-A con 2A + 2B = 18, cioè A + B = 9. Con B = 2A: A = 3, B = 6. Codice 3663.",
  },
];

export default varianti;
