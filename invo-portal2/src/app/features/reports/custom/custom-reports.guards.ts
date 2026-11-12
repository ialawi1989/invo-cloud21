import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';

/**
 * The builder is mounted at the top level (full screen, outside the reports
 * routes), so it preloads its own strings. Kept in its own file so the app
 * routes can import it without pulling the builder into the main bundle.
 */
export const customReportsTranslationsLoaded: CanActivateFn = async () => {
  await inject(LanguageService).loadFeature('reports');
  return true;
};
