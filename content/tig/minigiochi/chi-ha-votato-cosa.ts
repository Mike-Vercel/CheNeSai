import type { ChiHaVotatoInput } from "@/lib/tig/games/mechanics/chi-ha-votato-cosa";

/**
 * 34 · CHI HA VOTATO COSA? — due domande leggere a due risposte ciascuna: si indovina la COPPIA più votata dal
 * locale. Nessuna risposta giusta a priori; le spiegazioni restano neutre, mai giudizi su chi vota cosa.
 */
const varianti: ChiHaVotatoInput[] = [
  {
    id: "sabato-perfetto",
    difficulty: "facile",
    intro: "Il sabato perfetto",
    questions: [
      { id: "dove", prompt: "Gita fuori porta: dove andate?", options: [{ id: "mare", text: "Mare" }, { id: "montagna", text: "Montagna" }] },
      { id: "colazione", prompt: "E la colazione prima di partire?", options: [{ id: "dolce", text: "Dolce" }, { id: "salata", text: "Salata" }] },
    ],
    explain: "Mare e colazione dolce è la coppia classica, ma basta un locale di camminatori per ribaltare tutto. Il bello è che le due domande sembrano scollegate e invece si portano dietro uno stile.",
  },
  {
    id: "coinquilini",
    difficulty: "media",
    intro: "Vita da coinquilini",
    questions: [
      { id: "piatti", prompt: "I piatti sporchi nel lavandino:", options: [{ id: "subito", text: "Si lavano subito" }, { id: "domani", text: "Possono aspettare domani" }] },
      { id: "spesa", prompt: "La spesa di casa:", options: [{ id: "cassa", text: "Cassa comune" }, { id: "ognuno", text: "Ognuno la sua" }] },
    ],
    explain: "Chi lava subito tende anche a volere regole chiare, quindi spesso sceglie la cassa comune. Ma molti tavoli sono ordinati sui piatti e gelosi della propria mensola in frigo.",
  },
  {
    id: "messaggi",
    difficulty: "media",
    intro: "La chat del gruppo",
    questions: [
      { id: "formato", prompt: "Per raccontare una cosa lunga preferite:", options: [{ id: "vocale", text: "Il vocale" }, { id: "scritto", text: "Il messaggio scritto" }] },
      { id: "spunte", prompt: "Le spunte blu di lettura:", options: [{ id: "accese", text: "Accese" }, { id: "spente", text: "Spente" }] },
    ],
    explain: "Il vocale vince spesso tra chi parla tanto, le spunte spente tra chi risponde quando vuole. Indovinare la coppia significa capire che tipo di chat frequenta il locale.",
  },
  {
    id: "viaggio",
    difficulty: "facile",
    intro: "Il viaggio con gli amici",
    questions: [
      { id: "mezzo", prompt: "Come ci andate?", options: [{ id: "auto", text: "In auto, tutti insieme" }, { id: "treno", text: "In treno" }] },
      { id: "dormire", prompt: "Dove si dorme?", options: [{ id: "casa", text: "Casa intera in affitto" }, { id: "ostello", text: "Ostello o hotel" }] },
    ],
    explain: "Auto e casa intera è la combinazione del gruppo che vuole stare insieme anche di sera; treno e hotel quella di chi vuole viaggiare leggero. Il locale di solito si divide su questa linea.",
  },
  {
    id: "lavoro-ibrido",
    difficulty: "media",
    intro: "Lunedì mattina",
    questions: [
      { id: "dove", prompt: "Se poteste scegliere, lavorereste:", options: [{ id: "casa", text: "Da casa" }, { id: "ufficio", text: "In ufficio" }] },
      { id: "sveglia", prompt: "La sveglia ideale:", options: [{ id: "presto", text: "Presto, così la sera è libera" }, { id: "tardi", text: "Tardi, anche se si finisce tardi" }] },
    ],
    explain: "Lavorare da casa e svegliarsi tardi sembra la coppia ovvia, ma molti scelgono casa proprio per avere la sera libera. È qui che le previsioni si spaccano.",
  },
  {
    id: "cena-fuori",
    difficulty: "facile",
    intro: "Cena fuori",
    questions: [
      { id: "cosa", prompt: "Stasera si mangia:", options: [{ id: "pizza", text: "Pizza" }, { id: "sushi", text: "Sushi" }] },
      { id: "conto", prompt: "Il conto si fa:", options: [{ id: "romana", text: "Alla romana" }, { id: "preciso", text: "Ognuno il suo" }] },
    ],
    explain: "La pizza si divide quasi sempre alla romana, il sushi a volte apre il dibattito sul conto preciso. Due domande semplici, ma la coppia vincente dice molto del gruppo.",
  },
  {
    id: "palestra",
    difficulty: "difficile",
    intro: "Buoni propositi",
    questions: [
      { id: "allenamento", prompt: "Allenamento preferito:", options: [{ id: "palestra", text: "Palestra con l'abbonamento" }, { id: "aperto", text: "Corsa all'aperto, gratis" }] },
      { id: "quando", prompt: "Quando?", options: [{ id: "mattina", text: "Prima del lavoro" }, { id: "sera", text: "Dopo il lavoro" }] },
    ],
    explain: "Corsa e mattina è la coppia dei buoni propositi, palestra e sera quella della vita reale. Il locale tende a votare la seconda ma a prevedere la prima.",
  },
  {
    id: "serie-tv",
    difficulty: "media",
    intro: "Divano e telecomando",
    questions: [
      { id: "ritmo", prompt: "Una serie nuova si guarda:", options: [{ id: "maratona", text: "Tutta in un weekend" }, { id: "puntata", text: "Una puntata a sera" }] },
      { id: "lingua", prompt: "In che lingua?", options: [{ id: "originale", text: "Originale coi sottotitoli" }, { id: "doppiata", text: "Doppiata" }] },
    ],
    explain: "La maratona va forte tra i più giovani del locale, l'originale coi sottotitoli divide tra chi vuole le voci vere e chi vuole guardare anche il telefono.",
  },
  {
    id: "compleanno",
    difficulty: "difficile",
    intro: "Il tuo compleanno",
    questions: [
      { id: "festa", prompt: "Come lo festeggi?", options: [{ id: "grande", text: "Festa con tanta gente" }, { id: "piccola", text: "Cena con pochi amici" }] },
      { id: "regalo", prompt: "Il regalo ideale:", options: [{ id: "esperienza", text: "Un'esperienza" }, { id: "oggetto", text: "Un oggetto" }] },
    ],
    explain: "Cena con pochi e un'esperienza in regalo è la coppia più frequente a quest'età, ma chi ama le feste grandi è più numeroso di quanto si pensi. Prevederla è difficile perché tutti credono di essere la minoranza.",
  },
  {
    id: "vacanze-estate",
    difficulty: "difficile",
    intro: "Le ferie d'agosto",
    questions: [
      { id: "programma", prompt: "Le ferie si organizzano:", options: [{ id: "mesi", text: "Mesi prima, tutto prenotato" }, { id: "ultimo", text: "All'ultimo minuto" }] },
      { id: "ritmo", prompt: "In vacanza si preferisce:", options: [{ id: "relax", text: "Relax totale" }, { id: "giro", text: "Vedere più posti possibile" }] },
    ],
    explain: "Chi prenota mesi prima spesso vuole vedere tutto, chi va all'ultimo minuto cerca relax. Ma il locale ha sempre una quota di organizzatori pigri che rovina le previsioni.",
  },
];

export default varianti;
