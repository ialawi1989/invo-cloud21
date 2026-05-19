import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { HttpClient, provideHttpClient, withFetch } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { APP_ROUTES } from './app.routes';
import { APP_CONFIG, AppConfig } from './app-config.token';

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
