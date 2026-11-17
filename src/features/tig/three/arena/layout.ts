/**
 * PIANTA DELL'ARENA di TAVOLI IN GUERRA! (pura, testata). Metri, pavimento a y = 0, la camera sta verso +Z.
 *
 *                 ╭──── HALO LED sospeso sopra il palco (schermo curvo, faccia verso la camera) ────╮
 *                        tav.5   tav.6   tav.7   tav.8                       (fondo della U, dietro il palco)
 *             tav.3  tav.4                         tav.9  tav.10
 *      tav.2                    ⬡ PALCO (presentatori)            tav.11
 *   tav.1                                                              tav.12   ← le punte della U, ai lati
 *                                   (davanti è aperto: la camera)
 *
 * I TAVOLI (torri delle squadre) stanno su una U attorno al palco, aperta verso la camera, con le torri a passo
 * COSTANTE in larghezza: viste dalla camera non si sovrappongono mai (un arco di cerchio oltre i 90° le farebbe
 * impilare ai lati). Fino a 14 squadre una sola U (passo pieno, torri a grandezza piena); da 15 a 24 DUE file
 * sfalsate a zig-zag (tavoli dispari dietro, su una pedana, pari davanti, a mezzo passo): ogni fila ha al massimo
 * 12 torri e le torri non si rimpiccioliscono mai, così mascotte e targhette restano grandi e leggibili anche con
 * 24 tavoli. Ogni torre guarda un punto davanti al palco (il pubblico).
 */

export const STAGE = {
  /** raggio del palco esagonale (al vertice) */
  radius: 2.55,
  /** altezza del piano del palco */
  height: 0.42,
  /** profondità (z) dove stanno i presentatori, sul bordo anteriore del palco */
  hostZ: 1.15,
} as const;

/** Torre di una squadra: raggio della colonna, base e altezze (la colonna sale con il punteggio). */
export const POD = {
  radius: 0.5,
  /** anello luminoso a terra */
  baseRadius: 0.78,
  /** altezza minima della colonna (punteggio 0) e massima (in testa) */
  minHeight: 0.55,
  maxHeight: 2.15,
  /** altezza della mascotte in piedi sulla torre */
  mascotHeight: 1.15,
} as const;

/** Passo orizzontale tra due torri fino a 12 squadre (m). */
export const POD_SPACING = 1.65;
/** Larghezza massima della U (m): oltre, le torri si stringono e rimpiccioliscono. */
export const MAX_WIDTH = 23;
/** Mezza larghezza minima della U: con poche squadre le torri stanno comunque ai lati del palco. */
export const MIN_HALF_WIDTH = 4.7;
/** Profondità del fondo della U (dietro il palco) e delle punte (ai lati, un po' avanti). */
export const U_BACK = -5.6;
export const U_FRONT = 0.9;
/** Oltre questo numero di squadre: due file (fino a 14 la U singola sta in MAX_WIDTH a passo pieno). */
export const ONE_ROW_MAX = 14;
/** Due file: passo minimo dentro una fila, mezza larghezza minima, profondità delle due U e pedana della fila dietro. */
export const ROW_SPACING = 1.75;
export const TWO_ROW_MIN_HALF = 9;
export const BACK_ROW = { back: -6.7, front: -0.8, riser: 0.5 } as const;
export const FRONT_ROW = { back: -4.35, front: 2.3 } as const;
/** Squadre gestite dall'arena (come MAX_TABLES del core). */
export const MAX_TEAMS = 24;
/** Curvatura della U (esponente: più alto = fondo più piatto). */
const U_POWER = 2.2;

/** Halo LED sospeso: cilindro centrato sul palco, solo la parte davanti è lo schermo dei contenuti. */
export const LED = {
  radius: 5.4,
  height: 3.4,
  /** quota del bordo basso: sopra le linee di vista verso le torri dietro il palco (non le copre mai) */
  bottom: 6.1,
  /** ampiezza (gradi) della parte con i contenuti, centrata verso la camera */
  arcDeg: 130,
} as const;

/**
 * LA GRANDE VELA (edizione pirati): al posto dello schermo LED, una vela quadra appesa al pennone dell'albero maestro
 * piantato in fondo al ponte di comando. La tela fa pancia verso la camera (vento da dietro); i testi sono "dipinti"
 * sulla tela (canvas) e restano nitidi. Il bordo basso sta sopra le linee di vista verso le postazioni del fondo.
 */
