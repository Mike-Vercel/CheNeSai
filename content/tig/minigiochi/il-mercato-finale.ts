import type { MercatoInput } from "@/lib/tig/games/mechanics/il-mercato-finale";

/**
 * 75 · IL MERCATO FINALE — un enigma con una trappola e un banco con tre indizi a prezzo crescente:
 * il più economico dà una spinta, quello medio elimina una risposta sbagliata, il più caro lascia due risposte
 * o dà il passaggio chiave. Nessun indizio dice la risposta. Niente `balances`: li inietta il runtime.
 * Calcoli verificati con node.
 */
const varianti: MercatoInput[] = [
  {
    id: "buono-e-sconto",
    difficulty: "facile",
    title: "Il buono e lo sconto",
    prompt: "Una giacca costa 80 €. In cassa si applica prima lo sconto del 25% e poi, sul prezzo già scontato, un buono da 10 €. Quanto pagate alla fine?",
    options: [
      { id: "a", text: "50 €" },
      { id: "b", text: "52,50 €" },
      { id: "c", text: "45 €" },
      { id: "d", text: "60 €" },
    ],
    hints: [
      { id: "spinta", price: 10, label: "Una spinta sul ragionamento", text: "Rispettate l'ordine: il 25% si calcola sugli 80 € pieni, e solo dopo si toglie il buono. Un quarto di 80 si fa a mente." },
      { id: "elimina", price: 25, label: "Elimina una risposta sbagliata", text: "Non è «52,50 €»: quello è il prezzo che esce usando il buono prima dello sconto." },
      { id: "due", price: 45, label: "Restano solo due risposte", text: "Non è «60 €» e non è «52,50 €»: la risposta è una delle altre due." },
    ],
    solution: { optionId: "a" },
    explain: "Il 25% di 80 € è 20 €: la giacca scende a 60 €. Poi si toglie il buono da 10 €: 50 €.",
  },
  {
    id: "treno-per-la-cena",
    difficulty: "facile",
    title: "In orario per la cena?",
    prompt: "Prendete il treno delle 18:52, che ci mette 47 minuti. Dalla stazione al ristorante sono 12 minuti a piedi. Il tavolo è prenotato alle 20:00. Come arrivate?",
    options: [
      { id: "a", text: "9 minuti in anticipo" },
      { id: "b", text: "1 minuto in anticipo" },
      { id: "c", text: "1 minuto in ritardo" },
      { id: "d", text: "11 minuti in anticipo" },
    ],
    hints: [
      { id: "spinta", price: 5, label: "Una spinta sul ragionamento", text: "Un passo alla volta: prima l'orario d'arrivo del treno, poi la camminata. 52 più 47 supera 60: occhio al cambio d'ora." },
      { id: "elimina", price: 20, label: "Elimina una risposta sbagliata", text: "Al ristorante non arrivate in ritardo: «1 minuto in ritardo» è sbagliata." },
      { id: "chiave", price: 40, label: "Il passaggio chiave", text: "Il treno arriva in stazione alle 19:39. Da lì in poi tocca a voi." },
    ],
    solution: { optionId: "a" },
    explain: "18:52 più 47 minuti fa 19:39. Con 12 minuti a piedi si arriva alle 19:51: 9 minuti prima delle 20:00.",
  },
  {
    id: "giorno-del-matrimonio",
    difficulty: "facile",
    title: "Il giorno del matrimonio",
    prompt: "Oggi è martedì. Il matrimonio di Giulia e Marco è tra esattamente 30 giorni. Che giorno della settimana sarà?",
    options: [
      { id: "lun", text: "Lunedì" },
      { id: "mar", text: "Martedì" },
      { id: "gio", text: "Giovedì" },
      { id: "ven", text: "Venerdì" },
    ],
    hints: [
      { id: "spinta", price: 10, label: "Una spinta sul ragionamento", text: "Ogni 7 giorni si torna allo stesso giorno della settimana. Quante settimane intere stanno in 30 giorni, e quanti giorni avanzano?" },
      { id: "elimina", price: 20, label: "Elimina una risposta sbagliata", text: "Non è «Martedì»: 30 non è un multiplo di 7." },
      { id: "due", price: 35, label: "Restano solo due risposte", text: "Non è «Lunedì» e non è «Martedì»: la risposta è una delle altre due." },
    ],
    solution: { optionId: "gio" },
    explain: "In 30 giorni ci sono 4 settimane intere (28 giorni) e ne avanzano 2. Da martedì, due giorni dopo è giovedì.",
  },
  {
    id: "coda-del-concerto",
    difficulty: "facile",
    title: "La coda per il concerto",
    prompt: "In coda per il concerto, Bea è la settima partendo da davanti e la dodicesima partendo da dietro. Quante persone ci sono in coda?",
    options: [
      { id: "a", text: "17" },
      { id: "b", text: "18" },
      { id: "c", text: "19" },
      { id: "d", text: "20" },
    ],
    hints: [
      { id: "spinta", price: 10, label: "Una spinta sul ragionamento", text: "Contate quante persone ci sono davanti a Bea e quante dietro di lei. Poi non dimenticate Bea." },
      { id: "elimina", price: 25, label: "Elimina una risposta sbagliata", text: "Non è «19»: sommando 7 e 12 Bea viene contata due volte." },
      { id: "due", price: 50, label: "Restano solo due risposte", text: "La risposta è «17» oppure «18»." },
    ],
    solution: { optionId: "b" },
    explain: "Davanti a Bea ci sono 6 persone, dietro 11. Con lei: 6 + 11 + 1 = 18.",
  },
  {
    id: "mail-infinite",
    difficulty: "media",
    title: "Le mail che non finiscono mai",
    prompt: "Lunedì mattina Giulia ha 100 mail da smaltire. Ogni giorno ne chiude 30, ma ogni notte ne arrivano 20 nuove. In quale giorno arriva a zero mail per la prima volta?",
    options: [
      { id: "a", text: "Il 7° giorno" },
      { id: "b", text: "L'8° giorno" },
      { id: "c", text: "Il 10° giorno" },
      { id: "d", text: "L'11° giorno" },
    ],
    hints: [
      { id: "spinta", price: 10, label: "Una spinta sul ragionamento", text: "Non basta fare 100 diviso 10: l'ultimo giorno le mail finiscono prima che di notte ne arrivino altre." },
      { id: "elimina", price: 25, label: "Elimina una risposta sbagliata", text: "Non è «Il 10° giorno»: è il conto di chi dimentica come va l'ultimo giorno." },
      { id: "chiave", price: 45, label: "Il passaggio chiave", text: "Ogni mattina la pila è 10 mail più bassa del mattino prima. Il giorno in cui la pila del mattino è di 30 mail o meno, Giulia la chiude tutta." },
    ],
    solution: { optionId: "b" },
    explain: "Ogni mattina la pila è 10 mail più bassa: 100, 90, 80, 70, 60, 50, 40, 30. L'8° giorno parte da 30 e Giulia le chiude tutte prima che ne arrivino altre.",
  },
  {
    id: "quinto-al-conto",
    difficulty: "media",
    title: "Il quinto amico al conto",
    prompt: "Quattro amici hanno pagato in media 15 € a testa. Arriva un quinto amico, paga la sua parte e la media di tutti e cinque scende a 14 €. Quanto ha pagato il quinto?",
    options: [
      { id: "a", text: "9 €" },
      { id: "b", text: "10 €" },
      { id: "c", text: "13 €" },
      { id: "d", text: "14 €" },
    ],
    hints: [
      { id: "spinta", price: 5, label: "Una spinta sul ragionamento", text: "Lavorate sui totali, non sulle medie: quanto hanno pagato in tutto i primi quattro?" },
      { id: "elimina", price: 20, label: "Elimina una risposta sbagliata", text: "Non è «14 €»: con 14 € la media di tutti e cinque resterebbe sopra i 14 €." },
      { id: "due", price: 40, label: "Restano solo due risposte", text: "La risposta è «9 €» oppure «10 €»." },
    ],
    solution: { optionId: "b" },
    explain: "I primi quattro hanno pagato 4 × 15 = 60 €. In cinque con media 14 € il totale è 70 €: il quinto ha messo 10 €.",
  },
  {
    id: "scale-del-trasloco",
    difficulty: "media",
    title: "Le scale del trasloco",
    prompt: "Con uno scatolone in braccio, Luca va dal 1° al 3° piano in 30 secondi. Alla stessa velocità, quanti secondi gli servono per andare dal 1° al 6° piano?",
    options: [
      { id: "a", text: "60 secondi" },
      { id: "b", text: "75 secondi" },
      { id: "c", text: "90 secondi" },
      { id: "d", text: "80 secondi" },
    ],
    hints: [
      { id: "spinta", price: 10, label: "Una spinta sul ragionamento", text: "Contate i piani che Luca sale davvero, non il numero scritto sul pianerottolo." },
      { id: "elimina", price: 25, label: "Elimina una risposta sbagliata", text: "Non è «60 secondi»: dal 1° al 6° non è il doppio della strada che c'è dal 1° al 3°." },
      { id: "chiave", price: 50, label: "Il passaggio chiave", text: "Dal 1° al 3° piano Luca sale due piani, non tre." },
    ],
    solution: { optionId: "b" },
    explain: "Dal 1° al 3° si salgono 2 piani: 15 secondi a piano. Dal 1° al 6° sono 5 piani: 5 × 15 = 75 secondi.",
  },
  {
    id: "borraccia-e-tappo",
    difficulty: "media",
    title: "La borraccia e il tappo",
    prompt: "Una borraccia e un tappo di ricambio costano 11 € in tutto. La borraccia costa 10 € più del tappo. Quanto costa il tappo?",
    options: [
      { id: "a", text: "1 €" },
      { id: "b", text: "0,50 €" },
      { id: "c", text: "0,10 €" },
      { id: "d", text: "1,50 €" },
    ],
    hints: [
      { id: "spinta", price: 10, label: "Una spinta sul ragionamento", text: "Verificate la risposta che viene d'istinto: con quel tappo, quanto costerebbe la borraccia? E il totale?" },
      { id: "elimina", price: 30, label: "Elimina una risposta sbagliata", text: "Non è «1 €»: con un tappo da 1 € la borraccia costerebbe 11 € e il totale 12 €." },
      { id: "due", price: 50, label: "Restano solo due risposte", text: "La risposta è «0,50 €» oppure «0,10 €»." },
    ],
    solution: { optionId: "b" },
    explain: "Se il tappo costa 0,50 €, la borraccia costa 10,50 €: in tutto 11 €, e la differenza è proprio 10 €. Con il tappo a 1 € il totale sarebbe 12 €.",
  },
  {
    id: "calzini-al-buio",
    difficulty: "difficile",
    title: "I calzini al buio",
    prompt: "Nel cassetto ci sono 6 calzini neri e 6 blu, tutti sciolti, ed è saltata la luce. Quanti calzini dovete prendere, come minimo, per essere sicuri di averne due neri?",
    options: [
      { id: "a", text: "3" },
      { id: "b", text: "7" },
      { id: "c", text: "8" },
      { id: "d", text: "12" },
    ],
    hints: [
      { id: "spinta", price: 15, label: "Una spinta sul ragionamento", text: "Pensate al caso più sfortunato possibile: quali calzini vi capitano in mano per primi?" },
      { id: "elimina", price: 30, label: "Elimina una risposta sbagliata", text: "Non è «3»: con tre calzini avete sicuramente un paio dello stesso colore, ma non per forza neri." },
      { id: "due", price: 50, label: "Restano solo due risposte", text: "La risposta è «7» oppure «8»." },
    ],
    solution: { optionId: "c" },
    explain: "Nel caso peggiore pescate prima tutti e 6 i blu. Poi servono altri 2 calzini, che a quel punto sono per forza neri: 6 + 2 = 8.",
  },
  {
    id: "orologio-della-cucina",
    difficulty: "difficile",
    title: "L'orologio della cucina",
    prompt: "L'orologio della cucina va avanti di 5 minuti ogni ora. Lo rimettete giusto alle 8:00 del mattino. Quando l'orologio segna le 14:30, che ore sono davvero?",
    options: [
      { id: "a", text: "14:00" },
      { id: "b", text: "13:57:30" },
      { id: "c", text: "13:55" },
      { id: "d", text: "14:05" },
    ],
    hints: [
      { id: "spinta", price: 15, label: "Una spinta sul ragionamento", text: "In ogni ora vera l'orologio fa passare 65 minuti, non 60. Il ritardo da correggere si conta sulle ore vere, non su quelle segnate." },
      { id: "elimina", price: 35, label: "Elimina una risposta sbagliata", text: "Non è «13:57:30»: quello è il conto fatto sulle 6 ore e mezza segnate dall'orologio, non sulle ore vere." },
      { id: "due", price: 50, label: "Restano solo due risposte", text: "La risposta è «14:00» oppure «13:57:30»." },
    ],
    solution: { optionId: "a" },
    explain: "In ogni ora vera l'orologio segna 65 minuti. Dalle 8:00 ha segnato 6 ore e 30 minuti, cioè 390 minuti: 390 ÷ 65 = 6 ore vere. Sono le 14:00, e infatti in 6 ore è andato avanti di 30 minuti.",
  },
  {
    id: "andata-e-ritorno",
    difficulty: "difficile",
    title: "La media del giro al lago",
    prompt: "Andate al lago a 60 km/h di media e tornate sulla stessa strada a 40 km/h di media. Qual è la velocità media di tutto il viaggio, andata e ritorno?",
    options: [
      { id: "a", text: "50 km/h" },
      { id: "b", text: "48 km/h" },
      { id: "c", text: "45 km/h" },
      { id: "d", text: "52 km/h" },
    ],
    hints: [
      { id: "spinta", price: 10, label: "Una spinta sul ragionamento", text: "La velocità media è la strada totale divisa per il tempo totale, non la media delle due velocità." },
      { id: "elimina", price: 25, label: "Elimina una risposta sbagliata", text: "Non è «50 km/h»: al ritorno andate più piano e restate in strada più a lungo, quindi la media non sta a metà." },
      { id: "chiave", price: 45, label: "Il passaggio chiave", text: "Fate finta che la strada sia di 120 km: l'andata dura 2 ore e il ritorno 3 ore." },
    ],
    solution: { optionId: "b" },
    explain: "Con 120 km di strada: andata in 2 ore, ritorno in 3. Sono 240 km in 5 ore: 48 km/h. Al ritorno si passa più tempo in strada, quindi la media pende verso i 40.",
  },
  {
    id: "zia-e-nipote",
    difficulty: "difficile",
    title: "La zia e la nipote",
    prompt: "Oggi zia Marta ha il triplo degli anni di sua nipote Sofia. Tra 10 anni ne avrà esattamente il doppio. Quanti anni ha zia Marta oggi?",
    options: [
      { id: "a", text: "24" },
      { id: "b", text: "30" },
      { id: "c", text: "36" },
      { id: "d", text: "40" },
    ],
    hints: [
      { id: "spinta", price: 15, label: "Una spinta sul ragionamento", text: "Provate le risposte una per una: l'età di oggi deve essere divisibile per 3, poi controllate cosa succede tra 10 anni." },
      { id: "elimina", price: 30, label: "Elimina una risposta sbagliata", text: "Non è «36»: tra 10 anni Sofia ne avrebbe 22 e la zia 46, che non è il doppio." },
      { id: "due", price: 50, label: "Restano solo due risposte", text: "La risposta è «24» oppure «30»." },
    ],
    solution: { optionId: "b" },
    explain: "Se Sofia ha 10 anni, la zia ne ha 30. Tra 10 anni: 20 e 40, esattamente il doppio. Con le altre età non torna: con 24 sarebbero 18 e 34, con 36 sarebbero 22 e 46, e 40 non è divisibile per 3.",
  },
];

export default varianti;
