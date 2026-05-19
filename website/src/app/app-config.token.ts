import { InjectionToken } from '@angular/core';

/**
 * Runtime per-tenant config delivered to the browser by the SSR
 * Express layer at `/assets/config.json`. Resolved once at bootstrap
 * and provided synchronously through `APP_CONFIG` after the initial
 * fetch settles (see app.config.ts).
 *
 * Mirrors oldEco's app-config.token.ts; extended with optional
 * customizer-aware fields so the dashboard can configure the
 * postMessage allowlist without a rebuild.
 */
export interface AppConfig {
  /** Merchant slug — derived from the request host on the server. */
  subdomain: string;
  /** Origin of the dashboard that embeds the website in an iframe.
   *  When set, `PreviewService` adds it to the postMessage allowlist. */
  dashboardOrigin?: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
