// ────────────────────────────────────────────────────────────────────
// Centralized environment + URL resolution.
//
// Both `environment.ts` and `environment.prod.ts` resolve to the same
// shape — the prod file just re-exports this one. The dev-vs-prod
// split is decided at runtime by inspecting the host the app is
// loaded from. That keeps URL config in one place.
//
// PHILOSOPHY (mirrors oldEco)
//   Browser code talks to relative paths like `./v1/ecommerce/${subdomain}/...`
//   and the SSR Express layer (src/server.ts) proxies them to the
//   real backend at `${process.env.BASE_URL}`. So the browser bundle
//   itself never needs to know the real backend URL.
//
//   Per-tenant info (subdomain, dashboard origin) is delivered to the
//   browser via the SSR-rendered `/assets/config.json` endpoint,
//   loaded once at bootstrap and read via the `APP_CONFIG` token.
//
// CUSTOMIZER
//   The dashboard embeds the website as `<iframe src=".../?customize=true">`
//   and talks to it with postMessage. The allowed dashboard origin
//   is configurable at three layers (most → least specific):
//     1. `window.__DASHBOARD_ORIGIN__` (set by `/assets/config.json`)
//     2. `customizerOriginsAllowed` (build-time fallback list)
//     3. `dashboardUrl` (dev default)
//   PreviewService walks the allowlist; same-origin is always accepted.
// ────────────────────────────────────────────────────────────────────

const PROD_DASHBOARD_URL = '';
const DEV_DASHBOARD_URL  = 'http://localhost:4700';

// Public blog API base used by the blog feature. The blog API can be
// hosted separately from the ecommerce backend — typically on the
// same host:port as the dashboard's API server in dev.
const PROD_API_BASE = '';
const DEV_API_PORT  = 3001;

function isProdHost(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const host = window.location.hostname;
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1') return false;
  if (/^10\./.test(host))                            return false;
  if (/^192\.168\./.test(host))                      return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host))       return false;
  return true;
}

function resolveApiBase(prod: boolean): string {
  // Runtime override (e.g. set by /assets/config.json or an inline
  // <script> in index.html) takes priority — lets one bundle serve
  // multiple tenants without a rebuild.
  if (typeof window !== 'undefined') {
    const injected = (window as any).__BLOG_API_BASE__;
    if (typeof injected === 'string' && injected.length) return injected;
  }
  if (prod) return PROD_API_BASE;
  // Dev: hit the API on the same host the page came from. Using a
  // literal "localhost" here breaks LAN testing — a phone or another
  // machine pointed at 10.x.x.x:4600 would otherwise try to reach its
  // own machine on :3001.
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${DEV_API_PORT}`;
  }
  return `http://localhost:${DEV_API_PORT}`;
}

function resolveSiteOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

function resolveDashboardUrl(prod: boolean): string {
  if (typeof window !== 'undefined') {
    const injected = (window as any).__DASHBOARD_ORIGIN__;
    if (typeof injected === 'string' && injected.length) return injected;
  }
  return prod ? PROD_DASHBOARD_URL : DEV_DASHBOARD_URL;
}

function resolveCustomizerAllowlist(prod: boolean): string[] {
  const fromWindow =
    typeof window !== 'undefined'
      ? (window as any).__CUSTOMIZER_ORIGINS__
      : undefined;
  if (Array.isArray(fromWindow)) {
    return fromWindow.filter((o): o is string => typeof o === 'string' && o.length > 0);
  }
  return prod ? [] : ['http://localhost:4700'];
}

const isProd = isProdHost();

export const environment = {
  production: isProd,

  // ── Backend (proxied through Express SSR layer) ──────────────────
  // Browser code talks to `./v1/...` and the SSR layer proxies to
  // `${process.env.BASE_URL}`. `BASE_URL` here is intentionally
  // relative so the same bundle works on every tenant origin
  // (`*.invopos.shop`, custom domain, dev, etc.).
  BASE_URL:    './v1',
  websocketIP: './v1',
  PORT:        4000,

  // ── Customizer (dashboard ⇄ iframe postMessage) ──────────────────
  // PreviewService accepts any of: this value, anything in
  // `customizerOriginsAllowed`, or the page's own origin.
  dashboardUrl:              resolveDashboardUrl(isProd),
  customizerOriginsAllowed:  resolveCustomizerAllowlist(isProd),

  // ── Blog feature (separate API base) ─────────────────────────────
  apiBase:    resolveApiBase(isProd),
  siteOrigin: resolveSiteOrigin(),
  /** Default site name used in <title> templates when settings don't
   *  override. Wire this to the customizer's siteTitle at runtime. */
  siteName:   'Blog',
};
