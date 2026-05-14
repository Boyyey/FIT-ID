"use client";

import React, { useMemo } from "react";
import * as THREE from "three";

import type { AvatarMeasurements } from "@/lib/avatar-utils";
import { normalizeGarmentCategory } from "@/lib/avatar-utils";

export type GarmentInput = {
  category: string;
  colorHex: string;
  title?: string;
};

function CapsuleLimb({
  y0,
  y1,
  radius,
  x,
  z,
  rx = 0,
  ry = 0,
  rz = 0,
  color
}: {
  y0: number;
  y1: number;
  radius: number;
  x: number;
  z: number;
  rx?: number;
  ry?: number;
  rz?: number;
  color: string;
}) {
  const h = Math.max(0.02, y1 - y0);
  const y = y0 + h / 2;
  return (
    <mesh position={[x, y, z]} rotation={[rx, ry, rz]}>
      <capsuleGeometry args={[radius, h, 10, 18]} />
      <meshStandardMaterial color={color} roughness={0.65} metalness={0.05} />
    </mesh>
  );
}

function BoneCapsule({
  a,
  b,
  radius,
  color,
  renderOrder,
  materialOverride
}: {
  a: [number, number, number];
  b: [number, number, number];
  radius: number;
  color: string;
  renderOrder?: number;
  materialOverride?: React.ReactNode;
}) {
  const [pos, quat, len] = useMemo(() => {
    const va = new THREE.Vector3(a[0], a[1], a[2]);
    const vb = new THREE.Vector3(b[0], b[1], b[2]);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const dir = vb.clone().sub(va);
    const length = Math.max(0.02, dir.length());
    dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return [[mid.x, mid.y, mid.z] as [number, number, number], [q.x, q.y, q.z, q.w] as [number, number, number, number], length];
  }, [a, b]);

  return (
    <mesh position={pos} quaternion={quat as unknown as THREE.Quaternion} renderOrder={renderOrder}>
      <capsuleGeometry args={[radius, len, 10, 18]} />
      {materialOverride ?? <meshStandardMaterial color={color} roughness={0.65} metalness={0.05} />}
    </mesh>
  );
}

