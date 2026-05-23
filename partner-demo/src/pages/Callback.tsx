import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { usePartnerAuth } from "@/context/PartnerAuth";

const apiBase = import.meta.env.VITE_FITID_API_BASE ?? (window.location.hostname === "localhost" ? "http://localhost:8000/api/v1" : "https://fit-id-uzzj.onrender.com/api/v1");
const tokenProxy = import.meta.env.VITE_TOKEN_PROXY_URL ?? (window.location.hostname === "localhost" ? "http://localhost:8787" : apiBase);

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
    const isLocal = window.location.hostname === "localhost";

    void (async () => {
      try {
        let response;
        let json;

        if (isLocal) {
          // Local development: use token proxy
          response = await fetch(`${tokenProxy}/api/partner/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, redirect_uri: redirectUri })
          });
          json = (await response.json()) as {
            access_token?: string;
            detail?: string;
            profile?: Record<string, unknown>;
            scope?: string;
            token_type?: string;
          };
        } else {
          // Production: call FitID backend OAuth token endpoint directly
          response = await fetch(`${apiBase}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              grant_type: "authorization_code",
              code,
              client_id: "fitid_demo_store",
              client_secret: "fitid-demo-partner-secret-change-me",
              redirect_uri: redirectUri
            })
          });
          json = (await response.json()) as {
            access_token?: string;
            error?: string;
            error_description?: string;
            scope?: string;
            token_type?: string;
          };
        }

        if (!response.ok) {
          exchangedCodes.delete(code);
          const errorMsg = (json as any).detail || (json as any).error_description || (json as any).error || "Token exchange failed.";
          setMessage(errorMsg);
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
          profile: (json as any).profile ?? null,
          receivedAt: Date.now()
        });
        navigate("/", { replace: true });
      } catch (e) {
        exchangedCodes.delete(code);
        const errorMsg = isLocal ? "Could not reach the token proxy. Is `npm run dev` running?" : "Could not connect to FitID backend.";
        setMessage(errorMsg);
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
