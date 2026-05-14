/**
 * Lightweight helper — still perform token exchanges on your backend.
 * Expects apiBase like "https://api.example.com/api/v1".
 */
(function (g) {
  "use strict";
  g.fitidBuildAuthorizeURL = function (apiBase, query) {
    var base = String(apiBase || "").replace(/\/+$/, "");
    var q = typeof URLSearchParams !== "undefined" ? new URLSearchParams(query || {}) : null;
    if (!q || !base) throw new Error("fitidBuildAuthorizeURL requires apiBase and query object");
    return base + "/oauth/authorize?" + q.toString();
  };
})(typeof window !== "undefined" ? window : globalThis);
