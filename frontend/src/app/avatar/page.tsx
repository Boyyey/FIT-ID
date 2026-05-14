"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { fetchProfile } from "@/lib/api";
import { getFitIdSession } from "@/lib/auth";
import { avatarMeshUrlFromProfile, measurementsFromProfile, skinToneFromProfile } from "@/lib/avatar-utils";

const AvatarCanvas = dynamic(() => import("@/components/avatar/AvatarCanvas"), { ssr: false });

export default function AvatarPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setEmail(getFitIdSession()?.email ?? null);
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!email) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      fetchProfile(email)
        .then((p) => {
          if (!cancelled) setProfile(p as unknown as Record<string, unknown>);
        })
        .catch(() => {
          if (!cancelled) setError("Could not load your profile. Is the API running?");
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [mounted, email, router]);

  if (!mounted) {
    return (
      <main className="dashboard-app fade-in">
        <p className="subtitle">Loading…</p>
      </main>
    );
  }

  if (!email) return null;

  const body = (profile?.body_measurements as Record<string, unknown>) ?? null;
  const measurements = measurementsFromProfile(body);
  const modelUrl = avatarMeshUrlFromProfile(body);
  const skin = skinToneFromProfile(profile?.skin_tone as string | undefined);
  const hasScan = Boolean(body && typeof body.avatar_model === "object" && body.avatar_model !== null);

  return (
    <main className="dashboard-app fade-in">
      <header style={{ marginBottom: "1rem" }}>
        <p className="badge" style={{ margin: 0 }}>
          3D body avatar
        </p>
        <h1 className="title" style={{ margin: "0.5rem 0 0" }}>
          Your parametric model
        </h1>
        <p className="subtitle" style={{ maxWidth: 640 }}>
          Built free in-browser from your FitID measurements (live scan or defaults). Drag to rotate, scroll to zoom — no paid
          reconstruction API.
        </p>
      </header>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {!profile && !error && <p className="subtitle">Loading profile…</p>}

      {profile && (
        <>
          {!hasScan && (
            <p className="subtitle" style={{ marginBottom: "0.75rem", maxWidth: 560 }}>
              We&apos;re showing a preview from default proportions. Run the{" "}
              <Link href="/journey" className="badge" style={{ cursor: "pointer" }}>
                body scan journey
              </Link>{" "}
              to capture photos and unlock your personalized mesh.
            </p>
          )}
          <AvatarCanvas measurements={measurements} skinHex={skin} garment={null} modelUrl={modelUrl} />
          <p className="subtitle" style={{ marginTop: "0.75rem" }}>
            Height {measurements.height_cm} cm · chest {measurements.chest_cm} cm · waist {measurements.waist_cm} cm · inseam{" "}
            {measurements.inseam_cm} cm
          </p>
        </>
      )}

      <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <Link href="/dashboard" className="button secondary">
          Back to dashboard
        </Link>
        <Link href="/fashion-hub" className="button secondary">
          Fashion Hub
        </Link>
      </div>
    </main>
  );
}
