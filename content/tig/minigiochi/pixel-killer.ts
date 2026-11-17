import type { ColorName, ShapeInput } from "@/lib/tig/games/mechanics/m1/draw";
import type { PixelInput } from "@/lib/tig/games/mechanics/pixel-killer";

/**
 * 02 · PIXEL KILLER — varianti. Dodici «foto» ORIGINALI disegnate con forme semplici (tela 160×90), pensate
 * per essere irriconoscibili a 16×9, ambigue a 32×18 e chiare a 64×36. Le opzioni sbagliate hanno forma o
 * colori simili al soggetto, così i primi quadrettoni non bastano. Gli indizi testuali (accessibilità)
 * descrivono quello che si vede a quel livello, senza nominare il soggetto.
 */

const rect = (x: number, y: number, w: number, h: number, c: ColorName, r?: number, o?: number): ShapeInput => ({ k: "rect", x, y, w, h, c, ...(r ? { r } : {}), ...(o !== undefined ? { o } : {}) });
const ell = (x: number, y: number, rx: number, ry: number, c: ColorName, o?: number, rot?: number): ShapeInput => ({ k: "ell", x, y, rx, ry, c, ...(o !== undefined ? { o } : {}), ...(rot ? { rot } : {}) });
const poly = (c: ColorName, ...p: number[]): ShapeInput => ({ k: "poly", p, c });
const polyO = (c: ColorName, o: number, ...p: number[]): ShapeInput => ({ k: "poly", p, c, o });
const line = (x1: number, y1: number, x2: number, y2: number, w: number, c: ColorName, o?: number): ShapeInput => ({ k: "line", x1, y1, x2, y2, w, c, ...(o !== undefined ? { o } : {}) });

/** Spicchio di cerchio (angoli in gradi, y verso il basso: 0° = destra, 90° = giù). */
function sector(cx: number, cy: number, r: number, a0: number, a1: number, c: ColorName, n = 24): ShapeInput {
  const p: number[] = [cx, cy];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    p.push(Math.round((cx + r * Math.cos(a)) * 10) / 10, Math.round((cy + r * Math.sin(a)) * 10) / 10);
  }
  return { k: "poly", p, c };
}

/** Anello fatto di segmenti (ruote, cerchi vuoti). */
function ring(cx: number, cy: number, r: number, w: number, c: ColorName, n = 22): ShapeInput[] {
  const out: ShapeInput[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = ((i + 1) / n) * Math.PI * 2;
    out.push(line(cx + r * Math.cos(a), cy + r * Math.sin(a), cx + r * Math.cos(b), cy + r * Math.sin(b), w, c));
  }
  return out;
}

const SOLE = (x: number, y: number, r = 9): ShapeInput[] => [ell(x, y, r + 4, r + 4, "giallo", 0.25), ell(x, y, r, r, "giallo")];

