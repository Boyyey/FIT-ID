const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";

export type FitIdAuthPayload = {
  access_token: string;
  token_type?: string;
  email: string;
  username?: string | null;
  full_name?: string | null;
  account_type?: string;
};

/** Same as the URL the app calls (for error messages when the backend is down). */
export function getPublicApiBase(): string {
  return API_BASE;
}

export async function exchangeGoogleToken(googleIdToken: string): Promise<FitIdAuthPayload> {
  const unreachableHint =
    `Cannot reach the FitID API at ${API_BASE} (connection refused or network error). ` +
    `Start the backend: from the backend folder run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000, ` +
    `or docker compose up. If deployed to Render, set NEXT_PUBLIC_API_BASE to your public service URL or keep the default relative path /api/v1 when the API is proxied through the same host.`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ google_id_token: googleIdToken })
    });
  } catch {
    throw new Error(unreachableHint);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body?.detail != null ? String(body.detail) : response.statusText;
    throw new Error(
      `Google sign-in was rejected by the server (${response.status}). ${detail}. If this persists, confirm GOOGLE_CLIENT_ID matches in backend and frontend.`
    );
  }
  return (await response.json()) as FitIdAuthPayload;
}

export async function updateSensitivity(email: string, payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE}/profile/${encodeURIComponent(email)}/sensitivity`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Sensitivity update failed");
  return response.json();
}

export async function savePartnerConsent(email: string, partner: string, approvedFields: string[]) {
  const response = await fetch(`${API_BASE}/integration/consent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, partner, approved_fields: approvedFields })
  });
  if (!response.ok) throw new Error("Consent save failed");
  return response.json();
}

export async function issuePartnerToken(email: string, partner: string, approvedFields: string[]) {
  const response = await fetch(`${API_BASE}/integration/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, partner, approved_fields: approvedFields })
  });
  if (!response.ok) throw new Error("Partner token issue failed");
  return response.json();
}

export async function runScan(email: string, payload: Record<string, unknown>) {
  const response = await fetch(`${API_BASE}/scan/${encodeURIComponent(email)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Scan failed");
  return response.json();
}

export async function runLiveScan(email: string, args: {
  heightCm: number;
  weightKg: number;
  frontImage: Blob;
  sideImage: Blob;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const formData = new FormData();
  formData.append("height_cm", String(args.heightCm));
  formData.append("weight_kg", String(args.weightKg));
  formData.append("front_image", args.frontImage, "front.jpg");
  formData.append("side_image", args.sideImage, "side.jpg");

  try {
    const response = await fetch(`${API_BASE}/scan/live/${encodeURIComponent(email)}`, {
      method: "POST",
      body: formData,
      signal: controller.signal
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const detail = body?.detail ? String(body.detail) : "Live scan failed";
      throw new Error(detail);
    }
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Live scan timed out. Please retry with clearer images.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchProfile(email: string) {
  const response = await fetch(`${API_BASE}/profile/${encodeURIComponent(email)}`);
  if (!response.ok) throw new Error("Profile not found");
  return response.json();
}

export async function getRecommendations(email: string, products: Array<Record<string, unknown>>) {
  const response = await fetch(`${API_BASE}/recommend/${encodeURIComponent(email)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(products)
  });
  if (!response.ok) throw new Error("Recommendation request failed");
  return response.json();
}

export type PersonalizedProduct = {
  sku: string;
  merchant: string;
  brand: string;
  title: string;
  category: string;
  gender: string;
  material: string;
  fit_profile: string;
  color: string;
  price_aed: number;
  image_url: string;
  product_url: string;
  personalized_score: number;
  recommended_size: string;
  reasons: string[];
  fit_label: string;
};

async function reqJson(method: string, path: string, body?: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts: RequestInit = { method, headers };
  if (body !== undefined && method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const response = await fetch(`${API_BASE}${path}`, opts);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.detail != null ? String(payload.detail) : response.statusText);
  return payload;
}

export async function registerFitIdAccount(payload: {
  username: string;
  password: string;
  account_type: "shopper" | "business";
  full_name?: string;
}): Promise<FitIdAuthPayload> {
  return reqJson("POST", "/auth/register", { ...payload, full_name: payload.full_name || null });
}

export async function loginFitIdAccount(payload: { username: string; password: string }): Promise<FitIdAuthPayload> {
  return reqJson("POST", "/auth/login", payload as unknown as Record<string, unknown>);
}

export async function listOAuthApplications(token: string) {
  return reqJson("GET", "/oauth/applications", undefined, token) as Promise<
    Array<{ client_id: string; name?: string | null; redirect_uris: string[]; created_unix: number }>
  >;
}

export async function registerOAuthApplication(
  token: string,
  payload: { name: string; redirect_uris: string[] }
): Promise<{ client_id: string; client_secret: string; redirect_uris: string[] }> {
  return reqJson(
    "POST",
    "/oauth/applications",
    payload as unknown as Record<string, unknown>,
    token
  ) as Promise<{ client_id: string; client_secret: string; redirect_uris: string[] }>;
}

/** Server-side FitID AI ranking: full profile vs catalog priors (unique order per user). */
export type BusinessInsights = {
  generated_at: string;
  account_type?: string;
  dataset?: string;
  live_meta?: Record<string, number | string>;
  kpis: Record<string, number>;
  gender_split: Array<{ label: string; pct: number }>;
  silhouette_preferences: Array<{ label: string; pct: number }>;
  top_allergens: Array<{ material: string; share_pct: number }>;
  size_demand_index: Array<{ band: string; index: number }>;
  chest_waist_clusters: Array<{ cluster: string; share_pct: number; note: string }>;
  weekly_trend: Array<{ week: string; consent_opt_in_rate: number; avg_scan_confidence: number }>;
  ai_recommendations: Array<{ title: string; detail: string; impact: string }>;
  partnership: { headline: string; bullets: string[]; integration_steps: string[] };
};

/** Business insights — authenticated business JWT unlocks sandbox aggregates derived from shopper profiles in this database. */
export async function fetchBusinessInsights(accessToken?: string | null): Promise<BusinessInsights> {
  const headers: HeadersInit = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${API_BASE}/business/insights`, { headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.detail ? String(body.detail) : "Business insights failed");
  }
  return response.json();
}

export async function fetchPersonalizedCatalog(email: string, category: string, limit = 60): Promise<PersonalizedProduct[]> {
  const params = new URLSearchParams({ category, limit: String(limit) });
  const response = await fetch(
    `${API_BASE}/recommend/personalized/${encodeURIComponent(email)}?${params.toString()}`
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.detail ? String(body.detail) : "Personalized catalog failed");
  }
  return response.json();
}
