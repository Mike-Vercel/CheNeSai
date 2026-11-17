import { rngFrom } from "../../components/rng";

/**
 * Suoni ORIGINALI sintetizzati (Rumore di fondo): nessun file audio, solo «ricette» che producono eventi
 * per WebAudio (oscillatori e rumore filtrato con inviluppo). Funzioni PURE e deterministiche (seme).
 *
 * Il server compila le ricette in una lista ANONIMA di eventi mescolati per tempo: ai telefoni non arriva
 * né il nome dei suoni né il volume di ogni strato, solo numeri da suonare (la soluzione non si legge).
 *
 * Evento tono:   ["t", inizio s, durata s, forma 0..3 (sine, square, sawtooth, triangle), f0 Hz, f1 Hz,
 *                 guadagno, attacco s, rilascio s, tremolo Hz, profondità tremolo 0..1]
 * Evento rumore: ["n", inizio s, durata s, filtro 0..2 (passa-basso, passa-banda, passa-alto), f0 Hz, f1 Hz,
 *                 Q, guadagno, attacco s, rilascio s]
 */

export type ToneEvent = ["t", number, number, number, number, number, number, number, number, number, number];
export type NoiseEvent = ["n", number, number, number, number, number, number, number, number, number];
export type SynthEvent = ToneEvent | NoiseEvent;

export const SOUND_KINDS = [
  "campanello",
  "telefono",
  "sveglia",
  "bollitore",
  "sirena",
  "clacson",
  "pioggia",
  "tictac",
  "cuore",
  "tastiera",
  "notifica",
  "uccellini",
  "grilli",
  "tuono",
  "onde",
  "vento",
  "applausi",
  "tamburo",
  "monete",
  "sfrigolio",
  "gocce",
  "aspirapolvere",
  "fischietto",
  "carillon",
  "gabbiano",
] as const;
export type SoundKind = (typeof SOUND_KINDS)[number];

const r3 = (n: number) => Math.round(n * 1000) / 1000;

function tone(at: number, dur: number, wave: number, f0: number, f1: number, g: number, a = 0.01, rel = 0.05, tremHz = 0, tremDepth = 0): ToneEvent {
  return ["t", r3(at), r3(dur), wave, r3(f0), r3(f1), r3(g), r3(a), r3(rel), r3(tremHz), r3(tremDepth)];
}
function noise(at: number, dur: number, filter: number, f0: number, f1: number, q: number, g: number, a = 0.01, rel = 0.05): NoiseEvent {
  return ["n", r3(at), r3(dur), filter, r3(f0), r3(f1), r3(q), r3(g), r3(a), r3(rel)];
}

type Recipe = (d: number, g: number, rnd: () => number) => SynthEvent[];

/** Ripete `make(t)` ogni `every` secondi da `from` fino a `d`. */
function every(d: number, from: number, step: number, make: (t: number, i: number) => SynthEvent[]): SynthEvent[] {
  const out: SynthEvent[] = [];
  let i = 0;
  for (let t = from; t < d - 0.05; t += step) out.push(...make(t, i++));
  return out;
}