const varianti: PixelInput[] = [
  {
    id: "fetta-di-anguria",
    difficulty: "facile",
    art: {
      w: 160,
      h: 90,
      bg: "cielo2",
      shapes: [
        ...SOLE(136, 16),
        rect(0, 56, 160, 34, "prato"),
        poly("rosso", 16, 66, 144, 66, 156, 90, 4, 90),
        ...[24, 52, 80, 108, 136].map((x) => rect(x, 70, 12, 7, "panna", 0, 0.8)),
        ...[38, 66, 94, 122].map((x) => rect(x, 80, 12, 8, "panna", 0, 0.8)),
        sector(80, 46, 34, 0, 180, "verde"),
        sector(80, 46, 31, 0, 180, "panna"),
        sector(80, 46, 28.5, 0, 180, "rosso"),
        ...[
          [64, 56],
          [80, 58],
          [96, 56],
          [70, 68],
          [90, 68],
          [80, 74],
        ].map(([x, y]) => ell(x, y, 1.3, 2.2, "nero")),
      ],
    },
    hints: [
      "Una grande macchia rossa e verde a forma di mezzaluna al centro, su fondo azzurro e verde.",
      "La mezzaluna rossa ha un bordo verde scuro e qualche puntino scuro dentro; sotto c'è qualcosa di rosso e bianco.",
      "Una mezzaluna rossa con bordo verde e puntini neri, appoggiata su una tovaglia a quadri al sole.",
    ],
    alt: "Una fetta d'anguria con la buccia verde e i semi neri su una tovaglia a quadri, in un prato al sole.",
    options: [
      { id: "anguria", text: "Una fetta d'anguria" },
      { id: "pizza", text: "Una fetta di pizza" },
      { id: "arancia", text: "Un'arancia tagliata" },
      { id: "pomodoro", text: "Un pomodoro" },
    ],
    solution: { optionId: "anguria" },
    explain: "Mezzaluna rossa, buccia verde, semi neri: è una fetta d'anguria da picnic. La pizza non ha la buccia verde e l'arancia non è rossa.",
  },
  {
    id: "faro-al-tramonto",
    difficulty: "media",
    art: {
      w: 160,
      h: 90,
      bg: "cielo",
      shapes: [
        rect(0, 36, 160, 26, "tramonto", 0, 0.55),
        polyO("giallo", 0.35, 86, 13, 160, 2, 160, 26),
        polyO("giallo", 0.35, 74, 13, 0, 2, 0, 26),
        rect(0, 62, 160, 28, "mare"),
        line(10, 72, 30, 72, 1, "bianco", 0.5),
        line(120, 80, 146, 80, 1, "bianco", 0.5),
        poly("grigio2", 38, 90, 48, 66, 70, 61, 96, 64, 112, 90),
        poly("bianco", 70, 64, 90, 64, 86, 24, 74, 24),
        poly("rosso", 70.8, 56, 89.2, 56, 88.4, 48, 71.6, 48),
        poly("rosso", 72.4, 40, 87.6, 40, 86.8, 32, 73.2, 32),
        rect(71, 20, 18, 4, "nero"),
        rect(74, 10, 12, 10, "giallo"),
        poly("rosso2", 72, 10, 80, 2, 88, 10),
      ],
    },
    hints: [
      "Una striscia chiara verticale al centro, cielo azzurro e arancione, blu scuro in basso.",
      "Una torre stretta a strisce bianche e rosse sopra uno scoglio grigio, con un punto giallo in cima.",
      "Torre a strisce bianche e rosse su uno scoglio in mezzo al mare, con due fasci di luce gialla in cima.",
    ],
    alt: "Un faro a strisce bianche e rosse su uno scoglio, nel mare al tramonto, con i fasci di luce accesi.",
    options: [
      { id: "faro", text: "Un faro" },
      { id: "razzo", text: "Un razzo" },
      { id: "campanile", text: "Un campanile" },
      { id: "ciminiera", text: "Una ciminiera" },
    ],
    solution: { optionId: "faro" },
    explain: "Torre a strisce sullo scoglio, in mezzo al mare, con i fasci di luce: è un faro. Il razzo non ha il mare intorno né la lanterna in cima.",
  },
  {
    id: "cactus-nel-deserto",
    difficulty: "facile",
    art: {
      w: 160,
      h: 90,
      bg: "cielo",
      shapes: [
        ...SOLE(132, 18, 10),
        ell(36, 92, 70, 24, "sabbia"),
        ell(130, 96, 64, 26, "sabbia"),
        rect(0, 74, 160, 16, "sabbia"),
        rect(72, 22, 16, 58, "verde", 8),
        rect(54, 42, 10, 26, "verde", 5),
        rect(54, 60, 22, 9, "verde", 4.5),
        rect(96, 32, 10, 26, "verde", 5),
        rect(84, 50, 22, 9, "verde", 4.5),
        line(80, 28, 80, 76, 1.2, "prato2", 0.7),
        line(59, 46, 59, 64, 1, "prato2", 0.7),
        line(101, 36, 101, 54, 1, "prato2", 0.7),
        ell(80, 22, 4, 3, "rosa"),
      ],
    },
    hints: [
      "Una macchia verde verticale al centro, cielo azzurro sopra e sabbia gialla sotto.",
      "Una forma verde alta con due braccia che salgono, una a sinistra e una a destra, in mezzo alla sabbia.",
      "Un tronco verde con due braccia piegate verso l'alto e un fiorellino rosa in cima, nel deserto al sole.",
    ],
    alt: "Un cactus verde con due braccia e un fiore rosa in cima, nel deserto sotto il sole.",
    options: [
      { id: "cactus", text: "Un cactus" },
      { id: "palma", text: "Una palma" },
      { id: "abete", text: "Un abete" },
      { id: "bambu", text: "Una canna di bambù" },
    ],
    solution: { optionId: "cactus" },
    explain: "Tronco verde con due braccia che salgono, in mezzo alla sabbia: è un cactus. La palma ha le foglie in cima, l'abete è a triangolo.",
  },
  {
    id: "paperella-nella-vasca",
    difficulty: "media",
    art: {
      w: 160,
      h: 90,
      bg: "bianco",
      shapes: [
        ...[0, 20, 40, 60, 80, 100, 120, 140].map((x) => line(x, 0, x, 50, 0.6, "grigio", 0.5)),
        line(0, 25, 160, 25, 0.6, "grigio", 0.5),
        rect(0, 50, 160, 40, "cielo"),
        poly("giallo", 50, 52, 56, 42, 62, 56),
        ell(78, 58, 26, 14, "giallo"),
        ell(74, 55, 11, 6, "arancio", 0.3, -15),
        ell(98, 38, 11, 11, "giallo"),
        poly("arancio", 107, 37, 121, 41, 107, 45),
        ell(101, 35, 1.8, 1.8, "nero"),
        rect(0, 64, 160, 26, "cielo", 0, 0.75),
        ...[
          [20, 58, 5],
          [30, 54, 3],
          [134, 60, 6],
          [146, 54, 3],
          [124, 72, 4],
        ].map(([x, y, r]) => ell(x, y, r, r, "neve", 0.8)),
      ],
    },
    hints: [
      "Una macchia gialla al centro su fondo bianco in alto e azzurro in basso.",
      "Una forma gialla rotonda con una testa più piccola a destra e un punto arancione; sotto c'è acqua azzurra.",
      "Un corpo giallo che galleggia nell'acqua azzurra, con testa tonda, occhio nero e becco arancione, tra le bolle.",
    ],
    alt: "Una paperella di gomma gialla che galleggia nell'acqua della vasca, tra le bolle di sapone, davanti alle piastrelle bianche.",
    options: [
      { id: "paperella", text: "Una paperella di gomma" },
      { id: "pulcino", text: "Un pulcino" },
      { id: "limone", text: "Un limone" },
      { id: "canarino", text: "Un canarino" },
    ],
    solution: { optionId: "paperella" },
    explain: "Gialla, col becco arancione, galleggia nell'acqua tra le bolle davanti alle piastrelle: è la paperella della vasca, non un pulcino o un canarino.",
  },
  {
    id: "mongolfiera",
    difficulty: "media",
    art: {
      w: 160,
      h: 90,
      bg: "cielo",
      shapes: [
        ell(30, 20, 14, 6, "neve"),
        ell(42, 17, 10, 7, "neve"),
        ell(132, 62, 18, 6, "neve"),
        ell(120, 59, 9, 6, "neve"),
        rect(0, 80, 160, 10, "prato"),
        ell(80, 34, 26, 30, "rosso"),
        ell(80, 34, 17, 30, "giallo"),
        ell(80, 34, 7, 30, "rosso"),
        poly("rosso", 60, 52, 100, 52, 89, 66, 71, 66),
        poly("giallo", 70, 52, 90, 52, 85, 66, 75, 66),
        line(72, 66, 76, 75, 0.8, "nero"),
        line(88, 66, 84, 75, 0.8, "nero"),
        rect(74, 75, 12, 8, "legno", 1),
      ],
    },
    hints: [
      "Una grande macchia rossa e gialla al centro, in un cielo azzurro con qualcosa di bianco.",
      "Una forma ovale a spicchi rossi e gialli, più stretta in basso, con un puntino marrone sotto.",
      "Un grande ovale a spicchi rossi e gialli tra le nuvole, con delle corde e una cesta di legno appesa sotto.",
    ],
    alt: "Una mongolfiera a spicchi rossi e gialli con la cesta di legno, tra le nuvole sopra un prato.",
    options: [
      { id: "mongolfiera", text: "Una mongolfiera" },
      { id: "lampadina", text: "Una lampadina" },
      { id: "palloncino", text: "Un palloncino" },
      { id: "gelato", text: "Un cono gelato" },
    ],
    solution: { optionId: "mongolfiera" },
    explain: "Ovale a spicchi tra le nuvole, con corde e una cesta sotto: è una mongolfiera. Il palloncino non ha la cesta, la lampadina non vola.",
  },
  {
    id: "semaforo-di-notte",
    difficulty: "facile",
    art: {
      w: 160,
      h: 90,
      bg: "notte",
      shapes: [
        rect(4, 24, 30, 50, "grafite"),
        rect(120, 14, 36, 60, "grafite"),
        ...[
          [10, 32],
          [22, 44],
          [128, 22],
          [142, 40],
          [128, 54],
        ].map(([x, y]) => rect(x, y, 5, 5, "giallo", 0, 0.7)),
        rect(0, 74, 160, 16, "grigio2"),
        ...[18, 38, 58, 78, 98, 118, 138].map((x) => rect(x, 78, 10, 9, "bianco", 0, 0.85)),
        rect(78, 40, 4, 36, "grigio"),
        rect(69, 4, 22, 42, "nero", 3),
        ell(80, 13, 11, 11, "rosso", 0.25),
        ell(80, 13, 6, 6, "rosso"),
        ell(80, 25, 6, 6, "marrone", 0.8),
        ell(80, 37, 6, 6, "prato2", 0.5),
      ],
    },
    hints: [
      "Fondo scuro, un rettangolo nero verticale al centro con un punto rosso in alto, strisce chiare in basso.",
      "Un palo con in cima una scatola nera alta: dentro un cerchio rosso acceso e due cerchi spenti; sotto delle strisce bianche.",
      "Una scatola nera su un palo con tre luci in colonna, la rossa accesa, sopra le strisce bianche di una strada di notte.",
    ],
    alt: "Un semaforo con il rosso acceso di notte, sopra le strisce pedonali, tra palazzi con le finestre illuminate.",
    options: [
      { id: "semaforo", text: "Un semaforo" },
      { id: "telecomando", text: "Un telecomando" },
      { id: "parchimetro", text: "Un parchimetro" },
      { id: "distributore", text: "Un distributore di bibite" },
    ],
    solution: { optionId: "semaforo" },
    explain: "Tre luci in colonna su un palo, la rossa accesa, e le strisce pedonali sotto: è un semaforo di notte.",
  },
  {
    id: "barca-a-vela",
    difficulty: "facile",
    art: {
      w: 160,
      h: 90,
      bg: "cielo",
      shapes: [
        ...SOLE(28, 18),
        rect(0, 60, 160, 30, "mare"),
        ...[
          [12, 70],
          [118, 74],
          [40, 82],
          [96, 86],
        ].map(([x, y]) => line(x, y, x + 18, y, 1, "bianco", 0.6)),
        poly("legno2", 46, 60, 114, 60, 104, 71, 56, 71),
        rect(79, 14, 2, 46, "marrone"),
        poly("bianco", 81, 16, 81, 57, 110, 57),
        poly("panna", 79, 22, 79, 57, 54, 57),
        poly("rosso", 81, 14, 91, 17, 81, 20),
      ],
    },
    hints: [
      "Cielo azzurro sopra, blu scuro sotto, una macchia bianca a punta al centro.",
      "Due triangoli bianchi sopra una forma marrone allungata, sul blu; un cerchio giallo a sinistra.",
      "Due vele triangolari bianche su uno scafo di legno, in mare, con una bandierina rossa in cima e il sole.",
    ],
    alt: "Una barca a vela con due vele bianche e una bandierina rossa, in mare aperto sotto il sole.",
    options: [
      { id: "barca", text: "Una barca a vela" },
      { id: "tenda", text: "Una tenda da campeggio" },
      { id: "squalo", text: "Una pinna di squalo" },
      { id: "aquilone", text: "Un aquilone" },
    ],
    solution: { optionId: "barca" },
    explain: "È una barca a vela: due vele a triangolo sopra uno scafo, in mezzo al mare. La pinna di squalo è grigia e senza scafo, l'aquilone non galleggia.",
  },
  {
    id: "cono-gelato",
    difficulty: "media",
    art: {
      w: 160,
      h: 90,
      bg: "rosa",
      shapes: [
        ell(80, 50, 46, 46, "panna", 0.35),
        poly("arancio", 67, 46, 93, 46, 80, 86),
        line(70, 52, 86, 70, 0.8, "legno2"),
        line(73, 47, 91, 58, 0.8, "legno2"),
        line(90, 52, 74, 70, 0.8, "legno2"),
        line(87, 47, 69, 58, 0.8, "legno2"),
        ell(80, 41, 15, 11, "panna"),
        ell(70, 47, 4, 3, "panna"),
        ell(80, 28, 12, 10, "marrone"),
        line(80, 13, 83, 8, 0.8, "prato2"),
        ell(80, 16, 3.6, 3.6, "rosso"),
      ],
    },
    hints: [
      "Fondo rosa, una forma chiara in alto al centro e una arancione stretta sotto.",
      "Una punta arancione rivolta in basso, sopra due palline: una chiara e una marrone, con un puntino rosso in cima.",
      "Un cono a rombi arancione con sopra una pallina bianca, una marrone e una ciliegia rossa, su fondo rosa.",
    ],
    alt: "Un cono gelato con una pallina di crema, una di cioccolato e una ciliegia in cima, su fondo rosa.",
    options: [
      { id: "gelato", text: "Un cono gelato" },
      { id: "microfono", text: "Un microfono" },
      { id: "fiaccola", text: "Una fiaccola" },
      { id: "cupcake", text: "Un cupcake" },
    ],
    solution: { optionId: "gelato" },
    explain: "Cono a rombi con due palline e la ciliegia in cima: è un cono gelato. Il cupcake ha la base a pirottino, non a punta.",
  },
  {
    id: "tenda-in-montagna",
    difficulty: "difficile",
    art: {
      w: 160,
      h: 90,
      bg: "notte",
      shapes: [
        ...[
          [12, 10],
          [34, 22],
          [58, 8],
          [100, 16],
          [148, 26],
          [70, 26],
        ].map(([x, y]) => ell(x, y, 0.9, 0.9, "bianco")),
        ell(134, 14, 7, 7, "panna"),
        ell(138, 11, 6, 6, "notte"),
        poly("grafite", 0, 70, 30, 34, 62, 70),
        poly("acciaio", 40, 70, 96, 28, 150, 70),
        rect(0, 70, 160, 20, "prato2"),
        poly("arancio", 46, 74, 78, 36, 110, 74),
        poly("marrone", 70, 74, 78, 52, 86, 74),
        line(78, 36, 78, 32, 1, "grigio"),
        ell(128, 72, 15, 7, "arancio", 0.22),
        line(120, 76, 136, 72, 2, "legno2"),
        line(120, 72, 136, 76, 2, "legno2"),
        poly("arancio", 121, 73, 128, 58, 135, 73),
        poly("giallo", 124, 73, 128, 64, 132, 73),
      ],
    },
    hints: [
      "Quasi tutto scuro, una macchia arancione al centro in basso e un puntino arancione a destra.",
      "Un triangolo arancione con un triangolino scuro dentro, montagne scure dietro, un piccolo bagliore arancione a destra.",
      "Un triangolo arancione con l'apertura davanti, sull'erba di notte sotto le montagne, accanto a un piccolo fuoco.",
    ],
    alt: "Una tenda da campeggio arancione con l'entrata aperta, di notte sotto le montagne e la luna, accanto a un falò.",
    options: [
      { id: "tenda", text: "Una tenda da campeggio" },
      { id: "piramide", text: "Una piramide" },
      { id: "torta", text: "Una fetta di torta" },
      { id: "vela", text: "Una vela" },
    ],
    solution: { optionId: "tenda" },
    explain: "Triangolo arancione con l'entrata, sull'erba in montagna e col falò accanto: è una tenda da campeggio. La piramide sarebbe nel deserto, e grande.",
  },
  {
    id: "bicicletta-al-parco",
    difficulty: "difficile",
    art: {
      w: 160,
      h: 90,
      bg: "cielo2",
      shapes: [
        ell(138, 30, 16, 16, "prato2"),
        rect(136, 40, 4, 30, "marrone"),
        rect(0, 66, 160, 24, "prato"),
        ...ring(52, 62, 16, 2.6, "nero"),
        ...ring(110, 62, 16, 2.6, "nero"),
        line(52, 62, 52, 47, 0.6, "grigio"),
        line(37, 62, 67, 62, 0.6, "grigio"),
        line(110, 47, 110, 77, 0.6, "grigio"),
        line(95, 62, 125, 62, 0.6, "grigio"),
        line(52, 62, 78, 62, 2.4, "rosso"),
        line(78, 62, 70, 40, 2.4, "rosso"),
        line(70, 42, 101, 42, 2.4, "rosso"),
        line(78, 62, 101, 42, 2.4, "rosso"),
        line(52, 62, 70, 42, 2.2, "rosso"),
        line(101, 42, 110, 62, 2.4, "rosso"),
        line(101, 42, 99, 33, 2, "grafite"),
        line(95, 33, 105, 33, 2.2, "grafite"),
        rect(63, 36, 13, 3.5, "nero", 1.5),
        ell(78, 62, 3, 3, "grafite"),
      ],
    },
    hints: [
      "Fondo azzurro chiaro e verde, due macchie scure rotonde e una linea rossa tra loro.",
      "Due cerchi scuri uguali uno accanto all'altro, collegati da linee rosse a triangolo; un albero a destra.",
      "Due ruote nere unite da un telaio rosso, con sellino e manubrio scuri, sul prato di un parco.",
    ],
    alt: "Una bicicletta col telaio rosso, sellino e manubrio neri, ferma sul prato di un parco vicino a un albero.",
    options: [
      { id: "bici", text: "Una bicicletta" },
      { id: "monopattino", text: "Un monopattino" },
      { id: "carrozzina", text: "Una carrozzina" },
      { id: "occhiali", text: "Un paio di occhiali" },
    ],
    solution: { optionId: "bici" },
    explain: "Due ruote uguali, telaio rosso a triangolo, sellino e manubrio: è una bicicletta. Gli occhiali hanno due cerchi, ma niente sellino né telaio.",
  },
  {
    id: "cocktail-al-bancone",
    difficulty: "media",
    art: {
      w: 160,
      h: 90,
      bg: "notte",
      shapes: [
        ...(
          [
            [20, 20, 9, "viola"],
            [40, 46, 6, "ciano"],
            [128, 18, 8, "rosa"],
            [146, 46, 6, "ambra"],
            [112, 40, 5, "lime"],
          ] as [number, number, number, ColorName][]
        ).map(([x, y, r, c]) => ell(x, y, r, r, c, 0.3)),
        rect(0, 74, 160, 16, "legno2"),
        polyO("cielo2", 0.5, 56, 20, 104, 20, 80, 50),
        poly("arancio", 60, 24, 100, 24, 80, 47),
        rect(79, 50, 2, 21, "cielo2"),
        ell(80, 72, 12, 2.6, "cielo2"),
        line(66, 8, 82, 38, 2, "rosso"),
        ell(101, 22, 7, 7, "giallo"),
        ell(101, 22, 5, 5, "panna", 0.7),
        line(101, 17, 101, 27, 0.6, "giallo"),
        line(96, 22, 106, 22, 0.6, "giallo"),
      ],
    },
    hints: [
      "Fondo scuro con macchie colorate sfocate, una forma arancione a punta al centro, una striscia marrone in basso.",
      "Un triangolo arancione rovesciato su un'asta sottile, con un tondo giallo sul bordo e una linea rossa che esce.",
      "Un bicchiere a coppa con un liquido arancione, una fetta di limone sul bordo e una cannuccia rossa, su un bancone di notte.",
    ],
    alt: "Un cocktail arancione in un bicchiere a coppa con cannuccia rossa e fetta di limone, sul bancone di un bar di sera.",
    options: [
      { id: "cocktail", text: "Un cocktail" },
      { id: "imbuto", text: "Un imbuto" },
      { id: "lampada", text: "Una lampada da tavolo" },
      { id: "ombrellone", text: "Un ombrellone" },
    ],
    solution: { optionId: "cocktail" },
    explain: "Coppa su uno stelo, liquido arancione, limone sul bordo e cannuccia: è un cocktail al bancone. L'imbuto non ha né stelo né limone.",
  },
  {
    id: "chitarra",
    difficulty: "difficile",
    art: {
      w: 160,
      h: 90,
      bg: "grafite",
      shapes: [
        rect(0, 72, 160, 18, "legno2"),
        ell(80, 50, 74, 26, "rosso2", 0.35),
        ell(44, 48, 22, 20, "legno"),
        ell(70, 48, 16, 15, "legno"),
        ell(62, 48, 5, 5, "nero"),
        rect(34, 44, 4, 8, "legno2"),
        rect(84, 45, 54, 6, "legno2"),
        rect(137, 42, 15, 12, "marrone", 2),
        ...[44.5, 46.5, 48.5].map((y) => line(36, y, 146, y, 0.4, "bianco", 0.7)),
        ...[140, 145, 150].map((x) => ell(x, 41, 1.2, 1.2, "grigio")),
        ...[140, 145, 150].map((x) => ell(x, 55, 1.2, 1.2, "grigio")),
      ],
    },
    hints: [
      "Fondo grigio scuro, una macchia marrone chiaro a sinistra che si allunga in una striscia verso destra.",
      "Una forma a otto marrone con un buco scuro, da cui parte un manico lungo e dritto verso destra.",
      "Una cassa di legno a otto con il buco rotondo, un lungo manico scuro con le corde chiare e le chiavette in fondo.",
    ],
    alt: "Una chitarra acustica di legno appoggiata di traverso su un tappeto, con le corde e le chiavette in vista.",
    options: [
      { id: "chitarra", text: "Una chitarra" },
      { id: "racchetta", text: "Una racchetta da tennis" },
      { id: "padella", text: "Una padella" },
      { id: "mestolo", text: "Un mestolo" },
    ],
    solution: { optionId: "chitarra" },
    explain: "Cassa a otto col buco rotondo, manico lungo con le corde e le chiavette: è una chitarra. Racchetta e padella hanno una testa tonda sola.",
  },
];

export default varianti;
