"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getPublicApiBase, listOAuthApplications, registerOAuthApplication } from "@/lib/api";
import { clearFitIdSession, getFitIdSession } from "@/lib/auth";

export default function PartnerConsolePage() {
  const session = getFitIdSession();
  const [apps, setApps] = useState<Array<{ client_id: string; name?: string | null; redirect_uris: string[]; created_unix: number }>>(
    []
  );
  const [name, setName] = useState("My storefront");
  const [urisRaw, setUrisRaw] = useState(`${typeof window !== "undefined" ? window.location.origin : ""}/oauth/callback`);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const api = getPublicApiBase();
  const publicUi = typeof window !== "undefined" ? window.location.origin : "";

  const reload = useCallback(async () => {
    if (!session?.accessToken || session.accountType !== "business") return;
    setBusy(true);
    setError("");
    try {
      const rows = await listOAuthApplications(session.accessToken);
      setApps(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not list applications");
    } finally {
      setBusy(false);
    }
  }, [session?.accessToken, session?.accountType]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(id);
  }, [reload]);

  async function createApp(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.accessToken || session.accountType !== "business") return;
    setBusy(true);
    setError("");
    setSecret(null);
    try {
      const uris = urisRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const payload = await registerOAuthApplication(session.accessToken, { name: name.trim(), redirect_uris: uris });
      setSecret(payload.client_secret);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setBusy(false);
    }
  }

  if (!session?.accessToken) {
    return (
      <main className="dashboard-app fade-in">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>OAuth applications</h1>
          <p className="subtitle">Sign in first, then return with a Business account.</p>
          <Link href="/sign-in" className="button" style={{ display: "inline-block", marginTop: "1rem" }}>
            Sign in
          </Link>
        </section>
      </main>
    );
  }

  if (session.accountType !== "business") {
    return (
      <main className="dashboard-app fade-in">
        <section className="panel">
          <h1 style={{ marginTop: 0 }}>Business console</h1>
          <p className="subtitle">Only Business FitID identities can mint OAuth clients. Switch accounts or register a Business profile.</p>
          <button type="button" className="button secondary" onClick={() => (clearFitIdSession(), window.location.reload())}>
            Sign out locally
          </button>
          <Link href="/register" className="button" style={{ marginLeft: "0.65rem", display: "inline-block" }}>
            Register business account
          </Link>
        </section>
      </main>
    );
  }

  const snippet = `
<!-- Replace placeholders from the FitID console -->
<form method="GET" action="${api}/oauth/authorize">
  <input type="hidden" name="client_id" value="YOUR_CLIENT_ID" />
  <input type="hidden" name="redirect_uri" value="https://merchant.example/oauth/callback" />
  <input type="hidden" name="scope" value="body_measurements,fit_preferences,allergies,posture,skin_tone" />
  <input type="hidden" name="state" value="\${csrfToken}" />
  <button type="submit">Continue with FitID</button>
</form>
`.trim();

  return (
    <main className="dashboard-app fade-in">
      <section className="panel lift">
        <p className="badge">FitID OAuth</p>
        <h1 style={{ marginTop: "0.45rem" }}>Application console</h1>
        <p className="subtitle">
          Register redirect URIs (HTTPS in production — localhost tolerated for sandbox). Secrets must live on your backend only. Authorize URLs
          must match <strong>exactly</strong>.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
          <button type="button" className="button secondary" disabled={busy} onClick={() => void reload()}>
            Refresh registry
          </button>
          <Link href="/business" className="button secondary">
            Analytics dashboard
          </Link>
          <Link href="/" className="badge" style={{ padding: "0.55rem 0.95rem", cursor: "pointer" }}>
            FitID overview
          </Link>
        </div>
      </section>

      <div className="grid grid-2" style={{ marginTop: "1rem" }}>
        <section className="card lift">
          <h2 style={{ marginTop: 0 }}>Register OAuth client</h2>
          <form onSubmit={(e) => void createApp(e)} style={{ display: "grid", gap: "0.75rem", marginTop: "0.75rem" }}>
            <label className="subtitle" htmlFor="appname">
              Application name
            </label>
            <input id="appname" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="subtitle" htmlFor="uris">
              Redirect URIs — one HTTPS (or localhost) URL per line
            </label>
            <textarea
              id="uris"
              className="input"
              rows={4}
              value={urisRaw}
              placeholder={`${publicUi}/partner/demo/callback`}
              onChange={(e) => setUrisRaw(e.target.value)}
            />
            <button className="button" disabled={busy} type="submit">
              {busy ? "Saving…" : "Create credentials"}
            </button>
          </form>
          {secret && (
            <div className="panel" style={{ marginTop: "1rem", borderRadius: "14px", boxShadow: "none", wordBreak: "break-all" }}>
              <strong>Client secret (copy now — FitID stores only a bcrypt hash)</strong>
              <pre style={{ marginTop: "0.65rem", fontSize: "0.78rem", whiteSpace: "pre-wrap" }}>{secret}</pre>
            </div>
          )}
          {error && <p style={{ color: "#b91c1c", marginTop: "0.75rem", marginBottom: 0 }}>{error}</p>}
        </section>

        <section className="card lift">
          <h2 style={{ marginTop: 0 }}>Issuer &amp; token endpoints</h2>
          <ul className="subtitle" style={{ lineHeight: 1.6, paddingLeft: "1.25rem", marginBottom: "0.75rem" }}>
            <li>
              Authorization: <code style={{ wordBreak: "break-all" }}>{api}/oauth/authorize</code>
            </li>
            <li>
              Token exchange: <code>{api}/oauth/token</code> (POST JSON, server-side only)
            </li>
          </ul>
          <p className="subtitle">Public UI origin hint: <code>{publicUi || "(open in browser)"}</code></p>
          <details style={{ marginTop: "1rem" }}>
            <summary className="subtitle" style={{ cursor: "pointer", fontWeight: 700 }}>
              HTML authorize snippet (GET)
            </summary>
            <pre style={{ fontSize: "0.75rem", marginTop: "0.65rem", whiteSpace: "pre-wrap" }}>{snippet}</pre>
          </details>
        </section>
      </div>

      <section className="card lift" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Your applications</h2>
        {!apps.length && <p className="subtitle">No records yet.</p>}
        <div style={{ display: "grid", gap: "0.85rem", marginTop: "0.5rem" }}>
          {apps.map((app) => (
            <article key={app.client_id + app.created_unix} className="panel" style={{ borderRadius: "12px", boxShadow: "none" }}>
              <p style={{ margin: 0, fontWeight: 800 }}>
                {app.name || "Unnamed"}
                {" "}
                <span className="badge">{app.client_id}</span>
              </p>
              <p className="subtitle" style={{ marginTop: "0.35rem" }}>
                Registered {new Date(app.created_unix * 1000).toLocaleString()}
              </p>
              <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.25rem" }}>
                {app.redirect_uris.map((uri) => (
                  <li key={uri} style={{ wordBreak: "break-all" }}>
                    {uri}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <p className="subtitle" style={{ marginTop: "1rem", fontSize: "0.88rem" }}>
        Optional helper: browse <code>/fitid-oauth-snippet.js</code> for browser-side authorize URL scaffolding (still exchange tokens on your server).
      </p>
    </main>
  );
}
