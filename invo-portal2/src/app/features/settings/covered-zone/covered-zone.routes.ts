import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/** Load both the page's own namespace AND the settings namespace —
 *  the location-edit modal lives in the settings feature and its
 *  template references `SETTINGS.BRANCHES.*` keys. Loading them
 *  here means the modal can render labelled text on first open
 *  instead of bare i18n keys. */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await Promise.all([
    lang.loadFeature('covered-zone'),
    lang.loadFeature('settings'),
  ]);
  return true;
};

export const COVERED_ZONE_ROUTES: Routes = [
  {
    path: '',
    canActivate:   [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/covered-zone.component').then(m => m.CoveredZoneComponent),
  },
];
