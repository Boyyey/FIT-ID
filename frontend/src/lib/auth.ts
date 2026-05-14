import type { FitIdAuthPayload } from "@/lib/api";

export const FITID_SESSION_KEY = "fitid.session";

export type AccountType = "shopper" | "business";

export type FitIdSession = {
  accessToken: string;
  email: string;
  username?: string | null;
  fullName?: string | null;
  onboardingCompleted?: boolean;
  authMethod?: "google" | "password";
  accountType?: AccountType;
};

export function saveFitIdSession(session: FitIdSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FITID_SESSION_KEY, JSON.stringify(session));
}

export function getFitIdSession(): FitIdSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(FITID_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FitIdSession;
  } catch {
    return null;
  }
}

export function clearFitIdSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FITID_SESSION_KEY);
}

export function persistFitIdAuth(auth: FitIdAuthPayload, authMethod: "google" | "password") {
  const role = (auth.account_type || "").toLowerCase() === "business" ? "business" : "shopper";
  saveFitIdSession({
    accessToken: auth.access_token,
    email: auth.email,
    fullName: auth.full_name ?? null,
    username: auth.username ?? null,
    onboardingCompleted: true,
    authMethod,
    accountType: role as AccountType
  });
}


export function markOnboardingCompleted() {
  const session = getFitIdSession();
  if (!session) return;
  saveFitIdSession({ ...session, onboardingCompleted: true });
}

/** @deprecated Prefer register/sign-in APIs that persist a JWT. */
export function createPasswordSession(username: string, password: string, fullName?: string) {
  if (!username || !password) throw new Error("Username and password are required.");
  saveFitIdSession({
    accessToken: `pwd-legacy-${Date.now()}`,
    email: `${username.trim().toLowerCase()}@fitid.user`,
    fullName: fullName?.trim() || username.replace(/[._-]/g, " "),
    username: username.trim().toLowerCase(),
    onboardingCompleted: true,
    authMethod: "password",
    accountType: "shopper",
  });
}
