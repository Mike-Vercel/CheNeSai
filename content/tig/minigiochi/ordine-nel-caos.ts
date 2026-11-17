import type { OrdineInput } from "@/lib/tig/games/mechanics/ordine-nel-caos";

/**
 * 05 · ORDINE NEL CAOS — varianti. Ogni storia ha UNA sola catena causale: ogni passo nomina o richiede
 * il precedente, così nessun altro ordine è difendibile. L'ordine degli elementi qui sotto NON è la
 * soluzione (la soluzione è in `solution.order`).
 */
const varianti: OrdineInput[] = [
  {
    id: "volo-low-cost",
    prompt: "Il weekend low cost",
    items: [
      { id: "gate", text: "Al gate scoprite che il bagaglio a mano costa più del volo." },
      { id: "sondaggio", text: "Il sondaggio sul volo da 19 euro chiude: cinque sì su sei." },
      { id: "volo", text: "Nel gruppo qualcuno trova un volo per il weekend a 19 euro." },
      { id: "conferma", text: "Arriva la mail di conferma: i sei posti sono vostri." },
    ],
    solution: { order: ["volo", "sondaggio", "conferma", "gate"] },
    explain: "Prima si trova il volo, poi il gruppo vota proprio quel volo, poi si compra (mail di conferma) e solo in aeroporto, al gate, arriva la sorpresa del bagaglio.",
  },
  {
    id: "conto-compleanno",
    prompt: "La cena di compleanno",
    items: [
      { id: "richiesta", text: "Nel gruppo arriva la richiesta: 26 euro a testa entro domenica." },
      { id: "prenota", text: "Giada prenota un tavolo per dodici a nome suo." },
      { id: "paga", text: "Giada paga tutto con la sua carta per non bloccare la cassa." },
      { id: "conto", text: "A fine cena arriva un conto unico da 312 euro." },
    ],
    solution: { order: ["prenota", "conto", "paga", "richiesta"] },
    explain: "Senza prenotazione non c'è cena; il conto arriva a fine cena; Giada lo paga; solo dopo può chiedere la quota: 312 diviso 12 fa proprio 26 euro.",
  },
  {
    id: "bolletta-stufetta",
    prompt: "La bolletta dei coinquilini",
    items: [
      { id: "regola", text: "In casa si vota una regola nuova: stufetta spenta dopo mezzanotte." },
      { id: "doppia", text: "La bolletta della luce arriva doppia rispetto al solito." },
      { id: "normale", text: "La bolletta del mese dopo torna quella di sempre." },
      { id: "indagine", text: "Indagando, si scopre che la stufetta di Ivo resta accesa tutta la notte." },
    ],
    solution: { order: ["doppia", "indagine", "regola", "normale"] },
    explain: "La bolletta doppia fa partire l'indagine; l'indagine trova la stufetta; la stufetta porta alla regola; la regola fa tornare normale la bolletta successiva.",
  },
  {
    id: "trasloco-divano",
    prompt: "Il trasloco del sabato",
    items: [
      { id: "vendita", text: "Il divano finisce in vendita online a 50 euro." },
      { id: "furgone", text: "Prenotate il furgone per il giorno della consegna delle chiavi." },
      { id: "porta", text: "Il divano non passa dalla porta del nuovo condominio." },
      { id: "contratto", text: "Firmate il contratto: le chiavi vi arrivano sabato." },
    ],
    solution: { order: ["contratto", "furgone", "porta", "vendita"] },
    explain: "Il giorno delle chiavi esiste solo dopo la firma; il furgone si prenota per quel giorno; arrivati lì il divano non passa dalla porta; e allora finisce in vendita.",
  },
  {
    id: "appuntamento-libro",
    prompt: "Il primo appuntamento",
    items: [
      { id: "verdetto", text: "Nel gruppo delle amiche il verdetto: «Almeno il libro era bello»." },
      { id: "match", text: "Match in app: lui propone un caffè sabato alle 17." },
      { id: "attesa", text: "Mentre aspetta, lei finisce il libro che si era portata." },
      { id: "ritardo", text: "Sabato, lei è al bar e lui scrive: «Sono in ritardo di 40 minuti»." },
    ],
    solution: { order: ["match", "ritardo", "attesa", "verdetto"] },
    explain: "Il caffè nasce dal match; sabato al bar arriva il messaggio del ritardo; il ritardo le lascia il tempo di finire il libro; il commento delle amiche parla di quel libro.",
  },
  {
    id: "biglietti-concerto",
    prompt: "I biglietti del concerto",
    items: [
      { id: "assistenza", text: "L'assistenza risponde: il cambio di nome costa 15 euro." },
      { id: "coda", text: "Aprono le vendite: 40 minuti di coda online." },
      { id: "chi-paga", text: "Il gruppo decide: i 15 euro li paga chi ha scritto male il nome." },
      { id: "nome", text: "Comprate quattro biglietti, ma su uno il nome è sbagliato." },
    ],
    solution: { order: ["coda", "nome", "assistenza", "chi-paga"] },
    explain: "Si comprano i biglietti dopo la coda; solo dopo l'acquisto si scopre il nome sbagliato; per correggerlo si scrive all'assistenza; il costo comunicato decide chi paga.",
  },
  {
    id: "abbonamento-palestra",
    prompt: "L'abbonamento annuale",
    items: [
      { id: "orari", text: "A febbraio la palestra cambia orari: chiude alle 20." },
      { id: "rimborso", text: "A marzo chiedi il rimborso e ti offrono tre mesi gratis." },
      { id: "iscrizione", text: "A gennaio fai l'abbonamento annuale in palestra." },
      { id: "smetti", text: "Esci dall'ufficio alle 19:45: smetti di andarci." },
    ],
    solution: { order: ["iscrizione", "orari", "smetti", "rimborso"] },
    explain: "Prima l'abbonamento; poi il cambio d'orario; con la chiusura alle 20 e l'uscita dall'ufficio alle 19:45 smetti di andarci; quindi chiedi il rimborso. I mesi confermano l'ordine.",
  },
  {
    id: "basilico-vicina",
    prompt: "Dieci giorni di ferie",
    items: [
      { id: "regalo", text: "La vicina ti regala un basilico nuovo per farsi perdonare." },
      { id: "dimentica", text: "La vicina si dimentica di annaffiare il basilico." },
      { id: "secco", text: "Al rientro trovi il basilico secco sul davanzale." },
      { id: "chiavi", text: "Prima di partire lasci le chiavi di casa alla vicina." },
    ],
    solution: { order: ["chiavi", "dimentica", "secco", "regalo"] },
    explain: "Senza chiavi la vicina non può entrare ad annaffiare; la dimenticanza secca la pianta; la scopri al rientro; il regalo serve a farsi perdonare proprio quello.",
  },
  {
    id: "foto-occhi-chiusi",
    prompt: "La foto di gruppo",
    items: [
      { id: "nuova", text: "La nuova foto prende il triplo delle reazioni." },
      { id: "pubblichi", text: "Pubblichi una foto del gruppo senza chiedere a nessuno." },
      { id: "sostituisci", text: "Togli la foto e ne carichi un'altra dello stesso pomeriggio." },
      { id: "dalia", text: "Dalia ti scrive: in quella foto lei ha gli occhi chiusi." },
    ],
    solution: { order: ["pubblichi", "dalia", "sostituisci", "nuova"] },
    explain: "Dalia può lamentarsi solo di una foto già pubblicata; la sua richiesta ti fa cambiare foto; le reazioni arrivano alla foto nuova.",
  },
];

export default varianti;
