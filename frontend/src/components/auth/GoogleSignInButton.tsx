"use client";

import { signIn } from "next-auth/react";

export default function GoogleSignInButton() {
  async function handleGoogleSignIn() {
    await signIn("google", { callbackUrl: "/auth/success" });
  }

  return (
    <button className="button secondary" onClick={handleGoogleSignIn} style={{ width: "100%" }}>
      Continue with Google
    </button>
  );
}
