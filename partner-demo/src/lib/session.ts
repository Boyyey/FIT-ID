export const STORAGE_KEY = "fitid.partner_demo";

export type PartnerSession = {
  access_token: string;
  token_type?: string;
  scope?: string;
  profile?: Record<string, unknown> | null;
  receivedAt: number;
};

export function loadSession(): PartnerSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PartnerSession;
  } catch {
    return null;
  }
}

export function saveSession(session: PartnerSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
