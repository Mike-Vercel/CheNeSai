import type { IndizioInput } from "@/lib/tig/games/mechanics/indizio-dopo-indizio";

/**
 * 15 · INDIZIO DOPO INDIZIO — varianti. Scala di difficoltà uguale per tutte:
 * il 1° indizio va bene per almeno 3 opzioni, 1°+2° per esattamente 2, tutti e tre per una sola.
 */
const varianti: IndizioInput[] = [
  {
    id: "stendino",
    category: "Un oggetto di casa",
    clues: [
      "Ha a che fare con il bucato.",
      "Non si attacca alla corrente.",
      "Si apre a ventaglio e, quando è carico, blocca il corridoio.",
    ],
    options: [
      { id: "stendino", text: "Lo stendino" },
      { id: "ferro", text: "Il ferro da stiro" },
      { id: "lavatrice", text: "La lavatrice" },
      { id: "asciugatrice", text: "L'asciugatrice" },
      { id: "cesto", text: "Il cesto della biancheria" },
      { id: "aspirapolvere", text: "L'aspirapolvere" },
    ],
    solution: { optionId: "stendino" },
    explain: "Bucato: stendino, ferro, lavatrice, asciugatrice, cesto. Senza corrente restano stendino e cesto. Solo lo stendino si apre a ventaglio e invade il corridoio.",
  },
  {
    id: "power-bank",
    category: "Un oggetto in borsa",
    clues: [
      "Ha a che fare con il telefono.",
      "Prima di usarlo, va caricato a sua volta.",
      "Ricarica il telefono quando non c'è una presa nei paraggi.",
    ],
    options: [
      { id: "powerbank", text: "Il power bank" },
      { id: "caricatore", text: "Il caricabatterie da muro" },
      { id: "auricolari", text: "Gli auricolari senza fili" },
      { id: "chiavi", text: "Le chiavi di casa" },
      { id: "portafoglio", text: "Il portafoglio" },
      { id: "ombrello", text: "L'ombrello pieghevole" },
    ],
    solution: { optionId: "powerbank" },
    explain: "Col telefono: power bank, caricabatterie, auricolari. Da caricare prima dell'uso: power bank e auricolari. Solo il power bank ricarica il telefono lontano da una presa.",
  },
  {
    id: "brunch",
    category: "Un'abitudine del weekend",
    clues: [
      "Si fa seduti a tavola.",
      "Conviene prenotare, perché i posti finiscono.",
      "Uova, pancake e avocado, ma mai prima delle undici.",
    ],
    options: [
      { id: "brunch", text: "Il brunch" },
      { id: "colazione", text: "La colazione al bar" },
      { id: "nonna", text: "Il pranzo dalla nonna" },
      { id: "cena", text: "La cena fuori" },
      { id: "picnic", text: "Il picnic al parco" },
      { id: "mercato", text: "La spesa al mercato" },
    ],
    solution: { optionId: "brunch" },
    explain: "A tavola: brunch, colazione al bar, pranzo dalla nonna, cena fuori. Da prenotare: brunch e cena fuori. Uova, pancake e «non prima delle undici» è il brunch.",
  },
  {
    id: "tazza-ufficio",
    category: "Un oggetto da ufficio",
    clues: [
      "Te lo porti da casa.",
      "Lo usi più volte al giorno.",
      "Lo lavi nel lavandino della cucinetta.",
    ],
    options: [
      { id: "tazza", text: "La tazza col tuo nome" },
      { id: "cuffie", text: "Le cuffie col microfono" },
      { id: "pianta", text: "La piantina sulla scrivania" },
      { id: "badge", text: "Il badge aziendale" },
      { id: "sedia", text: "La sedia ergonomica" },
      { id: "postit", text: "Il blocchetto di post-it" },
    ],
    solution: { optionId: "tazza" },
    explain: "Da casa: tazza, cuffie, piantina (badge, sedia e post-it li dà l'ufficio). Più volte al giorno: tazza e cuffie. Nel lavandino si lava solo la tazza.",
  },
  {
    id: "carta-imbarco",
    category: "Una cosa da viaggio",
    clues: [
      "Senza, non parti.",
      "Ha un orario stampato sopra.",
      "C'è scritto il gate.",
    ],
    options: [
      { id: "imbarco", text: "La carta d'imbarco" },
      { id: "passaporto", text: "Il passaporto" },
      { id: "treno", text: "Il biglietto del treno" },
      { id: "valigia", text: "La valigia" },
      { id: "cuscino", text: "Il cuscino da collo" },
      { id: "adattatore", text: "L'adattatore per le prese" },
    ],
    solution: { optionId: "imbarco" },
    explain: "Senza non si parte: carta d'imbarco, passaporto, biglietto del treno. Con un orario stampato: carta d'imbarco e biglietto del treno. Il gate c'è solo sulla carta d'imbarco.",
  },
  {
    id: "vocale",
    category: "Una cosa che arriva in chat",
    clues: [
      "Si ascolta o si guarda, non si legge.",
      "Ha una durata.",
      "Lo ascolti col telefono all'orecchio, senza guardare lo schermo.",
    ],
    options: [
      { id: "vocale", text: "Il vocale da 4 minuti" },
      { id: "video", text: "Il videomessaggio" },
      { id: "sticker", text: "Lo sticker" },
      { id: "foto", text: "La foto della cena" },
      { id: "eliminato", text: "Il messaggio eliminato" },
      { id: "spunte", text: "Le spunte blu senza risposta" },
    ],
    solution: { optionId: "vocale" },
    explain: "Da ascoltare o guardare: vocale, videomessaggio, sticker, foto. Con una durata: vocale e videomessaggio. Col telefono all'orecchio senza guardare si ascolta solo il vocale.",
  },
  {
    id: "carta-igienica",
    category: "Una spesa da coinquilini",
    clues: [
      "Si compra al supermercato.",
      "Finisce in fretta e va ricomprata quasi ogni settimana.",
      "Si compra a pacchi da dodici rotoli.",
    ],
    options: [
      { id: "carta", text: "La carta igienica" },
      { id: "detersivo", text: "Il detersivo dei piatti" },
      { id: "sale", text: "Il sale" },
      { id: "gas", text: "La bolletta del gas" },
      { id: "streaming", text: "L'abbonamento allo streaming" },
      { id: "wifi", text: "Il wi-fi" },
    ],
    solution: { optionId: "carta" },
    explain: "Al supermercato: carta igienica, detersivo, sale. Da ricomprare quasi ogni settimana: carta e detersivo (il sale dura mesi). A rotoli da dodici: la carta igienica.",
  },
  {
    id: "lavanderia",
    category: "Un posto in città",
    clues: [
      "Ci vai e passi il tempo ad aspettare.",
      "Ci arrivi con una borsa piena di roba.",
      "Mentre aspetti, guardi i tuoi vestiti girare dietro un oblò.",
    ],
    options: [
      { id: "lavanderia", text: "La lavanderia a gettoni" },
      { id: "posta", text: "L'ufficio postale" },
      { id: "fermata", text: "La fermata del tram" },
      { id: "palestra", text: "La palestra" },
      { id: "biblioteca", text: "La biblioteca" },
      { id: "parcheggio", text: "Il parcheggio" },
    ],
    solution: { optionId: "lavanderia" },
    explain: "Si aspetta: lavanderia, ufficio postale, fermata del tram. Con una borsa piena di roba: lavanderia e posta (i pacchi). I vestiti che girano dietro l'oblò: la lavanderia.",
  },
];

export default varianti;
