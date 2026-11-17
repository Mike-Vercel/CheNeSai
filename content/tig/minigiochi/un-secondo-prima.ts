import type { IconKind, Tone } from "@/lib/tig/games/components/art";
import type { ColorName, ShapeInput } from "@/lib/tig/games/mechanics/m1/draw";
import type { Pose, SecondoInput } from "@/lib/tig/games/mechanics/un-secondo-prima";

/**
 * 06 · UN SECONDO PRIMA — varianti. Undici «video» ORIGINALI: animazioni a fotogrammi chiave fatte di forme
 * e icone del kit (tela 160×90). Ogni video stabilisce una regola visibile (una spinta che si ripete, una
 * traiettoria, un ritmo, un semaforo che cambia) e si ferma un attimo prima del momento chiave. Dei tre
 * fotogrammi proposti uno solo segue la regola; gli altri sono «assurdi ma plausibili» a colpo d'occhio.
 */

const rect = (x: number, y: number, w: number, h: number, c: ColorName, r?: number, o?: number): ShapeInput => ({ k: "rect", x, y, w, h, c, ...(r ? { r } : {}), ...(o !== undefined ? { o } : {}) });
const ell = (x: number, y: number, rx: number, ry: number, c: ColorName, o?: number): ShapeInput => ({ k: "ell", x, y, rx, ry, c, ...(o !== undefined ? { o } : {}) });
const poly = (c: ColorName, ...p: number[]): ShapeInput => ({ k: "poly", p, c });
const line = (x1: number, y1: number, x2: number, y2: number, w: number, c: ColorName, o?: number): ShapeInput => ({ k: "line", x1, y1, x2, y2, w, c, ...(o !== undefined ? { o } : {}) });
const icon = (kind: IconKind, x: number, y: number, s: number, tone: Tone = "white", flip?: boolean): ShapeInput => ({ k: "icon", kind, x, y, s, tone, ...(flip ? { flip } : {}) });

type Key = { t: number; set: Record<string, Pose> };

/** Unisce pose sparse {t, attore, posa} in fotogrammi chiave ordinati (stesso t = stesso fotogramma). */
function keysOf(list: [number, string, Pose][]): Key[] {
  const by = new Map<number, Record<string, Pose>>();
  for (const [t, id, p] of list) by.set(t, { ...(by.get(t) ?? {}), [id]: p });
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([t, set]) => ({ t, set }));
}

const PROMPT = "Cosa si vede un secondo dopo?";

// --- 1 · il gatto e la tazza --------------------------------------------------
const gattoTazza: SecondoInput = {
  id: "gatto-e-tazza",
  difficulty: "facile",
  clipTitle: "Il gatto e la tazza",
  clip: {
    w: 160,
    h: 90,
    bg: "grafite",
    back: [
      rect(124, 8, 28, 24, "cielo", 1),
      rect(137, 8, 2, 24, "bianco"),
      rect(0, 80, 160, 10, "legno2"),
      rect(10, 58, 110, 5, "legno", 1),
      rect(16, 63, 4, 17, "legno2"),
      rect(112, 63, 4, 17, "legno2"),
    ],
    actors: [
      { id: "gatto", shapes: [icon("gatto", 0, 0, 34, "amber")] },
      { id: "tazza", shapes: [icon("tazza", 0, 0, 14, "red")] },
    ],
    keys: keysOf([
      [0, "gatto", { x: 36, y: 42 }],
      [0, "tazza", { x: 70, y: 52 }],
      [800, "gatto", { x: 54, y: 42 }],
      [1300, "tazza", { x: 80, y: 52 }],
      [1300, "gatto", { x: 60, y: 42 }],
      [2000, "gatto", { x: 66, y: 42 }],
      [2000, "tazza", { x: 90, y: 52 }],
      [2600, "gatto", { x: 76, y: 42 }],
      [2600, "tazza", { x: 100, y: 52 }],
      [3200, "gatto", { x: 86, y: 42 }],
      [3200, "tazza", { x: 110, y: 52 }],
      [3800, "gatto", { x: 94, y: 42 }],
      [3800, "tazza", { x: 117, y: 52 }],
      [4300, "gatto", { x: 97, y: 42 }],
      [4300, "tazza", { x: 121, y: 54, rot: 28 }],
    ]),
    durationMs: 4300,
  },
  alt: "Un gatto su un tavolo spinge una tazza con la zampa, un colpetto alla volta, verso il bordo. Il video si ferma quando la tazza è già inclinata oltre il bordo.",
  prompt: PROMPT,
  options: [
    { id: "pavimento", text: "La tazza è sul pavimento, rovesciata", set: { tazza: { x: 130, y: 76, rot: 100 } }, extra: [ell(136, 82, 13, 2.4, "marrone", 0.85)] },
    { id: "centro", text: "La tazza è di nuovo al centro del tavolo", set: { tazza: { x: 70, y: 52 } } },
    { id: "sospesa", text: "La tazza resta sospesa a mezz'aria", set: { tazza: { x: 124, y: 26 } } },
  ],
  solution: { optionId: "pavimento" },
  explain: "Il gatto la spinge un colpetto alla volta e alla fine è già inclinata oltre il bordo: un secondo dopo è per terra. Le tazze non tornano indietro né volano.",
};

