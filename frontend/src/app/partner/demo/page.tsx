"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

import { getPublicApiBase } from "@/lib/api";

const CLIENT_ID = "fitid_demo_store";

export default function PartnerDemoStorePage() {
  const [authorizeUrl, setAuthorizeUrl] = useState("#");

  useEffect(() => {
    const t = window.setTimeout(() => {
      const api = getPublicApiBase();
      const redirectUri = `${window.location.origin}/partner/demo/callback`;
      const scope = "body_measurements,fit_preferences,allergies,posture,skin_tone";
      const state = `demo-${Date.now()}`;
      const q = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        state,
        scope
      });
      setAuthorizeUrl(`${api}/oauth/authorize?${q.toString()}`);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <main className="container fade-in">
      <section className="card lift">
        <p className="badge">Demo partner storefront</p>
        <h1 style={{ marginTop: "0.5rem" }}>FitID Outfitters (demo)</h1>
        <p className="subtitle">
          This page simulates a third-party retailer. Use the official FitID partner button to run the OAuth flow.
        </p>
        <div
          style={{
            marginTop: "1.25rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.5rem 0.9rem",
            borderRadius: "12px",
            border: "1px solid var(--border, #e2e8f0)",
            background: "#fff"
          }}
        >
          <Image src="/fitid-logo.png" alt="" width={28} height={28} style={{ width: "auto", height: "28px" }} />
          <a
            href={authorizeUrl}
            className="button"
            style={{ margin: 0, textDecoration: "none", display: "inline-block" }}
          >
            Sign in with FitID
          </a>
        </div>
        <p className="subtitle" style={{ marginTop: "1rem" }}>
          Production partners register redirect URIs in the <Link href="/partner/console">FitID OAuth console</Link> (Business account) to
          mint <code>client_id</code> / <code>client_secret</code>. This page uses the built-in demo client ID <code>{CLIENT_ID}</code>.
        </p>
        <Link href="/dashboard" className="button secondary" style={{ marginTop: "0.75rem", display: "inline-block" }}>
          Back to FitID
        </Link>
      </section>
    </main>
  );
}
