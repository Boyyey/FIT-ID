"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { runScan } from "@/lib/api";
import { getFitIdSession } from "@/lib/auth";

export default function ScanPage() {
  const router = useRouter();
  const email = useMemo(() => getFitIdSession()?.email ?? null, []);
  const [status, setStatus] = useState<string>("Ready for 60-second scan.");

  useEffect(() => {
    const session = getFitIdSession();
    if (!session?.email) {
      router.replace("/");
    }
  }, [router]);

  async function handleStartScan() {
    if (!email) return;
    setStatus("Capturing body measurements...");
    await runScan(email, {
      height_cm: 170,
      weight_kg: 70,
      shoulder_width_cm: 42,
      waist_cm: 82,
      hip_cm: 95,
      inseam_cm: 78,
      posture_hint: "neutral",
      skin_tone_hint: "olive"
    });
    setStatus("Scan complete. Profile data generated. Go to dashboard to view recommendations.");
  }

  return (
    <main className="container">
      <section className="card">
        <h1>Body Scan</h1>
        <p>Guided MVP scan phase (front, side, posture) ready for camera integration.</p>
        <button className="button" onClick={handleStartScan}>
          Start Demo Scan
        </button>
        <p>{status}</p>
      </section>
    </main>
  );
}
