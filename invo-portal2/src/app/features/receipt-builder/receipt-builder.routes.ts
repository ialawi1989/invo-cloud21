import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';

/**
 * URL pattern
 *   /settings/receipt-builder        → list (this module — stays under MainLayoutComponent)
 *   /settings/receipt-builder/:id    → editor — registered as a TOP-LEVEL route in
 *                                       `app.routes.ts` so it bypasses the sidebar/topbar
 *                                       chrome (full-page builder, same shape as
 *                                       `/settings/tables`). Hosting the editor here
 *                                       under `loadChildren` would nest it inside the
 *                                       layout shell and shrink the canvas.
 *
 * Privilege gate is set on the Settings tile via
 * `recieptBuilderSecurity.actions.view.access`. The translation guard
 * waits for the `receipt-builder` namespace before activation so the
 * page never renders raw `RECEIPT_BUILDER.*` keys on first paint.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('receipt-builder');
  return true;
};

export const RECEIPT_BUILDER_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded],
    loadComponent: () =>
      import('./pages/receipt-builder-list/receipt-builder-list.component').then(m => m.ReceiptBuilderListComponent),
  },
];
