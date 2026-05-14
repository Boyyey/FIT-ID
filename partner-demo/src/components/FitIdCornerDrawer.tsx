import { useEffect, useMemo, useState } from "react";

import { usePartnerAuth } from "@/context/PartnerAuth";
import { buildAuthorizeUrl } from "@/lib/oauth";
import { decodeJwtPayload } from "@/lib/jwtPreview";
import { loadSession } from "@/lib/session";

const apiBase = import.meta.env.VITE_FITID_API_BASE ?? "http://localhost:8000/api/v1";
const clientId = import.meta.env.VITE_PARTNER_CLIENT_ID ?? "fitid_demo_store";
const envToken = (import.meta.env.VITE_FITID_ACCESS_TOKEN ?? "").trim();

export function FitIdCornerDrawer() {
  const { session, setSession } = usePartnerAuth();
  const [open, setOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");

  useEffect(() => {
    if (!envToken) return;
    if (loadSession()) return;
    setSession({
      access_token: envToken,
      receivedAt: Date.now(),
      profile: null
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- env bootstrap when storage empty
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const authorizeHref = useMemo(() => {
    const redirectUri = typeof window !== "undefined" ? `${window.location.origin}/callback` : "";
    return buildAuthorizeUrl({ apiBase, clientId, redirectUri });
  }, []);

  const jwtPreview = session ? decodeJwtPayload(session.access_token) : null;

  return (
    <div className="fitid-corner">
      <button
        type="button"
        className="fitid-corner-btn"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="fitid-drawer-panel"
      >
        <span className="fitid-corner-btn-label">Fit ID</span>
        {session ? <span className="fitid-corner-dot" title="Connected" /> : null}
      </button>

      {open ? (
        <>
          <button type="button" className="fitid-drawer-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside id="fitid-drawer-panel" className="fitid-drawer" role="dialog" aria-modal="true" aria-label="FitID">
            <div className="fitid-drawer-head">
              <h2 className="fitid-drawer-title">FitID</h2>
              <button type="button" className="fitid-drawer-close" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="fitid-drawer-body">
              <p className="fitid-drawer-lede">
                Partner demo: sign in for OAuth, or paste an access token. In production, exchange codes only on your
                server.
              </p>

              <a className="btn btn-fitid fitid-drawer-full" href={authorizeHref} onClick={() => setOpen(false)}>
                Sign in with FitID
              </a>

              <div className="fitid-drawer-section">
                <h3 className="fitid-drawer-h3">Access token</h3>
                <p className="hint fitid-drawer-hint">
                  Paste a token from FitID, or set <code className="mono">VITE_FITID_ACCESS_TOKEN</code> in{" "}
                  <code className="mono">.env</code> (restart dev server).
                </p>
                <div className="paste-row fitid-drawer-paste">
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder="Paste access_token"
                    value={pasteValue}
                    onChange={(e) => setPasteValue(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const t = pasteValue.trim();
                      if (!t) return;
                      setSession({ access_token: t, receivedAt: Date.now(), profile: null });
                      setPasteValue("");
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>

              {session ? (
                <div className="fitid-drawer-section">
                  <div className="warn fitid-drawer-warn">Demo only — do not expose real tokens in production UIs.</div>
                  <h3 className="fitid-drawer-h3">Current session</h3>
                  <pre className="token mono fitid-drawer-token">{session.access_token}</pre>
                  {jwtPreview ? (
                    <p className="hint fitid-drawer-hint">
                      JWT preview (unverified):{" "}
                      <span className="mono">
                        sub={String(jwtPreview.sub ?? "—")} typ={String(jwtPreview.typ ?? "—")}
                      </span>
                    </p>
                  ) : null}
                  {session.profile && Object.keys(session.profile).length > 0 ? (
                    <>
                      <h3 className="fitid-drawer-h3">Profile slice</h3>
                      <pre className="token mono fitid-drawer-token">{JSON.stringify(session.profile, null, 2)}</pre>
                    </>
                  ) : null}
                  <button type="button" className="btn btn-ghost fitid-drawer-full" onClick={() => setSession(null)}>
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
