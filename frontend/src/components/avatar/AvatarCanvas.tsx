"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";

import type { AvatarMeasurements } from "@/lib/avatar-utils";

import { HumanObjAvatar, type GarmentInput } from "./HumanObjAvatar";

function Scene({
  measurements,
  skinHex,
  garment,
  modelUrl
}: {
  measurements: AvatarMeasurements;
  skinHex: string;
  garment?: GarmentInput | null;
  modelUrl?: string;
}) {
  const { invalidate } = useThree();
  const H = Math.max(1.45, Math.min(2.15, measurements.height_cm / 100));
  const camDist = H * 2.1;
  const targetY = H * 0.52;
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    // Put the camera at chest height by default (avoids “too low” view).
    const c = controlsRef.current;
    if (!c) return;
    const x = camDist * 0.65;
    const y = H * 1.05;
    const z = camDist * 0.75;
    void c.setLookAt(x, y, z, 0, targetY, 0, true);
    invalidate();
  }, [H, camDist, invalidate, targetY]);

  return (
    <>
      <color attach="background" args={["#0b1220"]} />
      <ambientLight intensity={0.62} />
      <directionalLight position={[5, 12, 8]} intensity={0.78} color="#ffffff" />
      <directionalLight position={[-4, 6, -6]} intensity={0.22} color="#fff8f5" />
      <HumanObjAvatar url={modelUrl ?? "/models/human/FinalBaseMesh.obj"} measurements={measurements} skinHex={skinHex} garment={garment ?? null} />
      <CameraControls
        ref={(r) => {
          controlsRef.current = r;
        }}
        makeDefault
        minDistance={H * 1.05}
        maxDistance={H * 3.8}
        maxPolarAngle={Math.PI / 2 + 0.12}
        minPolarAngle={0.18}
        dollyToCursor
        smoothTime={0.18}
        onChange={() => invalidate()}
      />
    </>
  );
}

export default function AvatarCanvas({
  measurements,
  skinHex,
  garment,
  modelUrl
}: {
  measurements: AvatarMeasurements;
  skinHex: string;
  garment?: GarmentInput | null;
  modelUrl?: string;
}) {
  const H = Math.max(1.45, Math.min(2.15, measurements.height_cm / 100));
  const [canvasKey, setCanvasKey] = useState(0);
  const [contextLost, setContextLost] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "min(72vh, 560px)",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid var(--border, #e2e8f0)"
      }}
    >
      {contextLost && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 3,
            background: "rgba(11,18,32,0.78)",
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            padding: "1rem"
          }}
        >
          <div>
            <p className="subtitle" style={{ margin: 0, color: "#e2e8f0" }}>
              3D context was reset by the browser GPU.
            </p>
            <button
              type="button"
              className="button secondary"
              style={{ marginTop: "0.6rem" }}
              onClick={() => {
                setContextLost(false);
                setCanvasKey((k) => k + 1);
              }}
            >
              Reload 3D model
            </button>
          </div>
        </div>
      )}
      <Canvas
        key={canvasKey}
        camera={{ position: [H * 1.35, H * 1.05, H * 1.55], fov: 42 }}
        dpr={0.9}
        frameloop="demand"
        gl={{ antialias: false, alpha: false, powerPreference: "low-power" as any, localClippingEnabled: true }}
        // keep WebGL lighter for mobile + emulation
        shadows={false}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          const onLost = (e: Event) => {
            e.preventDefault();
            setContextLost(true);
          };
          const onRestored = () => {
            setContextLost(false);
            setCanvasKey((k) => k + 1);
          };
          canvas.addEventListener("webglcontextlost", onLost, false);
          canvas.addEventListener("webglcontextrestored", onRestored, false);
        }}
      >
        <Scene measurements={measurements} skinHex={skinHex} garment={garment ?? null} modelUrl={modelUrl} />
      </Canvas>
    </div>
  );
}