const RECIPES: Record<SoundKind, Recipe> = {
  // din-don: due note di campana con armonica
  campanello: (d, g) =>
    every(d, 0.1, 2.4, (t) => [tone(t, 0.7, 0, 659, 659, g, 0.005, 0.6), tone(t, 0.5, 0, 1318, 1318, g * 0.25, 0.005, 0.4), tone(t + 0.6, 1.1, 0, 523, 523, g, 0.005, 1), tone(t + 0.6, 0.7, 0, 1046, 1046, g * 0.22, 0.005, 0.6)]),
  // squillo classico: due toni vicini con tremolo veloce, 1,2 s sì e 1 s no
  telefono: (d, g) => every(d, 0, 2.2, (t) => [tone(t, 1.2, 0, 440, 440, g * 0.6, 0.01, 0.05, 20, 0.9), tone(t, 1.2, 0, 480, 480, g * 0.6, 0.01, 0.05, 20, 0.9)]),
  // bip-bip-bip-bip della sveglia
  sveglia: (d, g) => every(d, 0, 1, (t) => [0, 0.14, 0.28, 0.42].map((k) => tone(t + k, 0.08, 1, 2000, 2000, g * 0.35, 0.002, 0.01))),
  // fischio che sale con un soffio
  bollitore: (d, g) => [tone(0.2, d - 0.4, 0, 1100, 2400, g * 0.55, 0.8, 0.3, 6, 0.15), noise(0, d, 1, 3000, 4000, 2, g * 0.25, 0.5, 0.3)],
  // ululato su e giù
  sirena: (d, g) => every(d, 0, 1.4, (t) => [tone(t, 0.7, 2, 650, 1300, g * 0.4, 0.02, 0.02), tone(t + 0.7, 0.7, 2, 1300, 650, g * 0.4, 0.02, 0.02)]),
  // due colpi di clacson (due onde quadre stonate)
  clacson: (d, g) =>
    every(d, 0.2, 2, (t) => [tone(t, 0.3, 1, 392, 392, g * 0.3, 0.01, 0.03), tone(t, 0.3, 1, 494, 494, g * 0.3, 0.01, 0.03), tone(t + 0.45, 0.55, 1, 392, 392, g * 0.3, 0.01, 0.05), tone(t + 0.45, 0.55, 1, 494, 494, g * 0.3, 0.01, 0.05)]),
  // fruscio + gocce
  pioggia: (d, g, rnd) => [noise(0, d, 1, 2500, 2500, 0.6, g * 0.55, 0.6, 0.6), ...Array.from({ length: Math.round(d * 7) }, () => noise(rnd() * d, 0.03, 2, 3000 + rnd() * 3000, 3000, 1, g * 0.4, 0.002, 0.02))],
  // tic-tac regolare
  tictac: (d, g) => every(d, 0, 0.5, (t, i) => [noise(t, 0.025, 1, i % 2 ? 1800 : 2600, i % 2 ? 1800 : 2600, 8, g * 0.9, 0.001, 0.02)]),
  // tu-tum del cuore
  cuore: (d, g) => every(d, 0.1, 0.86, (t) => [tone(t, 0.14, 0, 70, 45, g, 0.005, 0.1), tone(t + 0.26, 0.12, 0, 62, 40, g * 0.75, 0.005, 0.1)]),
  // tasti che battono
  tastiera: (d, g, rnd) => {
    const out: SynthEvent[] = [];
    let t = 0.05;
    while (t < d - 0.1) {
      out.push(noise(t, 0.02, 2, 2200 + rnd() * 1500, 2200, 1, g * (0.6 + rnd() * 0.4), 0.001, 0.015));
      t += 0.08 + rnd() * 0.16 + (rnd() < 0.08 ? 0.4 : 0);
    }
    return out;
  },
  // dlin-dlon di notifica
  notifica: (d, g) => every(d, 0.3, 1.8, (t) => [tone(t, 0.18, 0, 880, 880, g * 0.6, 0.005, 0.15), tone(t + 0.14, 0.3, 0, 1320, 1320, g * 0.6, 0.005, 0.25)]),
  // cinguettii a gruppi
  uccellini: (d, g, rnd) => {
    const out: SynthEvent[] = [];
    let t = 0.1;
    while (t < d - 0.4) {
      const n = 2 + Math.floor(rnd() * 3);
      const base = 2800 + rnd() * 1200;
      for (let k = 0; k < n; k++) out.push(tone(t + k * 0.11, 0.07, 0, base, base * 1.5, g * 0.35, 0.005, 0.03));
      t += 0.5 + rnd() * 0.7;
    }
    return out;
  },
  // cri-cri dei grilli
  grilli: (d, g) => every(d, 0, 0.62, (t) => [0, 0.05, 0.1, 0.15].map((k) => tone(t + k, 0.035, 0, 4400, 4400, g * 0.22, 0.003, 0.01))),
  // brontolio basso che monta e cala
  tuono: (d, g) => [noise(0.3, d - 0.6, 0, 140, 90, 0.7, g * 1.4, 0.6, 1.6), noise(0.5, 0.25, 0, 400, 150, 0.8, g * 0.8, 0.01, 0.2)],
  // onde che arrivano e si ritirano
  onde: (d, g) => every(d, 0, 2.6, (t) => [noise(t, 2.4, 0, 450, 1400, 0.8, g * 0.8, 1, 1.2)]),
  // vento che fischia piano
  vento: (d, g) => [noise(0, d / 2, 1, 350, 900, 4, g * 0.9, 1, 0.2), noise(d / 2, d / 2, 1, 900, 400, 4, g * 0.9, 0.2, 1)],
  // battimani
  applausi: (d, g, rnd) => Array.from({ length: Math.round(d * 32) }, () => noise(0.1 + rnd() * (d - 0.3), 0.03, 1, 1500 + rnd() * 1200, 1800, 1.2, g * (0.2 + rnd() * 0.25), 0.001, 0.02)),
  // cassa e rullante a 110 battiti
  tamburo: (d, g) => every(d, 0, 0.545, (t, i) => (i % 2 === 0 ? [tone(t, 0.18, 0, 130, 45, g, 0.002, 0.15)] : [noise(t, 0.14, 1, 1900, 1900, 0.9, g * 0.7, 0.002, 0.12), tone(t, 0.08, 3, 190, 160, g * 0.3, 0.002, 0.06)])),
  // tintinnii metallici
  monete: (d, g, rnd) =>
    Array.from({ length: Math.round(d * 2.2) }, () => {
      const t = rnd() * (d - 0.5);
      return [tone(t, 0.35, 0, 2350, 2350, g * 0.3, 0.002, 0.3), tone(t, 0.3, 0, 3720, 3720, g * 0.2, 0.002, 0.25), tone(t + 0.07, 0.25, 0, 2980, 2980, g * 0.18, 0.002, 0.2)];
    }).flat(),
  // olio che frigge: soffio acuto + scoppiettii
  sfrigolio: (d, g, rnd) => [noise(0, d, 2, 5000, 5000, 0.7, g * 0.35, 0.3, 0.3), ...Array.from({ length: Math.round(d * 14) }, () => noise(rnd() * d, 0.012, 2, 4000, 4000, 1, g * 0.6, 0.001, 0.01))],
  // gocciolio del rubinetto
  gocce: (d, g) => every(d, 0.2, 0.75, (t) => [tone(t, 0.07, 0, 1500, 650, g * 0.6, 0.002, 0.05)]),
  // ronzio grave + soffio
  aspirapolvere: (d, g) => [tone(0, d, 2, 118, 125, g * 0.35, 0.3, 0.3), noise(0, d, 1, 1400, 1600, 1.5, g * 0.5, 0.3, 0.3)],
  // fischietto: due brevi e uno lungo
  fischietto: (d, g) => every(d, 0.1, 2.5, (t) => [tone(t, 0.2, 0, 2900, 2900, g * 0.4, 0.01, 0.03, 32, 0.6), tone(t + 0.35, 0.2, 0, 2900, 2900, g * 0.4, 0.01, 0.03, 32, 0.6), tone(t + 0.7, 0.9, 0, 2900, 2900, g * 0.4, 0.01, 0.1, 32, 0.6)]),
  // carillon: melodia di quattro note acute
  carillon: (d, g) => every(d, 0, 1.6, (t) => [1047, 1319, 1568, 2093].map((f, k) => tone(t + k * 0.4, 0.9, 0, f, f, g * 0.35, 0.003, 0.8))),
  // versi di gabbiano
  gabbiano: (d, g) => every(d, 0.2, 1.9, (t) => [tone(t, 0.35, 2, 1700, 1150, g * 0.3, 0.02, 0.1, 9, 0.3), tone(t + 0.45, 0.3, 2, 1650, 1100, g * 0.3, 0.02, 0.1, 9, 0.3)]),
};

export interface Layer {
  sound: SoundKind;
  /** volume relativo 0..1 */
  gain: number;
}

/**
 * Compila gli strati in UNA lista di eventi mescolati, ordinati per inizio. `d` in secondi.
 * Il guadagno complessivo è normalizzato (somma dei volumi = 1) così il missaggio non satura.
 */
export function compileMix(layers: readonly Layer[], d: number, seed: string): SynthEvent[] {
  const total = layers.reduce((s, l) => s + l.gain, 0) || 1;
  const out: SynthEvent[] = [];
  layers.forEach((l, i) => out.push(...RECIPES[l.sound](d, l.gain / total, rngFrom(`${seed}:${i}`))));
  return out.sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0) || a[4] - b[4]);
}

/** Un solo suono (per l'ascolto separato al reveal). */
export function compileOne(sound: SoundKind, d: number, seed: string): SynthEvent[] {
  return RECIPES[sound](d, 1, rngFrom(`${seed}:solo`));
}
