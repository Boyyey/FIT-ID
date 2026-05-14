"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type TokenResponse = {
  access_token?: string;
  token_type?: string;
  scope?: string;
  profile?: Record<string, unknown>;
  detail?: string;
};

function PartnerDemoCallbackContent() {
  const params = useSearchParams();
  const code = params.get("code");
  const state = params.get("state");
  const err = params.get("error");
  const [data, setData] = useState<TokenResponse | null>(null);
  const [message, setMessage] = useState("Exchanging authorization code…");

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (err) {
        setMessage(String(err));
        return;
      }
      if (!code) {
        setMessage("No authorization code returned.");
        return;
      }
      const redirectUri = `${window.location.origin}/partner/demo/callback`;
      void (async () => {
        try {
          const response = await fetch("/api/partner/fitid-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, redirect_uri: redirectUri })
          });
          const json = (await response.json()) as TokenResponse;
          if (!response.ok) {
            setMessage(json.detail ? String(json.detail) : "Token exchange failed");
            return;
          }
          setData(json);
          setMessage("Connected. Partner access token issued.");
          if (process.env.NODE_ENV === "development") {
            console.info("[FitID partner OAuth]", { state, scope: json.scope, profileKeys: json.profile ? Object.keys(json.profile) : [] });
          }
        } catch {
          setMessage("Token exchange failed.");
        }
      })();
    }, 0);
    return () => window.clearTimeout(t);
  }, [code, err, state]);

  return (
    <main className="container fade-in">
      <section className="card lift">
        <h1 style={{ marginTop: 0 }}>Partner callback</h1>
        <p className="subtitle">{message}</p>
        {data?.access_token && (
          <div className="panel" style={{ marginTop: "0.75rem", borderRadius: "12px", boxShadow: "none" }}>
            <p className="subtitle">Access token (demo only — use server-side in production)</p>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "0.8rem" }}>{data.access_token}</pre>
            {data.profile && (
              <>
                <p className="subtitle" style={{ marginTop: "0.75rem" }}>
                  Profile slice (approved scopes)
                </p>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>{JSON.stringify(data.profile, null, 2)}</pre>
              </>
            )}
          </div>
        )}
        <Link href="/partner/demo" className="button secondary" style={{ marginTop: "1rem", display: "inline-block" }}>
          Demo store
        </Link>
      </section>
    </main>
  );
}

export default function PartnerDemoCallbackPage() {
  return (
    <Suspense fallback={<main className="container fade-in"><p className="subtitle">Loading callback…</p></main>}>
      <PartnerDemoCallbackContent />
    </Suspense>
  );
}
