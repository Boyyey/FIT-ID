"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TextureLoader } from "three";

import type { AvatarMeasurements } from "@/lib/avatar-utils";
import { normalizeGarmentCategory } from "@/lib/avatar-utils";
import { fabricPackForGarment } from "@/lib/garment-fabrics";

export type GarmentInput = {
  category: string;
  colorHex: string;
  title?: string;
};

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Push vertices along `normal` after skinning / morph (see meshphysical_vert). */
const GARMENT_SHELL_DISPLACE = "transformed += normalize( normal ) * uGarmentNormalPush;";

function injectGarmentShellDisplace(shader: { vertexShader: string }) {
  if (!shader.vertexShader.includes(GARMENT_SHELL_DISPLACE)) {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <displacementmap_vertex>",
      `#include <displacementmap_vertex>
${GARMENT_SHELL_DISPLACE}`
    );
  }
}

/** Garment materials: only outward shell offset — coverage comes from triangle submeshes, not discard. */
function attachGarmentShellPushOnly(m: THREE.MeshLambertMaterial, normalPush: number) {
  m.clippingPlanes = null;
  m.customProgramCacheKey = () => `shell_${normalPush.toFixed(6)}`;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGarmentNormalPush = { value: normalPush };
    if (!shader.vertexShader.includes("uniform float uGarmentNormalPush")) {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
uniform float uGarmentNormalPush;`
      );
    }
    injectGarmentShellDisplace(shader);
  };
  m.needsUpdate = true;
}

type BodyBounds = { minY: number; maxY: number; maxAbsX: number };

type UpperFitCPU = {
  yMaxGeom: number;
  waistHemY: number;
  sleeveLongY: number;
  sleeveShortY: number;
  bodyMinY: number;
  bodyMaxY: number;
  maxAbsX: number;
  longSleeve: number;
};

const REAL_GARMENT_URLS = {
  pants: "/models/garments/pants.obj",
  tshirts: "/models/garments/tshirt.obj",
  shirts: "/models/garments/shirt/GLTF/Shirt%20Long%20Sleeves.gltf",
  jackets: "/models/garments/jacket.fbx"
} as const;

/** Remove NaN / Infinity from position attributes so Box3 won't crash. */
function sanitizeGeometryNaN(obj: THREE.Object3D) {
  obj.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos || !pos.array) return;
    const arr = pos.array as Float32Array;
    let dirty = false;
    for (let i = 0; i < arr.length; i++) {
      if (!Number.isFinite(arr[i]!)) {
        arr[i] = 0;
        dirty = true;
      }
    }
    if (dirty) {
      pos.needsUpdate = true;
      mesh.geometry.computeBoundingBox();
      mesh.geometry.computeBoundingSphere();
    }
  });
}

/** Check whether an Object3D contains any mesh with actual triangular geometry. */
function hasValidMeshGeometry(obj: THREE.Object3D): boolean {
  let ok = false;
  obj.traverse((n) => {
    if (ok) return;
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!pos || !pos.array || pos.array.length < 9) return; // at least 1 triangle
    const index = mesh.geometry.index;
    const hasFaces = index ? index.count >= 3 : (pos.count >= 3);
    if (hasFaces) ok = true;
  });
  return ok;
}

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _centroid = new THREE.Vector3();

/**
 * Keep triangles whole using centroid + corner tests (same rules as old fragment shader).
 * Fingers: drop a triangle if any corner sits in the hand/finger band (stricter than centroid-only).
 */
function upperTriangleKept(p: UpperFitCPU, centroid: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): boolean {
  const bodyH = Math.max(1e-6, p.bodyMaxY - p.bodyMinY);
  const my = centroid.y;
  const mx = centroid.x;
  const y01 = (my - p.bodyMinY) / bodyH;
  const lat = Math.abs(mx) / Math.max(p.maxAbsX, 1e-4);
  const armBand = smoothstep(0.32, 0.54, lat);
  const armHeight = smoothstep(0.36, 0.52, y01) * (1 - smoothstep(0.74, 0.9, y01));
  const armWeight = armBand * armHeight;
  const sleeveEndY = p.longSleeve > 0.5 ? p.sleeveLongY : p.sleeveShortY;
  const hemLow = THREE.MathUtils.lerp(p.waistHemY, sleeveEndY, armWeight);
  if (my < hemLow || my > p.yMaxGeom) return false;

  const corners = [a, b, c];
  for (let i = 0; i < 3; i++) {
    const v = corners[i]!;
    const y01v = (v.y - p.bodyMinY) / bodyH;
    const latv = Math.abs(v.x) / Math.max(p.maxAbsX, 1e-4);
    const finger =
      smoothstep(0.38, 0.62, latv) * smoothstep(0.32, 0.50, y01v) * (1 - smoothstep(0.56, 0.70, y01v));
    if (finger > 0.48) return false;
  }
  return true;
}

function pantsTriangleKept(
  body: BodyBounds,
  ankleY: number,
  pantTopY: number,
  centroid: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3
): boolean {
  const my = centroid.y;
  if (my < ankleY || my > pantTopY) return false;
  const bodyH = Math.max(1e-6, body.maxY - body.minY);
  const y01p = (my - body.minY) / bodyH;
  const latp = Math.abs(centroid.x) / Math.max(body.maxAbsX, 1e-4);
  const pantOnHands = smoothstep(0.32, 0.48, y01p) * smoothstep(0.48, 0.74, latp);
  if (pantOnHands > 0.76) return false;

  for (const v of [a, b, c]) {
    const y01v = (v.y - body.minY) / bodyH;
    const latv = Math.abs(v.x) / Math.max(body.maxAbsX, 1e-4);
    const hand = smoothstep(0.34, 0.50, y01v) * smoothstep(0.52, 0.76, latv);
    if (hand > 0.72) return false;
  }
  return true;
}

function buildTriangleSubmesh(
  sourceGeom: THREE.BufferGeometry,
  keep: (centroid: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => boolean
): THREE.BufferGeometry | null {
  const posAttr = sourceGeom.getAttribute("position") as THREE.BufferAttribute;
  const positions = posAttr.array as Float32Array;
  const normAttr = sourceGeom.getAttribute("normal") as THREE.BufferAttribute | undefined;
  const normals = normAttr && normAttr.array ? (normAttr.array as Float32Array) : null;
  const index = sourceGeom.index;

  const map = new Map<number, number>();
  const newPos: number[] = [];
  const newNorm: number[] = [];
  const newIdx: number[] = [];

  const mapVert = (oldIx: number): number => {
    let ni = map.get(oldIx);
    if (ni === undefined) {
      ni = newPos.length / 3;
      map.set(oldIx, ni);
      const o = oldIx * 3;
      newPos.push(positions[o]!, positions[o + 1]!, positions[o + 2]!);
      if (normals && o + 2 < normals.length) {
        newNorm.push(normals[o]!, normals[o + 1]!, normals[o + 2]!);
      } else {
        newNorm.push(0, 0, 1);
      }
    }
    return ni;
  };

  const proc = (ia: number, ib: number, ic: number) => {
    _vA.fromArray(positions, ia * 3);
    _vB.fromArray(positions, ib * 3);
    _vC.fromArray(positions, ic * 3);
    _centroid.copy(_vA).add(_vB).add(_vC).multiplyScalar(1 / 3);
    if (!keep(_centroid, _vA, _vB, _vC)) return;
    newIdx.push(mapVert(ia), mapVert(ib), mapVert(ic));
  };

  if (index) {
    for (let f = 0; f < index.count; f += 3) {
      proc(index.getX(f), index.getX(f + 1), index.getX(f + 2));
    }
  } else {
    const n = positions.length / 3;
    for (let f = 0; f < n; f += 3) {
      proc(f, f + 1, f + 2);
    }
  }

  if (newIdx.length === 0) return null;

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(newPos), 3));
  out.setIndex(newIdx);
  if (normals && newNorm.length === newPos.length) {
    out.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(newNorm), 3));
    out.normalizeNormals();
  } else {
    out.computeVertexNormals();
  }
  return out;
}

/**
 * Loads a real human base mesh (OBJ) and applies a simple scan-driven deformation:
 * widen/narrow XZ around chest/waist/hips using smooth vertical bands.
 *
 * Garment coverage uses extracted triangle submeshes (no per-fragment discard).
 */
export function HumanObjAvatar({
  url,
  measurements,
  skinHex,
  garment
}: {
  url: string;
  measurements: AvatarMeasurements;
  skinHex: string;
  garment?: GarmentInput | null;
}) {
  const obj = useLoader(OBJLoader, url);
  const mesh = useMemo<THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> | null>(() => {
    let found: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]> | null = null;
    obj.traverse((c) => {
      if (found) return;
      const m = c as unknown as THREE.Mesh;
      if (m && (m as any).isMesh && (m as any).geometry) {
        found = m as unknown as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
      }
    });
    return found;
  }, [obj]);

  const [geom, setGeom] = useState<THREE.BufferGeometry | null>(null);
  const basePosRef = useRef<Float32Array | null>(null);
  const baseYBoundsRef = useRef<{ minY: number; maxY: number; maxAbsX: number } | null>(null);
  const [bounds, setBounds] = useState<{ minY: number; maxY: number; maxAbsX: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [upperGarmentGeom, setUpperGarmentGeom] = useState<THREE.BufferGeometry | null>(null);
  const [lowerGarmentGeom, setLowerGarmentGeom] = useState<THREE.BufferGeometry | null>(null);
  const upperGeomUnmountRef = useRef<THREE.BufferGeometry | null>(null);
  const lowerGeomUnmountRef = useRef<THREE.BufferGeometry | null>(null);
  const selectedFabricPack = useMemo(
    () => fabricPackForGarment(garment?.category ?? "shirts"),
    [garment?.category]
  );
  const fabricTextures = useLoader(TextureLoader, [
    selectedFabricPack.color,
    selectedFabricPack.normal,
    selectedFabricPack.roughness,
    selectedFabricPack.displacement
  ]) as THREE.Texture[];

  const garmentMat = useMemo(() => {
    if (!garment) return null;
    const pack = selectedFabricPack;
    const [colorMap, normalMap, roughnessMap, displacementMap] = fabricTextures;
    if (!colorMap || !normalMap || !roughnessMap || !displacementMap) return null;
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.RepeatWrapping;
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    displacementMap.wrapS = THREE.RepeatWrapping;
    displacementMap.wrapT = THREE.RepeatWrapping;
    colorMap.repeat.set(5, 5);
    normalMap.repeat.set(5, 5);
    roughnessMap.repeat.set(5, 5);
    displacementMap.repeat.set(5, 5);
    colorMap.anisotropy = 4;
    normalMap.anisotropy = 4;
    roughnessMap.anisotropy = 4;
    displacementMap.anisotropy = 4;
    const m = new THREE.MeshLambertMaterial({
      color: new THREE.Color(garment.colorHex),
      map: colorMap,
      normalMap,
      bumpMap: displacementMap,
      bumpScale: 0.015,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x000000)
    });
    m.userData.fabricPack = pack.key;
    m.needsUpdate = true;
    return m;
  }, [garment, fabricTextures, selectedFabricPack]);

  // Real garment modules supplied by user archives.
  const pantsObj = useLoader(OBJLoader, REAL_GARMENT_URLS.pants);
  const tshirtObj = useLoader(OBJLoader, REAL_GARMENT_URLS.tshirts);
  const shirtGltf = useLoader(GLTFLoader, REAL_GARMENT_URLS.shirts);
  const jacketFbx = useLoader(FBXLoader, REAL_GARMENT_URLS.jackets);

  useEffect(() => {
    if (!mesh) return;
    const g = (mesh.geometry as THREE.BufferGeometry).clone();
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    const t = window.setTimeout(() => setGeom(g), 0);
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    basePosRef.current = new Float32Array(pos.array as Float32Array);
    const bb = g.boundingBox!;
    const maxAbsX = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x), 1e-3);
    baseYBoundsRef.current = { minY: bb.min.y, maxY: bb.max.y, maxAbsX };
    const t3 = window.setTimeout(() => setBounds({ minY: bb.min.y, maxY: bb.max.y, maxAbsX }), 0);
    const baseH = Math.max(1e-3, bb.max.y - bb.min.y);
    const Hm = Math.max(1.45, Math.min(2.15, measurements.height_cm / 100));
    const t2 = window.setTimeout(() => setScale(Hm / baseH), 0);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [mesh, measurements.height_cm]);

  useEffect(() => {
    const g = geom;
    const base = basePosRef.current;
    const bounds = baseYBoundsRef.current;
    if (!g || !base || !bounds) return;
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;

    const chestR = Math.max(0.09, Math.min(0.19, measurements.chest_cm / (2 * Math.PI) / 100));
    const waistR = Math.max(0.08, Math.min(0.18, measurements.waist_cm / (2 * Math.PI) / 100));
    const hipR = Math.max(0.10, Math.min(0.20, measurements.hip_cm / (2 * Math.PI) / 100));

    const maxAbsX = Math.max(bounds.maxAbsX, 1e-3);
    const REF = { chest: 0.155, waist: 0.135, hip: 0.165, shoulderHalf: 0.205 };
    const SHAPE = 1.28;
    const clampRatio = (v: number) => THREE.MathUtils.clamp(v, 0.72, 1.38);
    let chestMul = 1 + (clampRatio(chestR / REF.chest) - 1) * SHAPE;
    let waistMul = 1 + (clampRatio(waistR / REF.waist) - 1) * SHAPE;
    let hipMul = 1 + (clampRatio(hipR / REF.hip) - 1) * SHAPE;

    const hM = Math.max(1.45, Math.min(2.15, measurements.height_cm / 100));
    const bmi = measurements.weight_kg / Math.max(hM * hM, 1e-6);
    const bmiDelta = THREE.MathUtils.clamp(bmi - 23, -12, 26);
    const weightBulk = THREE.MathUtils.clamp(1 + bmiDelta * 0.017, 0.94, 1.22);
    const whRatio = measurements.waist_cm / Math.max(measurements.height_cm, 1);
    const bellyBoost = THREE.MathUtils.clamp(1 + (whRatio - 0.455) * 1.35, 0.92, 1.22);

    waistMul *= bellyBoost * Math.pow(weightBulk, 0.78);
    hipMul *= Math.pow(weightBulk, 0.68);

    const sc = measurements.avatar_model?.scale;
    const sTorso = typeof sc?.torso === "number" && Number.isFinite(sc.torso) ? sc.torso : 1;
    const sHips = typeof sc?.hips === "number" && Number.isFinite(sc.hips) ? sc.hips : 1;
    const sShoulders = typeof sc?.shoulders === "number" && Number.isFinite(sc.shoulders) ? sc.shoulders : 1;
    chestMul *= Math.pow(Math.max(0.88, Math.min(1.25, sTorso)), 1.02);
    waistMul *= Math.pow(Math.max(0.88, Math.min(1.25, sTorso)), 1.0);
    hipMul *= Math.pow(Math.max(0.88, Math.min(1.25, sHips)), 1.02);

    const shoulderHalfM = (measurements.shoulder_width_cm / 100) * 0.5;
    const shoulderMul =
      THREE.MathUtils.clamp(shoulderHalfM / REF.shoulderHalf, 0.82, 1.28) *
      Math.pow(Math.max(0.88, Math.min(1.25, sShoulders)), 0.9);

    for (let i = 0; i < arr.length; i += 3) {
      const bx = base[i + 0] ?? 0;
      const by = base[i + 1] ?? 0;
      const bz = base[i + 2] ?? 0;

      const y01 = (by - bounds.minY) / Math.max(1e-6, bounds.maxY - bounds.minY);
      const xNorm = Math.abs(bx) / maxAbsX;
      const torsoMask = 1 - smoothstep(0.28, 0.5, xNorm);

      const wChest = smoothstep(0.52, 0.7, y01) * (1 - smoothstep(0.74, 0.82, y01)) * torsoMask;
      const wWaist = smoothstep(0.42, 0.52, y01) * (1 - smoothstep(0.56, 0.64, y01)) * torsoMask;
      const wHip = smoothstep(0.3, 0.42, y01) * (1 - smoothstep(0.46, 0.54, y01)) * torsoMask;
      const wBelly = smoothstep(0.38, 0.47, y01) * (1 - smoothstep(0.52, 0.58, y01)) * torsoMask;
      const wShoulder =
        smoothstep(0.53, 0.63, y01) *
        (1 - smoothstep(0.72, 0.8, y01)) *
        torsoMask *
        smoothstep(0.2, 0.4, xNorm) *
        (1 - smoothstep(0.48, 0.62, xNorm));
      const wThigh = smoothstep(0.12, 0.28, y01) * (1 - smoothstep(0.36, 0.46, y01));

      let mul = 1;
      mul += (chestMul - 1) * wChest;
      mul += (waistMul - 1) * wWaist;
      mul += (hipMul - 1) * wHip;
      mul += (shoulderMul - 1) * wShoulder;
      mul += ((weightBulk - 1) * 0.45 + (bellyBoost - 1) * 0.4) * wBelly;
      mul += ((hipMul - 1) * 0.38 + (weightBulk - 1) * 0.4) * wThigh;
      mul = THREE.MathUtils.clamp(mul, 0.78, 1.32);

      const limbOut = smoothstep(0.36, 0.72, xNorm);
      const upperLimbY = smoothstep(0.45, 0.58, y01) * (1 - smoothstep(0.75, 0.9, y01));
      const limbBlend = THREE.MathUtils.clamp(limbOut * (0.65 + 0.35 * upperLimbY), 0, 1);
      mul = THREE.MathUtils.lerp(mul, 1, limbBlend * 0.78);

      arr[i + 0] = bx * mul;
      arr[i + 1] = by;
      const armMask = smoothstep(0.55, 0.84, xNorm);
      arr[i + 2] = bz * (mul * (1 - armMask * 0.12));
    }

    pos.needsUpdate = true;
    g.computeVertexNormals();
  }, [geom, measurements]);

  const cat = garment ? normalizeGarmentCategory(garment.category) : "";
  const showUpper = garment && ["tshirts", "shirts", "hoodies", "jackets", "formal"].includes(cat);
  const showLower = garment && cat === "pants";
  const useRealGarment = false; // procedural fabric system only — real garment files are missing/broken

  /** Nudge skin slightly deeper in the depth buffer where a shell is drawn — reduces z-fighting speckle. */
  const clothingDepthSplit = Boolean(garment && (showUpper || showLower));

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(skinHex),
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0,
      polygonOffset: clothingDepthSplit,
      polygonOffsetFactor: clothingDepthSplit ? 6 : 0,
      polygonOffsetUnits: clothingDepthSplit ? 4 : 0
    });
  }, [skinHex, clothingDepthSplit]);

  const garmentLayout = useMemo(() => {
    if (!bounds) return null;
    const h = bounds.maxY - bounds.minY;
    const minY = bounds.minY;
    const overlap = h * 0.004;
    const junctionY = minY + h * 0.542;
    /** Hem at ankles — stops at ankle joint, not covering feet. */
    const ankleY = minY + h * 0.035;
    const catNorm = garment ? normalizeGarmentCategory(garment.category) : "";

    let upperTopY = minY + h * 0.872;
    if (catNorm === "shirts") {
      /** Dress / button-up: coverage up to the neck for a normal collar line. */
      upperTopY = minY + h * 0.912;
    }

    const sleeveLongY = minY + h * 0.38;

    let sleeveShortY = minY + h * 0.566;
    if (catNorm === "tshirts") {
      /** Tee: short sleeve hem on the bicep. */
      sleeveShortY = minY + h * 0.66;
    }

    return {
      h,
      minY,
      maxY: bounds.maxY,
      maxAbsX: bounds.maxAbsX,
      junctionY,
      pants: { yMin: ankleY, yMax: junctionY + overlap },
      upper: {
        waistHemY: junctionY - overlap,
        yMaxGeom: upperTopY,
        sleeveLongY,
        sleeveShortY
      }
    };
  }, [bounds, garment]);

  /** ~1.2–2.7 cm in mesh space on a ~1.7 m figure — separates shell from skin (avoids z-fighting). */
  const garmentShellPush = useMemo(() => {
    if (!bounds) return 0.02;
    const h = bounds.maxY - bounds.minY;
    return THREE.MathUtils.clamp(h * 0.016, 0.018, 0.042);
  }, [bounds]);

  /** Extra radial separation on garment-only meshes (multiplies with normal push in shader). */
  const garmentMeshUniformScale = 1.022;

  const upperFit = useMemo(() => {
    if (!garmentLayout || !showUpper) return null;
    const longSleeve = cat === "tshirts" ? 0 : 1;
    return { ...garmentLayout.upper, longSleeve };
  }, [garmentLayout, showUpper, cat]);

  const lowerYB = useMemo(() => {
    if (!garmentLayout || !showLower) return null;
    return garmentLayout.pants;
  }, [garmentLayout, showLower]);

  const realGarmentObject = useMemo(() => {
    if (!useRealGarment || !garmentMat) return null;
    let src: THREE.Object3D | null = null;
    if (cat === "pants") src = pantsObj;
    else if (cat === "tshirts") src = tshirtObj;
    else if (cat === "shirts") src = shirtGltf.scene;
    else if (cat === "jackets") src = jacketFbx;
    if (!src) return null;
    const obj = src.clone(true);
    obj.traverse((n) => {
      const m = n as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = garmentMat.clone();
      m.castShadow = false;
      m.receiveShadow = false;
    });
    sanitizeGeometryNaN(obj);
    if (!hasValidMeshGeometry(obj)) return null;
    return obj;
  }, [useRealGarment, garmentMat, cat, pantsObj, tshirtObj, shirtGltf.scene, jacketFbx]);

  const realGarmentTransform = useMemo(() => {
    if (!realGarmentObject || !garmentLayout) return null;
    let box: THREE.Box3;
    try {
      box = new THREE.Box3().setFromObject(realGarmentObject);
    } catch {
      return null;
    }
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || !Number.isFinite(size.z)) return null;
    if (size.x < 1e-6 || size.y < 1e-6 || size.z < 1e-6) return null;

    if (cat === "pants") {
      const targetYMin = garmentLayout.pants.yMin;
      const targetYMax = garmentLayout.pants.yMax;
      const targetH = Math.max(1e-4, targetYMax - targetYMin);
      const targetW = (measurements.hip_cm / 100 / Math.PI) * 1.1;
      const sy = targetH / size.y;
      const sx = targetW / Math.max(size.x, 1e-4);
      const sz = (targetW * 0.82) / Math.max(size.z, 1e-4);
      return {
        position: [-center.x * sx, targetYMin - box.min.y * sy, -center.z * sz] as [number, number, number],
        scale: [sx, sy, sz] as [number, number, number]
      };
    }

    const targetYMin = garmentLayout.upper.waistHemY;
    const targetYMax = garmentLayout.upper.yMaxGeom;
    const targetH = Math.max(1e-4, targetYMax - targetYMin);
    const targetW = (measurements.chest_cm / 100 / Math.PI) * 1.1;
    const sy = targetH / size.y;
    const sx = targetW / Math.max(size.x, 1e-4);
    const sz = (targetW * 0.8) / Math.max(size.z, 1e-4);
    return {
      position: [-center.x * sx, targetYMin - box.min.y * sy, -center.z * sz] as [number, number, number],
      scale: [sx, sy, sz] as [number, number, number]
    };
  }, [realGarmentObject, garmentLayout, cat, measurements.hip_cm, measurements.chest_cm]);

  const upperMat = useMemo(() => {
    if (!garmentMat) return null;
    const m = garmentMat.clone();
    attachGarmentShellPushOnly(m, garmentShellPush);
    m.clipIntersection = false;
    m.clipShadows = false;
    m.depthTest = true;
    m.depthWrite = true;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -5;
    m.polygonOffsetUnits = -4;
    return m;
  }, [garmentMat, garmentShellPush]);

  const lowerMat = useMemo(() => {
    if (!garmentMat) return null;
    const m = garmentMat.clone();
    attachGarmentShellPushOnly(m, garmentShellPush);
    m.clipIntersection = false;
    m.clipShadows = false;
    m.depthTest = true;
    m.depthWrite = true;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -5;
    m.polygonOffsetUnits = -4;
    return m;
  }, [garmentMat, garmentShellPush]);

  useEffect(() => {
    if (!geom || !bounds || !garmentLayout) {
      setUpperGarmentGeom((prev) => {
        prev?.dispose();
        upperGeomUnmountRef.current = null;
        return null;
      });
      setLowerGarmentGeom((prev) => {
        prev?.dispose();
        lowerGeomUnmountRef.current = null;
        return null;
      });
      return;
    }

    if (useRealGarment && realGarmentObject) {
      setUpperGarmentGeom((prev) => {
        prev?.dispose();
        return null;
      });
      setLowerGarmentGeom((prev) => {
        prev?.dispose();
        return null;
      });
      upperGeomUnmountRef.current = null;
      lowerGeomUnmountRef.current = null;
      return;
    }

    let nextUpper: THREE.BufferGeometry | null = null;
    let nextLower: THREE.BufferGeometry | null = null;

    if (showUpper && upperFit) {
      const p: UpperFitCPU = {
        yMaxGeom: upperFit.yMaxGeom,
        waistHemY: upperFit.waistHemY,
        sleeveLongY: upperFit.sleeveLongY,
        sleeveShortY: upperFit.sleeveShortY,
        bodyMinY: garmentLayout.minY,
        bodyMaxY: garmentLayout.maxY,
        maxAbsX: garmentLayout.maxAbsX,
        longSleeve: upperFit.longSleeve
      };
      nextUpper = buildTriangleSubmesh(geom, (cent, a, b, c) => upperTriangleKept(p, cent, a, b, c));
    }

    if (showLower && lowerYB) {
      const body: BodyBounds = {
        minY: garmentLayout.minY,
        maxY: garmentLayout.maxY,
        maxAbsX: garmentLayout.maxAbsX
      };
      nextLower = buildTriangleSubmesh(geom, (cent, a, b, c) =>
        pantsTriangleKept(body, lowerYB.yMin, lowerYB.yMax, cent, a, b, c)
      );
    }

    setUpperGarmentGeom((prev) => {
      prev?.dispose();
      return nextUpper;
    });
    setLowerGarmentGeom((prev) => {
      prev?.dispose();
      return nextLower;
    });
    upperGeomUnmountRef.current = nextUpper;
    lowerGeomUnmountRef.current = nextLower;
  }, [geom, measurements, garment, showUpper, showLower, garmentLayout, upperFit, lowerYB, bounds, useRealGarment, realGarmentObject]);

  useEffect(() => {
    return () => {
      upperGeomUnmountRef.current?.dispose();
      lowerGeomUnmountRef.current?.dispose();
      upperGeomUnmountRef.current = null;
      lowerGeomUnmountRef.current = null;
    };
  }, []);

  if (!mesh || !geom || !bounds) return null;

  return (
    <group scale={[scale, scale, scale]}>
      <mesh geometry={geom} material={material} renderOrder={0} />
      {useRealGarment && realGarmentObject && realGarmentTransform && (
        <group position={realGarmentTransform.position} scale={realGarmentTransform.scale} renderOrder={4}>
          <primitive object={realGarmentObject} />
        </group>
      )}
      {!(useRealGarment && realGarmentObject && realGarmentTransform) && upperGarmentGeom && upperMat && showUpper && (
        <mesh
          geometry={upperGarmentGeom}
          material={upperMat}
          scale={[garmentMeshUniformScale, garmentMeshUniformScale, garmentMeshUniformScale]}
          renderOrder={4}
        />
      )}
      {!(useRealGarment && realGarmentObject && realGarmentTransform) && lowerGarmentGeom && lowerMat && showLower && (
        <mesh
          geometry={lowerGarmentGeom}
          material={lowerMat}
          scale={[garmentMeshUniformScale, garmentMeshUniformScale, garmentMeshUniformScale]}
          renderOrder={4}
        />
      )}
    </group>
  );
}