// --- 2 · il pallone che rimbalza ---------------------------------------------
const PALLA: ShapeInput[] = [ell(0, 0, 5, 5, "arancio"), line(-5, 0, 5, 0, 0.7, "legno2"), line(0, -5, 0, 5, 0.7, "legno2")];
const pallone: SecondoInput = {
  id: "pallone-che-rimbalza",
  difficulty: "media",
  clipTitle: "Il pallone che rimbalza",
  clip: {
    w: 160,
    h: 90,
    bg: "cielo2",
    back: [ell(140, 16, 8, 8, "giallo"), rect(0, 80, 160, 10, "prato"), rect(0, 80, 160, 1.5, "prato2")],
    actors: [{ id: "palla", shapes: PALLA }],
    keys: keysOf([
      [0, "palla", { x: 16, y: 14, rot: 0 }],
      [250, "palla", { x: 24, y: 40, rot: 30 }],
      [450, "palla", { x: 32, y: 75, rot: 60 }],
      [620, "palla", { x: 38, y: 48, rot: 90 }],
      [800, "palla", { x: 44, y: 38, rot: 120 }],
      [980, "palla", { x: 50, y: 48, rot: 150 }],
      [1150, "palla", { x: 56, y: 75, rot: 180 }],
      [1300, "palla", { x: 61, y: 56, rot: 210 }],
      [1450, "palla", { x: 66, y: 50, rot: 240 }],
      [1600, "palla", { x: 71, y: 56, rot: 270 }],
      [1750, "palla", { x: 76, y: 75, rot: 300 }],
      [1880, "palla", { x: 80, y: 64, rot: 330 }],
      [2000, "palla", { x: 84, y: 60, rot: 360 }],
      [2120, "palla", { x: 88, y: 64, rot: 390 }],
      [2250, "palla", { x: 92, y: 75, rot: 420 }],
      [2450, "palla", { x: 98, y: 68, rot: 480 }],
    ]),
    durationMs: 2450,
  },
  alt: "Un pallone cade da sinistra e rimbalza verso destra: ogni rimbalzo è più basso e un po' più avanti. Il video si ferma mentre risale dopo il quarto rimbalzo.",
  prompt: PROMPT,
  options: [
    { id: "piu-avanti", text: "Ritocca terra ancora più a destra", set: { palla: { x: 106, y: 75, rot: 540 } } },
    { id: "piu-alto", text: "Schizza più in alto di prima", set: { palla: { x: 104, y: 12, rot: 540 } } },
    { id: "indietro", text: "Torna indietro verso sinistra", set: { palla: { x: 82, y: 75, rot: 420 } } },
  ],
  solution: { optionId: "piu-avanti" },
  explain: "Ogni rimbalzo è più basso e più a destra del precedente: un secondo dopo il pallone ricade ancora più avanti. Non può risalire più in alto né tornare indietro.",
};

