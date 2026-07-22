import {
  ApplicationConfig, importProvidersFrom, inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import {
  provideRouter, withComponentInputBinding, withInMemoryScrolling,
  withNavigationErrorHandler,
} from '@angular/router';
import { provideHttpClient, HttpClient, withInterceptors } from '@angular/common/http';
import { TranslateModule, TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { featureInterceptor } from './core/interceptors/feature.interceptor';
import { LanguageService } from './core/i18n/language.service';
import { UiTranslationsService } from './core/i18n/ui-translations.service';

// Custom loader — fetches public/i18n/{lang}.json
// Avoids TranslateHttpLoader constructor API changes across versions
class JsonTranslateLoader implements TranslateLoader {
  constructor(private http: HttpClient) {}
  getTranslation(lang: string): Observable<TranslationObject> {
    // A language may have no shipped bundle (merchant-added, translated via
    // DB UI-string overrides). Treat a missing file as empty so those keys
    // fall back to the default language instead of erroring the load.
    return this.http.get<TranslationObject>(`i18n/${lang}.json`).pipe(
      catchError(() => of({} as TranslationObject)),
    );
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // `scrollPositionRestoration: 'top'` — every navigation starts at the
    // top of the new page instead of inheriting the scroll offset from the
    // page we just came from. `anchorScrolling: 'enabled'` honours `#hash`
    // links when the URL carries a fragment.
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
      // Recover from stale lazy chunks after a redeploy. When a new build renames
      // chunk hashes, an open tab still holds the old index and requests a chunk
      // name that no longer exists — the dynamic import throws "Failed to fetch
      // dynamically imported module" and the route silently dies. Force one full
      // reload so the browser fetches the fresh index + current chunk names. The
      // sessionStorage guard prevents a reload loop if the failure is genuine
      // (e.g. the chunk is really 404 on this build, not just stale).
      withNavigationErrorHandler((event) => {
        const msg = String((event as any)?.error?.message ?? (event as any)?.error ?? '');
        const isChunkLoadFailure =
          /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(msg);
        if (isChunkLoadFailure && !sessionStorage.getItem('chunk-reload')) {
          sessionStorage.setItem('chunk-reload', '1');
          location.reload();
          return;
        }
        // A successful navigation later clears the guard (see app component).
      }),
    ),
    provideHttpClient(
      withInterceptors([authInterceptor, featureInterceptor])
    ),
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'en',
        loader: {
          provide: TranslateLoader,
          useClass: JsonTranslateLoader,
          deps: [HttpClient],
        },
      })
    ),
    // Preload feature-scoped translations before bootstrap so the very first
    // render already has them. Safer than relying on per-route CanActivate
    // guards for shared feature bundles used across multiple routes.
    provideAppInitializer(() => {
      const lang = inject(LanguageService);
      // Eagerly construct so its company-watching effect runs and per-tenant
      // UI-string overrides get layered over the static JSON once the
      // company is known.
      inject(UiTranslationsService);
      return lang.loadFeature('products');
    }),
  ],
};
