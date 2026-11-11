"use client";

import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { useIntroClock } from "./clock";
import { T, easeInOutCubic, easeOutCubic, lerp } from "../timeline";

type Ease = "linear" | "inOut" | "out";

interface Key {
  t: number;
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
  /** Easing del segmento che PARTE da questa chiave. */
  ease: Ease;
}

/** Regia: ogni chiave è uno "stop" della camera; tra due chiavi si interpola con l'easing indicato. */
const WIDE_POS: [number, number, number] = [0, 4.4, 17.6];
const WIDE_TGT: [number, number, number] = [0, 4.7, 0];

const ENTRANCE_POS: [number, number, number] = [0, 5.6, 22.6];
const ENTRANCE_TGT: [number, number, number] = [0, 5.0, 0];

const KEYS: readonly Key[] = [
  // solo la ruota al centro: gira e la camera si avvicina piano
  { t: 0, pos: [0, 4.55, 20.5], target: [0, 4.55, 0], fov: 34, ease: "linear" },
  { t: T.spinStart, pos: [0, 4.55, 20.0], target: [0, 4.55, 0], fov: 35, ease: "out" },
  { t: T.wheelStop, pos: [0, 4.55, 18.0], target: [0, 4.55, 0], fov: 36, ease: "linear" },
  // la ruota vola in fondo: la camera arretra e sale mostrando lo studio
  { t: T.logoBack, pos: [0, 4.55, 17.8], target: [0, 4.55, 0], fov: 36, ease: "inOut" },
  { t: T.logoBack + 1.8, pos: [0, 5.6, 20.5], target: [0, 6.4, -2], fov: 38, ease: "linear" },
  // titolo + annunciatore: spinta lenta verso l'emblema
  { t: T.title + 0.1, pos: [0, 5.7, 20.2], target: [0, 6.6, -2], fov: 38, ease: "out" },
  { t: T.entrance - 0.01, pos: [0, 6.5, 16.2], target: [0, 7.9, -4], fov: 36, ease: "linear" },
  // STACCO sul campo largo: si vedono le quinte, i presentatori entrano dai lati, Palmino dall'alto
  { t: T.entrance, pos: ENTRANCE_POS, target: ENTRANCE_TGT, fov: 40, ease: "linear" },
  { t: T.pushIn, pos: [0, 5.5, 22.1], target: [0, 4.95, 0], fov: 40, ease: "inOut" },
  // poi la camera stringe lentamente sul terzetto
  { t: T.welcome - 0.2, pos: WIDE_POS, target: WIDE_TGT, fov: 38, ease: "linear" },
  { t: T.lineProf - 0.4, pos: [-0.2, 4.4, 17.5], target: [-0.1, 4.65, 0], fov: 38, ease: "inOut" },
  { t: T.lineProf + 0.4, pos: [-0.9, 4.35, 17.0], target: [-0.6, 4.6, 0], fov: 38, ease: "linear" },
  { t: T.lineRegina - 0.4, pos: [-1.0, 4.35, 16.9], target: [-0.7, 4.6, 0], fov: 38, ease: "inOut" },
  { t: T.lineRegina + 0.4, pos: [0.9, 4.35, 17.0], target: [0.6, 4.6, 0], fov: 38, ease: "linear" },
  { t: T.linePalmino - 0.4, pos: [1.0, 4.35, 16.9], target: [0.7, 4.6, 0], fov: 38, ease: "inOut" },
  { t: T.linePalmino + 0.4, pos: [0, 4.2, 16.6], target: [0, 4.5, 0], fov: 38, ease: "linear" },
  { t: T.countdown - 0.2, pos: [0, 4.2, 16.4], target: [0, 4.5, 0], fov: 38, ease: "inOut" },
  { t: T.countdown + 0.6, pos: WIDE_POS, target: WIDE_TGT, fov: 38, ease: "linear" },
  { t: T.end, pos: WIDE_POS, target: WIDE_TGT, fov: 38, ease: "linear" },
];

/** Inquadratura "larga" verso cui si schiacciano i movimenti con reducedMotion. */
const WIDE = KEYS[KEYS.length - 1];

const pos = new Vector3();
const tgt = new Vector3();
const a = new Vector3();
const b = new Vector3();

function applyEase(e: Ease, x: number) {
  if (e === "inOut") return easeInOutCubic(x);
  if (e === "out") return easeOutCubic(x);
  return x;
}

