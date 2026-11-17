"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, type RefObject } from "react";
import { Color, ConeGeometry, InstancedMesh, Matrix4, Object3D, PlaneGeometry, type ShaderMaterial } from "three";
import { TIG } from "../palette";
import { spotlightLive } from "./director";
import { coneMaterial, spriteMaterial } from "./fx-materials";
import type { ArenaLive } from "./live";
import { TRUSS_Y } from "./layout";
import { glowTexture } from "./textures";
import { useLatestRef } from "./use-latest";

/**
 * EFFETTI DEGLI EVENTI IN PRIMO PIANO (spotlight): occhi di bue dall'americana sulle torri coinvolte (duello, caos,
 * evoluzione, vincitore, scudo, bersaglio), cometa luminosa dall'attaccante al bersaglio (attacco: colore della
 * squadra; sabotaggio: viola) con scia e lampo all'impatto. Istanziati, nessuna allocazione per fotogramma.
 */

const BEAMS = 4;
const TRAIL = 24;
const ZERO = new Matrix4().makeScale(0, 0, 0);
const o = new Object3D();
const c = new Color();
const c2 = new Color();
const cTeam = new Color();
const WHITE = new Color("#ffffff");
const CHAOS = new Color(TIG.chaos);
const GOLD = new Color(TIG.gold);
const CYAN = new Color(TIG.cyan);
const ALARM = new Color(TIG.alarm);

/** Volo della cometa (ms dall'evento). */
const FLY = { start: 300, end: 1250 } as const;

