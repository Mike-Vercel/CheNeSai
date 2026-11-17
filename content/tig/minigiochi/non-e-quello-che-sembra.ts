import type { IconKind, Tone } from "@/lib/tig/games/components/art";
import type { ArtInput, ColorName, ShapeInput } from "@/lib/tig/games/mechanics/m1/draw";
import type { NonEInput } from "@/lib/tig/games/mechanics/non-e-quello-che-sembra";

/**
 * 08 · NON È QUELLO CHE SEMBRA — varianti. Ogni scena è costruita da una funzione con pochi parametri:
 * l'immagine giusta li ha tutti come dice la descrizione, ognuna delle altre due ne sbaglia UNO (un'ora,
 * un oggetto in più, due oggetti scambiati di posto, una tazza girata). Lo schema verifica che solo la
 * soluzione rispetti tutte le condizioni. Tela 120×90; mai domande sui colori.
 */

type It = { kind: IconKind; x: number; y: number; s?: number; tone?: Tone; label?: string; flip?: boolean; rot?: number };

const icon = (i: It): ShapeInput => ({ k: "icon", s: 24, tone: "white", ...i });

function art(deco: ShapeInput[], items: It[], bg: ColorName = "grafite"): ArtInput {
  return { w: 120, h: 90, bg, shapes: [...deco, ...items.map(icon)] };
}

// --- scenografie ------------------------------------------------------------

const MENSOLA: ShapeInput[] = [
  { k: "rect", x: 0, y: 0, w: 120, h: 90, c: "grafite" },
  { k: "rect", x: 0, y: 74, w: 120, h: 16, c: "acciaio" },
  { k: "rect", x: 4, y: 62, w: 112, h: 4, r: 1, c: "legno" },
  { k: "rect", x: 14, y: 66, w: 3, h: 7, c: "legno2" },
  { k: "rect", x: 103, y: 66, w: 3, h: 7, c: "legno2" },
];

const SCRIVANIA: ShapeInput[] = [
  { k: "rect", x: 0, y: 0, w: 120, h: 90, c: "grafite" },
  { k: "rect", x: 2, y: 66, w: 116, h: 5, r: 1, c: "legno2" },
  { k: "rect", x: 8, y: 71, w: 4, h: 19, c: "marrone" },
  { k: "rect", x: 108, y: 71, w: 4, h: 19, c: "marrone" },
];

const FRIGO: ShapeInput[] = [
  { k: "rect", x: 0, y: 0, w: 120, h: 90, c: "acciaio" },
  { k: "rect", x: 16, y: 2, w: 88, h: 86, r: 4, c: "bianco" },
  { k: "rect", x: 21, y: 6, w: 78, h: 78, r: 2, c: "cielo2" },
  { k: "rect", x: 21, y: 34, w: 78, h: 2, c: "grigio" },
  { k: "rect", x: 21, y: 60, w: 78, h: 2, c: "grigio" },
];

const INGRESSO: ShapeInput[] = [
  { k: "rect", x: 0, y: 0, w: 120, h: 90, c: "grafite" },
  { k: "rect", x: 0, y: 82, w: 120, h: 8, c: "legno2" },
  { k: "rect", x: 36, y: 50, w: 52, h: 4, r: 1, c: "legno" },
  { k: "rect", x: 40, y: 54, w: 3, h: 28, c: "legno2" },
  { k: "rect", x: 81, y: 54, w: 3, h: 28, c: "legno2" },
];

const TAVOLO: ShapeInput[] = [
  { k: "rect", x: 0, y: 0, w: 120, h: 90, c: "grafite" },
  { k: "rect", x: 0, y: 70, w: 120, h: 20, c: "legno" },
  { k: "rect", x: 0, y: 70, w: 120, h: 2, c: "legno2" },
];

const COMODINO: ShapeInput[] = [
  { k: "rect", x: 0, y: 0, w: 120, h: 90, c: "acciaio" },
  { k: "rect", x: 0, y: 80, w: 120, h: 10, c: "grafite" },
  { k: "rect", x: 26, y: 58, w: 68, h: 24, r: 2, c: "legno" },
  { k: "rect", x: 30, y: 66, w: 60, h: 2, c: "legno2" },
];

