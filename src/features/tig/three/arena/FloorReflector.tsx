"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Color,
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
 * PAVIMENTO LUCIDO con riflesso vero ma economico (al posto di MeshReflectorMaterial, che ridisegnava tutta la scena
 * a ogni fotogramma): la camera riflessa disegna SOLO gli oggetti del livello REFLECT_LAYER (neon, LED, torri,
 * ologrammi: ciò che si vede nel riflesso di uno studio buio), a bassa risoluzione e ogni N fotogrammi. Il pavimento
 * è un MeshPhongMaterial (pozze di luce e riflessi lucidi delle luci vere, ambiente di studio diffuso: molto più
 * leggero di un PBR che riempie mezzo schermo) con il disegno del pavimento come emissivo (niente secondo strato
 * trasparente grande quanto lo schermo) e il riflesso aggiunto: sfocato con le mipmap, più forte di taglio (Fresnel),
 * increspato da un rumore leggero come una resina lucida. `?dbg=stdfloor` torna al PBR (per confronto).
 */

/** Livello three degli oggetti che si riflettono nel pavimento (la camera principale vede anche il livello 0). */
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

/** `decal`: disegno del pavimento come emissivo (già preparato: alfa premoltiplicata, ripetizione e scarto per il centro). */
export function useFloorMaterial({ scale, every, strength = 0.55, color = "#06080c", decal = null, pbr = false }: { scale: number; every: number; strength?: number; color?: string; decal?: Texture | null; pbr?: boolean }) {
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

  const material = useMemo(() => {
    const m = pbr
      ? new MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.32, envMapIntensity: 0.5, emissive: decal ? new Color(0.9, 0.9, 0.9) : new Color(0, 0, 0), emissiveMap: decal })
      : new MeshPhongMaterial({ color, specular: "#2a3240", shininess: 42, emissive: decal ? new Color(0.9, 0.9, 0.9) : new Color(0, 0, 0), emissiveMap: decal });
    if (!rt) return m;
    m.onBeforeCompile = (shader) => {
      shader.uniforms.tReflect = { value: rt.texture };
      shader.uniforms.uTexMatrix = { value: textureMatrix };
      shader.uniforms.uReflect = { value: strength };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform mat4 uTexMatrix;\nvarying vec4 vReflUv;\nvarying vec3 vWPos;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvec4 wp4 = modelMatrix * vec4(transformed, 1.0);\nvReflUv = uTexMatrix * wp4;\nvWPos = wp4.xyz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform sampler2D tReflect;\nuniform float uReflect;\nvarying vec4 vReflUv;\nvarying vec3 vWPos;\nfloat tigHash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }")
        .replace(
          "#include <opaque_fragment>",
          /* glsl */ `#include <opaque_fragment>
          {
            vec2 ruv = vReflUv.xy / vReflUv.w;
            // resina lucida: increspature lente e micro-rumore (il riflesso non è uno specchio)
            vec2 wob = vec2(sin(vWPos.x * 1.7 + vWPos.z * 0.6), cos(vWPos.z * 1.9 - vWPos.x * 0.4)) * 0.0035;
            float n = tigHash(floor(vWPos.xz * 40.0)) - 0.5;
            ruv += wob + n * 0.0018;
            vec3 vdir = normalize(cameraPosition - vWPos);
            float fres = 0.18 + 0.82 * pow(1.0 - clamp(vdir.y, 0.0, 1.0), 3.0);
            // sfocatura: più lontano dal pavimento = più sfocato (approssimata con la distanza dalla camera)
            float lod = clamp(1.2 + length(cameraPosition - vWPos) * 0.04, 1.2, 3.2);
            vec3 refl = textureLod(tReflect, ruv, lod).rgb * 0.55 + textureLod(tReflect, ruv, lod + 1.0).rgb * 0.45;
            gl_FragColor.rgb += refl * uReflect * fres;
          }`,
        );
    };
    m.customProgramCacheKey = () => (pbr ? "tig-floor-reflect-pbr" : "tig-floor-reflect");
    return m;
  }, [rt, textureMatrix, strength, color, decal, pbr]);
  useEffect(() => () => material.dispose(), [material]);

  const meshRef = useRef<Mesh>(null);
  const frame = useRef(0);
  const objRef = useRef({ rt, virtualCamera, textureMatrix });
  useEffect(() => {
    objRef.current = { rt, virtualCamera, textureMatrix };
  }, [rt, virtualCamera, textureMatrix]);

  // prima del disegno della scena (priorità 0.5: dopo regia e camera, prima di PostFx che disegna a priorità 1)
  useFrame((state) => {
    const { rt: target2, virtualCamera: vc, textureMatrix: tm } = objRef.current;
    const mesh = meshRef.current;
    if (!target2 || !mesh) return;
    frame.current += 1;
    if (frame.current % Math.max(1, every) !== 0) return;
    const camera = state.camera as PerspectiveCamera;
    // riflessione della camera rispetto al piano del pavimento (come three/examples Reflector)
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
    tm.multiply(mesh.matrixWorld);
    // piano obliquo: niente di quello che sta sotto il pavimento
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

  return { material, meshRef, reflective: !!rt };
}