// --- 3 · i domino ---------------------------------------------------------------
const TESSERA: ShapeInput[] = [rect(-3.2, -16, 3.2, 16, "bianco", 0.6), ell(-1.6, -12, 0.8, 0.8, "nero"), ell(-1.6, -4, 0.8, 0.8, "nero"), line(-3, -8, -0.2, -8, 0.4, "nero")];
const DOM_X = [24, 34, 44, 54, 64, 96, 106];
const dominoKeys: [number, string, Pose][] = [];
DOM_X.forEach((x, i) => dominoKeys.push([0, `d${i + 1}`, { x, y: 66, rot: 0 }]));
for (let i = 0; i < 5; i++) {
  const start = 300 + i * 220;
  dominoKeys.push([start, `d${i + 1}`, { x: DOM_X[i], y: 66, rot: 0 }]);
  dominoKeys.push([start + 260, `d${i + 1}`, { x: DOM_X[i], y: 66, rot: i < 4 ? 58 : 90 }]);
}
dominoKeys.push([2700, "d5", { x: DOM_X[4], y: 66, rot: 90 }]);
const domino: SecondoInput = {
  id: "fila-di-domino",
  difficulty: "difficile",
  clipTitle: "La fila di domino",
  clip: {
    w: 160,
    h: 90,
    bg: "acciaio",
    back: [rect(0, 66, 160, 24, "legno"), rect(0, 66, 160, 1.2, "legno2")],
    actors: DOM_X.map((_, i) => ({ id: `d${i + 1}`, shapes: TESSERA })),
    keys: keysOf(dominoKeys),
    durationMs: 2700,
  },
  alt: "Sette tessere del domino in fila sul tavolo, le ultime due più distanti dalle altre. Le prime cinque cadono una sull'altra; la quinta si sdraia nel vuoto. Il video si ferma lì.",
  prompt: PROMPT,
  options: [
    { id: "si-ferma", text: "Niente di nuovo: le ultime due restano in piedi", set: {} },
    { id: "continua", text: "Cadono anche la sesta e la settima", set: { d6: { x: 96, y: 66, rot: 58 }, d7: { x: 106, y: 66, rot: 90 } } },
    { id: "si-rialzano", text: "Le tessere cadute si rialzano", set: { d1: { x: 24, y: 66 }, d2: { x: 34, y: 66 }, d3: { x: 44, y: 66 }, d4: { x: 54, y: 66 }, d5: { x: 64, y: 66 } } },
  ],
  solution: { optionId: "si-ferma" },
  explain: "La quinta tessera è più corta della distanza dalla sesta: si sdraia nel vuoto senza toccarla. La catena si ferma lì, e un secondo dopo non cambia niente.",
};

// --- 4 · il semaforo ------------------------------------------------------------
const AUTO: ShapeInput[] = [
  rect(-15, -9, 30, 8, "rosso", 2),
  poly("rosso", -9, -9, -5, -15, 6, -15, 10, -9),
  rect(-4, -14, 9, 4, "cielo2", 1),
  ell(-8, -1, 3.2, 3.2, "nero"),
  ell(8, -1, 3.2, 3.2, "nero"),
  ell(14, -6, 1.2, 1, "giallo"),
];
const LAMP = (c: ColorName): ShapeInput[] => [ell(0, 0, 3.6, 3.6, c)];
const semaforo: SecondoInput = {
  id: "auto-al-semaforo",
  difficulty: "facile",
  clipTitle: "L'auto al semaforo",
  clip: {
    w: 160,
    h: 90,
    bg: "cielo2",
    back: [
      rect(6, 20, 26, 42, "grigio"),
      rect(40, 30, 22, 32, "grigio2"),
      rect(0, 62, 160, 28, "grigio2"),
      ...[10, 30, 50, 70, 90].map((x) => rect(x, 75, 12, 1.5, "bianco", 0, 0.7)),
      rect(118, 62, 3, 28, "bianco"),
      rect(130, 22, 3, 42, "grigio"),
      rect(125, 4, 13, 28, "nero", 2),
    ],
    actors: [
      { id: "rosso", shapes: LAMP("rosso") },
      { id: "giallo", shapes: LAMP("ambra") },
      { id: "verde", shapes: LAMP("verde") },
      { id: "auto", shapes: AUTO },
    ],
    keys: keysOf([
      [0, "rosso", { x: 131.5, y: 10, o: 0.18 }],
      [0, "giallo", { x: 131.5, y: 18, o: 0.18 }],
      [0, "verde", { x: 131.5, y: 26, o: 1 }],
      [0, "auto", { x: 6, y: 82 }],
      [1200, "auto", { x: 48, y: 82 }],
      [1250, "verde", { x: 131.5, y: 26, o: 1 }],
      [1300, "verde", { x: 131.5, y: 26, o: 0.18 }],
      [1250, "giallo", { x: 131.5, y: 18, o: 0.18 }],
      [1300, "giallo", { x: 131.5, y: 18, o: 1 }],
      [2200, "auto", { x: 78, y: 82 }],
      [2650, "giallo", { x: 131.5, y: 18, o: 1 }],
      [2700, "giallo", { x: 131.5, y: 18, o: 0.18 }],
      [2650, "rosso", { x: 131.5, y: 10, o: 0.18 }],
      [2700, "rosso", { x: 131.5, y: 10, o: 1 }],
      [3200, "auto", { x: 94, y: 82 }],
      [3800, "auto", { x: 101, y: 82 }],
    ]),
    durationMs: 3800,
  },
  alt: "Un'auto rossa avanza verso un semaforo verde. Il semaforo diventa giallo e poi rosso, e l'auto rallenta sempre di più avvicinandosi alla linea bianca. Il video si ferma poco prima della linea.",
  prompt: PROMPT,
  options: [
    { id: "ferma", text: "L'auto è ferma davanti alla linea", set: { auto: { x: 102, y: 82 } } },
    { id: "passa", text: "L'auto passa col rosso a tutta velocità", set: { auto: { x: 150, y: 82 } } },
    { id: "indietro", text: "L'auto fa retromarcia", set: { auto: { x: 62, y: 82 } } },
  ],
  solution: { optionId: "ferma" },
  explain: "Il semaforo è diventato rosso e l'auto frenava sempre di più: un secondo dopo è ferma davanti alla linea bianca, non oltre e non indietro.",
};

