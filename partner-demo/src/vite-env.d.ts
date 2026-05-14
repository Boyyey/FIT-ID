/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FITID_API_BASE: string;
  readonly VITE_PARTNER_CLIENT_ID: string;
  /** Optional: paste a token from FitID for instant “signed in” (local demos only). */
  readonly VITE_FITID_ACCESS_TOKEN?: string;
  /** Base URL of the token proxy (must match server/token-proxy.mjs). */
  readonly VITE_TOKEN_PROXY_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
