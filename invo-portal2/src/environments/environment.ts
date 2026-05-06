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

/** Decide whether we're on a production host. Local + LAN ranges
 *  count as dev; everything else (i.e. a real public hostname) is
 *  treated as prod. Returns `false` during SSR / tests where there's
 *  no `window` so dev defaults take over safely. */
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

const isProd = isProdHost();

export const environment = {
  production:   isProd,
  backendUrl:   isProd ? PROD_BACKEND_URL   : DEV_BACKEND_URL,
  dashboardUrl: isProd ? PROD_DASHBOARD_URL : DEV_DASHBOARD_URL,
  websiteUrl:   isProd ? PROD_WEBSITE_URL   : DEV_WEBSITE_URL,
};
