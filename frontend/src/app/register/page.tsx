"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { registerFitIdAccount } from "@/lib/api";
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

type Role = "shopper" | "business";

export default function RegisterPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<Role>("shopper");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError("");
    setBusy(true);
    try {
      const auth = await registerFitIdAccount({
        username: username.trim(),
        password,
        account_type: accountType,
        full_name: fullName.trim() || username.trim().replace(/_/g, " ")
      });
      persistFitIdAuth(auth, "password");
      router.replace(accountType === "business" ? "/business" : "/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  const roleBtn = (id: Role, title: string, body: string) => (
    <button
      type="button"
      key={id}
      onClick={() => setAccountType(id)}
      className="card lift"
      style={{
        cursor: "pointer",
        border: accountType === id ? "2px solid color-mix(in srgb, var(--accent-ui, #14b8a6) 80%, transparent)" : "1px solid var(--line)",
        textAlign: "left",
        background: accountType === id ? "color-mix(in srgb, var(--accent-ui, #14b8a6) 12%, var(--card))" : "var(--card)"
      }}
    >
      <h3 style={{ margin: "0 0 0.35rem" }}>{title}</h3>
      <p className="subtitle" style={{ margin: 0, lineHeight: 1.55 }}>
        {body}
      </p>
    </button>
  );

  return (
    <main className="page-shell fade-in" style={{ minHeight: "100vh", display: "grid", placeItems: "center", paddingBottom: "2rem" }}>
      <section className="panel lift" style={{ width: "min(640px, 100%)", padding: "1.75rem 1.35rem 2rem" }}>
        <div style={{ textAlign: "center", marginBottom: "1rem" }}>
          <Image src="/fitid-logo.png" alt="FitID" width={190} height={120} style={{ height: "auto", width: "auto" }} />
          <h1 className="title" style={{ marginTop: "0.6rem", fontSize: "clamp(1.55rem, 4vw, 2rem)" }}>
            Create your FitID
          </h1>
          <p className="subtitle" style={{ marginTop: "0.35rem" }}>
            Choose how you intend to use the platform first — you can onboard with Google afterward for shoppers, while password signup
            below covers both roles.
          </p>
        </div>

        <div className="grid grid-2" style={{ gap: "0.75rem", marginBottom: "1rem" }}>
          {roleBtn(
            "shopper",
            "Shopper",
            "Body profile, onboarding, FashionHub with personalized catalogs, OAuth consent flows for partner stores."
          )}
          {roleBtn(
            "business",
            "Business",
            "Aggregate intelligence (sandbox live data), heuristic guidance, OAuth application registration for third-party storefronts."
          )}
        </div>

        <GoogleSignInButton />
        <p className="subtitle" style={{ textAlign: "center", marginTop: "0.5rem", maxWidth: 520, marginInline: "auto" }}>
          Google sign-up always provisions a shopper identity. Need a Business role? Finish with username/password above or switch using a new
          FitID invite flow later — we isolate retailer consoles from shopper profiles on purpose.
        </p>
        <p className="subtitle" style={{ textAlign: "center", marginTop: "0.75rem" }}>
          OR register with username
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
          style={{ display: "grid", gap: "0.85rem" }}
        >
          <label className="subtitle" htmlFor="fn" style={{ display: "block", marginBottom: "0.35rem" }}>
            Display name <span style={{ opacity: 0.7 }}>(optional)</span>
          </label>
          <input id="fn" className="input" placeholder="Alex Carter" value={fullName} onChange={(e) => setFullName(e.target.value)} />

          <label className="subtitle" htmlFor="user" style={{ display: "block", marginTop: "0.85rem", marginBottom: "0.35rem" }}>
            Username
          </label>
          <input
            id="user"
            className="input"
            autoComplete="username"
            placeholder="letters_numbers_underscore"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label className="subtitle" htmlFor="pwd" style={{ display: "block", marginTop: "0.85rem", marginBottom: "0.35rem" }}>
            Password (min 8 characters)
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="pwd"
              className="input"
              style={{ paddingRight: "52px" }}
              type={visible ? "text" : "password"}
              autoComplete="new-password"
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

          <button type="submit" className="button" style={{ marginTop: "1.15rem", width: "100%" }} disabled={busy}>
            {busy ? "Creating account…" : `Create ${accountType} account`}
          </button>
        </form>

        {error && <p style={{ color: "#b91c1c", marginTop: "0.85rem", marginBottom: 0 }}>{error}</p>}

        <p className="subtitle" style={{ textAlign: "center", marginTop: "1.1rem" }}>
          Already have an account?{" "}
          <Link href="/sign-in" style={{ fontWeight: 700 }}>
            Sign in
          </Link>
        </p>
        <p className="subtitle" style={{ textAlign: "center", marginTop: "0.45rem", marginBottom: 0 }}>
          <Link href="/">← Sign in</Link>
        </p>
      </section>
    </main>
  );
}
