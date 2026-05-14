"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { GarmentInput } from "@/components/avatar/HumanObjAvatar";
import { fetchProfile } from "@/lib/api";
import { getFitIdSession } from "@/lib/auth";
import { avatarMeshUrlFromProfile, garmentColorHex, measurementsFromProfile, normalizeGarmentCategory, skinToneFromProfile } from "@/lib/avatar-utils";

const AvatarCanvas = dynamic(() => import("@/components/avatar/AvatarCanvas"), { ssr: false });

function TryOnContent() {
  const router = useRouter();
  const params = useSearchParams();
  const sku = params.get("sku") ?? "";
  const title = params.get("title") ?? "Selected item";
  const category = normalizeGarmentCategory(params.get("category") ?? "shirts");
  const colorName = params.get("color") ?? "navy";

  const garment: GarmentInput = useMemo(
    () => ({
      category,
      colorHex: garmentColorHex(colorName),
      title
    }),
    [category, colorName, title]
  );

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
          if (!cancelled) setError("Could not load profile.");
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [mounted, email, router]);

  if (!mounted) {
    return <p className="subtitle">Loading…</p>;
  }

  if (!email) return null;

  const body = (profile?.body_measurements as Record<string, unknown>) ?? null;
  const measurements = measurementsFromProfile(body);
  const modelUrl = avatarMeshUrlFromProfile(body);
  const skin = skinToneFromProfile(profile?.skin_tone as string | undefined);

  return (
    <>
      <header style={{ marginBottom: "1rem" }}>
        <p className="badge" style={{ margin: 0 }}>
          Try On Me · MVP
        </p>
        <h1 className="title" style={{ margin: "0.5rem 0 0" }}>
          {title}
        </h1>
        <p className="subtitle" style={{ maxWidth: 640 }}>
          {sku && <>SKU {sku} · </>}
          Garment overlay follows your FitID measurements. Drag to rotate the figure.
        </p>
      </header>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {!profile && !error && <p className="subtitle">Loading your body model…</p>}

      {profile && <AvatarCanvas measurements={measurements} skinHex={skin} garment={garment} modelUrl={modelUrl} />}

      <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <Link href="/fashion-hub" className="button secondary">
          Back to Fashion Hub
        </Link>
        <Link href="/avatar" className="button secondary">
          Body only
        </Link>
        <Link href="/dashboard" className="button secondary">
          Dashboard
        </Link>
      </div>
    </>
  );
}

export default function TryOnPage() {
  return (
    <main className="dashboard-app fade-in">
      <Suspense fallback={<p className="subtitle">Loading try-on…</p>}>
        <TryOnContent />
      </Suspense>
    </main>
  );
}
