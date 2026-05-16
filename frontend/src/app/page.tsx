"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { loginFitIdAccount } from "@/lib/api";
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

export default function HomePage() {
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
      <section className="panel lift" style={{ width: "min(540px, 100%)", padding: "2rem 1.35rem" }}>
        <div style={{ display: "grid", placeItems: "center", gap: "1rem", marginBottom: "1rem" }}>
          <Image
            src="/fitid-logo.png"
            alt="FitID logo"
            width={220}
            height={150}
            style={{ width: "auto", height: "auto" }}
            loading="eager"
            priority
          />
          <div style={{ textAlign: "center" }}>
            <h1 className="title" style={{ margin: 0 }}>
              Welcome to FitID
            </h1>
            <p className="subtitle" style={{ marginTop: "0.35rem", marginBottom: 0 }}>
              Sign in to start your personal fit journey.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          <GoogleSignInButton />
          <p className="subtitle" style={{ textAlign: "center", marginTop: "0.3rem" }}>
            OR
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void onSubmit();
            }}
            style={{ display: "grid", gap: "0.75rem" }}
          >
            <label className="subtitle" htmlFor="home-user">
              Username
            </label>
            <input
              id="home-user"
              className="input"
              autoComplete="username"
              placeholder="your_username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <label className="subtitle" htmlFor="home-pwd">
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="home-pwd"
                className="input"
                style={{ paddingRight: "52px" }}
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

            <button type="submit" className="button" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
              Need an account?{" "}
              <Link href="/register" style={{ fontWeight: 700 }}>
                Create one (Shopper or Business)
              </Link>
            </p>
            <p className="subtitle" style={{ margin: 0 }}>
              <Link href="/sign-in" style={{ fontWeight: 600 }}>
                Alternate sign-in page →
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