/** Scrive in pos/tgt la camera della regia al tempo t; ritorna il fov. */
function sample(t: number): number {
  if (t <= KEYS[0].t) {
    pos.fromArray(KEYS[0].pos);
    tgt.fromArray(KEYS[0].target);
    return KEYS[0].fov;
  }
  for (let i = 0; i < KEYS.length - 1; i++) {
    const k0 = KEYS[i];
    const k1 = KEYS[i + 1];
    if (t < k1.t) {
      const x = applyEase(k0.ease, (t - k0.t) / (k1.t - k0.t));
      pos.copy(a.fromArray(k0.pos)).lerp(b.fromArray(k1.pos), x);
      tgt.copy(a.fromArray(k0.target)).lerp(b.fromArray(k1.target), x);
      return lerp(k0.fov, k1.fov, x);
    }
  }
  pos.fromArray(WIDE.pos);
  tgt.fromArray(WIDE.target);
  return WIDE.fov;
}

/** Scossoni d'impatto (atterraggio Palmino, logo). */
/** Inquadrature strette su ciascun personaggio (chi parla resta su un lato: la scheda va sull'altro). */
const FOCUS: Record<"professore" | "regina" | "palmino", { pos: [number, number, number]; target: [number, number, number]; fov: number }> = {
  professore: { pos: [-4.5, 3.8, 10.6], target: [-3.2, 3.5, 1.0], fov: 37 },
  regina: { pos: [4.6, 3.8, 10.6], target: [3.3, 3.5, 1.0], fov: 37 },
  palmino: { pos: [0, 3.0, 11.0], target: [0, 2.6, 2.7], fov: 37 },
};

const SHAKES = [
  { at: T.wheelStop, amp: 0.05 },
  { at: T.title, amp: 0.1 },
  { at: T.palminoDrop + 0.3, amp: 0.18 },
]

export function CameraRig() {
  const clock = useIntroClock();

  useFrame(({ size, camera }) => {
    const { t, e, reducedMotion, speaker } = clock.current;
    let fov = sample(t);
    // chi parla: la camera stringe su di lui (mezzo primo piano, targhetta del podio inclusa)
    const zoom = clock.current.zoom * (reducedMotion ? 0.3 : 0.85);
    if (zoom > 0 && speaker) {
      const f = FOCUS[speaker];
      pos.lerp(a.fromArray(f.pos), zoom);
      tgt.lerp(a.fromArray(f.target), zoom);
      fov = lerp(fov, f.fov, zoom);
    }
    if (reducedMotion) {
      // movimenti minimi: resta vicino all'inquadratura larga
      pos.lerp(a.fromArray(WIDE.pos), 0.7);
      tgt.lerp(a.fromArray(WIDE.target), 0.7);
      fov = lerp(fov, WIDE.fov, 0.7);
    } else {
      // respiro "a mano" sempre presente, molto leggero
      pos.x += Math.sin(e * 0.37) * 0.08;
      pos.y += Math.sin(e * 0.53 + 1) * 0.05;
      for (const s of SHAKES) {
        const d = t - s.at;
        if (d >= 0 && d < 0.6) {
          const k = (1 - d / 0.6) * s.amp;
          pos.x += Math.sin(d * 70) * k;
          pos.y += Math.cos(d * 55) * k * 0.7;
        }
      }
      if (t >= T.end) {
        // frame finale: lenta deriva orbitale
        const h = e - T.end;
        pos.x += Math.sin(h * 0.25) * 0.6;
        pos.y += Math.sin(h * 0.19) * 0.15;
      }
    }
    // schermi più stretti del 16:9: allarga il fov verticale per non tagliare i personaggi
    const aspect = size.width / Math.max(1, size.height);
    if (aspect < 16 / 9) {
      // telefono in verticale: si taglia un po' dei bordi del 16:9 (studio e pubblico) per tenere
      // i presentatori più grandi; didascalie e sottotitoli occupano lo spazio sopra e sotto
      const h = Math.tan((fov * Math.PI) / 360) * (16 / 9 / aspect) * (aspect < 1 ? 0.86 : 1);
      fov = (Math.atan(h) * 360) / Math.PI;
    }
    camera.position.copy(pos);
    camera.lookAt(tgt);
    if (camera instanceof PerspectiveCamera && Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
