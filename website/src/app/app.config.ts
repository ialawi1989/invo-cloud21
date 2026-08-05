import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { HttpClient, provideHttpClient, withFetch } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { APP_ROUTES } from './app.routes';
import { APP_CONFIG, AppConfig } from './app-config.token';
import { TenantService } from './features/blog/services/tenant.service';
import { CurrencyService } from './core/currency/currency.service';
import { BlogSettingsService } from './features/blog/services/blog-settings.service';
import { NavigationService } from './features/navigation/services/navigation.service';

/**
 * Loads tenant config from the SSR-rendered `/assets/config.json`.
 * Mirrors oldEco. Returns a stable empty config when the fetch
 * fails so the app still boots in customizer mode (where the
 * dashboard supplies the page data over postMessage and the
 * subdomain is irrelevant).
 */
async function getAppConfig(http: HttpClient): Promise<AppConfig> {
  const fallback: AppConfig = { subdomain: '' };
  try {
    const result = await firstValueFrom(
      http.get<AppConfig>('./assets/config.json').pipe(
        catchError(() => of(fallback)),
      ),
    );
    return result ?? fallback;
  } catch {
    return fallback;
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),

    // Single HttpClient instance with fetch — required for SSR's
    // request-context forwarding. Declared BEFORE APP_CONFIG so the
    // factory below sees it.
    provideHttpClient(withFetch()),

    {
      provide: APP_CONFIG,
      useFactory: (http: HttpClient) => getAppConfig(http),
      deps: [HttpClient],
    },

    // Resolve the tenant slug once, before routing fires any blog request.
    // Mirrors oldEco's initializeApp (subdomain / localhost / custom domain).
    provideAppInitializer(() => inject(TenantService).resolve()),

    // Currency symbol + decimal places, on BOTH server and browser, and
    // AWAITED — unlike the warm-ups below. A price is not decoration: if SSR
    // paints `1.00` and the client later corrects it to `BHD 1.000`, the
    // shopper has already read the wrong number. Blocking here costs one
    // request that the page needs anyway.
    provideAppInitializer(() => {
      const tenant   = inject(TenantService);
      const currency = inject(CurrencyService);
      return tenant.resolve().then(() => currency.load());
    }),

    // Warm blog settings on every route (browser only) so site-wide
    // analytics (GA4 / Search Console) initialise even on non-blog
    // pages like the storefront root. MUST await tenant resolution first
    // — otherwise this races resolve() and fires getSettings with an
    // empty slug (→ /v1/ecommerce//…), 404ing and poisoning the one-shot
    // settings cache. resolve() is idempotent (shared promise), so this
    // doesn't duplicate the work. Fire-and-forget after that.
    provideAppInitializer(() => {
      if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
      // Capture services synchronously — the injection context is lost
      // after an await, so we can't inject() past the first tick. Then
      // warm settings once the tenant slug resolves (resolve() is a
      // shared promise, so this doesn't duplicate the work).
      const tenant = inject(TenantService);
      const settings = inject(BlogSettingsService);
      void tenant.resolve().then(() => settings.load());
    }),

    // Warm the storefront navigation (browser only) after the tenant
    // slug resolves, so the header paints the published menu without a
    // per-route fetch. In customize mode load() no-ops (menus stream in
    // over postMessage instead). Fire-and-forget — nav is non-critical.
    provideAppInitializer(() => {
      if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
      const tenant = inject(TenantService);
      const navigation = inject(NavigationService);
      void tenant.resolve().then(() => navigation.load());
    }),

    provideRouter(
      APP_ROUTES,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
    ),

    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({ includePostRequests: true }),
    ),
  ],
};
