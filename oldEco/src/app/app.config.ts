import { ApplicationConfig, ErrorHandler, importProvidersFrom, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { HttpClient, provideHttpClient, withFetch } from '@angular/common/http';
import { CustomRouteReuseStrategy } from './services/route-saver.service';
import { GlobalErrorHandler } from './services/logger/global-error-handler';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { AppEffects } from './store/app.effects';
import { cartStateReducer, pageStateReducer } from './store/app.reducer';
import { createTranslateLoader } from './translate-loader';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG, AppConfig } from './app-config.token';

async function getAppConfig(http: HttpClient): Promise<AppConfig> {
  let result = await firstValueFrom(http.get<AppConfig>('./assets/config.json'));
  return result;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    {
      provide: APP_CONFIG,
      useFactory: async (http: HttpClient) => await getAppConfig(http),
      deps: [HttpClient]
    },

    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({
      scrollPositionRestoration: 'disabled', // Restores previous scroll position on backward navigation
      anchorScrolling: 'disabled',           // Enables scrolling to anchor elements
    }),), // Ensure routes are defined
    provideHttpClient(withFetch()),

    // Provide client hydration
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({
        includePostRequests: true,
      })
    ),

    // Register custom RouteReuseStrategy
    { provide: RouteReuseStrategy, useClass: CustomRouteReuseStrategy },

    // Global error handler — funnels uncaught Angular errors to LoggerService
    { provide: ErrorHandler, useClass: GlobalErrorHandler },

    // Async animations - defers animation JS until needed
    provideAnimationsAsync(),

    // Import NgRx Store and Effects
    importProvidersFrom(
      StoreModule.forRoot({ pageState: pageStateReducer, cartState: cartStateReducer }),
      EffectsModule.forRoot([AppEffects])
    ),

    // Import TranslateModule
    importProvidersFrom(TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient]
      }
    }))
  ]
};