export const SAIL = {
  /** larghezza in alto (lungo il pennone) e in basso */
  width: 11.6,
  bottomWidth: 12.2,
  height: 4.3,
  /** quota del bordo basso */
  bottom: 6.0,
  /** piano del pennone (z) e pancia massima della tela verso la camera */
  z: -1.25,
  belly: 0.95,
} as const;

/** Albero maestro (in fondo al ponte di comando, dietro il podio) e coffa. */
export const MAST = { x: 0, z: -1.9, height: 15.2, radius: 0.2 } as const;

/** Anello dei fari (lanterne di bordo appese al sartiame), sopra la vela. */
export const TRUSS_Y = 10.6;

export interface PodPlacement {
  /** indice nell'ordine dei tavoli (numero crescente) */
  index: number;
  x: number;
  z: number;
  /** quota della base (0 a terra; la fila dietro sta su una pedana) */
  y: number;
  /** fila: 0 = unica o davanti, 1 = dietro */
  row: 0 | 1;
  /** rotazione attorno a Y perché la faccia (+Z locale) guardi il pubblico */
  yaw: number;
}

export interface ArenaLayout {
  n: number;
  /** distanza massima di una torre dal centro del palco (per americana, nastro LED, sfondo) */
  radius: number;
  /** mezza larghezza della U */
  halfWidth: number;
  /** passo orizzontale tra due torri */
  spacing: number;
  /** scala delle torri e delle mascotte */
  scale: number;
  /** quante file (1 fino a 14 squadre, poi 2) */
  rows: 1 | 2;
  pods: PodPlacement[];
}

/** Torri della fila dietro (due file): una in più della fila davanti se n è dispari. */
function backCount(n: number): number {
  return Math.ceil(n / 2);
}

/** Mezza larghezza delle due file (n > ONE_ROW_MAX): larga almeno come la U singola piena, mai oltre MAX_WIDTH. */
function twoRowHalfWidth(n: number): number {
  return Math.min(MAX_WIDTH / 2, Math.max(TWO_ROW_MIN_HALF, (ROW_SPACING * (backCount(n) - 1)) / 2));
}

/** Passo orizzontale per n squadre (dentro la fila). */
export function podSpacing(n: number): number {
  if (n <= 1) return POD_SPACING;
  if (n > ONE_ROW_MAX) return (2 * twoRowHalfWidth(n)) / (backCount(n) - 1);
  return Math.min(POD_SPACING, MAX_WIDTH / (n - 1));
}

/** Scala delle torri per n squadre (si rimpiccioliscono solo quando il passo si stringe). */
export function podScale(n: number): number {
  return Math.min(1, podSpacing(n) / (n > ONE_ROW_MAX ? ROW_SPACING : POD_SPACING));
}

/** Punto che le torri guardano (davanti al palco, verso il pubblico). */
export function facingPoint(halfWidth: number): { x: number; z: number } {
  return { x: 0, z: U_FRONT + 3.5 + halfWidth * 0.25 };
}

/** Profondità della U alla larghezza x (punte avanti, fondo dietro il palco). */
export function uDepth(x: number, halfWidth: number, back: number = U_BACK, front: number = U_FRONT): number {
  const u = halfWidth > 0 ? Math.min(1, Math.abs(x) / halfWidth) : 0;
  return back + (front - back) * Math.pow(u, U_POWER);
}

/**
 * Posizioni delle torri per n squadre (0–24), in ordine di tavolo da sinistra a destra (visto dalla camera).
 * Due file (n > 14): zig-zag — tavolo 1 dietro, 2 davanti, 3 dietro… — con la fila davanti a metà passo.
 */
