"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Color,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  MeshPhongMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  UnsignedByteType,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Mesh,
  type Texture,
} from "three";

/**
 * RIFLESSO PLANARE ECONOMICO (al posto di MeshReflectorMaterial, che ridisegnava tutta la scena a ogni fotogramma):
 * la camera riflessa disegna SOLO gli oggetti del livello REFLECT_LAYER (luci, lanterne, torce, vela, finestre del
 * galeone, luna: ciò che si vede riflesso nel mare di notte), a bassa risoluzione e ogni N fotogrammi. Edizione
 * pirati: il piano riflettente è il MARE della baia (vedi harbor.tsx); il molo di legno non riflette.
 *
 * `useFloorMaterial`: il molo (Phong: pozze e riflessi lucidi delle luci vere, molto più leggero di un PBR che riempie
 * mezzo schermo) con le tavole come colore e il disegno dipinto (rosa dei venti) come emissivo tenue.
 * `?dbg=stdfloor` usa il PBR (per confronto).
 */

/** Livello three degli oggetti che si riflettono nel mare (la camera principale vede anche il livello 0). */
export const REFLECT_LAYER = 2;

const tmpPlane = new Plane();
const normal = new Vector3();
const reflectorWorldPosition = new Vector3();
const cameraWorldPosition = new Vector3();
const rotationMatrix = new Matrix4();
const lookAtPosition = new Vector3(0, 0, -1);
const clipPlane = new Vector4();
const view = new Vector3();
const target = new Vector3();
const q = new Vector4();

/**
 * Riflesso planare del piano della mesh `meshRef` (normale = +Z locale, come un PlaneGeometry ruotato a terra).
 * `scale` = risoluzione relativa al canvas (0 = spento), `every` = ogni quanti fotogrammi si aggiorna.
 * Restituisce la texture (o null) e la matrice da usare nello shader (uv proiettive: `uTexMatrix * posizione mondo`).
 */
