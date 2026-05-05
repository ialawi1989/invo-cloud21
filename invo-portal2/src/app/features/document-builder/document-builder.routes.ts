import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';

/**
 * URL pattern (matches receipt-builder for consistency)
 *   /settings/document-builder         → list (this module — under MainLayoutComponent)
 *   /settings/document-builder/:id     → editor — registered as a TOP-LEVEL route in
 *                                         `app.routes.ts` so the full-page builder
 *                                         bypasses the sidebar/topbar chrome.
 *
 * The translation guard waits for the `document-builder` namespace
 * before activation so the page never renders raw `DOCUMENT_BUILDER.*`
 * keys on first paint.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('document-builder');
  return true;
};

export const DOCUMENT_BUILDER_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded],
    loadComponent: () =>
      import('./pages/document-builder-list/document-builder-list.component')
        .then((m) => m.DocumentBuilderListComponent),
  },
];