const PAVIMENTO: ShapeInput[] = [
  { k: "rect", x: 0, y: 0, w: 120, h: 90, c: "grafite" },
  { k: "rect", x: 0, y: 64, w: 120, h: 26, c: "legno2" },
  { k: "line", x1: 0, y1: 77, x2: 120, y2: 77, w: 0.6, c: "marrone" },
];

const BACHECA: ShapeInput[] = [
  { k: "rect", x: 0, y: 0, w: 120, h: 90, c: "grafite" },
  { k: "rect", x: 6, y: 6, w: 108, h: 78, r: 3, c: "legno2" },
  { k: "rect", x: 9, y: 9, w: 102, h: 72, r: 2, c: "sabbia" },
];

const DIVANO: ShapeInput[] = [
  { k: "rect", x: 0, y: 0, w: 120, h: 90, c: "grafite" },
  { k: "rect", x: 0, y: 80, w: 120, h: 10, c: "legno2" },
  { k: "rect", x: 6, y: 30, w: 84, h: 22, r: 6, c: "mare" },
  { k: "rect", x: 2, y: 48, w: 92, h: 24, r: 6, c: "mare2" },
  { k: "rect", x: 8, y: 72, w: 4, h: 8, c: "nero" },
  { k: "rect", x: 84, y: 72, w: 4, h: 8, c: "nero" },
  { k: "rect", x: 96, y: 66, w: 22, h: 3, c: "legno" },
  { k: "rect", x: 105, y: 69, w: 3, h: 11, c: "legno2" },
];

const GAMER: ShapeInput[] = [
  { k: "rect", x: 0, y: 0, w: 120, h: 90, c: "notte" },
  { k: "ell", x: 60, y: 34, rx: 40, ry: 26, c: "viola", o: 0.18 },
  { k: "rect", x: 2, y: 68, w: 116, h: 5, r: 1, c: "acciaio" },
  { k: "rect", x: 2, y: 73, w: 116, h: 17, c: "nero" },
];

const DAVANZALE: ShapeInput[] = [
  { k: "rect", x: 0, y: 0, w: 120, h: 90, c: "grafite" },
  { k: "rect", x: 8, y: 6, w: 76, h: 62, c: "cielo" },
  { k: "ell", x: 30, y: 22, rx: 12, ry: 5, c: "cielo2" },
  { k: "rect", x: 44, y: 6, w: 3, h: 62, c: "bianco" },
  { k: "rect", x: 8, y: 36, w: 76, h: 3, c: "bianco" },
  { k: "rect", x: 4, y: 68, w: 112, h: 5, r: 1, c: "bianco" },
];

// --- varianti ---------------------------------------------------------------

function mensola(o: { ora: string; scambia?: boolean; dueCandele?: boolean }): ArtInput {
  return art(MENSOLA, [
    { kind: "orologio", x: 16, y: 50, label: o.ora, tone: "lime" },
    { kind: "pianta", x: o.scambia ? 78 : 38, y: 50, tone: "lime" },
    { kind: "candela", x: 58, y: 52, s: 20, tone: "amber" },
    { kind: "libro", x: o.scambia ? 38 : 78, y: 51, s: 22, label: "GIALLI", tone: "red" },
    o.dueCandele ? { kind: "candela", x: 100, y: 52, s: 20, tone: "violet" } : { kind: "tazza", x: 100, y: 52, s: 20, label: "CASA", tone: "white" },
  ]);
}

function scrivania(o: { schermo: string; manicoSinistra: boolean; occhialiSotto?: boolean }): ArtInput {
  return art(SCRIVANIA, [
    { kind: "pianta", x: 12, y: 54, s: 22, tone: "lime" },
    { kind: "laptop", x: 38, y: 52, s: 34, label: o.schermo, tone: "cyan" },
    { kind: "tazza", x: 70, y: 56, s: 20, flip: o.manicoSinistra, tone: "red" },
    { kind: "libro", x: 98, y: 55, s: 22, label: "AGENDA", tone: "amber" },
    { kind: "occhiali", x: 98, y: o.occhialiSotto ? 80 : 36, s: 18, tone: "white" },
  ]);
}

