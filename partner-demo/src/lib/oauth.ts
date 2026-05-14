const DEFAULT_SCOPE = "body_measurements,fit_preferences,allergies,posture,skin_tone";

export function buildAuthorizeUrl(params: {
  apiBase: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  state?: string;
}): string {
  const base = params.apiBase.replace(/\/$/, "");
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    state: params.state ?? `partner-demo-${Date.now()}`,
    scope: params.scope ?? DEFAULT_SCOPE
  });
  return `${base}/oauth/authorize?${q.toString()}`;
}
