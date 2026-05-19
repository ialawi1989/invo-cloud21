// ────────────────────────────────────────────────────────────────────
// Centralized environment + URL resolution.
//
// Both `environment.ts` and `environment.prod.ts` resolve to the same
// shape — the prod file just re-exports this one. The split between
// "dev" and "prod" is decided **at runtime** by inspecting the host
// the app is loaded from, not by Angular's build-time file
// replacement. That keeps the URL config in a single place and avoids
// drift between the two env files.
//
// To add a new environment URL: add a `*_DEV` / `*_PROD` constant
// pair below, then expose it on `environment` via the same ternary.
// Every service in the app reads from `environment.<key>`, so no
// caller changes are needed.
// ────────────────────────────────────────────────────────────────────

const PROD_BACKEND_URL   = 'https://devback.invopos.co/v1/app/';
const DEV_BACKEND_URL    = 'http://10.2.2.89:3001/v1/app/';

const PROD_DASHBOARD_URL = '';
const DEV_DASHBOARD_URL  = 'http://localhost:4700';

const PROD_WEBSITE_URL   = '';
const DEV_WEBSITE_URL    = 'http://localhost:4600';

/** Deployment tier inferred from the page's hostname.
 *
 *   • `local`      — `localhost`, `127.0.0.1`, or any RFC1918 LAN IP.
 *   • `dev`        — any host that includes the `.dev.invopos.` infix
 *                    (admin lives at `*.dev.invopos.co`, storefront at
 *                    `*.dev.invopos.shop`).
 *   • `test`       — same shape with `.test.invopos.`.
 *   • `production` — anything else (real public hostname).
 *
 *  Returns `production` during SSR / tests where there's no `window`,
 *  because the only consumer is the storefront URL builder and the
 *  production fall-back is the safest default for a tile that opens
 *  an external link.
 */
export type Tier = 'local' | 'dev' | 'test' | 'production';

function detectTier(): Tier {
  if (typeof window === 'undefined' || !window.location) return 'production';
  const host = window.location.hostname;
  if (!host) return 'production';
  if (host === 'localhost' || host === '127.0.0.1')      return 'local';
  if (/^10\./.test(host))                                return 'local';
  if (/^192\.168\./.test(host))                          return 'local';
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host))           return 'local';
  if (host.includes('.dev.invopos.'))                    return 'dev';
  if (host.includes('.test.invopos.'))                   return 'test';
  return 'production';
}

const tier   = detectTier();
const isProd = tier === 'production';

export const environment = {
  tier,
  production:   isProd,
  backendUrl:   isProd ? PROD_BACKEND_URL   : DEV_BACKEND_URL,
  dashboardUrl: isProd ? PROD_DASHBOARD_URL : DEV_DASHBOARD_URL,
  websiteUrl:   isProd ? PROD_WEBSITE_URL   : DEV_WEBSITE_URL,
};