function frigo(o: { tortaInBasso?: boolean; borracce: number; postit: string }): ArtInput {
  const b: It[] = Array.from({ length: o.borracce }, (_, i) => ({ kind: "borraccia", x: 34 + i * 13, y: 48, s: 18, tone: "cyan" }));
  return art(FRIGO, [
    { kind: "torta", x: 44, y: o.tortaInBasso ? 72 : 21, s: 22, label: "TIRAMISÙ", tone: "amber" },
    { kind: "pizza", x: 78, y: o.tortaInBasso ? 21 : 72, s: 24, label: "AVANZI", tone: "red" },
    ...b,
    { kind: "tazza", x: 84, y: 48, s: 16, label: "YOGURT", tone: "white" },
    { kind: "postit", x: 108, y: 16, s: 16, label: o.postit, tone: "amber", rot: 6 },
  ], "acciaio");
}

function ingresso(o: { scambia?: boolean; dueOmbrelli?: boolean; data: string }): ArtInput {
  return art(INGRESSO, [
    { kind: "calendario", x: 18, y: 22, s: 24, label: o.data, tone: "red" },
    { kind: "chiavi", x: o.scambia ? 74 : 50, y: 42, s: 16, tone: "amber" },
    { kind: "portafoglio", x: o.scambia ? 50 : 74, y: 42, s: 18, tone: "violet" },
    { kind: "ombrello", x: 104, y: 62, s: 26, tone: "cyan" },
    { kind: "scarpe", x: 20, y: 74, s: 22, tone: "white" },
    o.dueOmbrelli ? { kind: "ombrello", x: 62, y: 70, s: 22, tone: "red" } : { kind: "zaino", x: 62, y: 70, s: 20, tone: "red" },
  ]);
}

function compleanno(o: { torta: string; palloncini: number }): ArtInput {
  const xs = [14, 32, 50, 104];
  const tones: Tone[] = ["lime", "red", "cyan", "violet"];
  return art(TAVOLO, [
    ...xs.slice(0, o.palloncini).map((x, i): It => ({ kind: "palloncino", x, y: 22, s: 22, tone: tones[i] })),
    { kind: "torta", x: 58, y: 58, s: 30, label: o.torta, tone: "violet" },
    { kind: "candela", x: 24, y: 62, s: 16, tone: "amber" },
    { kind: "biglietto", x: 96, y: 62, s: 24, label: "BUONO CENA", tone: "amber", rot: -4 },
  ]);
}

function comodino(o: { occhiali?: boolean; scambia?: boolean }): ArtInput {
  return art(COMODINO, [
    { kind: "lampada", x: o.scambia ? 80 : 40, y: 44, s: 26, tone: "amber" },
    { kind: "telefono", x: 60, y: 48, s: 18, label: "6:45", tone: "cyan" },
    { kind: "libro", x: o.scambia ? 40 : 80, y: 48, s: 18, label: "NOIR", tone: "red" },
    ...(o.occhiali ? [{ kind: "occhiali", x: 60, y: 62, s: 12, tone: "white" } as It] : []),
    { kind: "pianta", x: 108, y: 70, s: 22, tone: "lime" },
    { kind: "scarpe", x: 12, y: 78, s: 16, tone: "violet" },
  ]);
}

function valigia(o: { punta: "destra" | "sinistra"; dueLibri?: boolean }): ArtInput {
  return art(PAVIMENTO, [
    { kind: "valigia", x: 38, y: 50, s: 40, label: "ROMA", tone: "violet" },
    { kind: "scarpe", x: 92, y: 74, s: 24, flip: o.punta === "sinistra", tone: "red" },
    { kind: "libro", x: 92, y: 42, s: 18, label: "GUIDA", tone: "amber" },
    o.dueLibri ? { kind: "libro", x: 72, y: 42, s: 16, label: "MAPPE", tone: "cyan" } : { kind: "occhiali", x: 72, y: 44, s: 14, tone: "white" },
    { kind: "borraccia", x: 110, y: 44, s: 14, tone: "lime" },
  ]);
}