// --- 5 · il bicchiere che si riempie -------------------------------------------
const bicchiere: SecondoInput = {
  id: "bicchiere-pieno",
  difficulty: "media",
  clipTitle: "Il succo nel bicchiere",
  clip: {
    w: 160,
    h: 90,
    bg: "acciaio",
    back: [rect(0, 66, 160, 24, "legno"), rect(0, 66, 160, 1.2, "legno2"), rect(10, 10, 34, 26, "grafite", 1)],
    actors: [
      { id: "bottiglia", shapes: [rect(-7, -26, 14, 26, "verde", 3), rect(-2.6, -36, 5.2, 11, "verde", 1), rect(-7, -18, 14, 8, "panna")] },
      { id: "getto", shapes: [line(0, 0, 0, 26, 1.8, "arancio")] },
      { id: "succo", shapes: [rect(-8, -20, 16, 20, "arancio")] },
    ],
    front: [rect(61, 44, 18, 22, "cielo2", 1, 0.15), line(60, 44, 62, 66, 1.2, "cielo2"), line(80, 44, 78, 66, 1.2, "cielo2"), line(62, 66, 78, 66, 1.2, "cielo2")],
    keys: keysOf([
      [0, "bottiglia", { x: 104, y: 16, rot: -122 }],
      [0, "getto", { x: 70, y: 37 }],
      [0, "succo", { x: 70, y: 66, sy: 0.05, s: 1 }],
      [3600, "succo", { x: 70, y: 66, sy: 0.92, s: 1 }],
      [3600, "getto", { x: 70, y: 37 }],
      [3600, "bottiglia", { x: 104, y: 16, rot: -123 }],
    ]),
    durationMs: 3600,
  },
  alt: "Una bottiglia inclinata versa succo d'arancia in un bicchiere sul bancone. Il livello sale senza sosta. Il video si ferma quando il succo è a un dito dal bordo e la bottiglia versa ancora.",
  prompt: PROMPT,
  options: [
    {
      id: "trabocca",
      text: "Il succo trabocca e cola sul bancone",
      set: { succo: { x: 70, y: 66, sy: 1.1, s: 1 } },
      extra: [line(61, 46, 59, 66, 1.4, "arancio"), line(79, 46, 81, 66, 1.4, "arancio"), ell(70, 67.5, 22, 2.2, "arancio", 0.9)],
    },
    { id: "vuoto", text: "Il bicchiere è di nuovo vuoto", set: { succo: { x: 70, y: 66, sy: 0.02, s: 1 } } },
    { id: "si-raddrizza", text: "La bottiglia si raddrizza da sola e il succo cala", set: { bottiglia: { x: 112, y: 66, rot: 0 }, getto: { x: 70, y: 37, o: 0 }, succo: { x: 70, y: 66, sy: 0.5, s: 1 } } },
  ],
  solution: { optionId: "trabocca" },
  explain: "La bottiglia versa ancora e il succo è già a un dito dal bordo: un secondo dopo trabocca e finisce sul bancone. Nessuno l'ha raddrizzata.",
};

