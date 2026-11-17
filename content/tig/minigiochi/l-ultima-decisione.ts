import type { DecisioneInput } from "@/lib/tig/games/mechanics/l-ultima-decisione";

/**
 * 80 · L'ULTIMA DECISIONE — il grande enigma finale, uguale per tutti: il titolo si vede durante la scelta
 * (15 secondi), poi circa 60 secondi per risolvere. Ragionamento logico o pratico con un'idea che fa dire
 * «ma certo!», mai trivia. Niente `balances`: li inietta il runtime. Soluzioni verificate.
 */
const varianti: DecisioneInput[] = [
  // --- facili ---
  {
    id: "prevendita-concerto",
    difficulty: "facile",
    title: "Il biglietto del concerto",
    prompt: "Biglietto e prevendita del concerto costano 55 € in tutto. Il biglietto costa 50 € più della prevendita. Quanto costa la prevendita?",
    options: [
      { id: "a", text: "5 €" },
      { id: "b", text: "2,50 €" },
      { id: "c", text: "7,50 €" },
      { id: "d", text: "4 €" },
    ],
    solution: { optionId: "b" },
    explain: "Se la prevendita costa 2,50 €, il biglietto costa 52,50 € (50 € in più) e insieme fanno 55 €. Con 5 € di prevendita il biglietto costerebbe 55 € e il totale salirebbe a 60 €.",
  },
  {
    id: "calzini-al-buio",
    difficulty: "facile",
    title: "I calzini al buio",
    prompt: "Salta la luce e devi vestirti al buio. Nel cassetto ci sono 10 calzini neri e 10 blu, tutti sciolti. Ti serve un paio di calzini neri. Quanti calzini devi prendere, come minimo, per essere sicuro di averne due neri?",
    options: [
      { id: "a", text: "3 calzini" },
      { id: "b", text: "11 calzini" },
      { id: "c", text: "20 calzini" },
      { id: "d", text: "12 calzini" },
    ],
    solution: { optionId: "d" },
    explain: "Nel caso più sfortunato peschi prima tutti e 10 i blu: a quel punto ti servono altri 2 calzini, per forza neri. In tutto 12. Con 3 calzini hai la certezza di un paio dello stesso colore, ma non per forza nero.",
  },
  {
    id: "video-virale",
    difficulty: "facile",
    title: "Il video che gira nelle chat",
    prompt: "Il video del gatto di Bea che suona il campanello gira nelle chat: ogni ora il numero di persone che l'hanno visto raddoppia. Dopo 12 ore l'ha visto tutto il paese. Dopo quante ore l'aveva visto metà del paese?",
    options: [
      { id: "a", text: "6 ore" },
      { id: "b", text: "9 ore" },
      { id: "c", text: "11 ore" },
      { id: "d", text: "10 ore" },
    ],
    solution: { optionId: "c" },
    explain: "Se il numero raddoppia ogni ora, un'ora prima della fine era esattamente la metà: dopo 11 ore l'aveva visto metà del paese, e alla dodicesima ora, raddoppiando, tutto il paese.",
  },
  {
    id: "scale-del-trasloco",
    difficulty: "facile",
    title: "Le scale del trasloco",
    prompt: "Trasloco senza ascensore. Con uno scatolone in braccio, dal primo al terzo piano ci metti 40 secondi. Allo stesso ritmo, quanto ci metti dal primo al sesto piano?",
    options: [
      { id: "a", text: "1 minuto e 20 secondi" },
      { id: "b", text: "1 minuto e 40 secondi" },
      { id: "c", text: "2 minuti" },
      { id: "d", text: "1 minuto e 30 secondi" },
    ],
    solution: { optionId: "b" },
    explain: "Dal primo al terzo si salgono 2 piani, non 3: 20 secondi a piano. Dal primo al sesto se ne salgono 5: 5 × 20 = 100 secondi, cioè 1 minuto e 40 secondi.",
  },
  // --- medie ---
  {
    id: "barattoli-traditori",
    difficulty: "media",
    title: "I barattoli traditori",
    prompt: "In cucina ci sono tre barattoli: «Sale», «Zucchero» e «Sale e zucchero». Il coinquilino burlone ha messo tutte e tre le etichette al posto sbagliato. Puoi assaggiare un solo granello da un solo barattolo. Da quale, per sistemarle tutte?",
    options: [
      { id: "a", text: "Da quello con scritto «Sale»" },
      { id: "b", text: "Da quello con scritto «Zucchero»" },
      { id: "c", text: "Da quello con scritto «Sale e zucchero»" },
      { id: "d", text: "Non basta: bisogna assaggiare almeno due barattoli" },
    ],
    solution: { optionId: "c" },
    explain: "Il barattolo «Sale e zucchero» non è il misto, quindi è puro: un granello dice se è sale o zucchero. Se è sale, quello con scritto «Zucchero» non è zucchero e non è sale: è il misto, e l'ultimo è lo zucchero. Se è zucchero, stesso ragionamento a parti invertite.",
  },
  {
    id: "tre-interruttori",
    difficulty: "media",
    title: "I tre interruttori",
    prompt: "Casa nuova: in cantina ci sono tre interruttori e uno solo accende la vecchia lampadina della soffitta, tre piani più su. Puoi azionarli quanto vuoi, ma salire a guardare una volta sola. Come scopri quello giusto?",
    options: [
      { id: "a", text: "Ne tieni acceso uno per 10 minuti, lo spegni, accendi il secondo e sali: guardi e tocchi la lampadina" },
      { id: "b", text: "Li accendi tutti e tre, poi li spegni uno alla volta ascoltando il ronzio dei fili" },
      { id: "c", text: "Accendi i primi due insieme e sali: se la lampadina è accesa, è uno dei due" },
      { id: "d", text: "Non si può: servono almeno due salite in soffitta" },
    ],
    solution: { optionId: "a" },
    explain: "Accendi il primo per qualche minuto e lo spegni, poi accendi il secondo e sali. Lampadina accesa: è il secondo. Spenta ma calda: è il primo, che ha fatto in tempo a scaldarla. Spenta e fredda: è il terzo.",
  },
  {
    id: "cane-fa-la-spola",
    difficulty: "media",
    title: "Il cane fa la spola",
    prompt: "Ada e Leo sono a 30 km di distanza e si vengono incontro in bici, ognuno a 15 km/h. Il cane di Ada parte con lei e corre a 20 km/h avanti e indietro tra i due, senza mai fermarsi, finché non si incontrano. Quanti km fa il cane?",
    options: [
      { id: "a", text: "30 km" },
      { id: "b", text: "15 km" },
      { id: "c", text: "Infiniti: continua a girarsi all'infinito" },
      { id: "d", text: "20 km" },
    ],
    solution: { optionId: "d" },
    explain: "Inutile inseguire il cane: Ada e Leo si avvicinano di 30 km all'ora, quindi si incontrano dopo un'ora esatta. In quell'ora il cane corre sempre a 20 km/h: fa 20 km.",
  },
  {
    id: "cornetto-ripieno-doppio",
    difficulty: "media",
    title: "Il cornetto col ripieno doppio",
    prompt: "Ci sono 9 cornetti identici, ma uno ha il ripieno doppio e pesa un po' di più. Hai una bilancia a due piatti, senza pesi. Quante pesate ti servono, come minimo, per essere sicuro di trovarlo?",
    options: [
      { id: "a", text: "1 pesata" },
      { id: "b", text: "2 pesate" },
      { id: "c", text: "3 pesate" },
      { id: "d", text: "4 pesate" },
    ],
    solution: { optionId: "b" },
    explain: "Fai tre gruppi da 3 e metti un gruppo per piatto: se un piatto scende il cornetto è lì, se stanno pari è nel gruppo fuori. Con quei 3 rifai lo stesso: uno per piatto e uno fuori. Due pesate bastano sempre; una no, perché ha solo tre esiti per nove cornetti.",
  },
  // --- difficili ---
  {
    id: "ponte-al-buio",
    difficulty: "difficile",
    title: "Il ponte al buio",
    prompt: "Quattro amici devono passare un ponticello al buio con una sola torcia. Passano al massimo in due, al passo del più lento, e la torcia va sempre riportata indietro. Da soli ci mettono 1, 2, 5 e 10 minuti. In quanto tempo, al minimo, passano tutti?",
    options: [
      { id: "a", text: "19 minuti" },
      { id: "b", text: "18 minuti" },
      { id: "c", text: "17 minuti" },
      { id: "d", text: "21 minuti" },
    ],
    solution: { optionId: "c" },
    explain: "Il trucco è far passare insieme i due più lenti. Passano 1 e 2 (2 minuti), torna 1 (1), passano 5 e 10 (10), torna 2 (2), ripassano 1 e 2 (2): 17 minuti. Facendo accompagnare tutti dal più veloce se ne spendono 19.",
  },
  {
    id: "coinquilino-bugiardo",
    difficulty: "difficile",
    title: "Il coinquilino bugiardo",
    prompt: "Le chiavi sono in uno di due cassetti. Davanti hai due coinquilini: uno dice sempre la verità, l'altro mente sempre, e non sai chi è chi. Puoi fare una sola domanda a uno solo dei due. Quale ti fa trovare le chiavi a colpo sicuro?",
    options: [
      { id: "a", text: "«Dove sono le chiavi?», e apri il cassetto indicato" },
      { id: "b", text: "«Dove sono le chiavi?», e apri l'altro cassetto" },
      { id: "c", text: "«Sei tu quello sincero?», e poi decidi di chi fidarti" },
      { id: "d", text: "«Quale cassetto mi indicherebbe il tuo coinquilino?», e apri quello opposto" },
    ],
    solution: { optionId: "d" },
    explain: "Chiedi a uno qualsiasi quale cassetto indicherebbe l'altro. Il sincero ti riferisce fedelmente la bugia del compagno; il bugiardo ti stravolge la verità del compagno. In tutti e due i casi ti indicano il cassetto sbagliato: apri l'altro.",
  },
  {
    id: "confezione-sbagliata",
    difficulty: "difficile",
    title: "La confezione sbagliata",
    prompt: "Hai 5 confezioni piene di biscotti identici a vista. In quattro ogni biscotto pesa 10 g, in una 11 g. Hai una bilancia da cucina digitale e puoi fare una pesata sola. Come trovi la confezione sbagliata?",
    options: [
      { id: "a", text: "Prendi un biscotto da ogni confezione e li pesi tutti insieme" },
      { id: "b", text: "Prendi 1 biscotto dalla prima confezione, 2 dalla seconda, 3 dalla terza e così via, e pesi tutto insieme" },
      { id: "c", text: "Metti sulla bilancia tutte e 5 le confezioni chiuse e guardi il totale" },
      { id: "d", text: "Non si può: servono almeno due pesate" },
    ],
    solution: { optionId: "b" },
    explain: "Con 1, 2, 3, 4 e 5 biscotti presi in ordine dalle confezioni, se fossero tutti da 10 g la bilancia segnerebbe 150 g. Ogni grammo in più è un biscotto da 11 g: se segna 153 g, la confezione sbagliata è la terza.",
  },
  {
    id: "compleanno-impossibile",
    difficulty: "difficile",
    title: "Il compleanno impossibile",
    prompt: "L'altro ieri Bea aveva 24 anni. L'anno prossimo ne compirà 27. Bea non mente e non sbaglia i conti. In che giorno è il suo compleanno?",
    options: [
      { id: "a", text: "Il 1° gennaio" },
      { id: "b", text: "Il 29 febbraio" },
      { id: "c", text: "Il 30 dicembre" },
      { id: "d", text: "Il 31 dicembre" },
    ],
    solution: { optionId: "d" },
    explain: "Oggi è il 1° gennaio. L'altro ieri, 30 dicembre, Bea aveva ancora 24 anni; ieri, 31 dicembre, ne ha compiuti 25; il prossimo 31 dicembre, ancora quest'anno, ne compirà 26 e l'anno prossimo 27. Funziona solo col compleanno il 31 dicembre.",
  },
];

export default varianti;