export function SpotFx({ liveRef, low }: { liveRef: RefObject<ArenaLive>; low: boolean }) {
  const glow = useMemo(() => glowTexture(), []);
  const parts = useMemo(() => {
    const beamGeo = new ConeGeometry(1, 1, low ? 18 : 28, 1, true);
    beamGeo.translate(0, -0.5, 0);
    const beamMat = coneMaterial();
    beamMat.uniforms.uHaze.value = 2.6;
    const beams = new InstancedMesh(beamGeo, beamMat, BEAMS);
    beams.frustumCulled = false;
    beams.renderOrder = 2;
    const sprites = new InstancedMesh(new PlaneGeometry(1, 1), spriteMaterial(glow), TRAIL + 2);
    sprites.frustumCulled = false;
    sprites.renderOrder = 7;
    for (let i = 0; i < BEAMS; i++) {
      beams.setMatrixAt(i, ZERO);
      beams.setColorAt(i, WHITE);
    }
    for (let i = 0; i < TRAIL + 2; i++) {
      sprites.setMatrixAt(i, ZERO);
      sprites.setColorAt(i, WHITE);
    }
    return { beams, sprites };
  }, [glow, low]);
  useEffect(
    () => () => {
      glow.dispose();
      for (const m of [parts.beams, parts.sprites]) {
        m.geometry.dispose();
        (m.material as ShaderMaterial).dispose();
        m.dispose();
      }
    },
    [parts, glow],
  );

  const partsRef = useLatestRef(parts);
  useFrame(() => {
    const parts = partsRef.current;
    const L = liveRef.current;
    const spot = L.spotlight;
    const phase = L.dir.mood === "duel" ? "duel" : L.dir.mood === "chaos" ? "chaos" : L.dir.mood === "evolve" ? "evolve" : "game";
    const on = spotlightLive(phase, spot, L.spotAgeMs);
    let active = false;
    // occhi di bue
    for (let k = 0; k < BEAMS; k++) {
      const id = on && spot ? spot.teamIds[k] : undefined;
      const i = id ? L.teams.findIndex((t) => t.teamId === id) : -1;
      if (i < 0 || !spot) {
        parts.beams.setMatrixAt(k, ZERO);
        continue;
      }
      active = true;
      const a = i * 5;
      const x = L.anchors[a];
      const y = L.anchors[a + 1];
      const z = L.anchors[a + 2];
      const sx = x * 1.12;
      const sz = z * 1.12 - 1.4;
      const dx = x - sx;
      const dy = y - 0.2 - TRUSS_Y;
      const dz = z - sz;
      const len = Math.hypot(dx, dy, dz);
      o.position.set(sx, TRUSS_Y, sz);
      o.up.set(0, 1, 0);
      o.lookAt(x, y, z);
      o.rotateX(-Math.PI / 2);
      const rad = len * 0.075;
      o.scale.set(rad, len, rad);
      o.updateMatrix();
      parts.beams.setMatrixAt(k, o.matrix);
      const base = spot.kind === "evolve" ? CHAOS : spot.kind === "winner" ? GOLD : spot.kind === "shield" ? CYAN : spot.kind === "chaos" ? ALARM : WHITE;
      const pulse = spot.kind === "chaos" ? 0.75 + 0.25 * Math.sin(L.t * 10) : 1;
      parts.beams.setColorAt(k, c.copy(base).lerp(c2.set(L.teams[i].color), spot.kind === "duel" ? 0.35 : 0.1).multiplyScalar(0.75 * pulse));
    }
    // cometa: attacco / sabotaggio
    const age = L.spotAgeMs;
    const flying = on && spot && (spot.kind === "attack" || spot.kind === "sabotage") && spot.teamIds.length >= 2 && age < FLY.end + 700;
    if (flying && spot) {
      active = true;
      const ia = L.teams.findIndex((t) => t.teamId === spot.teamIds[0]);
      const ib = L.teams.findIndex((t) => t.teamId === spot.teamIds[1]);
      if (ia >= 0 && ib >= 0) {
        const ax = L.anchors[ia * 5];
        const ay = L.anchors[ia * 5 + 1] + 0.6;
        const az = L.anchors[ia * 5 + 2];
        const bx = L.anchors[ib * 5];
        const by = L.anchors[ib * 5 + 1] + 0.6;
        const bz = L.anchors[ib * 5 + 2];
        // arco basso: resta sotto lo schermo LED sospeso (visibile da ogni inquadratura)
        const arc = 0.9 + Math.hypot(bx - ax, bz - az) * 0.09;
        const col = spot.kind === "sabotage" ? CHAOS : cTeam.set(L.teams[ia].color);
        const u = Math.min(1, Math.max(0, (age - FLY.start) / (FLY.end - FLY.start)));
        for (let k = 0; k < TRAIL; k++) {
          const uk = u - k * 0.022;
          if (age < FLY.start || uk <= 0 || u >= 1) {
            parts.sprites.setMatrixAt(k, ZERO);
            continue;
          }
          const e = uk;
          o.position.set(ax + (bx - ax) * e, ay + (by - ay) * e + Math.sin(Math.PI * e) * arc, az + (bz - az) * e);
          o.rotation.set(0, 0, 0);
          o.scale.setScalar((k === 0 ? 1.7 : 1.05 * (1 - k / TRAIL)) + 0.08);
          o.updateMatrix();
          parts.sprites.setMatrixAt(k, o.matrix);
          parts.sprites.setColorAt(k, c.copy(col).lerp(WHITE, k === 0 ? 0.65 : 0.15).multiplyScalar(k === 0 ? 3.2 : 1.9 * (1 - k / TRAIL)));
        }
        // lampo all'impatto
        const hit = (age - FLY.end) / 600;
        if (hit >= 0 && hit < 1) {
          o.position.set(bx, by, bz);
          o.scale.setScalar(1.4 + hit * 5);
          o.updateMatrix();
          parts.sprites.setMatrixAt(TRAIL, o.matrix);
          parts.sprites.setColorAt(TRAIL, c.copy(col).lerp(WHITE, 0.5).multiplyScalar(3.4 * (1 - hit)));
        } else parts.sprites.setMatrixAt(TRAIL, ZERO);
      }
    } else {
      for (let k = 0; k <= TRAIL; k++) parts.sprites.setMatrixAt(k, ZERO);
    }
    parts.sprites.setMatrixAt(TRAIL + 1, ZERO);
    for (const m of [parts.beams, parts.sprites]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    L.busy.fx = active;
  });
  return (
    <group>
      <primitive object={parts.beams} />
      <primitive object={parts.sprites} />
    </group>
  );
}