// --- 6 · la pila di piatti ------------------------------------------------------
const PIATTO: ShapeInput[] = [rect(-15, -3.4, 30, 3.4, "bianco", 1.6), rect(-11, -1.2, 22, 1, "grigio", 0.5)];
const PX = [70, 76, 83, 91, 100, 110];
const pilaKeys: [number, string, Pose][] = [];
PX.forEach((x, i) => {
  const y = 70 - i * 3.4;
  if (i === 0) {
    pilaKeys.push([0, "p1", { x, y }]);
    return;
  }
  const t = 300 + (i - 1) * 500;
  pilaKeys.push([0, `p${i + 1}`, { x, y: 14, o: 0 }]);
  pilaKeys.push([t - 20, `p${i + 1}`, { x, y: 14, o: 0 }]);
  pilaKeys.push([t, `p${i + 1}`, { x, y: 14, o: 1 }]);
  pilaKeys.push([t + 300, `p${i + 1}`, { x, y }]);
});
pilaKeys.push([3000, "p4", { x: 91, y: 59.8 }]);
pilaKeys.push([3000, "p5", { x: 100, y: 56.4 }]);
pilaKeys.push([3000, "p6", { x: 110, y: 53 }]);
pilaKeys.push([3400, "p4", { x: 92, y: 60.2, rot: 4 }]);
pilaKeys.push([3400, "p5", { x: 102, y: 57.4, rot: 7 }]);
pilaKeys.push([3400, "p6", { x: 113, y: 54.6, rot: 10 }]);
const pila: SecondoInput = {
  id: "pila-di-piatti",
  difficulty: "media",
  clipTitle: "La pila di piatti",
  clip: {
    w: 160,
    h: 90,
    bg: "acciaio",
    back: [rect(0, 70, 160, 20, "legno"), rect(0, 70, 160, 1.2, "legno2"), ...[0, 20, 40, 60, 80, 100, 120, 140].map((x) => line(x, 0, x, 70, 0.4, "grigio2", 0.6))],
    actors: PX.map((_, i) => ({ id: `p${i + 1}`, shapes: PIATTO })),
    keys: keysOf(pilaKeys),
    durationMs: 3400,
  },
  alt: "Qualcuno impila sei piatti, ognuno un po' più a destra del precedente. La pila pende a destra e gli ultimi piatti cominciano a inclinarsi da quella parte. Il video si ferma lì.",
  prompt: PROMPT,
  options: [
    { id: "destra", text: "I piatti in cima crollano verso destra", set: { p4: { x: 104, y: 66, rot: 28 }, p5: { x: 118, y: 68, rot: 60 }, p6: { x: 134, y: 69, rot: 85 } } },
    { id: "sinistra", text: "I piatti in cima crollano verso sinistra", set: { p4: { x: 58, y: 66, rot: -28 }, p5: { x: 46, y: 68, rot: -60 }, p6: { x: 32, y: 69, rot: -85 } } },
    { id: "dritta", text: "La pila si raddrizza da sola", set: { p2: { x: 70, y: 66.6 }, p3: { x: 70, y: 63.2 }, p4: { x: 70, y: 59.8 }, p5: { x: 70, y: 56.4 }, p6: { x: 70, y: 53 } } },
  ],
  solution: { optionId: "destra" },
  explain: "Ogni piatto è più a destra del precedente: il peso finisce oltre la base, sul lato destro, e la cima comincia già a pendere da lì. Se crolla, crolla a destra.",
};

