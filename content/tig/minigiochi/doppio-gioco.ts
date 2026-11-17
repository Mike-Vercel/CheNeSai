import type { DoppioInput } from "@/lib/tig/games/mechanics/doppio-gioco";

/**
 * 57 · DOPPIO GIOCO — coppie di prove con difficoltà dichiarata: la «sicura» si risolve in pochi secondi,
 * la «rischiosa» richiede un ragionamento in più passi (ordinamenti, condizioni, conti). Tutto si deduce dal
 * testo: niente cultura generale. Soluzioni uniche, spiegate in una riga.
 */
const varianti: DoppioInput[] = [
  {
    id: "cena-conto",
    difficulty: "facile",
    title: "Cena tra amici",
    sicura: {
      prompt: "Lia, Marco e Teo hanno ordinato pizza, sushi e insalata, un piatto a testa. Marco odia le verdure. Teo ha preso il sushi. Cosa ha preso Lia?",
      options: [
        { id: "pizza", text: "La pizza" },
        { id: "sushi", text: "Il sushi" },
        { id: "insalata", text: "L'insalata" },
      ],
    },
    rischiosa: {
      prompt: "Il conto è di 80 euro, diviso tra quattro amici. Ugo ha pagato il doppio di Vera, Vera quanto Zeno, Alba 20 euro. Quanto ha pagato Ugo?",
      options: [
        { id: "20", text: "20 euro" },
        { id: "25", text: "25 euro" },
        { id: "30", text: "30 euro" },
        { id: "40", text: "40 euro" },
      ],
    },
    solution: {
      sicura: "insalata",
      rischiosa: "30",
      whySicura: "Teo ha il sushi; Marco non prende l'insalata, quindi la pizza; a Lia resta l'insalata.",
      whyRischiosa: "Vera e Zeno pagano V a testa, Ugo 2V: 2V + V + V + 20 = 80, quindi V = 15 e Ugo 30.",
    },
    explain: "Sicura: esclusione in due passi, all'insalata ci arriva Lia. Rischiosa: chiamate V la quota di Vera, i conti tornano solo con V = 15, cioè 30 euro per Ugo.",
  },
  {
    id: "treno-bar",
    difficulty: "media",
    title: "In ritardo per il treno",
    sicura: {
      prompt: "Il treno parte alle 18:40. Da casa alla stazione ci sono 25 minuti a piedi e Nora vuole arrivare con 5 minuti di anticipo. A che ora deve uscire, al più tardi?",
      options: [
        { id: "18-05", text: "Alle 18:05" },
        { id: "18-10", text: "Alle 18:10" },
        { id: "18-15", text: "Alle 18:15" },
      ],
    },
    rischiosa: {
      prompt: "Dario, Elsa e Franco arrivano al bar uno dopo l'altro. Dario non è arrivato per primo. Elsa è arrivata subito dopo Dario. Franco non è arrivato per ultimo. Chi è arrivato per ultimo?",
      options: [
        { id: "dario", text: "Dario" },
        { id: "elsa", text: "Elsa" },
        { id: "franco", text: "Franco" },
        { id: "boh", text: "Non si può dire" },
      ],
    },
    solution: {
      sicura: "18-10",
      rischiosa: "elsa",
      whySicura: "18:40 meno 5 minuti di anticipo meno 25 di strada: 18:10.",
      whyRischiosa: "Elsa viene subito dopo Dario, che non è primo: Dario secondo, Elsa terza, Franco primo.",
    },
    explain: "Sicura: due sottrazioni. Rischiosa: se Dario non è primo ed Elsa lo segue subito, l'unico ordine possibile è Franco, Dario, Elsa: ultima Elsa.",
  },
  {
    id: "turni-stanze",
    difficulty: "facile",
    title: "Vita da coinquilini",
    sicura: {
      prompt: "I turni dei piatti vanno in ordine: Anna, Bruno, Carla, poi si ricomincia. Oggi, martedì, tocca ad Anna. A chi tocca venerdì?",
      options: [
        { id: "anna", text: "Ad Anna" },
        { id: "bruno", text: "A Bruno" },
        { id: "carla", text: "A Carla" },
      ],
    },
    rischiosa: {
      prompt: "Quattro stanze in fila, numerate da 1 a 4. Ida dorme nella 1. Ludo è nella stanza accanto a Ida. Gigi non dorme accanto a Ida. Mara non è nella 4. In che stanza dorme Gigi?",
      options: [
        { id: "s2", text: "Nella 2" },
        { id: "s3", text: "Nella 3" },
        { id: "s4", text: "Nella 4" },
        { id: "boh", text: "Non si può dire" },
      ],
    },
    solution: {
      sicura: "anna",
      rischiosa: "s4",
      whySicura: "Martedì Anna, mercoledì Bruno, giovedì Carla, venerdì di nuovo Anna.",
      whyRischiosa: "Ida 1, Ludo 2; Mara non è nella 4, quindi è nella 3; a Gigi resta la 4.",
    },
    explain: "Sicura: si conta il giro di tre. Rischiosa: Ludo occupa la 2, Mara non può stare nella 4 e prende la 3, Gigi finisce nella 4 (e infatti non è accanto a Ida).",
  },
  {
    id: "palestra-armadietti",
    difficulty: "media",
    title: "In palestra",
    sicura: {
      prompt: "La lezione di spinning dura 45 minuti e comincia alle 19:20. Omar arriva con 10 minuti di ritardo e resta fino alla fine. Quanti minuti di lezione fa?",
      options: [
        { id: "25", text: "25 minuti" },
        { id: "35", text: "35 minuti" },
        { id: "45", text: "45 minuti" },
      ],
    },
    rischiosa: {
      prompt: "Gli armadietti 7, 12 e 21 sono di Pia, Rino e Sole. Quello di Pia ha un numero pari. Rino ha un numero più alto di Sole. Di chi è l'armadietto 7?",
      options: [
        { id: "pia", text: "Di Pia" },
        { id: "rino", text: "Di Rino" },
        { id: "sole", text: "Di Sole" },
        { id: "boh", text: "Non si può dire" },
      ],
    },
    solution: {
      sicura: "35",
      rischiosa: "sole",
      whySicura: "45 minuti di lezione meno 10 di ritardo: 35.",
      whyRischiosa: "L'unico pari è il 12, di Pia. Tra 7 e 21 Rino ha il più alto, il 21: il 7 è di Sole.",
    },
    explain: "Sicura: una sottrazione. Rischiosa: il 12 è l'unico pari e va a Pia; Rino prende il più alto dei due rimasti, a Sole resta il 7.",
  },
  {
    id: "regali-festa",
    difficulty: "difficile",
    title: "La festa dei regali",
    sicura: {
      prompt: "Alla festa ci sono 12 invitati. Un terzo è arrivato in ritardo e metà dei ritardatari ha portato un regalo. Quanti ritardatari hanno portato un regalo?",
      options: [
        { id: "2", text: "2" },
        { id: "3", text: "3" },
        { id: "4", text: "4" },
      ],
    },
    rischiosa: {
      prompt: "Teo, Ugo, Vale e Zoe hanno portato libro, vino, piantina e candela, uno a testa. Chi ha portato il vino non è arrivato in auto; Teo e Ugo sono arrivati in auto. Vale ha portato la candela. Zoe non ha portato la piantina. Teo non regala mai piante. Chi ha portato il libro?",
      options: [
        { id: "teo", text: "Teo" },
        { id: "ugo", text: "Ugo" },
        { id: "vale", text: "Vale" },
        { id: "zoe", text: "Zoe" },
      ],
    },
    solution: {
      sicura: "2",
      rischiosa: "teo",
      whySicura: "Un terzo di 12 è 4 ritardatari; metà di 4 è 2.",
      whyRischiosa: "Il vino non è di Teo, Ugo (in auto) né Vale (candela): è di Zoe. Teo non porta piante, quindi il libro; a Ugo la piantina.",
    },
    explain: "Sicura: 4 ritardatari, 2 con regalo. Rischiosa: il vino può essere solo di Zoe; tra Teo e Ugo restano libro e piantina, e Teo le piante non le regala: il libro è suo.",
  },
  {
    id: "pizzeria-conto",
    difficulty: "media",
    title: "Serata in pizzeria",
    sicura: {
      prompt: "Una pizza costa 8 euro e una birra 5. Il tavolo ha pagato 47 euro in tutto, con 4 pizze. Quante birre ha preso?",
      options: [
        { id: "2", text: "2 birre" },
        { id: "3", text: "3 birre" },
        { id: "4", text: "4 birre" },
      ],
    },
    rischiosa: {
      prompt: "Ada, Bert, Cloe e Dino hanno preso margherita, diavola, funghi e quattro formaggi. Ada non mangia piccante ed è allergica ai funghi. Bert ha preso funghi o diavola. Cloe ha la quattro formaggi. Dino non ha preso la diavola. Chi ha la margherita?",
      options: [
        { id: "ada", text: "Ada" },
        { id: "bert", text: "Bert" },
        { id: "cloe", text: "Cloe" },
        { id: "dino", text: "Dino" },
      ],
    },
    solution: {
      sicura: "3",
      rischiosa: "ada",
      whySicura: "4 pizze fanno 32 euro; 47 meno 32 fa 15, cioè 3 birre.",
      whyRischiosa: "La diavola non è di Ada, Dino o Cloe: è di Bert. Ada non può prendere i funghi: la margherita è sua, i funghi di Dino.",
    },
    explain: "Sicura: 47 − 32 = 15 euro di birre. Rischiosa: prima si piazza la diavola (Bert), poi l'allergia di Ada ai funghi decide il resto: margherita ad Ada.",
  },
  {
    id: "riunione-turni",
    difficulty: "media",
    title: "La riunione di lavoro",
    sicura: {
      prompt: "La riunione a Milano comincia alle 15. Il collega di Londra ha un'ora in meno rispetto a Milano. Che ora è a Londra quando comincia la riunione?",
      options: [
        { id: "14", text: "Le 14" },
        { id: "15", text: "Le 15" },
        { id: "16", text: "Le 16" },
      ],
    },
    rischiosa: {
      prompt: "Elena, Fabio e Gino hanno parlato in riunione uno dopo l'altro. Fabio ha parlato dopo Gino; Elena prima di Gino. Chi ha parlato per secondo ha proposto il nuovo budget. Chi l'ha proposto?",
      options: [
        { id: "elena", text: "Elena" },
        { id: "fabio", text: "Fabio" },
        { id: "gino", text: "Gino" },
        { id: "boh", text: "Non si può dire" },
      ],
    },
    solution: {
      sicura: "14",
      rischiosa: "gino",
      whySicura: "Un'ora in meno delle 15: le 14.",
      whyRischiosa: "Elena prima di Gino, Gino prima di Fabio: l'ordine è Elena, Gino, Fabio. Secondo: Gino.",
    },
    explain: "Sicura: un'ora in meno. Rischiosa: le due condizioni mettono in fila Elena, Gino e Fabio; il secondo, quello del budget, è Gino.",
  },
  {
    id: "vacanze-mete",
    difficulty: "facile",
    title: "Si parte per le vacanze",
    sicura: {
      prompt: "Una casa al mare costa 420 euro per una settimana, divisi in parti uguali tra 4 amici. Quanto paga ognuno?",
      options: [
        { id: "95", text: "95 euro" },
        { id: "105", text: "105 euro" },
        { id: "120", text: "120 euro" },
      ],
    },
    rischiosa: {
      prompt: "Ivo, Lea e Mirko partono per mare, montagna e lago, uno a testa. Mirko va in montagna. Lea va al lago solo se Mirko va al mare. Dove va Ivo?",
      options: [
        { id: "mare", text: "Al mare" },
        { id: "montagna", text: "In montagna" },
        { id: "lago", text: "Al lago" },
        { id: "boh", text: "Non si può dire" },
      ],
    },
    solution: {
      sicura: "105",
      rischiosa: "lago",
      whySicura: "420 diviso 4 fa 105.",
      whyRischiosa: "Mirko non va al mare, quindi Lea non va al lago: va al mare. A Ivo resta il lago.",
    },
    explain: "Sicura: una divisione. Rischiosa: la condizione su Lea scatta solo se Mirko va al mare; non ci va, quindi Lea non va al lago e prende il mare. Ivo va al lago.",
  },
  {
    id: "voto-uscita",
    difficulty: "difficile",
    title: "Dove si va stasera?",
    sicura: {
      prompt: "Nel gruppo ci sono 9 persone. Il messaggio di Sara risulta letto da 6 persone, lei esclusa. Quanti non l'hanno ancora letto?",
      options: [
        { id: "1", text: "1" },
        { id: "2", text: "2" },
        { id: "3", text: "3" },
      ],
    },
    rischiosa: {
      prompt: "Quattro amici votano tra pub, cinema e karaoke, un voto a testa. Il pub ha preso più voti del cinema. Il cinema e il karaoke hanno preso almeno un voto ciascuno. Quanti voti ha preso il pub?",
      options: [
        { id: "1", text: "1" },
        { id: "2", text: "2" },
        { id: "3", text: "3" },
        { id: "boh", text: "Non si può dire" },
      ],
    },
    solution: {
      sicura: "2",
      rischiosa: "2",
      whySicura: "Sara esclusa restano 8 persone; 8 meno 6 fa 2.",
      whyRischiosa: "Cinema e karaoke almeno 1 a testa: al pub ne restano al massimo 2. Deve battere il cinema: pub 2, cinema 1, karaoke 1.",
    },
    explain: "Sicura: 8 lettori possibili, 6 hanno letto. Rischiosa: con quattro voti e un voto minimo a cinema e karaoke, il pub può averne al massimo 2, e gli servono proprio 2 per battere il cinema.",
  },
  {
    id: "orologio-latte",
    difficulty: "difficile",
    title: "Orologi e bugie",
    sicura: {
      prompt: "Un orologio va avanti di 5 minuti ogni ora. A mezzogiorno segnava l'ora giusta. Che ora segna quando in realtà sono le 15?",
      options: [
        { id: "15-05", text: "Le 15:05" },
        { id: "15-15", text: "Le 15:15" },
        { id: "15-20", text: "Le 15:20" },
      ],
    },
    rischiosa: {
      prompt: "Uno solo dice la verità. Anna: «Il latte l'ha finito Bruno». Bruno: «Non sono stato io». Carla: «Non sono stata io». Chi ha finito il latte?",
      options: [
        { id: "anna", text: "Anna" },
        { id: "bruno", text: "Bruno" },
        { id: "carla", text: "Carla" },
        { id: "boh", text: "Non si può dire" },
      ],
    },
    solution: {
      sicura: "15-15",
      rischiosa: "carla",
      whySicura: "Tre ore dopo mezzogiorno, 5 minuti l'ora: 15 minuti avanti, le 15:15.",
      whyRischiosa: "Se fosse Anna o Bruno direbbero il vero in due. Solo con Carla dice il vero uno solo: Bruno.",
    },
    explain: "Sicura: 3 ore × 5 minuti. Rischiosa: provate ogni colpevole e contate chi dice il vero: solo con Carla la verità la dice una persona sola, Bruno.",
  },
];

export default varianti;
