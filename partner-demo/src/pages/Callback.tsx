import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { usePartnerAuth } from "@/context/PartnerAuth";

const tokenProxy = import.meta.env.VITE_TOKEN_PROXY_URL ?? "http://localhost:8787";

const exchangedCodes = new Set<string>();

export function CallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = usePartnerAuth();
  const [message, setMessage] = useState("Exchanging authorization code…");

  useEffect(() => {
    const err = params.get("error");
    const code = params.get("code");
    if (err) {
      setMessage(`OAuth error: ${err}`);
      return;
    }
    if (!code) {
      setMessage("No authorization code in the URL.");
      return;
    }
    if (exchangedCodes.has(code)) return;
    exchangedCodes.add(code);

    const redirectUri = `${window.location.origin}/callback`;

    void (async () => {
      try {
        const response = await fetch(`${tokenProxy}/api/partner/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirect_uri: redirectUri })
        });
        const json = (await response.json()) as {
          access_token?: string;
          detail?: string;
          profile?: Record<string, unknown>;
          scope?: string;
          token_type?: string;
        };
        if (!response.ok) {
          exchangedCodes.delete(code);
          setMessage(json.detail ? String(json.detail) : "Token exchange failed.");
          return;
        }
        if (!json.access_token) {
          exchangedCodes.delete(code);
          setMessage("No access_token in response.");
          return;
        }
        setSession({
          access_token: json.access_token,
          token_type: json.token_type,
          scope: json.scope,
          profile: json.profile ?? null,
          receivedAt: Date.now()
        });
        navigate("/", { replace: true });
      } catch {
        exchangedCodes.delete(code);
        setMessage("Could not reach the token proxy. Is `npm run dev` running?");
      }
    })();
  }, [navigate, params, setSession]);

  return (
    <main className="page">
      <section className="panel callback-card">
        <h1>FitID connection</h1>
        <p className="subtle">{message}</p>
        <p className="subtle" style={{ marginTop: "1rem" }}>
          <Link to="/">← Back to the store</Link>
        </p>
      </section>
    </main>
  );
}
