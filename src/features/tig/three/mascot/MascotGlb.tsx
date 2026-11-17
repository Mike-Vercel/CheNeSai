"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { AnimationMixer, Box3, LoopRepeat, type AnimationAction, type Group, type Mesh } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mascotInfo } from "../../mascots/registry";
import { mascotPose, restPose } from "./mascot-motion";
import type { AnchorsRef, MascotEntry } from "./MascotSwarm";

/**
 * Una MASCOTTE VERA da GLB (quando il registro ne avrà): modello portato ad altezza 1 (le unità della mascotte),
 * piedi sul piano del tavolo, guarda verso +Z. Azioni: la clip indicata nel registro (`clips`), se c'è; altrimenti
 * il movimento procedurale sul gruppo radice (mascot-motion.ts). Gli effetti dei livelli 2/3 li disegna MascotSwarm
 * attorno al modello (generici); se il livello ha un suo GLB l'aspetto evoluto è già nel file.
 */
export function MascotGlb({ url, index, entry, anchorsRef, actionsRef, reduced }: { url: string; index: number; entry: MascotEntry; anchorsRef: AnchorsRef; actionsRef?: RefObject<MascotEntry["action"][]>; levelModel: boolean; reduced: boolean }) {
  const gltf = useGLTF(url);
  const info = mascotInfo(entry.slot);
  const scale = info?.scale ?? 1;
  const built = useMemo(() => {
    const m = cloneSkinned(gltf.scene);
    m.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        mesh.frustumCulled = false;
        mesh.castShadow = false;
      }
    });
    m.updateMatrixWorld(true);
    const box = new Box3().setFromObject(m);
    const h = Math.max(0.05, box.max.y - box.min.y);
    const mixer = new AnimationMixer(m);
    const actions = new Map<string, AnimationAction>();
    for (const clip of gltf.animations) actions.set(clip.name, mixer.clipAction(clip));
    return { model: m, k: (1 / h) * scale, minY: box.min.y, mixer, actions };
  }, [gltf, scale]);
  const builtRef = useRef(built);
  useEffect(() => {
    builtRef.current = built;
    return () => {
      built.mixer.stopAllAction();
    };
  }, [built]);

  const root = useRef<Group>(null);
  const inner = useRef<Group>(null);
  const st = useRef({ t: 0, since: 0, action: "" as string, current: null as AnimationAction | null, pose: restPose() });
  useFrame((_, rawDt) => {
    const dt = Math.min(0.1, rawDt);
    const s = st.current;
    const B = builtRef.current;
    const action = actionsRef?.current?.[index] ?? entry.action;
    s.t += reduced ? 0 : dt;
    if (action !== s.action) {
      s.action = action;
      s.since = s.t;
      // clip del registro per l'azione, oppure il riposo del file
      const clipName = info?.clips[action] ?? info?.clips.idle ?? null;
      const next = (clipName && B.actions.get(clipName)) || [...B.actions.values()].find((a) => /idle/i.test(a.getClip().name)) || null;
      if (next && next !== s.current) {
        next.reset().setLoop(LoopRepeat, Infinity).fadeIn(0.3).play();
        s.current?.fadeOut(0.3);
        s.current = next;
      }
    }
    B.mixer.update(reduced ? 0 : dt);
    const A = anchorsRef.current;
    const g = root.current;
    const gi = inner.current;
    if (!g || !gi) return;
    const i = index * 5;
    g.position.set(A[i], A[i + 1], A[i + 2]);
    g.rotation.set(0, A[i + 3], 0);
    const sc = A[i + 4] || 1;
    // con una clip vera il corpo lo muove la clip: dal procedurale resta solo il galleggiamento
    const hasClip = !!info?.clips[action];
    const p = mascotPose(hasClip ? "idle" : action, s.t - s.since, s.t, entry.level, s.pose);
    gi.position.set(p.x, p.y, p.z);
    gi.rotation.set(p.tiltX, p.rotY, p.tiltZ);
    gi.scale.set(sc * p.scale, sc * p.scale * p.squash, sc * p.scale);
  });
  return (
    <group ref={root}>
      <group ref={inner}>
        <group scale={built.k} position-y={-built.minY * built.k}>
          <primitive object={built.model} />
        </group>
      </group>
    </group>
  );
}
