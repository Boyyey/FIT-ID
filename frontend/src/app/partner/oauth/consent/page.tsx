"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

import { getPublicApiBase } from "@/lib/api";
import { getFitIdSession } from "@/lib/auth";

function PartnerOAuthConsentContent() {
  const params = useSearchParams();
  const loginToken = params.get("login_token");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const approve = useCallback(async () => {
    if (!loginToken) {
      setStatus("Missing login_token. Start sign-in from the partner store again.");
      return;
    }
    const session = getFitIdSession();
    if (!session?.accessToken || !session.email) {
      setStatus("Sign in to FitID in another tab, then press Approve again.");
      return;
    }
    setBusy(true);
    setStatus("Approving…");
    try {
      const api = getPublicApiBase();
      const response = await fetch(`${api}/oauth/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ login_token: loginToken, email: session.email })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail ? String(data.detail) : "Approve failed");
      }
      const url = data.redirect_url as string;
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error("No redirect_url");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }, [loginToken]);

  return (
    <main className="container fade-in">
      <section className="card lift">
        <h1 style={{ marginTop: 0 }}>Connect FitID</h1>
        <p className="subtitle">
          A partner store requested access to your fit profile. Approve only if you trust this site.
        </p>
        <p className="subtitle">Scopes: body measurements, fit preferences, allergies (as requested by the partner).</p>
        {!loginToken && <p style={{ color: "#b91c1c" }}>Invalid session. Close this tab and use &quot;Sign in with FitID&quot; on the store again.</p>}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <button className="button" type="button" disabled={busy || !loginToken} onClick={() => void approve()}>
            {busy ? "Working…" : "Approve and return to store"}
          </button>
          <Link href="/dashboard" className="button secondary">
            Cancel
          </Link>
        </div>
        {status && <p className="subtitle" style={{ marginTop: "0.75rem" }}>{status}</p>}
      </section>
    </main>
  );
}

export default function PartnerOAuthConsentPage() {
  return (
    <Suspense fallback={<main className="container fade-in"><p className="subtitle">Loading…</p></main>}>
      <PartnerOAuthConsentContent />
    </Suspense>
  );
}