function bacheca(o: { data: string; postit: number }): ArtInput {
  const notes: It[] = [
    { kind: "postit", x: 64, y: 28, s: 18, label: "FERIE?", tone: "amber", rot: -5 },
    { kind: "postit", x: 72, y: 62, s: 18, label: "PIZZA VEN", tone: "amber", rot: 4 },
    { kind: "postit", x: 96, y: 62, s: 18, label: "CHIAMA IT", tone: "amber", rot: -3 },
    { kind: "postit", x: 50, y: 64, s: 16, label: "CAFFÈ", tone: "amber", rot: 6 },
  ];
  return art(BACHECA, [
    { kind: "poster", x: 28, y: 32, s: 32, label: "RIUNIONE ORE 10", tone: "cyan" },
    { kind: "calendario", x: 92, y: 26, s: 22, label: o.data, tone: "red" },
    ...notes.slice(0, o.postit),
    { kind: "biglietto", x: 24, y: 68, s: 20, label: "MENSA", tone: "lime" },
  ]);
}

function divano(o: { codaSinistra?: boolean; tazza: string }): ArtInput {
  return art(DIVANO, [
    { kind: "gatto", x: 36, y: 40, s: 28, flip: o.codaSinistra, tone: "amber" },
    { kind: "libro", x: 70, y: 52, s: 18, label: "ROMANZO", tone: "cyan", rot: -10 },
    { kind: "tazza", x: 106, y: 57, s: 18, label: o.tazza, tone: "white" },
    { kind: "lampada", x: 106, y: 20, s: 20, tone: "amber" },
  ]);
}

function spesa(o: { tazze: number; scambia?: boolean }): ArtInput {
  const cups: It[] = [
    { kind: "tazza", x: 14, y: 58, s: 18, label: "LATTE", tone: "white" },
    { kind: "tazza", x: 32, y: 58, s: 18, label: "TÈ", tone: "lime" },
    { kind: "tazza", x: 26, y: 26, s: 16, label: "OSPITI", tone: "red" },
  ];
  return art(TAVOLO, [
    { kind: "pianta", x: 44, y: 26, s: 18, tone: "lime" },
    ...cups.slice(0, o.tazze),
    { kind: "pizza", x: o.scambia ? 94 : 60, y: 58, s: 24, label: "SURGELATA", tone: "red" },
    { kind: "torta", x: o.scambia ? 60 : 94, y: 58, s: 24, label: "CROSTATA", tone: "amber" },
    { kind: "postit", x: 100, y: 20, s: 18, label: "PAGATO", tone: "amber", rot: 5 },
  ]);
}

function gamer(o: { livello: string; manicoSinistra?: boolean }): ArtInput {
  return art(GAMER, [
    { kind: "lampada", x: 14, y: 50, s: 22, tone: "violet" },
    { kind: "monitor", x: 56, y: 40, s: 44, label: o.livello, tone: "lime" },
    { kind: "cuffie", x: 104, y: 30, s: 20, tone: "cyan" },
    { kind: "tazza", x: 102, y: 58, s: 18, flip: o.manicoSinistra, tone: "red" },
    { kind: "telefono", x: 22, y: 60, s: 14, label: "4%", tone: "red", rot: 10 },
  ]);
}

function davanzale(o: { piante: number; candela?: boolean }): ArtInput {
  const xs = [20, 42, 64];
  return art(DAVANZALE, [
    ...xs.slice(0, o.piante).map((x): It => ({ kind: "pianta", x, y: 58, s: 22, tone: "lime" })),
    { kind: "orologio", x: 100, y: 24, s: 22, label: "12:15", tone: "white" },
    { kind: "gatto", x: 106, y: 58, s: 22, tone: "white" },
    ...(o.candela ? [{ kind: "candela", x: 84, y: 60, s: 14, tone: "amber" } as It] : []),
  ]);
}

