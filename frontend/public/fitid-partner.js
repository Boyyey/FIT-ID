/**
 * FitID Partner SDK (minimal) — "Sign in with FitID" for external sites.
 *
 * Usage:
 *   <script src="https://your-fitid-host/fitid-partner.js"></script>
 *   <script>
 *     FitIDPartner.openAuthorize({
 *       apiBase: 'https://api.your-fitid-host.com/api/v1',
 *       clientId: 'fitid_demo_store',
 *       redirectUri: 'https://your-store.com/fitid/callback',
 *       scope: 'body_measurements,fit_preferences,allergies'
 *     });
 *   </script>
 */
(function (global) {
  function openAuthorize(opts) {
    if (!opts || !opts.apiBase || !opts.clientId || !opts.redirectUri) {
      console.error("[FitIDPartner] apiBase, clientId, and redirectUri are required");
      return;
    }
    var scope = opts.scope || "body_measurements,fit_preferences,allergies";
    var state = opts.state || ("s-" + Math.random().toString(36).slice(2) + Date.now().toString(36));
    var q = new URLSearchParams({
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri,
      state: state,
      scope: scope
    });
    var url = opts.apiBase.replace(/\/$/, "") + "/oauth/authorize?" + q.toString();
    global.location.href = url;
  }

  global.FitIDPartner = { openAuthorize: openAuthorize };
})(typeof window !== "undefined" ? window : this);
