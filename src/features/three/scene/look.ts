import { Color } from "three";
import { T, prog, smooth } from "../timeline";

/** Palette del brand. */
export const BRAND = {
  gold: "#FFD43B",
  amber: "#FFB800",
  fuchsia: "#FF1493",
  red: "#F72545",
  blue: "#087CFF",
  cyan: "#00D9FF",
  green: "#00D46A",
  violet: "#832BFF",
  bg: "#170824",
  white: "#FFFFFF",
} as const;

interface Look {
  at: number;
  a: Color; // LED wall alto / luce chiave
  b: Color; // LED wall basso
  c: Color; // raggi / accenti
  key: Color; // colore dei coni
  rim: Color; // controluce
}

const look = (at: number, a: string, b: string, c: string, key: string, rim: string): Look => ({
  at,
  a: new Color(a),
  b: new Color(b),
  c: new Color(c),
  key: new Color(key),
  rim: new Color(rim),
});

/** "Grading" luci per fase: cambia colore con una dissolvenza di ~0.8s. */
const LOOKS: readonly Look[] = [
  look(0, BRAND.violet, "#1a0630", BRAND.fuchsia, "#b36bff", BRAND.violet),
  look(T.studioOn, BRAND.violet, "#3a0a52", BRAND.amber, "#ffd27a", BRAND.fuchsia),
  look(T.title, BRAND.fuchsia, "#2c0a5c", BRAND.gold, "#ffe2a0", BRAND.amber),
  look(T.entrance, BRAND.violet, "#1c0a4a", BRAND.cyan, "#ffd27a", BRAND.fuchsia),
  look(T.lineProf, BRAND.blue, "#08133f", BRAND.cyan, "#8fd8ff", BRAND.cyan),
  look(T.lineRegina, BRAND.fuchsia, "#3a0630", BRAND.violet, "#ff7ac8", BRAND.fuchsia),
  look(T.linePalmino, BRAND.green, "#04261a", BRAND.cyan, "#b6ff7a", BRAND.gold),
  // regole (la storia è ferma a T.rulesStart): luce calda e neutra, poi countdown
  look(T.linePalmino + 1.7, BRAND.violet, "#22083f", BRAND.amber, "#ffe2a0", BRAND.fuchsia),
  look(T.countdown, BRAND.violet, "#120a40", BRAND.cyan, "#b8c8ff", BRAND.blue),
  look(T.end, BRAND.fuchsia, "#2c0a5c", BRAND.amber, "#ffe2a0", BRAND.amber),
];

export interface LookOut {
  a: Color;
  b: Color;
  c: Color;
  key: Color;
  rim: Color;
}

export function createLookOut(): LookOut {
  return { a: new Color(), b: new Color(), c: new Color(), key: new Color(), rim: new Color() };
}

/** Scrive in `out` il look corrente (nessuna allocazione). */
export function sampleLook(t: number, out: LookOut): LookOut {
  let i = 0;
  while (i < LOOKS.length - 1 && t >= LOOKS[i + 1].at) i++;
  const cur = LOOKS[i];
  const prev = LOOKS[Math.max(0, i - 1)];
  const k = i === 0 ? 1 : smooth(prog(t, cur.at, cur.at + 0.8));
  out.a.lerpColors(prev.a, cur.a, k);
  out.b.lerpColors(prev.b, cur.b, k);
  out.c.lerpColors(prev.c, cur.c, k);
  out.key.lerpColors(prev.key, cur.key, k);
  out.rim.lerpColors(prev.rim, cur.rim, k);
  return out;
}

/** Accensione dello studio 0..1 (2.5s → 5.5s). */
export const studioOn = (t: number) => prog(t, T.studioOn, T.studioOn + 3);