// --- 7 · lo spumante -----------------------------------------------------------
const spumante: SecondoInput = {
  id: "tappo-spumante",
  difficulty: "facile",
  clipTitle: "Lo spumante della festa",
  clip: {
    w: 160,
    h: 90,
    bg: "notte",
    back: [ell(20, 20, 8, 8, "viola", 0.3), ell(140, 26, 9, 9, "rosa", 0.3), ell(116, 12, 6, 6, "ambra", 0.3), rect(0, 70, 160, 20, "legno2"), icon("palloncino", 30, 46, 22, "red"), icon("palloncino", 132, 50, 20, "lime")],
    actors: [
      { id: "bottiglia", shapes: [rect(-9, -30, 18, 30, "prato2", 4), rect(-3.5, -44, 7, 15, "prato2", 1.5), rect(-9, -22, 18, 9, "panna"), rect(-4, -44, 8, 5, "ambra", 1)] },
      { id: "tappo", shapes: [rect(-3, -6, 6, 6, "legno", 1.2)] },
    ],
    keys: keysOf([
      [0, "bottiglia", { x: 80, y: 70 }],
      [0, "tappo", { x: 80, y: 27, rot: 0 }],
      [600, "tappo", { x: 80.4, y: 26.6, rot: 6 }],
      [1100, "tappo", { x: 79.6, y: 26.2, rot: -5 }],
      [1600, "tappo", { x: 80.5, y: 25.4, rot: 8 }],
      [2100, "tappo", { x: 79.5, y: 24.6, rot: -8 }],
      [2500, "tappo", { x: 80.6, y: 23.6, rot: 10 }],
      [2800, "tappo", { x: 79.6, y: 22.6, rot: -10 }],
      [3000, "tappo", { x: 80, y: 21.8, rot: 4 }],
      [3000, "bottiglia", { x: 80, y: 70 }],
    ]),
    durationMs: 3000,
  },
  alt: "Una bottiglia di spumante su un tavolo alla festa: il tappo sale a piccoli scatti, ballando, sempre più fuori dal collo. Il video si ferma col tappo quasi uscito.",
  prompt: PROMPT,
  options: [
    { id: "botto", text: "Il tappo vola via ed esce la schiuma", set: { tappo: { x: 112, y: 6, rot: 220 } }, extra: [ell(80, 24, 6, 5, "panna"), ell(78, 18, 5, 4, "panna"), ell(83, 13, 4, 3.5, "panna"), ell(80, 32, 4, 6, "panna", 0.9)] },
    { id: "rientra", text: "Il tappo rientra nella bottiglia", set: { tappo: { x: 80, y: 30, rot: 0 } } },
    { id: "rimpicciolisce", text: "La bottiglia diventa piccolissima", set: { bottiglia: { x: 80, y: 70, s: 0.4 }, tappo: { x: 80, y: 52, s: 0.4 } } },
  ],
  solution: { optionId: "botto" },
  explain: "Il tappo saliva a scatti, sempre più fuori: è l'attimo prima del botto. Un secondo dopo vola via e arriva la schiuma; i tappi non rientrano da soli.",
};

// --- 8 · il tiro al cestino -----------------------------------------------------
const PALLINA: ShapeInput[] = [ell(0, 0, 3.4, 3.4, "bianco"), line(-2, -1, 2, 1, 0.5, "grigio"), line(-1, 2, 1, -2, 0.5, "grigio")];
const traj: [number, string, Pose][] = [];
for (let i = 0; i <= 15; i++) {
  const x = 20 + i * (70 / 15);
  const y = 70 - 0.02 * (x - 20) * (120 - x);
  traj.push([i * 140, "pallina", { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, rot: i * 40 }]);
}
const cestino: SecondoInput = {
  id: "tiro-al-cestino",
  difficulty: "difficile",
  clipTitle: "Il tiro al cestino",
  clip: {
    w: 160,
    h: 90,
    bg: "grafite",
    back: [rect(0, 80, 160, 10, "grigio2"), rect(4, 66, 28, 4, "legno", 1), rect(6, 70, 3, 10, "legno2"), rect(27, 70, 3, 10, "legno2"), icon("laptop", 16, 60, 14, "cyan"), rect(150, 0, 10, 80, "acciaio")],
    actors: [{ id: "pallina", shapes: PALLINA }],
    front: [poly("grigio", 88, 62, 102, 62, 100, 80, 90, 80), rect(87, 61, 16, 2, "grigio2", 0.8)],
    keys: keysOf(traj),
    durationMs: 2100,
  },
  alt: "Dalla scrivania a sinistra parte una pallina di carta lanciata verso un cestino al centro della stanza. Sale ad arco e comincia a scendere; il video si ferma quando è proprio sopra il bordo sinistro del cestino, ancora molto in alto.",
  prompt: "Dove si trova la pallina un secondo dopo?",
  options: [
    { id: "dentro", text: "Dentro il cestino", set: { pallina: { x: 95, y: 61 } } },
    { id: "oltre", text: "Sul pavimento, oltre il cestino", set: { pallina: { x: 122, y: 76.6, rot: 700 } } },
    { id: "prima", text: "Sul pavimento, prima del cestino", set: { pallina: { x: 76, y: 76.6, rot: 700 } } },
  ],
  solution: { optionId: "oltre" },
  explain: "Sopra il cestino la pallina è ancora altissima: l'arco era simmetrico, col punto più alto a metà strada. Scendendo come è salita, atterra ben oltre il cestino.",
};

