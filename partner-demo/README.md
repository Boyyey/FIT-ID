# Luma Atelier — FitID partner demo store

Standalone mini storefront that demonstrates **Sign in with FitID** (OAuth2 authorization code flow) and shows the **partner access token** plus an optional **profile** slice returned by the FitID API.

## Prerequisites

1. **FitID backend** running (`http://localhost:8000/api/v1` by default) with the same `PARTNER_OAUTH_CLIENT_SECRET` / `OAUTH_DEMO_CLIENT_SECRET` as in this folder’s `.env`.
2. **FitID web app** (Next.js on `http://localhost:3000`) for the consent screen — `FITID_PUBLIC_URL` on the backend must point here (default `http://localhost:3000`).

The demo OAuth client allows redirect URI **`http://localhost:5174/callback`** (merged on backend startup from `OAUTH_DEMO_REDIRECT_URIS` / defaults). This app uses **Vite on port 5174**.

## Setup

```bash
cd partner-demo
cp .env.example .env
# Edit .env if your API base, ports, or demo client secret differ
npm install
npm run dev
```

Open **http://localhost:5174**.

`npm run dev` starts:

- **Vite** — storefront UI on port **5174**
- **Token proxy** — `server/token-proxy.mjs` on port **8787** (exchanges `code` → `access_token` using `client_secret` **only on the server**)

## Using a pasted access token (env)

For screen recordings or quick tests without running OAuth again, you can set:

```env
VITE_FITID_ACCESS_TOKEN=paste-token-here
```

Rebuild/restart dev server after changing. **Never commit real tokens**; anyone can read values baked into the frontend bundle.

Remove this line when testing the full **Sign in with FitID** button flow. If a session already exists in the browser, sign out first so the env token can apply.

## Sign in with FitID (live)

1. Click **Sign in with FitID** on the store.
2. Complete login + consent on the FitID site.
3. You return to `/callback`; the proxy exchanges the code; you land on the home page with **token + profile** visible.

## Production note

Real partners must exchange the authorization code **on their own backend**, never ship `client_secret` or long-lived tokens in the browser. This repo uses a tiny local proxy only for teaching and demos.
