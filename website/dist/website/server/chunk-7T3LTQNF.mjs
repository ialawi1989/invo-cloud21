import './polyfills.server.mjs';

// src/environments/environment.ts
var PROD_DASHBOARD_URL = "";
var DEV_DASHBOARD_URL = "http://localhost:4700";
var PROD_API_BASE = "";
var DEV_API_PORT = 3001;
function isProdHost() {
  if (typeof window === "undefined" || !window.location)
    return false;
  const host = window.location.hostname;
  if (!host)
    return false;
  if (host === "localhost" || host === "127.0.0.1")
    return false;
  if (/^10\./.test(host))
    return false;
  if (/^192\.168\./.test(host))
    return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host))
    return false;
  return true;
}
function resolveApiBase(prod) {
  if (typeof window !== "undefined") {
    const injected = window.__BLOG_API_BASE__;
    if (typeof injected === "string" && injected.length)
      return injected;
  }
  if (prod)
    return PROD_API_BASE;
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${DEV_API_PORT}`;
  }
  return `http://localhost:${DEV_API_PORT}`;
}
function resolveSiteOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}
function resolveDashboardUrl(prod) {
  if (typeof window !== "undefined") {
    const injected = window.__DASHBOARD_ORIGIN__;
    if (typeof injected === "string" && injected.length)
      return injected;
  }
  return prod ? PROD_DASHBOARD_URL : DEV_DASHBOARD_URL;
}
function resolveCustomizerAllowlist(prod) {
  const fromWindow = typeof window !== "undefined" ? window.__CUSTOMIZER_ORIGINS__ : void 0;
  if (Array.isArray(fromWindow)) {
    return fromWindow.filter((o) => typeof o === "string" && o.length > 0);
  }
  return prod ? [] : ["http://localhost:4700"];
}
var isProd = isProdHost();
var environment = {
  production: isProd,
  // ── Backend (proxied through Express SSR layer) ──────────────────
  // Browser code talks to `./v1/...` and the SSR layer proxies to
  // `${process.env.BASE_URL}`. `BASE_URL` here is intentionally
  // relative so the same bundle works on every tenant origin
  // (`*.invopos.shop`, custom domain, dev, etc.).
  BASE_URL: "./v1",
  websocketIP: "./v1",
  PORT: 4e3,
  // ── Customizer (dashboard ⇄ iframe postMessage) ──────────────────
  // PreviewService accepts any of: this value, anything in
  // `customizerOriginsAllowed`, or the page's own origin.
  dashboardUrl: resolveDashboardUrl(isProd),
  customizerOriginsAllowed: resolveCustomizerAllowlist(isProd),
  // ── Blog feature (separate API base) ─────────────────────────────
  apiBase: resolveApiBase(isProd),
  siteOrigin: resolveSiteOrigin(),
  /** Default site name used in <title> templates when settings don't
   *  override. Wire this to the customizer's siteTitle at runtime. */
  siteName: "Blog"
};

export {
  environment
};
//# sourceMappingURL=chunk-7T3LTQNF.mjs.map
