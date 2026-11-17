import type { BugiaInput } from "@/lib/tig/games/mechanics/la-bugia-piu-credibile";

/**
 * 56 · LA BUGIA PIÙ CREDIBILE — tre mini-casi per variante (due tavoli vicini non hanno mai lo stesso).
 * Ogni caso ha tre «pezzi» (chi / dove / quando…) con tre opzioni PREDEFINITE: i fatti rendono vera una sola
 * opzione per pezzo. La bugia si compone cambiando un pezzo: non esiste testo libero. Personaggi inventati.
 */

type Caso = BugiaInput["cases"][number];
type Sol = BugiaInput["solution"]["cases"][string];

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/** Un caso: pezzi come [etichetta, [opzione, opzione, opzione]], `real` = indice dell'opzione vera per pezzo. */
function caso(id: string, title: string, question: string, facts: string[], parts: [string, [string, string, string]][], real: [number, number, number], why: string): { k: Caso; s: Sol } {
  const ps = parts.map(([label, opts], i) => ({ id: `p${i + 1}`, label, options: opts.map((t) => ({ id: slug(t), text: t })) }));
  return { k: { id, title, question, facts, parts: ps }, s: { real: ps.map((p, i) => p.options[real[i]].id), why } };
}

function variante(id: string, difficulty: BugiaInput["difficulty"], cs: { k: Caso; s: Sol }[], explain: string): BugiaInput {
  return { id, difficulty, cases: cs.map((c) => c.k), solution: { cases: Object.fromEntries(cs.map((c) => [c.k.id, c.s])) }, explain };
}

const CHI = "Chi";

