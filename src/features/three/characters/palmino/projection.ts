import {
  DataTexture,
  DepthTexture,
  DoubleSide,
  Matrix4,
  MeshDepthMaterial,
  NearestFilter,
  PerspectiveCamera,
  RGBAFormat,
  SRGBColorSpace,
  Scene,
  TextureLoader,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type IUniform,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from "three";
import { BONE_NAMES, type BoneName } from "./geometry";

/**
 * "Projection-first fidelity" (img2threejs): il render ufficiale di Palmino, de-illuminato,
 * viene proiettato dalla camera del riferimento sulle superfici visibili da quella camera.
 *
 * - la proiezione usa la posizione di RIPOSO di ogni vertice (ossa rigide → matrici di riposo),
 *   quindi la texture resta incollata alla superficie durante le animazioni;
 * - visibilità: depth pre-pass una tantum dalla camera del riferimento (niente pixel delle foglie
 *   proiettati sul tronco dietro);
 * - "gating" cromatico: un pixel del riferimento viene usato solo se ha la stessa tinta del
 *   materiale procedurale sottostante (corteccia su corteccia, verde su foglia, giallo sui
 *   pantaloncini…); altrove resta il materiale procedurale. Così un piccolo disallineamento di
 *   posa non porta mai colori sbagliati;
 * - le superfici che la camera non vede (retro, fianchi) restano procedurali.
 */

export const REF_TEXTURE_URL = "/three/characters/palmino/palmino-ref.webp";
const REF_W = 1000;
const REF_H = 1080;

/** Camera del render di riferimento (risolta allineando silhouette e punti di riferimento). */
export function createReferenceCamera(): PerspectiveCamera {
  const cam = new PerspectiveCamera(30, REF_W / REF_H, 1.5, 6);
  cam.position.set(0, 0.9, 3.42);
  cam.lookAt(0, 0.845, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

/**
 * Correzione 2D per regione (il riferimento ha una posa leggermente asimmetrica): porta il centro
 * della regione nel nostro render (px) sul centro nel riferimento (px), con una scala.
 */
function regionXf(renX: number, renY: number, refX: number, refY: number, s: number): Vector4 {
  return new Vector4(s, s, (refX - s * renX) / REF_W, 1 - s + (s * renY - refY) / REF_H);
}

const IDENTITY = new Vector4(1, 1, 0, 0);
const HEAD_XF = regionXf(490, 357, 512, 348, 1.0);
const HIPS_XF = regionXf(481, 788, 509, 810, 0.86);
const SLEEVE_XF = regionXf(501, 600, 510, 618, 0.95);

function boneRegion(name: BoneName): Vector4 {
  switch (name) {
    case "hips":
      return HIPS_XF;
    case "sleeveLow":
    case "sleeveHigh":
      return SLEEVE_XF;
    case "footL":
      return regionXf(602, 1007, 593, 991, 1.0);
    case "footR":
      return regionXf(396, 1007, 411, 1003, 1.0);
    case "root":
      return IDENTITY;
    default:
      return HEAD_XF;
  }
}

export interface RefProjectionUniforms {
  uRefMap: IUniform<Texture>;
  uRefDepth: IUniform<Texture | null>;
  uRefViewProj: IUniform<Matrix4>;
  uRefCamPos: IUniform<Vector3>;
  uRefStrength: IUniform<number>;
  uRefGain: IUniform<number>;
  uRefGate: IUniform<number>;
  uRefBias: IUniform<number>;
  uRestBones: IUniform<Matrix4[]>;
  uRegion: IUniform<Vector4[]>;
  uCrownRest: IUniform<Matrix4>;
  uLeafRegion: IUniform<Vector4>;
}

const FRAGMENT_CHUNK = /* glsl */ `
{
  vec3 refNdc = vRefClip.xyz / vRefClip.w;
  vec2 refPuv = refNdc.xy * 0.5 + 0.5;
  float refInside = step(0.0, refPuv.x) * step(refPuv.x, 1.0) * step(0.0, refPuv.y) * step(refPuv.y, 1.0);
  float refVis = step(refNdc.z * 0.5 + 0.5, texture2D(uRefDepth, refPuv).r + uRefBias);
  vec2 refUv = refPuv * vRefRegion.xy + vRefRegion.zw;
  vec4 refC = texture2D(uRefMap, refUv);
  vec3 refA = diffuseColor.rgb;
  const vec3 refLumW = vec3(0.2126, 0.7152, 0.0722);
  vec3 refCa = refA / max(dot(refA, refLumW), 0.03);
  vec3 refCr = refC.rgb / max(dot(refC.rgb, refLumW), 0.03);
  float refD = length(refCa - refCr);
  float refGateW = exp(-refD * refD * uRefGate);
  // rifiuta anche i pixel molto più scuri/chiari del materiale (bordi di occhiali, ombre profonde)
  float refLumR = dot(refC.rgb, refLumW) / max(dot(refA, refLumW), 0.02);
  refGateW *= smoothstep(0.22, 0.5, refLumR) * (1.0 - smoothstep(2.2, 3.6, refLumR));
  float refW = clamp(vRefW, 0.0, 1.0) * refVis * refInside * refC.a * refGateW * uRefStrength;
  diffuseColor.rgb = mix(diffuseColor.rgb, refC.rgb * uRefGain, refW);
}
`;

const FRAGMENT_PARS = /* glsl */ `
uniform sampler2D uRefMap;
uniform sampler2D uRefDepth;
uniform float uRefStrength;
uniform float uRefGain;
uniform float uRefGate;
uniform float uRefBias;
varying vec4 vRefClip;
varying float vRefW;
varying vec4 vRefRegion;
`;

const VERTEX_PARS_COMMON = /* glsl */ `
uniform mat4 uRefViewProj;
uniform vec3 uRefCamPos;
varying vec4 vRefClip;
varying float vRefW;
varying vec4 vRefRegion;
`;

type ShaderLike = { uniforms: Record<string, IUniform>; vertexShader: string; fragmentShader: string };

function injectFragment(shader: ShaderLike) {
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${FRAGMENT_PARS}`)
    .replace("#include <color_fragment>", `#include <color_fragment>\n${FRAGMENT_CHUNK}`);
}

/** Corpo (SkinnedMesh rigido): posizione di riposo = matrice di riposo dell'osso del vertice. */
export function injectBodyProjection(shader: ShaderLike, u: RefProjectionUniforms) {
  Object.assign(shader.uniforms, u);
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>\n${VERTEX_PARS_COMMON}\nuniform mat4 uRestBones[${BONE_NAMES.length}];\nuniform vec4 uRegion[${BONE_NAMES.length}];\nattribute float refWeight;`,
    )
    .replace(
      "#include <project_vertex>",
      `#include <project_vertex>
{
  int refBone = int(skinIndex.x + 0.5);
  vec4 refRest = uRestBones[refBone] * vec4(position, 1.0);
  vec3 refN = normalize(mat3(uRestBones[refBone]) * normal);
  vRefClip = uRefViewProj * refRest;
  float refFacing = dot(refN, normalize(uRefCamPos - refRest.xyz));
  vRefW = refWeight * smoothstep(0.1, 0.45, refFacing);
  vRefRegion = uRegion[refBone];
}`,
    );
  injectFragment(shader);
}

/** Foglie (InstancedMesh): posizione di riposo = crown di riposo × matrice di riposo dell'istanza. */
export function injectLeafProjection(shader: ShaderLike, u: RefProjectionUniforms) {
  Object.assign(shader.uniforms, u);
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>\n${VERTEX_PARS_COMMON}\nuniform mat4 uCrownRest;\nuniform vec4 uLeafRegion;\nattribute vec4 aRest0;\nattribute vec4 aRest1;\nattribute vec4 aRest2;\nattribute vec4 aRest3;`,
    )
    .replace(
      "#include <project_vertex>",
      `#include <project_vertex>
{
  mat4 refInst = uCrownRest * mat4(aRest0, aRest1, aRest2, aRest3);
  vec4 refRest = refInst * vec4(position, 1.0);
  vec3 refN = normalize(mat3(refInst) * normal);
  vRefClip = uRefViewProj * refRest;
  float refFacing = abs(dot(refN, normalize(uRefCamPos - refRest.xyz)));
  // sulle foglie la sagoma differisce dal riferimento: solo un velo di proiezione (sfumature),
  // altrimenti i pixel non allineati "impastano" la chioma
  vRefW = 0.18 * smoothstep(0.08, 0.4, refFacing);
  vRefRegion = uLeafRegion;
}`,
    );
  injectFragment(shader);
}

export interface RefProjection {
  uniforms: RefProjectionUniforms;
  /** Esegue il depth pre-pass dalla camera del riferimento (oggetto in posa di riposo, in origine). */
  bake(gl: WebGLRenderer, object: Object3D, restBones: Matrix4[], crownRest: Matrix4): void;
  dispose(): void;
}

export function createRefProjection(lowPower: boolean): RefProjection {
  const cam = createReferenceCamera();
  const viewProj = new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const blank = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, RGBAFormat);
  blank.needsUpdate = true;
  const uniforms: RefProjectionUniforms = {
    uRefMap: { value: blank },
    uRefDepth: { value: null },
    uRefViewProj: { value: viewProj },
    uRefCamPos: { value: cam.position.clone() },
    uRefStrength: { value: 0 },
    uRefGain: { value: 0.9 },
    uRefGate: { value: 3.0 },
    uRefBias: { value: 0.004 },
    uRestBones: { value: BONE_NAMES.map(() => new Matrix4()) },
    uRegion: { value: BONE_NAMES.map((n) => boneRegion(n).clone()) },
    uCrownRest: { value: new Matrix4() },
    uLeafRegion: { value: HEAD_XF.clone() },
  };
  const size = lowPower ? 384 : 768;
  const target = new WebGLRenderTarget(size, Math.round((size * REF_H) / REF_W));
  target.depthTexture = new DepthTexture(target.width, target.height);
  target.depthTexture.minFilter = NearestFilter;
  target.depthTexture.magFilter = NearestFilter;

  let refTex: Texture | null = null;
  let disposed = false;
  new TextureLoader().load(REF_TEXTURE_URL, (tex) => {
    if (disposed) {
      tex.dispose();
      return;
    }
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    refTex = tex;
    uniforms.uRefMap.value = tex;
    uniforms.uRefStrength.value = 1;
  });

  return {
    uniforms,
    bake(gl, object, restBones, crownRest) {
      restBones.forEach((m, i) => uniforms.uRestBones.value[i].copy(m));
      uniforms.uCrownRest.value.copy(crownRest);
      const scene = new Scene();
      const parent = object.parent;
      scene.add(object);
      scene.overrideMaterial = new MeshDepthMaterial({ side: DoubleSide });
      const prevTarget = gl.getRenderTarget();
      gl.setRenderTarget(target);
      gl.clear();
      gl.render(scene, cam);
      gl.setRenderTarget(prevTarget);
      scene.overrideMaterial.dispose();
      scene.remove(object);
      if (parent) parent.add(object);
      uniforms.uRefDepth.value = target.depthTexture;
    },
    dispose() {
      disposed = true;
      target.dispose();
      target.depthTexture?.dispose();
      refTex?.dispose();
      blank.dispose();
    },
  };
}

