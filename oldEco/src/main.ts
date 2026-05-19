// import { bootstrapApplication } from '@angular/platform-browser';
// import { appConfig } from './app/app.config';
// import { AppComponent } from './app/app.component';
// import 'zone.js';  // Included with Angular by default

// bootstrapApplication(AppComponent, appConfig)
//   .catch((err) => console.error(err));
// src/main.ts
// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { getLogger } from './app/services/logger/logger.service';
// zone.js loaded via angular.json polyfills — do not import here

// Register the service worker without redeclaring types
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
      })
      .catch((error: any) => {
        // Angular has bootstrapped by load time, so the logger is ready.
        getLogger()?.error(error?.message, { stack: error?.stack, context: 'main.serviceWorkerRegistration' });
      });
  });
} else {
  console.warn('Service Workers are not supported in this browser.');
}

bootstrapApplication(AppComponent, appConfig)
  // Fall back to console.error here: if bootstrap throws, Angular DI never
  // initialised and the LoggerService is unreachable.
  .catch((err) => console.error(err));