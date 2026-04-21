import {
  ApplicationConfig, importProvidersFrom, inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, HttpClient, withInterceptors } from '@angular/common/http';
import { TranslateModule, TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { featureInterceptor } from './core/interceptors/feature.interceptor';
import { LanguageService } from './core/i18n/language.service';

// Custom loader — fetches public/i18n/{lang}.json
// Avoids TranslateHttpLoader constructor API changes across versions
class JsonTranslateLoader implements TranslateLoader {
  constructor(private http: HttpClient) {}
  getTranslation(lang: string): Observable<TranslationObject> {
    return this.http.get<TranslationObject>(`i18n/${lang}.json`);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
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
      return lang.loadFeature('products');
    }),
  ],
};