const varianti: BugiaInput[] = [
  variante(
    "casa-condivisa",
    "facile",
    [
      caso(
        "torta",
        "La torta sparita",
        "Chi ha mangiato la torta, dove e quando?",
        ["Teo è allergico al cioccolato e la torta era al cioccolato; Max è fuori città da ieri.", "Le briciole sono solo sul balcone.", "Alle 16 la torta c'era ancora; alle 20 il piatto era già lavato e asciutto."],
        [
          [CHI, ["Lia", "Teo", "Max"]],
          ["Dove", ["In cucina", "Sul balcone", "In camera"]],
          ["Quando", ["Alle 16", "Alle 18", "Alle 20"]],
        ],
        [0, 1, 1],
        "Teo è allergico e Max fuori città: Lia. Briciole sul balcone. Alle 16 c'era, alle 20 il piatto era già pulito: alle 18.",
      ),
      caso(
        "bici",
        "La bici presa in prestito",
        "Chi ha preso la bici, dove è andato e quando è tornato?",
        ["Bruno non sa andare in bici e Ciro era al lavoro tutta la mattina.", "Nel cestino c'erano tre chili di arance e un mazzo di basilico.", "Chi l'ha presa è rimasto al mercato fino alla chiusura delle 11:50 ed è tornato dritto: dieci minuti di strada."],
        [
          [CHI, ["Ada", "Bruno", "Ciro"]],
          ["Dove", ["Al mercato", "In piscina", "In biblioteca"]],
          ["Ritorno", ["Alle 10", "A mezzogiorno", "Alle 15"]],
        ],
        [0, 0, 1],
        "Bruno non va in bici, Ciro lavorava: Ada. Arance e basilico: mercato. Chiusura alle 11:50 più dieci minuti: mezzogiorno.",
      ),
      caso(
        "lavatrice",
        "Il bucato diventato rosa",
        "Chi ha fatto la lavatrice, cosa ci ha messo e a che temperatura?",
        ["Dora e Fede ieri non erano in casa.", "Tutto il bucato bianco è diventato rosa.", "Sulla lavatrice la manopola è rimasta sui 40 gradi."],
        [
          [CHI, ["Dora", "Elio", "Fede"]],
          ["Intruso", ["Una maglia rossa", "Un calzino nero", "Un asciugamano verde"]],
          ["Gradi", ["30 gradi", "40 gradi", "90 gradi"]],
        ],
        [1, 0, 1],
        "Dora e Fede erano fuori: Elio. Bianco diventato rosa: una maglia rossa. La manopola dice 40.",
      ),
    ],
    "Ogni pezzo si ricava da un solo fatto. La bugia più credibile era cambiare il pezzo meno ovvio, per esempio l'orario.",
  ),
  variante(
    "in-ufficio",
    "media",
    [
      caso(
        "stampante",
        "La stampante inceppata",
        "Chi l'ha inceppata, con cosa e a che ora?",
        ["Alle 9 il capo ha stampato senza problemi; alle 13 la stampante era già bloccata.", "Hugo e Ivan dalle 10:30 alle 12 erano in riunione.", "Dentro è rimasto un pezzo di carta lucida che si attacca alle dita."],
        [
          [CHI, ["Gaia", "Hugo", "Ivan"]],
          ["Con cosa", ["Un cartoncino", "Un foglio spiegazzato", "Un'etichetta adesiva"]],
          ["Ora", ["Alle 9", "Alle 11", "Alle 13"]],
        ],
        [0, 2, 1],
        "Tra le 9 e le 13 resta solo le 11; a quell'ora Hugo e Ivan erano in riunione: Gaia. La carta che si attacca è un'etichetta adesiva.",
      ),
      caso(
        "caffe",
        "La macchinetta del caffè rotta",
        "Chi l'ha rotta, come e quando?",
        ["Il serbatoio era pieno e il tecnico ha trovato incastrata una cialda di un'altra marca.", "Lunedì sera funzionava ancora; venerdì mattina era già rotta.", "Luca è in ferie da martedì e Mara il mercoledì lavora da casa."],
        [
          [CHI, ["Luca", "Mara", "Nico"]],
          ["Come", ["Con una cialda sbagliata", "Lasciandola senza acqua", "Premendo due tasti insieme"]],
          ["Quando", ["Lunedì", "Mercoledì", "Venerdì"]],
        ],
        [2, 0, 1],
        "Cialda sbagliata, serbatoio pieno. Tra lunedì sera e venerdì mattina resta mercoledì; Luca in ferie e Mara a casa: Nico.",
      ),
      caso(
        "ficus",
        "Il ficus spostato",
        "Chi l'ha spostato, dove e perché?",
        ["Il ficus ora ha le foglie appoggiate al vetro.", "Nessuno aveva bisogno di spazio e nessuno ha scattato foto.", "Piero ha il braccio ingessato e Rita oggi lavora da casa."],
        [
          [CHI, ["Olga", "Piero", "Rita"]],
          ["Dove", ["Vicino alla finestra", "In corridoio", "In sala riunioni"]],
          ["Perché", ["Per fargli prendere sole", "Per fare spazio", "Per una foto"]],
        ],
        [0, 0, 0],
        "Foglie sul vetro: vicino alla finestra. Niente spazio né foto: per il sole. Piero ingessato, Rita a casa: Olga.",
      ),
    ],
    "Orari, presenze e un dettaglio fisico per ogni caso. Bugie più insidiose: quelle sull'orario, che richiede due fatti insieme.",
  ),
  variante(
    "in-vacanza",
    "media",
    [
      caso(
        "valigia",
        "La valigia rotta",
        "Chi l'ha rotta, come e dove?",
        ["La cerniera è saltata mentre qualcuno cercava di farci entrare un altro maglione.", "È successo la mattina della partenza, in camera, prima di uscire.", "Sara e Ugo avevano chiuso le loro valigie la sera prima."],
        [
          [CHI, ["Sara", "Tino", "Ugo"]],
          ["Come", ["Ci si è seduto sopra", "L'ha fatta cadere", "L'ha chiusa a forza"]],
          ["Dove", ["In aeroporto", "In albergo", "In taxi"]],
        ],
        [1, 2, 1],
        "Un maglione in più spinto dentro: chiusa a forza. In camera prima di uscire: in albergo. Sara e Ugo avevano già chiuso: Tino.",
      ),
      caso(
        "ombrellone",
        "L'ombrellone volato via",
        "Chi l'ha piantato male, dove e quando?",
        ["Il vento forte è arrivato solo verso le 17, e l'ombrellone è volato appena aperto.", "Walter alle 17 era già in albergo; Zoe va in spiaggia solo al mattino.", "Prima di finire in mare ha scavalcato due soli asciugamani: in prima fila non c'era altro."],
        [
          [CHI, ["Vale", "Walter", "Zoe"]],
          ["Dove", ["In prima fila", "Vicino al bar", "Sotto le dune"]],
          ["Quando", ["Alle 9", "A mezzogiorno", "Alle 17"]],
        ],
        [0, 0, 2],
        "Volato appena aperto, col vento delle 17. A quell'ora Walter era in albergo e Zoe non c'è mai: Vale. Due asciugamani prima del mare: prima fila.",
      ),
      caso(
        "tramonto",
        "La foto mossa del tramonto",
        "Chi l'ha scattata, con cosa e da dove?",
        ["La foto è mossa perché chi scattava ondeggiava sull'acqua.", "Bea e Carlo soffrono il mal di mare e restano a terra.", "Andrea aveva lasciato telefono e tablet in camera a caricare."],
        [
          [CHI, ["Andrea", "Bea", "Carlo"]],
          ["Con cosa", ["Con il telefono", "Con la macchina fotografica", "Con il tablet"]],
          ["Da dove", ["Dal molo", "Dalla terrazza", "Dalla barca"]],
        ],
        [0, 1, 2],
        "Ondeggiava sull'acqua: dalla barca. Bea e Carlo restano a terra: Andrea. Telefono e tablet in carica: macchina fotografica.",
      ),
    ],
    "Tre casi da vacanza: in ognuno c'è un pezzo che si deduce da un altro (chi era in barca, chi era in camera). Lì le bugie attecchiscono meglio.",
  ),
  variante(
    "la-festa",
    "facile",
    [
      caso(
        "musica",
        "La musica a tutto volume",
        "Chi ha alzato la musica, da cosa e a che ora?",
        ["Il vicino ha protestato alle due in punto: la musica andava da un'ora.", "Il portatile era spento e la TV non ha le casse.", "Elsa e Fabio all'una erano fuori a prendere le pizze."],
        [
          [CHI, ["Dario", "Elsa", "Fabio"]],
          ["Da cosa", ["Dal telefono", "Dalla TV", "Dal portatile"]],
          ["Ora", ["A mezzanotte", "All'una", "Alle due"]],
        ],
        [0, 0, 1],
        "Alle due andava da un'ora: è partita all'una. Portatile spento e TV muta: telefono. All'una Elsa e Fabio erano fuori: Dario.",
      ),
      caso(
        "bicchiere",
        "Il bicchiere rotto",
        "Chi l'ha rotto, dove e cosa c'era dentro?",
        ["I cocci sono sul tappeto del salotto.", "La macchia sul tappeto è viola scuro.", "Gina è astemia e beve solo acqua; Ivo era in bagno quando si è sentito il rumore."],
        [
          [CHI, ["Gina", "Ivo", "Lea"]],
          ["Dove", ["In cucina", "In salotto", "In bagno"]],
          ["Dentro", ["Vino rosso", "Acqua", "Succo d'arancia"]],
        ],
        [2, 1, 0],
        "Cocci in salotto. Macchia viola scuro: vino rosso. Gina beve solo acqua e Ivo era in bagno: Lea.",
      ),
      caso(
        "regalo",
        "Il regalo nascosto",
        "Chi l'ha nascosto, dove e quando?",
        ["Il regalo è stato comprato venerdì pomeriggio e nascosto la sera stessa.", "Nina venerdì sera era al lavoro e Oreste non ha le chiavi di casa.", "Sul pacco ci sono ragnatele e polvere di mattoni."],
        [
          [CHI, ["Mino", "Nina", "Oreste"]],
          ["Dove", ["Nell'armadio", "Sotto il letto", "In cantina"]],
          ["Quando", ["Venerdì", "Sabato", "Domenica"]],
        ],
        [0, 2, 0],
        "Nascosto venerdì sera. Nina lavorava e Oreste non ha le chiavi: Mino. Ragnatele e mattoni: cantina.",
      ),
    ],
    "Fatti diretti, un pezzo ciascuno. Qui vinceva chi rispondeva in fretta e passava il tempo a costruire una bugia furba per il vicino.",
  ),
  variante(
    "condominio",
    "media",
    [
      caso(
        "ascensore",
        "L'ascensore bloccato",
        "Chi l'ha bloccato, a che piano e come?",
        ["L'ascensore è fermo con le porte spalancate.", "È fermo al quinto piano.", "Paolo abita al primo, Rosa al terzo, Sandro al quinto, e nessuno è salito da altri."],
        [
          [CHI, ["Paolo", "Rosa", "Sandro"]],
          ["Piano", ["Al primo", "Al terzo", "Al quinto"]],
          ["Come", ["Lasciando la porta aperta", "Con troppo peso", "Premendo l'allarme"]],
        ],
        [2, 2, 0],
        "Porte spalancate: lasciate aperte. Fermo al quinto, dove abita solo Sandro.",
      ),
      caso(
        "pacco",
        "Il pacco aperto per sbaglio",
        "Chi l'ha aperto, cosa c'era dentro e dove era stato lasciato?",
        ["Il pacco era stato lasciato davanti all'interno 5 invece che al 6.", "All'interno 5 abita solo Ugo.", "Nel cartone c'è ancora la carta velina con la forma di un paio di scarpe."],
        [
          [CHI, ["Tea", "Ugo", "Vito"]],
          ["Dentro", ["Un paio di scarpe", "Una lampada", "Un libro"]],
          ["Dove", ["Nell'androne", "Davanti alla porta sbagliata", "In portineria"]],
        ],
        [1, 0, 1],
        "Lasciato davanti all'interno 5 invece del 6: porta sbagliata, e lì abita Ugo. La velina ha la forma delle scarpe.",
      ),
      caso(
        "panchina",
        "La panchina dipinta",
        "Chi l'ha dipinta, di che colore e quando?",
        ["Ieri mattina la panchina era ancora scrostata; ieri sera alle 22 la vernice era fresca.", "Un bambino ha chiesto perché la panchina è diventata del colore del sole.", "Wanda e Alba ieri sera erano a teatro."],
        [
          [CHI, ["Wanda", "Zeno", "Alba"]],
          ["Colore", ["Verde", "Giallo", "Blu"]],
          ["Quando", ["Ieri mattina", "Ieri sera", "Stamattina"]],
        ],
        [1, 1, 1],
        "Scrostata la mattina, fresca alle 22: ieri sera. Il colore del sole: giallo. Wanda e Alba a teatro: Zeno.",
      ),
    ],
    "Casi di condominio con un pezzo che ne trascina un altro (il piano porta a chi abita lì). La bugia credibile cambiava il pezzo «trascinato».",
  ),
  variante(
    "in-palestra",
    "difficile",
    [
      caso(
        "borraccia",
        "La borraccia scambiata",
        "Chi ha preso la borraccia, di che colore era la sua e a quale lezione?",
        ["Lo scambio è avvenuto alla lezione delle 19, l'unica con la sala piena.", "Bice e Diana alla lezione delle 19 non c'erano.", "Al posto di quella sparita è rimasta una borraccia del colore della maglia di Cesare, che non è né nera né rossa."],
        [
          [CHI, ["Bice", "Cesare", "Diana"]],
          ["La sua era", ["Rossa", "Nera", "Bianca"]],
          ["Lezione", ["Delle 18", "Delle 19", "Delle 20"]],
        ],
        [1, 2, 1],
        "Lezione delle 19; Bice e Diana assenti: Cesare. La sua borraccia ha il colore della sua maglia: né nera né rossa, quindi bianca.",
      ),
      caso(
        "lucchetto",
        "Il lucchetto tagliato",
        "Chi l'ha tagliato, con cosa e su quale armadietto?",
        ["Il taglio è netto, fatto in un colpo solo.", "Chi l'ha tagliato aveva dimenticato la combinazione del proprio lucchetto; Elena e Gilda la ricordano a memoria.", "L'armadietto di Franco è l'unico con un numero dispari maggiore di 5."],
        [
          [CHI, ["Elena", "Franco", "Gilda"]],
          ["Con cosa", ["Una tronchese", "Un seghetto", "Un cacciavite"]],
          ["Armadietto", ["Il 3", "Il 7", "Il 12"]],
        ],
        [1, 0, 1],
        "Taglio netto in un colpo: tronchese. Ha dimenticato la sua combinazione: Franco. Dispari maggiore di 5: il 7.",
      ),
      caso(
        "tapis",
        "Il tapis roulant lasciato acceso",
        "Chi l'ha lasciato acceso, a che velocità e per quanto?",
        ["Il contatore segna 5 chilometri percorsi a vuoto, a velocità costante, in mezz'ora.", "Lara e Marco camminano e non vanno mai oltre i 6 all'ora.", "Ivo corre sempre e se ne va dimenticando tutto acceso."],
        [
          [CHI, ["Ivo", "Lara", "Marco"]],
          ["Velocità", ["6 km/h", "10 km/h", "14 km/h"]],
          ["Per quanto", ["10 minuti", "30 minuti", "Un'ora"]],
        ],
        [0, 1, 1],
        "5 chilometri in mezz'ora fanno 10 all'ora, per 30 minuti. A 10 si corre: non Lara né Marco, che camminano. È Ivo.",
      ),
    ],
    "Qui ogni pezzo chiedeva un passaggio in più (un conto, un colore per esclusione). Le bugie migliori sfruttavano proprio quei passaggi.",
  ),
  variante(
    "in-cucina",
    "media",
    [
      caso(
        "pentola",
        "La pentola bruciata",
        "Chi l'ha bruciata, cosa cucinava e quando?",
        ["Sul fondo è rimasta una crosta bianca e dolce.", "È successo a metà pomeriggio.", "Nadia e Pia sono intolleranti al lattosio e non lo scaldano mai."],
        [
          [CHI, ["Nadia", "Omar", "Pia"]],
          ["Cosa", ["Il riso", "La pasta", "Il latte"]],
          ["Quando", ["A pranzo", "A merenda", "A cena"]],
        ],
        [1, 2, 1],
        "Crosta bianca e dolce: latte. A metà pomeriggio: merenda. Nadia e Pia non toccano il lattosio: Omar.",
      ),
      caso(
        "frigo",
        "Il frigo lasciato aperto",
        "Chi l'ha lasciato aperto, cosa ha preso e per quanto è rimasto aperto?",
        ["Stamattina il burro era sciolto e i ghiaccioli liquidi: aperto per ore.", "Chi l'ha aperto ha preso qualcosa da bere per la partita di ieri sera.", "Rino è astemio e Sole dormiva già alle 21."],
        [
          [CHI, ["Rino", "Sole", "Tullio"]],
          ["Ha preso", ["Il burro", "Il ghiaccio", "La birra"]],
          ["Per quanto", ["Cinque minuti", "Mezz'ora", "Tutta la notte"]],
        ],
        [2, 2, 2],
        "Burro sciolto e ghiaccioli liquidi: tutta la notte. Qualcosa da bere per la partita: la birra. Rino astemio, Sole a letto: Tullio.",
      ),
      caso(
        "sale",
        "Il sale al posto dello zucchero",
        "Chi ha scambiato i barattoli, dove li ha messi e quando?",
        ["Ieri a cena il dolce era perfetto; il caffè delle 7 di stamattina era già salato, e prima delle 7 dormivano tutti.", "I barattoli scambiati erano sopra il frigo.", "Walter e Yara ieri dopo cena sono usciti e sono rientrati stamattina alle 8."],
        [
          [CHI, ["Vera", "Walter", "Yara"]],
          ["Dove", ["Nella dispensa", "Sul piano di lavoro", "Sopra il frigo"]],
          ["Quando", ["Ieri sera", "Stamattina", "A pranzo"]],
        ],
        [0, 2, 0],
        "Dopo cena e prima delle 7 (quando dormivano tutti): ieri sera. Walter e Yara erano fuori fino alle 8: Vera. I barattoli erano sopra il frigo.",
      ),
    ],
    "Casi di cucina: il pezzo «quando» si ricava incrociando due momenti. La bugia più furba spostava l'orario di poco.",
  ),
  variante(
    "smart-working",
    "media",
    [
      caso(
        "microfono",
        "Il microfono rimasto acceso",
        "Chi l'ha lasciato acceso, cosa si è sentito e in quale riunione?",
        ["In riunione si sentiva abbaiare forte.", "Tra i tre, solo Bruna ha un cane.", "Il cane di Bruna abbaia solo quando passa il postino, sempre a mezzogiorno."],
        [
          [CHI, ["Alessio", "Bruna", "Cora"]],
          ["Si è sentito", ["Un cane che abbaia", "Una canzone", "Una lite per il parcheggio"]],
          ["Riunione", ["Quella delle 9", "Quella delle 12", "Quella delle 16"]],
        ],
        [1, 0, 1],
        "Si sentiva abbaiare: il cane, quindi Bruna. Il suo cane abbaia al postino di mezzogiorno: riunione delle 12.",
      ),
      caso(
        "file",
        "Il file cancellato",
        "Chi l'ha cancellato, quale file e quando?",
        ["Il file sparito pesava due gigabyte: l'unico così pesante era quello delle foto.", "Martedì sera c'era ancora, mercoledì mattina no.", "Dino ed Ester martedì erano in ferie."],
        [
          [CHI, ["Dino", "Ester", "Fulvio"]],
          ["Quale", ["Il preventivo", "La presentazione", "Le foto dell'evento"]],
          ["Quando", ["Lunedì", "Martedì", "Giovedì"]],
        ],
        [2, 2, 1],
        "Due gigabyte: le foto. C'era martedì sera, non mercoledì mattina: martedì notte. Dino ed Ester in ferie: Fulvio.",
      ),
      caso(
        "invito",
        "La riunione fissata alle 7",
        "Chi l'ha fissata, per quale giorno e da dove?",
        ["L'invito è firmato «inviato dal mio telefono».", "Solo Ilario ha il calendario di lavoro sul telefono.", "La riunione è fissata il giorno dopo martedì."],
        [
          [CHI, ["Gemma", "Ilario", "Lisa"]],
          ["Giorno", ["Lunedì", "Mercoledì", "Venerdì"]],
          ["Da dove", ["Dal telefono", "Dal portatile", "Dal tablet"]],
        ],
        [1, 1, 0],
        "Firma «dal mio telefono»: telefono, e solo Ilario lo usa per il calendario. Il giorno dopo martedì: mercoledì.",
      ),
    ],
    "Tre gaffe da lavoro a distanza: ogni caso si risolve con tre fatti netti. La bugia credibile è quella che il vicino non controlla.",
  ),
  variante(
    "trasloco",
    "difficile",
    [
      caso(
        "scatolone",
        "Lo scatolone caduto",
        "Chi l'ha fatto cadere, cosa c'era dentro e da dove?",
        ["Si è sentito un rumore di cocci.", "È caduto sul marciapiede da meno di un metro, mentre si scaricava.", "Mattia e Noemi a quell'ora erano in casa a montare il letto."],
        [
          [CHI, ["Mattia", "Noemi", "Ottavio"]],
          ["Dentro", ["Piatti", "Libri", "Vestiti"]],
          ["Da dove", ["Dalle scale", "Dal furgone", "Dal balcone"]],
        ],
        [2, 0, 1],
        "Rumore di cocci: piatti. Sul marciapiede, da poco, mentre si scaricava: dal furgone. Gli altri due erano in casa: Ottavio.",
      ),
      caso(
        "chiave",
        "La chiave persa",
        "Chi l'ha persa, quale chiave e dove?",
        ["La chiave persa apre solo la posta.", "È stata ritrovata in mezzo alle aiuole.", "Paola e Silvia non sono mai uscite in cortile: scaricavano dal portone principale."],
        [
          [CHI, ["Paola", "Raoul", "Silvia"]],
          ["Quale", ["Del portone", "Della cantina", "Della cassetta postale"]],
          ["Dove", ["In ascensore", "Nel furgone", "In cortile"]],
        ],
        [1, 2, 2],
        "Apre solo la posta: cassetta postale. Ritrovata nelle aiuole: in cortile. Paola e Silvia non ci sono mai andate: Raoul.",
      ),
      caso(
        "divano",
        "Il divano graffiato",
        "Chi l'ha graffiato, con cosa e in quale stanza?",
        ["Il graffio è esattamente all'altezza della maniglia.", "È successo passando dalla porta d'ingresso, l'unica stretta della casa.", "Tea e Ugo reggevano l'altro lato: il lato graffiato era in mano a Vanni."],
        [
          [CHI, ["Tea", "Ugo", "Vanni"]],
          ["Con cosa", ["La porta", "Lo spigolo del tavolo", "Un cacciavite"]],
          ["Stanza", ["In ingresso", "In salotto", "In camera"]],
        ],
        [2, 0, 0],
        "All'altezza della maniglia: la porta. La porta stretta è quella d'ingresso. Il lato graffiato lo reggeva Vanni.",
      ),
    ],
    "Casi di trasloco con un pezzo che si deduce dal suono o dall'altezza. Erano i pezzi su cui una bugia ben scelta faceva cadere il vicino.",
  ),
  variante(
    "cena-tra-amici",
    "difficile",
    [
      caso(
        "vino",
        "Il vino rovesciato",
        "Chi l'ha rovesciato, quale vino e dove?",
        ["La macchia è trasparente: si vede solo l'alone.", "Chi l'ha rovesciato era seduto a tavola, l'unico posto con la tovaglia.", "Agata e Celso a quell'ora erano sul divano a guardare le foto."],
        [
          [CHI, ["Agata", "Bruno", "Celso"]],
          ["Quale", ["Rosso", "Bianco", "Rosato"]],
          ["Dove", ["Sulla tovaglia", "Sul divano", "Sul tappeto"]],
        ],
        [1, 1, 0],
        "Macchia trasparente: vino bianco. Seduto a tavola: sulla tovaglia. Agata e Celso erano sul divano: Bruno.",
      ),
      caso(
        "piatto",
        "Il piatto del dolce sparito",
        "Chi l'ha portato via, cosa c'era sopra e quando?",
        ["Il piatto sparito era quello del dolce al cucchiaio con il mascarpone.", "È sparito mentre tutti erano al dolce.", "Dalia ed Elio il tiramisù non lo mangiano e sono rimasti in cucina, dove quel piatto non è mai arrivato."],
        [
          [CHI, ["Dalia", "Elio", "Fosca"]],
          ["Sopra", ["Lasagne", "Tiramisù", "Arrosto"]],
          ["Quando", ["Prima del dolce", "Durante il dolce", "Dopo il caffè"]],
        ],
        [2, 1, 1],
        "Dolce al cucchiaio col mascarpone: tiramisù. Sparito mentre tutti erano al dolce. Dalia ed Elio in cucina: Fosca.",
      ),
      caso(
        "segnaposto",
        "I segnaposto scambiati",
        "Chi li ha scambiati, quanti e perché?",
        ["I segnaposto spostati sono solo due.", "Dopo lo scambio Ines siede accanto alla persona che le piace, ed è l'unica contenta.", "Gino e Leo sono arrivati quando erano già tutti seduti."],
        [
          [CHI, ["Gino", "Ines", "Leo"]],
          ["Quanti", ["Due", "Quattro", "Sei"]],
          ["Perché", ["Per sedersi vicino a qualcuno", "Per scherzo", "Per errore"]],
        ],
        [1, 0, 0],
        "Spostati solo due. Ines ci guadagna un posto accanto a chi le piace: per sedersi vicino a qualcuno. Gino e Leo sono arrivati dopo: Ines.",
      ),
    ],
    "Una cena con tre piccoli misteri. I pezzi «chi» si risolvono per esclusione: bugie su quel pezzo funzionano solo con chi ragiona di fretta.",
  ),
];

export default varianti;