// --- 9 · la clessidra ---------------------------------------------------------
const clessidra: SecondoInput = {
  id: "clessidra",
  difficulty: "media",
  clipTitle: "La clessidra",
  clip: {
    w: 160,
    h: 90,
    bg: "acciaio",
    back: [rect(0, 82, 160, 8, "legno2")],
    actors: [
      { id: "sopra", shapes: [poly("sabbia", -15, -22, 15, -22, 0, 0)] },
      { id: "sotto", shapes: [poly("sabbia", -16, 0, 16, 0, 0, -18)] },
      { id: "filo", shapes: [line(0, 0, 0, 30, 0.9, "sabbia")] },
    ],
    front: [
      rect(56, 12, 48, 3, "legno", 1),
      rect(56, 78, 48, 3, "legno", 1),
      line(62, 15, 62, 78, 1.6, "legno2"),
      line(98, 15, 98, 78, 1.6, "legno2"),
      line(64, 16, 80, 46, 0.9, "cielo2"),
      line(96, 16, 80, 46, 0.9, "cielo2"),
      line(80, 46, 64, 77, 0.9, "cielo2"),
      line(80, 46, 96, 77, 0.9, "cielo2"),
    ],
    keys: keysOf([
      [0, "sopra", { x: 80, y: 46, s: 0.95 }],
      [0, "sotto", { x: 80, y: 77, s: 0.15 }],
      [0, "filo", { x: 80, y: 46 }],
      [4000, "sopra", { x: 80, y: 46, s: 0.36 }],
      [4000, "sotto", { x: 80, y: 77, s: 0.82 }],
      [4000, "filo", { x: 80, y: 46 }],
    ]),
    durationMs: 4000,
  },
  alt: "Una clessidra di legno: la sabbia scende dal vetro di sopra a quello di sotto, il mucchio sopra cala e quello sotto cresce. Il video si ferma quando sopra ne resta poca.",
  prompt: PROMPT,
  options: [
    { id: "quasi-finita", text: "Sopra quasi niente, sotto il mucchio è più alto", set: { sopra: { x: 80, y: 46, s: 0.18 }, sotto: { x: 80, y: 77, s: 0.9 } } },
    { id: "risale", text: "La sabbia è tornata tutta sopra", set: { sopra: { x: 80, y: 46, s: 0.95 }, sotto: { x: 80, y: 77, s: 0.1 } } },
    { id: "cala-sotto", text: "Sopra uguale, ma il mucchio sotto si abbassa", set: { sopra: { x: 80, y: 46, s: 0.36 }, sotto: { x: 80, y: 77, s: 0.45 } } },
  ],
  solution: { optionId: "quasi-finita" },
  explain: "La sabbia scende sempre e solo verso il basso: un secondo dopo sopra ce n'è ancora meno e sotto il mucchio è più alto. Senza girare la clessidra non torna su.",
};