const varianti: NonEInput[] = [
  {
    id: "mensola-soggiorno",
    difficulty: "facile",
    scene: "La mensola del soggiorno",
    description: "La sveglia segna le 7:30, il libro sta a destra della pianta e c'è una sola candela.",
    parts: ["la sveglia segna le 7:30", "il libro sta a destra della pianta", "c'è una sola candela"],
    conditions: [
      { c: "testo", kind: "orologio", label: "7:30" },
      { c: "sinistra", a: "pianta", b: "libro" },
      { c: "quanti", kind: "candela", n: 1 },
    ],
    images: [
      { id: "a", art: mensola({ ora: "7:50" }) },
      { id: "b", art: mensola({ ora: "7:30" }) },
      { id: "c", art: mensola({ ora: "7:30", dueCandele: true }) },
    ],
    alts: [
      "Mensola: sveglia sulle 7:50, pianta, una candela, libro «Gialli» a destra della pianta, tazza «Casa».",
      "Mensola: sveglia sulle 7:30, pianta, una candela, libro «Gialli» a destra della pianta, tazza «Casa».",
      "Mensola: sveglia sulle 7:30, pianta, una candela, libro «Gialli» a destra della pianta e una seconda candela al posto della tazza.",
    ],
    solution: { imageId: "b" },
    explain: "Solo la seconda ha tutto: sveglia sulle 7:30, libro a destra della pianta, una candela. Nella prima la sveglia segna 7:50, nella terza le candele sono due.",
  },
  {
    id: "scrivania-report",
    difficulty: "media",
    scene: "La scrivania del lunedì",
    description: "Sul portatile c'è scritto «REPORT», la tazza ha il manico a sinistra e gli occhiali stanno sopra l'agenda.",
    parts: ["sul portatile c'è «REPORT»", "la tazza ha il manico a sinistra", "gli occhiali stanno sopra l'agenda"],
    conditions: [
      { c: "testo", kind: "laptop", label: "REPORT" },
      { c: "verso", kind: "tazza", flip: true },
      { c: "sopra", a: "occhiali", b: "libro" },
    ],
    images: [
      { id: "a", art: scrivania({ schermo: "REPORT", manicoSinistra: true, occhialiSotto: true }) },
      { id: "b", art: scrivania({ schermo: "REPORT", manicoSinistra: false }) },
      { id: "c", art: scrivania({ schermo: "REPORT", manicoSinistra: true }) },
    ],
    alts: [
      "Scrivania: pianta, portatile con «Report», tazza col manico a sinistra, agenda; gli occhiali sono sotto la scrivania.",
      "Scrivania: pianta, portatile con «Report», tazza col manico a destra, agenda con sopra gli occhiali.",
      "Scrivania: pianta, portatile con «Report», tazza col manico a sinistra, agenda con sopra gli occhiali.",
    ],
    solution: { imageId: "c" },
    explain: "Il portatile dice «Report» in tutte e tre. Nella seconda il manico della tazza è a destra, nella prima gli occhiali sono finiti sotto la scrivania: resta la terza.",
  },
  {
    id: "frigo-condiviso",
    difficulty: "media",
    scene: "Il frigo dei coinquilini",
    description: "La torta sta su un ripiano più alto della pizza, le borracce sono due e il post-it dice «MIO!».",
    parts: ["la torta sta più in alto della pizza", "le borracce sono due", "il post-it dice «MIO!»"],
    conditions: [
      { c: "sopra", a: "torta", b: "pizza" },
      { c: "quanti", kind: "borraccia", n: 2 },
      { c: "testo", kind: "postit", label: "MIO!" },
    ],
    images: [
      { id: "a", art: frigo({ borracce: 2, postit: "MIO!" }) },
      { id: "b", art: frigo({ borracce: 3, postit: "MIO!" }) },
      { id: "c", art: frigo({ tortaInBasso: true, borracce: 2, postit: "MIO!" }) },
    ],
    alts: [
      "Frigo: tiramisù sul ripiano alto, due borracce e uno yogurt in mezzo, pizza «Avanzi» in basso, post-it «Mio!».",
      "Frigo: tiramisù sul ripiano alto, tre borracce e uno yogurt in mezzo, pizza «Avanzi» in basso, post-it «Mio!».",
      "Frigo: pizza «Avanzi» sul ripiano alto, due borracce e uno yogurt in mezzo, tiramisù in basso, post-it «Mio!».",
    ],
    solution: { imageId: "a" },
    explain: "Il post-it dice «MIO!» ovunque. Nella seconda le borracce sono tre, nella terza torta e pizza si sono scambiate di ripiano: è la prima.",
  },
  {
    id: "ingresso-casa",
    difficulty: "media",
    scene: "L'ingresso di casa",
    description: "Le chiavi stanno a sinistra del portafoglio, c'è un solo ombrello e il calendario dice «SAB 12».",
    parts: ["le chiavi stanno a sinistra del portafoglio", "c'è un solo ombrello", "il calendario dice «SAB 12»"],
    conditions: [
      { c: "sinistra", a: "chiavi", b: "portafoglio" },
      { c: "quanti", kind: "ombrello", n: 1 },
      { c: "testo", kind: "calendario", label: "SAB 12" },
    ],
    images: [
      { id: "a", art: ingresso({ data: "SAB 12", dueOmbrelli: true }) },
      { id: "b", art: ingresso({ data: "SAB 12", scambia: true }) },
      { id: "c", art: ingresso({ data: "SAB 12" }) },
    ],
    alts: [
      "Ingresso: calendario «Sab 12», chiavi a sinistra del portafoglio sul mobile, due ombrelli, scarpe.",
      "Ingresso: calendario «Sab 12», portafoglio a sinistra delle chiavi sul mobile, un ombrello, scarpe e zaino.",
      "Ingresso: calendario «Sab 12», chiavi a sinistra del portafoglio sul mobile, un ombrello, scarpe e zaino.",
    ],
    solution: { imageId: "c" },
    explain: "Il calendario è uguale in tutte. Nella prima gli ombrelli sono due, nella seconda chiavi e portafoglio sono invertiti: la terza è quella giusta.",
  },
  {
    id: "tavolo-compleanno",
    difficulty: "facile",
    scene: "Il tavolo del compleanno",
    description: "Sulla torta c'è scritto «30», i palloncini sono tre e il biglietto dice «BUONO CENA».",
    parts: ["sulla torta c'è «30»", "i palloncini sono tre", "il biglietto dice «BUONO CENA»"],
    conditions: [
      { c: "testo", kind: "torta", label: "30" },
      { c: "quanti", kind: "palloncino", n: 3 },
      { c: "testo", kind: "biglietto", label: "BUONO CENA" },
    ],
    images: [
      { id: "a", art: compleanno({ torta: "30", palloncini: 4 }) },
      { id: "b", art: compleanno({ torta: "31", palloncini: 3 }) },
      { id: "c", art: compleanno({ torta: "30", palloncini: 3 }) },
    ],
    alts: [
      "Tavolo: quattro palloncini, una candela, torta con «30», biglietto «Buono cena».",
      "Tavolo: tre palloncini, una candela, torta con «31», biglietto «Buono cena».",
      "Tavolo: tre palloncini, una candela, torta con «30», biglietto «Buono cena».",
    ],
    solution: { imageId: "c" },
    explain: "Nella prima i palloncini sono quattro, nella seconda la torta dice 31. Solo la terza ha torta da 30, tre palloncini e il buono cena.",
  },
  {
    id: "comodino-sveglia",
    difficulty: "difficile",
    scene: "Il comodino",
    description: "Il telefono segna le 6:45, la lampada sta a sinistra del libro e gli occhiali non ci sono.",
    parts: ["il telefono segna le 6:45", "la lampada sta a sinistra del libro", "gli occhiali non ci sono"],
    conditions: [
      { c: "testo", kind: "telefono", label: "6:45" },
      { c: "sinistra", a: "lampada", b: "libro" },
      { c: "senza", kind: "occhiali" },
    ],
    images: [
      { id: "a", art: comodino({}) },
      { id: "b", art: comodino({ occhiali: true }) },
      { id: "c", art: comodino({ scambia: true }) },
    ],
    alts: [
      "Comodino: lampada a sinistra, telefono sulle 6:45, libro «Noir» a destra; pianta e scarpe sul pavimento.",
      "Comodino: lampada a sinistra, telefono sulle 6:45, libro «Noir» a destra e un paio di occhiali piccoli sul cassetto.",
      "Comodino: libro «Noir» a sinistra, telefono sulle 6:45, lampada a destra; pianta e scarpe sul pavimento.",
    ],
    solution: { imageId: "a" },
    explain: "Il telefono segna 6:45 in tutte. Nella seconda ci sono degli occhiali piccoli sul cassetto, nella terza lampada e libro sono invertiti: è la prima.",
  },
  {
    id: "valigia-roma",
    difficulty: "media",
    scene: "La valigia pronta",
    description: "Sull'etichetta della valigia c'è «ROMA», le scarpe hanno la punta verso destra e c'è un solo libro.",
    parts: ["sull'etichetta c'è «ROMA»", "le scarpe hanno la punta verso destra", "c'è un solo libro"],
    conditions: [
      { c: "testo", kind: "valigia", label: "ROMA" },
      { c: "verso", kind: "scarpe", flip: false },
      { c: "quanti", kind: "libro", n: 1 },
    ],
    images: [
      { id: "a", art: valigia({ punta: "destra", dueLibri: true }) },
      { id: "b", art: valigia({ punta: "destra" }) },
      { id: "c", art: valigia({ punta: "sinistra" }) },
    ],
    alts: [
      "Valigia «Roma», scarpe con la punta a destra, due libri «Guida» e «Mappe», borraccia.",
      "Valigia «Roma», scarpe con la punta a destra, un libro «Guida», occhiali e borraccia.",
      "Valigia «Roma», scarpe con la punta a sinistra, un libro «Guida», occhiali e borraccia.",
    ],
    solution: { imageId: "b" },
    explain: "L'etichetta dice «Roma» in tutte. Nella prima i libri sono due, nella terza le scarpe guardano a sinistra: resta la seconda.",
  },
  {
    id: "bacheca-ufficio",
    difficulty: "difficile",
    scene: "La bacheca dell'ufficio",
    description: "Il calendario dice «MAR 8», i post-it sono tre e il poster dice «RIUNIONE ORE 10».",
    parts: ["il calendario dice «MAR 8»", "i post-it sono tre", "il poster dice «RIUNIONE ORE 10»"],
    conditions: [
      { c: "testo", kind: "calendario", label: "MAR 8" },
      { c: "quanti", kind: "postit", n: 3 },
      { c: "testo", kind: "poster", label: "RIUNIONE ORE 10" },
    ],
    images: [
      { id: "a", art: bacheca({ data: "MAR 8", postit: 3 }) },
      { id: "b", art: bacheca({ data: "MER 8", postit: 3 }) },
      { id: "c", art: bacheca({ data: "MAR 8", postit: 4 }) },
    ],
    alts: [
      "Bacheca: poster «Riunione ore 10», calendario «Mar 8», tre post-it, buono «Mensa».",
      "Bacheca: poster «Riunione ore 10», calendario «Mer 8», tre post-it, buono «Mensa».",
      "Bacheca: poster «Riunione ore 10», calendario «Mar 8», quattro post-it, buono «Mensa».",
    ],
    solution: { imageId: "a" },
    explain: "Attenti a una lettera: nella seconda il calendario dice «MER 8», non «MAR 8». Nella terza c'è un quarto post-it «Caffè». Giusta la prima.",
  },
  {
    id: "gatto-sul-divano",
    difficulty: "facile",
    scene: "Il gatto sul divano",
    description: "La coda del gatto è sul lato destro, il libro sta a destra del gatto e la tazza dice «TÈ».",
    parts: ["la coda del gatto è sul lato destro", "il libro sta a destra del gatto", "la tazza dice «TÈ»"],
    conditions: [
      { c: "verso", kind: "gatto", flip: false },
      { c: "sinistra", a: "gatto", b: "libro" },
      { c: "testo", kind: "tazza", label: "TÈ" },
    ],
    images: [
      { id: "a", art: divano({ tazza: "CAFFÈ" }) },
      { id: "b", art: divano({ codaSinistra: true, tazza: "TÈ" }) },
      { id: "c", art: divano({ tazza: "TÈ" }) },
    ],
    alts: [
      "Divano: gatto con la coda a destra, libro alla sua destra, tavolino con tazza «Caffè», lampada.",
      "Divano: gatto con la coda a sinistra, libro alla sua destra, tavolino con tazza «Tè», lampada.",
      "Divano: gatto con la coda a destra, libro alla sua destra, tavolino con tazza «Tè», lampada.",
    ],
    solution: { imageId: "c" },
    explain: "Nella prima la tazza dice «Caffè», nella seconda il gatto è girato e la coda è a sinistra. Solo la terza rispetta tutto.",
  },
  {
    id: "spesa-sul-tavolo",
    difficulty: "media",
    scene: "La spesa sul tavolo",
    description: "Le tazze sono due, la pizza sta a sinistra della crostata e il post-it dice «PAGATO».",
    parts: ["le tazze sono due", "la pizza sta a sinistra della crostata", "il post-it dice «PAGATO»"],
    conditions: [
      { c: "quanti", kind: "tazza", n: 2 },
      { c: "sinistra", a: "pizza", b: "torta" },
      { c: "testo", kind: "postit", label: "PAGATO" },
    ],
    images: [
      { id: "a", art: spesa({ tazze: 2, scambia: true }) },
      { id: "b", art: spesa({ tazze: 2 }) },
      { id: "c", art: spesa({ tazze: 3 }) },
    ],
    alts: [
      "Tavolo: due tazze, crostata a sinistra e pizza «Surgelata» a destra, post-it «Pagato», pianta.",
      "Tavolo: due tazze, pizza «Surgelata» a sinistra e crostata a destra, post-it «Pagato», pianta.",
      "Tavolo: tre tazze (una sulla mensola), pizza «Surgelata» a sinistra e crostata a destra, post-it «Pagato», pianta.",
    ],
    solution: { imageId: "b" },
    explain: "Il post-it dice «Pagato» ovunque. Nella prima pizza e crostata sono invertite, nella terza c'è una tazza in più sopra: è la seconda.",
  },
  {
    id: "postazione-gamer",
    difficulty: "difficile",
    scene: "La postazione del gamer",
    description: "Il monitor dice «LIVELLO 9», le cuffie stanno più in alto della tazza e la tazza ha il manico a destra.",
    parts: ["il monitor dice «LIVELLO 9»", "le cuffie stanno più in alto della tazza", "la tazza ha il manico a destra"],
    conditions: [
      { c: "testo", kind: "monitor", label: "LIVELLO 9" },
      { c: "sopra", a: "cuffie", b: "tazza" },
      { c: "verso", kind: "tazza", flip: false },
    ],
    images: [
      { id: "a", art: gamer({ livello: "LIVELLO 9", manicoSinistra: true }) },
      { id: "b", art: gamer({ livello: "LIVELLO 6" }) },
      { id: "c", art: gamer({ livello: "LIVELLO 9" }) },
    ],
    alts: [
      "Postazione: lampada, monitor «Livello 9», cuffie in alto a destra, tazza col manico a sinistra, telefono al 4%.",
      "Postazione: lampada, monitor «Livello 6», cuffie in alto a destra, tazza col manico a destra, telefono al 4%.",
      "Postazione: lampada, monitor «Livello 9», cuffie in alto a destra, tazza col manico a destra, telefono al 4%.",
    ],
    solution: { imageId: "c" },
    explain: "Le cuffie sono sopra la tazza in tutte. Nella prima il manico è a sinistra, nella seconda il monitor dice livello 6: giusta la terza.",
  },
  {
    id: "davanzale",
    difficulty: "media",
    scene: "Il davanzale",
    description: "Le piante sono tre, l'orologio segna le 12:15 e non c'è nessuna candela.",
    parts: ["le piante sono tre", "l'orologio segna le 12:15", "non c'è nessuna candela"],
    conditions: [
      { c: "quanti", kind: "pianta", n: 3 },
      { c: "testo", kind: "orologio", label: "12:15" },
      { c: "senza", kind: "candela" },
    ],
    images: [
      { id: "a", art: davanzale({ piante: 3, candela: true }) },
      { id: "b", art: davanzale({ piante: 3 }) },
      { id: "c", art: davanzale({ piante: 2 }) },
    ],
    alts: [
      "Davanzale: tre piante, una candela, gatto; orologio sulle 12:15 vicino alla finestra.",
      "Davanzale: tre piante e un gatto; orologio sulle 12:15 vicino alla finestra.",
      "Davanzale: due piante e un gatto; orologio sulle 12:15 vicino alla finestra.",
    ],
    solution: { imageId: "b" },
    explain: "L'orologio segna 12:15 ovunque. Nella prima c'è una candela tra le piante e il gatto, nella terza le piante sono due: è la seconda.",
  },
];

export default varianti;
