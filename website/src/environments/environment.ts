// ────────────────────────────────────────────────────────────────────
// Centralized environment + URL resolution.
//
// Both `environment.ts` and `environment.prod.ts` resolve to the same
// shape — the prod file just re-exports this one. The split between
// "dev" and "prod" is decided **at runtime** by inspecting the host
// the app is loaded from, not by Angular's build-time file
// replacement. That keeps the URL config in a single place and avoids
// drift between the two env files.
// ────────────────────────────────────────────────────────────────────

const PROD_DASHBOARD_URL = '';
const DEV_DASHBOARD_URL  = 'http://localhost:4700';

/** Decide whether we're on a production host. Local + LAN ranges
 *  count as dev; everything else is treated as prod. Returns `false`
 *  during SSR / tests where there's no `window` so dev defaults take
 *  over safely. */
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
  dashboardUrl: isProd ? PROD_DASHBOARD_URL : DEV_DASHBOARD_URL,
};
