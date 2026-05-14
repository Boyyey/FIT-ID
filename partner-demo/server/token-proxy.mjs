/**
 * Small local server: exchanges OAuth `code` for tokens using client_secret.
 * Never expose PARTNER_OAUTH_CLIENT_SECRET in the browser — keep it in partner-demo/.env only.
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PORT = Number(process.env.TOKEN_PROXY_PORT || 8787);
const apiBase = (process.env.FITID_API_BASE || "http://localhost:8000/api/v1").replace(/\/$/, "");
const clientId = process.env.PARTNER_OAUTH_CLIENT_ID || "fitid_demo_store";
const clientSecret =
  process.env.PARTNER_OAUTH_CLIENT_SECRET || "fitid-demo-partner-secret-change-me";

const corsOrigin = process.env.TOKEN_PROXY_CORS_ORIGIN || "http://localhost:5174";

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...headers
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS" && req.url === "/api/partner/exchange") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    });
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/partner/exchange") {
    try {
      const body = await readBody(req);
      const code = body.code;
      const redirect_uri = body.redirect_uri;
      if (!code || !redirect_uri) {
        send(res, 400, { detail: "code and redirect_uri required" });
        return;
      }

      const upstream = await fetch(`${apiBase}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri
        })
      });

      const data = await upstream.json().catch(() => ({}));
      send(res, upstream.status, data);
    } catch (err) {
      send(res, 500, { detail: err instanceof Error ? err.message : "exchange failed" });
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[fitid-partner-demo] token proxy http://127.0.0.1:${PORT} (CORS ${corsOrigin})`);
});