// --- 10 · l'altalena ------------------------------------------------------------
const altKeys: [number, string, Pose][] = [];
const AMP = 38;
for (let i = 0; i <= 20; i++) {
  const t = i * 250;
  altKeys.push([t, "altalena", { x: 80, y: 12, rot: Math.round(AMP * Math.sin((Math.PI / 2) * (t / 1000)) * 10) / 10 }]);
}
const altalena: SecondoInput = {
  id: "altalena",
  difficulty: "difficile",
  clipTitle: "Il gatto sull'altalena",
  clip: {
    w: 160,
    h: 90,
    bg: "cielo2",
    back: [rect(0, 76, 160, 14, "prato"), line(44, 12, 116, 12, 2.4, "grigio2"), line(46, 12, 36, 78, 2.2, "grigio2"), line(114, 12, 124, 78, 2.2, "grigio2"), ell(140, 18, 8, 8, "giallo")],
    actors: [{ id: "altalena", shapes: [line(-7, 0, -7, 50, 0.8, "nero"), line(7, 0, 7, 50, 0.8, "nero"), rect(-10, 50, 20, 3.2, "legno", 1), icon("gatto", 0, 42, 16, "amber")] }],
    keys: keysOf(altKeys),
    durationMs: 5000,
  },
  alt: "Un gatto su un'altalena che dondola avanti e indietro con un ritmo regolare: un secondo dal centro all'estremo, un secondo per tornare. Il video si ferma con l'altalena tutta da una parte, ferma per un istante.",
  prompt: PROMPT,
  options: [
    { id: "centro", text: "L'altalena ripassa dal centro", set: { altalena: { x: 80, y: 12, rot: 0 } } },
    { id: "piu-su", text: "Sale ancora di più dalla stessa parte", set: { altalena: { x: 80, y: 12, rot: 80 } } },
    { id: "giro", text: "Fa il giro completo sopra la sbarra", set: { altalena: { x: 80, y: 12, rot: 180 } } },
  ],
  solution: { optionId: "centro" },
  explain: "Il ritmo era regolare: un secondo dal centro all'estremo e un secondo per tornare. Fermata all'estremo, un secondo dopo l'altalena ripassa dal centro.",
};

// --- 11 · il palloncino che si sgonfia --------------------------------------------
const palloncino: SecondoInput = {
  id: "palloncino-sgonfio",
  difficulty: "media",
  clipTitle: "Il palloncino scappato",
  clip: {
    w: 160,
    h: 90,
    bg: "cielo",
    back: [ell(30, 22, 14, 5, "neve"), ell(122, 14, 16, 5, "neve"), rect(0, 76, 160, 14, "prato"), rect(6, 54, 24, 22, "grigio2"), rect(130, 46, 26, 30, "grigio2")],
    actors: [{ id: "pallone", shapes: [icon("palloncino", 0, 0, 30, "red")] }],
    keys: keysOf([
      [0, "pallone", { x: 40, y: 64, s: 1, rot: 0 }],
      [500, "pallone", { x: 58, y: 44, s: 0.94, rot: 40 }],
      [1000, "pallone", { x: 50, y: 30, s: 0.86, rot: -30 }],
      [1500, "pallone", { x: 78, y: 26, s: 0.78, rot: 60 }],
      [2000, "pallone", { x: 92, y: 42, s: 0.7, rot: -20 }],
      [2500, "pallone", { x: 84, y: 22, s: 0.62, rot: 90 }],
      [3000, "pallone", { x: 104, y: 30, s: 0.54, rot: 10 }],
    ]),
    durationMs: 3000,
  },
  alt: "Un palloncino rosso sfugge di mano e vola a zig zag sgonfiandosi: a ogni scatto è più piccolo. Il video si ferma a mezz'aria.",
  prompt: PROMPT,
  options: [
    { id: "piu-piccolo", text: "Ancora più piccolo e raggrinzito", set: { pallone: { x: 116, y: 40, s: 0.42, rot: 120 } } },
    { id: "piu-grande", text: "Più grande e gonfio di prima", set: { pallone: { x: 116, y: 30, s: 1.3, rot: 0 } } },
    { id: "in-mano", text: "Di nuovo gonfio e fermo al punto di partenza", set: { pallone: { x: 40, y: 64, s: 1, rot: 0 } } },
  ],
  solution: { optionId: "piu-piccolo" },
  explain: "Il palloncino perde aria a ogni scatto: un secondo dopo è ancora più piccolo. Non si rigonfia da solo e non torna indietro al punto di partenza.",
};

const varianti: SecondoInput[] = [gattoTazza, pallone, domino, semaforo, bicchiere, pila, spumante, cestino, clessidra, altalena, palloncino];

export default varianti;