export function podLayout(n: number): ArenaLayout {
  const count = Math.max(0, Math.min(MAX_TEAMS, Math.floor(n)));
  const spacing = podSpacing(count);
  const pods: PodPlacement[] = [];
  if (count <= ONE_ROW_MAX) {
    const halfWidth = count <= 1 ? 0 : Math.max(MIN_HALF_WIDTH, (spacing * (count - 1)) / 2);
    const look = facingPoint(halfWidth);
    let radius = Math.abs(U_BACK);
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 0 : -halfWidth + (2 * halfWidth * i) / (count - 1);
      const z = uDepth(x, halfWidth);
      const yaw = Math.atan2(look.x - x, look.z - z);
      radius = Math.max(radius, Math.hypot(x, z));
      pods.push({ index: i, x, z, y: 0, row: 0, yaw });
    }
    return { n: count, radius, halfWidth, spacing, scale: podScale(count), rows: 1, pods };
  }
  // due file a zig-zag: indice pari dietro (pedana), dispari davanti a mezzo passo. Con n pari le file hanno lo
  // stesso numero di torri e si spostano di un quarto di passo (dietro a sinistra, davanti a destra): l'insieme resta
  // centrato e simmetrico (il tavolo 1 è lo specchio dell'ultimo)
  const halfWidth = twoRowHalfWidth(count);
  const shift = count % 2 === 0 ? spacing / 4 : 0;
  const xs: number[] = [];
  let backHalf = 0;
  let frontHalf = 0;
  for (let i = 0; i < count; i++) {
    const back = i % 2 === 0;
    const k = Math.floor(i / 2);
    const x = back ? -halfWidth - shift + spacing * k : -halfWidth + shift + spacing * (k + 0.5) - (shift ? spacing / 2 : 0);
    xs.push(x);
    if (back) backHalf = Math.max(backHalf, Math.abs(x));
    else frontHalf = Math.max(frontHalf, Math.abs(x));
  }
  const look = facingPoint(halfWidth);
  let radius = Math.abs(BACK_ROW.back);
  for (let i = 0; i < count; i++) {
    const back = i % 2 === 0;
    const x = xs[i];
    const z = back ? uDepth(x, backHalf, BACK_ROW.back, BACK_ROW.front) : uDepth(x, frontHalf, FRONT_ROW.back, FRONT_ROW.front);
    const yaw = Math.atan2(look.x - x, look.z - z);
    radius = Math.max(radius, Math.hypot(x, z));
    pods.push({ index: i, x, z, y: back ? BACK_ROW.riser : 0, row: back ? 1 : 0, yaw });
  }
  return { n: count, radius, halfWidth, spacing, scale: podScale(count), rows: 2, pods };
}

/** Distanza minima tra due torri qualsiasi del layout (per i test e per le scritte). */
export function minPodGap(layout: ArenaLayout): number {
  let min = Infinity;
  for (let i = 0; i < layout.pods.length; i++) {
    for (let j = i + 1; j < layout.pods.length; j++) {
      const a = layout.pods[i];
      const b = layout.pods[j];
      min = Math.min(min, Math.hypot(a.x - b.x, a.z - b.z));
    }
  }
  return min;
}

/** Altezza della colonna per un punteggio (0..scaleMax → minHeight..maxHeight, saturata). */
export function columnHeight(score: number, scaleMax: number): number {
  const k = scaleMax > 0 ? Math.min(1, Math.max(0, score / scaleMax)) : 0;
  // curva leggermente concava: le differenze piccole all'inizio della serata si vedono comunque
  const eased = Math.pow(k, 0.85);
  return POD.minHeight + (POD.maxHeight - POD.minHeight) * eased;
}

/** Fondo scala dei punteggi: un po' sopra il massimo, mai sotto 300 (a inizio serata le torri non schizzano). */
export function scoreScale(maxScore: number): number {
  return Math.max(300, maxScore * 1.12);
}

/**
 * Posizioni dei presentatori sul palco (1–4), da sinistra a destra, ai LATI del bordo anteriore: il centro del palco
 * resta libero per il marchio e per il podio della premiazione. Leggermente rivolti verso il centro.
 */
export function hostMarks(count: number, aside = false): { x: number; z: number; yaw: number }[] {
  const n = Math.max(0, Math.min(4, Math.floor(count)));
  if (aside) {
    // premiazione: ai lati del podio, sul piano alto del palco (apotema dell'esagono 2,2 m)
    const side: Record<number, number[]> = { 1: [-2.0], 2: [-2.0, 2.0], 3: [-2.0, -1.55, 2.0], 4: [-2.0, -1.55, 1.55, 2.0] };
    return (side[n] ?? []).map((x, i, arr) => ({ x, z: Math.abs(x) < 1.8 ? 1.55 : 0.95, yaw: -Math.sign(x) * 0.35 + (arr.length > 2 && i === 1 ? 0.2 : 0) }));
  }
  const presets: Record<number, number[]> = { 1: [-1.25], 2: [-1.45, 1.45], 3: [-1.75, 0, 1.75], 4: [-1.95, -0.7, 0.7, 1.95] };
  return (presets[n] ?? []).map((x) => ({ x, z: STAGE.hostZ - Math.abs(x) * 0.12 + (n === 3 && x === 0 ? 0.35 : 0), yaw: -x * 0.14 }));
}
