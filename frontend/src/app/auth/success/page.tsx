"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

import { exchangeGoogleToken } from "@/lib/api";
import { persistFitIdAuth } from "@/lib/auth";

export default function AuthSuccessPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [message, setMessage] = useState("Finalizing FitID sign-in…");

  useEffect(() => {
    async function finalizeAuth() {
      if (status !== "authenticated") return;
      const googleIdToken = (session as { googleIdToken?: string }).googleIdToken as string | undefined;
      if (!googleIdToken) {
        setMessage("Google token missing. Check NextAuth env values and sign in again.");
        return;
      }

      try {
        const fitidAuth = await exchangeGoogleToken(googleIdToken);
        persistFitIdAuth(fitidAuth, "google");
        await signOut({ redirect: false });
        const go = fitidAuth.account_type === "business" ? "/business" : "/dashboard";
        router.replace(go);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Sign-in exchange failed.");
      }
    }

    void finalizeAuth();
  }, [router, session, status]);

  return (
    <main className="container">
      <section className="card">
        <h1>Completing Sign-In</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}