export function usePlanarReflection({ scale, every }: { scale: number; every: number }) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const enabled = scale > 0;
  const rt = useMemo(() => {
    if (!enabled) return null;
    const half = gl.extensions.has("EXT_color_buffer_float") || gl.extensions.has("EXT_color_buffer_half_float");
    const t = new WebGLRenderTarget(8, 8, { type: half ? HalfFloatType : UnsignedByteType, generateMipmaps: true, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter, samples: 0 });
    t.texture.generateMipmaps = true;
    return t;
  }, [gl, enabled]);
  useEffect(() => {
    if (!rt) return;
    rt.setSize(Math.max(64, Math.round(size.width * scale)), Math.max(64, Math.round(size.height * scale)));
  }, [rt, size, scale]);
  useEffect(() => () => rt?.dispose(), [rt]);

  const textureMatrix = useMemo(() => new Matrix4(), []);
  const virtualCamera = useMemo(() => {
    const c = new PerspectiveCamera();
    c.layers.set(REFLECT_LAYER);
    return c;
  }, []);

  const meshRef = useRef<Mesh>(null);
  const frame = useRef(0);
  const objRef = useRef({ rt, virtualCamera, textureMatrix, every });
  useEffect(() => {
    objRef.current = { rt, virtualCamera, textureMatrix, every };
  }, [rt, virtualCamera, textureMatrix, every]);

  // prima del disegno della scena (priorità 0.5: dopo regia e camera, prima di PostFx che disegna a priorità 1)
  useFrame((state) => {
    const { rt: target2, virtualCamera: vc, textureMatrix: tm, every: ev } = objRef.current;
    const mesh = meshRef.current;
    if (!target2 || !mesh) return;
    frame.current += 1;
    if (frame.current % Math.max(1, ev) !== 0) return;
    const camera = state.camera as PerspectiveCamera;
    // riflessione della camera rispetto al piano (come three/examples Reflector)
    mesh.updateMatrixWorld();
    reflectorWorldPosition.setFromMatrixPosition(mesh.matrixWorld);
    cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
    rotationMatrix.extractRotation(mesh.matrixWorld);
    normal.set(0, 0, 1).applyMatrix4(rotationMatrix);
    view.subVectors(reflectorWorldPosition, cameraWorldPosition);
    if (view.dot(normal) > 0) return;
    view.reflect(normal).negate();
    view.add(reflectorWorldPosition);
    rotationMatrix.extractRotation(camera.matrixWorld);
    lookAtPosition.set(0, 0, -1).applyMatrix4(rotationMatrix);
    lookAtPosition.add(cameraWorldPosition);
    target.subVectors(reflectorWorldPosition, lookAtPosition);
    target.reflect(normal).negate();
    target.add(reflectorWorldPosition);
    vc.position.copy(view);
    vc.up.set(0, 1, 0).applyMatrix4(rotationMatrix).reflect(normal);
    vc.lookAt(target);
    vc.far = camera.far;
    vc.near = camera.near;
    vc.fov = camera.fov;
    vc.aspect = camera.aspect;
    // stesso spostamento dell'obiettivo della camera principale (inquadratura dentro l'HUD)
    if (camera.view && camera.view.enabled) vc.setViewOffset(camera.view.fullWidth, camera.view.fullHeight, camera.view.offsetX, camera.view.offsetY, camera.view.width, camera.view.height);
    else vc.clearViewOffset();
    vc.updateProjectionMatrix();
    vc.updateMatrixWorld();
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(vc.projectionMatrix);
    tm.multiply(vc.matrixWorldInverse);
    // piano obliquo: niente di quello che sta sotto il piano
    tmpPlane.setFromNormalAndCoplanarPoint(normal, reflectorWorldPosition);
    tmpPlane.applyMatrix4(vc.matrixWorldInverse);
    clipPlane.set(tmpPlane.normal.x, tmpPlane.normal.y, tmpPlane.normal.z, tmpPlane.constant);
    const pm = vc.projectionMatrix;
    q.x = (Math.sign(clipPlane.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(clipPlane.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1.0;
    q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));
    pm.elements[2] = clipPlane.x;
    pm.elements[6] = clipPlane.y;
    pm.elements[10] = clipPlane.z + 1.0;
    pm.elements[14] = clipPlane.w;
    const gl2 = state.gl;
    const prevRt = gl2.getRenderTarget();
    const prevXr = gl2.xr.enabled;
    const prevShadow = gl2.shadowMap.autoUpdate;
    gl2.xr.enabled = false;
    gl2.shadowMap.autoUpdate = false;
    mesh.visible = false;
    gl2.setRenderTarget(target2);
    gl2.clear();
    gl2.render(state.scene, vc);
    mesh.visible = true;
    gl2.setRenderTarget(prevRt);
    gl2.xr.enabled = prevXr;
    gl2.shadowMap.autoUpdate = prevShadow;
  }, 0.5);

  return { texture: rt ? rt.texture : null, textureMatrix, meshRef };
}

/**
 * Materiale del molo: tavole (`map`, ripetute) + disegno dipinto al centro (`decal`, emissivo tenue, già preparato
 * con alfa premoltiplicata e ripetizione per stare al centro).
 */
export function useFloorMaterial({ map, decal = null, decalStrength = 0.5, pbr = false }: { map: Texture; decal?: Texture | null; decalStrength?: number; pbr?: boolean }) {
  const material = useMemo(() => {
    const emissive = decal ? new Color(decalStrength, decalStrength, decalStrength) : new Color(0, 0, 0);
    return pbr
      ? new MeshStandardMaterial({ color: "#ffffff", map, metalness: 0.0, roughness: 0.72, envMapIntensity: 0.6, emissive, emissiveMap: decal })
      : new MeshPhongMaterial({ color: "#ffffff", map, specular: "#2a2218", shininess: 26, emissive, emissiveMap: decal });
  }, [map, decal, decalStrength, pbr]);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}
