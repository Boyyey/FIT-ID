"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { getPublicApiBase, loginFitIdAccount } from "@/lib/api";
import { persistFitIdAuth } from "@/lib/auth";

function EyeOpen() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosed() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M4 4l16 16" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M2 12s3.8-7 10-7c2.3 0 4.2.7 5.8 1.8M22 12s-3.8 7-10 7c-2.3 0-4.2-.7-5.8-1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.6 9.6a3.4 3.4 0 0 0 4.8 4.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SignInPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError("");
    setBusy(true);
    try {
      const auth = await loginFitIdAccount({ username: username.trim(), password });
      persistFitIdAuth(auth, "password");
      router.replace(auth.account_type === "business" ? "/business" : "/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell fade-in" style={{ minHeight: "100vh", display: "grid", placeItems: "center", paddingBottom: "2rem" }}>
      <section className="panel lift" style={{ width: "min(520px, 100%)", padding: "1.75rem 1.35rem 2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
          <Image src="/fitid-logo.png" alt="FitID" width={190} height={120} style={{ height: "auto", width: "auto" }} />
          <h1 className="title" style={{ marginTop: "0.6rem", fontSize: "clamp(1.55rem, 4vw, 2rem)" }}>
            Welcome back
          </h1>
          <p className="subtitle" style={{ marginTop: "0.35rem" }}>
            Username + password stays on-device until your FitID JWT is minted server-side ({getPublicApiBase()}).
          </p>
        </div>

        <GoogleSignInButton />

        <p className="subtitle" style={{ textAlign: "center", marginTop: "0.75rem" }}>
          OR
        </p>

        <label className="subtitle" htmlFor="user" style={{ display: "block", marginBottom: "0.35rem" }}>
          Username
        </label>
        <input
          id="user"
          className="input"
          autoComplete="username"
          placeholder="your_username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="subtitle" htmlFor="pwd" style={{ display: "block", marginTop: "0.85rem", marginBottom: "0.35rem" }}>
          Password
        </label>
        <div style={{ position: "relative" }}>
          <input
            id="pwd"
            className="input"
            style={{ paddingRight: "52px" }}
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onSubmit();
            }}
          />
          <button
            type="button"
            className="button secondary"
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible((v) => !v)}
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              padding: "0.42rem",
              borderRadius: "12px",
              minWidth: 44,
              display: "grid",
              placeItems: "center"
            }}
          >
            {visible ? <EyeClosed /> : <EyeOpen />}
          </button>
        </div>

        <button className="button" style={{ marginTop: "1.1rem", width: "100%" }} disabled={busy} onClick={() => void onSubmit()}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        {error && <p style={{ color: "#b91c1c", marginTop: "0.85rem", marginBottom: 0 }}>{error}</p>}

        <p className="subtitle" style={{ textAlign: "center", marginTop: "1.1rem", marginBottom: 0 }}>
          No account yet?{" "}
          <Link href="/register" style={{ fontWeight: 700 }}>
            Register and pick Shopper vs Business
          </Link>
        </p>

        <p className="subtitle" style={{ textAlign: "center", marginTop: "0.6rem", marginBottom: 0 }}>
          <Link href="/">← Back to welcome</Link>
        </p>
      </section>
    </main>
  );
}
