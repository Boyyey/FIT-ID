import { NextResponse } from "next/server";

const DEMO_CLIENT_ID = "fitid_demo_store";

export async function POST(request: Request) {
  let body: { code?: string; redirect_uri?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 });
  }
  const { code, redirect_uri } = body;
  if (!code || !redirect_uri) {
    return NextResponse.json({ detail: "code and redirect_uri required" }, { status: 400 });
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";
  const clientSecret =
    process.env.PARTNER_OAUTH_CLIENT_SECRET ?? "fitid-demo-partner-secret-change-me";

  const response = await fetch(`${apiBase}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: DEMO_CLIENT_ID,
      client_secret: clientSecret,
      redirect_uri
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const hint = !process.env.PARTNER_OAUTH_CLIENT_SECRET
      ? "Set PARTNER_OAUTH_CLIENT_SECRET in the frontend environment so the demo exchange can verify partner access tokens."
      : undefined;
    return NextResponse.json(
      {
        detail: data.detail ?? "Token exchange failed",
        ...(hint ? { hint } : {})
      },
      { status: response.status }
    );
  }
  return NextResponse.json(data, { status: response.status });
}
