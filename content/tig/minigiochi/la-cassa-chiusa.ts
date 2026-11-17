import type { CassaInput } from "@/lib/tig/games/mechanics/la-cassa-chiusa";

/**
 * 67 · LA CASSA CHIUSA — tre serrature a combinazione con indizi a catena: la prima si risolve da sola,
 * la seconda usa il codice della prima, la terza i codici precedenti. Calcoli verificati con node.
 */
const varianti: CassaInput[] = [
  {
    id: "trasloco-attrezzi",
    difficulty: "facile",
    title: "La cassa degli attrezzi del trasloco",
    intro: "Il trasloco è finito, ma la cassa degli attrezzi del padrone di casa ha tre lucchetti. Gli indizi sono a catena: ogni codice serve per trovare il successivo.",
    locks: [
      { id: "rosso", name: "Il lucchetto rosso", clue: "Avete portato su 7 scatoloni da 18 kg l'uno. Il codice è il peso totale in chili.", digits: 3 },
      { id: "blu", name: "Il lucchetto blu", clue: "Prendete il codice del lucchetto rosso e aggiungete 250, i chili dell'armadio che nessuno voleva sollevare.", digits: 3 },
      { id: "verde", name: "Il lucchetto verde", clue: "Leggete il codice del lucchetto blu al contrario, da destra a sinistra.", digits: 3 },
    ],
    solution: {
      codes: { rosso: "126", blu: "376", verde: "673" },
      steps: { rosso: "7 × 18 = 126 kg.", blu: "126 + 250 = 376.", verde: "376 letto al contrario: 673." },
    },
    explain: "Sette scatoloni da 18 kg fanno 126 kg. Aggiungendo 250 si arriva a 376, che letto al contrario diventa 673.",
  },
  {
    id: "pizzeria-mance",
    difficulty: "facile",
    title: "La cassa della pizzeria",
    intro: "Il pizzaiolo tiene le mance del mese in una cassa con tre lucchetti. Vi ha lasciato tre biglietti sul bancone: ognuno parte dal codice prima.",
    locks: [
      { id: "rosso", name: "Il lucchetto rosso", clue: "Siete in 12 e ognuno prende una pizza da 8 € e una bibita da 3 €. Il codice è il totale dello scontrino in euro.", digits: 3 },
      { id: "blu", name: "Il lucchetto blu", clue: "Raddoppiate il codice del lucchetto rosso: è la cena del mese prossimo, se tornate tutti con un amico.", digits: 3 },
      { id: "verde", name: "Il lucchetto verde", clue: "Sommate il codice del lucchetto rosso e quello del lucchetto blu.", digits: 3 },
    ],
    solution: {
      codes: { rosso: "132", blu: "264", verde: "396" },
      steps: { rosso: "Ognuno spende 8 + 3 = 11 €, in 12 fanno 132 €.", blu: "132 × 2 = 264.", verde: "132 + 264 = 396." },
    },
    explain: "Ognuno spende 11 €, in dodici fanno 132 €. Il doppio è 264 e la somma dei due codici è 396.",
  },
  {
    id: "cassetta-chiavi-bnb",
    difficulty: "facile",
    title: "La cassetta delle chiavi",
    intro: "Siete arrivati al B&B e la cassetta delle chiavi ha tre serrature. L'host vi ha mandato tre messaggi, uno per serratura, e ognuno parte dal codice prima.",
    locks: [
      { id: "rosso", name: "La rotella rossa", clue: "Il check-in apriva alle 15:30 e siete arrivati 7 ore e mezza dopo. Il codice è l'orario d'arrivo scritto senza i due punti.", digits: 4 },
      { id: "blu", name: "La rotella blu", clue: "Prendete il codice della rotella rossa, togliete 2.000 e aggiungete i 45 € della tassa di soggiorno.", digits: 3 },
      { id: "verde", name: "La rotella verde", clue: "Sommate il codice della rotella blu con lo stesso numero letto al contrario.", digits: 3 },
    ],
    solution: {
      codes: { rosso: "2300", blu: "345", verde: "888" },
      steps: { rosso: "15:30 più 7 ore e mezza fa le 23:00: 2300.", blu: "2300 − 2000 = 300, più 45 fa 345.", verde: "345 + 543 = 888." },
    },
    explain: "Dalle 15:30 con 7 ore e mezza si arriva alle 23:00, cioè 2300. Tolti 2.000 e aggiunti 45 si ottiene 345; sommato al contrario 543 fa 888.",
  },
  {
    id: "armadietto-palestra",
    difficulty: "facile",
    title: "L'armadietto della palestra",
    intro: "Avete chiuso chiavi e telefono nell'armadietto e non ricordate la combinazione. Per fortuna vi eravate lasciati tre promemoria a catena sul foglio degli allenamenti.",
    locks: [
      { id: "rosso", name: "La serratura rossa", clue: "Avete fatto 5 serie da 20 piegamenti, più 24 di riscaldamento. Il codice è il totale dei piegamenti.", digits: 3 },
      { id: "blu", name: "La serratura blu", clue: "Moltiplicate per 3 il codice della serratura rossa: sono i piegamenti della settimana.", digits: 3 },
      { id: "verde", name: "La serratura verde", clue: "Togliete il codice della serratura rossa dal codice della serratura blu.", digits: 3 },
    ],
    solution: {
      codes: { rosso: "124", blu: "372", verde: "248" },
      steps: { rosso: "5 × 20 = 100, più 24 fa 124.", blu: "124 × 3 = 372.", verde: "372 − 124 = 248." },
    },
    explain: "Cinque serie da 20 fanno 100, con il riscaldamento 124. Per tre allenamenti 372, e 372 meno 124 dà 248.",
  },
  {
    id: "matrimonio-buste",
    difficulty: "media",
    title: "La scatola delle buste al matrimonio",
    intro: "Al matrimonio di Giulia e Marco la scatola delle buste ha tre lucchetti. Il testimone ha scritto gli indizi a catena e poi è sparito in pista.",
    locks: [
      { id: "rosso", name: "Il lucchetto rosso", clue: "Ci sono 18 tavoli da 8 invitati più il tavolo degli sposi da 12. Il codice è il numero totale di persone.", digits: 3 },
      { id: "blu", name: "Il lucchetto blu", clue: "Ogni persona del codice rosso riceve 3 portate, ma 8 persone saltano il dolce. Il codice è il numero di piatti serviti.", digits: 3 },
      { id: "verde", name: "Il lucchetto verde", clue: "Sommate il codice del lucchetto rosso e quello del lucchetto blu, poi moltiplicate il risultato per 2.", digits: 4 },
    ],
    solution: {
      codes: { rosso: "156", blu: "460", verde: "1232" },
      steps: { rosso: "18 × 8 = 144, più 12 fa 156.", blu: "156 × 3 = 468, meno 8 dolci saltati: 460.", verde: "156 + 460 = 616, e 616 × 2 = 1232." },
    },
    explain: "Gli invitati sono 144 più 12, cioè 156. Tre portate a testa fanno 468 piatti, meno 8 dolci: 460. La somma 616 raddoppiata dà 1232.",
  },
  {
    id: "bollette-casa",
    difficulty: "media",
    title: "La cassetta delle bollette",
    intro: "In casa tenete i soldi delle bollette in una cassetta con tre serrature. L'ultimo che l'ha chiusa ha lasciato tre biglietti sul frigo, uno per serratura.",
    locks: [
      { id: "rosso", name: "La serratura rossa", clue: "La luce costa 186 € ogni due mesi e il gas 234 € ogni due mesi. Il codice è quanto spendete in tutto in un mese.", digits: 3 },
      { id: "blu", name: "La serratura blu", clue: "Dividete il codice della serratura rossa tra i 3 coinquilini e scrivete la quota due volte di fila.", digits: 4 },
      { id: "verde", name: "La serratura verde", clue: "Dividete per 10 il codice della serratura blu e togliete il codice della serratura rossa.", digits: 3 },
    ],
    solution: {
      codes: { rosso: "210", blu: "7070", verde: "497" },
      steps: { rosso: "186 + 234 = 420 € ogni due mesi: 210 € al mese.", blu: "210 ÷ 3 = 70, scritto due volte: 7070.", verde: "7070 ÷ 10 = 707, meno 210 fa 497." },
    },
    explain: "In due mesi le bollette fanno 420 €, quindi 210 € al mese. La quota a testa è 70, che scritta due volte dà 7070. Diviso 10 fa 707, e tolti 210 resta 497.",
  },
  {
    id: "concerto-merch",
    difficulty: "media",
    title: "La cassa del banco magliette",
    intro: "Dopo il concerto la cassa del banco magliette è rimasta chiusa con tre lucchetti. Il gruppo ha lasciato tre indizi a catena sulla scaletta.",
    locks: [
      { id: "rosso", name: "Il lucchetto rosso", clue: "Il concerto è iniziato alle 20:45 ed è durato 2 ore e 50 minuti, bis compresi. Il codice è l'orario di fine, scritto senza i due punti.", digits: 4 },
      { id: "blu", name: "Il lucchetto blu", clue: "Avete venduto tante magliette quanto le ultime due cifre del codice rosso, a 20 € l'una. Il codice è l'incasso in euro.", digits: 3 },
      { id: "verde", name: "Il lucchetto verde", clue: "Aggiungete al codice del lucchetto blu la durata del concerto in minuti.", digits: 3 },
    ],
    solution: {
      codes: { rosso: "2335", blu: "700", verde: "870" },
      steps: { rosso: "20:45 più 2 ore fa 22:45, più 50 minuti fa 23:35: 2335.", blu: "Le ultime due cifre sono 35: 35 × 20 = 700 €.", verde: "2 ore e 50 minuti sono 170 minuti: 700 + 170 = 870." },
    },
    explain: "Il concerto è finito alle 23:35, quindi 2335. Trentacinque magliette da 20 € fanno 700 €. Il concerto è durato 170 minuti: 700 più 170 dà 870.",
  },
  {
    id: "treno-capotreno",
    difficulty: "media",
    title: "La cassetta del capotreno",
    intro: "Il capotreno ha chiuso gli oggetti smarriti in una cassetta con tre serrature e vi ha lasciato tre indizi a catena sul biglietto.",
    locks: [
      { id: "rosso", name: "La serratura rossa", clue: "Il treno parte alle 7:48 e arriva alle 10:13. Il codice è la durata del viaggio in minuti.", digits: 3 },
      { id: "blu", name: "La serratura blu", clue: "Il treno va a 120 km/h, cioè 2 km al minuto. Il codice è il numero di km percorsi nei minuti del codice rosso.", digits: 3 },
      { id: "verde", name: "La serratura verde", clue: "Togliete il codice della serratura rossa da quello della serratura blu e leggete il risultato al contrario.", digits: 3 },
    ],
    solution: {
      codes: { rosso: "145", blu: "290", verde: "541" },
      steps: { rosso: "Dalle 7:48 alle 9:48 sono 120 minuti, fino alle 10:13 altri 25: 145.", blu: "145 × 2 = 290 km.", verde: "290 − 145 = 145, al contrario 541." },
    },
    explain: "Il viaggio dura 2 ore e 25 minuti, cioè 145 minuti. A 2 km al minuto sono 290 km. La differenza è 145, che letta al contrario fa 541.",
  },
  {
    id: "posta-palazzo",
    difficulty: "difficile",
    title: "La cassetta della posta del palazzo",
    intro: "Il pacco per Bea è finito in una cassetta condominiale con tre serrature. Il portiere ha lasciato tre indizi, ognuno legato al precedente.",
    locks: [
      { id: "rosso", name: "La serratura rossa", clue: "Il palazzo ha piano terra e 9 piani, 4 appartamenti per piano, numerati di fila da 1 partendo dal piano terra. Bea abita nel secondo appartamento del settimo piano. Codice: numero dell'interno seguito dal numero del piano.", digits: 3 },
      { id: "blu", name: "La serratura blu", clue: "Raddoppiate il codice della serratura rossa e togliete il numero totale di appartamenti del palazzo.", digits: 3 },
      { id: "verde", name: "La serratura verde", clue: "Togliete il codice della serratura rossa da quello della serratura blu e leggete il risultato al contrario.", digits: 3 },
    ],
    solution: {
      codes: { rosso: "307", blu: "574", verde: "762" },
      steps: { rosso: "Il piano terra ha gli interni 1-4, il primo piano 5-8: il settimo ha 29-32. Il secondo è il 30, piano 7: 307.", blu: "I livelli sono 10, da 4 appartamenti: 40. 307 × 2 = 614, meno 40 fa 574.", verde: "574 − 307 = 267, al contrario 762." },
    },
    explain: "Con il piano terra che parte da 1, il settimo piano ha gli interni dal 29 al 32: Bea sta al 30, quindi 307. Gli appartamenti sono 40 (10 livelli da 4): 614 meno 40 fa 574. La differenza 267 al contrario dà 762.",
  },
  {
    id: "saldi-scarpe",
    difficulty: "difficile",
    title: "La cassa del negozio di scarpe",
    intro: "Ultimo giorno di saldi: la commessa ha chiuso gli scontrini in una cassa con tre lucchetti e ha lasciato tre indizi a catena.",
    locks: [
      { id: "rosso", name: "Il lucchetto rosso", clue: "Un paio di scarpe costa 300 €. Ai saldi c'è il 30% di sconto e, sul prezzo già scontato, un altro 10% con la tessera. Il codice è il prezzo finale in euro.", digits: 3 },
      { id: "blu", name: "Il lucchetto blu", clue: "Calcolate quanto risparmiate su un paio rispetto ai 300 € pieni (usate il codice rosso) e moltiplicate per 4: è il risparmio su quattro paia.", digits: 3 },
      { id: "verde", name: "Il lucchetto verde", clue: "Sommate il codice del lucchetto rosso e quello del lucchetto blu, poi moltiplicate il risultato per 3.", digits: 4 },
    ],
    solution: {
      codes: { rosso: "189", blu: "444", verde: "1899" },
      steps: { rosso: "300 meno il 30% fa 210; meno il 10% di 210 (21) fa 189. Non è 180: gli sconti non si sommano.", blu: "300 − 189 = 111 risparmiati, × 4 = 444.", verde: "189 + 444 = 633, e 633 × 3 = 1899." },
    },
    explain: "Il secondo sconto si calcola sul prezzo già scontato: 300 diventa 210 e poi 189, non 180. Si risparmiano 111 € a paio, 444 su quattro paia. La somma 633 per tre fa 1899.",
  },
  {
    id: "chat-calcetto",
    difficulty: "difficile",
    title: "Il cofanetto del calcetto",
    intro: "La squadra di calcetto tiene la cassa comune in un cofanetto con tre serrature. Il capitano ha scritto gli indizi a catena nella chat del gruppo.",
    locks: [
      { id: "rosso", name: "La serratura rossa", clue: "Nella chat siete in 14. Marco ha scritto 40 messaggi, due persone non hanno mai scritto e tutti gli altri ne hanno scritti 6 a testa. Il codice è il totale dei messaggi.", digits: 3 },
      { id: "blu", name: "La serratura blu", clue: "Moltiplicate il codice della serratura rossa per 5 e togliete i 47 messaggi vocali.", digits: 3 },
      { id: "verde", name: "La serratura verde", clue: "Togliete il codice della serratura rossa da quello della serratura blu, poi scambiate la prima e l'ultima cifra.", digits: 3 },
    ],
    solution: {
      codes: { rosso: "106", blu: "483", verde: "773" },
      steps: { rosso: "Tolti Marco e i due muti restano 11 persone: 11 × 6 = 66, più i 40 di Marco fa 106.", blu: "106 × 5 = 530, meno 47 fa 483.", verde: "483 − 106 = 377, scambiando prima e ultima cifra: 773." },
    },
    explain: "Scrivono a 6 messaggi solo in 11 (14 meno Marco e meno i due silenziosi): 66, più i 40 di Marco fa 106. Per cinque fa 530, meno 47 dà 483. La differenza 377 con prima e ultima cifra scambiate diventa 773.",
  },
  {
    id: "road-trip",
    difficulty: "difficile",
    title: "Il cofanetto del viaggio in auto",
    intro: "Per il viaggio in auto avete chiuso i soldi della benzina in un cofanetto con tre serrature. Chi l'ha chiuso ha lasciato tre indizi a catena sulla cartina.",
    locks: [
      { id: "rosso", name: "La serratura rossa", clue: "L'auto consuma 6 litri ogni 100 km. Partite col serbatoio pieno da 45 litri e volete tenerne sempre 9 di riserva. Il codice è il numero di km che potete fare prima di fermarvi.", digits: 3 },
      { id: "blu", name: "La serratura blu", clue: "Viaggiate a 80 km/h di media. Il codice è il tempo in minuti per percorrere i km del codice rosso.", digits: 3 },
      { id: "verde", name: "La serratura verde", clue: "Partite alle 6:20. Aggiungete i minuti del codice blu e 40 minuti di sosta: il codice è l'orario d'arrivo senza i due punti.", digits: 4 },
    ],
    solution: {
      codes: { rosso: "600", blu: "450", verde: "1430" },
      steps: { rosso: "Si possono usare 45 − 9 = 36 litri. A 6 litri ogni 100 km: 36 ÷ 6 = 6, cioè 600 km.", blu: "600 ÷ 80 = 7,5 ore, cioè 450 minuti.", verde: "450 + 40 = 490 minuti, cioè 8 ore e 10 minuti: dalle 6:20 si arriva alle 14:30." },
    },
    explain: "Restano da usare 36 litri, che bastano per 600 km. A 80 km/h servono 7 ore e mezza, cioè 450 minuti. Con 40 minuti di sosta sono 8 ore e 10 minuti: partendo alle 6:20 si arriva alle 14:30.",
  },
];

export default varianti;