export function ParametricBody({
  measurements,
  skinHex,
  garment
}: {
  measurements: AvatarMeasurements;
  skinHex: string;
  garment?: GarmentInput | null;
}) {
  const g = useMemo(() => {
    const H = Math.max(1.45, Math.min(2.15, measurements.height_cm / 100));
    const s = measurements.avatar_model?.scale ?? {};
    const sShoulder = typeof s.shoulders === "number" ? Math.max(0.75, Math.min(1.35, s.shoulders)) : 1;
    const sTorso = typeof s.torso === "number" ? Math.max(0.75, Math.min(1.35, s.torso)) : 1;
    const sHip = typeof s.hips === "number" ? Math.max(0.75, Math.min(1.35, s.hips)) : 1;

    const inseamM = Math.max(0.55, Math.min(1.15, measurements.inseam_cm / 100));
    const lowerLeg = inseamM * 0.48;
    const upperLeg = inseamM * 0.52;
    const footH = 0.035 * (H / 1.75);

    const yAnkle = footH;
    const yKnee = yAnkle + lowerLeg;
    const yHip = yKnee + upperLeg;

    const pelvisH = 0.11 * sHip * (H / 1.75);
    const yTorso0 = yHip + pelvisH * 0.35;
    const torsoLen = Math.max(0.35, Math.min(0.65, (measurements.torso_length_cm / 100) * sTorso));

    // Use HALF-widths for positioning, and keep radii conservative so the avatar doesn't look comically large.
    const shoulderHalf = Math.max(0.16, Math.min(0.32, (measurements.shoulder_width_cm / 100) * sShoulder * 0.5));
    const chestR = Math.max(0.09, Math.min(0.19, measurements.chest_cm / (2 * Math.PI) / 100));
    const waistR = Math.max(0.08, Math.min(0.18, measurements.waist_cm / (2 * Math.PI) / 100));
    const hipR = Math.max(0.10, Math.min(0.20, measurements.hip_cm / (2 * Math.PI) / 100));

    const yChest = yTorso0 + torsoLen * 0.58;
    const yShoulder = yTorso0 + torsoLen;
    const neckH = H * 0.032;
    const headR = H * 0.062;

    const legX = hipR * 0.85;
    const thighR = hipR * 0.72;
    const calfR = thighR * 0.78;

    const armLen = H * 0.36;
    const upperArm = armLen * 0.48;
    const lowerArm = armLen * 0.52;
    const armR = Math.max(0.028, chestR * 0.32);
    const shoulderY = yShoulder - neckH * 0.2;

    const cat = garment ? normalizeGarmentCategory(garment.category) : "";
    const hasUpperGarment =
      garment && ["tshirts", "shirts", "hoodies", "jackets", "formal"].includes(cat);
    const hasLowerGarment = garment && cat === "pants";
    const bulk = cat === "jackets" || cat === "formal" || cat === "hoodies" ? 1.14 : 1.06;

    return {
      H,
      skinHex,
      yAnkle,
      yKnee,
      yHip,
      yTorso0,
      torsoLen,
      shoulderHalf,
      chestR,
      waistR,
      hipR,
      yChest,
      yShoulder,
      neckH,
      headR,
      legX,
      thighR,
      calfR,
      lowerLeg,
      upperLeg,
      footH,
      upperArm,
      lowerArm,
      armR,
      shoulderY,
      garment,
      hasUpperGarment,
      hasLowerGarment,
      bulk
    };
  }, [measurements, skinHex, garment]);

  const matSkin = useMemo(
    () => ({
      color: g.skinHex,
      roughness: 0.72,
      metalness: 0.02
    }),
    [g.skinHex]
  );

  const garmentMat = useMemo(() => {
    if (!g.garment) return null;
    return {
      color: g.garment.colorHex,
      roughness: 0.55,
      metalness: 0.08,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide
    } as const;
  }, [g.garment]);

  return (
    <group>
      {/* Floor disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[g.H * 1.8, 48]} />
        <meshStandardMaterial color="#151d2c" roughness={0.9} />
      </mesh>

      {/* Feet */}
      <mesh position={[-g.legX * 0.9, g.footH * 0.45, 0.02]}>
        <boxGeometry args={[g.hipR * 0.55, g.footH, g.hipR * 0.85]} />
        <meshStandardMaterial {...matSkin} />
      </mesh>
      <mesh position={[g.legX * 0.9, g.footH * 0.45, 0.02]}>
        <boxGeometry args={[g.hipR * 0.55, g.footH, g.hipR * 0.85]} />
        <meshStandardMaterial {...matSkin} />
      </mesh>

      {/* Legs */}
      <CapsuleLimb y0={g.yAnkle} y1={g.yKnee} radius={g.calfR} x={-g.legX} z={0} color={g.skinHex} />
      <CapsuleLimb y0={g.yAnkle} y1={g.yKnee} radius={g.calfR} x={g.legX} z={0} color={g.skinHex} />
      <CapsuleLimb y0={g.yKnee} y1={g.yHip} radius={g.thighR} x={-g.legX} z={0} color={g.skinHex} />
      <CapsuleLimb y0={g.yKnee} y1={g.yHip} radius={g.thighR} x={g.legX} z={0} color={g.skinHex} />

      {/* Pants overlay */}
      {g.hasLowerGarment && garmentMat && (
        <>
          <CapsuleLimb
            y0={g.yAnkle}
            y1={g.yKnee}
            radius={g.calfR * 1.12}
            x={-g.legX}
            z={0}
            color={g.garment!.colorHex}
          />
          <CapsuleLimb
            y0={g.yAnkle}
            y1={g.yKnee}
            radius={g.calfR * 1.12}
            x={g.legX}
            z={0}
            color={g.garment!.colorHex}
          />
          <CapsuleLimb
            y0={g.yKnee}
            y1={g.yHip}
            radius={g.thighR * 1.1}
            x={-g.legX}
            z={0}
            color={g.garment!.colorHex}
          />
          <CapsuleLimb
            y0={g.yKnee}
            y1={g.yHip}
            radius={g.thighR * 1.1}
            x={g.legX}
            z={0}
            color={g.garment!.colorHex}
          />
        </>
      )}

      {/* Pelvis */}
      <mesh position={[0, g.yHip + g.hipR * 0.35, 0]}>
        <capsuleGeometry args={[g.hipR * 0.92, g.hipR * 0.7, 10, 18]} />
        <meshStandardMaterial {...matSkin} />
      </mesh>

      {/* Torso (tapered stack) */}
      <mesh position={[0, g.yTorso0 + g.torsoLen * 0.38, 0]}>
        <capsuleGeometry args={[g.chestR * 0.92, g.torsoLen * 0.9, 10, 18]} />
        <meshStandardMaterial {...matSkin} />
      </mesh>
      <mesh position={[0, g.yTorso0 + g.torsoLen * 0.1, 0]}>
        <capsuleGeometry args={[g.waistR * 0.96, g.torsoLen * 0.35, 10, 18]} />
        <meshStandardMaterial {...matSkin} />
      </mesh>

      {/* Upper garment shell */}
      {g.hasUpperGarment && garmentMat && (
        <mesh position={[0, g.yChest, g.chestR * 0.08]} renderOrder={1}>
          <boxGeometry
            args={[
              g.shoulderHalf * 2.2 * g.bulk,
              g.torsoLen * 0.95 * g.bulk,
              g.chestR * 2.45 * g.bulk
            ]}
          />
          <meshStandardMaterial {...garmentMat} />
        </mesh>
      )}

      {/* Measurement rings (readable to the eye) */}
      <mesh position={[0, g.yChest, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[g.chestR * 1.05, 0.012, 10, 44]} />
        <meshStandardMaterial color="#38bdf8" roughness={0.3} metalness={0.1} transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, g.yTorso0 + g.torsoLen * 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[g.waistR * 1.06, 0.012, 10, 44]} />
        <meshStandardMaterial color="#22c55e" roughness={0.3} metalness={0.1} transparent opacity={0.72} />
      </mesh>
      <mesh position={[0, g.yHip + g.hipR * 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[g.hipR * 1.06, 0.012, 10, 44]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.1} transparent opacity={0.7} />
      </mesh>

      {/* Shoulder joints (connect arms visually) */}
      <mesh position={[-g.shoulderHalf * 0.98, g.shoulderY, 0]}>
        <sphereGeometry args={[g.armR * 1.05, 16, 14]} />
        <meshStandardMaterial {...matSkin} />
      </mesh>
      <mesh position={[g.shoulderHalf * 0.98, g.shoulderY, 0]}>
        <sphereGeometry args={[g.armR * 1.05, 16, 14]} />
        <meshStandardMaterial {...matSkin} />
      </mesh>

      {/* Arms (true connected bones) */}
      {(() => {
        const sL: [number, number, number] = [-g.shoulderHalf * 0.98, g.shoulderY, 0];
        const sR: [number, number, number] = [g.shoulderHalf * 0.98, g.shoulderY, 0];
        const eL: [number, number, number] = [-g.shoulderHalf * 1.35, g.shoulderY - g.upperArm * 0.62, 0.05];
        const eR: [number, number, number] = [g.shoulderHalf * 1.35, g.shoulderY - g.upperArm * 0.62, 0.05];
        const hL: [number, number, number] = [-g.shoulderHalf * 1.55, g.shoulderY - g.upperArm * 1.18, 0.12];
        const hR: [number, number, number] = [g.shoulderHalf * 1.55, g.shoulderY - g.upperArm * 1.18, 0.12];
        return (
          <>
            <BoneCapsule a={sL} b={eL} radius={g.armR} color={g.skinHex} />
            <BoneCapsule a={eL} b={hL} radius={g.armR * 0.86} color={g.skinHex} />
            <BoneCapsule a={sR} b={eR} radius={g.armR} color={g.skinHex} />
            <BoneCapsule a={eR} b={hR} radius={g.armR * 0.86} color={g.skinHex} />
            <mesh position={hL}>
              <sphereGeometry args={[g.armR * 0.55, 14, 12]} />
              <meshStandardMaterial {...matSkin} />
            </mesh>
            <mesh position={hR}>
              <sphereGeometry args={[g.armR * 0.55, 14, 12]} />
              <meshStandardMaterial {...matSkin} />
            </mesh>
          </>
        );
      })()}

      {/* (hands are rendered with bone chain above) */}

      {/* Jacket sleeves hint */}
      {g.hasUpperGarment && (normalizeGarmentCategory(g.garment!.category) === "jackets" || normalizeGarmentCategory(g.garment!.category) === "formal") && garmentMat && (
        <>
          <mesh
            position={[-g.shoulderHalf * 1.05 - g.upperArm * 0.35, g.shoulderY - g.upperArm * 0.42, 0]}
            rotation={[0.35, 0, -0.12]}
            renderOrder={1}
          >
            <cylinderGeometry args={[g.armR * 1.12, g.armR, g.upperArm * 1.02, 12]} />
            <meshStandardMaterial {...garmentMat} />
          </mesh>
          <mesh
            position={[g.shoulderHalf * 1.05 + g.upperArm * 0.35, g.shoulderY - g.upperArm * 0.42, 0]}
            rotation={[0.35, 0, 0.12]}
            renderOrder={1}
          >
            <cylinderGeometry args={[g.armR * 1.12, g.armR, g.upperArm * 1.02, 12]} />
            <meshStandardMaterial {...garmentMat} />
          </mesh>
        </>
      )}

      {/* Neck + head */}
      <mesh position={[0, g.yShoulder + g.neckH * 0.5, 0]}>
        <cylinderGeometry args={[g.headR * 0.55, g.headR * 0.62, g.neckH, 12]} />
        <meshStandardMaterial {...matSkin} />
      </mesh>
      <mesh position={[0, g.yShoulder + g.neckH + g.headR * 0.92, 0]}>
        <sphereGeometry args={[g.headR, 20, 18]} />
        <meshStandardMaterial {...matSkin} />
      </mesh>
    </group>
  );
}
