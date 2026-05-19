import { inject } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { LanguageService } from '@core/i18n/language.service';
import { unsavedChangesGuard } from '@core/guards/unsaved-changes.guard';

/**
 * URL pattern
 *   /settings/menu-builder           → list
 *   /settings/menu-builder/new       → empty form (create)
 *   /settings/menu-builder/:id       → edit existing menu by id
 *
 * Surfaced from the Settings hub, gated by the
 * `menuBuilderSecurity.actions.view.access` privilege (configured on
 * the settings tile in `settings.component.ts`). The translation
 * guard waits for the `menu-builder` namespace to land before
 * activation so the page never renders raw `MENU_BUILDER.*` keys on
 * first paint.
 */
const translationsLoaded: CanActivateFn = async () => {
  const lang = inject(LanguageService);
  await lang.loadFeature('menu-builder');
  return true;
};

export const MENU_BUILDER_ROUTES: Routes = [
  {
    path: '',
    canActivate: [translationsLoaded],
    loadComponent: () =>
      import('./pages/menu-builder-list/menu-builder-list.component').then(m => m.MenuBuilderListComponent),
  },
  {
    path: ':id',
    canActivate: [translationsLoaded],
    canDeactivate: [unsavedChangesGuard],
    loadComponent: () =>
      import('./pages/menu-builder-form/menu-builder-form.component').then(m => m.MenuBuilderFormComponent),
  },
];
